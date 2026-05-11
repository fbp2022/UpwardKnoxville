/**
 * Admin UI — plain script for GitHub Pages (no ES modules, no esm.sh).
 * Requires: @supabase/supabase-js UMD (window.supabase.createClient) then js/admin-config.js
 */
(function () {
  'use strict';

  /** Set to false after confirming admin works (quiets [admin] console logs). */
  var ADMIN_DEBUG_LOGS = true;

  function log() {
    if (ADMIN_DEBUG_LOGS && typeof console !== 'undefined' && console.log) {
      console.log.apply(console, ['[admin]'].concat([].slice.call(arguments)));
    }
  }

  var STATE = {
    loading: 'state-loading',
    error: 'state-error',
    config: 'state-config',
    login: 'state-login',
    dashboard: 'state-dashboard',
  };

  var db = null;
  var currentRowId = null;
  var saving = false;
  var authSubscription = null;
  var eventsWired = false;

  function $(id) {
    return document.getElementById(id);
  }

  function showOnly(stateKey) {
    Object.keys(STATE).forEach(function (key) {
      var id = STATE[key];
      var el = $(id);
      if (el) el.hidden = id !== STATE[stateKey];
    });
  }

  function clearEditorStatus() {
    var s = $('adminEditorStatus');
    if (s) s.textContent = '';
  }

  function setFormBusy(busy) {
    var loading = $('adminEditorLoading');
    if (loading) loading.hidden = !busy;
    var form = $('adminTeachingForm');
    if (form) {
      var nodes = form.querySelectorAll('input, textarea, button');
      for (var i = 0; i < nodes.length; i++) nodes[i].disabled = busy;
    }
    var logoutBtn = $('adminLogoutBtn');
    if (logoutBtn) logoutBtn.disabled = busy;
  }

  function formatUpdatedAt(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
      return '';
    }
  }

  function emptyTeachingPayload() {
    var now = new Date().toISOString();
    return {
      current_book: '',
      current_chapter: '',
      current_verses: '',
      where_we_left_off: '',
      current_focus: '',
      public_note: '',
      updated_at: now,
    };
  }

  function fillForm(row) {
    var book = $('field-current-book');
    var chapter = $('field-current-chapter');
    var verses = $('field-current-verses');
    var where = $('field-where-we-left-off');
    var focus = $('field-current-focus');
    var note = $('field-public-note');
    var last = $('adminLastUpdated');

    if (!row) {
      currentRowId = null;
      if (book) book.value = '';
      if (chapter) chapter.value = '';
      if (verses) verses.value = '';
      if (where) where.value = '';
      if (focus) focus.value = '';
      if (note) note.value = '';
      if (last) last.textContent = '';
      return;
    }

    currentRowId = row.id != null ? row.id : null;
    if (book) book.value = row.current_book != null ? String(row.current_book) : '';
    if (chapter) chapter.value = row.current_chapter != null ? String(row.current_chapter) : '';
    if (verses) verses.value = row.current_verses != null ? String(row.current_verses) : '';
    if (where) where.value = row.where_we_left_off != null ? String(row.where_we_left_off) : '';
    if (focus) focus.value = row.current_focus != null ? String(row.current_focus) : '';
    if (note) note.value = row.public_note != null ? String(row.public_note) : '';
    if (last) {
      var formatted = formatUpdatedAt(row.updated_at);
      last.textContent = formatted ? 'Last updated: ' + formatted : '';
    }
  }

  function fetchLatestRow() {
    return db
      .from('teaching_status')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data;
      });
  }

  function ensureTeachingRowAndLoad() {
    clearEditorStatus();
    setFormBusy(true);
    var statusEl = $('adminEditorStatus');
    return fetchLatestRow()
      .then(function (row) {
        if (!row) {
          log('No teaching_status row; creating default');
          var payload = emptyTeachingPayload();
          return db
            .from('teaching_status')
            .insert(payload)
            .select('*')
            .single()
            .then(function (res) {
              if (res.error) throw res.error;
              return res.data;
            });
        }
        return row;
      })
      .then(function (row) {
        fillForm(row);
      })
      .catch(function (e) {
        console.error('[admin] ensureTeachingRowAndLoad', e);
        if (statusEl) {
          statusEl.textContent =
            'Something went wrong while loading. Please refresh and try again.';
        }
        fillForm(null);
      })
      .then(function () {
        setFormBusy(false);
      });
  }

  function collectPayload() {
    var now = new Date().toISOString();
    return {
      current_book: (($('field-current-book') && $('field-current-book').value) || '').trim(),
      current_chapter: (($('field-current-chapter') && $('field-current-chapter').value) || '').trim(),
      current_verses: (($('field-current-verses') && $('field-current-verses').value) || '').trim(),
      where_we_left_off: (($('field-where-we-left-off') && $('field-where-we-left-off').value) || '').trim(),
      current_focus: (($('field-current-focus') && $('field-current-focus').value) || '').trim(),
      public_note: (($('field-public-note') && $('field-public-note').value) || '').trim(),
      updated_at: now,
    };
  }

  function saveTeachingRow(ev) {
    ev.preventDefault();
    if (!db || saving) return;
    saving = true;
    clearEditorStatus();
    var saveBtn = $('adminSaveBtn');
    var statusEl = $('adminEditorStatus');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
    }

    var payload = collectPayload();
    var savePromise =
      currentRowId != null
        ? db.from('teaching_status').update(payload).eq('id', currentRowId)
        : db.from('teaching_status').insert(payload).select('id').single();

    savePromise
      .then(function (res) {
        if (res.error) throw res.error;
        if (currentRowId == null && res.data && res.data.id != null) currentRowId = res.data.id;
        if (statusEl) statusEl.textContent = 'Teaching status updated.';
        return ensureTeachingRowAndLoad();
      })
      .catch(function (e) {
        console.error('[admin] saveTeachingRow', e);
        if (statusEl) {
          statusEl.textContent = 'Something went wrong while saving. Please try again.';
        }
      })
      .then(function () {
        saving = false;
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save changes';
        }
      });
  }

  function onLogin(ev) {
    ev.preventDefault();
    if (!db) return;
    var errEl = $('adminLoginError');
    var submit = $('adminLoginSubmit');
    var emailEl = $('adminLoginEmail');
    var pwEl = $('adminLoginPassword');
    var email = (emailEl && emailEl.value.trim()) || '';
    var password = (pwEl && pwEl.value) || '';

    if (errEl) errEl.textContent = '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Signing in…';
    }

    db.auth
      .signInWithPassword({ email: email, password: password })
      .then(function (res) {
        if (res.error) throw res.error;
        if (pwEl) pwEl.value = '';
        return applySession(res.data && res.data.session ? res.data.session : null);
      })
      .catch(function (e) {
        console.error('[admin] signIn', e);
        if (errEl) {
          errEl.textContent = 'That email or password did not work. Please try again.';
        }
      })
      .then(function () {
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Sign in';
        }
      });
  }

  function onLogout() {
    if (!db) return;
    clearEditorStatus();
    db.auth
      .signOut()
      .catch(function (e) {
        console.error('[admin] signOut', e);
      })
      .then(function () {
        showOnly('login');
        log('Rendering login');
      });
  }

  function wireEvents() {
    if (eventsWired) return;
    eventsWired = true;
    var loginForm = $('adminLoginForm');
    var teachingForm = $('adminTeachingForm');
    var logoutBtn = $('adminLogoutBtn');
    if (loginForm) loginForm.addEventListener('submit', onLogin);
    if (teachingForm) teachingForm.addEventListener('submit', saveTeachingRow);
    if (logoutBtn) logoutBtn.addEventListener('click', onLogout);
  }

  function applySession(session) {
    if (session) {
      log('Session found');
      log('Rendering editor');
      showOnly('dashboard');
      return ensureTeachingRowAndLoad();
    }
    log('No session found');
    log('Rendering login');
    showOnly('login');
    return Promise.resolve();
  }

  function showFatalError(message) {
    showOnly('error');
    var text = $('state-error-text');
    if (text) text.textContent = message;
  }

  function createDbClient() {
    var cfg = window.__UPWARD_SUPABASE_CONFIG__;
    if (!cfg || !cfg.url) return null;
    var key = String(cfg.anonKey || '').trim();
    if (!key) return null;

    if (typeof window.supabase === 'undefined') {
      console.error('[admin] window.supabase is undefined — UMD script did not load');
      return null;
    }
    if (typeof window.supabase.createClient !== 'function') {
      console.error('[admin] window.supabase.createClient is not a function');
      return null;
    }

    log('window.supabase.createClient is available');
    return window.supabase.createClient(cfg.url.trim(), key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  function init() {
    log('Admin boot starting');

    if (typeof window.supabase === 'undefined') {
      console.error('[admin] window.supabase missing after UMD script');
      showFatalError(
        'We could not load the database library. Check your network connection or try again later.'
      );
      return;
    }
    log('Supabase script loaded (UMD)');

    if (!window.__UPWARD_SUPABASE_CONFIG__) {
      console.error('[admin] __UPWARD_SUPABASE_CONFIG__ missing — is js/admin-config.js deployed?');
      showOnly('config');
      return;
    }
    log('Admin config loaded');
    log('Project URL:', window.__UPWARD_SUPABASE_CONFIG__.url);
    log('Has publishable key:', !!String(window.__UPWARD_SUPABASE_CONFIG__.anonKey || '').trim());

    var keyOk = !!String(window.__UPWARD_SUPABASE_CONFIG__.anonKey || '').trim();
    if (!keyOk) {
      showOnly('config');
      return;
    }

    db = createDbClient();
    if (!db) {
      showFatalError('Could not initialize the database connection. Please try again.');
      return;
    }

    wireEvents();

    if (authSubscription && typeof authSubscription.unsubscribe === 'function') {
      try {
        authSubscription.unsubscribe();
      } catch (e) {}
      authSubscription = null;
    }

    log('Checking auth session');
    db.auth
      .getSession()
      .then(function (res) {
        if (res.error) throw res.error;
        var session = res.data && res.data.session ? res.data.session : null;
        return applySession(session);
      })
      .catch(function (e) {
        console.error('[admin] getSession', e);
        showFatalError('Could not verify your session. Please refresh and try again.');
      });

    var subResult = db.auth.onAuthStateChange(function (event, session) {
      if (event === 'INITIAL_SESSION') return;
      log('Auth state change:', event);
      if (session) {
        log('Session found');
        log('Rendering editor');
        showOnly('dashboard');
        ensureTeachingRowAndLoad().catch(function (e) {
          console.error('[admin] onAuthStateChange load', e);
        });
      } else {
        log('No session found');
        log('Rendering login');
        showOnly('login');
      }
    });
    authSubscription = subResult && subResult.data && subResult.data.subscription
      ? subResult.data.subscription
      : null;
  }

  function start() {
    try {
      init();
    } catch (e) {
      console.error('[admin] init fatal', e);
      showFatalError('Something went wrong during startup. Please refresh the page.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
