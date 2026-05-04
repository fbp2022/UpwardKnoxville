(function () {
  var html = document.documentElement;
  try {
    var theme = localStorage.getItem('uk-theme');
    if (theme === 'dark') html.setAttribute('data-theme', 'dark');
    else if (theme === 'light') html.removeAttribute('data-theme');
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) html.setAttribute('data-theme', 'dark');

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
