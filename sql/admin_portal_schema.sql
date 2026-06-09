-- Upward Knoxville — internal admin portal schema (phase 1)
-- Run in Supabase SQL Editor as a privileged role.
-- RLS: authenticated-only policies below. No anon policies — the anon key is used by the
-- browser client, but PostgREST applies the authenticated role when a user session (JWT) is present.
--
-- DELETE: authenticated may delete on operational portal tables where policies allow.
-- governance_document_revisions: SELECT / INSERT / UPDATE only (no DELETE policy or grant).
-- governance_documents: DELETE allowed for draft cleanup. admin_audit_log is defined in
-- sql/supabase-admin-schema.sql (append-only there). This file does not recreate admin_audit_log.
--
-- Legacy installs: stub tables operations_meetings, votes_motions, financial_requests,
-- internal_documents, member_care_cases are renamed to admin_* once if the new names do not exist.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.upward_admin_portal_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rename legacy stub tables → admin_* (idempotent)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.operations_meetings') is not null and to_regclass('public.admin_meetings') is null then
    alter table public.operations_meetings rename to admin_meetings;
  end if;
  if to_regclass('public.votes_motions') is not null and to_regclass('public.admin_votes') is null then
    alter table public.votes_motions rename to admin_votes;
  end if;
  if to_regclass('public.financial_requests') is not null and to_regclass('public.admin_financial_requests') is null then
    alter table public.financial_requests rename to admin_financial_requests;
  end if;
  if to_regclass('public.internal_documents') is not null and to_regclass('public.admin_internal_documents') is null then
    alter table public.internal_documents rename to admin_internal_documents;
  end if;
  if to_regclass('public.member_care_cases') is not null and to_regclass('public.admin_member_care') is null then
    alter table public.member_care_cases rename to admin_member_care;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- staff_roles (phase 2 RBAC hook)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  roles text[] not null default '{}'::text[]
);

create index if not exists idx_staff_roles_roles on public.staff_roles using gin (roles);

-- ---------------------------------------------------------------------------
-- governance_documents
-- ---------------------------------------------------------------------------
create table if not exists public.governance_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text,
  category text,
  body text,
  status text not null default 'draft'
    check (status in ('draft', 'under_review', 'approved', 'archived')),
  is_locked boolean not null default false,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create index if not exists idx_governance_documents_status on public.governance_documents (status);
create index if not exists idx_governance_documents_updated_at on public.governance_documents (updated_at desc);
create index if not exists idx_governance_documents_category on public.governance_documents (category);

alter table public.governance_documents
  add column if not exists created_by uuid references auth.users (id) on delete set null;

drop trigger if exists trg_governance_documents_updated_at on public.governance_documents;
create trigger trg_governance_documents_updated_at
  before update on public.governance_documents
  for each row execute procedure public.upward_admin_portal_touch_updated_at();

-- ---------------------------------------------------------------------------
-- governance_document_revisions
-- ---------------------------------------------------------------------------
create table if not exists public.governance_document_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.governance_documents (id) on delete cascade,
  body text,
  status text,
  action_type text,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_governance_revisions_document on public.governance_document_revisions (document_id);
create index if not exists idx_governance_revisions_created on public.governance_document_revisions (created_at desc);

-- ---------------------------------------------------------------------------
-- leadership_directory (canonical name — not leadership_profiles)
-- ---------------------------------------------------------------------------
create table if not exists public.leadership_directory (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  role_title text,
  contact_email text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leadership_active on public.leadership_directory (is_active);

alter table public.leadership_directory
  add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.leadership_directory
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

drop trigger if exists trg_leadership_directory_updated_at on public.leadership_directory;
create trigger trg_leadership_directory_updated_at
  before update on public.leadership_directory
  for each row execute procedure public.upward_admin_portal_touch_updated_at();

-- ---------------------------------------------------------------------------
-- admin_meetings, admin_votes, admin_financial_requests, admin_internal_documents, admin_member_care
-- ---------------------------------------------------------------------------
create table if not exists public.admin_meetings (
  id uuid primary key default gen_random_uuid(),
  title text,
  scheduled_at timestamptz,
  location_notes text,
  agenda_summary text,
  minutes_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_votes (
  id uuid primary key default gen_random_uuid(),
  title text,
  motion_text text,
  status text not null default 'draft',
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_financial_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text,
  amount_cents integer,
  summary text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_internal_documents (
  id uuid primary key default gen_random_uuid(),
  title text,
  storage_path text,
  visibility text not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_member_care (
  id uuid primary key default gen_random_uuid(),
  case_code text unique,
  summary text,
  status text not null default 'open',
  assigned_to uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_meetings_scheduled on public.admin_meetings (scheduled_at desc);
create index if not exists idx_admin_votes_status on public.admin_votes (status);
create index if not exists idx_admin_financial_status on public.admin_financial_requests (status);
create index if not exists idx_admin_internal_docs_visibility on public.admin_internal_documents (visibility);
create index if not exists idx_admin_member_care_status on public.admin_member_care (status);
create index if not exists idx_admin_member_care_assigned on public.admin_member_care (assigned_to);

-- ---------------------------------------------------------------------------
-- admin_financial_records — manual ledger (internal; not bank-fed)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_financial_records (
  id uuid primary key default gen_random_uuid(),
  record_kind text not null default 'expense'
    check (
      record_kind in (
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
  amount_cents integer not null default 0,
  fund text,
  category text,
  status text not null default 'recorded'
    check (status in ('pending', 'cleared', 'void', 'recorded')),
  coi_flag boolean not null default false,
  supporting_doc_url text,
  memo text,
  occurred_on date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null
);

create index if not exists idx_admin_fin_records_occurred on public.admin_financial_records (occurred_on desc);
create index if not exists idx_admin_fin_records_kind on public.admin_financial_records (record_kind);
create index if not exists idx_admin_fin_records_fund on public.admin_financial_records (fund);
create index if not exists idx_admin_fin_records_status on public.admin_financial_records (status);

drop trigger if exists trg_admin_financial_records_updated_at on public.admin_financial_records;
create trigger trg_admin_financial_records_updated_at
  before update on public.admin_financial_records
  for each row execute procedure public.upward_admin_portal_touch_updated_at();

drop trigger if exists trg_admin_meetings_updated_at on public.admin_meetings;
create trigger trg_admin_meetings_updated_at
  before update on public.admin_meetings
  for each row execute procedure public.upward_admin_portal_touch_updated_at();

drop trigger if exists trg_admin_votes_updated_at on public.admin_votes;
create trigger trg_admin_votes_updated_at
  before update on public.admin_votes
  for each row execute procedure public.upward_admin_portal_touch_updated_at();

drop trigger if exists trg_admin_financial_requests_updated_at on public.admin_financial_requests;
create trigger trg_admin_financial_requests_updated_at
  before update on public.admin_financial_requests
  for each row execute procedure public.upward_admin_portal_touch_updated_at();

drop trigger if exists trg_admin_internal_documents_updated_at on public.admin_internal_documents;
create trigger trg_admin_internal_documents_updated_at
  before update on public.admin_internal_documents
  for each row execute procedure public.upward_admin_portal_touch_updated_at();

drop trigger if exists trg_admin_member_care_updated_at on public.admin_member_care;
create trigger trg_admin_member_care_updated_at
  before update on public.admin_member_care
  for each row execute procedure public.upward_admin_portal_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — authenticated only (no anon policies)
-- Explicit SELECT / INSERT / UPDATE / DELETE policies (revisions: no DELETE).
-- ---------------------------------------------------------------------------
alter table public.staff_roles enable row level security;
alter table public.governance_documents enable row level security;
alter table public.governance_document_revisions enable row level security;
alter table public.leadership_directory enable row level security;
alter table public.admin_meetings enable row level security;
alter table public.admin_votes enable row level security;
alter table public.admin_financial_requests enable row level security;
alter table public.admin_financial_records enable row level security;
alter table public.admin_internal_documents enable row level security;
alter table public.admin_member_care enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'staff_roles',
        'governance_documents',
        'governance_document_revisions',
        'leadership_directory',
        'admin_meetings',
        'admin_votes',
        'admin_financial_requests',
        'admin_financial_records',
        'admin_internal_documents',
        'admin_member_care'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- staff_roles
create policy staff_roles_auth_select on public.staff_roles for select to authenticated using (true);
create policy staff_roles_auth_insert on public.staff_roles for insert to authenticated with check (true);
create policy staff_roles_auth_update on public.staff_roles for update to authenticated using (true) with check (true);
create policy staff_roles_auth_delete on public.staff_roles for delete to authenticated using (true);

-- governance_documents
create policy governance_documents_auth_select on public.governance_documents for select to authenticated using (true);
create policy governance_documents_auth_insert on public.governance_documents for insert to authenticated with check (true);
create policy governance_documents_auth_update on public.governance_documents for update to authenticated using (true) with check (true);
create policy governance_documents_auth_delete on public.governance_documents for delete to authenticated using (true);

-- governance_document_revisions (append-only via API: no delete)
create policy governance_revisions_auth_select on public.governance_document_revisions for select to authenticated using (true);
create policy governance_revisions_auth_insert on public.governance_document_revisions for insert to authenticated with check (true);
create policy governance_revisions_auth_update on public.governance_document_revisions for update to authenticated using (true) with check (true);

-- leadership_directory
create policy leadership_directory_auth_select on public.leadership_directory for select to authenticated using (true);
create policy leadership_directory_auth_insert on public.leadership_directory for insert to authenticated with check (true);
create policy leadership_directory_auth_update on public.leadership_directory for update to authenticated using (true) with check (true);
create policy leadership_directory_auth_delete on public.leadership_directory for delete to authenticated using (true);

-- admin_meetings
create policy admin_meetings_auth_select on public.admin_meetings for select to authenticated using (true);
create policy admin_meetings_auth_insert on public.admin_meetings for insert to authenticated with check (true);
create policy admin_meetings_auth_update on public.admin_meetings for update to authenticated using (true) with check (true);
create policy admin_meetings_auth_delete on public.admin_meetings for delete to authenticated using (true);

-- admin_votes
create policy admin_votes_auth_select on public.admin_votes for select to authenticated using (true);
create policy admin_votes_auth_insert on public.admin_votes for insert to authenticated with check (true);
create policy admin_votes_auth_update on public.admin_votes for update to authenticated using (true) with check (true);
create policy admin_votes_auth_delete on public.admin_votes for delete to authenticated using (true);

-- admin_financial_requests
create policy admin_financial_requests_auth_select on public.admin_financial_requests for select to authenticated using (true);
create policy admin_financial_requests_auth_insert on public.admin_financial_requests for insert to authenticated with check (true);
create policy admin_financial_requests_auth_update on public.admin_financial_requests for update to authenticated using (true) with check (true);
create policy admin_financial_requests_auth_delete on public.admin_financial_requests for delete to authenticated using (true);

-- admin_financial_records (manual ledger)
create policy admin_financial_records_auth_select on public.admin_financial_records for select to authenticated using (true);
create policy admin_financial_records_auth_insert on public.admin_financial_records for insert to authenticated with check (true);
create policy admin_financial_records_auth_update on public.admin_financial_records for update to authenticated using (true) with check (true);
create policy admin_financial_records_auth_delete on public.admin_financial_records for delete to authenticated using (true);

-- admin_internal_documents
create policy admin_internal_documents_auth_select on public.admin_internal_documents for select to authenticated using (true);
create policy admin_internal_documents_auth_insert on public.admin_internal_documents for insert to authenticated with check (true);
create policy admin_internal_documents_auth_update on public.admin_internal_documents for update to authenticated using (true) with check (true);
create policy admin_internal_documents_auth_delete on public.admin_internal_documents for delete to authenticated using (true);

-- admin_member_care
create policy admin_member_care_auth_select on public.admin_member_care for select to authenticated using (true);
create policy admin_member_care_auth_insert on public.admin_member_care for insert to authenticated with check (true);
create policy admin_member_care_auth_update on public.admin_member_care for update to authenticated using (true) with check (true);
create policy admin_member_care_auth_delete on public.admin_member_care for delete to authenticated using (true);

grant select, insert, update, delete on public.staff_roles to authenticated;
grant select, insert, update, delete on public.governance_documents to authenticated;
grant select, insert, update on public.governance_document_revisions to authenticated;
grant select, insert, update, delete on public.leadership_directory to authenticated;
grant select, insert, update, delete on public.admin_meetings to authenticated;
grant select, insert, update, delete on public.admin_votes to authenticated;
grant select, insert, update, delete on public.admin_financial_requests to authenticated;
grant select, insert, update, delete on public.admin_financial_records to authenticated;
grant select, insert, update, delete on public.admin_internal_documents to authenticated;
grant select, insert, update, delete on public.admin_member_care to authenticated;

-- ---------------------------------------------------------------------------
-- Seed governance documents (generic drafts — not copied from other churches)
-- First line of body must match exactly (see portal UI).
-- ---------------------------------------------------------------------------
insert into public.governance_documents (slug, title, category, status, body)
values
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
  'Bylaws',
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
  'Discipline & Restoration',
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
  'Voting & Resolutions',
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
  'Amendment Procedures',
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
  'Dissolution & Asset Distribution',
  'Governance',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

If the church ceases operations, assets are distributed exclusively for tax-exempt religious, charitable, or educational purposes as required by law and donor intent. Debts and obligations are satisfied first. This draft should mirror filing language used with the state and IRS.

Leaders must not personally benefit from residual assets. A successor organization may be named when appropriate.
$doc$
),
(
  'internal-notes-handling',
  'Internal Notes & Record Retention',
  'Operations',
  'draft',
  $doc$
Internal draft for leadership review. Attorney/CPA review recommended before formal adoption.

Internal notes in the admin portal (for example, elder working comments on governance drafts) are not public communications. They should be factual, kind, and limited to what is necessary. Retention schedules align with legal, insurance, and ministry needs; sensitive data is minimized and access is restricted to authorized users.

Phase 2 will introduce granular role-based access; until then, treat all authenticated staff accounts as trusted and train users accordingly.
$doc$
)
on conflict (slug) do nothing;
