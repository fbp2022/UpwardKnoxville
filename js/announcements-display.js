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

/** Single empty-state card (fragment only — no outer .announcements-feed). */
function renderQuietArticle() {
  return (
    `<article class="announcement-card announcement-card--empty" aria-live="polite">` +
    `<div class="announcement-card__inner">` +
    `<p class="announcement-card__empty-message content-text">${escapeHtml(
      'No announcements have been posted yet.'
    )}</p>` +
    `</div></article>`
  );
}

function renderLoadingArticle() {
  return (
    `<article class="announcement-card announcement-card--loading" aria-busy="true">` +
    `<div class="announcement-card__inner">` +
    `<p class="announcement-card__loading-status content-text" role="status">${escapeHtml(
      'Loading…'
    )}</p>` +
    `</div></article>`
  );
}

function renderArticle(row) {
  const titleRaw = row.title != null ? String(row.title).trim() : '';
  const title = escapeHtml(titleRaw);
  const when = escapeHtml(formatDate(row.created_at));
  const bodyHtml = escapeHtml(row.body != null ? String(row.body) : '');
  const titleBlock = titleRaw ? `<h3 class="announcement-card__title">${title}</h3>` : '';
  const metaBlock = when ? `<p class="announcement-card__meta">${when}</p>` : '';

  return (
    `<article class="announcement-card">` +
    `<div class="announcement-card__inner">` +
    titleBlock +
    metaBlock +
    `<div class="announcement-card__body">${bodyHtml}</div>` +
    `</div></article>`
  );
}

/** Concatenated <article> nodes only — parent .announcements-feed stays on HTML root. */
function renderArticleList(rows) {
  return rows.map((row) => renderArticle(row)).join('');
}

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
      .select('id,title,body,created_at,is_published')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    if (!data || !data.length) {
      root.innerHTML = renderQuietArticle();
      return;
    }
    root.innerHTML = renderArticleList(data);
  } catch {
    root.innerHTML = renderQuietArticle();
  }
}

run();
