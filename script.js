const menuButton = document.getElementById('menuButton');
const menu = document.getElementById('menu');

if (menuButton && menu) {
  menuButton.addEventListener('click', () => {
    menu.classList.toggle('hidden');
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        menu.classList.add('hidden');
        document.querySelectorAll('[data-nav-dropdown]').forEach((d) => {
          d.classList.remove('is-open');
        });
        document.querySelectorAll('[data-nav-dropdown-trigger]').forEach((t) => {
          t.setAttribute('aria-expanded', 'false');
        });
      }
    });
  });
}

(function initNavDropdowns() {
  const mq = window.matchMedia('(max-width: 767px)');
  document.querySelectorAll('[data-nav-dropdown-trigger]').forEach((trigger) => {
    const wrap = trigger.closest('[data-nav-dropdown]');
    if (!wrap) return;
    trigger.addEventListener('click', (e) => {
      if (!mq.matches) return;
      e.preventDefault();
      const willOpen = !wrap.classList.contains('is-open');
      document.querySelectorAll('[data-nav-dropdown].is-open').forEach((el) => {
        if (el !== wrap) {
          el.classList.remove('is-open');
          el.querySelector('[data-nav-dropdown-trigger]')?.setAttribute('aria-expanded', 'false');
        }
      });
      wrap.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', String(willOpen));
    });
  });

  document.addEventListener('click', (e) => {
    if (!mq.matches) return;
    if (e.target.closest('[data-nav-dropdown]')) return;
    document.querySelectorAll('[data-nav-dropdown].is-open').forEach((wrap) => {
      wrap.classList.remove('is-open');
      wrap.querySelector('[data-nav-dropdown-trigger]')?.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('[data-nav-dropdown].is-open').forEach((wrap) => {
      wrap.classList.remove('is-open');
      wrap.querySelector('[data-nav-dropdown-trigger]')?.setAttribute('aria-expanded', 'false');
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      document.querySelectorAll('[data-nav-dropdown].is-open').forEach((wrap) => {
        wrap.classList.remove('is-open');
        wrap.querySelector('[data-nav-dropdown-trigger]')?.setAttribute('aria-expanded', 'false');
      });
    }
  });
})();

const year = document.getElementById('year');
if (year) {
  year.textContent = new Date().getFullYear();
}

(function mountA11yWidget() {
  if (document.getElementById('a11yWidgetRoot')) return;

  const root = document.createElement('div');
  root.id = 'a11yWidgetRoot';
  root.className = 'a11y-widget';
  root.innerHTML =
    '<button type="button" class="a11y-widget-toggle" id="a11yWidgetFab" aria-expanded="false" aria-controls="a11yWidgetPanel" title="Accessibility options">' +
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />' +
    '</svg></button>' +
    '<div class="a11y-panel" id="a11yWidgetPanel" role="region" aria-label="Accessibility options" hidden>' +
    '<div class="a11y-panel-title">Display</div>' +
    '<div class="a11y-row"><span class="a11y-label" id="a11y-l-dark">Dark mode</span><button type="button" class="a11y-switch" id="a11yDark" role="switch" aria-checked="false" aria-labelledby="a11y-l-dark"><span class="a11y-switch-thumb"></span></button></div>' +
    '<div class="a11y-row"><span class="a11y-label" id="a11y-l-text">Larger text</span><button type="button" class="a11y-switch" id="a11yText" role="switch" aria-checked="false" aria-labelledby="a11y-l-text"><span class="a11y-switch-thumb"></span></button></div>' +
    '<div class="a11y-row"><span class="a11y-label" id="a11y-l-motion">Reduce motion</span><button type="button" class="a11y-switch" id="a11yMotion" role="switch" aria-checked="false" aria-labelledby="a11y-l-motion"><span class="a11y-switch-thumb"></span></button></div>' +
    '<div class="a11y-row"><span class="a11y-label" id="a11y-l-hc">High contrast</span><button type="button" class="a11y-switch" id="a11yHc" role="switch" aria-checked="false" aria-labelledby="a11y-l-hc"><span class="a11y-switch-thumb"></span></button></div>' +
    '</div>';

  document.body.appendChild(root);

  const html = document.documentElement;
  const fab = root.querySelector('#a11yWidgetFab');
  const panel = root.querySelector('#a11yWidgetPanel');
  const btnDark = root.querySelector('#a11yDark');
  const btnText = root.querySelector('#a11yText');
  const btnMotion = root.querySelector('#a11yMotion');
  const btnHc = root.querySelector('#a11yHc');

  function syncSwitchesFromDom() {
    btnDark.setAttribute('aria-checked', html.getAttribute('data-theme') === 'dark' ? 'true' : 'false');
    btnText.setAttribute('aria-checked', html.hasAttribute('data-text-large') ? 'true' : 'false');
    const rm =
      html.getAttribute('data-reduce-motion') === 'true' ||
      (html.getAttribute('data-reduce-motion') !== 'false' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    btnMotion.setAttribute('aria-checked', rm ? 'true' : 'false');
    btnHc.setAttribute('aria-checked', html.getAttribute('data-high-contrast') === 'true' ? 'true' : 'false');
  }

  syncSwitchesFromDom();

  function setPanelOpen(open) {
    root.classList.toggle('is-open', open);
    fab.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  }

  fab.addEventListener('click', () => {
    setPanelOpen(!root.classList.contains('is-open'));
    syncSwitchesFromDom();
  });

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) setPanelOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setPanelOpen(false);
  });

  btnDark.addEventListener('click', () => {
    const on = html.getAttribute('data-theme') === 'dark';
    if (on) {
      html.removeAttribute('data-theme');
      try {
        localStorage.setItem('uk-theme', 'light');
      } catch (err) {
        /* ignore */
      }
    } else {
      html.setAttribute('data-theme', 'dark');
      try {
        localStorage.setItem('uk-theme', 'dark');
      } catch (err2) {
        /* ignore */
      }
    }
    btnDark.setAttribute('aria-checked', (!on).toString());
  });

  btnText.addEventListener('click', () => {
    const on = html.hasAttribute('data-text-large');
    if (on) {
      html.removeAttribute('data-text-large');
      try {
        localStorage.removeItem('uk-text-large');
      } catch (err) {
        /* ignore */
      }
    } else {
      html.setAttribute('data-text-large', 'true');
      try {
        localStorage.setItem('uk-text-large', '1');
      } catch (err2) {
        /* ignore */
      }
    }
    btnText.setAttribute('aria-checked', (!on).toString());
  });

  btnMotion.addEventListener('click', () => {
    const cur = html.getAttribute('data-reduce-motion');
    const prefers = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let nextOn;
    if (cur === 'true') nextOn = false;
    else if (cur === 'false') nextOn = true;
    else nextOn = !prefers;

    if (nextOn) {
      html.setAttribute('data-reduce-motion', 'true');
      try {
        localStorage.setItem('uk-reduce-motion', '1');
      } catch (err) {
        /* ignore */
      }
    } else {
      html.setAttribute('data-reduce-motion', 'false');
      try {
        localStorage.setItem('uk-reduce-motion', '0');
      } catch (err2) {
        /* ignore */
      }
    }
    btnMotion.setAttribute('aria-checked', String(nextOn));
  });

  btnHc.addEventListener('click', () => {
    const on = html.getAttribute('data-high-contrast') === 'true';
    if (on) {
      html.removeAttribute('data-high-contrast');
      try {
        localStorage.removeItem('uk-high-contrast');
      } catch (err) {
        /* ignore */
      }
    } else {
      html.setAttribute('data-high-contrast', 'true');
      try {
        localStorage.setItem('uk-high-contrast', '1');
      } catch (err2) {
        /* ignore */
      }
    }
    btnHc.setAttribute('aria-checked', (!on).toString());
  });
})();
