function escapeHtml(str) {
  if (str == null || str === '') return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function upwardApi() {
  return typeof window !== 'undefined' && window.UpwardSupabase ? window.UpwardSupabase : {};
}

/**
 * Numeric display_order (never string sort). null/NaN/blank → null bucket
 * (after all finite numbers).
 */
function displayOrderNumber(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * display_order ascending (numeric), then created_at descending.
 * Null/invalid display_order after all numeric rows; ties → newest first.
 */
function sortPublishedAnnouncements(rows) {
  return [...rows].sort((a, b) => {
    const ao = displayOrderNumber(a.display_order);
    const bo = displayOrderNumber(b.display_order);
    const aBucket = ao === null;
    const bBucket = bo === null;
    if (!aBucket && !bBucket) {
      if (ao < bo) return -1;
      if (ao > bo) return 1;
    } else if (aBucket && !bBucket) {
      return 1;
    } else if (!aBucket && bBucket) {
      return -1;
    }
    const at = new Date(a.created_at || 0).getTime();
    const bt = new Date(b.created_at || 0).getTime();
    if (bt !== at) return bt - at;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

const EXCERPT_MAX = 160;

function plainTextFromBody(body) {
  if (body == null) return '';
  return String(body).replace(/\s+/g, ' ').trim();
}

function excerptFromBody(body) {
  const plain = plainTextFromBody(body);
  if (plain.length <= EXCERPT_MAX) return plain;
  return plain.slice(0, EXCERPT_MAX).trimEnd() + '…';
}

function safeAnnouncementId(row) {
  return row.id != null ? String(row.id).replace(/[^a-zA-Z0-9-]/g, '') : '';
}

/** Single empty-state card (spans grid). */
function renderQuietArticle() {
  return (
    `<article class="announcement-card announcement-card--empty announcement-card--grid-span" aria-live="polite">` +
    `<div class="announcement-card__inner">` +
    `<p class="announcement-card__empty-message content-text">${escapeHtml(
      'No announcements have been posted yet.'
    )}</p>` +
    `</div></article>`
  );
}

function renderLoadingArticle() {
  return (
    `<article class="announcement-card announcement-card--loading announcement-card--grid-span" aria-busy="true">` +
    `<div class="announcement-card__inner">` +
    `<p class="announcement-card__loading-status content-text" role="status">${escapeHtml(
      'Loading…'
    )}</p>` +
    `</div></article>`
  );
}

function renderPreviewCard(row) {
  const id = safeAnnouncementId(row);
  const titleRaw = row.title != null ? String(row.title).trim() : '';
  const title = escapeHtml(titleRaw || 'Announcement');
  const when = escapeHtml(formatDate(row.created_at));
  const bodyRaw = row.body != null ? String(row.body) : '';
  const excerptPlain = excerptFromBody(bodyRaw);
  const excerptHtml = excerptPlain ? escapeHtml(excerptPlain) : '';

  const titleBlock = `<h3 class="announcement-card__title">${title}</h3>`;
  const metaBlock = when ? `<p class="announcement-card__meta">${when}</p>` : '';
  const excerptBlock = excerptHtml ? `<p class="announcement-card__excerpt">${excerptHtml}</p>` : '';

  const openAttr = id ? ` data-announcement-open="${escapeHtml(id)}"` : '';

  return (
    `<article class="announcement-card announcement-card--preview">` +
    `<div class="announcement-card__inner">` +
    `<button type="button" class="announcement-card__open"${openAttr} ` +
    `aria-haspopup="dialog" aria-controls="announcement-modal-dialog">` +
    `<span class="announcement-card__open-main">` +
    titleBlock +
    metaBlock +
    excerptBlock +
    `</span>` +
    `<span class="announcement-card__open-cta">` +
    `<span class="announcement-card__open-cta-text">${escapeHtml('Read announcement')}</span>` +
    `<svg class="announcement-card__open-cta-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>` +
    `</span>` +
    `</button>` +
    `</div></article>`
  );
}

function renderArticleList(rows) {
  return rows.map((row) => renderPreviewCard(row)).join('');
}

function locationFromRow(row) {
  if (row.location != null && String(row.location).trim()) return String(row.location).trim();
  if (row.address != null && String(row.address).trim()) return String(row.address).trim();
  return '';
}

let modalEl = null;
let lastFocusEl = null;
let savedScrollY = 0;
let rowsById = new Map();
let onDocumentKeydown = null;

function getFocusableElements(container) {
  const sel =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll(sel)).filter((el) => {
    const st = window.getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

function ensureModal() {
  if (modalEl) return modalEl;
  const wrap = document.createElement('div');
  wrap.id = 'announcement-view-modal';
  wrap.className = 'announcement-modal';
  wrap.setAttribute('hidden', '');
  wrap.innerHTML =
    '<div class="announcement-modal__backdrop" data-announcement-modal-dismiss>' +
    '<div id="announcement-modal-dialog" class="announcement-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="announcement-modal-title">' +
    '<button type="button" class="announcement-modal__close" data-announcement-modal-close aria-label="Close announcement">' +
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
    '</button>' +
    '<div class="announcement-modal__scroll">' +
    '<h2 id="announcement-modal-title" class="announcement-modal__title"></h2>' +
    '<p class="announcement-modal__meta" id="announcement-modal-meta"></p>' +
    '<div class="announcement-modal__body" id="announcement-modal-body"></div>' +
    '<div class="announcement-modal__location" id="announcement-modal-location" hidden></div>' +
    '</div>' +
    '</div>' +
    '</div>';
  document.body.appendChild(wrap);
  modalEl = wrap;

  const close = () => closeAnnouncementModal();
  const backdrop = wrap.querySelector('[data-announcement-modal-dismiss]');
  const dialog = wrap.querySelector('#announcement-modal-dialog');
  wrap.querySelector('[data-announcement-modal-close]').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  dialog.addEventListener('click', (e) => e.stopPropagation());

  onDocumentKeydown = (e) => {
    if (!modalEl || modalEl.hasAttribute('hidden')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const dialog = modalEl.querySelector('.announcement-modal__dialog');
    const list = getFocusableElements(dialog);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onDocumentKeydown);

  return modalEl;
}

function lockBodyScroll() {
  savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.documentElement.classList.add('announcement-modal-open');
  document.body.classList.add('announcement-modal-open');
  document.body.style.setProperty('top', `-${savedScrollY}px`);
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
}

function unlockBodyScroll() {
  document.documentElement.classList.remove('announcement-modal-open');
  document.body.classList.remove('announcement-modal-open');
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('width');
  window.scrollTo(0, savedScrollY);
}

function openAnnouncementModal(row) {
  const m = ensureModal();
  const titleEl = m.querySelector('#announcement-modal-title');
  const metaEl = m.querySelector('#announcement-modal-meta');
  const bodyEl = m.querySelector('#announcement-modal-body');
  const locEl = m.querySelector('#announcement-modal-location');

  const titleRaw = row.title != null ? String(row.title).trim() : '';
  titleEl.textContent = titleRaw || 'Announcement';
  metaEl.textContent = formatDate(row.created_at) || '';
  metaEl.hidden = !metaEl.textContent;
  bodyEl.textContent = row.body != null ? String(row.body) : '';

  const loc = locationFromRow(row);
  if (loc) {
    locEl.textContent = loc;
    locEl.removeAttribute('hidden');
  } else {
    locEl.textContent = '';
    locEl.setAttribute('hidden', '');
  }

  lastFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  m.removeAttribute('hidden');
  lockBodyScroll();

  const closeBtn = m.querySelector('[data-announcement-modal-close]');
  if (closeBtn) closeBtn.focus();
}

function closeAnnouncementModal() {
  if (!modalEl || modalEl.hasAttribute('hidden')) return;
  modalEl.setAttribute('hidden', '');
  unlockBodyScroll();
  if (lastFocusEl && typeof lastFocusEl.focus === 'function') {
    lastFocusEl.focus();
  }
  lastFocusEl = null;
}

function wirePreviewCards(root) {
  ensureModal();
  root.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('[data-announcement-open]') : null;
    if (!btn || !root.contains(btn)) return;
    const id = btn.getAttribute('data-announcement-open');
    if (!id || !rowsById.has(id)) return;
    e.preventDefault();
    openAnnouncementModal(rowsById.get(id));
  });
}

/** Concatenated <article> nodes only — parent .announcements-feed stays on HTML root. */
async function run() {
  const root = document.querySelector('[data-announcements-root]');
  if (!root) return;

  const { getSupabase, isSupabaseConfigured } = upwardApi();
  if (!isSupabaseConfigured || !isSupabaseConfigured()) {
    root.innerHTML = renderQuietArticle();
    return;
  }

  const supabase = getSupabase ? getSupabase() : null;
  if (!supabase) {
    root.innerHTML = renderQuietArticle();
    return;
  }

  root.innerHTML = renderLoadingArticle();

  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('id,title,body,created_at,is_published,display_order')
      .eq('is_published', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    if (!data || !data.length) {
      root.innerHTML = renderQuietArticle();
      return;
    }

    const sorted = sortPublishedAnnouncements(data);
    rowsById = new Map();
    sorted.forEach((row) => {
      const sid = safeAnnouncementId(row);
      if (sid) rowsById.set(sid, row);
    });
    root.innerHTML = renderArticleList(sorted);
    wirePreviewCards(root);
  } catch {
    root.innerHTML = renderQuietArticle();
  }
}

run();
