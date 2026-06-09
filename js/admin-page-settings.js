(function () {
  'use strict';
  var card =
    'rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-7 sm:shadow-[var(--shadow-md)]';

  function esc(s) {
    return window.UpwardAdmin && window.UpwardAdmin.escapeHtml ? window.UpwardAdmin.escapeHtml(s) : String(s || '');
  }

  async function init() {
    var app = document.getElementById('admin-app');
    if (!app || !window.UpwardAdmin) return;
    var r = await window.UpwardAdmin.requireAdmin();
    if (!r.user) return;
    var client = r.client;
    var roles = await client.from('admin_roles').select('key,label,sort_order').order('sort_order', { ascending: true });
    var perms = await client.from('admin_permissions').select('key,label').order('key', { ascending: true });
    var roleRows = roles.error ? [] : roles.data || [];
    var permRows = perms.error ? [] : perms.data || [];
    var rk = window.UpwardAdmin.getCurrentUserRoles();

    var inner =
      '<div class="' +
      card +
      '"><h2 class="text-lg font-semibold">Your roles</h2><p class="content-text mt-2 text-sm">' +
      (rk.length ? esc(rk.join(', ')) : 'No roles assigned yet. Ask an owner to grant roles in Supabase (admin_profile_roles) until self-service assignment ships.') +
      '</p></div>' +
      '<div class="' +
      card +
      '"><h2 class="text-lg font-semibold">Role catalog (read-only)</h2><ul class="mt-3 list-disc space-y-1 pl-5 text-sm content-text">';
    roleRows.forEach(function (row) {
      inner += '<li><strong>' + esc(row.label) + '</strong> (<code class="text-xs">' + esc(row.key) + '</code>)</li>';
    });
    inner +=
      '</ul></div><div class="' +
      card +
      '"><h2 class="text-lg font-semibold">Permissions (read-only)</h2><ul class="mt-3 list-disc space-y-1 pl-5 text-sm content-text">';
    permRows.forEach(function (row) {
      inner += '<li>' + esc(row.label) + ' — <code class="text-xs">' + esc(row.key) + '</code></li>';
    });
    inner +=
      '</ul></div>' +
      '<div class="' +
      card +
      '"><h2 class="text-lg font-semibold">Assign roles</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed">Changing <code class="text-xs">admin_profile_roles</code> is limited to users with <code class="text-xs">settings.manage</code> in RLS. Use the Supabase SQL editor or Dashboard for bootstrap until a safe in-app UI is added.</p>' +
      '<p class="content-text mt-4 text-sm">Teaching, announcements, BCC, contacts, and governance live in <a class="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]" href="portal.html">Full portal</a> and <a class="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]" href="ministry.html">Ministry tools</a>.</p></div>';

    app.innerHTML = window.UpwardAdmin.getShellHtml('settings', inner);
    window.UpwardAdmin.bindShellLogoutOnce();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () {
    init().catch(console.error);
  });
  else init().catch(console.error);
})();
