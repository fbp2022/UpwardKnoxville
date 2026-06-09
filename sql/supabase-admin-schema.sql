-- Upward Knoxville: admin RBAC, team, tasks, notices, events, audit log.
-- Apply in Supabase SQL Editor or via migration. Review RLS before production.
--
-- PUBLIC SITE (anon): reads team_members and events via policies below.
-- ADMIN: authenticated users; fine-grained access via admin_has_permission().
-- Service role: not used in the static frontend; keep service_role key server-side only.
--
-- STORAGE: create bucket `team-photos` (public) in Dashboard → Storage.
-- Objects are stored under paths like `public/{member_id}.jpg` for simple public URLs.
-- Policies (Storage → Policies on bucket team-photos):
--   - SELECT: allow public (anon + authenticated) for objects — required for public team.html URLs.
--   - INSERT/UPDATE/DELETE: allow authenticated only (uploads from admin).
-- Example SQL for storage.objects (adjust bucket id from storage.buckets):
/*
INSERT INTO storage.buckets (id, name, public) VALUES ('team-photos', 'team-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE POLICY "team_photos_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'team-photos');

CREATE POLICY "team_photos_authenticated_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'team-photos');

CREATE POLICY "team_photos_authenticated_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'team-photos');

CREATE POLICY "team_photos_authenticated_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'team-photos');
*/

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Reference: roles & permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role_id uuid NOT NULL REFERENCES public.admin_roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.admin_permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.admin_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_profile_roles (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.admin_roles (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

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
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_profiles_updated ON public.admin_profiles;
CREATE TRIGGER trg_admin_profiles_updated
BEFORE UPDATE ON public.admin_profiles
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_team_members_updated ON public.team_members;
CREATE TRIGGER trg_team_members_updated
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_tasks_updated ON public.admin_tasks;
CREATE TRIGGER trg_admin_tasks_updated
BEFORE UPDATE ON public.admin_tasks
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_notices_updated ON public.admin_notices;
CREATE TRIGGER trg_admin_notices_updated
BEFORE UPDATE ON public.admin_notices
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated ON public.events;
CREATE TRIGGER trg_events_updated
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Permission helper (SECURITY DEFINER so RLS can evaluate role joins safely)
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
    WHERE apr.user_id = auth.uid()
      AND ap.key = p_key
  );
$$;

REVOKE ALL ON FUNCTION public.admin_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_has_permission(text) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- Seed permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.admin_permissions (key, label) VALUES
  ('finance.view', 'View finance area'),
  ('finance.manage', 'Manage finance ledger and requests'),
  ('team.manage', 'Manage team roster'),
  ('tasks.manage', 'Manage tasks'),
  ('settings.manage', 'Manage settings and role assignments'),
  ('calendar.manage', 'Manage calendar events'),
  ('notices.manage', 'Manage internal notices')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed roles (keys stable for app code)
-- ---------------------------------------------------------------------------
INSERT INTO public.admin_roles (key, label, sort_order) VALUES
  ('founder_organizer', 'Founder / Organizer', 10),
  ('lead_pastor', 'Lead Pastor', 20),
  ('elder', 'Elder', 30),
  ('associate_pastor', 'Associate Pastor', 40),
  ('pastoral_intern', 'Pastoral Intern', 50),
  ('deacon', 'Deacon', 60),
  ('ministry_coordinator', 'Ministry Coordinator', 70),
  ('group_leader', 'Group Leader', 80),
  ('volunteer', 'Volunteer', 90)
ON CONFLICT (key) DO NOTHING;

-- Map roles → permissions (core matrix; adjust in SQL as needed)
-- founder_organizer & lead_pastor: all
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.key IN ('founder_organizer', 'lead_pastor')
ON CONFLICT DO NOTHING;

-- elder: broad minus settings.manage
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key <> 'settings.manage'
WHERE r.key = 'elder'
ON CONFLICT DO NOTHING;

-- associate_pastor: like elder
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key <> 'settings.manage'
WHERE r.key = 'associate_pastor'
ON CONFLICT DO NOTHING;

-- deacon: finance.view, finance.manage, tasks.manage, calendar.manage, notices.manage
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN ('finance.view', 'finance.manage', 'tasks.manage', 'calendar.manage', 'notices.manage')
WHERE r.key = 'deacon'
ON CONFLICT DO NOTHING;

-- Backfill finance.manage for broad roles (idempotent when schema is reapplied)
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key = 'finance.manage'
WHERE r.key IN ('founder_organizer', 'lead_pastor', 'elder', 'associate_pastor')
ON CONFLICT DO NOTHING;

-- ministry_coordinator: team, tasks, calendar, notices
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN ('team.manage', 'tasks.manage', 'calendar.manage', 'notices.manage')
WHERE r.key = 'ministry_coordinator'
ON CONFLICT DO NOTHING;

-- group_leader: tasks (own-ish — app layer), calendar.view not separate; give tasks + notices read via notices.manage optional — keep minimal: tasks.manage only
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key = 'tasks.manage'
WHERE r.key = 'group_leader'
ON CONFLICT DO NOTHING;

-- volunteer: tasks.manage (lightweight)
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key = 'tasks.manage'
WHERE r.key = 'volunteer'
ON CONFLICT DO NOTHING;

-- pastoral_intern: team + calendar + notices (no finance/settings)
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN ('team.manage', 'calendar.manage', 'notices.manage')
WHERE r.key = 'pastoral_intern'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
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
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Reference tables: readable by any signed-in admin user
CREATE POLICY admin_roles_select ON public.admin_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_permissions_select ON public.admin_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_role_permissions_select ON public.admin_role_permissions FOR SELECT TO authenticated USING (true);

-- Profiles: users manage their own row; read others if they have team.manage (directory)
CREATE POLICY admin_profiles_self_all ON public.admin_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY admin_profiles_select_team ON public.admin_profiles FOR SELECT TO authenticated
  USING (public.admin_has_permission('team.manage'));

-- Role assignments: read own; settings.manage for writes
CREATE POLICY admin_profile_roles_select_self ON public.admin_profile_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY admin_profile_roles_select_settings ON public.admin_profile_roles FOR SELECT TO authenticated
  USING (public.admin_has_permission('settings.manage'));

CREATE POLICY admin_profile_roles_write_settings ON public.admin_profile_roles FOR INSERT TO authenticated
  WITH CHECK (public.admin_has_permission('settings.manage'));

CREATE POLICY admin_profile_roles_update_settings ON public.admin_profile_roles FOR UPDATE TO authenticated
  USING (public.admin_has_permission('settings.manage'));

CREATE POLICY admin_profile_roles_delete_settings ON public.admin_profile_roles FOR DELETE TO authenticated
  USING (public.admin_has_permission('settings.manage'));

-- team_members
CREATE POLICY team_members_public_select ON public.team_members FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND show_publicly = true
    AND visibility_level IN ('leader', 'primary_leader')
  );

CREATE POLICY team_members_manage_select ON public.team_members FOR SELECT TO authenticated
  USING (public.admin_has_permission('team.manage'));

CREATE POLICY team_members_manage_insert ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.admin_has_permission('team.manage'));

CREATE POLICY team_members_manage_update ON public.team_members FOR UPDATE TO authenticated
  USING (public.admin_has_permission('team.manage'))
  WITH CHECK (public.admin_has_permission('team.manage'));

CREATE POLICY team_members_manage_delete ON public.team_members FOR DELETE TO authenticated
  USING (public.admin_has_permission('team.manage'));

-- team_member_roles
CREATE POLICY team_member_roles_public_select ON public.team_member_roles FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = team_member_id
        AND tm.is_active = true
        AND tm.show_publicly = true
        AND tm.visibility_level IN ('leader', 'primary_leader')
    )
  );

CREATE POLICY team_member_roles_manage_select ON public.team_member_roles FOR SELECT TO authenticated
  USING (public.admin_has_permission('team.manage'));

CREATE POLICY team_member_roles_manage_insert ON public.team_member_roles FOR INSERT TO authenticated
  WITH CHECK (public.admin_has_permission('team.manage'));

CREATE POLICY team_member_roles_manage_update ON public.team_member_roles FOR UPDATE TO authenticated
  USING (public.admin_has_permission('team.manage'))
  WITH CHECK (public.admin_has_permission('team.manage'));

CREATE POLICY team_member_roles_manage_delete ON public.team_member_roles FOR DELETE TO authenticated
  USING (public.admin_has_permission('team.manage'));

-- tasks
CREATE POLICY admin_tasks_select ON public.admin_tasks FOR SELECT TO authenticated
  USING (public.admin_has_permission('tasks.manage'));

CREATE POLICY admin_tasks_write ON public.admin_tasks FOR INSERT TO authenticated
  WITH CHECK (public.admin_has_permission('tasks.manage'));

CREATE POLICY admin_tasks_update ON public.admin_tasks FOR UPDATE TO authenticated
  USING (public.admin_has_permission('tasks.manage'))
  WITH CHECK (public.admin_has_permission('tasks.manage'));

CREATE POLICY admin_tasks_delete ON public.admin_tasks FOR DELETE TO authenticated
  USING (public.admin_has_permission('tasks.manage'));

-- notices
CREATE POLICY admin_notices_select ON public.admin_notices FOR SELECT TO authenticated
  USING (public.admin_has_permission('notices.manage'));

CREATE POLICY admin_notices_write ON public.admin_notices FOR INSERT TO authenticated
  WITH CHECK (public.admin_has_permission('notices.manage'));

CREATE POLICY admin_notices_update ON public.admin_notices FOR UPDATE TO authenticated
  USING (public.admin_has_permission('notices.manage'))
  WITH CHECK (public.admin_has_permission('notices.manage'));

CREATE POLICY admin_notices_delete ON public.admin_notices FOR DELETE TO authenticated
  USING (public.admin_has_permission('notices.manage'));

-- events
CREATE POLICY events_public_select ON public.events FOR SELECT TO anon, authenticated
  USING (show_publicly = true);

CREATE POLICY events_manage_select ON public.events FOR SELECT TO authenticated
  USING (public.admin_has_permission('calendar.manage'));

CREATE POLICY events_manage_insert ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.admin_has_permission('calendar.manage'));

CREATE POLICY events_manage_update ON public.events FOR UPDATE TO authenticated
  USING (public.admin_has_permission('calendar.manage'))
  WITH CHECK (public.admin_has_permission('calendar.manage'));

CREATE POLICY events_manage_delete ON public.events FOR DELETE TO authenticated
  USING (public.admin_has_permission('calendar.manage'));

-- audit log: insert if authenticated; select if settings.manage OR own rows optional — allow tasks manage to read limited: keep simple: any authenticated insert, select for settings.manage
CREATE POLICY admin_audit_insert ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

CREATE POLICY admin_audit_select ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.admin_has_permission('settings.manage'));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.admin_roles, public.admin_permissions, public.admin_role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_profile_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_member_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
-- anon needs SELECT on team_members, team_member_roles, events (RLS restricts rows)
GRANT SELECT ON public.team_members TO anon;
GRANT SELECT ON public.team_member_roles TO anon;
GRANT SELECT ON public.events TO anon;
