/**
 * Plain script — sets globals for js/supabase-client.js and js/admin.js.
 * Paste your Supabase anon (publishable) key into SUPABASE_ANON_KEY before deploy.
 * Never commit the service role key.
 */
(function (global) {
  var SUPABASE_URL = 'https://okgsccnnmocvoddkspoj.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_hjLSkR7MZqOB1nbhKY7Lew_xtlwCXCV';
  global.__UPWARD_SUPABASE_URL__ = SUPABASE_URL;
  global.__UPWARD_SUPABASE_ANON_KEY__ = SUPABASE_ANON_KEY;
})(typeof window !== 'undefined' ? window : globalThis);
