/**
 * Legacy admin login script (use repo-root admin.html + admin.js as canonical).
 */
(function () {
  'use strict';

  if (typeof window !== 'undefined') {
    window.__UPWARD_ADMIN_LOGIN_SCRIPT_RAN = true;
  }

  var client = null;

  function $(id) {
    return document.getElementById(id);
  }

  function getApp() {
    return document.getElementById('admin-app');
  }

  function api() {
    return window.UpwardSupabase || {};
  }

  function assetPrefix() {
    var p = window.location && window.location.pathname ? window.location.pathname : '';
    return p.indexOf('/admin/') !== -1 ? '../' : '';
  }

  function getAdminAuthRedirectUrl() {
    if (window.UpwardAdmin && typeof window.UpwardAdmin.getAdminAuthRedirectUrl === 'function') {
      return window.UpwardAdmin.getAdminAuthRedirectUrl();
    }
    if (!window.location) return '';
    return String(window.location.origin + window.location.pathname.split('?')[0].split('#')[0]);
  }

  function clearWatchdogTimer() {
    if (window.__UPWARD_ADMIN_LOADING_WATCHDOG) {
      clearTimeout(window.__UPWARD_ADMIN_LOADING_WATCHDOG);
      window.__UPWARD_ADMIN_LOADING_WATCHDOG = null;
    }
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
      '<h1 class="mt-5 text-xl font-semibold text-[var(--text)]">Admin sign in</h1>' +
      '<p class="content-text mt-3 text-sm leading-relaxed">Teaching, team, calendar, and internal tools.</p>' +
      '</div>' +
      '<form id="adminLoginForm" class="mt-8 space-y-4 text-left">' +
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Email</span>' +
      '<input id="adminLoginEmail" type="email" name="email" autocomplete="username" required class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" /></label>' +
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Password</span>' +
      '<input id="adminLoginPassword" type="password" name="password" autocomplete="current-password" required class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" /></label>' +
      '<p id="adminLoginError" class="min-h-[1.25rem] text-sm content-text" role="alert" aria-live="polite"></p>' +
      '<button type="submit" id="adminLoginSubmit" class="w-full rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">Sign in</button>' +
      '</form>' +
      '<div class="mt-6 border-t border-[var(--border)] pt-6">' +
      '<p class="text-sm font-medium text-[var(--text)]">Forgot password?</p>' +
      '<p class="content-text mt-1 text-xs leading-relaxed">We will email a link to reset your password.</p>' +
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
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">New password</span>' +
      '<input id="adminRecoveryPassword" type="password" name="password" autocomplete="new-password" required minlength="8" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" /></label>' +
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Confirm new password</span>' +
      '<input id="adminRecoveryPassword2" type="password" name="password2" autocomplete="new-password" required minlength="8" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" /></label>' +
      '<p id="adminRecoveryError" class="min-h-[1.25rem] text-sm content-text" role="alert" aria-live="polite"></p>' +
      '<button type="submit" id="adminRecoverySubmit" class="w-full rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">Update password</button>' +
      '</form>' +
      '<p class="content-text mt-6 text-center text-xs leading-relaxed">' +
      '<button type="button" id="adminRecoveryCancel" class="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">Cancel and return to sign in</button>' +
      '</p></div></div>'
    );
  }

  function goDashboard() {
    window.location.href = 'dashboard.html';
  }

  function renderPasswordRecovery() {
    clearWatchdogTimer();
    var app = getApp();
    if (!app) return;
    app.className = 'min-h-screen';
    app.innerHTML = getPasswordRecoveryHtml(assetPrefix());
    bindPasswordRecovery();
  }

  function renderLogin() {
    clearWatchdogTimer();
    var app = getApp();
    if (!app) return;
    app.className = 'min-h-screen';
    app.innerHTML = getLoginHtml(assetPrefix());
    bindLogin();
  }

  function bindLogin() {
    var form = $('adminLoginForm');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var errEl = $('adminLoginError');
        var submit = $('adminLoginSubmit');
        if (errEl) errEl.textContent = '';
        if (submit) submit.disabled = true;
        try {
          var emailEl = $('adminLoginEmail');
          var passEl = $('adminLoginPassword');
          var email = emailEl && emailEl.value ? emailEl.value.trim() : '';
          var password = passEl ? passEl.value : '';
          if (!client) throw new Error('Not initialized.');
          var res = await client.auth.signInWithPassword({ email: email, password: password });
          if (res.error) throw res.error;
          goDashboard();
        } catch (e) {
          if (errEl) errEl.textContent = e && e.message ? e.message : 'Sign-in failed.';
        } finally {
          if (submit) submit.disabled = false;
        }
      });
    }
    var btn = $('adminForgotPasswordBtn');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', async function () {
        var emailEl = $('adminLoginEmail');
        var statusEl = $('adminForgotStatus');
        var email = emailEl && emailEl.value ? emailEl.value.trim() : '';
        if (statusEl) statusEl.textContent = '';
        if (!email) {
          if (statusEl) statusEl.textContent = 'Enter your email address above first.';
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
          if (statusEl) statusEl.textContent = e && e.message ? e.message : 'Could not send reset email.';
        } finally {
          btn.disabled = false;
        }
      });
    }
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
          goDashboard();
        } catch (e) {
          if (errEl) errEl.textContent = e && e.message ? e.message : 'Could not update password.';
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

  async function init() {
    var app = getApp();
    if (!app) return;
    document.body.setAttribute('data-admin-init', 'pending');
    var pwRecoveryFromUrl = /type=recovery/.test(String(window.location.hash || ''));
    if (
      !window.UpwardSupabase ||
      !window.UpwardSupabase.isSupabaseConfigured ||
      !window.UpwardSupabase.isSupabaseConfigured()
    ) {
      app.innerHTML =
        '<div class="p-8 text-center content-text text-sm">Configure js/supabase-config.js first.</div>';
      document.body.setAttribute('data-admin-init', 'done');
      return;
    }
    client = window.UpwardSupabase.getSupabase();
    if (!client) {
      app.innerHTML = '<div class="p-8 text-center text-sm">Could not start Supabase.</div>';
      document.body.setAttribute('data-admin-init', 'done');
      return;
    }
    var sess = await client.auth.getSession();
    if (sess.data && sess.data.session) {
      if (pwRecoveryFromUrl) renderPasswordRecovery();
      else goDashboard();
      document.body.setAttribute('data-admin-init', 'done');
      clearWatchdogTimer();
      return;
    }
    if (pwRecoveryFromUrl) {
      app.innerHTML =
        '<div class="p-8 text-center content-text text-sm">This reset link is invalid or expired.</div>';
    } else {
      renderLogin();
    }
    document.body.setAttribute('data-admin-init', 'done');
    clearWatchdogTimer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init().catch(function () {
        var app = getApp();
        if (app) app.innerHTML = '<div class="p-8 text-center text-sm">Could not start admin login.</div>';
      });
    });
  } else {
    init().catch(function () {});
  }
})();
