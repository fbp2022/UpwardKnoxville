/**
 * Admin controller — vanilla JS. Expects Supabase UMD + window.UpwardSupabase (from supabase-client.js).
 */
(function () {
  'use strict';

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
    var ids = ['state-loading', 'state-error', 'state-config', 'state-login', 'state-dashboard'];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el) el.hidden = ids[i] !== 'state-' + name;
    }
  }

  function setErrorMessage(msg) {
    var t = $('state-error-text');
    if (t) t.textContent = msg || 'Please try again in a moment.';
  }

  function friendlyShowError(msg) {
    setErrorMessage(msg);
    showView('error');
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
      var row = await ensureTeachingRow();
      currentRowId = row && row.id != null ? row.id : null;
      if (!currentRowId) throw new Error('Could not load teaching status.');
      fillForm(row);
      setLastUpdated(row);
    } catch (e) {
      var msg = e && e.message ? e.message : 'Could not load teaching status.';
      if (status) status.textContent = msg;
      friendlyShowError(msg);
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
    showView('dashboard');
    bindLogout();
    bindTeachingForm();
    await loadTeachingEditor();
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
        showView('login');
      }
    });
  }

  async function init() {
    showView('loading');

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
      showView('config');
      return;
    }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      setErrorMessage('The Supabase library did not load. Check your network or try again later.');
      showView('error');
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
    var sessRes = await client.auth.getSession();
    if (sessRes.error) {
      friendlyShowError(sessRes.error.message || 'Could not verify session.');
      return;
    }

    if (sessRes.data && sessRes.data.session) {
      await openDashboard();
    } else {
      console.log('Rendering login');
      showView('login');
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
