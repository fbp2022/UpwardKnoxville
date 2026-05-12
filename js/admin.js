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
  var dashboardMounted = false;

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
    dashboardMounted = false;
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
      '<p class="content-text mt-8 text-center text-xs leading-relaxed">' +
      '<a href="' +
      P +
      'index.html" class="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">← Back to site</a>' +
      '</p></div></div>'
    );
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

  async function initDashboardAfterAuth() {
    await Promise.all([
      loadTeachingEditor(),
      loadAnnouncementsAdmin(),
      loadBccList(),
      loadContactMessages(),
    ]);
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
    if (!form) return;
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
    } catch (e) {
      var msg = e && e.message ? e.message : 'Save failed.';
      if (status) status.textContent = msg;
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function bindDashboardOnce() {
    bindLogout();
    bindTeachingForm();
    bindAnnouncementForm();
    bindAnnouncementClear();
    bindAnnouncementList();
    bindBccForm();
    bindBccList();
    bindContactMessagesList();
  }

  function subscribeAuth() {
    if (authSubscribed || !client) return;
    authSubscribed = true;
    client.auth.onAuthStateChange(function (event, session) {
      if (event === 'INITIAL_SESSION') return;
      if (session && event === 'SIGNED_IN') {
        enterDashboard().catch(function (e) {
          friendlyShowError(e && e.message ? e.message : 'Could not open dashboard.');
        });
        return;
      }
      if (!session && event === 'SIGNED_OUT') {
        renderLogin({ signOut: true });
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
        await enterDashboard();
      } else {
        renderLogin();
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
