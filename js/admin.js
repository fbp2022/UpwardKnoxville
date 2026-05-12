/**
 * Admin controller — vanilla JS. Expects Supabase UMD + window.UpwardSupabase (from supabase-client.js).
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

  function $(id) {
    return document.getElementById(id);
  }

  function api() {
    return typeof window !== 'undefined' && window.UpwardSupabase ? window.UpwardSupabase : {};
  }

  function showView(name) {
    if (typeof window !== 'undefined' && window.__UPWARD_ADMIN_LOADING_WATCHDOG) {
      clearTimeout(window.__UPWARD_ADMIN_LOADING_WATCHDOG);
      window.__UPWARD_ADMIN_LOADING_WATCHDOG = null;
    }
    var ids = ['state-login', 'state-dashboard'];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el) el.hidden = ids[i] !== 'state-' + name;
    }
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
    var b = $('adminPageBanner');
    if (b) {
      b.textContent = msg || 'Please try again in a moment.';
      b.hidden = false;
    }
    showView('login');
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
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
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
      var created = row && row.created_at ? new Date(row.created_at) : null;
      var dateStr =
        created && !isNaN(created.getTime())
          ? created.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
          : '';

      var li = document.createElement('li');
      li.className = 'rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4';
      li.innerHTML =
        '<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">' +
        '<div class="min-w-0 flex-1">' +
        '<p class="font-semibold text-[var(--text)]">' +
        escapeHtml(title) +
        '</p>' +
        '<p class="mt-1 text-xs text-[var(--muted)]">' +
        escapeHtml(dateStr) +
        '</p>' +
        '<p class="content-text mt-2 text-sm leading-relaxed">' +
        escapeHtml(previewBody(body, 140)) +
        '</p>' +
        '</div>' +
        '<div class="shrink-0 sm:ml-3">' +
        '<button type="button" class="rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface)]" data-announcement-delete="' +
        escapeHtml(id) +
        '">Delete</button>' +
        '</div>' +
        '</div>';
      list.appendChild(li);
    }
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
        .from('site_announcements')
        .select('id,title,body,created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (sel.error) throw sel.error;
      renderAnnouncementRows(sel.data || []);
    } catch (e) {
      var msg = e && e.message ? e.message : 'Could not load announcements.';
      setAnnouncementsStatus(msg);
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
        var title = titleEl && titleEl.value != null ? String(titleEl.value).trim() : '';
        var body = bodyEl && bodyEl.value != null ? String(bodyEl.value).trim() : '';
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
          var ins = await client.from('site_announcements').insert([{ title: title, body: body }]).select('id');
          if (ins.error) throw ins.error;
          if (titleEl) titleEl.value = '';
          if (bodyEl) bodyEl.value = '';
          setAnnouncementsStatus('Posted.');
          await loadAnnouncementsAdmin();
        } catch (e) {
          var msg = e && e.message ? e.message : 'Post failed.';
          setAnnouncementsStatus(msg);
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
  }

  function bindAnnouncementList() {
    var list = $('adminAnnouncementsList');
    if (list && !list.dataset.bound) {
      list.dataset.bound = '1';
      list.addEventListener('click', async function (ev) {
        var raw = ev.target;
        var t = raw && raw.closest ? raw.closest('[data-announcement-delete]') : null;
        if (!t || !t.getAttribute) return;
        var delId = t.getAttribute('data-announcement-delete');
        if (!delId) return;
        ev.preventDefault();
        if (!client) {
          setAnnouncementsStatus('Not connected.');
          return;
        }
        if (!window.confirm('Delete this announcement?')) return;
        setAnnouncementsStatus('');
        t.disabled = true;
        try {
          var res = await client.from('site_announcements').delete().eq('id', delId);
          if (res.error) throw res.error;
          setAnnouncementsStatus('Deleted.');
          await loadAnnouncementsAdmin();
        } catch (e) {
          var msg = e && e.message ? e.message : 'Delete failed.';
          setAnnouncementsStatus(msg);
        } finally {
          t.disabled = false;
        }
      });
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

  async function openDashboard() {
    console.log('Rendering dashboard');
    clearPageBanner();
    showView('dashboard');
    bindLogout();
    bindTeachingForm();
    bindAnnouncementForm();
    bindAnnouncementList();
    await Promise.all([loadTeachingEditor(), loadAnnouncementsAdmin()]);
  }

  function subscribeAuth() {
    if (authSubscribed || !client) return;
    authSubscribed = true;
    client.auth.onAuthStateChange(function (event, session) {
      if (event === 'INITIAL_SESSION') return;
      if (session) {
        openDashboard();
      } else {
        console.log('Rendering login');
        currentRowId = null;
        clearPageBanner();
        showView('login');
      }
    });
  }

  async function init() {
    var body = document.body;
    if (body) body.setAttribute('data-admin-init', 'pending');
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

      bindLogin();
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
        await openDashboard();
      } else {
        console.log('Rendering login');
        clearPageBanner();
        showView('login');
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
