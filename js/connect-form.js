/**
 * Stay Connected form: Cloudflare Turnstile + Supabase Edge Function only.
 * No Formspree, no native form POST, no direct Supabase inserts from the browser.
 *
 * If the function returns "Missing authorization header", redeploy with JWT verification off:
 *   npx supabase functions deploy submit-contact-message --no-verify-jwt
 * (Project config should also set verify_jwt = false for this function.)
 */
(function () {
  'use strict';

  var CONNECT_FORM_BUILD = 'edge-v4';

  /** Pinned so production works even if __UPWARD_SUPABASE_URL__ is missing on a host. */
  var CONTACT_FUNCTION_URL =
    'https://okgsccnnmocvoddkspoj.supabase.co/functions/v1/submit-contact-message';

  var TURNSTILE_SITE_KEY = '0x4AAAAAADN7OcqDWcOH1TRM';
  var MIN_MESSAGE_LEN = 10;
  var turnstileWidgetId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function anonKey() {
    return typeof window !== 'undefined' && window.__UPWARD_SUPABASE_ANON_KEY__
      ? String(window.__UPWARD_SUPABASE_ANON_KEY__).trim()
      : '';
  }

  function resetTurnstile() {
    if (typeof window === 'undefined' || !window.turnstile || turnstileWidgetId == null) return;
    try {
      window.turnstile.reset(turnstileWidgetId);
    } catch (_) {}
  }

  function renderTurnstile() {
    var el = $('connectTurnstile');
    if (!el || typeof window === 'undefined' || !window.turnstile) return;
    el.innerHTML = '';
    try {
      turnstileWidgetId = window.turnstile.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'auto',
      });
    } catch (e) {
      console.error('[connect-form] Turnstile render failed', e);
    }
  }

  function setStatus(el, text, isError) {
    if (!el) return;
    el.textContent = text || '';
    el.classList.remove('text-red-600');
    if (isError) el.classList.add('text-red-600');
  }

  function isValidEmail(s) {
    var t = s != null ? String(s).trim() : '';
    if (!t || t.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  }

  function initForm() {
    var form = $('connectForm');
    var statusEl = $('connectStatus');
    var submitBtn = $('connectSubmitButton');
    if (!form || !statusEl || !submitBtn) return;

    console.log('[connect-form] Module loaded', CONNECT_FORM_BUILD);

    var defaultButtonLabel = submitBtn.textContent;
    var isSubmitting = false;

    function waitTurnstileReady(cb, attempts) {
      var n = attempts != null ? attempts : 80;
      if (typeof window !== 'undefined' && window.turnstile) {
        cb();
        return;
      }
      if (n <= 0) {
        setStatus(
          statusEl,
          'Could not load verification. Disable blockers or try again in a moment.',
          true
        );
        console.warn('[connect-form] Turnstile API did not load in time');
        return;
      }
      setTimeout(function () {
        waitTurnstileReady(cb, n - 1);
      }, 100);
    }

    waitTurnstileReady(renderTurnstile);

    form.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        console.log('Contact form submit handler started');

        if (isSubmitting) return;

        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        var key = anonKey();
        if (!key) {
          setStatus(
            statusEl,
            'This form is not configured yet. Please try email instead.',
            true
          );
          console.warn('[connect-form] Missing __UPWARD_SUPABASE_ANON_KEY__ (js/supabase-config.js)');
          return;
        }

        var nameEl = $('connectName');
        var emailEl = $('connectEmail');
        var messageEl = $('connectMessage');
        var name = nameEl && nameEl.value != null ? String(nameEl.value).trim() : '';
        var email = emailEl && emailEl.value != null ? String(emailEl.value).trim() : '';
        var message = messageEl && messageEl.value != null ? String(messageEl.value).trim() : '';

        var addToUpdateList =
          typeof readConnectUpdateListOn === 'function' ? !!readConnectUpdateListOn() : false;
        var isPrayerRequest =
          typeof readConnectPrayerSwitchOn === 'function' ? !!readConnectPrayerSwitchOn() : false;

        setStatus(statusEl, '', false);

        if (!message) {
          setStatus(statusEl, 'Please enter a message.', true);
          return;
        }
        if (message.length < MIN_MESSAGE_LEN) {
          setStatus(statusEl, 'Please write a bit more (at least ' + MIN_MESSAGE_LEN + ' characters).', true);
          return;
        }

        if (addToUpdateList && !isValidEmail(email)) {
          setStatus(statusEl, 'Please enter a valid email address to join the update list.', true);
          return;
        }

        if (!addToUpdateList && email && !isValidEmail(email)) {
          setStatus(statusEl, 'Please enter a valid email address.', true);
          return;
        }

        var token = '';
        if (typeof window !== 'undefined' && window.turnstile && turnstileWidgetId != null) {
          try {
            token = window.turnstile.getResponse(turnstileWidgetId) || '';
          } catch (_) {
            token = '';
          }
        }

        console.log('[connect-form] Turnstile token present:', Boolean(token && String(token).length > 0));

        if (!token) {
          setStatus(statusEl, 'Please complete the verification challenge before sending.', true);
          return;
        }

        isSubmitting = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';

        var bodyObj = {
          name: name,
          email: email,
          message: message,
          isPrayerRequest: isPrayerRequest,
          addToUpdateList: addToUpdateList,
          turnstileToken: token,
        };

        try {
          var res = await fetch(CONTACT_FUNCTION_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: key,
              Authorization: 'Bearer ' + key,
            },
            body: JSON.stringify(bodyObj),
          });

          console.log('Edge Function response status', res.status);

          var data = {};
          try {
            data = await res.json();
          } catch (parseErr) {
            data = {};
            console.warn('[connect-form] Response was not JSON', parseErr);
          }

          console.log('Edge Function JSON response', data);

          if (!res.ok || !data || data.ok !== true) {
            var errMsg =
              data && typeof data.error === 'string' && data.error
                ? data.error
                : 'Something went wrong. Please try again.';
            if (res.status === 401 && typeof errMsg === 'string' && errMsg.toLowerCase().indexOf('authorization') !== -1) {
              errMsg +=
                ' If this persists, redeploy the function with: npx supabase functions deploy submit-contact-message --no-verify-jwt';
            }
            throw new Error(errMsg);
          }

          var okMsg = 'Thank you for reaching out. Your message has been received.';
          if (data && typeof data.warning === 'string' && data.warning) {
            okMsg += ' ' + data.warning;
          }
          setStatus(statusEl, okMsg, false);
          form.reset();
          var prayerSwitch = $('connectPrayerSwitch');
          if (prayerSwitch) {
            prayerSwitch.setAttribute('aria-checked', 'false');
            prayerSwitch.setAttribute('data-prayer-request', 'false');
          }
          var updateSwitch = $('connectUpdateListSwitch');
          if (updateSwitch) {
            updateSwitch.setAttribute('aria-checked', 'false');
            updateSwitch.setAttribute('data-update-list', 'false');
          }
          resetTurnstile();
        } catch (err) {
          var msg = err && err.message ? String(err.message) : 'Please try again later.';
          setStatus(statusEl, msg, true);
          console.error('[connect-form] Submit failed', err);
          resetTurnstile();
        } finally {
          isSubmitting = false;
          submitBtn.disabled = false;
          submitBtn.textContent = defaultButtonLabel;
        }
      },
      true
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForm);
  } else {
    initForm();
  }
})();
