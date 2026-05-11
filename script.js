/* =========================
   MOBILE MENU
========================= */
const menuButton = document.getElementById('menuButton');
const menu = document.getElementById('menu');

if (menuButton && menu) {
  menuButton.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 1024) {
        menu.classList.remove('is-open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', 'Open menu');
      }
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
      menu.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open menu');
    }
  });
}

/* =========================
   FOOTER YEAR (optional)
========================= */
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

/* =========================
   FAQ ACCORDION
========================= */
function initFaqAccordion() {
  document.querySelectorAll('[data-faq-item]').forEach((item) => {
    const button = item.querySelector('[data-faq-question]');
    const answer = item.querySelector('[data-faq-answer]');
    if (!button || !answer) return;
    const isOpen = item.classList.contains('is-open');
    button.setAttribute('aria-expanded', String(isOpen));
    answer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  });

  document.querySelectorAll('[data-faq-question]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.closest('[data-faq-item]');
      const answer = item?.querySelector('[data-faq-answer]');
      if (!item || !answer) return;

      const expanded = button.getAttribute('aria-expanded') === 'true';
      const next = !expanded;
      button.setAttribute('aria-expanded', String(next));
      item.classList.toggle('is-open', next);
      answer.setAttribute('aria-hidden', next ? 'false' : 'true');
    });
  });
}

initFaqAccordion();

/* =========================
   ACCESSIBILITY / SETTINGS WIDGET
   Persists via localStorage keys read by theme-init.js:
     uk-theme, uk-reduce-motion, uk-text-large, uk-high-contrast
========================= */
(function buildAccessibilityWidget() {
  if (document.querySelector('[data-a11y-widget]')) return;

  const html = document.documentElement;

  const widget = document.createElement('div');
  widget.className = 'a11y-widget';
  widget.setAttribute('data-a11y-widget', '');
  widget.innerHTML = `
    <div id="a11yPanel" class="a11y-panel" role="dialog" aria-labelledby="a11yPanelTitle" hidden>
      <h2 id="a11yPanelTitle" class="a11y-panel-title">Accessibility</h2>
      <div class="a11y-row">
        <span id="a11y-l-dark" class="a11y-row-label">Dark mode</span>
        <button type="button" class="a11y-switch" role="switch" aria-checked="false" aria-labelledby="a11y-l-dark" data-a11y-switch="dark">
          <span class="a11y-switch-thumb" aria-hidden="true"></span>
        </button>
      </div>
      <div class="a11y-row">
        <span id="a11y-l-motion" class="a11y-row-label">Reduce motion</span>
        <button type="button" class="a11y-switch" role="switch" aria-checked="false" aria-labelledby="a11y-l-motion" data-a11y-switch="reduce-motion">
          <span class="a11y-switch-thumb" aria-hidden="true"></span>
        </button>
      </div>
      <div class="a11y-row">
        <span id="a11y-l-text" class="a11y-row-label">Larger text</span>
        <button type="button" class="a11y-switch" role="switch" aria-checked="false" aria-labelledby="a11y-l-text" data-a11y-switch="text-large">
          <span class="a11y-switch-thumb" aria-hidden="true"></span>
        </button>
      </div>
      <div class="a11y-row">
        <span id="a11y-l-hc" class="a11y-row-label">High contrast</span>
        <button type="button" class="a11y-switch" role="switch" aria-checked="false" aria-labelledby="a11y-l-hc" data-a11y-switch="high-contrast">
          <span class="a11y-switch-thumb" aria-hidden="true"></span>
        </button>
      </div>
    </div>
    <button type="button" class="a11y-toggle" aria-label="Open accessibility settings" aria-expanded="false" aria-controls="a11yPanel">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="4.5" r="1.6"></circle>
        <path d="M3.5 8.5h17"></path>
        <path d="M9.5 8.5l-1.2 11"></path>
        <path d="M14.5 8.5l1.2 11"></path>
        <path d="M9 13.5h6"></path>
      </svg>
    </button>
  `;
  document.body.appendChild(widget);

  const toggle = widget.querySelector('.a11y-toggle');
  const panel = widget.querySelector('.a11y-panel');

  toggle.addEventListener('click', () => {
    const isHidden = panel.hasAttribute('hidden');
    if (isHidden) {
      panel.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      panel.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('click', (event) => {
    if (panel.hasAttribute('hidden')) return;
    if (widget.contains(event.target)) return;
    panel.setAttribute('hidden', '');
    toggle.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hasAttribute('hidden')) {
      panel.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });

  function readPref(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function writePref(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) {
      /* ignore */
    }
  }

  const switches = {
    dark: {
      el: widget.querySelector('[data-a11y-switch="dark"]'),
      isActive: () => html.getAttribute('data-theme') === 'dark',
      apply: (on) => {
        if (on) html.setAttribute('data-theme', 'dark');
        else html.removeAttribute('data-theme');
        writePref('uk-theme', on ? 'dark' : 'light');
      },
    },
    'reduce-motion': {
      el: widget.querySelector('[data-a11y-switch="reduce-motion"]'),
      isActive: () => html.getAttribute('data-reduce-motion') === 'true',
      apply: (on) => {
        html.setAttribute('data-reduce-motion', on ? 'true' : 'false');
        writePref('uk-reduce-motion', on ? '1' : '0');
      },
    },
    'text-large': {
      el: widget.querySelector('[data-a11y-switch="text-large"]'),
      isActive: () => html.getAttribute('data-text-large') === 'true',
      apply: (on) => {
        if (on) html.setAttribute('data-text-large', 'true');
        else html.removeAttribute('data-text-large');
        writePref('uk-text-large', on ? '1' : '0');
      },
    },
    'high-contrast': {
      el: widget.querySelector('[data-a11y-switch="high-contrast"]'),
      isActive: () => html.getAttribute('data-high-contrast') === 'true',
      apply: (on) => {
        if (on) html.setAttribute('data-high-contrast', 'true');
        else html.removeAttribute('data-high-contrast');
        writePref('uk-high-contrast', on ? '1' : '0');
      },
    },
  };

  function syncSwitchUi(key) {
    const opt = switches[key];
    if (!opt?.el) return;
    const on = opt.isActive();
    opt.el.setAttribute('aria-checked', String(on));
  }

  Object.keys(switches).forEach((key) => {
    const opt = switches[key];
    if (!opt.el) return;
    syncSwitchUi(key);
    opt.el.addEventListener('click', () => {
      const on = opt.isActive();
      opt.apply(!on);
      syncSwitchUi(key);
    });
  });
})();

/* =========================
   CONNECT FORM: OPTIONAL PRAYER-REQUEST SWITCH
========================= */
function setConnectPrayerSwitchState(sw, on) {
  sw.setAttribute('aria-checked', on ? 'true' : 'false');
  sw.setAttribute('data-prayer-request', on ? 'true' : 'false');
}

function readConnectPrayerSwitchOn() {
  const sw = document.getElementById('connectPrayerSwitch');
  if (!sw) return false;
  if (sw.getAttribute('aria-checked') === 'true') return true;
  return sw.getAttribute('data-prayer-request') === 'true';
}

function wireConnectPrayerSwitch() {
  const sw = document.getElementById('connectPrayerSwitch');
  if (!sw) return;
  setConnectPrayerSwitchState(sw, sw.getAttribute('aria-checked') === 'true');
  sw.addEventListener('click', () => {
    setConnectPrayerSwitchState(sw, !readConnectPrayerSwitchOn());
  });
}

wireConnectPrayerSwitch();

/* =========================
   CONNECT FORM SUBMISSION
========================= */
const connectForm = document.getElementById('connectForm');
const connectStatus = document.getElementById('connectStatus');
const connectSubmitButton = document.getElementById('connectSubmitButton');

if (connectForm && connectStatus && connectSubmitButton) {
  const defaultButtonLabel = connectSubmitButton.textContent;
  let isSubmitting = false;

  connectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!connectForm.checkValidity()) {
      connectForm.reportValidity();
      return;
    }

    isSubmitting = true;
    connectSubmitButton.disabled = true;
    connectSubmitButton.textContent = 'Sending...';
    connectStatus.textContent = '';

    try {
      const formData = new FormData(connectForm);
      const prayerSwitch = document.getElementById('connectPrayerSwitch');
      const isPrayer = readConnectPrayerSwitchOn();

      formData.delete('prayer_request');
      formData.append('prayer_request', isPrayer ? 'Yes' : 'No');

      if (!formData.has('_captcha')) {
        formData.append('_captcha', 'false');
      }

      const response = await fetch('https://formsubmit.co/ajax/connect@upwardknoxville.org', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success !== 'true') {
        throw new Error('Form submission failed.');
      }

      connectStatus.textContent = 'Thank you for reaching out. Your message has been received.';
      connectForm.reset();
      if (prayerSwitch) setConnectPrayerSwitchState(prayerSwitch, false);
    } catch (error) {
      connectStatus.textContent = 'Something went wrong while sending your message. Please try again later.';
    } finally {
      isSubmitting = false;
      connectSubmitButton.disabled = false;
      connectSubmitButton.textContent = defaultButtonLabel;
    }
  });
}
