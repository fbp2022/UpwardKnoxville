/**
 * Upward Knoxville API (Cloudflare Worker + D1). Replaces the old Supabase project.
 * Public, read-only content and the Stay Connected form go through this one address.
 */
(function (global) {
  var BASE = 'https://upward.aviationministries.workers.dev';
  global.UpwardApi = {
    base: BASE,
    get: function (path) {
      return fetch(BASE + path, { headers: { Accept: 'application/json' } }).then(function (res) {
        if (!res.ok) throw new Error('Request failed (' + res.status + ')');
        return res.json();
      });
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
