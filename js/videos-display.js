/**
 * YouTube videos from the Upward Worker (/api/public/videos), managed in the admin's Videos tab.
 *   [data-videos-root]           Teachings page: Spotlight player + list of videos (tap one to play it)
 *   [data-video-spotlight-root]  Home page: just the Spotlight player; its section stays hidden until there is a video
 * The YouTube player only loads after a tap (youtube-nocookie.com), so pages stay fast and private.
 */
(function () {
  var STYLE = [
    '.uk-player{position:relative;width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#000}',
    '.uk-player iframe,.uk-player button{position:absolute;inset:0;width:100%;height:100%;border:0}',
    '.uk-player button{padding:0;cursor:pointer;background:#000}',
    '.uk-player img{width:100%;height:100%;object-fit:cover;display:block;opacity:.92;transition:opacity .2s}',
    '.uk-player button:hover img,.uk-player button:focus-visible img{opacity:1}',
    '.uk-play{position:absolute;left:50%;top:50%;width:72px;height:50px;margin:-25px 0 0 -36px;border-radius:14px;background:rgba(220,38,38,.92);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.35)}',
    '.uk-play::after{content:"";border-style:solid;border-width:11px 0 11px 18px;border-color:transparent transparent transparent #fff;margin-left:4px}',
    '.uk-now{margin-top:.9rem;font-weight:600;color:var(--text);font-size:1.1rem;line-height:1.35}',
    '.uk-date{margin-top:.2rem;font-size:.875rem;color:var(--muted)}',
    '.uk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1.25rem;margin-top:2rem}',
    '.uk-card{display:block;text-align:left;background:none;border:0;padding:0;cursor:pointer;color:inherit;font:inherit}',
    '.uk-card img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;display:block;background:var(--surface)}',
    '.uk-card span{display:block;margin-top:.55rem;font-size:.95rem;font-weight:500;line-height:1.35;color:var(--text)}',
    '.uk-card small{display:block;margin-top:.15rem;font-size:.8rem;color:var(--muted)}',
    '.uk-card[aria-current="true"] img{outline:3px solid var(--accent);outline-offset:2px}',
    '.uk-card:hover span{color:var(--accent)}'
  ].join('\n');

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  function thumb(id, size) { return 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/' + size + '.jpg'; }
  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function player(v, autoplay) {
    var box = el('div', { class: 'uk-player' });
    function play() {
      var f = el('iframe', {
        src: 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.youtube_id) + '?autoplay=1&rel=0&modestbranding=1',
        title: v.title,
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowfullscreen: '',
        referrerpolicy: 'strict-origin-when-cross-origin'
      });
      box.textContent = '';
      box.appendChild(f);
    }
    if (autoplay) { play(); return box; }
    var b = el('button', { type: 'button', 'aria-label': 'Play: ' + v.title });
    var img = el('img', { src: thumb(v.youtube_id, 'hqdefault'), alt: '' });
    b.appendChild(img);
    b.appendChild(el('span', { class: 'uk-play', 'aria-hidden': 'true' }));
    b.addEventListener('click', play);
    box.appendChild(b);
    return box;
  }

  function renderFull(root, data) {
    root.textContent = '';
    if (!data.videos.length) {
      root.appendChild(el('p', { class: 'content-text leading-relaxed' }, 'Videos will appear here as they are posted.'));
      return;
    }
    var stage = el('div');
    var title = el('p', { class: 'uk-now' });
    var date = el('p', { class: 'uk-date' });
    var grid = el('div', { class: 'uk-grid' });
    var cards = [];
    function show(v, autoplay) {
      stage.textContent = '';
      stage.appendChild(player(v, autoplay));
      title.textContent = v.title;
      date.textContent = when(v.published_at);
      cards.forEach(function (c) { c.setAttribute('aria-current', c.dataset.id === v.youtube_id ? 'true' : 'false'); });
    }
    data.videos.forEach(function (v) {
      var c = el('button', { type: 'button', class: 'uk-card', 'data-id': v.youtube_id });
      c.appendChild(el('img', { src: thumb(v.youtube_id, 'mqdefault'), alt: '', loading: 'lazy' }));
      c.appendChild(el('span', null, v.title));
      if (v.published_at) c.appendChild(el('small', null, when(v.published_at)));
      c.addEventListener('click', function () {
        show(v, true);
        stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      cards.push(c);
      grid.appendChild(c);
    });
    root.appendChild(stage);
    root.appendChild(title);
    root.appendChild(date);
    if (data.videos.length > 1) root.appendChild(grid);
    show(data.spotlight || data.videos[0], false);
  }

  function renderSpotlight(root, data) {
    var section = root.closest('[data-video-spotlight-section]') || root;
    if (!data.spotlight) { section.hidden = true; return; }
    root.textContent = '';
    root.appendChild(player(data.spotlight, false));
    root.appendChild(el('p', { class: 'uk-now' }, data.spotlight.title));
    if (data.spotlight.published_at) root.appendChild(el('p', { class: 'uk-date' }, when(data.spotlight.published_at)));
    section.hidden = false;
  }

  function run() {
    var full = document.querySelector('[data-videos-root]');
    var spot = document.querySelector('[data-video-spotlight-root]');
    if (!full && !spot) return;
    var s = document.createElement('style');
    s.textContent = STYLE;
    document.head.appendChild(s);
    if (!window.UpwardApi) return;
    window.UpwardApi.get('/api/public/videos').then(function (data) {
      if (full) renderFull(full, data);
      if (spot) renderSpotlight(spot, data);
    }).catch(function () {
      if (full) {
        full.textContent = '';
        full.appendChild(el('p', { class: 'content-text text-sm text-[var(--muted)]' }, 'Videos could not be loaded right now. You can watch them on YouTube.'));
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
