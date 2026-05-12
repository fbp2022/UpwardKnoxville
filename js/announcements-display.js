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

/** Numeric display_order for sorting; null/NaN/blank → null (sort after all finite numbers). */
function displayOrderNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lower display_order first (numeric). Same order → newest created_at first.
 * Null/invalid display_order after all numeric rows; among those, newest first.
 */
function sortPublishedAnnouncements(rows) {
  return [...rows].sort((a, b) => {
    const ao = displayOrderNumber(a.display_order);
    const bo = displayOrderNumber(b.display_order);
    const aBucket = ao === null;
    const bBucket = bo === null;
    if (!aBucket && !bBucket && ao !== bo) return ao - bo;
    if (aBucket && !bBucket) return 1;
    if (!aBucket && bBucket) return -1;
    const at = new Date(a.created_at || 0).getTime();
    const bt = new Date(b.created_at || 0).getTime();
    return bt - at;
  });
}

const EXCERPT_MAX = 180;

function plainTextFromBody(body) {
  if (body == null) return '';
  return String(body).replace(/\s+/g, ' ').trim();
}

function excerptFromBody(body) {
  const plain = plainTextFromBody(body);
  if (plain.length <= EXCERPT_MAX) return plain;
  return plain.slice(0, EXCERPT_MAX).trimEnd() + '…';
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

function renderArticle(row) {
  const id = row.id != null ? String(row.id).replace(/[^a-zA-Z0-9-]/g, '') : '';
  const panelId = id ? `announcement-panel-${id}` : `announcement-panel-${Math.random().toString(36).slice(2)}`;
  const toggleId = id ? `announcement-toggle-${id}` : `announcement-toggle-${Math.random().toString(36).slice(2)}`;

  const titleRaw = row.title != null ? String(row.title).trim() : '';
  const title = escapeHtml(titleRaw || 'Announcement');
  const when = escapeHtml(formatDate(row.created_at));
  const bodyRaw = row.body != null ? String(row.body) : '';
  const bodyHtml = escapeHtml(bodyRaw);
  const excerptPlain = excerptFromBody(bodyRaw);
  const excerptHtml = escapeHtml(excerptPlain);

  const titleBlock = `<h3 class="announcement-card__title">${title}</h3>`;
  const metaBlock = when ? `<p class="announcement-card__meta">${when}</p>` : '';
  const excerptBlock = excerptHtml
    ? `<p class="announcement-card__excerpt">${excerptHtml}</p>`
    : '';

  const locationRaw =
    row.location != null && String(row.location).trim()
      ? String(row.location).trim()
      : row.address != null && String(row.address).trim()
        ? String(row.address).trim()
        : '';
  const locationHtml = locationRaw ? escapeHtml(locationRaw) : '';
  const metaExtraBlock = locationHtml
    ? `<p class="announcement-card__location content-text">${locationHtml}</p>`
    : '';

  return (
    `<article class="announcement-card">` +
    `<div class="announcement-card__inner">` +
    `<button type="button" class="announcement-card__toggle" id="${escapeHtml(toggleId)}" ` +
    `aria-expanded="false" aria-controls="${escapeHtml(panelId)}">` +
    `<span class="announcement-card__toggle-text">` +
    titleBlock +
    metaBlock +
    excerptBlock +
    `</span>` +
    `<span class="announcement-card__toggle-trail">` +
    `<span class="announcement-card__read-label">Read more</span>` +
    `<svg class="announcement-card__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>` +
    `</span>` +
    `</button>` +
    `<div class="announcement-card__panel" id="${escapeHtml(panelId)}" role="region" aria-labelledby="${escapeHtml(
      toggleId
    )}" hidden>` +
    `<div class="announcement-card__body">${bodyHtml}</div>` +
    (metaExtraBlock ? `<div class="announcement-card__expanded-meta">${metaExtraBlock}</div>` : '') +
    `</div>` +
    `</div></article>`
  );
}

function renderArticleList(rows) {
  return rows.map((row) => renderArticle(row)).join('');
}

function wireAnnouncementToggles(root) {
  root.querySelectorAll('.announcement-card__toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      const next = !expanded;
      btn.setAttribute('aria-expanded', String(next));
      const panelId = btn.getAttribute('aria-controls');
      const panel = panelId ? document.getElementById(panelId) : null;
      if (panel) {
        if (next) panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
      }
      const label = btn.querySelector('.announcement-card__read-label');
      if (label) label.textContent = next ? 'Show less' : 'Read more';
      btn.classList.toggle('is-expanded', next);
    });
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
      .limit(100);

    if (error) throw error;
    if (!data || !data.length) {
      root.innerHTML = renderQuietArticle();
      return;
    }

    const sorted = sortPublishedAnnouncements(data);
    root.innerHTML = renderArticleList(sorted);
    wireAnnouncementToggles(root);
  } catch {
    root.innerHTML = renderQuietArticle();
  }
}

run();
