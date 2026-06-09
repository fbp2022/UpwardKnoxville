const FALLBACK =
  '<div class="teaching-status-stack"><p class="content-text leading-relaxed">Current teaching details will be posted here soon.</p></div>';

function escapeHtml(str) {
  if (str == null || str === '') return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatStudy(row) {
  const parts = [row.current_book, row.current_chapter, row.current_verses].filter(
    (p) => p != null && String(p).trim() !== ''
  );
  return parts.length ? parts.map((p) => escapeHtml(String(p).trim())).join(' · ') : '';
}

function renderRow(row) {
  const study = formatStudy(row);
  const where = row.where_we_left_off?.trim();
  const focus = row.current_focus?.trim();
  const note = row.public_note?.trim();

  if (!study && !where && !focus && !note) {
    return FALLBACK;
  }

  const blocks = [];

  blocks.push(
    `<div class="teaching-status-field">
      <h3>Current Study</h3>
      <p class="content-text">${study || 'Not yet posted'}</p>
    </div>`
  );

  blocks.push(
    `<div class="teaching-status-field">
      <h3>Where We Left Off</h3>
      <p class="content-text whitespace-pre-wrap">${where ? escapeHtml(where) : 'Not yet posted'}</p>
    </div>`
  );

  blocks.push(
    `<div class="teaching-status-field">
      <h3>Current Focus</h3>
      <p class="content-text whitespace-pre-wrap">${focus ? escapeHtml(focus) : 'Not yet posted'}</p>
    </div>`
  );

  blocks.push(
    `<div class="teaching-status-field">
      <h3>Note</h3>
      <p class="content-text whitespace-pre-wrap">${note ? escapeHtml(note) : 'Not yet posted'}</p>
    </div>`
  );

  return '<div class="teaching-status-stack">' + blocks.join('') + '</div>';
}

function upwardApi() {
  return typeof window !== 'undefined' && window.UpwardSupabase ? window.UpwardSupabase : {};
}

async function run() {
  const root = document.querySelector('[data-teaching-status-root]');
  if (!root) return;

  const { getSupabase, isSupabaseConfigured } = upwardApi();
  if (!isSupabaseConfigured || !isSupabaseConfigured()) {
    root.innerHTML = FALLBACK;
    return;
  }

  const supabase = getSupabase ? getSupabase() : null;
  if (!supabase) {
    root.innerHTML = FALLBACK;
    return;
  }
  root.innerHTML =
    '<p class="content-text text-sm text-[var(--muted)]" role="status">Loading…</p>';

  try {
    const { data, error } = await supabase
      .from('teaching_status')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    root.innerHTML = data ? renderRow(data) : FALLBACK;
  } catch {
    root.innerHTML = FALLBACK;
  }
}

run();
