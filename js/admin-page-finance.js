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
    var g = window.UpwardAdmin.requirePermission('finance.view');
    if (!g.ok) {
      app.innerHTML = window.UpwardAdmin.getShellHtml(
        'finance',
        '<div class="' +
          card +
          '"><p class="content-text text-sm">' +
          esc(g.message || 'Access denied.') +
          '</p></div>'
      );
      window.UpwardAdmin.bindShellLogoutOnce();
      return;
    }
    app.innerHTML = window.UpwardAdmin.getShellHtml(
      'finance',
      '<div class="' +
        card +
        '"><h2 class="text-lg font-semibold text-[var(--text)]">Finance</h2>' +
        '<p class="content-text mt-3 text-sm leading-relaxed">Internal finance workflows will be added here. This page confirms your account has <code class="rounded bg-[var(--surface-hover)] px-1 font-mono text-xs">finance.view</code>.</p></div>'
    );
    window.UpwardAdmin.bindShellLogoutOnce();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () {
    init().catch(console.error);
  });
  else init().catch(console.error);
})();
