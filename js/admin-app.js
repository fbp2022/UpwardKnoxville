/**
 * Shared admin shell: RBAC helpers, audit log, layout chrome.
 * Depends on js/supabase-client.js (window.UpwardSupabase).
 */
(function (w) {
  'use strict';

  var profile = null;
  var roleKeys = [];
  var permissionKeys = new Set();
  var accessLoaded = false;

  function assetPrefix() {
    var p = w.location && w.location.pathname ? w.location.pathname : '';
    return p.indexOf('/admin/') !== -1 || /\/admin$/i.test(p) ? '../' : '';
  }

  /** Canonical admin URL (login + dashboard): repo-root admin.html. */
  function getAdminLoginUrl() {
    if (!w.location) return '/admin.html';
    var path = w.location.pathname || '';
    if (path.indexOf('/admin/') !== -1) {
      return w.location.origin + path.replace(/\/admin\/.*$/, '/admin.html');
    }
    return w.location.origin + path.replace(/[^/]+$/, '') + 'admin.html';
  }

  function getAdminAuthRedirectUrl() {
    if (!w.location) return '';
    return String(w.location.origin + w.location.pathname.split('?')[0].split('#')[0]);
  }

  function isAdminLoginDocument() {
    var path = (w.location && w.location.pathname ? w.location.pathname : '').replace(/\/+$/, '');
    if (/\/admin\.html$/i.test(path)) return true;
    if (/\/admin\/index\.html$/i.test(path)) return true;
    if (path.endsWith('/admin')) return true;
    return false;
  }

  function redirectToLogin() {
    var p = w.location && w.location.pathname ? w.location.pathname : '';
    if (p.indexOf('/admin/') !== -1 || /\/admin$/i.test(p)) {
      w.location.href = '../admin.html';
    } else {
      w.location.href = 'admin.html';
    }
  }

  function getClient() {
    return w.UpwardSupabase && w.UpwardSupabase.getSupabase ? w.UpwardSupabase.getSupabase() : null;
  }

  function escapeHtml(str) {
    if (str == null || str === '') return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  async function ensureProfileRow(client, userId) {
    var sel = await client.from('admin_profiles').select('user_id').eq('user_id', userId).maybeSingle();
    if (sel.error) throw sel.error;
    if (!sel.data) {
      var ins = await client.from('admin_profiles').insert([{ user_id: userId }]).select().single();
      if (ins.error) throw ins.error;
      return ins.data;
    }
    return sel.data;
  }

  async function loadAdminAccess() {
    var client = getClient();
    if (!client) {
      profile = null;
      roleKeys = [];
      permissionKeys = new Set();
      accessLoaded = true;
      return;
    }
    var u = await client.auth.getUser();
    if (u.error) throw u.error;
    var user = u.data && u.data.user ? u.data.user : null;
    if (!user) {
      profile = null;
      roleKeys = [];
      permissionKeys = new Set();
      accessLoaded = true;
      return;
    }
    try {
      await ensureProfileRow(client, user.id);
    } catch (e) {
      console.warn('[UpwardAdmin] admin_profiles bootstrap skipped:', e && e.message);
    }
    try {
      var prof = await client.from('admin_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (prof.error) throw prof.error;
      profile = prof.data || { user_id: user.id, display_name: null };

      var pr = await client
        .from('admin_profile_roles')
        .select('role_id, admin_roles(key)')
        .eq('user_id', user.id);
      if (pr.error) throw pr.error;
      roleKeys = [];
      var roleIds = [];
      (pr.data || []).forEach(function (row) {
        var k = row && row.admin_roles && row.admin_roles.key ? String(row.admin_roles.key) : '';
        if (k) roleKeys.push(k);
        if (row && row.role_id) roleIds.push(row.role_id);
      });

      permissionKeys = new Set();
      if (roleIds.length) {
        var rp = await client
          .from('admin_role_permissions')
          .select('permission_id, admin_permissions(key)')
          .in('role_id', roleIds);
        if (rp.error) throw rp.error;
        (rp.data || []).forEach(function (row) {
          var pk = row && row.admin_permissions && row.admin_permissions.key ? String(row.admin_permissions.key) : '';
          if (pk) permissionKeys.add(pk);
        });
      }
    } catch (e) {
      console.warn('[UpwardAdmin] role load failed:', e && e.message);
      profile = { user_id: user.id, display_name: null };
      roleKeys = [];
      permissionKeys = new Set();
    }
    accessLoaded = true;
  }

  function invalidateAccess() {
    accessLoaded = false;
    profile = null;
    roleKeys = [];
    permissionKeys = new Set();
  }

  function getCurrentAdminProfile() {
    return profile;
  }

  function getCurrentUserRoles() {
    return roleKeys.slice();
  }

  function userHasRole(key) {
    return roleKeys.indexOf(String(key || '')) !== -1;
  }

  function userHasPermission(key) {
    return permissionKeys.has(String(key || ''));
  }

  /**
   * @returns {Promise<{ client: import('@supabase/supabase-js').SupabaseClient | null, user: object | null }>}
   */
  async function requireAdmin() {
    var client = getClient();
    if (!client) {
      redirectToLogin();
      return { client: null, user: null };
    }
    var sess = await client.auth.getSession();
    if (sess.error || !sess.data || !sess.data.session) {
      if (!isAdminLoginDocument()) redirectToLogin();
      return { client: client, user: null };
    }
    await loadAdminAccess();
    var u = await client.auth.getUser();
    var user = u.data && u.data.user ? u.data.user : null;
    return { client: client, user: user };
  }

  function requirePermission(permissionKey) {
    if (!permissionKey) return { ok: true };
    if (!accessLoaded) return { ok: false, message: 'Permissions not loaded yet.' };
    if (userHasPermission(permissionKey)) return { ok: true };
    return { ok: false, message: 'You do not have access to this area.' };
  }

  async function writeAuditLog(entityType, entityId, action, payload) {
    var client = getClient();
    if (!client) return;
    var u = await client.auth.getUser();
    var uid = u.data && u.data.user ? u.data.user.id : null;
    var row = {
      actor_user_id: uid,
      entity_type: String(entityType || 'unknown'),
      entity_id: entityId != null ? String(entityId) : null,
      action: String(action || 'unknown'),
      payload: payload != null ? payload : null,
    };
    var ins = await client.from('admin_audit_log').insert([row]);
    if (ins.error) console.warn('[UpwardAdmin] audit log failed:', ins.error.message);
    /* send_email_update: no outbound email integration; audit + DB flags only */
  }

  function navClass(active, hrefKey) {
    var base =
      'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition border border-transparent';
    if (active === hrefKey) {
      return base + ' border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text)]';
    }
    return base + ' text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]';
  }

  function navLink(href, label, active, key) {
    return (
      '<a href="' +
      escapeHtml(href) +
      '" class="' +
      navClass(active, key) +
      '"' +
      (active === key ? ' aria-current="page"' : '') +
      '>' +
      escapeHtml(label) +
      '</a>'
    );
  }

  /**
   * @param {string} activeKey dashboard|team|tasks|notices|calendar|finance|ministry|settings|portal
   * @param {string} mainInnerHtml HTML for <main>
   */
  function getShellHtml(activeKey, mainInnerHtml) {
    var P = assetPrefix();
    var can = userHasPermission;
    var parts = [];
    parts.push('<div class="admin-dash-shell w-full min-h-screen bg-[var(--bg)]">');
    parts.push('<div class="admin-dash-inner mx-auto w-full max-w-[1400px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">');
    parts.push('<header class="admin-dash-header mb-6 flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">');
    parts.push('<div class="min-w-0 flex-1">');
    parts.push('<h1 class="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">Admin</h1>');
    parts.push(
      '<p class="content-text mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]" id="adminShellSubtitle">Upward Knoxville</p>'
    );
    parts.push('</div>');
    parts.push('<div class="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">');
    parts.push(
      '<a href="' +
        P +
        'index.html" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]">Back to site</a>'
    );
    parts.push(
      '<button type="button" id="adminLogoutBtn" class="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Log out</button>'
    );
    parts.push('</div></header>');
    parts.push('<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">');
    parts.push(
      '<aside class="w-full shrink-0 lg:w-56" aria-label="Admin navigation"><nav class="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-sm">'
    );
    parts.push(navLink('dashboard.html', 'Dashboard', activeKey, 'dashboard'));
    if (can('team.manage')) parts.push(navLink('team.html', 'Team', activeKey, 'team'));
    if (can('tasks.manage')) parts.push(navLink('tasks.html', 'Tasks', activeKey, 'tasks'));
    if (can('notices.manage')) parts.push(navLink('notices.html', 'Notices', activeKey, 'notices'));
    if (can('calendar.manage')) parts.push(navLink('calendar.html', 'Calendar', activeKey, 'calendar'));
    if (can('finance.view')) parts.push(navLink('finance.html', 'Finance', activeKey, 'finance'));
    parts.push(navLink('ministry.html', 'Ministry tools', activeKey, 'ministry'));
    parts.push(navLink('portal.html', 'Full portal', activeKey, 'portal'));
    parts.push(navLink('settings.html', 'Settings', activeKey, 'settings'));
    parts.push('</nav></aside>');
    parts.push('<main class="min-w-0 flex-1 space-y-6" id="adminMain">' + (mainInnerHtml || '') + '</main>');
    parts.push('</div></div></div>');
    return parts.join('');
  }

  function bindShellLogoutOnce() {
    var btn = document.getElementById('adminLogoutBtn');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      var c = getClient();
      if (c) {
        invalidateAccess();
        c.auth.signOut().then(function () {
          w.location.href = assetPrefix() + 'admin.html';
        });
      }
    });
  }

  function setShellSubtitle(text) {
    var el = document.getElementById('adminShellSubtitle');
    if (el) el.textContent = text != null ? String(text) : '';
  }

  w.UpwardAdmin = {
    assetPrefix: assetPrefix,
    getAdminLoginUrl: getAdminLoginUrl,
    getAdminAuthRedirectUrl: getAdminAuthRedirectUrl,
    isAdminLoginDocument: isAdminLoginDocument,
    redirectToLogin: redirectToLogin,
    loadAdminAccess: loadAdminAccess,
    invalidateAccess: invalidateAccess,
    getCurrentAdminProfile: getCurrentAdminProfile,
    getCurrentUserRoles: getCurrentUserRoles,
    userHasRole: userHasRole,
    userHasPermission: userHasPermission,
    requireAdmin: requireAdmin,
    requirePermission: requirePermission,
    writeAuditLog: writeAuditLog,
    getShellHtml: getShellHtml,
    bindShellLogoutOnce: bindShellLogoutOnce,
    setShellSubtitle: setShellSubtitle,
    escapeHtml: escapeHtml,
  };
})(typeof window !== 'undefined' ? window : globalThis);
