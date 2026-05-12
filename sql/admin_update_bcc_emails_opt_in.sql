-- Optional: columns used by submit-contact-message when addToUpdateList is true.
-- Run in Supabase SQL editor if admin_update_bcc_emails only has id + email today.

alter table public.admin_update_bcc_emails
  add column if not exists is_active boolean not null default true;

alter table public.admin_update_bcc_emails
  add column if not exists label text;

-- Helpful for upsert-by-email (adjust if you already have a unique constraint on email).
-- create unique index if not exists admin_update_bcc_emails_email_unique on public.admin_update_bcc_emails (email);
