-- ============================================================================
-- Run in Supabase → SQL Editor if the `announcements` table is not present yet.
-- If the table already exists, skip CREATE TABLE and run only the RLS/trigger
-- section (adjust DROP POLICY names if you already created these).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  body text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.announcements IS 'Public announcements; anon reads published only; authenticated CRUD.';

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Public (anon key, no session): only published rows
DROP POLICY IF EXISTS "announcements_select_anon_published" ON public.announcements;
CREATE POLICY "announcements_select_anon_published"
  ON public.announcements
  FOR SELECT
  TO anon
  USING (is_published = true);

-- Signed-in admins: see all rows (drafts + published)
DROP POLICY IF EXISTS "announcements_select_authenticated_all" ON public.announcements;
CREATE POLICY "announcements_select_authenticated_all"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "announcements_insert_authenticated" ON public.announcements;
CREATE POLICY "announcements_insert_authenticated"
  ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "announcements_update_authenticated" ON public.announcements;
CREATE POLICY "announcements_update_authenticated"
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "announcements_delete_authenticated" ON public.announcements;
CREATE POLICY "announcements_delete_authenticated"
  ON public.announcements
  FOR DELETE
  TO authenticated
  USING (true);

GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;

CREATE OR REPLACE FUNCTION public.announcements_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_announcements_set_updated_at ON public.announcements;
CREATE TRIGGER tr_announcements_set_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.announcements_set_updated_at();
