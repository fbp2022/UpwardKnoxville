/* =========================
   MOBILE MENU
========================= */
const menuButton = document.getElementById('menuButton');
const menu = document.getElementById('menu');

if (menuButton && menu) {
  menuButton.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 960) {
        menu.classList.remove('is-open');
        menuButton.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

/* =========================
   FOOTER YEAR
========================= */
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

/* =========================
   FAQ ACCORDION
========================= */
document.querySelectorAll('[data-faq-question]').forEach((button) => {
  button.addEventListener('click', () => {
    const item = button.closest('[data-faq-item]');
    if (!item) return;

    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    item.classList.toggle('is-open', !expanded);
  });
});

/* =========================
   ACCESSIBILITY / SETTINGS WIDGET
   Persists user preferences via localStorage keys read by theme-init.js:
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
      <label class="a11y-option">
        <span>Dark mode</span>
        <input type="checkbox" data-a11y-option="dark" />
      </label>
      <label class="a11y-option">
        <span>Reduce motion</span>
        <input type="checkbox" data-a11y-option="reduce-motion" />
      </label>
      <label class="a11y-option">
        <span>Larger text</span>
        <input type="checkbox" data-a11y-option="text-large" />
      </label>
      <label class="a11y-option">
        <span>High contrast</span>
        <input type="checkbox" data-a11y-option="high-contrast" />
      </label>
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
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writePref(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { /* ignore */ }
  }

  const options = {
    dark: {
      input: widget.querySelector('[data-a11y-option="dark"]'),
      isActive: () => html.getAttribute('data-theme') === 'dark',
      apply: (on) => {
        if (on) html.setAttribute('data-theme', 'dark');
        else html.removeAttribute('data-theme');
        writePref('uk-theme', on ? 'dark' : 'light');
      },
    },
    'reduce-motion': {
      input: widget.querySelector('[data-a11y-option="reduce-motion"]'),
      isActive: () => html.getAttribute('data-reduce-motion') === 'true',
      apply: (on) => {
        html.setAttribute('data-reduce-motion', on ? 'true' : 'false');
        writePref('uk-reduce-motion', on ? '1' : '0');
      },
    },
    'text-large': {
      input: widget.querySelector('[data-a11y-option="text-large"]'),
      isActive: () => html.getAttribute('data-text-large') === 'true',
      apply: (on) => {
        if (on) html.setAttribute('data-text-large', 'true');
        else html.removeAttribute('data-text-large');
        writePref('uk-text-large', on ? '1' : '0');
      },
    },
    'high-contrast': {
      input: widget.querySelector('[data-a11y-option="high-contrast"]'),
      isActive: () => html.getAttribute('data-high-contrast') === 'true',
      apply: (on) => {
        if (on) html.setAttribute('data-high-contrast', 'true');
        else html.removeAttribute('data-high-contrast');
        writePref('uk-high-contrast', on ? '1' : '0');
      },
    },
  };

  Object.values(options).forEach((opt) => {
    if (!opt.input) return;
    opt.input.checked = opt.isActive();
    opt.input.addEventListener('change', (e) => {
      opt.apply(e.target.checked);
    });
  });
})();

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
      const isOptedIn = formData.get('updates_opt_in') === 'on';
      formData.set(
        'updates_opt_in',
        isOptedIn
          ? 'Yes - subscribed to Upward Knoxville updates.'
          : 'No - did not subscribe to Upward Knoxville updates.'
      );

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
    } catch (error) {
      connectStatus.textContent = 'Something went wrong while sending your message. Please try again later.';
    } finally {
      isSubmitting = false;
      connectSubmitButton.disabled = false;
      connectSubmitButton.textContent = defaultButtonLabel;
    }
  });
}
