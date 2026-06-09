-- ============================================================================
-- Upward Knoxville — full admin + public read repair (idempotent)
-- Run once in Supabase SQL Editor as a privileged role.
--
-- Safe: CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, no DROP DATA,
--       no RENAME TABLE. Policies created only when missing (by name).
--
-- Hash route note (frontend): member care uses #admin-member_care
-- (underscore), not #admin-member-care.
--
-- After this file: create Storage bucket team-photos + policies in Dashboard
-- (or uncomment storage block at end if you manage storage via SQL).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Touch updated_at (single function for all tables)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_upward_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- RBAC helper (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_has_permission(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_profile_roles apr
    JOIN public.admin_role_permissions arp ON arp.role_id = apr.role_id
    JOIN public.admin_permissions ap ON ap.id = arp.permission_id
    WHERE apr.profile_id = auth.uid()
      AND ap.permission_key = p_key
  );
$$;

REVOKE ALL ON FUNCTION public.admin_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_has_permission(text) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- Announcements updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.announcements_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables (exact names used by the current frontend)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  body text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.teaching_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  current_book text,
  current_chapter text,
  current_verses text,
  where_we_left_off text,
  current_focus text,
  public_note text
);

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text,
  email text,
  message text,
  prayer_request boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.admin_update_bcc_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL
);

ALTER TABLE public.admin_update_bcc_emails
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.admin_update_bcc_emails
  ADD COLUMN IF NOT EXISTS label text;

CREATE UNIQUE INDEX IF NOT EXISTS admin_update_bcc_emails_email_lower_key
  ON public.admin_update_bcc_emails (lower(trim(email)));

CREATE TABLE IF NOT EXISTS public.governance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text,
  category text,
  body text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'under_review', 'approved', 'archived')),
  is_locked boolean NOT NULL DEFAULT false,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.governance_documents
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.governance_document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.governance_documents (id) ON DELETE CASCADE,
  body text,
  status text,
  action_type text,
  changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leadership_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  role_title text,
  contact_email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leadership_directory
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.leadership_directory
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.admin_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  scheduled_at timestamptz,
  location_notes text,
  agenda_summary text,
  minutes_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  motion_text text,
  status text NOT NULL DEFAULT 'draft',
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_financial_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text,
  amount_cents integer,
  summary text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_kind text NOT NULL DEFAULT 'expense'
    CHECK (
      record_kind IN (
        'income',
        'expense',
        'giving',
        'reimbursement',
        'benevolence',
        'designated',
        'budget',
        'transfer'
      )
    ),
  amount_cents integer NOT NULL DEFAULT 0,
  fund text,
  category text,
  status text NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('pending', 'cleared', 'void', 'recorded')),
  coi_flag boolean NOT NULL DEFAULT false,
  supporting_doc_url text,
  memo text,
  occurred_on date NOT NULL DEFAULT (timezone('utc', now()))::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.admin_internal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  storage_path text,
  visibility text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_member_care (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code text UNIQUE,
  summary text,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL UNIQUE,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role_id uuid NOT NULL REFERENCES public.admin_roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.admin_permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_profile_roles (
  profile_id uuid NOT NULL REFERENCES public.admin_profiles (id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.admin_roles (id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, role_id)
);

-- RBAC compatibility (live Supabase: role_key, permission_key, profile_id)
ALTER TABLE public.admin_roles ADD COLUMN IF NOT EXISTS role_key text;
ALTER TABLE public.admin_roles ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.admin_roles ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.admin_roles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS permission_key text;

ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.admin_profile_roles ADD COLUMN IF NOT EXISTS profile_id uuid;
ALTER TABLE public.admin_profile_roles ADD COLUMN IF NOT EXISTS role_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS admin_permissions_permission_key_key
  ON public.admin_permissions (permission_key);
CREATE UNIQUE INDEX IF NOT EXISTS admin_roles_role_key_key
  ON public.admin_roles (role_key);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  public_title text,
  bio text,
  internal_notes text,
  photo_path text,
  is_active boolean NOT NULL DEFAULT true,
  show_publicly boolean NOT NULL DEFAULT false,
  visibility_level text NOT NULL DEFAULT 'hidden'
    CHECK (visibility_level IN ('hidden', 'helper', 'leader', 'primary_leader')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id)
);

CREATE TABLE IF NOT EXISTS public.team_member_roles (
  team_member_id uuid NOT NULL REFERENCES public.team_members (id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.admin_roles (id) ON DELETE CASCADE,
  PRIMARY KEY (team_member_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.admin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_date date,
  assigned_team_member_id uuid REFERENCES public.team_members (id) ON DELETE SET NULL,
  send_email_update boolean NOT NULL DEFAULT false,
  show_publicly boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id)
);

CREATE TABLE IF NOT EXISTS public.admin_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  notice_type text NOT NULL DEFAULT 'info' CHECK (notice_type IN ('info', 'alert', 'gathering', 'prayer')),
  show_publicly boolean NOT NULL DEFAULT false,
  send_email_update boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id)
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  show_publicly boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id)
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text,
  action text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_governance_documents_status ON public.governance_documents (status);
CREATE INDEX IF NOT EXISTS idx_governance_documents_updated_at ON public.governance_documents (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_revisions_document ON public.governance_document_revisions (document_id);
CREATE INDEX IF NOT EXISTS idx_leadership_active ON public.leadership_directory (is_active);
CREATE INDEX IF NOT EXISTS idx_admin_meetings_scheduled ON public.admin_meetings (scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_votes_status ON public.admin_votes (status);
CREATE INDEX IF NOT EXISTS idx_admin_financial_requests_status ON public.admin_financial_requests (status);
CREATE INDEX IF NOT EXISTS idx_admin_fin_records_occurred ON public.admin_financial_records (occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_admin_fin_records_kind ON public.admin_financial_records (record_kind);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON public.contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_published_order ON public.announcements (is_published, display_order);
CREATE INDEX IF NOT EXISTS idx_teaching_status_updated ON public.teaching_status (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_starts ON public.events (starts_at DESC);

-- ---------------------------------------------------------------------------
-- Triggers (DROP IF EXISTS then CREATE — idempotent by trigger name)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_governance_documents_updated_at ON public.governance_documents;
CREATE TRIGGER trg_governance_documents_updated_at
  BEFORE UPDATE ON public.governance_documents
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS trg_leadership_directory_updated_at ON public.leadership_directory;
CREATE TRIGGER trg_leadership_directory_updated_at
  BEFORE UPDATE ON public.leadership_directory
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS trg_admin_meetings_updated_at ON public.admin_meetings;
CREATE TRIGGER trg_admin_meetings_updated_at
  BEFORE UPDATE ON public.admin_meetings
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS trg_admin_votes_updated_at ON public.admin_votes;
CREATE TRIGGER trg_admin_votes_updated_at
  BEFORE UPDATE ON public.admin_votes
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS trg_admin_financial_requests_updated_at ON public.admin_financial_requests;
CREATE TRIGGER trg_admin_financial_requests_updated_at
  BEFORE UPDATE ON public.admin_financial_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS trg_admin_financial_records_updated_at ON public.admin_financial_records;
CREATE TRIGGER trg_admin_financial_records_updated_at
  BEFORE UPDATE ON public.admin_financial_records
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS trg_admin_internal_documents_updated_at ON public.admin_internal_documents;
CREATE TRIGGER trg_admin_internal_documents_updated_at
  BEFORE UPDATE ON public.admin_internal_documents
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS trg_admin_member_care_updated_at ON public.admin_member_care;
CREATE TRIGGER trg_admin_member_care_updated_at
  BEFORE UPDATE ON public.admin_member_care
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS trg_admin_profiles_updated ON public.admin_profiles;
CREATE TRIGGER trg_admin_profiles_updated
  BEFORE UPDATE ON public.admin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS trg_team_members_updated ON public.team_members;
CREATE TRIGGER trg_team_members_updated
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS trg_admin_tasks_updated ON public.admin_tasks;
CREATE TRIGGER trg_admin_tasks_updated
  BEFORE UPDATE ON public.admin_tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS trg_admin_notices_updated ON public.admin_notices;
CREATE TRIGGER trg_admin_notices_updated
  BEFORE UPDATE ON public.admin_notices
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated ON public.events;
CREATE TRIGGER trg_events_updated
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS tr_teaching_status_updated ON public.teaching_status;
CREATE TRIGGER tr_teaching_status_updated
  BEFORE UPDATE ON public.teaching_status
  FOR EACH ROW EXECUTE FUNCTION public.fn_upward_touch_updated_at();

DROP TRIGGER IF EXISTS tr_announcements_set_updated_at ON public.announcements;
CREATE TRIGGER tr_announcements_set_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.announcements_set_updated_at();

-- ---------------------------------------------------------------------------
-- Enable RLS on all listed tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_update_bcc_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_document_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leadership_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_financial_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_internal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_member_care ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profile_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Policies: helper DO blocks (create only if policy name missing)
-- ---------------------------------------------------------------------------

-- announcements: anon read published; authenticated full CRUD
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'announcements' AND policyname = 'upward_repair_announcements_anon_select_published'
  ) THEN
    CREATE POLICY upward_repair_announcements_anon_select_published
      ON public.announcements FOR SELECT TO anon
      USING (is_published = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'announcements' AND policyname = 'upward_repair_announcements_auth_all'
  ) THEN
    CREATE POLICY upward_repair_announcements_auth_all
      ON public.announcements FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- teaching_status: public read (anon + authenticated); authenticated write
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'teaching_status' AND policyname = 'upward_repair_teaching_status_public_select'
  ) THEN
    CREATE POLICY upward_repair_teaching_status_public_select
      ON public.teaching_status FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'teaching_status' AND policyname = 'upward_repair_teaching_status_auth_write'
  ) THEN
    CREATE POLICY upward_repair_teaching_status_auth_write
      ON public.teaching_status FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- contact_messages: internal admin (authenticated); inserts via Edge use service role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_messages' AND policyname = 'upward_repair_contact_messages_auth_all'
  ) THEN
    CREATE POLICY upward_repair_contact_messages_auth_all
      ON public.contact_messages FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- admin_update_bcc_emails: authenticated manage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_update_bcc_emails' AND policyname = 'upward_repair_bcc_auth_all'
  ) THEN
    CREATE POLICY upward_repair_bcc_auth_all
      ON public.admin_update_bcc_emails FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Portal operational tables: authenticated full access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'governance_documents' AND policyname = 'upward_repair_governance_documents_auth_all') THEN
    CREATE POLICY upward_repair_governance_documents_auth_all ON public.governance_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'governance_document_revisions' AND policyname = 'upward_repair_governance_revisions_select') THEN
    CREATE POLICY upward_repair_governance_revisions_select ON public.governance_document_revisions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'governance_document_revisions' AND policyname = 'upward_repair_governance_revisions_insert') THEN
    CREATE POLICY upward_repair_governance_revisions_insert ON public.governance_document_revisions FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'governance_document_revisions' AND policyname = 'upward_repair_governance_revisions_update') THEN
    CREATE POLICY upward_repair_governance_revisions_update ON public.governance_document_revisions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leadership_directory' AND policyname = 'upward_repair_leadership_auth_all') THEN
    CREATE POLICY upward_repair_leadership_auth_all ON public.leadership_directory FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_meetings' AND policyname = 'upward_repair_meetings_auth_all') THEN
    CREATE POLICY upward_repair_meetings_auth_all ON public.admin_meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_votes' AND policyname = 'upward_repair_votes_auth_all') THEN
    CREATE POLICY upward_repair_votes_auth_all ON public.admin_votes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_financial_requests' AND policyname = 'upward_repair_finreq_auth_all') THEN
    CREATE POLICY upward_repair_finreq_auth_all ON public.admin_financial_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_financial_records' AND policyname = 'upward_repair_finrec_auth_all') THEN
    CREATE POLICY upward_repair_finrec_auth_all ON public.admin_financial_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_internal_documents' AND policyname = 'upward_repair_documents_auth_all') THEN
    CREATE POLICY upward_repair_documents_auth_all ON public.admin_internal_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_member_care' AND policyname = 'upward_repair_member_care_auth_all') THEN
    CREATE POLICY upward_repair_member_care_auth_all ON public.admin_member_care FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- RBAC reference tables: readable when signed in
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_roles' AND policyname = 'upward_repair_admin_roles_select') THEN
    CREATE POLICY upward_repair_admin_roles_select ON public.admin_roles FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_permissions' AND policyname = 'upward_repair_admin_permissions_select') THEN
    CREATE POLICY upward_repair_admin_permissions_select ON public.admin_permissions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_role_permissions' AND policyname = 'upward_repair_admin_role_permissions_select') THEN
    CREATE POLICY upward_repair_admin_role_permissions_select ON public.admin_role_permissions FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- admin_profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_profiles' AND policyname = 'upward_repair_admin_profiles_self_all') THEN
    CREATE POLICY upward_repair_admin_profiles_self_all ON public.admin_profiles FOR ALL TO authenticated
      USING (id = auth.uid()) WITH CHECK (id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_profiles' AND policyname = 'upward_repair_admin_profiles_team_read') THEN
    CREATE POLICY upward_repair_admin_profiles_team_read ON public.admin_profiles FOR SELECT TO authenticated
      USING (public.admin_has_permission('team.manage'));
  END IF;
END $$;

-- admin_profile_roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_profile_roles' AND policyname = 'upward_repair_profile_roles_select_self') THEN
    CREATE POLICY upward_repair_profile_roles_select_self ON public.admin_profile_roles FOR SELECT TO authenticated
      USING (profile_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_profile_roles' AND policyname = 'upward_repair_profile_roles_select_settings') THEN
    CREATE POLICY upward_repair_profile_roles_select_settings ON public.admin_profile_roles FOR SELECT TO authenticated
      USING (public.admin_has_permission('settings.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_profile_roles' AND policyname = 'upward_repair_profile_roles_insert_settings') THEN
    CREATE POLICY upward_repair_profile_roles_insert_settings ON public.admin_profile_roles FOR INSERT TO authenticated
      WITH CHECK (public.admin_has_permission('settings.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_profile_roles' AND policyname = 'upward_repair_profile_roles_update_settings') THEN
    CREATE POLICY upward_repair_profile_roles_update_settings ON public.admin_profile_roles FOR UPDATE TO authenticated
      USING (public.admin_has_permission('settings.manage')) WITH CHECK (public.admin_has_permission('settings.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_profile_roles' AND policyname = 'upward_repair_profile_roles_delete_settings') THEN
    CREATE POLICY upward_repair_profile_roles_delete_settings ON public.admin_profile_roles FOR DELETE TO authenticated
      USING (public.admin_has_permission('settings.manage'));
  END IF;
END $$;

-- team_members + team_member_roles (public read subset + team.manage)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'upward_repair_team_public_select') THEN
    CREATE POLICY upward_repair_team_public_select ON public.team_members FOR SELECT TO anon, authenticated
      USING (
        is_active = true
        AND show_publicly = true
        AND visibility_level IN ('leader', 'primary_leader')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'upward_repair_team_manage_select') THEN
    CREATE POLICY upward_repair_team_manage_select ON public.team_members FOR SELECT TO authenticated
      USING (public.admin_has_permission('team.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'upward_repair_team_manage_insert') THEN
    CREATE POLICY upward_repair_team_manage_insert ON public.team_members FOR INSERT TO authenticated
      WITH CHECK (public.admin_has_permission('team.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'upward_repair_team_manage_update') THEN
    CREATE POLICY upward_repair_team_manage_update ON public.team_members FOR UPDATE TO authenticated
      USING (public.admin_has_permission('team.manage')) WITH CHECK (public.admin_has_permission('team.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'upward_repair_team_manage_delete') THEN
    CREATE POLICY upward_repair_team_manage_delete ON public.team_members FOR DELETE TO authenticated
      USING (public.admin_has_permission('team.manage'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_member_roles' AND policyname = 'upward_repair_tmr_public_select') THEN
    CREATE POLICY upward_repair_tmr_public_select ON public.team_member_roles FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.id = team_member_id
            AND tm.is_active = true
            AND tm.show_publicly = true
            AND tm.visibility_level IN ('leader', 'primary_leader')
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_member_roles' AND policyname = 'upward_repair_tmr_manage_select') THEN
    CREATE POLICY upward_repair_tmr_manage_select ON public.team_member_roles FOR SELECT TO authenticated
      USING (public.admin_has_permission('team.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_member_roles' AND policyname = 'upward_repair_tmr_manage_insert') THEN
    CREATE POLICY upward_repair_tmr_manage_insert ON public.team_member_roles FOR INSERT TO authenticated
      WITH CHECK (public.admin_has_permission('team.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_member_roles' AND policyname = 'upward_repair_tmr_manage_update') THEN
    CREATE POLICY upward_repair_tmr_manage_update ON public.team_member_roles FOR UPDATE TO authenticated
      USING (public.admin_has_permission('team.manage')) WITH CHECK (public.admin_has_permission('team.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_member_roles' AND policyname = 'upward_repair_tmr_manage_delete') THEN
    CREATE POLICY upward_repair_tmr_manage_delete ON public.team_member_roles FOR DELETE TO authenticated
      USING (public.admin_has_permission('team.manage'));
  END IF;
END $$;

-- admin_tasks, admin_notices (permission-gated)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_tasks' AND policyname = 'upward_repair_tasks_select') THEN
    CREATE POLICY upward_repair_tasks_select ON public.admin_tasks FOR SELECT TO authenticated
      USING (public.admin_has_permission('tasks.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_tasks' AND policyname = 'upward_repair_tasks_insert') THEN
    CREATE POLICY upward_repair_tasks_insert ON public.admin_tasks FOR INSERT TO authenticated
      WITH CHECK (public.admin_has_permission('tasks.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_tasks' AND policyname = 'upward_repair_tasks_update') THEN
    CREATE POLICY upward_repair_tasks_update ON public.admin_tasks FOR UPDATE TO authenticated
      USING (public.admin_has_permission('tasks.manage')) WITH CHECK (public.admin_has_permission('tasks.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_tasks' AND policyname = 'upward_repair_tasks_delete') THEN
    CREATE POLICY upward_repair_tasks_delete ON public.admin_tasks FOR DELETE TO authenticated
      USING (public.admin_has_permission('tasks.manage'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_notices' AND policyname = 'upward_repair_notices_select') THEN
    CREATE POLICY upward_repair_notices_select ON public.admin_notices FOR SELECT TO authenticated
      USING (public.admin_has_permission('notices.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_notices' AND policyname = 'upward_repair_notices_insert') THEN
    CREATE POLICY upward_repair_notices_insert ON public.admin_notices FOR INSERT TO authenticated
      WITH CHECK (public.admin_has_permission('notices.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_notices' AND policyname = 'upward_repair_notices_update') THEN
    CREATE POLICY upward_repair_notices_update ON public.admin_notices FOR UPDATE TO authenticated
      USING (public.admin_has_permission('notices.manage')) WITH CHECK (public.admin_has_permission('notices.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_notices' AND policyname = 'upward_repair_notices_delete') THEN
    CREATE POLICY upward_repair_notices_delete ON public.admin_notices FOR DELETE TO authenticated
      USING (public.admin_has_permission('notices.manage'));
  END IF;
END $$;

-- events: public when show_publicly; manage with calendar.manage
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'upward_repair_events_public_select') THEN
    CREATE POLICY upward_repair_events_public_select ON public.events FOR SELECT TO anon, authenticated
      USING (show_publicly = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'upward_repair_events_manage_select') THEN
    CREATE POLICY upward_repair_events_manage_select ON public.events FOR SELECT TO authenticated
      USING (public.admin_has_permission('calendar.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'upward_repair_events_manage_insert') THEN
    CREATE POLICY upward_repair_events_manage_insert ON public.events FOR INSERT TO authenticated
      WITH CHECK (public.admin_has_permission('calendar.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'upward_repair_events_manage_update') THEN
    CREATE POLICY upward_repair_events_manage_update ON public.events FOR UPDATE TO authenticated
      USING (public.admin_has_permission('calendar.manage')) WITH CHECK (public.admin_has_permission('calendar.manage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'upward_repair_events_manage_delete') THEN
    CREATE POLICY upward_repair_events_manage_delete ON public.events FOR DELETE TO authenticated
      USING (public.admin_has_permission('calendar.manage'));
  END IF;
END $$;

-- admin_audit_log
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_audit_log' AND policyname = 'upward_repair_audit_insert') THEN
    CREATE POLICY upward_repair_audit_insert ON public.admin_audit_log FOR INSERT TO authenticated
      WITH CHECK (actor_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_audit_log' AND policyname = 'upward_repair_audit_select') THEN
    CREATE POLICY upward_repair_audit_select ON public.admin_audit_log FOR SELECT TO authenticated
      USING (public.admin_has_permission('settings.manage'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;

GRANT SELECT ON public.teaching_status TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teaching_status TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_messages TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_update_bcc_emails TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.governance_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_document_revisions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leadership_directory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_meetings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_financial_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_financial_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_internal_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_member_care TO authenticated;

GRANT SELECT ON public.admin_roles, public.admin_permissions, public.admin_role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_profile_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_member_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;

GRANT SELECT ON public.team_members TO anon;
GRANT SELECT ON public.team_member_roles TO anon;
GRANT SELECT ON public.events TO anon;

-- ---------------------------------------------------------------------------
-- Seed admin_permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.admin_permissions (permission_key) VALUES
  ('finance.view'),
  ('finance.manage'),
  ('team.manage'),
  ('tasks.manage'),
  ('settings.manage'),
  ('calendar.manage'),
  ('notices.manage')
ON CONFLICT (permission_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed admin_roles
-- ---------------------------------------------------------------------------
INSERT INTO public.admin_roles (role_key, label, sort_order) VALUES
  ('founder_organizer', 'Founder / Organizer', 10),
  ('lead_pastor', 'Lead Pastor', 20),
  ('elder', 'Elder', 30),
  ('associate_pastor', 'Associate Pastor', 40),
  ('pastoral_intern', 'Pastoral Intern', 50),
  ('deacon', 'Deacon', 60),
  ('ministry_coordinator', 'Ministry Coordinator', 70),
  ('group_leader', 'Group Leader', 80),
  ('volunteer', 'Volunteer', 90)
ON CONFLICT (role_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed role ↔ permission matrix (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.role_key IN ('founder_organizer', 'lead_pastor')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.permission_key <> 'settings.manage'
WHERE r.role_key IN ('elder', 'associate_pastor')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.permission_key IN ('finance.view', 'finance.manage', 'tasks.manage', 'calendar.manage', 'notices.manage')
WHERE r.role_key = 'deacon'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.permission_key IN ('team.manage', 'tasks.manage', 'calendar.manage', 'notices.manage')
WHERE r.role_key = 'ministry_coordinator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.permission_key = 'tasks.manage'
WHERE r.role_key IN ('group_leader', 'volunteer')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.permission_key IN ('team.manage', 'calendar.manage', 'notices.manage')
WHERE r.role_key = 'pastoral_intern'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed governance_documents (meaningful internal drafts)
-- ---------------------------------------------------------------------------
INSERT INTO public.governance_documents (slug, title, category, status, body)
VALUES
(
  'statement-of-faith',
  'Statement of Faith',
  'Doctrine',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

This statement summarizes the church’s settled convictions drawn from Scripture regarding the triune God, the person and work of Christ, salvation by grace through faith, the authority and sufficiency of the Bible, the church as Christ’s body, and the consummation of all things in Christ. It is intended to orient teaching, membership expectations, and partnership with other churches—not to replace careful exposition from the pulpit or pastoral care.

We affirm historic Christian orthodoxy as expressed in the Nicene tradition regarding the deity of Christ and the Trinity, while recognizing secondary matters where faithful Christians may disagree. Members are not required to agree on every interpretive detail of non-salvation issues, but are asked to joyfully submit to the church’s teaching ministry and to protect the unity of the Spirit in the bond of peace.
$doc$
),
(
  'constitution',
  'Church Constitution',
  'Governance',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

The constitution defines the church’s legal identity, purpose, membership, leadership structure, meetings, property, indemnification, and dissolution procedures as permitted by applicable nonprofit law. It should be read together with the bylaws: the constitution establishes foundational authority and continuity, while the bylaws operationalize routine decisions and officer duties.

Until formally adopted, this document is a working draft for elders and qualified counsel. Amendments should be tracked with dated revisions, recorded votes where required, and filed with the church’s registered agent. No provision here authorizes conduct inconsistent with Scripture or with the church’s stated faith commitments.
$doc$
),
(
  'bylaws',
  'Church Bylaws',
  'Governance',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

These bylaws specify how the church conducts business: officer titles and terms, quorum, notice requirements, meeting frequency, committees, financial approvals, and conflict procedures. They should align with the constitution and state nonprofit statutes. Elders are responsible to ensure practices on the ground match written policy.

Operational policies (facility use, volunteer screening, reimbursement forms) belong in separate handbooks referenced here by appendix, so bylaws remain stable while day-to-day procedures can update without a full congregational vote when permitted.
$doc$
),
(
  'leadership-standards',
  'Leadership Standards',
  'Leadership',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

Leaders—including elders, deacons, teachers, and ministry directors—are held to a biblical pattern of character, hospitality, self-control, and faithfulness in marriage and money (see 1 Timothy 3; Titus 1). This document clarifies expectations for public teaching, social media conduct, confidentiality, mentoring boundaries, and accountability when concerns arise.

Standards are not perfectionism; they are clarity for protection and care. When a leader falls short, the church responds with truth in love, appropriate oversight, restoration where possible, and removal where necessary to safeguard the flock.
$doc$
),
(
  'financial-stewardship-policy',
  'Financial Stewardship Policy',
  'Finance',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

God owns everything; the church stewards what is entrusted for mission and mercy. This policy outlines budgeting, approval thresholds, dual control on disbursements, reimbursement documentation, restricted gifts, annual review, and external audit triggers. Large or unusual expenditures require documented elder approval consistent with the bylaws.

Generosity is encouraged without coercive fundraising. Financial transparency to members should be regular, prudent, and respectful of donor privacy and security.
$doc$
),
(
  'conflict-of-interest',
  'Conflict of Interest Policy',
  'Governance',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

Leaders must disclose material financial or relational interests that could bias decisions involving contracts, employment, rentals, or vendor selection. When a conflict exists, the interested person abstains from discussion and vote, and the body records the recusal.

Annual disclosures, training for new leaders, and a simple reporting channel reduce the risk of self-dealing. The goal is integrity before God and credibility with the congregation and community.
$doc$
),
(
  'child-safety',
  'Child Safety & Ministry Protection',
  'Safety',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

Children and vulnerable adults deserve environments that are predictable, supervised, and screened. This policy covers background checks, two-adult rules, check-in/checkout, bathroom policies, incident reporting, and cooperation with civil authorities when safety is at risk.

Training is required before serving; temporary exceptions are not granted without elder approval. Allegations are taken seriously, investigated promptly, and handled with pastoral sensitivity and legal prudence.
$doc$
),
(
  'membership-covenant',
  'Membership Covenant',
  'Membership',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

Membership is a mutual commitment: the church pledges Word-centered care, oversight, and the ordinances; members pledge to attend faithfully, give cheerfully, pursue holiness, submit to biblical discipline, and serve according to gifts. The covenant does not save; Christ does. It does clarify how we walk together.

Prospective members should receive teaching on gospel, doctrine, and expectations before affirmation. Transfers from other churches are welcomed with reasonable diligence.
$doc$
),
(
  'discipline-restoration',
  'Church Discipline & Restoration',
  'Pastoral Care',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

Church discipline is an act of love aimed at repentance, protection of the body, and honor to Christ (Matthew 18; 1 Corinthians 5). This document describes stages from private correction to elder involvement to removal from membership in cases of unrepentant sin that is outward, serious, and substantiated.

Restoration pathways are possible where there is credible repentance, accountability, and time for rebuilding trust. Confidentiality is maintained except where disclosure is necessary for safety or legal compliance.
$doc$
),
(
  'voting-resolutions',
  'Voting & Resolution Policy',
  'Governance',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

Certain matters—calling pastors, constitutional changes, property transactions, and annual budgets as defined in bylaws—require member meetings with proper notice and quorum. This document lists vote thresholds, ballot procedures for contested elections, and how minutes record motions.

Elders lead without tyranny; the congregation exercises authority where Scripture and bylaws assign it. Clarity on what is “advisory” versus “binding” prevents confusion.
$doc$
),
(
  'amendments',
  'Amendment Policy',
  'Governance',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

Amendments to the constitution and bylaws follow notice periods, readings or summaries for members, and recorded votes. Emergency amendments should be rare and documented with legal counsel. Version control stores prior language for historical reference.

Minor non-material corrections (typos, cross-references) may be handled administratively when permitted by counsel and recorded in meeting minutes.
$doc$
),
(
  'dissolution',
  'Dissolution Clause',
  'Governance',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

If the church ceases operations, assets are distributed exclusively for tax-exempt religious, charitable, or educational purposes as required by law and donor intent. Debts and obligations are satisfied first. This draft should mirror filing language used with the state and IRS.

Leaders must not personally benefit from residual assets. A successor organization may be named when appropriate.
$doc$
),
(
  'internal-governance-notes',
  'Internal Governance Notes',
  'Operations',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

Internal notes in the admin portal (for example, elder working comments on governance drafts) are not public communications. They should be factual, kind, and limited to what is necessary. Retention schedules align with legal, insurance, and ministry needs; sensitive data is minimized and access is restricted to authorized users.

Granular role-based access can be tightened over time; until then, treat authenticated staff accounts as trusted and train users accordingly.
$doc$
)
ON CONFLICT (slug) DO NOTHING;
