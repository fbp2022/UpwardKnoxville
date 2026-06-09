(function () {
  'use strict';

  var card =
    'rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-7 sm:shadow-[var(--shadow-md)]';

  function esc(s) {
    return window.UpwardAdmin && window.UpwardAdmin.escapeHtml ? window.UpwardAdmin.escapeHtml(s) : String(s || '');
  }

  async function safeCount(client, table, build) {
    try {
      var q = client.from(table).select('*', { count: 'exact', head: true });
      if (build) q = build(q);
      var res = await q;
      if (res.error) throw res.error;
      return res.count != null ? res.count : 0;
    } catch (e) {
      return null;
    }
  }

  async function init() {
    var app = document.getElementById('admin-app');
    if (!app || !window.UpwardAdmin) return;
    var r = await window.UpwardAdmin.requireAdmin();
    if (!r.user) return;
    var client = r.client;

    var now = new Date();
    var in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    var openTasks = await safeCount(client, 'admin_tasks', function (q) {
      return q.neq('status', 'done');
    });
    var upcoming = await safeCount(client, 'events', function (q) {
      return q.gte('starts_at', now.toISOString()).lte('starts_at', in30);
    });
    var publicTeam = await safeCount(client, 'team_members', function (q) {
      return q
        .eq('is_active', true)
        .eq('show_publicly', true)
        .in('visibility_level', ['leader', 'primary_leader']);
    });
    var draftNotices = await safeCount(client, 'admin_notices', function (q) {
      return q.eq('show_publicly', false);
    });

    var inner =
      '<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">' +
      '<div class="' +
      card +
      '"><h2 class="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Open tasks</h2><p class="mt-3 text-2xl font-semibold text-[var(--text)]">' +
      esc(openTasks != null ? openTasks : '—') +
      '</p><p class="content-text mt-2 text-xs text-[var(--muted)]">Excludes completed.</p></div>' +
      '<div class="' +
      card +
      '"><h2 class="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Events (30d)</h2><p class="mt-3 text-2xl font-semibold text-[var(--text)]">' +
      esc(upcoming != null ? upcoming : '—') +
      '</p><p class="content-text mt-2 text-xs text-[var(--muted)]">All events starting in the next 30 days.</p></div>' +
      '<div class="' +
      card +
      '"><h2 class="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Public team</h2><p class="mt-3 text-2xl font-semibold text-[var(--text)]">' +
      esc(publicTeam != null ? publicTeam : '—') +
      '</p><p class="content-text mt-2 text-xs text-[var(--muted)]">Active, public-facing leaders.</p></div>' +
      '<div class="' +
      card +
      '"><h2 class="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Draft notices</h2><p class="mt-3 text-2xl font-semibold text-[var(--text)]">' +
      esc(draftNotices != null ? draftNotices : '—') +
      '</p><p class="content-text mt-2 text-xs text-[var(--muted)]">Notices with show_publicly off.</p></div>' +
      '</div>' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)]">Quick links</h2>' +
      '<div class="mt-4 flex flex-wrap gap-2">' +
      '<a class="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]" href="ministry.html">Ministry tools</a>' +
      '<a class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]" href="portal.html">Full portal</a>' +
      '<a class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]" href="team.html">Team</a>' +
      '<a class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]" href="tasks.html">Tasks</a>' +
      '<a class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]" href="calendar.html">Calendar</a>' +
      '</div></div>' +
      '<div class="' +
      card +
      '"><h2 class="text-lg font-semibold text-[var(--text)]">Recent audit</h2>' +
      '<p class="content-text mt-2 text-sm text-[var(--muted)]">Visible to users with settings.manage. Open <a class="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]" href="settings.html">Settings</a> for role tooling.</p>' +
      '<ul id="adminDashAudit" class="mt-4 list-none space-y-2 p-0 text-sm content-text"></ul></div>';

    app.innerHTML = window.UpwardAdmin.getShellHtml('dashboard', inner);
    window.UpwardAdmin.bindShellLogoutOnce();
    var prof = window.UpwardAdmin.getCurrentAdminProfile();
    var dn = prof && prof.display_name ? String(prof.display_name) : r.user.email || 'Signed in';
    window.UpwardAdmin.setShellSubtitle(dn);

    if (window.UpwardAdmin.userHasPermission('settings.manage')) {
      var aud = await client
        .from('admin_audit_log')
        .select('id,action,entity_type,created_at')
        .order('created_at', { ascending: false })
        .limit(8);
      var ul = document.getElementById('adminDashAudit');
      if (ul && !aud.error && aud.data) {
        ul.innerHTML = '';
        aud.data.forEach(function (row) {
          var li = document.createElement('li');
          li.className = 'rounded border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2';
          li.textContent =
            (row.created_at ? new Date(row.created_at).toLocaleString() : '') +
            ' · ' +
            (row.action || '') +
            ' · ' +
            (row.entity_type || '');
          ul.appendChild(li);
        });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init().catch(function (e) {
        console.error(e);
      });
    });
  } else {
    init().catch(function (e) {
      console.error(e);
    });
  }
})();
