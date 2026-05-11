/**
 * Plain script (no modules) — loaded before admin-boot.js.
 * Keep anonKey in sync with js/supabase-config.js (used by public teaching-status module).
 * Use ONLY the Supabase anon (publishable) key — never the service role key.
 */
window.__UPWARD_SUPABASE_CONFIG__ = {
  url: 'https://okgsccnnmocvoddkspoj.supabase.co',
  anonKey: '',
};
