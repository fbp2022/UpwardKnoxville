/**
 * Stay Connected form: Cloudflare Turnstile + the Upward Worker (/api/connect).
 * The Worker checks Turnstile, saves the message in D1 and emails connect@upwardknoxville.org.
 */
(function () {
  'use strict';

  var CONNECT_FORM_BUILD = 'worker-v2';

  var CONTACT_FUNCTION_URL =
    (typeof window !== 'undefined' && window.UpwardApi ? window.UpwardApi.base : 'https://upward.aviationministries.workers.dev') + '/api/connect';

  var TURNSTILE_SITE_KEY = '0x4AAAAAADN7OcqDWcOH1TRM';
  var MIN_MESSAGE_LEN = 10;
  var turnstileWidgetId = null;

  function renderGroups() {
    var box = $('connectGroups');
    var list = $('connectGroupsList');
    if (!box || !list || typeof window === 'undefined' || !window.UpwardApi) return;
    window.UpwardApi.get('/api/public/groups').then(function (data) {
      var groups = (data && data.groups) || [];
      list.textContent = '';
      if (!groups.length) { box.hidden = true; return; }
      groups.forEach(function (g) {
        var label = document.createElement('label');
        label.className = 'flex cursor-pointer items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3';
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'groupIds';
        input.value = String(g.id);
        input.className = 'mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]';
        var text = document.createElement('span');
        text.className = 'min-w-0';
        var title = document.createElement('span');
        title.className = 'block text-sm font-medium text-[var(--text)]';
        title.textContent = g.name + (g.kind === 'team' ? ' (team)' : '');
        text.appendChild(title);
        if (g.description) {
          var d = document.createElement('span');
          d.className = 'mt-0.5 block text-sm leading-relaxed text-[var(--muted)]';
          d.textContent = g.description;
          text.appendChild(d);
        }
        label.appendChild(input);
        label.appendChild(text);
        list.appendChild(label);
      });
      box.hidden = false;
    }).catch(function () { box.hidden = true; });
  }

  function selectedGroupIds() {
    return Array.prototype.slice.call(document.querySelectorAll('#connectGroupsList input[name="groupIds"]:checked'))
      .map(function (el) { return Number(el.value); })
      .filter(function (n) { return n > 0; });
  }

  function $(id) {
    return document.getElementById(id);
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

    renderGroups();

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

        var groupIds = selectedGroupIds();
        if (groupIds.length && !isValidEmail(email)) {
          setStatus(statusEl, 'Please enter a valid email address to join a group.', true);
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
          groupIds: groupIds,
          turnstileToken: token,
        };

        try {
          var res = await fetch(CONTACT_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyObj),
          });

          console.log('[connect-form] response status', res.status);

          var data = {};
          try {
            data = await res.json();
          } catch (parseErr) {
            data = {};
            console.warn('[connect-form] Response was not JSON', parseErr);
          }

          console.log('[connect-form] response', data);

          if (!res.ok || !data || data.ok !== true) {
            var errMsg =
              data && typeof data.error === 'string' && data.error
                ? data.error
                : 'Something went wrong. Please try again.';
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
