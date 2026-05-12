/**
 * Copy this file to supabase-config.js and paste your Supabase anon (publishable) key.
 * Dashboard: Project Settings → API → Project API keys → anon public
 *
 * Never commit the service role key or database password.
 */
(function (global) {
  var SUPABASE_URL = 'https://okgsccnnmocvoddkspoj.supabase.co';
  var SUPABASE_ANON_KEY = 'paste-your-anon-key-here';
  global.__UPWARD_SUPABASE_URL__ = SUPABASE_URL;
  global.__UPWARD_SUPABASE_ANON_KEY__ = SUPABASE_ANON_KEY;
})(typeof window !== 'undefined' ? window : globalThis);
