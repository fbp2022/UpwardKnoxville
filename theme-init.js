(function () {
  var html = document.documentElement;
  try {
    var theme = localStorage.getItem('uk-theme');
    /* Default is light. Dark only when the user has chosen it (persisted). */
    if (theme === 'dark') html.setAttribute('data-theme', 'dark');
    else html.removeAttribute('data-theme');

    var rm = localStorage.getItem('uk-reduce-motion');
    if (rm === '1') html.setAttribute('data-reduce-motion', 'true');
    else if (rm === '0') html.setAttribute('data-reduce-motion', 'false');
    else if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) html.setAttribute('data-reduce-motion', 'true');

    if (localStorage.getItem('uk-text-large') === '1') html.setAttribute('data-text-large', 'true');
    if (localStorage.getItem('uk-high-contrast') === '1') html.setAttribute('data-high-contrast', 'true');
  } catch (e) {
    /* ignore */
  }
})();
