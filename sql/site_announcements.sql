-- Legacy: prefer sql/announcements.sql and table `announcements` (is_published, display_order).
-- ============================================================================
-- Run this entire file in the Supabase Dashboard → SQL Editor, then Execute.
-- It creates the public announcements table, row-level security, and an
-- updated_at trigger. Adjust schema name only if your project uses a
-- non-default public schema.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.site_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.site_announcements IS 'Short public announcements; readable by anyone, writable by signed-in users (admin UI).';

ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;

-- Anyone with the anon key (or signed-in users) can read rows.
CREATE POLICY "site_announcements_select_public"
  ON public.site_announcements
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only authenticated sessions (admin sign-in) can create posts.
CREATE POLICY "site_announcements_insert_authenticated"
  ON public.site_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "site_announcements_update_authenticated"
  ON public.site_announcements
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "site_announcements_delete_authenticated"
  ON public.site_announcements
  FOR DELETE
  TO authenticated
  USING (true);

GRANT SELECT ON public.site_announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_announcements TO authenticated;

-- Keep updated_at in sync on row updates.
CREATE OR REPLACE FUNCTION public.site_announcements_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_site_announcements_set_updated_at ON public.site_announcements;
CREATE TRIGGER tr_site_announcements_set_updated_at
  BEFORE UPDATE ON public.site_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.site_announcements_set_updated_at();
