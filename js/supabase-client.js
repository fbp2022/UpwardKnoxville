/**
 * Plain script — requires Supabase UMD (window.supabase) and globals from supabase-config.js.
 * Exposes window.UpwardSupabase for js/admin.js and for site modules (e.g. teaching-status-display.js, announcements-display.js).
 */
(function (w) {
  'use strict';

  function isSupabaseConfigured() {
    var url = w.__UPWARD_SUPABASE_URL__;
    var key = w.__UPWARD_SUPABASE_ANON_KEY__;
    return Boolean(
      url &&
      String(key || '').trim() &&
      w.supabase &&
      typeof w.supabase.createClient === 'function'
    );
  }

  var client = null;

  function getSupabase() {
    if (!isSupabaseConfigured()) return null;
    if (!client) {
      client = w.supabase.createClient(
        String(w.__UPWARD_SUPABASE_URL__).trim(),
        String(w.__UPWARD_SUPABASE_ANON_KEY__).trim(),
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        }
      );
    }
    return client;
  }

  w.UpwardSupabase = {
    getSupabase: getSupabase,
    isSupabaseConfigured: isSupabaseConfigured,
  };
})(typeof window !== 'undefined' ? window : globalThis);
