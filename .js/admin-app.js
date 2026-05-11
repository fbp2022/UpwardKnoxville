import { getSupabase, isSupabaseConfigured } from './supabase-client.js';

const els = {
  configMissing: document.getElementById('admin-config-missing'),
  login: document.getElementById('admin-login'),
  editor: document.getElementById('admin-editor'),
  loginForm: document.getElementById('adminLoginForm'),
  loginEmail: document.getElementById('adminLoginEmail'),
  loginPassword: document.getElementById('adminLoginPassword'),
  loginError: document.getElementById('adminLoginError'),
  loginSubmit: document.getElementById('adminLoginSubmit'),
  teachingForm: document.getElementById('adminTeachingForm'),
  fieldBook: document.getElementById('field-current-book'),
  fieldChapter: document.getElementById('field-current-chapter'),
  fieldVerses: document.getElementById('field-current-verses'),
  fieldWhere: document.getElementById('field-where-we-left-off'),
  fieldFocus: document.getElementById('field-current-focus'),
  fieldNote: document.getElementById('field-public-note'),
  saveBtn: document.getElementById('adminSaveBtn'),
  logoutBtn: document.getElementById('adminLogoutBtn'),
  lastUpdated: document.getElementById('adminLastUpdated'),
  editorStatus: document.getElementById('adminEditorStatus'),
  editorLoading: document.getElementById('adminEditorLoading'),
};

let supabase = null;
let currentRowId = null;
let saving = false;

function show(el, on) {
  if (!el) return;
  el.hidden = !on;
}

function clearStatus() {
  if (els.editorStatus) els.editorStatus.textContent = '';
}

function setEditorBusy(busy) {
  if (els.editorLoading) els.editorLoading.hidden = !busy;
  if (els.teachingForm) {
    els.teachingForm.querySelectorAll('input, textarea, button').forEach((node) => {
      node.disabled = busy;
    });
  }
  if (els.logoutBtn) els.logoutBtn.disabled = busy;
}

function formatUpdatedAt(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '';
  }
}

function fillForm(row) {
  if (!row) {
    currentRowId = null;
    if (els.fieldBook) els.fieldBook.value = '';
    if (els.fieldChapter) els.fieldChapter.value = '';
    if (els.fieldVerses) els.fieldVerses.value = '';
    if (els.fieldWhere) els.fieldWhere.value = '';
    if (els.fieldFocus) els.fieldFocus.value = '';
    if (els.fieldNote) els.fieldNote.value = '';
    if (els.lastUpdated) els.lastUpdated.textContent = '';
    return;
  }
  currentRowId = row.id ?? null;
  if (els.fieldBook) els.fieldBook.value = row.current_book ?? '';
  if (els.fieldChapter) els.fieldChapter.value = row.current_chapter ?? '';
  if (els.fieldVerses) els.fieldVerses.value = row.current_verses ?? '';
  if (els.fieldWhere) els.fieldWhere.value = row.where_we_left_off ?? '';
  if (els.fieldFocus) els.fieldFocus.value = row.current_focus ?? '';
  if (els.fieldNote) els.fieldNote.value = row.public_note ?? '';
  if (els.lastUpdated) {
    const formatted = formatUpdatedAt(row.updated_at);
    els.lastUpdated.textContent = formatted ? `Last updated: ${formatted}` : '';
  }
}

async function loadTeachingRow() {
  if (!supabase) return;
  clearStatus();
  setEditorBusy(true);
  try {
    const { data, error } = await supabase
      .from('teaching_status')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    fillForm(data || null);
  } catch {
    if (els.editorStatus) {
      els.editorStatus.textContent =
        'Something went wrong while loading. Please refresh and try again.';
    }
    fillForm(null);
  } finally {
    setEditorBusy(false);
  }
}

function collectPayload() {
  return {
    current_book: els.fieldBook?.value?.trim() ?? '',
    current_chapter: els.fieldChapter?.value?.trim() ?? '',
    current_verses: els.fieldVerses?.value?.trim() ?? '',
    where_we_left_off: els.fieldWhere?.value?.trim() ?? '',
    current_focus: els.fieldFocus?.value?.trim() ?? '',
    public_note: els.fieldNote?.value?.trim() ?? '',
    updated_at: new Date().toISOString(),
  };
}

async function saveTeachingRow(ev) {
  ev.preventDefault();
  if (!supabase || saving) return;
  saving = true;
  clearStatus();
  if (els.saveBtn) {
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = 'Saving…';
  }
  try {
    const payload = collectPayload();
    if (currentRowId) {
      const { error } = await supabase
        .from('teaching_status')
        .update(payload)
        .eq('id', currentRowId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('teaching_status')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      if (data?.id) currentRowId = data.id;
    }
    if (els.editorStatus) els.editorStatus.textContent = 'Teaching status updated.';
    await loadTeachingRow();
  } catch {
    if (els.editorStatus) {
      els.editorStatus.textContent =
        'Something went wrong while saving. Please try again.';
    }
  } finally {
    saving = false;
    if (els.saveBtn) {
      els.saveBtn.disabled = false;
      els.saveBtn.textContent = 'Save';
    }
  }
}

function showLoginView() {
  show(els.configMissing, false);
  show(els.login, true);
  show(els.editor, false);
  if (els.loginError) els.loginError.textContent = '';
}

function showEditorView() {
  show(els.configMissing, false);
  show(els.login, false);
  show(els.editor, true);
}

async function onLogin(ev) {
  ev.preventDefault();
  if (!supabase) return;
  if (els.loginError) els.loginError.textContent = '';
  if (els.loginSubmit) {
    els.loginSubmit.disabled = true;
    els.loginSubmit.textContent = 'Signing in…';
  }
  const email = els.loginEmail?.value?.trim() ?? '';
  const password = els.loginPassword?.value ?? '';
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    els.loginPassword.value = '';
  } catch {
    if (els.loginError) {
      els.loginError.textContent =
        'That email or password did not work. Please try again.';
    }
  } finally {
    if (els.loginSubmit) {
      els.loginSubmit.disabled = false;
      els.loginSubmit.textContent = 'Sign in';
    }
  }
}

async function onLogout() {
  if (!supabase) return;
  clearStatus();
  await supabase.auth.signOut();
  showLoginView();
}

function init() {
  if (!isSupabaseConfigured()) {
    show(els.configMissing, true);
    show(els.login, false);
    show(els.editor, false);
    return;
  }

  supabase = getSupabase();

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showEditorView();
      loadTeachingRow();
    } else {
      showLoginView();
    }
  });

  if (els.loginForm) els.loginForm.addEventListener('submit', onLogin);
  if (els.teachingForm) els.teachingForm.addEventListener('submit', saveTeachingRow);
  if (els.logoutBtn) els.logoutBtn.addEventListener('click', onLogout);
}

init();
