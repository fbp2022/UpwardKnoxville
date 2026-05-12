const QUIET =
  '<p class="content-text text-sm text-[var(--muted)]">No announcements yet.</p>';

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

function renderList(rows) {
  const items = rows.map((row) => {
    const title = escapeHtml(row.title);
    const when = escapeHtml(formatDate(row.created_at));
    const bodyHtml = escapeHtml(row.body != null ? String(row.body) : '');
    return (
      '<li class="announcement-item">' +
      '<h3 class="announcement-item__title">' +
      title +
      '</h3>' +
      '<p class="announcement-item__meta">' +
      when +
      '</p>' +
      '<div class="announcement-item__body content-text">' +
      bodyHtml +
      '</div>' +
      '</li>'
    );
  });
  return '<ul class="announcement-list">' + items.join('') + '</ul>';
}

async function run() {
  const root = document.querySelector('[data-announcements-root]');
  if (!root) return;

  const { getSupabase, isSupabaseConfigured } = upwardApi();
  if (!isSupabaseConfigured || !isSupabaseConfigured()) {
    root.innerHTML = QUIET;
    return;
  }

  const supabase = getSupabase ? getSupabase() : null;
  if (!supabase) {
    root.innerHTML = QUIET;
    return;
  }

  root.innerHTML =
    '<p class="content-text text-sm text-[var(--muted)]" role="status">Loading…</p>';

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
      root.innerHTML = QUIET;
      return;
    }
    root.innerHTML = renderList(data);
  } catch {
    root.innerHTML = QUIET;
  }
}

run();
