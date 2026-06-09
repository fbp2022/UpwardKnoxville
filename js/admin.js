/**
 * Admin controller, vanilla JS. Expects Supabase UMD + window.UpwardSupabase (from supabase-client.js).
 * Dashboard markup is injected only after authentication (see js/admin-dashboard-html.js).
 */
(function () {
  'use strict';

  if (typeof window !== 'undefined') {
    window.__UPWARD_ADMIN_SCRIPT_RAN = true;
  }

  console.log('Admin controller loaded');

  var client = null;
  var currentRowId = null;
  var authSubscribed = false;
  var adminAnnouncementsCache = [];
  var governanceDocumentsCache = [];
  var governanceTableMissing = false;
  var financeLedgerCache = [];
  var financeViewMode = 'summary';
  var dashboardMounted = false;
  /** Coalesce overlapping auth → dashboard mounts (init + onAuthStateChange). */
  var routeAfterAuthPromise = null;

  var ADMIN_SECTION_IDS = [
    'overview',
    'communications',
    'governance',
    'leadership',
    'meetings',
    'voting',
    'financial',
    'documents',
    'member_care',
    'settings',
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function getApp() {
    return document.getElementById('admin-app');
  }

  function api() {
    return typeof window !== 'undefined' && window.UpwardSupabase ? window.UpwardSupabase : {};
  }

  function assetPrefix() {
    var p = typeof window !== 'undefined' && window.location && window.location.pathname ? window.location.pathname : '';
    return p.indexOf('/admin/') !== -1 ? '../' : '';
  }

  /** Absolute admin URL for Supabase redirect (add this URL in Dashboard → Auth → Redirect URLs). */
  function getAdminAuthRedirectUrl() {
    if (window.UpwardAdmin && typeof window.UpwardAdmin.getAdminAuthRedirectUrl === 'function') {
      var u = window.UpwardAdmin.getAdminAuthRedirectUrl();
      if (u) return u;
    }
    if (typeof window === 'undefined' || !window.location) return '';
    var path = window.location.pathname || '/admin.html';
    var base = window.location.origin + path.split('?')[0].split('#')[0];
    return base;
  }

  function clearWatchdogTimer() {
    if (typeof window !== 'undefined' && window.__UPWARD_ADMIN_LOADING_WATCHDOG) {
      clearTimeout(window.__UPWARD_ADMIN_LOADING_WATCHDOG);
      window.__UPWARD_ADMIN_LOADING_WATCHDOG = null;
    }
  }

  function applyBodyLoginOnly() {
    document.body.removeAttribute('data-admin-dashboard');
    document.documentElement.classList.add('admin-auth-locked');
    document.body.classList.add('admin-auth-locked');
  }

  function applyBodyDashboard() {
    document.documentElement.classList.remove('admin-auth-locked');
    document.body.classList.remove('admin-auth-locked');
    document.body.setAttribute('data-admin-dashboard', 'true');
  }

  function destroyDashboardState() {
    currentRowId = null;
    adminAnnouncementsCache = [];
    governanceDocumentsCache = [];
    governanceTableMissing = false;
    financeLedgerCache = [];
    financeViewMode = 'summary';
    leadershipCache = [];
    meetingsCache = [];
    votesCache = [];
    financialCache = [];
    documentsCache = [];
    memberCareCache = [];
    dashboardMounted = false;
    var shell = getApp();
    if (shell && shell.dataset) delete shell.dataset.adminShellBound;
  }

  function getLoginHtml(prefix) {
    var P = prefix || '';
    return (
      '<div class="flex min-h-screen flex-col items-center justify-center px-5 py-8">' +
      '<div class="soft-card w-full max-w-[420px] p-8 md:p-10">' +
      '<p id="adminPageBanner" class="content-text mb-4 rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-center text-sm leading-relaxed" role="alert" hidden></p>' +
      '<div class="flex flex-col items-center text-center">' +
      '<img src="' +
      P +
      'images/16A3F74D-DB7D-4341-AFA6-CCE3795C512A.png" alt="" width="48" height="48" class="brand-logo h-12 w-12" />' +
      '<h1 class="mt-5 text-xl font-semibold text-[var(--text)]">Teaching steward</h1>' +
      '<p class="content-text mt-3 text-sm leading-relaxed">Sign in to update where we are in Scripture.</p>' +
      '</div>' +
      '<form id="adminLoginForm" class="mt-8 space-y-4 text-left">' +
      '<label class="block">' +
      '<span class="mb-2 block text-sm font-medium text-[var(--text)]">Email</span>' +
      '<input id="adminLoginEmail" type="email" name="email" autocomplete="username" required class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" />' +
      '</label>' +
      '<label class="block">' +
      '<span class="mb-2 block text-sm font-medium text-[var(--text)]">Password</span>' +
      '<input id="adminLoginPassword" type="password" name="password" autocomplete="current-password" required class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" />' +
      '</label>' +
      '<p id="adminLoginError" class="min-h-[1.25rem] text-sm content-text" role="alert" aria-live="polite"></p>' +
      '<button type="submit" id="adminLoginSubmit" class="w-full rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">Sign in</button>' +
      '</form>' +
      '<div class="mt-6 border-t border-[var(--border)] pt-6">' +
      '<p class="text-sm font-medium text-[var(--text)]">Forgot password?</p>' +
      '<p class="content-text mt-1 text-xs leading-relaxed">We will email a link to reset your password. Use the email address above.</p>' +
      '<button type="button" id="adminForgotPasswordBtn" class="mt-3 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-70">Send reset link</button>' +
      '<p id="adminForgotStatus" class="mt-2 min-h-[1.25rem] text-xs content-text text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '</div>' +
      '<p class="content-text mt-8 text-center text-xs leading-relaxed">' +
      '<a href="' +
      P +
      'index.html" class="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">← Back to site</a>' +
      '</p></div></div>'
    );
  }

  function getPasswordRecoveryHtml(prefix) {
    var P = prefix || '';
    return (
      '<div class="flex min-h-screen flex-col items-center justify-center px-5 py-8">' +
      '<div class="soft-card w-full max-w-[420px] p-8 md:p-10">' +
      '<p id="adminPageBanner" class="content-text mb-4 rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-center text-sm leading-relaxed" role="alert" hidden></p>' +
      '<div class="flex flex-col items-center text-center">' +
      '<img src="' +
      P +
      'images/16A3F74D-DB7D-4341-AFA6-CCE3795C512A.png" alt="" width="48" height="48" class="brand-logo h-12 w-12" />' +
      '<h1 class="mt-5 text-xl font-semibold text-[var(--text)]">Set a new password</h1>' +
      '<p class="content-text mt-3 text-sm leading-relaxed">Choose a new password for your account.</p>' +
      '</div>' +
      '<form id="adminRecoveryForm" class="mt-8 space-y-4 text-left">' +
      '<label class="block">' +
      '<span class="mb-2 block text-sm font-medium text-[var(--text)]">New password</span>' +
      '<input id="adminRecoveryPassword" type="password" name="password" autocomplete="new-password" required minlength="8" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" />' +
      '</label>' +
      '<label class="block">' +
      '<span class="mb-2 block text-sm font-medium text-[var(--text)]">Confirm new password</span>' +
      '<input id="adminRecoveryPassword2" type="password" name="password2" autocomplete="new-password" required minlength="8" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" />' +
      '</label>' +
      '<p id="adminRecoveryError" class="min-h-[1.25rem] text-sm content-text" role="alert" aria-live="polite"></p>' +
      '<button type="submit" id="adminRecoverySubmit" class="w-full rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">Update password</button>' +
      '</form>' +
      '<p class="content-text mt-6 text-center text-xs leading-relaxed">' +
      '<button type="button" id="adminRecoveryCancel" class="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">Cancel and return to sign in</button>' +
      '</p></div></div>'
    );
  }

  function renderPasswordRecovery() {
    console.log('[admin] password recovery form');
    clearWatchdogTimer();
    destroyDashboardState();
    applyBodyLoginOnly();
    var app = getApp();
    if (!app) return;
    app.className = 'min-h-screen';
    app.innerHTML = getPasswordRecoveryHtml(assetPrefix());
    bindPasswordRecovery();
  }

  function renderLoading() {
    console.log('[admin] loading');
    clearWatchdogTimer();
    destroyDashboardState();
    applyBodyLoginOnly();
    var app = getApp();
    if (!app) return;
    app.className = 'min-h-screen';
    app.innerHTML =
      '<div class="flex min-h-screen flex-col items-center justify-center px-5" role="status" aria-live="polite">' +
      '<p class="content-text text-sm text-[var(--muted)]">Loading…</p></div>';
  }

  /**
   * @param {{ signOut?: boolean }} opts
   */
  function renderLogin(opts) {
    opts = opts || {};
    if (opts.signOut) {
      console.log('[admin] sign out, clearing dashboard');
    } else if (!opts.silent) {
      console.log('[admin] no session, rendering login only');
    }
    clearWatchdogTimer();
    destroyDashboardState();
    applyBodyLoginOnly();
    var app = getApp();
    if (!app) return;
    app.className = 'min-h-screen';
    app.innerHTML = getLoginHtml(assetPrefix());
    bindLogin();
  }

  function getAdminMode() {
    return (document.body && document.body.getAttribute('data-admin-mode')) || 'portal';
  }

  function renderDashboard() {
    console.log('[admin] session found, rendering dashboard');
    clearWatchdogTimer();
    applyBodyDashboard();
    destroyDashboardState();
    var app = getApp();
    if (!app) return;
    app.className = 'min-h-screen';
    var fn =
      typeof window !== 'undefined' && typeof window.__UPWARD_GET_ADMIN_DASHBOARD_HTML__ === 'function'
        ? window.__UPWARD_GET_ADMIN_DASHBOARD_HTML__
        : null;
    if (!fn) {
      app.innerHTML =
        '<div class="p-8 text-center content-text text-sm">Missing dashboard template (admin-dashboard-html.js).</div>';
      dashboardMounted = false;
      return;
    }
    app.innerHTML = fn(assetPrefix());
    dashboardMounted = true;
    bindDashboardOnce();
  }

  function renderMinistryShell() {
    console.log('[admin] session found, rendering ministry tools in shell');
    clearWatchdogTimer();
    applyBodyDashboard();
    destroyDashboardState();
    var app = getApp();
    if (!app) return;
    app.className = 'min-h-screen';
    var innerFn =
      typeof window !== 'undefined' && typeof window.__UPWARD_GET_ADMIN_MINISTRY_TOOLS_HTML__ === 'function'
        ? window.__UPWARD_GET_ADMIN_MINISTRY_TOOLS_HTML__
        : null;
    var inner = typeof innerFn === 'function' ? innerFn() : '';
    if (window.UpwardAdmin && typeof window.UpwardAdmin.getShellHtml === 'function') {
      app.innerHTML = window.UpwardAdmin.getShellHtml('ministry', inner);
      if (typeof window.UpwardAdmin.bindShellLogoutOnce === 'function') window.UpwardAdmin.bindShellLogoutOnce();
    } else {
      app.innerHTML =
        '<div class="p-8 text-center content-text text-sm">Missing admin shell (admin-app.js).</div>' + inner;
    }
    dashboardMounted = true;
    bindDashboardOnce();
  }

  async function enterMinistry() {
    renderMinistryShell();
    if (!dashboardMounted) return;
    await initDashboardAfterAuth();
  }

  async function routeAfterAuth() {
    if (routeAfterAuthPromise) return routeAfterAuthPromise;
    routeAfterAuthPromise = (async function () {
      try {
        if (getAdminMode() === 'ministry') {
          await enterMinistry();
        } else {
          await enterDashboard();
        }
      } finally {
        routeAfterAuthPromise = null;
      }
    })();
    return routeAfterAuthPromise;
  }

  async function initDashboardAfterAuth() {
    if (window.UpwardAdmin && typeof window.UpwardAdmin.loadAdminAccess === 'function') {
      try {
        await window.UpwardAdmin.loadAdminAccess();
      } catch (eLA) {
        console.warn('[admin] loadAdminAccess failed', eLA && eLA.message ? eLA.message : eLA);
      }
    }
    var tasks = await Promise.allSettled([
      loadTeachingEditor(),
      loadAnnouncementsAdmin(),
      loadBccList(),
      loadContactMessages(),
      loadGovernanceDocuments(),
      loadLeadershipPanel(),
      loadMeetingsPanel(),
      loadVotesPanel(),
      loadFinancialPanel(),
      loadDocumentsPanel(),
      loadMemberCarePanel(),
      loadSettingsPanel(),
    ]);
    for (var ti = 0; ti < tasks.length; ti++) {
      if (tasks[ti].status === 'rejected') {
        console.warn('[admin] dashboard load task failed', tasks[ti].reason);
      }
    }
    try {
      await refreshAdminOverview();
    } catch (eRO) {
      /* ignore */
    }
  }

  function parseHashAdminSection() {
    var h = typeof window !== 'undefined' && window.location && window.location.hash ? String(window.location.hash) : '';
    if (!h || h === '#' || h === '#admin') return 'overview';
    var m = /^#admin-([\w]+)/.exec(h);
    if (m && ADMIN_SECTION_IDS.indexOf(m[1]) !== -1) return m[1];
    return 'overview';
  }

  function closeAdminMobileNav() {
    var aside = $('adminSideNav');
    var toggle = $('adminNavToggle');
    if (aside) aside.classList.remove('admin-side-nav--open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  /**
   * @param {string} id
   * @param {{ updateHash?: boolean, scrollToId?: string }} opts
   */
  function showAdminSection(id, opts) {
    opts = opts || {};
    if (ADMIN_SECTION_IDS.indexOf(id) === -1) id = 'overview';
    var panels = document.querySelectorAll('[data-admin-panel]');
    for (var i = 0; i < panels.length; i++) {
      var p = panels[i];
      var pid = p.getAttribute('data-admin-panel');
      var on = pid === id;
      if (on) {
        p.classList.remove('hidden');
        p.removeAttribute('hidden');
      } else {
        p.classList.add('hidden');
        p.setAttribute('hidden', '');
      }
    }
    var navBtns = document.querySelectorAll('[data-admin-nav]');
    for (var j = 0; j < navBtns.length; j++) {
      var b = navBtns[j];
      var bid = b.getAttribute('data-admin-nav');
      if (bid === id) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
    if (opts.updateHash !== false && typeof history !== 'undefined' && history.replaceState) {
      try {
        var next = '#admin-' + id;
        if (String(window.location.hash || '') !== next) {
          history.replaceState(null, '', next);
        }
      } catch (eHash) {
        /* ignore */
      }
    }
    if (opts.scrollToId) {
      var sid = String(opts.scrollToId || '').trim();
      if (sid) {
        window.requestAnimationFrame(function () {
          window.setTimeout(function () {
            var el = document.getElementById(sid);
            if (el && typeof el.scrollIntoView === 'function') {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 60);
        });
      }
    }
  }

  function bindAdminShellOnce() {
    var app = getApp();
    if (!app || app.dataset.adminShellBound === '1') return;
    app.dataset.adminShellBound = '1';
    app.addEventListener('click', function (ev) {
      var nav = ev.target && ev.target.closest ? ev.target.closest('[data-admin-nav]') : null;
      if (nav) {
        ev.preventDefault();
        var sid = nav.getAttribute('data-admin-nav');
        if (sid) showAdminSection(sid);
        closeAdminMobileNav();
        return;
      }
      var jump = ev.target && ev.target.closest ? ev.target.closest('[data-admin-jump]') : null;
      if (jump) {
        ev.preventDefault();
        var jid = jump.getAttribute('data-admin-jump');
        var scrollId = jump.getAttribute('data-admin-scrollto');
        if (jid) showAdminSection(jid, { scrollToId: scrollId || '' });
        closeAdminMobileNav();
        return;
      }
    });
    var toggle = $('adminNavToggle');
    if (toggle && toggle.dataset.bound !== '1') {
      toggle.dataset.bound = '1';
      toggle.addEventListener('click', function () {
        var aside = $('adminSideNav');
        if (!aside) return;
        aside.classList.toggle('admin-side-nav--open');
        var open = aside.classList.contains('admin-side-nav--open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    if (typeof window !== 'undefined' && !window.__UPWARD_ADMIN_HASH_BOUND) {
      window.__UPWARD_ADMIN_HASH_BOUND = true;
      window.addEventListener('hashchange', function () {
        if (!getApp() || !getApp().querySelector('[data-admin-panel]')) return;
        showAdminSection(parseHashAdminSection(), { updateHash: false });
      });
    }
    showAdminSection(parseHashAdminSection(), { updateHash: false });
  }

  async function refreshAdminOverview() {
    var teachEl = $('adminOverviewTeaching');
    if (teachEl) {
      var book = fieldVal('field-current-book').trim();
      var ch = fieldVal('field-current-chapter').trim();
      var vs = fieldVal('field-current-verses').trim();
      var bits = [];
      if (book) bits.push(book);
      if (ch) bits.push('ch. ' + ch);
      if (vs) bits.push(vs);
      teachEl.textContent = bits.length ? bits.join(' · ') : 'Teaching fields not loaded yet.';
    }
    var annEl = $('adminOverviewAnnouncements');
    if (annEl) {
      var n = adminAnnouncementsCache.length;
      var latestTitle = '';
      var best = 0;
      for (var i = 0; i < adminAnnouncementsCache.length; i++) {
        var r = adminAnnouncementsCache[i];
        var ca = r && r.created_at ? new Date(r.created_at).getTime() : 0;
        if (ca >= best) {
          best = ca;
          latestTitle = r && r.title != null ? String(r.title) : '';
        }
      }
      annEl.textContent =
        n === 0
          ? 'No announcements yet.'
          : n + ' total — latest: ' + (latestTitle || '(untitled)') + '.';
    }
    var contactEl = $('adminOverviewContacts');
    if (contactEl) {
      if (!client) {
        contactEl.textContent = 'Not connected.';
      } else {
        try {
          var c = await client
            .from('contact_messages')
            .select('id', { count: 'exact', head: true });
          if (c.error) throw c.error;
          var total = typeof c.count === 'number' ? c.count : 0;
          contactEl.textContent = total === 1 ? '1 message on file.' : total + ' messages on file.';
        } catch (eC) {
          contactEl.textContent = eC && eC.message ? String(eC.message) : 'Could not count messages.';
        }
      }
    }
    var govEl = $('adminOverviewGovernance');
    if (govEl) {
      if (!client) {
        govEl.textContent = 'Not connected.';
      } else {
        try {
          var g = await client
            .from('governance_documents')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'draft');
          if (g.error) throw g.error;
          var d = typeof g.count === 'number' ? g.count : 0;
          govEl.textContent = d === 1 ? '1 draft document.' : d + ' draft documents.';
        } catch (eG) {
          govEl.textContent = 'Governance table not available yet (run sql/admin_portal_schema.sql).';
        }
      }
    }
    function setCountOrHint(el, table, noun) {
      if (!el) return;
      if (!client) {
        el.textContent = 'Not connected.';
        return;
      }
      return client
        .from(table)
        .select('id', { count: 'exact', head: true })
        .then(function (r) {
          if (r.error) throw r.error;
          var c = typeof r.count === 'number' ? r.count : 0;
          el.textContent = c === 0 ? 'Add the first ' + noun + '…' : c === 1 ? '1 on file.' : c + ' on file.';
        })
        .catch(function () {
          el.textContent = 'Table missing — run sql/admin_portal_schema.sql.';
        });
    }
    var bccOv = $('adminOverviewBcc');
    if (bccOv) {
      if (!client) {
        bccOv.textContent = 'Not connected.';
      } else {
        try {
          var bx = await client.from('admin_update_bcc_emails').select('id', { count: 'exact', head: true });
          if (bx.error) throw bx.error;
          var bn = typeof bx.count === 'number' ? bx.count : 0;
          bccOv.textContent =
            bn === 0 ? 'No BCC addresses yet.' : bn === 1 ? '1 BCC recipient.' : bn + ' BCC recipients.';
        } catch (eBcc) {
          bccOv.textContent = eBcc && eBcc.message ? String(eBcc.message) : 'Could not load BCC count.';
        }
      }
    }
    async function financeOverviewHint(el) {
      if (!el || !client) {
        if (el && !client) el.textContent = 'Not connected.';
        return;
      }
      try {
        var a = await client.from('admin_financial_records').select('id', { count: 'exact', head: true });
        if (a.error) throw a.error;
        var b = await client.from('admin_financial_requests').select('id', { count: 'exact', head: true });
        if (b.error) throw b.error;
        var na = typeof a.count === 'number' ? a.count : 0;
        var nb = typeof b.count === 'number' ? b.count : 0;
        el.textContent =
          na === 0 && nb === 0
            ? 'Add ledger rows or requests to populate finance.'
            : na + ' ledger row' + (na === 1 ? '' : 's') + ' · ' + nb + ' request' + (nb === 1 ? '' : 's') + '.';
      } catch (eF) {
        el.textContent = 'Finance tables unavailable until sql/admin_portal_schema.sql is applied.';
      }
    }
    await Promise.all([
      setCountOrHint($('adminOverviewVotes'), 'admin_votes', 'motion'),
      setCountOrHint($('adminOverviewMeetings'), 'admin_meetings', 'meeting'),
      financeOverviewHint($('adminOverviewFinancial')),
      setCountOrHint($('adminOverviewDocuments'), 'admin_internal_documents', 'document'),
      setCountOrHint($('adminOverviewMemberCare'), 'admin_member_care', 'case'),
    ]);
  }

  function setGovernanceStatus(msg) {
    var el = $('adminGovernanceStatus');
    if (el) el.textContent = msg != null ? String(msg) : '';
  }

  function governanceSlugify(raw) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function applyGovernanceLockedUi(locked) {
    var saveBtn = $('adminGovernanceSaveDraftBtn');
    var pubBtn = $('adminGovernancePublishBtn');
    var slugEl = $('adminGovernanceSlug');
    var titleEl = $('adminGovernanceTitle');
    var catEl = $('adminGovernanceCategory');
    var statEl = $('adminGovernanceStatusSelect');
    var bodyEl = $('adminGovernanceBody');
    var notesEl = $('adminGovernanceInternalNotes');
    var lockBox = $('adminGovernanceLocked');
    var dis = !!locked;
    if (saveBtn) saveBtn.disabled = dis;
    if (pubBtn) pubBtn.disabled = dis;
    if (slugEl) slugEl.disabled = dis;
    if (titleEl) titleEl.disabled = dis;
    if (catEl) catEl.disabled = dis;
    if (statEl) statEl.disabled = dis;
    if (bodyEl) bodyEl.disabled = dis;
    if (notesEl) notesEl.disabled = dis;
    if (lockBox) lockBox.disabled = false;
  }

  function clearGovernanceForm() {
    var hid = $('adminGovernanceEditingId');
    var slug = $('adminGovernanceSlug');
    var title = $('adminGovernanceTitle');
    var cat = $('adminGovernanceCategory');
    var stat = $('adminGovernanceStatusSelect');
    var body = $('adminGovernanceBody');
    var notes = $('adminGovernanceInternalNotes');
    var lock = $('adminGovernanceLocked');
    if (hid) hid.value = '';
    if (slug) {
      slug.value = '';
      slug.removeAttribute('readonly');
    }
    if (title) title.value = '';
    if (cat) cat.value = '';
    if (stat) stat.value = 'draft';
    if (body) body.value = '';
    if (notes) notes.value = '';
    if (lock) lock.checked = false;
    applyGovernanceLockedUi(false);
    setGovernanceStatus('');
  }

  function fillGovernanceForm(row) {
    if (!row) return;
    var hid = $('adminGovernanceEditingId');
    var slug = $('adminGovernanceSlug');
    var title = $('adminGovernanceTitle');
    var cat = $('adminGovernanceCategory');
    var stat = $('adminGovernanceStatusSelect');
    var body = $('adminGovernanceBody');
    var notes = $('adminGovernanceInternalNotes');
    var lock = $('adminGovernanceLocked');
    if (hid) hid.value = row.id != null ? String(row.id) : '';
    if (slug) {
      slug.value = row.slug != null ? String(row.slug) : '';
      if (hid && hid.value) slug.setAttribute('readonly', 'readonly');
      else slug.removeAttribute('readonly');
    }
    if (title) title.value = row.title != null ? String(row.title) : '';
    if (cat) cat.value = row.category != null ? String(row.category) : '';
    if (stat) stat.value = row.status != null ? String(row.status) : 'draft';
    if (body) body.value = row.body != null ? String(row.body) : '';
    if (notes) notes.value = row.internal_notes != null ? String(row.internal_notes) : '';
    if (lock) lock.checked = row.is_locked === true;
    applyGovernanceLockedUi(row.is_locked === true);
  }

  function renderGovernanceList(rows) {
    var list = $('adminGovernanceList');
    if (!list) return;
    list.innerHTML = '';
    if (!rows || !rows.length) {
      var li0 = document.createElement('li');
      li0.className = 'content-text text-sm text-[var(--muted)]';
      if (governanceTableMissing) {
        li0.className = 'list-none p-0';
        var wrap = document.createElement('div');
        wrap.className = 'admin-migration-callout';
        wrap.innerHTML =
          '<strong class="text-[var(--text)]">Governance tables not found.</strong> Run ' +
          '<code>sql/admin_portal_schema.sql</code> in the Supabase SQL editor (privileged role), then reload. ' +
          'Until then, list and save actions stay disabled below.';
        li0.appendChild(wrap);
      } else {
        li0.textContent = 'No governance documents yet. Run sql/admin_portal_schema.sql to seed drafts.';
      }
      list.appendChild(li0);
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var id = r && r.id != null ? String(r.id) : '';
      var title = r && r.title != null ? String(r.title) : '(untitled)';
      var slug = r && r.slug != null ? String(r.slug) : '';
      var st = r && r.status != null ? String(r.status) : '';
      var locked = r && r.is_locked === true;
      var li = document.createElement('li');
      li.className = 'rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3';
      li.innerHTML =
        '<button type="button" class="w-full text-left" data-governance-open="' +
        escapeHtml(id) +
        '">' +
        '<p class="font-medium text-[var(--text)]">' +
        escapeHtml(title) +
        '</p>' +
        '<p class="mt-1 font-mono text-xs text-[var(--muted)]">' +
        escapeHtml(slug) +
        '</p>' +
        '<div class="mt-2 flex flex-wrap gap-2">' +
        '<span class="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text)]">' +
        escapeHtml(st) +
        '</span>' +
        (locked
          ? '<span class="rounded bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--muted)]">Locked</span>'
          : '') +
        '</div></button>';
      list.appendChild(li);
    }
  }

  async function loadGovernanceDocuments() {
    setGovernanceStatus('');
    governanceDocumentsCache = [];
    renderGovernanceList([]);
    if (!client) {
      setGovernanceStatus('Not connected.');
      return;
    }
    try {
      var sel = await client
        .from('governance_documents')
        .select('id,slug,title,category,status,is_locked,updated_at')
        .order('updated_at', { ascending: false })
        .limit(200);
      if (sel.error) throw sel.error;
      governanceTableMissing = false;
      governanceDocumentsCache = sel.data || [];
      renderGovernanceList(governanceDocumentsCache);
    } catch (e) {
      governanceTableMissing = true;
      governanceDocumentsCache = [];
      renderGovernanceList([]);
      setGovernanceStatus(
        e && e.message
          ? String(e.message)
          : 'Could not load governance documents (run sql/admin_portal_schema.sql).'
      );
    }
  }

  async function getAuthUserId() {
    if (!client) return null;
    try {
      var s = await client.auth.getUser();
      if (s.error) return null;
      return s.data && s.data.user && s.data.user.id ? s.data.user.id : null;
    } catch (e) {
      return null;
    }
  }

  async function persistGovernanceRevision(documentId, body, status, actionType, userId) {
    if (!client || !documentId) return;
    try {
      var rev = await client.from('governance_document_revisions').insert([
        {
          document_id: documentId,
          body: body,
          status: status,
          action_type: actionType,
          changed_by: userId,
        },
      ]);
      if (rev.error) throw rev.error;
    } catch (eRev) {
      console.warn(
        '[admin] governance revision log skipped (table missing or RLS)',
        eRev && eRev.message ? eRev.message : eRev
      );
    }
  }

  async function saveGovernanceFromForm(actionType, forcedStatus) {
    var hid = $('adminGovernanceEditingId');
    var slugEl = $('adminGovernanceSlug');
    var titleEl = $('adminGovernanceTitle');
    var catEl = $('adminGovernanceCategory');
    var statEl = $('adminGovernanceStatusSelect');
    var bodyEl = $('adminGovernanceBody');
    var notesEl = $('adminGovernanceInternalNotes');
    var lockEl = $('adminGovernanceLocked');
    var editId = hid && hid.value != null ? String(hid.value).trim() : '';
    var slugRaw = slugEl && slugEl.value != null ? String(slugEl.value).trim() : '';
    var slug = governanceSlugify(slugRaw);
    if (!slug && titleEl && titleEl.value) {
      slug = governanceSlugify(String(titleEl.value).trim());
      if (slugEl) slugEl.value = slug;
    }
    var title = titleEl && titleEl.value != null ? String(titleEl.value).trim() : '';
    var category = catEl && catEl.value != null ? String(catEl.value).trim() : '';
    var body = bodyEl && bodyEl.value != null ? String(bodyEl.value) : '';
    var internal_notes = notesEl && notesEl.value != null ? String(notesEl.value) : '';
    var is_locked = lockEl ? !!lockEl.checked : false;
    var status =
      forcedStatus != null
        ? forcedStatus
        : statEl && statEl.value
          ? String(statEl.value)
          : 'draft';

    if (!slug) {
      setGovernanceStatus('Slug is required (letters, numbers, and hyphens).');
      return;
    }
    if (!client) {
      setGovernanceStatus('Not connected.');
      return;
    }
    var saveBtn = $('adminGovernanceSaveDraftBtn');
    var pubBtn = $('adminGovernancePublishBtn');
    var dupBtn = $('adminGovernanceDuplicateBtn');
    if (saveBtn) saveBtn.disabled = true;
    if (pubBtn) pubBtn.disabled = true;
    if (dupBtn) dupBtn.disabled = true;
    setGovernanceStatus('');
    try {
      var userId = await getAuthUserId();
      var payload = {
        slug: slug,
        title: title || null,
        category: category || null,
        body: body,
        status: status,
        is_locked: is_locked,
        internal_notes: internal_notes || null,
        updated_by: userId,
      };
      if (editId) {
        var upd = await client.from('governance_documents').update(payload).eq('id', editId).select('id').maybeSingle();
        if (upd.error) throw upd.error;
        await persistGovernanceRevision(editId, body, status, actionType, userId);
        setGovernanceStatus('Saved.');
        await loadGovernanceDocuments();
        var full = await client.from('governance_documents').select('*').eq('id', editId).maybeSingle();
        if (!full.error && full.data) fillGovernanceForm(full.data);
      } else {
        payload.created_by = userId;
        var ins = await client.from('governance_documents').insert([payload]).select('id').maybeSingle();
        if (ins.error) throw ins.error;
        var newId = ins.data && ins.data.id != null ? String(ins.data.id) : '';
        if (newId) {
          await persistGovernanceRevision(newId, body, status, actionType || 'create', userId);
          if (hid) hid.value = newId;
          if (slugEl) slugEl.setAttribute('readonly', 'readonly');
          setGovernanceStatus('Created.');
          await loadGovernanceDocuments();
          var full2 = await client.from('governance_documents').select('*').eq('id', newId).maybeSingle();
          if (!full2.error && full2.data) fillGovernanceForm(full2.data);
        }
      }
      await refreshAdminOverview();
    } catch (e) {
      var msg = e && e.message ? e.message : 'Save failed.';
      setGovernanceStatus(msg);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
      if (pubBtn) pubBtn.disabled = false;
      if (dupBtn) dupBtn.disabled = false;
      var lockBox = $('adminGovernanceLocked');
      applyGovernanceLockedUi(!!(lockBox && lockBox.checked));
    }
  }

  function isoToDatetimeLocal(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var pad = function (n) {
      return n < 10 ? '0' + n : String(n);
    };
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      'T' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  }

  function datetimeLocalToIsoOrNull(val) {
    if (!val || !String(val).trim()) return null;
    var d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function dollarsToCents(raw) {
    var n = parseFloat(String(raw || '').replace(/,/g, ''));
    if (isNaN(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  function centsToDollarsLabel(cents) {
    if (cents == null || cents === '') return '';
    var c = parseInt(String(cents), 10);
    if (isNaN(c)) return '';
    return (c / 100).toFixed(2);
  }

  var leadershipCache = [];
  var meetingsCache = [];
  var votesCache = [];
  var financialCache = [];
  var documentsCache = [];
  var memberCareCache = [];

  function setLeadershipStatus(msg) {
    var el = $('adminLeadershipStatus');
    if (el) el.textContent = msg != null ? String(msg) : '';
  }

  function renderLeadershipList(rows) {
    var list = $('adminLeadershipList');
    if (!list) return;
    list.innerHTML = '';
    if (!rows || !rows.length) {
      var li0 = document.createElement('li');
      li0.className = 'content-text text-sm text-[var(--muted)]';
      li0.textContent = 'Add the first leadership entry using the form.';
      list.appendChild(li0);
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var id = r && r.id != null ? String(r.id) : '';
      var name = r && r.display_name != null ? String(r.display_name) : '(no name)';
      var role = r && r.role_title != null ? String(r.role_title) : '';
      var active = r && r.is_active === true;
      var li = document.createElement('li');
      li.className = 'rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3';
      li.innerHTML =
        '<div class="flex flex-wrap items-start justify-between gap-2">' +
        '<button type="button" class="min-w-0 flex-1 text-left" data-leadership-open="' +
        escapeHtml(id) +
        '">' +
        '<p class="font-medium text-[var(--text)]">' +
        escapeHtml(name) +
        '</p>' +
        '<p class="content-text mt-1 text-xs text-[var(--muted)]">' +
        escapeHtml(role) +
        '</p>' +
        '<p class="mt-2 text-xs">' +
        (active
          ? '<span class="rounded bg-[var(--surface)] px-2 py-0.5 text-[var(--text)]">Active</span>'
          : '<span class="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--muted)]">Inactive</span>') +
        '</p></button>' +
        '<button type="button" class="shrink-0 text-xs text-[var(--muted)] underline" data-leadership-delete="' +
        escapeHtml(id) +
        '">Delete</button></div>';
      list.appendChild(li);
    }
  }

  function clearLeadershipForm() {
    var hid = $('adminLeadershipEditingId');
    if (hid) hid.value = '';
    var n = $('adminLeadershipDisplayName');
    if (n) n.value = '';
    var rt = $('adminLeadershipRoleTitle');
    if (rt) rt.value = '';
    var em = $('adminLeadershipEmail');
    if (em) em.value = '';
    var no = $('adminLeadershipNotes');
    if (no) no.value = '';
    var ac = $('adminLeadershipActive');
    if (ac) ac.checked = true;
  }

  function fillLeadershipForm(row) {
    if (!row) return;
    var hid = $('adminLeadershipEditingId');
    if (hid) hid.value = row.id != null ? String(row.id) : '';
    var n = $('adminLeadershipDisplayName');
    if (n) n.value = row.display_name != null ? String(row.display_name) : '';
    var rt = $('adminLeadershipRoleTitle');
    if (rt) rt.value = row.role_title != null ? String(row.role_title) : '';
    var em = $('adminLeadershipEmail');
    if (em) em.value = row.contact_email != null ? String(row.contact_email) : '';
    var no = $('adminLeadershipNotes');
    if (no) no.value = row.notes != null ? String(row.notes) : '';
    var ac = $('adminLeadershipActive');
    if (ac) ac.checked = row.is_active !== false;
  }

  async function loadLeadershipPanel() {
    setLeadershipStatus('');
    leadershipCache = [];
    renderLeadershipList([]);
    if (!client) {
      setLeadershipStatus('Not connected.');
      return;
    }
    try {
      var sel = await client
        .from('leadership_directory')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);
      if (sel.error) throw sel.error;
      leadershipCache = sel.data || [];
      renderLeadershipList(leadershipCache);
    } catch (e) {
      leadershipCache = [];
      renderLeadershipList([]);
      setLeadershipStatus(
        e && e.message ? String(e.message) : 'Could not load leadership (run sql/admin_portal_schema.sql).'
      );
    }
    try {
      await refreshAdminOverview();
    } catch (eRO) {
      /* ignore */
    }
  }

  function setMeetingsStatus(msg) {
    var el = $('adminMeetingsStatus');
    if (el) el.textContent = msg != null ? String(msg) : '';
  }

  function renderMeetingsList(rows) {
    var list = $('adminMeetingsList');
    if (!list) return;
    list.innerHTML = '';
    if (!rows || !rows.length) {
      var li0 = document.createElement('li');
      li0.className = 'content-text text-sm text-[var(--muted)]';
      li0.textContent = 'Add the first meeting or planning note.';
      list.appendChild(li0);
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var id = r && r.id != null ? String(r.id) : '';
      var title = r && r.title != null ? String(r.title) : '(untitled)';
      var when = r && r.scheduled_at ? new Date(r.scheduled_at) : null;
      var whenStr =
        when && !isNaN(when.getTime())
          ? when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
          : 'No date set';
      var li = document.createElement('li');
      li.className = 'rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3';
      li.innerHTML =
        '<div class="flex flex-wrap items-start justify-between gap-2">' +
        '<button type="button" class="min-w-0 flex-1 text-left" data-meetings-open="' +
        escapeHtml(id) +
        '">' +
        '<p class="font-medium text-[var(--text)]">' +
        escapeHtml(title) +
        '</p>' +
        '<p class="content-text mt-1 text-xs text-[var(--muted)]">' +
        escapeHtml(whenStr) +
        '</p></button>' +
        '<button type="button" class="shrink-0 text-xs text-[var(--muted)] underline" data-meetings-delete="' +
        escapeHtml(id) +
        '">Delete</button></div>';
      list.appendChild(li);
    }
  }

  function clearMeetingsForm() {
    if ($('adminMeetingsEditingId')) $('adminMeetingsEditingId').value = '';
    if ($('adminMeetingsTitle')) $('adminMeetingsTitle').value = '';
    if ($('adminMeetingsScheduledAt')) $('adminMeetingsScheduledAt').value = '';
    if ($('adminMeetingsLocation')) $('adminMeetingsLocation').value = '';
    if ($('adminMeetingsAgenda')) $('adminMeetingsAgenda').value = '';
    if ($('adminMeetingsMinutesUrl')) $('adminMeetingsMinutesUrl').value = '';
  }

  function fillMeetingsForm(row) {
    if (!row) return;
    if ($('adminMeetingsEditingId')) $('adminMeetingsEditingId').value = row.id != null ? String(row.id) : '';
    if ($('adminMeetingsTitle')) $('adminMeetingsTitle').value = row.title != null ? String(row.title) : '';
    if ($('adminMeetingsScheduledAt')) $('adminMeetingsScheduledAt').value = isoToDatetimeLocal(row.scheduled_at);
    if ($('adminMeetingsLocation')) $('adminMeetingsLocation').value = row.location_notes != null ? String(row.location_notes) : '';
    if ($('adminMeetingsAgenda')) $('adminMeetingsAgenda').value = row.agenda_summary != null ? String(row.agenda_summary) : '';
    if ($('adminMeetingsMinutesUrl')) $('adminMeetingsMinutesUrl').value = row.minutes_url != null ? String(row.minutes_url) : '';
  }

  async function loadMeetingsPanel() {
    setMeetingsStatus('');
    meetingsCache = [];
    renderMeetingsList([]);
    if (!client) {
      setMeetingsStatus('Not connected.');
      return;
    }
    try {
      var sel = await client.from('admin_meetings').select('*').order('updated_at', { ascending: false }).limit(200);
      if (sel.error) throw sel.error;
      meetingsCache = sel.data || [];
      renderMeetingsList(meetingsCache);
    } catch (e) {
      meetingsCache = [];
      renderMeetingsList([]);
      setMeetingsStatus(e && e.message ? String(e.message) : 'Could not load meetings.');
    }
    try {
      await refreshAdminOverview();
    } catch (eRO) {
      /* ignore */
    }
  }

  function setVotesStatus(msg) {
    var el = $('adminVotesStatus');
    if (el) el.textContent = msg != null ? String(msg) : '';
  }

  function renderVotesList(rows) {
    var list = $('adminVotesList');
    if (!list) return;
    list.innerHTML = '';
    if (!rows || !rows.length) {
      var li0 = document.createElement('li');
      li0.className = 'content-text text-sm text-[var(--muted)]';
      li0.textContent = 'Add the first motion or vote record.';
      list.appendChild(li0);
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var id = r && r.id != null ? String(r.id) : '';
      var title = r && r.title != null ? String(r.title) : '(untitled)';
      var st = r && r.status != null ? String(r.status) : '';
      var li = document.createElement('li');
      li.className = 'rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3';
      li.innerHTML =
        '<div class="flex flex-wrap items-start justify-between gap-2">' +
        '<button type="button" class="min-w-0 flex-1 text-left" data-votes-open="' +
        escapeHtml(id) +
        '">' +
        '<p class="font-medium text-[var(--text)]">' +
        escapeHtml(title) +
        '</p>' +
        '<p class="mt-1 text-xs text-[var(--muted)]">' +
        escapeHtml(st) +
        '</p></button>' +
        '<button type="button" class="shrink-0 text-xs text-[var(--muted)] underline" data-votes-delete="' +
        escapeHtml(id) +
        '">Delete</button></div>';
      list.appendChild(li);
    }
  }

  function clearVotesForm() {
    if ($('adminVotesEditingId')) $('adminVotesEditingId').value = '';
    if ($('adminVotesTitle')) $('adminVotesTitle').value = '';
    if ($('adminVotesMotionText')) $('adminVotesMotionText').value = '';
    if ($('adminVotesStatusSelect')) $('adminVotesStatusSelect').value = 'draft';
    if ($('adminVotesClosesAt')) $('adminVotesClosesAt').value = '';
  }

  function fillVotesForm(row) {
    if (!row) return;
    if ($('adminVotesEditingId')) $('adminVotesEditingId').value = row.id != null ? String(row.id) : '';
    if ($('adminVotesTitle')) $('adminVotesTitle').value = row.title != null ? String(row.title) : '';
    if ($('adminVotesMotionText')) $('adminVotesMotionText').value = row.motion_text != null ? String(row.motion_text) : '';
    if ($('adminVotesStatusSelect')) $('adminVotesStatusSelect').value = row.status != null ? String(row.status) : 'draft';
    if ($('adminVotesClosesAt')) $('adminVotesClosesAt').value = isoToDatetimeLocal(row.closes_at);
  }

  async function loadVotesPanel() {
    setVotesStatus('');
    votesCache = [];
    renderVotesList([]);
    if (!client) {
      setVotesStatus('Not connected.');
      return;
    }
    try {
      var sel = await client.from('admin_votes').select('*').order('updated_at', { ascending: false }).limit(200);
      if (sel.error) throw sel.error;
      votesCache = sel.data || [];
      renderVotesList(votesCache);
    } catch (e) {
      votesCache = [];
      renderVotesList([]);
      setVotesStatus(e && e.message ? String(e.message) : 'Could not load votes.');
    }
    try {
      await refreshAdminOverview();
    } catch (eRO) {
      /* ignore */
    }
  }

  async function resolveFinancePermissions() {
    var out = { canView: true, canManage: true };
    if (!window.UpwardAdmin || typeof window.UpwardAdmin.userHasPermission !== 'function') return out;
    try {
      if (typeof window.UpwardAdmin.loadAdminAccess === 'function') {
        await window.UpwardAdmin.loadAdminAccess();
      }
      var roles = window.UpwardAdmin.getCurrentUserRoles ? window.UpwardAdmin.getCurrentUserRoles() : [];
      var hasV = window.UpwardAdmin.userHasPermission('finance.view');
      var hasM = window.UpwardAdmin.userHasPermission('finance.manage');
      if (roles.length === 0 && !hasV && !hasM) {
        if (typeof console !== 'undefined' && console.info) {
          console.info(
            '[admin] Finance: no RBAC roles or finance.* permissions; showing full finance UI for authenticated users until admin_profile_roles are assigned.'
          );
        }
        return out;
      }
      out.canView = hasV || hasM;
      out.canManage = hasM;
    } catch (ePerm) {
      /* keep permissive defaults */
    }
    return out;
  }

  function setFinanceLedgerStatus(msg) {
    var el = $('adminFinanceLedgerStatus');
    if (el) el.textContent = msg != null ? String(msg) : '';
  }

  function setFinancialStatus(msg) {
    var el = $('adminFinancialStatus');
    if (el) el.textContent = msg != null ? String(msg) : '';
  }

  function renderFinancialList(rows) {
    var list = $('adminFinancialList');
    if (!list) return;
    list.innerHTML = '';
    if (!rows || !rows.length) {
      var li0 = document.createElement('li');
      li0.className = 'content-text text-sm text-[var(--muted)]';
      li0.textContent = 'Add the first financial request.';
      list.appendChild(li0);
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var id = r && r.id != null ? String(r.id) : '';
      var summary = r && r.summary != null ? String(r.summary) : '';
      var st = r && r.status != null ? String(r.status) : '';
      var amt = centsToDollarsLabel(r.amount_cents);
      var li = document.createElement('li');
      li.className = 'rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3';
      li.innerHTML =
        '<div class="flex flex-wrap items-start justify-between gap-2">' +
        '<button type="button" class="min-w-0 flex-1 text-left" data-financial-open="' +
        escapeHtml(id) +
        '">' +
        '<p class="font-medium text-[var(--text)]">' +
        escapeHtml(previewBody(summary, 80)) +
        '</p>' +
        '<p class="mt-1 text-xs text-[var(--muted)]">' +
        escapeHtml(st) +
        (amt ? ' · $' + escapeHtml(amt) : '') +
        '</p></button>' +
        '<button type="button" class="shrink-0 text-xs text-[var(--muted)] underline" data-financial-delete="' +
        escapeHtml(id) +
        '">Delete</button></div>';
      list.appendChild(li);
    }
  }

  function clearFinancialForm() {
    if ($('adminFinancialEditingId')) $('adminFinancialEditingId').value = '';
    if ($('adminFinancialType')) $('adminFinancialType').value = '';
    if ($('adminFinancialAmount')) $('adminFinancialAmount').value = '';
    if ($('adminFinancialSummary')) $('adminFinancialSummary').value = '';
    if ($('adminFinancialStatusSelect')) $('adminFinancialStatusSelect').value = 'draft';
  }

  function fillFinancialForm(row) {
    if (!row) return;
    if ($('adminFinancialEditingId')) $('adminFinancialEditingId').value = row.id != null ? String(row.id) : '';
    if ($('adminFinancialType')) $('adminFinancialType').value = row.request_type != null ? String(row.request_type) : '';
    if ($('adminFinancialAmount')) $('adminFinancialAmount').value = centsToDollarsLabel(row.amount_cents);
    if ($('adminFinancialSummary')) $('adminFinancialSummary').value = row.summary != null ? String(row.summary) : '';
    if ($('adminFinancialStatusSelect')) $('adminFinancialStatusSelect').value = row.status != null ? String(row.status) : 'draft';
  }

  function signedLedgerImpactCents(row) {
    var c = parseInt(row && row.amount_cents != null ? row.amount_cents : 0, 10);
    if (isNaN(c)) c = 0;
    var k = row && row.record_kind != null ? String(row.record_kind) : '';
    if (k === 'income' || k === 'giving' || k === 'designated') return Math.abs(c);
    if (k === 'expense' || k === 'reimbursement' || k === 'benevolence') return -Math.abs(c);
    return c;
  }

  function normalizeLedgerAmountForSave(kind, dollars) {
    var cents = dollarsToCents(dollars);
    if (cents == null) cents = 0;
    var k = String(kind || 'expense');
    if (k === 'income' || k === 'giving' || k === 'designated') return Math.abs(cents);
    if (k === 'expense' || k === 'reimbursement' || k === 'benevolence') return -Math.abs(cents);
    return cents;
  }

  function filterFinanceLedgerRows(rows) {
    if (!rows || !rows.length) return [];
    var fromEl = $('adminFinanceFilterFrom');
    var toEl = $('adminFinanceFilterTo');
    var catEl = $('adminFinanceFilterCategory');
    var fundEl = $('adminFinanceFilterFund');
    var stEl = $('adminFinanceFilterStatus');
    var fromD = fromEl && fromEl.value ? String(fromEl.value) : '';
    var toD = toEl && toEl.value ? String(toEl.value) : '';
    var cat = catEl && catEl.value ? String(catEl.value).trim().toLowerCase() : '';
    var fund = fundEl && fundEl.value ? String(fundEl.value).trim().toLowerCase() : '';
    var st = stEl && stEl.value ? String(stEl.value).trim() : '';
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var od = row && row.occurred_on != null ? String(row.occurred_on).slice(0, 10) : '';
      if (fromD && od && od < fromD) continue;
      if (toD && od && od > toD) continue;
      if (cat) {
        var rc = row && row.category != null ? String(row.category).toLowerCase() : '';
        if (rc.indexOf(cat) === -1) continue;
      }
      if (fund) {
        var rf = row && row.fund != null ? String(row.fund).toLowerCase() : '';
        if (rf.indexOf(fund) === -1) continue;
      }
      if (st) {
        var rs = row && row.status != null ? String(row.status) : '';
        if (rs !== st) continue;
      }
      out.push(row);
    }
    return out;
  }

  function applyFinanceDashboardUI(perm) {
    var gate = $('adminFinanceGate');
    var workspace = $('adminFinanceWorkspace');
    if (!gate || !workspace) return;
    if (!perm || !perm.canView) {
      gate.classList.remove('hidden');
      gate.removeAttribute('hidden');
      workspace.classList.add('hidden');
      workspace.setAttribute('hidden', '');
      return;
    }
    gate.classList.add('hidden');
    gate.setAttribute('hidden', '');
    workspace.classList.remove('hidden');
    workspace.removeAttribute('hidden');
    var dis = !perm.canManage;
    var ids = [
      'adminFinanceLedgerKind',
      'adminFinanceLedgerAmount',
      'adminFinanceLedgerFund',
      'adminFinanceLedgerCategory',
      'adminFinanceLedgerStatus',
      'adminFinanceLedgerDate',
      'adminFinanceLedgerMemo',
      'adminFinanceLedgerDocUrl',
      'adminFinanceLedgerCoi',
      'adminFinanceLedgerSaveBtn',
    ];
    for (var ii = 0; ii < ids.length; ii++) {
      var el = $(ids[ii]);
      if (!el) continue;
      el.disabled = dis;
    }
  }

  function renderFinanceLedgerList(rows, canManage) {
    var list = $('adminFinanceLedgerList');
    if (!list) return;
    list.innerHTML = '';
    if (!rows || !rows.length) {
      var li0 = document.createElement('li');
      li0.className = 'content-text text-sm text-[var(--muted)]';
      li0.textContent = 'No ledger rows match these filters.';
      list.appendChild(li0);
      return;
    }
    for (var ri = 0; ri < rows.length; ri++) {
      var r = rows[ri];
      var id = r && r.id != null ? String(r.id) : '';
      var kind = r && r.record_kind != null ? String(r.record_kind) : '';
      var memo = r && r.memo != null ? String(r.memo) : '';
      var impact = signedLedgerImpactCents(r);
      var li = document.createElement('li');
      li.className = 'rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3';
      var delBtn =
        canManage === false
          ? ''
          : '<button type="button" class="shrink-0 text-xs text-[var(--muted)] underline" data-ledger-delete="' +
            escapeHtml(id) +
            '">Delete</button>';
      li.innerHTML =
        '<div class="flex flex-wrap items-start justify-between gap-2">' +
        '<button type="button" class="min-w-0 flex-1 text-left" data-ledger-open="' +
        escapeHtml(id) +
        '">' +
        '<p class="font-medium text-[var(--text)]">' +
        escapeHtml(kind) +
        ' · ' +
        escapeHtml(r && r.occurred_on != null ? String(r.occurred_on).slice(0, 10) : '') +
        '</p>' +
        '<p class="mt-1 text-xs text-[var(--muted)]">' +
        escapeHtml(previewBody(memo, 72) || '—') +
        '</p>' +
        '<p class="mt-1 text-xs font-medium text-[var(--text)]">$' +
        escapeHtml((impact / 100).toFixed(2)) +
        '</p></button>' +
        delBtn +
        '</div>';
      list.appendChild(li);
    }
  }

  function clearFinanceLedgerForm() {
    if ($('adminFinanceLedgerEditingId')) $('adminFinanceLedgerEditingId').value = '';
    if ($('adminFinanceLedgerKind')) $('adminFinanceLedgerKind').value = 'expense';
    if ($('adminFinanceLedgerAmount')) $('adminFinanceLedgerAmount').value = '';
    if ($('adminFinanceLedgerFund')) $('adminFinanceLedgerFund').value = '';
    if ($('adminFinanceLedgerCategory')) $('adminFinanceLedgerCategory').value = '';
    if ($('adminFinanceLedgerStatus')) $('adminFinanceLedgerStatus').value = 'recorded';
    if ($('adminFinanceLedgerMemo')) $('adminFinanceLedgerMemo').value = '';
    if ($('adminFinanceLedgerDocUrl')) $('adminFinanceLedgerDocUrl').value = '';
    if ($('adminFinanceLedgerCoi')) $('adminFinanceLedgerCoi').checked = false;
    var d = new Date();
    var iso = d.toISOString().slice(0, 10);
    if ($('adminFinanceLedgerDate')) $('adminFinanceLedgerDate').value = iso;
  }

  function fillFinanceLedgerForm(row) {
    if (!row) return;
    var impact = signedLedgerImpactCents(row);
    if ($('adminFinanceLedgerEditingId')) $('adminFinanceLedgerEditingId').value = row.id != null ? String(row.id) : '';
    if ($('adminFinanceLedgerKind')) $('adminFinanceLedgerKind').value = row.record_kind != null ? String(row.record_kind) : 'expense';
    if ($('adminFinanceLedgerAmount')) $('adminFinanceLedgerAmount').value = centsToDollarsLabel(Math.abs(impact));
    if ($('adminFinanceLedgerFund')) $('adminFinanceLedgerFund').value = row.fund != null ? String(row.fund) : '';
    if ($('adminFinanceLedgerCategory')) $('adminFinanceLedgerCategory').value = row.category != null ? String(row.category) : '';
    if ($('adminFinanceLedgerStatus')) $('adminFinanceLedgerStatus').value = row.status != null ? String(row.status) : 'recorded';
    if ($('adminFinanceLedgerDate')) $('adminFinanceLedgerDate').value = row.occurred_on != null ? String(row.occurred_on).slice(0, 10) : '';
    if ($('adminFinanceLedgerMemo')) $('adminFinanceLedgerMemo').value = row.memo != null ? String(row.memo) : '';
    if ($('adminFinanceLedgerDocUrl')) $('adminFinanceLedgerDocUrl').value = row.supporting_doc_url != null ? String(row.supporting_doc_url) : '';
    if ($('adminFinanceLedgerCoi')) $('adminFinanceLedgerCoi').checked = row.coi_flag === true;
  }

  function svgEscape(t) {
    return String(t || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderFinanceHtmlTable(rows, wrap) {
    if (!wrap) return;
    var esc = escapeHtml;
    var head =
      '<table class="w-full min-w-[36rem] border-collapse text-left text-sm">' +
      '<thead><tr class="border-b border-[var(--border)] text-xs uppercase text-[var(--muted)]">' +
      '<th class="py-2 pr-3">Date</th><th class="py-2 pr-3">Kind</th><th class="py-2 pr-3">Amount</th>' +
      '<th class="py-2 pr-3">Fund</th><th class="py-2 pr-3">Category</th><th class="py-2">Memo</th></tr></thead><tbody>';
    var body = '';
    for (var ti = 0; ti < rows.length; ti++) {
      var z = rows[ti];
      var impact = signedLedgerImpactCents(z);
      body +=
        '<tr class="border-b border-[var(--border)]/70">' +
        '<td class="py-2 pr-3 font-mono text-xs">' +
        esc(z && z.occurred_on != null ? String(z.occurred_on).slice(0, 10) : '') +
        '</td>' +
        '<td class="py-2 pr-3">' +
        esc(z && z.record_kind != null ? String(z.record_kind) : '') +
        '</td>' +
        '<td class="py-2 pr-3 font-medium">' +
        esc('$' + (impact / 100).toFixed(2)) +
        '</td>' +
        '<td class="py-2 pr-3">' +
        esc(z && z.fund != null ? String(z.fund) : '') +
        '</td>' +
        '<td class="py-2 pr-3">' +
        esc(z && z.category != null ? String(z.category) : '') +
        '</td>' +
        '<td class="py-2 text-xs text-[var(--muted)]">' +
        esc(previewBody(z && z.memo != null ? String(z.memo) : '', 80)) +
        '</td>' +
        '</tr>';
    }
    wrap.innerHTML = head + body + '</tbody></table>';
  }

  function renderFinanceVisualization(filtered, mode) {
    var host = $('adminFinanceChartHost');
    var tableWrap = $('adminFinanceTableWrap');
    if (!host) return;
    var buttons = document.querySelectorAll('.admin-finance-view-btn');
    for (var bi = 0; bi < buttons.length; bi++) {
      var bt = buttons[bi];
      var mv = bt.getAttribute('data-finance-view');
      if (mv === mode) {
        bt.setAttribute('aria-pressed', 'true');
        bt.classList.add('admin-finance-view-btn--active');
      } else {
        bt.removeAttribute('aria-pressed');
        bt.classList.remove('admin-finance-view-btn--active');
      }
    }
    if (tableWrap) {
      if (mode === 'table') {
        tableWrap.classList.remove('hidden');
        tableWrap.removeAttribute('hidden');
      } else {
        tableWrap.classList.add('hidden');
        tableWrap.setAttribute('hidden', '');
      }
    }
    var inf = 0;
    var outf = 0;
    for (var si = 0; si < filtered.length; si++) {
      var v = signedLedgerImpactCents(filtered[si]);
      if (v >= 0) inf += v;
      else outf += -v;
    }
    var net = inf - outf;
    var stIn = $('adminFinanceStatInflow');
    var stOut = $('adminFinanceStatOutflow');
    var stNet = $('adminFinanceStatNet');
    var stRows = $('adminFinanceStatRows');
    if (stIn) stIn.textContent = '$' + (inf / 100).toFixed(2);
    if (stOut) stOut.textContent = '$' + (outf / 100).toFixed(2);
    if (stNet) stNet.textContent = '$' + (net / 100).toFixed(2);
    if (stRows) stRows.textContent = String(filtered.length);

    if (mode === 'table') {
      renderFinanceHtmlTable(filtered, tableWrap);
      host.innerHTML =
        '<p class="p-6 text-center text-sm text-[var(--muted)]">Ledger rows are listed in the table below.</p>';
      return;
    }

    if (mode === 'summary') {
      host.innerHTML =
        '<div class="flex flex-col items-center justify-center gap-2 p-8 text-center">' +
        '<p class="text-sm font-medium text-[var(--text)]">Filtered totals (see cards above)</p>' +
        '<p class="text-xs text-[var(--muted)]">Use Line / Bar / Donut for lightweight SVG charts of the same filtered set.</p></div>';
      return;
    }

    var buckets = {};
    for (var j = 0; j < filtered.length; j++) {
      var row = filtered[j];
      var dk = row && row.occurred_on != null ? String(row.occurred_on).slice(0, 7) : '';
      if (!dk) continue;
      if (!buckets[dk]) buckets[dk] = 0;
      buckets[dk] += signedLedgerImpactCents(row);
    }
    var keys = Object.keys(buckets).sort();
    if (!keys.length) {
      host.innerHTML =
        '<p class="p-6 text-center text-sm text-[var(--muted)]">Not enough dated rows for a chart.</p>';
      return;
    }
    var vals = keys.map(function (k) {
      return buckets[k] / 100;
    });
    var pad = 28;
    var W = 720;
    var H = 220;
    var bw = (W - pad * 2) / keys.length;
    var minV = Math.min.apply(null, vals.concat([0]));
    var maxV = Math.max.apply(null, vals.concat([0]));
    var span = maxV - minV || 1;
    var pts = [];
    for (var pi = 0; pi < keys.length; pi++) {
      var x = pad + pi * bw + bw / 2;
      var y = pad + ((maxV - vals[pi]) / span) * (H - pad * 2);
      pts.push(x + ',' + y);
    }
    var parts = [];
    parts.push(
      '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Finance chart">'
    );
    parts.push(
      '<defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="var(--accent)"/><stop offset="100%" stop-color="color-mix(in srgb, var(--accent) 45%, var(--border))"/></linearGradient></defs>'
    );
    parts.push(
      '<rect x="0" y="0" width="' +
        W +
        '" height="' +
        H +
        '" fill="color-mix(in srgb, var(--surface) 88%, transparent)"/>'
    );
    if (mode === 'bar') {
      var maxA = 0;
      for (var ai = 0; ai < vals.length; ai++) {
        maxA = Math.max(maxA, Math.abs(vals[ai]));
      }
      if (maxA === 0) maxA = 1;
      for (var bj = 0; bj < keys.length; bj++) {
        var bx = pad + bj * bw + 4;
        var hBar = (Math.abs(vals[bj]) / maxA) * (H - pad * 2);
        var by = H - pad - hBar;
        parts.push(
          '<rect x="' +
            bx +
            '" y="' +
            by +
            '" width="' +
            (bw - 8) +
            '" height="' +
            hBar +
            '" rx="3" fill="url(#lg)" opacity="' +
            (vals[bj] >= 0 ? '0.95' : '0.55') +
            '"/>'
        );
      }
    } else if (mode === 'line') {
      parts.push('<polyline fill="none" stroke="url(#lg)" stroke-width="2.5" points="' + pts.join(' ') + '"/>');
      parts.push(
        '<polyline fill="color-mix(in srgb, var(--accent-soft) 40%, transparent)" stroke="none" points="' +
          pad +
          ',' +
          (H - pad) +
          ' ' +
          pts.join(' ') +
          ' ' +
          (W - pad) +
          ',' +
          (H - pad) +
          '"/>'
      );
    } else if (mode === 'donut') {
      var byFund = {};
      for (var fi = 0; fi < filtered.length; fi++) {
        var fr = filtered[fi];
        var fk = fr && fr.fund != null && String(fr.fund).trim() ? String(fr.fund).trim() : 'Unassigned';
        if (!byFund[fk]) byFund[fk] = 0;
        byFund[fk] += Math.abs(signedLedgerImpactCents(fr));
      }
      var fkKeys = Object.keys(byFund);
      if (!fkKeys.length) {
        host.innerHTML =
          '<p class="p-6 text-center text-sm text-[var(--muted)]">No fund totals to chart.</p>';
        return;
      }
      var total = fkKeys.reduce(function (s, k) {
        return s + byFund[k];
      }, 0);
      var cx = 110;
      var cy = 110;
      var r1 = 72;
      var start = -Math.PI / 2;
      var segs = [];
      var colors = ['#3f6f9f', '#315a82', '#6b93c4', '#8fa8bc', '#c9d6e8'];
      for (var ci = 0; ci < fkKeys.length; ci++) {
        var slice = (byFund[fkKeys[ci]] / total) * Math.PI * 2;
        var x1 = cx + r1 * Math.cos(start);
        var y1 = cy + r1 * Math.sin(start);
        var x2 = cx + r1 * Math.cos(start + slice);
        var y2 = cy + r1 * Math.sin(start + slice);
        var large = slice > Math.PI ? 1 : 0;
        segs.push(
          '<path d="M ' +
            cx +
            ' ' +
            cy +
            ' L ' +
            x1 +
            ' ' +
            y1 +
            ' A ' +
            r1 +
            ' ' +
            r1 +
            ' 0 ' +
            large +
            ' 1 ' +
            x2 +
            ' ' +
            y2 +
            ' Z" fill="' +
            colors[ci % colors.length] +
            '" opacity="0.9"/>'
        );
        start += slice;
      }
      host.innerHTML =
        '<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fund chart">' +
        segs.join('') +
        '</svg>' +
        '<div class="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">' +
        fkKeys
          .map(function (k, idx) {
            return (
              '<span><span style="color:' +
              colors[idx % colors.length] +
              '">●</span> ' +
              svgEscape(k) +
              '</span>'
            );
          })
          .join('') +
        '</div>';
      return;
    }
    parts.push('</svg>');
    host.innerHTML = parts.join('');
  }

  function refreshFinanceDashboardView() {
    var filtered = filterFinanceLedgerRows(financeLedgerCache);
    renderFinanceVisualization(filtered, financeViewMode);
    var perm = window.__UPWARD_LAST_FINANCE_PERM || { canView: true, canManage: true };
    renderFinanceLedgerList(filtered, perm.canManage);
  }

  async function loadFinancialPanel() {
    setFinancialStatus('');
    setFinanceLedgerStatus('');
    financialCache = [];
    financeLedgerCache = [];
    renderFinancialList([]);
    renderFinanceLedgerList([], true);
    var perm = await resolveFinancePermissions();
    window.__UPWARD_LAST_FINANCE_PERM = perm;
    applyFinanceDashboardUI(perm);
    if (!client) {
      setFinancialStatus('Not connected.');
      setFinanceLedgerStatus('Not connected.');
      return;
    }
    if (!perm.canView) {
      try {
        await refreshAdminOverview();
      } catch (eRO) {
        /* ignore */
      }
      return;
    }
    try {
      var sel = await client.from('admin_financial_requests').select('*').order('updated_at', { ascending: false }).limit(200);
      if (sel.error) throw sel.error;
      financialCache = sel.data || [];
      renderFinancialList(financialCache);
    } catch (e) {
      financialCache = [];
      renderFinancialList([]);
      setFinancialStatus(e && e.message ? String(e.message) : 'Could not load financial requests.');
    }
    try {
      var led = await client
        .from('admin_financial_records')
        .select('*')
        .order('occurred_on', { ascending: false })
        .limit(500);
      if (led.error) throw led.error;
      financeLedgerCache = led.data || [];
      clearFinanceLedgerForm();
      refreshFinanceDashboardView();
      setFinanceLedgerStatus('');
    } catch (eL) {
      financeLedgerCache = [];
      setFinanceLedgerStatus(
        eL && eL.message ? String(eL.message) : 'Ledger table missing — apply sql/admin_portal_schema.sql.'
      );
      refreshFinanceDashboardView();
    }
    try {
      await refreshAdminOverview();
    } catch (eRO2) {
      /* ignore */
    }
  }

  function setDocumentsStatus(msg) {
    var el = $('adminDocumentsStatus');
    if (el) el.textContent = msg != null ? String(msg) : '';
  }

  function renderDocumentsList(rows) {
    var list = $('adminDocumentsList');
    if (!list) return;
    list.innerHTML = '';
    if (!rows || !rows.length) {
      var li0 = document.createElement('li');
      li0.className = 'content-text text-sm text-[var(--muted)]';
      li0.textContent = 'Add the first internal document entry.';
      list.appendChild(li0);
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var id = r && r.id != null ? String(r.id) : '';
      var title = r && r.title != null ? String(r.title) : '(untitled)';
      var vis = r && r.visibility != null ? String(r.visibility) : '';
      var li = document.createElement('li');
      li.className = 'rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3';
      li.innerHTML =
        '<div class="flex flex-wrap items-start justify-between gap-2">' +
        '<button type="button" class="min-w-0 flex-1 text-left" data-documents-open="' +
        escapeHtml(id) +
        '">' +
        '<p class="font-medium text-[var(--text)]">' +
        escapeHtml(title) +
        '</p>' +
        '<p class="mt-1 text-xs text-[var(--muted)]">' +
        escapeHtml(vis) +
        '</p></button>' +
        '<button type="button" class="shrink-0 text-xs text-[var(--muted)] underline" data-documents-delete="' +
        escapeHtml(id) +
        '">Delete</button></div>';
      list.appendChild(li);
    }
  }

  function clearDocumentsForm() {
    if ($('adminDocumentsEditingId')) $('adminDocumentsEditingId').value = '';
    if ($('adminDocumentsTitle')) $('adminDocumentsTitle').value = '';
    if ($('adminDocumentsPath')) $('adminDocumentsPath').value = '';
    if ($('adminDocumentsVisibility')) $('adminDocumentsVisibility').value = 'staff';
  }

  function fillDocumentsForm(row) {
    if (!row) return;
    if ($('adminDocumentsEditingId')) $('adminDocumentsEditingId').value = row.id != null ? String(row.id) : '';
    if ($('adminDocumentsTitle')) $('adminDocumentsTitle').value = row.title != null ? String(row.title) : '';
    if ($('adminDocumentsPath')) $('adminDocumentsPath').value = row.storage_path != null ? String(row.storage_path) : '';
    if ($('adminDocumentsVisibility')) $('adminDocumentsVisibility').value = row.visibility != null ? String(row.visibility) : 'staff';
  }

  async function loadDocumentsPanel() {
    setDocumentsStatus('');
    documentsCache = [];
    renderDocumentsList([]);
    if (!client) {
      setDocumentsStatus('Not connected.');
      return;
    }
    try {
      var sel = await client.from('admin_internal_documents').select('*').order('updated_at', { ascending: false }).limit(200);
      if (sel.error) throw sel.error;
      documentsCache = sel.data || [];
      renderDocumentsList(documentsCache);
    } catch (e) {
      documentsCache = [];
      renderDocumentsList([]);
      setDocumentsStatus(e && e.message ? String(e.message) : 'Could not load documents.');
    }
    try {
      await refreshAdminOverview();
    } catch (eRO) {
      /* ignore */
    }
  }

  function setMemberCareStatus(msg) {
    var el = $('adminMemberCareStatus');
    if (el) el.textContent = msg != null ? String(msg) : '';
  }

  function renderMemberCareList(rows) {
    var list = $('adminMemberCareList');
    if (!list) return;
    list.innerHTML = '';
    if (!rows || !rows.length) {
      var li0 = document.createElement('li');
      li0.className = 'content-text text-sm text-[var(--muted)]';
      li0.textContent = 'Add the first member care summary (keep details offline).';
      list.appendChild(li0);
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var id = r && r.id != null ? String(r.id) : '';
      var code = r && r.case_code != null ? String(r.case_code) : '';
      var summary = r && r.summary != null ? String(r.summary) : '';
      var st = r && r.status != null ? String(r.status) : '';
      var li = document.createElement('li');
      li.className = 'rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3';
      li.innerHTML =
        '<div class="flex flex-wrap items-start justify-between gap-2">' +
        '<button type="button" class="min-w-0 flex-1 text-left" data-membercare-open="' +
        escapeHtml(id) +
        '">' +
        '<p class="font-mono text-xs text-[var(--muted)]">' +
        escapeHtml(code || '(no code)') +
        '</p>' +
        '<p class="font-medium text-[var(--text)]">' +
        escapeHtml(previewBody(summary, 100)) +
        '</p>' +
        '<p class="mt-1 text-xs text-[var(--muted)]">' +
        escapeHtml(st) +
        '</p></button>' +
        '<button type="button" class="shrink-0 text-xs text-[var(--muted)] underline" data-membercare-delete="' +
        escapeHtml(id) +
        '">Delete</button></div>';
      list.appendChild(li);
    }
  }

  function clearMemberCareForm() {
    if ($('adminMemberCareEditingId')) $('adminMemberCareEditingId').value = '';
    if ($('adminMemberCareCode')) $('adminMemberCareCode').value = '';
    if ($('adminMemberCareSummary')) $('adminMemberCareSummary').value = '';
    if ($('adminMemberCareStatusSelect')) $('adminMemberCareStatusSelect').value = 'open';
  }

  function fillMemberCareForm(row) {
    if (!row) return;
    if ($('adminMemberCareEditingId')) $('adminMemberCareEditingId').value = row.id != null ? String(row.id) : '';
    if ($('adminMemberCareCode')) $('adminMemberCareCode').value = row.case_code != null ? String(row.case_code) : '';
    if ($('adminMemberCareSummary')) $('adminMemberCareSummary').value = row.summary != null ? String(row.summary) : '';
    if ($('adminMemberCareStatusSelect')) $('adminMemberCareStatusSelect').value = row.status != null ? String(row.status) : 'open';
  }

  async function loadMemberCarePanel() {
    setMemberCareStatus('');
    memberCareCache = [];
    renderMemberCareList([]);
    if (!client) {
      setMemberCareStatus('Not connected.');
      return;
    }
    try {
      var sel = await client.from('admin_member_care').select('*').order('updated_at', { ascending: false }).limit(200);
      if (sel.error) throw sel.error;
      memberCareCache = sel.data || [];
      renderMemberCareList(memberCareCache);
    } catch (e) {
      memberCareCache = [];
      renderMemberCareList([]);
      setMemberCareStatus(e && e.message ? String(e.message) : 'Could not load member care.');
    }
    try {
      await refreshAdminOverview();
    } catch (eRO) {
      /* ignore */
    }
  }

  function setSettingsStatus(msg) {
    var el = $('adminSettingsStatus');
    if (el) el.textContent = msg != null ? String(msg) : '';
  }

  async function loadSettingsPanel() {
    setSettingsStatus('');
    var supEl = $('adminSettingsSupabase');
    var bccEl = $('adminSettingsBccCount');
    var conEl = $('adminSettingsContactCount');
    var govEl = $('adminSettingsGovCount');
    var migEl = $('adminSettingsMigrations');
    var rolesUl = $('adminSettingsRoles');
    var permsEl = $('adminSettingsPerms');
    var auditUl = $('adminSettingsAudit');
    if (migEl) {
      migEl.innerHTML =
        'Apply <code class="rounded bg-[var(--surface-hover)] px-1 font-mono text-xs">sql/admin_portal_schema.sql</code> for portal tables and governance seeds. ' +
        'Apply <code class="rounded bg-[var(--surface-hover)] px-1 font-mono text-xs">sql/supabase-admin-schema.sql</code> for team/tasks RBAC and the append-only audit log.';
    }
    if (supEl) {
      supEl.textContent = api().isSupabaseConfigured && api().isSupabaseConfigured() ? 'Client configured and session-aware.' : 'Not configured.';
    }
    if (!client) {
      setSettingsStatus('Not connected.');
      if (bccEl) bccEl.textContent = '—';
      if (conEl) conEl.textContent = '—';
      if (govEl) govEl.textContent = '—';
      if (rolesUl) rolesUl.innerHTML = '';
      if (permsEl) permsEl.textContent = '—';
      if (auditUl) auditUl.innerHTML = '';
      return;
    }
    try {
      var bcc = await client.from('admin_update_bcc_emails').select('id', { count: 'exact', head: true });
      if (bccEl) {
        if (bcc.error) bccEl.textContent = bcc.error.message || 'Could not count.';
        else bccEl.textContent = String(typeof bcc.count === 'number' ? bcc.count : 0) + ' addresses';
      }
    } catch (eB) {
      if (bccEl) bccEl.textContent = 'Could not load.';
    }
    try {
      var cm = await client.from('contact_messages').select('id', { count: 'exact', head: true });
      if (conEl) {
        if (cm.error) conEl.textContent = cm.error.message || 'Could not count.';
        else conEl.textContent = String(typeof cm.count === 'number' ? cm.count : 0) + ' messages';
      }
    } catch (eC) {
      if (conEl) conEl.textContent = 'Could not load.';
    }
    try {
      var gv = await client.from('governance_documents').select('id', { count: 'exact', head: true });
      if (govEl) {
        if (gv.error) govEl.textContent = 'Table missing or blocked.';
        else govEl.textContent = String(typeof gv.count === 'number' ? gv.count : 0) + ' documents';
      }
    } catch (eG) {
      if (govEl) govEl.textContent = 'Could not load.';
    }
    if (rolesUl) rolesUl.innerHTML = '';
    if (permsEl) permsEl.textContent = '—';
    if (window.UpwardAdmin && typeof window.UpwardAdmin.loadAdminAccess === 'function') {
      try {
        await window.UpwardAdmin.loadAdminAccess();
        var rk = window.UpwardAdmin.getCurrentUserRoles ? window.UpwardAdmin.getCurrentUserRoles() : [];
        if (rolesUl) {
          if (!rk || !rk.length) {
            var liR = document.createElement('li');
            liR.className = 'text-[var(--muted)]';
            liR.textContent = 'No roles assigned (or RBAC tables not installed).';
            rolesUl.appendChild(liR);
          } else {
            for (var ri = 0; ri < rk.length; ri++) {
              var liRole = document.createElement('li');
              liRole.textContent = String(rk[ri]);
              rolesUl.appendChild(liRole);
            }
          }
        }
        if (permsEl) {
          permsEl.textContent =
            rk && rk.length
              ? 'Includes finance.view / finance.manage when assigned (see Settings in full portal).'
              : '—';
        }
      } catch (eA) {
        if (rolesUl) {
          var liE = document.createElement('li');
          liE.className = 'text-[var(--muted)]';
          liE.textContent = eA && eA.message ? String(eA.message) : 'Could not load roles.';
          rolesUl.appendChild(liE);
        }
      }
    } else {
      if (rolesUl) {
        var liM = document.createElement('li');
        liM.className = 'text-[var(--muted)]';
        liM.textContent = 'Admin shell not available.';
        rolesUl.appendChild(liM);
      }
    }
    if (auditUl) {
      auditUl.innerHTML = '';
      try {
        var au = await client
          .from('admin_audit_log')
          .select('created_at,action,entity_type,entity_id')
          .order('created_at', { ascending: false })
          .limit(10);
        if (au.error) throw au.error;
        var rows = au.data || [];
        if (!rows.length) {
          var liA = document.createElement('li');
          liA.className = 'content-text text-sm text-[var(--muted)]';
          liA.textContent = 'No audit rows yet (or table not installed).';
          auditUl.appendChild(liA);
        } else {
          for (var ai = 0; ai < rows.length; ai++) {
            var a = rows[ai];
            var t = a.created_at ? new Date(a.created_at).toLocaleString() : '';
            var li2 = document.createElement('li');
            li2.className = 'rounded border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-xs text-[var(--text)]';
            li2.textContent =
              t + ' — ' + String(a.action || '') + ' on ' + String(a.entity_type || '') + (a.entity_id ? ' #' + String(a.entity_id) : '');
            auditUl.appendChild(li2);
          }
        }
      } catch (eAu) {
        var liErr = document.createElement('li');
        liErr.className = 'content-text text-sm text-[var(--muted)]';
        liErr.textContent = eAu && eAu.message ? String(eAu.message) : 'Audit log unavailable.';
        auditUl.appendChild(liErr);
      }
    }
  }

  function bindLeadershipPanelOnce() {
    var panel = $('admin-panel-leadership');
    if (!panel || panel.dataset.leadershipBound === '1') return;
    panel.dataset.leadershipBound = '1';
    var list = $('adminLeadershipList');
    if (list) {
      list.addEventListener('click', async function (ev) {
        var del = ev.target && ev.target.closest ? ev.target.closest('[data-leadership-delete]') : null;
        var opn = ev.target && ev.target.closest ? ev.target.closest('[data-leadership-open]') : null;
        if (del) {
          var did = del.getAttribute('data-leadership-delete');
          if (!did || !client) return;
          if (!window.confirm('Delete this leadership entry?')) return;
          setLeadershipStatus('');
          try {
            var res = await client.from('leadership_directory').delete().eq('id', did);
            if (res.error) throw res.error;
            setLeadershipStatus('Deleted.');
            await loadLeadershipPanel();
          } catch (e) {
            setLeadershipStatus(e && e.message ? e.message : 'Delete failed.');
          }
          return;
        }
        if (opn) {
          var oid = opn.getAttribute('data-leadership-open');
          var found = null;
          for (var j = 0; j < leadershipCache.length; j++) {
            if (String(leadershipCache[j].id) === oid) {
              found = leadershipCache[j];
              break;
            }
          }
          if (found) fillLeadershipForm(found);
          setLeadershipStatus('');
        }
      });
    }
    var form = $('adminLeadershipForm');
    if (form && form.dataset.bound !== '1') {
      form.dataset.bound = '1';
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        setLeadershipStatus('');
        if (!client) {
          setLeadershipStatus('Not connected.');
          return;
        }
        var editId = $('adminLeadershipEditingId') && $('adminLeadershipEditingId').value ? String($('adminLeadershipEditingId').value).trim() : '';
        var userIdL = await getAuthUserId();
        var payload = {
          display_name: fieldVal('adminLeadershipDisplayName') || null,
          role_title: fieldVal('adminLeadershipRoleTitle') || null,
          contact_email: fieldVal('adminLeadershipEmail') || null,
          notes: fieldVal('adminLeadershipNotes') || null,
          is_active: $('adminLeadershipActive') ? !!$('adminLeadershipActive').checked : true,
          updated_by: userIdL,
        };
        if (!editId) payload.created_by = userIdL;
        var btn = $('adminLeadershipSaveBtn');
        if (btn) btn.disabled = true;
        try {
          if (editId) {
            var upd = await client.from('leadership_directory').update(payload).eq('id', editId).select('id');
            if (upd.error) throw upd.error;
            setLeadershipStatus('Saved.');
          } else {
            var ins = await client.from('leadership_directory').insert([payload]).select('id');
            if (ins.error) throw ins.error;
            setLeadershipStatus('Created.');
          }
          clearLeadershipForm();
          await loadLeadershipPanel();
        } catch (e) {
          setLeadershipStatus(e && e.message ? e.message : 'Save failed.');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
    var clr = $('adminLeadershipClearBtn');
    if (clr && clr.dataset.bound !== '1') {
      clr.dataset.bound = '1';
      clr.addEventListener('click', function () {
        clearLeadershipForm();
        setLeadershipStatus('');
      });
    }
  }

  function bindMeetingsPanelOnce() {
    var panel = $('admin-panel-meetings');
    if (!panel || panel.dataset.meetingsBound === '1') return;
    panel.dataset.meetingsBound = '1';
    var list = $('adminMeetingsList');
    if (list) {
      list.addEventListener('click', async function (ev) {
        var del = ev.target && ev.target.closest ? ev.target.closest('[data-meetings-delete]') : null;
        var opn = ev.target && ev.target.closest ? ev.target.closest('[data-meetings-open]') : null;
        if (del) {
          var did = del.getAttribute('data-meetings-delete');
          if (!did || !client) return;
          if (!window.confirm('Delete this meeting record?')) return;
          setMeetingsStatus('');
          try {
            var res = await client.from('admin_meetings').delete().eq('id', did);
            if (res.error) throw res.error;
            setMeetingsStatus('Deleted.');
            await loadMeetingsPanel();
          } catch (e) {
            setMeetingsStatus(e && e.message ? e.message : 'Delete failed.');
          }
          return;
        }
        if (opn) {
          var oid = opn.getAttribute('data-meetings-open');
          var found = null;
          for (var j = 0; j < meetingsCache.length; j++) {
            if (String(meetingsCache[j].id) === oid) {
              found = meetingsCache[j];
              break;
            }
          }
          if (found) fillMeetingsForm(found);
          setMeetingsStatus('');
        }
      });
    }
    var form = $('adminMeetingsForm');
    if (form && form.dataset.bound !== '1') {
      form.dataset.bound = '1';
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        setMeetingsStatus('');
        if (!client) {
          setMeetingsStatus('Not connected.');
          return;
        }
        var title = fieldVal('adminMeetingsTitle').trim();
        if (!title) {
          setMeetingsStatus('Title is required.');
          return;
        }
        var editId = $('adminMeetingsEditingId') && $('adminMeetingsEditingId').value ? String($('adminMeetingsEditingId').value).trim() : '';
        var payload = {
          title: title,
          scheduled_at: datetimeLocalToIsoOrNull(fieldVal('adminMeetingsScheduledAt')),
          location_notes: fieldVal('adminMeetingsLocation') || null,
          agenda_summary: fieldVal('adminMeetingsAgenda') || null,
          minutes_url: fieldVal('adminMeetingsMinutesUrl') || null,
        };
        var btn = $('adminMeetingsSaveBtn');
        if (btn) btn.disabled = true;
        try {
          if (editId) {
            var upd = await client.from('admin_meetings').update(payload).eq('id', editId).select('id');
            if (upd.error) throw upd.error;
            setMeetingsStatus('Saved.');
          } else {
            var ins = await client.from('admin_meetings').insert([payload]).select('id');
            if (ins.error) throw ins.error;
            setMeetingsStatus('Created.');
          }
          clearMeetingsForm();
          await loadMeetingsPanel();
        } catch (e) {
          setMeetingsStatus(e && e.message ? e.message : 'Save failed.');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
    var clr = $('adminMeetingsClearBtn');
    if (clr && clr.dataset.bound !== '1') {
      clr.dataset.bound = '1';
      clr.addEventListener('click', function () {
        clearMeetingsForm();
        setMeetingsStatus('');
      });
    }
  }

  function bindVotesPanelOnce() {
    var panel = $('admin-panel-voting');
    if (!panel || panel.dataset.votesBound === '1') return;
    panel.dataset.votesBound = '1';
    var list = $('adminVotesList');
    if (list) {
      list.addEventListener('click', async function (ev) {
        var del = ev.target && ev.target.closest ? ev.target.closest('[data-votes-delete]') : null;
        var opn = ev.target && ev.target.closest ? ev.target.closest('[data-votes-open]') : null;
        if (del) {
          var did = del.getAttribute('data-votes-delete');
          if (!did || !client) return;
          if (!window.confirm('Delete this motion?')) return;
          setVotesStatus('');
          try {
            var res = await client.from('admin_votes').delete().eq('id', did);
            if (res.error) throw res.error;
            setVotesStatus('Deleted.');
            await loadVotesPanel();
          } catch (e) {
            setVotesStatus(e && e.message ? e.message : 'Delete failed.');
          }
          return;
        }
        if (opn) {
          var oid = opn.getAttribute('data-votes-open');
          var found = null;
          for (var j = 0; j < votesCache.length; j++) {
            if (String(votesCache[j].id) === oid) {
              found = votesCache[j];
              break;
            }
          }
          if (found) fillVotesForm(found);
          setVotesStatus('');
        }
      });
    }
    var form = $('adminVotesForm');
    if (form && form.dataset.bound !== '1') {
      form.dataset.bound = '1';
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        setVotesStatus('');
        if (!client) {
          setVotesStatus('Not connected.');
          return;
        }
        var title = fieldVal('adminVotesTitle').trim();
        if (!title) {
          setVotesStatus('Title is required.');
          return;
        }
        var editId = $('adminVotesEditingId') && $('adminVotesEditingId').value ? String($('adminVotesEditingId').value).trim() : '';
        var payload = {
          title: title,
          motion_text: fieldVal('adminVotesMotionText') || null,
          status: $('adminVotesStatusSelect') && $('adminVotesStatusSelect').value ? String($('adminVotesStatusSelect').value) : 'draft',
          closes_at: datetimeLocalToIsoOrNull(fieldVal('adminVotesClosesAt')),
        };
        var btn = $('adminVotesSaveBtn');
        if (btn) btn.disabled = true;
        try {
          if (editId) {
            var upd = await client.from('admin_votes').update(payload).eq('id', editId).select('id');
            if (upd.error) throw upd.error;
            setVotesStatus('Saved.');
          } else {
            var ins = await client.from('admin_votes').insert([payload]).select('id');
            if (ins.error) throw ins.error;
            setVotesStatus('Created.');
          }
          clearVotesForm();
          await loadVotesPanel();
        } catch (e) {
          setVotesStatus(e && e.message ? e.message : 'Save failed.');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
    var clr = $('adminVotesClearBtn');
    if (clr && clr.dataset.bound !== '1') {
      clr.dataset.bound = '1';
      clr.addEventListener('click', function () {
        clearVotesForm();
        setVotesStatus('');
      });
    }
  }

  function bindFinanceLedgerPanelOnce() {
    var panel = $('admin-panel-financial');
    if (!panel || panel.dataset.financeLedgerUiBound === '1') return;
    panel.dataset.financeLedgerUiBound = '1';
    var list = $('adminFinanceLedgerList');
    if (list) {
      list.addEventListener('click', async function (ev) {
        var perm = window.__UPWARD_LAST_FINANCE_PERM || { canManage: true };
        if (!perm.canManage) return;
        var del = ev.target && ev.target.closest ? ev.target.closest('[data-ledger-delete]') : null;
        var opn = ev.target && ev.target.closest ? ev.target.closest('[data-ledger-open]') : null;
        if (del) {
          var did = del.getAttribute('data-ledger-delete');
          if (!did || !client) return;
          if (!window.confirm('Delete this ledger row?')) return;
          setFinanceLedgerStatus('');
          try {
            var res = await client.from('admin_financial_records').delete().eq('id', did);
            if (res.error) throw res.error;
            setFinanceLedgerStatus('Deleted.');
            await loadFinancialPanel();
          } catch (e) {
            setFinanceLedgerStatus(e && e.message ? e.message : 'Delete failed.');
          }
          return;
        }
        if (opn) {
          var oid = opn.getAttribute('data-ledger-open');
          var found = null;
          for (var j = 0; j < financeLedgerCache.length; j++) {
            if (String(financeLedgerCache[j].id) === oid) {
              found = financeLedgerCache[j];
              break;
            }
          }
          if (found) fillFinanceLedgerForm(found);
          setFinanceLedgerStatus('');
        }
      });
    }
    var form = $('adminFinanceLedgerForm');
    if (form && form.dataset.financeLedgerFormBound !== '1') {
      form.dataset.financeLedgerFormBound = '1';
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        setFinanceLedgerStatus('');
        var perm = window.__UPWARD_LAST_FINANCE_PERM || { canManage: true };
        if (!perm.canManage) {
          setFinanceLedgerStatus('Read-only: finance.manage is required to edit the ledger.');
          return;
        }
        if (!client) {
          setFinanceLedgerStatus('Not connected.');
          return;
        }
        var editId = $('adminFinanceLedgerEditingId') && $('adminFinanceLedgerEditingId').value ? String($('adminFinanceLedgerEditingId').value).trim() : '';
        var kind = $('adminFinanceLedgerKind') && $('adminFinanceLedgerKind').value ? String($('adminFinanceLedgerKind').value) : 'expense';
        var amtNorm = normalizeLedgerAmountForSave(kind, fieldVal('adminFinanceLedgerAmount'));
        var userId = await getAuthUserId();
        var payload = {
          record_kind: kind,
          amount_cents: amtNorm,
          fund: fieldVal('adminFinanceLedgerFund') || null,
          category: fieldVal('adminFinanceLedgerCategory') || null,
          status:
            $('adminFinanceLedgerStatus') && $('adminFinanceLedgerStatus').value
              ? String($('adminFinanceLedgerStatus').value)
              : 'recorded',
          occurred_on: fieldVal('adminFinanceLedgerDate') || null,
          memo: fieldVal('adminFinanceLedgerMemo') || null,
          supporting_doc_url: fieldVal('adminFinanceLedgerDocUrl') || null,
          coi_flag: $('adminFinanceLedgerCoi') ? !!$('adminFinanceLedgerCoi').checked : false,
          updated_by: userId,
        };
        var btn = $('adminFinanceLedgerSaveBtn');
        if (btn) btn.disabled = true;
        try {
          if (editId) {
            var upd = await client.from('admin_financial_records').update(payload).eq('id', editId).select('id');
            if (upd.error) throw upd.error;
            setFinanceLedgerStatus('Saved.');
          } else {
            var insRow = Object.assign({}, payload);
            insRow.created_by = userId;
            var ins = await client.from('admin_financial_records').insert([insRow]).select('id');
            if (ins.error) throw ins.error;
            setFinanceLedgerStatus('Created.');
          }
          clearFinanceLedgerForm();
          await loadFinancialPanel();
        } catch (e) {
          setFinanceLedgerStatus(e && e.message ? e.message : 'Save failed.');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
    var clr = $('adminFinanceLedgerClearBtn');
    if (clr && clr.dataset.financeLedgerClrBound !== '1') {
      clr.dataset.financeLedgerClrBound = '1';
      clr.addEventListener('click', function () {
        clearFinanceLedgerForm();
        setFinanceLedgerStatus('');
      });
    }
    var sw = $('adminFinanceViewSwitcher');
    if (sw && sw.dataset.financeViewSwBound !== '1') {
      sw.dataset.financeViewSwBound = '1';
      sw.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-finance-view]') : null;
        if (!b) return;
        financeViewMode = b.getAttribute('data-finance-view') || 'summary';
        refreshFinanceDashboardView();
      });
    }
    var af = $('adminFinanceApplyFilters');
    if (af && af.dataset.financeApplyBound !== '1') {
      af.dataset.financeApplyBound = '1';
      af.addEventListener('click', function () {
        refreshFinanceDashboardView();
      });
    }
  }

  function bindFinancialPanelOnce() {
    var panel = $('admin-panel-financial');
    if (!panel || panel.dataset.financialBound === '1') return;
    panel.dataset.financialBound = '1';
    var list = $('adminFinancialList');
    if (list) {
      list.addEventListener('click', async function (ev) {
        var del = ev.target && ev.target.closest ? ev.target.closest('[data-financial-delete]') : null;
        var opn = ev.target && ev.target.closest ? ev.target.closest('[data-financial-open]') : null;
        if (del) {
          var did = del.getAttribute('data-financial-delete');
          if (!did || !client) return;
          var permR = window.__UPWARD_LAST_FINANCE_PERM || { canManage: true };
          if (!permR.canManage) {
            setFinancialStatus('Read-only: finance.manage is required to delete requests.');
            return;
          }
          if (!window.confirm('Delete this request?')) return;
          setFinancialStatus('');
          try {
            var res = await client.from('admin_financial_requests').delete().eq('id', did);
            if (res.error) throw res.error;
            setFinancialStatus('Deleted.');
            await loadFinancialPanel();
          } catch (e) {
            setFinancialStatus(e && e.message ? e.message : 'Delete failed.');
          }
          return;
        }
        if (opn) {
          var oid = opn.getAttribute('data-financial-open');
          var found = null;
          for (var j = 0; j < financialCache.length; j++) {
            if (String(financialCache[j].id) === oid) {
              found = financialCache[j];
              break;
            }
          }
          if (found) fillFinancialForm(found);
          setFinancialStatus('');
        }
      });
    }
    var form = $('adminFinancialForm');
    if (form && form.dataset.bound !== '1') {
      form.dataset.bound = '1';
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        setFinancialStatus('');
        var permF = window.__UPWARD_LAST_FINANCE_PERM || { canManage: true };
        if (!permF.canManage) {
          setFinancialStatus('Read-only: finance.manage is required to edit requests.');
          return;
        }
        if (!client) {
          setFinancialStatus('Not connected.');
          return;
        }
        var summary = fieldVal('adminFinancialSummary').trim();
        if (!summary) {
          setFinancialStatus('Summary is required.');
          return;
        }
        var cents = dollarsToCents(fieldVal('adminFinancialAmount'));
        var editId = $('adminFinancialEditingId') && $('adminFinancialEditingId').value ? String($('adminFinancialEditingId').value).trim() : '';
        var payload = {
          request_type: fieldVal('adminFinancialType') || null,
          amount_cents: cents,
          summary: summary,
          status:
            $('adminFinancialStatusSelect') && $('adminFinancialStatusSelect').value
              ? String($('adminFinancialStatusSelect').value)
              : 'draft',
        };
        var btn = $('adminFinancialSaveBtn');
        if (btn) btn.disabled = true;
        try {
          if (editId) {
            var upd = await client.from('admin_financial_requests').update(payload).eq('id', editId).select('id');
            if (upd.error) throw upd.error;
            setFinancialStatus('Saved.');
          } else {
            var ins = await client.from('admin_financial_requests').insert([payload]).select('id');
            if (ins.error) throw ins.error;
            setFinancialStatus('Created.');
          }
          clearFinancialForm();
          await loadFinancialPanel();
        } catch (e) {
          setFinancialStatus(e && e.message ? e.message : 'Save failed.');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
    var clr = $('adminFinancialClearBtn');
    if (clr && clr.dataset.bound !== '1') {
      clr.dataset.bound = '1';
      clr.addEventListener('click', function () {
        clearFinancialForm();
        setFinancialStatus('');
      });
    }
    bindFinanceLedgerPanelOnce();
  }

  function bindDocumentsPanelOnce() {
    var panel = $('admin-panel-documents');
    if (!panel || panel.dataset.documentsBound === '1') return;
    panel.dataset.documentsBound = '1';
    var list = $('adminDocumentsList');
    if (list) {
      list.addEventListener('click', async function (ev) {
        var del = ev.target && ev.target.closest ? ev.target.closest('[data-documents-delete]') : null;
        var opn = ev.target && ev.target.closest ? ev.target.closest('[data-documents-open]') : null;
        if (del) {
          var did = del.getAttribute('data-documents-delete');
          if (!did || !client) return;
          if (!window.confirm('Delete this registry entry?')) return;
          setDocumentsStatus('');
          try {
            var res = await client.from('admin_internal_documents').delete().eq('id', did);
            if (res.error) throw res.error;
            setDocumentsStatus('Deleted.');
            await loadDocumentsPanel();
          } catch (e) {
            setDocumentsStatus(e && e.message ? e.message : 'Delete failed.');
          }
          return;
        }
        if (opn) {
          var oid = opn.getAttribute('data-documents-open');
          var found = null;
          for (var j = 0; j < documentsCache.length; j++) {
            if (String(documentsCache[j].id) === oid) {
              found = documentsCache[j];
              break;
            }
          }
          if (found) fillDocumentsForm(found);
          setDocumentsStatus('');
        }
      });
    }
    var form = $('adminDocumentsForm');
    if (form && form.dataset.bound !== '1') {
      form.dataset.bound = '1';
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        setDocumentsStatus('');
        if (!client) {
          setDocumentsStatus('Not connected.');
          return;
        }
        var title = fieldVal('adminDocumentsTitle').trim();
        if (!title) {
          setDocumentsStatus('Title is required.');
          return;
        }
        var editId = $('adminDocumentsEditingId') && $('adminDocumentsEditingId').value ? String($('adminDocumentsEditingId').value).trim() : '';
        var payload = {
          title: title,
          storage_path: fieldVal('adminDocumentsPath') || null,
          visibility:
            $('adminDocumentsVisibility') && $('adminDocumentsVisibility').value
              ? String($('adminDocumentsVisibility').value)
              : 'staff',
        };
        var btn = $('adminDocumentsSaveBtn');
        if (btn) btn.disabled = true;
        try {
          if (editId) {
            var upd = await client.from('admin_internal_documents').update(payload).eq('id', editId).select('id');
            if (upd.error) throw upd.error;
            setDocumentsStatus('Saved.');
          } else {
            var ins = await client.from('admin_internal_documents').insert([payload]).select('id');
            if (ins.error) throw ins.error;
            setDocumentsStatus('Created.');
          }
          clearDocumentsForm();
          await loadDocumentsPanel();
        } catch (e) {
          setDocumentsStatus(e && e.message ? e.message : 'Save failed.');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
    var clr = $('adminDocumentsClearBtn');
    if (clr && clr.dataset.bound !== '1') {
      clr.dataset.bound = '1';
      clr.addEventListener('click', function () {
        clearDocumentsForm();
        setDocumentsStatus('');
      });
    }
  }

  function bindMemberCarePanelOnce() {
    var panel = $('admin-panel-member_care');
    if (!panel || panel.dataset.memberCareBound === '1') return;
    panel.dataset.memberCareBound = '1';
    var list = $('adminMemberCareList');
    if (list) {
      list.addEventListener('click', async function (ev) {
        var del = ev.target && ev.target.closest ? ev.target.closest('[data-membercare-delete]') : null;
        var opn = ev.target && ev.target.closest ? ev.target.closest('[data-membercare-open]') : null;
        if (del) {
          var did = del.getAttribute('data-membercare-delete');
          if (!did || !client) return;
          if (!window.confirm('Delete this case summary?')) return;
          setMemberCareStatus('');
          try {
            var res = await client.from('admin_member_care').delete().eq('id', did);
            if (res.error) throw res.error;
            setMemberCareStatus('Deleted.');
            await loadMemberCarePanel();
          } catch (e) {
            setMemberCareStatus(e && e.message ? e.message : 'Delete failed.');
          }
          return;
        }
        if (opn) {
          var oid = opn.getAttribute('data-membercare-open');
          var found = null;
          for (var j = 0; j < memberCareCache.length; j++) {
            if (String(memberCareCache[j].id) === oid) {
              found = memberCareCache[j];
              break;
            }
          }
          if (found) fillMemberCareForm(found);
          setMemberCareStatus('');
        }
      });
    }
    var form = $('adminMemberCareForm');
    if (form && form.dataset.bound !== '1') {
      form.dataset.bound = '1';
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        setMemberCareStatus('');
        if (!client) {
          setMemberCareStatus('Not connected.');
          return;
        }
        var summary = fieldVal('adminMemberCareSummary').trim();
        if (!summary) {
          setMemberCareStatus('Summary is required.');
          return;
        }
        var editId = $('adminMemberCareEditingId') && $('adminMemberCareEditingId').value ? String($('adminMemberCareEditingId').value).trim() : '';
        var codeRaw = fieldVal('adminMemberCareCode').trim();
        var payload = {
          summary: summary,
          status:
            $('adminMemberCareStatusSelect') && $('adminMemberCareStatusSelect').value
              ? String($('adminMemberCareStatusSelect').value)
              : 'open',
          case_code: codeRaw || null,
        };
        var btn = $('adminMemberCareSaveBtn');
        if (btn) btn.disabled = true;
        try {
          if (editId) {
            var upd = await client.from('admin_member_care').update(payload).eq('id', editId).select('id');
            if (upd.error) throw upd.error;
            setMemberCareStatus('Saved.');
          } else {
            var ins = await client.from('admin_member_care').insert([payload]).select('id');
            if (ins.error) throw ins.error;
            setMemberCareStatus('Created.');
          }
          clearMemberCareForm();
          await loadMemberCarePanel();
        } catch (e) {
          setMemberCareStatus(e && e.message ? e.message : 'Save failed.');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
    var clr = $('adminMemberCareClearBtn');
    if (clr && clr.dataset.bound !== '1') {
      clr.dataset.bound = '1';
      clr.addEventListener('click', function () {
        clearMemberCareForm();
        setMemberCareStatus('');
      });
    }
  }

  function bindGovernancePanelOnce() {
    var panel = $('admin-panel-governance');
    if (!panel || panel.dataset.governanceBound === '1') return;
    panel.dataset.governanceBound = '1';
    var list = $('adminGovernanceList');
    if (list) {
      list.addEventListener('click', async function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('[data-governance-open]') : null;
        if (!btn || !client) return;
        var id = btn.getAttribute('data-governance-open');
        if (!id) return;
        setGovernanceStatus('');
        try {
          var sel = await client.from('governance_documents').select('*').eq('id', id).maybeSingle();
          if (sel.error) throw sel.error;
          if (sel.data) fillGovernanceForm(sel.data);
        } catch (e) {
          setGovernanceStatus(e && e.message ? e.message : 'Could not open document.');
        }
      });
    }
    var saveDraft = $('adminGovernanceSaveDraftBtn');
    if (saveDraft && saveDraft.dataset.bound !== '1') {
      saveDraft.dataset.bound = '1';
      saveDraft.addEventListener('click', function () {
        if (saveDraft.disabled) return;
        saveGovernanceFromForm('save_draft', 'draft');
      });
    }
    var publish = $('adminGovernancePublishBtn');
    if (publish && publish.dataset.bound !== '1') {
      publish.dataset.bound = '1';
      publish.addEventListener('click', function () {
        if (publish.disabled) return;
        var st = $('adminGovernanceStatusSelect');
        if (st) st.value = 'approved';
        saveGovernanceFromForm('publish', 'approved');
      });
    }
    var dup = $('adminGovernanceDuplicateBtn');
    if (dup && dup.dataset.bound !== '1') {
      dup.dataset.bound = '1';
      dup.addEventListener('click', async function () {
        if (!client) {
          setGovernanceStatus('Not connected.');
          return;
        }
        setGovernanceStatus('');
        var slugEl = $('adminGovernanceSlug');
        var titleEl = $('adminGovernanceTitle');
        var catEl = $('adminGovernanceCategory');
        var bodyEl = $('adminGovernanceBody');
        var notesEl = $('adminGovernanceInternalNotes');
        var baseSlug = slugEl && slugEl.value != null ? governanceSlugify(slugEl.value) : '';
        var title = titleEl && titleEl.value != null ? String(titleEl.value).trim() : '';
        var category = catEl && catEl.value != null ? String(catEl.value).trim() : '';
        var body = bodyEl && bodyEl.value != null ? String(bodyEl.value) : '';
        var internal_notes = notesEl && notesEl.value != null ? String(notesEl.value) : '';
        var newSlug = (baseSlug || governanceSlugify(title) || 'document') + '-copy-' + String(Date.now()).slice(-6);
        dup.disabled = true;
        try {
          var userId = await getAuthUserId();
          var ins = await client
            .from('governance_documents')
            .insert([
              {
                slug: newSlug,
                title: (title || 'Untitled') + ' (copy)',
                category: category || null,
                body: body,
                status: 'draft',
                is_locked: false,
                internal_notes: internal_notes || null,
                created_by: userId,
                updated_by: userId,
              },
            ])
            .select('id')
            .maybeSingle();
          if (ins.error) throw ins.error;
          var newId = ins.data && ins.data.id != null ? String(ins.data.id) : '';
          if (newId) {
            await persistGovernanceRevision(newId, body, 'draft', 'duplicate', userId);
            await loadGovernanceDocuments();
            var full = await client.from('governance_documents').select('*').eq('id', newId).maybeSingle();
            if (!full.error && full.data) fillGovernanceForm(full.data);
            setGovernanceStatus('Duplicated as new draft.');
          }
          await refreshAdminOverview();
        } catch (e) {
          setGovernanceStatus(e && e.message ? e.message : 'Duplicate failed.');
        } finally {
          dup.disabled = false;
        }
      });
    }
    var clearBtn = $('adminGovernanceClearBtn');
    if (clearBtn && clearBtn.dataset.bound !== '1') {
      clearBtn.dataset.bound = '1';
      clearBtn.addEventListener('click', function () {
        clearGovernanceForm();
      });
    }
    var lockBx = $('adminGovernanceLocked');
    if (lockBx && lockBx.dataset.boundGovernanceLock !== '1') {
      lockBx.dataset.boundGovernanceLock = '1';
      lockBx.addEventListener('change', function () {
        applyGovernanceLockedUi(!!lockBx.checked);
      });
    }
  }

  async function enterDashboard() {
    renderDashboard();
    if (!dashboardMounted) return;
    await initDashboardAfterAuth();
  }

  function clearPageBanner() {
    var b = $('adminPageBanner');
    if (b) {
      b.textContent = '';
      b.hidden = true;
    }
  }

  function withTimeout(promise, ms, timeoutMessage) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error(timeoutMessage || 'That step took too long.'));
        }, ms);
      }),
    ]);
  }

  function friendlyShowError(msg) {
    renderLogin({ silent: true });
    var b = $('adminPageBanner');
    if (b) {
      b.textContent = msg || 'Please try again in a moment.';
      b.hidden = false;
    }
  }

  function bindLogout() {
    var btn = $('adminLogoutBtn');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        if (client) client.auth.signOut();
      });
    }
  }

  function bindLogin() {
    var form = $('adminLoginForm');
    if (form && form.dataset.adminLoginBound === '1') return;
    if (form) form.dataset.adminLoginBound = '1';
    if (form) {
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        clearPageBanner();
        var emailEl = $('adminLoginEmail');
        var passEl = $('adminLoginPassword');
        var errEl = $('adminLoginError');
        var submit = $('adminLoginSubmit');
        var email = emailEl && emailEl.value ? emailEl.value.trim() : '';
        var password = passEl ? passEl.value : '';
        if (errEl) errEl.textContent = '';
        if (submit) submit.disabled = true;
        try {
          if (!client) throw new Error('Not initialized.');
          var res = await client.auth.signInWithPassword({ email: email, password: password });
          if (res.error) throw res.error;
        } catch (e) {
          var msg = e && e.message ? e.message : 'Sign-in failed.';
          if (errEl) errEl.textContent = msg;
        } finally {
          if (submit) submit.disabled = false;
        }
      });
    }
    bindForgotPassword();
  }

  function bindForgotPassword() {
    var btn = $('adminForgotPasswordBtn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async function () {
      var emailEl = $('adminLoginEmail');
      var statusEl = $('adminForgotStatus');
      var email = emailEl && emailEl.value ? emailEl.value.trim() : '';
      if (statusEl) statusEl.textContent = '';
      if (!email) {
        if (statusEl) statusEl.textContent = 'Enter your email address above first.';
        if (emailEl) emailEl.focus();
        return;
      }
      btn.disabled = true;
      try {
        if (!client) throw new Error('Not initialized.');
        var redirectTo = getAdminAuthRedirectUrl();
        if (!redirectTo) throw new Error('Could not build redirect URL.');
        var res = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
        if (res.error) throw res.error;
        if (statusEl) {
          statusEl.textContent =
            'If an account exists for that email, you will receive a reset link shortly. Check your inbox and spam folder.';
        }
      } catch (e) {
        var msg = e && e.message ? e.message : 'Could not send reset email.';
        if (statusEl) statusEl.textContent = msg;
      } finally {
        btn.disabled = false;
      }
    });
  }

  function bindPasswordRecovery() {
    var form = $('adminRecoveryForm');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var p1 = $('adminRecoveryPassword');
        var p2 = $('adminRecoveryPassword2');
        var errEl = $('adminRecoveryError');
        var submit = $('adminRecoverySubmit');
        var a = p1 && p1.value ? String(p1.value) : '';
        var b = p2 && p2.value ? String(p2.value) : '';
        if (errEl) errEl.textContent = '';
        if (a.length < 8) {
          if (errEl) errEl.textContent = 'Password must be at least 8 characters.';
          return;
        }
        if (a !== b) {
          if (errEl) errEl.textContent = 'Passwords do not match.';
          return;
        }
        if (submit) submit.disabled = true;
        try {
          if (!client) throw new Error('Not initialized.');
          var res = await client.auth.updateUser({ password: a });
          if (res.error) throw res.error;
          clearPageBanner();
          var banner = $('adminPageBanner');
          if (banner) {
            banner.textContent = 'Your password was updated. Loading the dashboard…';
            banner.hidden = false;
          }
          await routeAfterAuth();
        } catch (e) {
          var msg = e && e.message ? e.message : 'Could not update password.';
          if (errEl) errEl.textContent = msg;
        } finally {
          if (submit) submit.disabled = false;
        }
      });
    }
    var cancel = $('adminRecoveryCancel');
    if (cancel && !cancel.dataset.bound) {
      cancel.dataset.bound = '1';
      cancel.addEventListener('click', function () {
        if (client) client.auth.signOut();
        renderLogin();
      });
    }
  }

  function bindTeachingForm() {
    var form = $('adminTeachingForm');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        await saveTeachingStatus();
      });
    }
  }

  function fieldVal(id) {
    var el = $(id);
    return el && el.value != null ? String(el.value) : '';
  }

  function escapeHtml(str) {
    if (str == null || str === '') return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function previewBody(body, maxLen) {
    var s = body != null ? String(body).replace(/\s+/g, ' ').trim() : '';
    if (!s) return '';
    var n = maxLen != null ? maxLen : 120;
    if (s.length <= n) return s;
    return s.slice(0, n - 1) + '…';
  }

  function setAnnouncementsStatus(msg) {
    var el = $('adminAnnouncementsStatus');
    if (el) el.textContent = msg != null ? String(msg) : '';
  }

  function renderAnnouncementRows(rows) {
    var list = $('adminAnnouncementsList');
    if (!list) return;
    list.innerHTML = '';
    if (!rows || !rows.length) {
      var empty = document.createElement('li');
      empty.className = 'content-text text-sm text-[var(--muted)]';
      empty.textContent = 'No announcements yet.';
      list.appendChild(empty);
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var id = row && row.id != null ? String(row.id) : '';
      var title = row && row.title != null ? String(row.title) : '';
      var body = row && row.body != null ? String(row.body) : '';
      var published = row && row.is_published === true;
      var ord = row && row.display_order != null ? String(row.display_order) : '0';
      var created = row && row.created_at ? new Date(row.created_at) : null;
      var dateStr =
        created && !isNaN(created.getTime())
          ? created.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
          : '';
      var badge = published
        ? '<span class="rounded bg-[var(--surface-hover)] px-2 py-0.5 text-xs font-medium text-[var(--text)]">Published</span>'
        : '<span class="rounded border border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">Draft</span>';

      var li = document.createElement('li');
      li.className = 'rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4';
      li.innerHTML =
        '<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">' +
        '<div class="min-w-0 flex-1">' +
        '<div class="flex flex-wrap items-center gap-2">' +
        '<p class="font-semibold text-[var(--text)]">' +
        escapeHtml(title) +
        '</p>' +
        badge +
        '<span class="text-xs text-[var(--muted)]">Order ' +
        escapeHtml(ord) +
        '</span>' +
        '</div>' +
        '<p class="mt-1 text-xs text-[var(--muted)]">' +
        escapeHtml(dateStr) +
        '</p>' +
        '<p class="content-text mt-2 text-sm leading-relaxed">' +
        escapeHtml(previewBody(body, 160)) +
        '</p>' +
        '</div>' +
        '<div class="flex shrink-0 flex-wrap gap-2 sm:ml-3">' +
        '<button type="button" class="rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface)]" data-announcement-edit="' +
        escapeHtml(id) +
        '">Edit</button>' +
        '<button type="button" class="rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface)]" data-announcement-delete="' +
        escapeHtml(id) +
        '">Delete</button>' +
        '</div>' +
        '</div>';
      list.appendChild(li);
    }
  }

  function clearAnnouncementForm() {
    var hid = $('adminAnnouncementEditingId');
    var titleEl = $('adminAnnouncementTitle');
    var bodyEl = $('adminAnnouncementBody');
    var pub = $('adminAnnouncementPublished');
    var ord = $('adminAnnouncementDisplayOrder');
    var head = $('adminAnnouncementFormHeading');
    if (hid) hid.value = '';
    if (titleEl) titleEl.value = '';
    if (bodyEl) bodyEl.value = '';
    if (pub) pub.checked = false;
    if (ord) ord.value = '0';
    if (head) head.textContent = 'New announcement';
  }

  function fillAnnouncementFormFromRow(row) {
    if (!row) return;
    var hid = $('adminAnnouncementEditingId');
    var titleEl = $('adminAnnouncementTitle');
    var bodyEl = $('adminAnnouncementBody');
    var pub = $('adminAnnouncementPublished');
    var ord = $('adminAnnouncementDisplayOrder');
    var head = $('adminAnnouncementFormHeading');
    if (hid) hid.value = row.id != null ? String(row.id) : '';
    if (titleEl) titleEl.value = row.title != null ? String(row.title) : '';
    if (bodyEl) bodyEl.value = row.body != null ? String(row.body) : '';
    if (pub) pub.checked = row.is_published === true;
    if (ord) ord.value = row.display_order != null ? String(row.display_order) : '0';
    if (head) head.textContent = 'Edit announcement';
  }

  async function loadAnnouncementsAdmin() {
    var loading = $('adminAnnouncementsLoading');
    if (loading) loading.hidden = false;
    setAnnouncementsStatus('');
    if (!client) {
      setAnnouncementsStatus('Not connected.');
      if (loading) loading.hidden = true;
      return;
    }
    try {
      var sel = await client
        .from('announcements')
        .select('id,title,body,created_at,updated_at,is_published,display_order')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(200);
      if (sel.error) throw sel.error;
      adminAnnouncementsCache = sel.data || [];
      renderAnnouncementRows(adminAnnouncementsCache);
    } catch (e) {
      var msg = e && e.message ? e.message : 'Could not load announcements.';
      setAnnouncementsStatus(msg);
      adminAnnouncementsCache = [];
      renderAnnouncementRows([]);
    } finally {
      if (loading) loading.hidden = true;
      try {
        await refreshAdminOverview();
      } catch (eRO) {
        /* ignore */
      }
    }
  }

  function bindAnnouncementForm() {
    var form = $('adminAnnouncementForm');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var btn = $('adminAnnouncementPostBtn');
        var titleEl = $('adminAnnouncementTitle');
        var bodyEl = $('adminAnnouncementBody');
        var pubEl = $('adminAnnouncementPublished');
        var ordEl = $('adminAnnouncementDisplayOrder');
        var editIdEl = $('adminAnnouncementEditingId');
        var title = titleEl && titleEl.value != null ? String(titleEl.value).trim() : '';
        var body = bodyEl && bodyEl.value != null ? String(bodyEl.value).trim() : '';
        var orderRaw = ordEl && ordEl.value != null ? String(ordEl.value).trim() : '0';
        var orderNum = parseInt(orderRaw, 10);
        if (isNaN(orderNum)) orderNum = 0;
        var isPublished = pubEl ? !!pubEl.checked : false;
        var editId = editIdEl && editIdEl.value != null ? String(editIdEl.value).trim() : '';

        setAnnouncementsStatus('');
        if (!client) {
          setAnnouncementsStatus('Not connected.');
          return;
        }
        if (!title || !body) {
          setAnnouncementsStatus('Title and body are required.');
          return;
        }
        if (btn) btn.disabled = true;
        try {
          var payload = {
            title: title,
            body: body,
            is_published: isPublished,
            display_order: orderNum,
          };
          if (editId) {
            var upd = await client.from('announcements').update(payload).eq('id', editId).select('id');
            if (upd.error) throw upd.error;
            setAnnouncementsStatus('Saved.');
          } else {
            var ins = await client.from('announcements').insert([payload]).select('id');
            if (ins.error) throw ins.error;
            setAnnouncementsStatus('Created.');
          }
          clearAnnouncementForm();
          await loadAnnouncementsAdmin();
        } catch (e) {
          var msg = e && e.message ? e.message : 'Save failed.';
          setAnnouncementsStatus(msg);
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
  }

  function bindAnnouncementClear() {
    var btn = $('adminAnnouncementClearBtn');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        clearAnnouncementForm();
        setAnnouncementsStatus('');
      });
    }
  }

  function bindAnnouncementList() {
    var list = $('adminAnnouncementsList');
    if (list && !list.dataset.bound) {
      list.dataset.bound = '1';
      list.addEventListener('click', async function (ev) {
        var raw = ev.target;
        var editBtn = raw && raw.closest ? raw.closest('[data-announcement-edit]') : null;
        var delBtn = raw && raw.closest ? raw.closest('[data-announcement-delete]') : null;

        if (editBtn && editBtn.getAttribute) {
          var eid = editBtn.getAttribute('data-announcement-edit');
          if (!eid) return;
          var found = null;
          for (var j = 0; j < adminAnnouncementsCache.length; j++) {
            if (String(adminAnnouncementsCache[j].id) === eid) {
              found = adminAnnouncementsCache[j];
              break;
            }
          }
          if (found) {
            fillAnnouncementFormFromRow(found);
            setAnnouncementsStatus('');
          }
          return;
        }

        if (!delBtn || !delBtn.getAttribute) return;
        var delId = delBtn.getAttribute('data-announcement-delete');
        if (!delId) return;
        ev.preventDefault();
        if (!client) {
          setAnnouncementsStatus('Not connected.');
          return;
        }
        if (!window.confirm('Delete this announcement? This cannot be undone.')) return;
        setAnnouncementsStatus('');
        delBtn.disabled = true;
        try {
          var res = await client.from('announcements').delete().eq('id', delId);
          if (res.error) throw res.error;
          var hid = $('adminAnnouncementEditingId');
          if (hid && String(hid.value).trim() === delId) clearAnnouncementForm();
          setAnnouncementsStatus('Deleted.');
          await loadAnnouncementsAdmin();
        } catch (e) {
          var msg = e && e.message ? e.message : 'Delete failed.';
          setAnnouncementsStatus(msg);
        } finally {
          delBtn.disabled = false;
        }
      });
    }
  }

  function setBccStatus(msg) {
    var el = $('adminBccStatus');
    if (el) el.textContent = msg != null ? String(msg) : '';
  }

  function renderBccList(rows) {
    var ul = $('adminBccList');
    if (!ul) return;
    ul.innerHTML = '';
    if (!rows || !rows.length) {
      var li = document.createElement('li');
      li.className = 'content-text text-sm text-[var(--muted)]';
      li.textContent = 'No BCC addresses yet.';
      ul.appendChild(li);
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var id = r && r.id != null ? String(r.id) : '';
      var em = r && r.email != null ? String(r.email) : '';
      var item = document.createElement('li');
      item.className =
        'flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5';
      item.innerHTML =
        '<span class="admin-bcc-chip min-w-0 flex-1 truncate rounded-md bg-[var(--surface)] px-3 py-1 font-mono text-sm text-[var(--text)] ring-1 ring-inset ring-[var(--border)]">' +
        escapeHtml(em) +
        '</span>' +
        '<button type="button" class="shrink-0 text-xs font-medium text-[var(--muted)] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--text)]" data-bcc-delete="' +
        escapeHtml(id) +
        '">Remove</button>';
      ul.appendChild(item);
    }
  }

  async function loadBccList() {
    setBccStatus('');
    if (!client) {
      setBccStatus('Not connected.');
      renderBccList([]);
      return;
    }
    try {
      var sel = await client.from('admin_update_bcc_emails').select('id,email').order('email', { ascending: true });
      if (sel.error) throw sel.error;
      renderBccList(sel.data || []);
    } catch (e) {
      var msg = e && e.message ? e.message : 'Could not load BCC list.';
      setBccStatus(msg);
      renderBccList([]);
    }
  }

  function bindBccForm() {
    var form = $('adminBccForm');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var input = $('adminBccEmail');
        var btn = $('adminBccAddBtn');
        var email = input && input.value != null ? String(input.value).trim().toLowerCase() : '';
        setBccStatus('');
        if (!email) {
          setBccStatus('Enter an email address.');
          return;
        }
        if (!client) {
          setBccStatus('Not connected.');
          return;
        }
        if (btn) btn.disabled = true;
        try {
          var ins = await client.from('admin_update_bcc_emails').insert([{ email: email }]).select('id');
          if (ins.error) throw ins.error;
          if (input) input.value = '';
          setBccStatus('Added.');
          await loadBccList();
        } catch (e) {
          var msg = e && e.message ? e.message : 'Could not add address.';
          setBccStatus(msg);
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
  }

  function bindBccList() {
    var ul = $('adminBccList');
    if (ul && !ul.dataset.bound) {
      ul.dataset.bound = '1';
      ul.addEventListener('click', async function (ev) {
        var t = ev.target;
        var btn = t && t.closest ? t.closest('[data-bcc-delete]') : null;
        if (!btn || !btn.getAttribute) return;
        var id = btn.getAttribute('data-bcc-delete');
        if (!id) return;
        if (!client) {
          setBccStatus('Not connected.');
          return;
        }
        btn.disabled = true;
        setBccStatus('');
        try {
          var res = await client.from('admin_update_bcc_emails').delete().eq('id', id);
          if (res.error) throw res.error;
          setBccStatus('Removed.');
          await loadBccList();
        } catch (e) {
          var msg = e && e.message ? e.message : 'Remove failed.';
          setBccStatus(msg);
        } finally {
          btn.disabled = false;
        }
      });
    }
  }

  function setContactStatus(msg) {
    var el = $('adminContactStatus');
    if (el) el.textContent = msg != null ? String(msg) : '';
  }

  function renderContactMessages(rows) {
    var wrap = $('adminContactList');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!rows || !rows.length) {
      wrap.innerHTML = '<p class="content-text text-sm text-[var(--muted)]">No messages yet.</p>';
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var rowId = r && r.id != null ? String(r.id) : '';
      var created = r && r.created_at ? new Date(r.created_at) : null;
      var dateStr =
        created && !isNaN(created.getTime())
          ? created.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
          : '';
      var name = r && r.name != null ? String(r.name) : '';
      var email = r && r.email != null ? String(r.email) : '';
      var msg = r && r.message != null ? String(r.message) : '';
      var prayer = r && r.prayer_request === true;
      var badge = prayer
        ? '<span class="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">Prayer request</span>'
        : '';
      var emailHtml = email
        ? '<a class="break-all text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]" href="mailto:' +
          escapeHtml(email) +
          '">' +
          escapeHtml(email) +
          '</a>'
        : '<span class="text-sm text-[var(--muted)]">—</span>';

      var card = document.createElement('article');
      card.className =
        'rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-4 sm:p-5';
      card.innerHTML =
        '<div class="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">' +
        '<p class="text-xs font-medium text-[var(--muted)]">' +
        escapeHtml(dateStr) +
        '</p>' +
        '<div class="flex flex-wrap items-center justify-end gap-2">' +
        badge +
        '<button type="button" class="text-xs font-medium text-[var(--muted)] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--text)]" data-contact-delete="' +
        escapeHtml(rowId) +
        '">Delete</button>' +
        '</div></div>' +
        '<p class="mt-3 text-base font-semibold text-[var(--text)]">' +
        escapeHtml(name || '—') +
        '</p>' +
        '<div class="mt-1">' +
        emailHtml +
        '</div>' +
        '<div class="content-text mt-3 text-sm leading-relaxed text-[var(--text-readable)] whitespace-pre-wrap">' +
        escapeHtml(msg) +
        '</div>';
      wrap.appendChild(card);
    }
  }

  function bindContactMessagesList() {
    var wrap = $('adminContactList');
    if (!wrap || wrap.dataset.contactDeleteBound === '1') return;
    wrap.dataset.contactDeleteBound = '1';
    wrap.addEventListener('click', async function (ev) {
      var t = ev.target;
      var btn = t && t.closest ? t.closest('[data-contact-delete]') : null;
      if (!btn || !btn.getAttribute) return;
      var id = btn.getAttribute('data-contact-delete');
      if (!id) return;
      ev.preventDefault();
      if (!window.confirm('Delete this contact message? This cannot be undone.')) return;
      if (!client) {
        setContactStatus('Not connected.');
        return;
      }
      btn.disabled = true;
      setContactStatus('');
      try {
        var res = await client.from('contact_messages').delete().eq('id', id);
        if (res.error) throw res.error;
        await loadContactMessages();
      } catch (e) {
        var msg = e && e.message ? e.message : 'Delete failed.';
        setContactStatus(msg);
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function loadContactMessages() {
    var loading = $('adminContactLoading');
    if (loading) loading.hidden = false;
    setContactStatus('');
    if (!client) {
      setContactStatus('Not connected.');
      if (loading) loading.hidden = true;
      renderContactMessages([]);
      return;
    }
    try {
      var sel = await client
        .from('contact_messages')
        .select('id,name,email,message,prayer_request,created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (sel.error) throw sel.error;
      renderContactMessages(sel.data || []);
    } catch (e) {
      var msg = e && e.message ? e.message : 'Could not load messages.';
      setContactStatus(msg);
      renderContactMessages([]);
    } finally {
      if (loading) loading.hidden = true;
      try {
        await refreshAdminOverview();
      } catch (eRO) {
        /* ignore */
      }
    }
  }

  function fillForm(row) {
    var book = $('field-current-book');
    var ch = $('field-current-chapter');
    var vs = $('field-current-verses');
    var wlo = $('field-where-we-left-off');
    var foc = $('field-current-focus');
    var note = $('field-public-note');
    if (book) book.value = row.current_book != null ? row.current_book : '';
    if (ch) ch.value = row.current_chapter != null ? row.current_chapter : '';
    if (vs) vs.value = row.current_verses != null ? row.current_verses : '';
    if (wlo) wlo.value = row.where_we_left_off != null ? row.where_we_left_off : '';
    if (foc) foc.value = row.current_focus != null ? row.current_focus : '';
    if (note) note.value = row.public_note != null ? row.public_note : '';
  }

  function setLastUpdated(row) {
    var el = $('adminLastUpdated');
    if (!el) return;
    if (row.updated_at) {
      var d = new Date(row.updated_at);
      el.textContent = isNaN(d.getTime())
        ? ''
        : 'Last updated ' + d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } else {
      el.textContent = '';
    }
  }

  async function ensureTeachingRow() {
    var sel = await client
      .from('teaching_status')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sel.error) throw sel.error;
    if (sel.data) return sel.data;

    var ins = await client.from('teaching_status').insert([{}]).select().single();
    if (ins.error) throw ins.error;
    return ins.data;
  }

  async function loadTeachingEditor() {
    var loading = $('adminEditorLoading');
    var status = $('adminEditorStatus');
    if (status) status.textContent = '';
    if (loading) loading.hidden = false;

    try {
      var row = await withTimeout(
        ensureTeachingRow(),
        20000,
        'Loading teaching status timed out (20s). Check your connection and Supabase row-level security for teaching_status.'
      );
      currentRowId = row && row.id != null ? row.id : null;
      if (!currentRowId) throw new Error('Could not load teaching status.');
      fillForm(row);
      setLastUpdated(row);
      try {
        await refreshAdminOverview();
      } catch (eRO) {
        /* ignore */
      }
    } catch (e) {
      var msg = e && e.message ? e.message : 'Could not load teaching status.';
      if (status) status.textContent = msg;
    } finally {
      if (loading) loading.hidden = true;
    }
  }

  async function saveTeachingStatus() {
    console.log('Saving teaching status');
    var status = $('adminEditorStatus');
    var saveBtn = $('adminSaveBtn');
    if (status) status.textContent = '';
    if (!client || !currentRowId) {
      if (status) status.textContent = 'Nothing to save yet. Reload the page.';
      return;
    }
    if (saveBtn) saveBtn.disabled = true;
    try {
      var payload = {
        current_book: fieldVal('field-current-book'),
        current_chapter: fieldVal('field-current-chapter'),
        current_verses: fieldVal('field-current-verses'),
        where_we_left_off: fieldVal('field-where-we-left-off'),
        current_focus: fieldVal('field-current-focus'),
        public_note: fieldVal('field-public-note'),
      };
      var upd = await client.from('teaching_status').update(payload).eq('id', currentRowId).select().single();
      if (upd.error) throw upd.error;
      if (upd.data) {
        setLastUpdated(upd.data);
        fillForm(upd.data);
      }
      if (status) status.textContent = 'Saved.';
      try {
        await refreshAdminOverview();
      } catch (eRO) {
        /* ignore */
      }
    } catch (e) {
      var msg = e && e.message ? e.message : 'Save failed.';
      if (status) status.textContent = msg;
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function bindDashboardOnce() {
    bindAdminShellOnce();
    bindLogout();
    bindTeachingForm();
    bindAnnouncementForm();
    bindAnnouncementClear();
    bindAnnouncementList();
    bindBccForm();
    bindBccList();
    bindContactMessagesList();
    bindGovernancePanelOnce();
    bindLeadershipPanelOnce();
    bindMeetingsPanelOnce();
    bindVotesPanelOnce();
    bindFinancialPanelOnce();
    bindDocumentsPanelOnce();
    bindMemberCarePanelOnce();
  }

  function subscribeAuth() {
    if (authSubscribed || !client) return;
    authSubscribed = true;
    client.auth.onAuthStateChange(function (event, session) {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'PASSWORD_RECOVERY') {
        if (session) renderPasswordRecovery();
        return;
      }
      if (session && event === 'SIGNED_IN') {
        if ($('adminRecoveryForm')) return;
        routeAfterAuth().catch(function (e) {
          friendlyShowError(e && e.message ? e.message : 'Could not open dashboard.');
        });
        return;
      }
      if (!session && event === 'SIGNED_OUT') {
        if (
          window.UpwardAdmin &&
          typeof window.UpwardAdmin.isAdminLoginDocument === 'function' &&
          !window.UpwardAdmin.isAdminLoginDocument()
        ) {
          window.UpwardAdmin.redirectToLogin();
        } else {
          renderLogin({ signOut: true });
        }
        window.scrollTo(0, 0);
      }
    });
  }

  async function init() {
    var body = document.body;
    var app = getApp();
    if (!app) {
      console.error('[admin] #admin-app missing');
      return;
    }
    if (body) body.setAttribute('data-admin-init', 'pending');
    var pwRecoveryFromUrl = /type=recovery/.test(String(window.location.hash || ''));
    renderLoading();
    try {
      if (
        !window.UpwardSupabase ||
        typeof window.UpwardSupabase.isSupabaseConfigured !== 'function' ||
        typeof window.UpwardSupabase.getSupabase !== 'function'
      ) {
        friendlyShowError(
          'Admin could not start because js/supabase-client.js did not load or run. Check the Network tab for 404s on js files.'
        );
        return;
      }

      var a = api();
      if (!a.isSupabaseConfigured || !a.isSupabaseConfigured()) {
        friendlyShowError(
          'Open js/supabase-config.js and set SUPABASE_ANON_KEY to your publishable anon key (see js/supabase-config.example.js).'
        );
        return;
      }

      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        friendlyShowError(
          'The Supabase library did not load. Check your network or try again later.'
        );
        return;
      }

      console.log('Supabase loaded');

      client = a.getSupabase ? a.getSupabase() : null;
      if (!client) {
        friendlyShowError('Could not start Supabase client.');
        return;
      }

      subscribeAuth();

      console.log('Checking session');
      var sessRes;
      try {
        sessRes = await withTimeout(
          client.auth.getSession(),
          15000,
          'Session check timed out (15s). Your network, a browser extension, or a mismatched Supabase key can block auth. In Supabase → Settings → API, try the long "anon" / "public" JWT key if you are using a publishable key that fails here.'
        );
      } catch (e) {
        friendlyShowError(e && e.message ? e.message : 'Session check failed.');
        return;
      }

      if (sessRes.error) {
        friendlyShowError(sessRes.error.message || 'Could not verify session.');
        return;
      }

      if (sessRes.data && sessRes.data.session) {
        if (pwRecoveryFromUrl) {
          renderPasswordRecovery();
        } else {
          await routeAfterAuth();
        }
      } else {
        if (pwRecoveryFromUrl) {
          friendlyShowError(
            'This password reset link is invalid or has expired. Use “Send reset link” below with your email address.'
          );
        } else {
          if (
            window.UpwardAdmin &&
            typeof window.UpwardAdmin.isAdminLoginDocument === 'function' &&
            !window.UpwardAdmin.isAdminLoginDocument()
          ) {
            window.UpwardAdmin.redirectToLogin();
          } else {
            renderLogin();
          }
        }
      }
    } finally {
      if (body) body.setAttribute('data-admin-init', 'done');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init().catch(function (e) {
        friendlyShowError(e && e.message ? e.message : 'Unexpected error.');
      });
    });
  } else {
    init().catch(function (e) {
      friendlyShowError(e && e.message ? e.message : 'Unexpected error.');
    });
  }
})();
