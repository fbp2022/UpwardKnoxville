/**
 * Dashboard markup is built only after authentication (see admin.js).
 * @param {string} assetPrefix '' from site root, '../' from /admin/ folder.
 */
(function (global) {
  global.__UPWARD_GET_ADMIN_DASHBOARD_HTML__ = function (assetPrefix) {
    var P = assetPrefix || '';
    var card =
      'rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-7 sm:shadow-[var(--shadow-md)]';
    var label = 'mb-2 block text-sm font-medium text-[var(--text)]';
    var input =
      'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[var(--text)] outline-none ring-[var(--accent)] transition focus:ring-2';
    var textarea =
      'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[var(--text)] outline-none ring-[var(--accent)] transition focus:ring-2';

    return (
      '<div class="admin-dash-shell w-full min-h-screen bg-[var(--bg)]">' +
      '<div class="admin-dash-inner mx-auto w-full max-w-[1400px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">' +
      '<header class="admin-dash-header mb-8 flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-start sm:justify-between">' +
      '<div class="min-w-0 flex-1">' +
      '<h1 class="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">Upward Knoxville Admin</h1>' +
      '<p class="content-text mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">Manage teaching status, announcements, contact messages, and update emails.</p>' +
      '</div>' +
      '<div class="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">' +
      '<a href="' +
      P +
      'index.html" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]">Back to site</a>' +
      '<button type="button" id="adminLogoutBtn" class="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Log out</button>' +
      '</div>' +
      '</header>' +
      '<div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">' +
      '<div class="flex flex-col gap-6 lg:col-span-7">' +
      '<section class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Teaching status</h2>' +
      '<p id="adminLastUpdated" class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]"></p>' +
      '<p id="adminEditorLoading" class="content-text mt-3 text-sm text-[var(--muted)]" hidden role="status">Loading…</p>' +
      '<form id="adminTeachingForm" class="mt-6 space-y-5">' +
      '<div class="grid grid-cols-1 gap-5 md:grid-cols-2">' +
      '<label class="block"><span class="' +
      label +
      '">Current Book</span>' +
      '<input id="field-current-book" name="current_book" type="text" class="' +
      input +
      '" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Current Chapter</span>' +
      '<input id="field-current-chapter" name="current_chapter" type="text" class="' +
      input +
      '" /></label>' +
      '</div>' +
      '<label class="block"><span class="' +
      label +
      '">Current Verses</span>' +
      '<input id="field-current-verses" name="current_verses" type="text" class="' +
      input +
      '" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Where We Left Off</span>' +
      '<textarea id="field-where-we-left-off" name="where_we_left_off" rows="3" class="' +
      textarea +
      '"></textarea></label>' +
      '<label class="block"><span class="' +
      label +
      '">Current Focus</span>' +
      '<textarea id="field-current-focus" name="current_focus" rows="3" class="' +
      textarea +
      '"></textarea></label>' +
      '<label class="block"><span class="' +
      label +
      '">Public Note</span>' +
      '<textarea id="field-public-note" name="public_note" rows="4" class="' +
      textarea +
      '"></textarea></label>' +
      '<div class="flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">' +
      '<button type="submit" id="adminSaveBtn" class="rounded-lg bg-[var(--accent)] px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">Save changes</button>' +
      '<p id="adminEditorStatus" class="min-h-[1.25rem] text-sm text-[var(--muted)] sm:text-right" role="status" aria-live="polite"></p>' +
      '</div></form></section>' +
      '<section class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Announcements</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">Published posts appear on the site (order, then date). Drafts stay hidden until published.</p>' +
      '<p id="adminAnnouncementsLoading" class="content-text mt-4 text-sm text-[var(--muted)]" hidden role="status">Loading announcements…</p>' +
      '<p id="adminAnnouncementsStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<form id="adminAnnouncementForm" class="mt-6 space-y-4 border-t border-[var(--border)] pt-6">' +
      '<input type="hidden" id="adminAnnouncementEditingId" value="" autocomplete="off" />' +
      '<h3 id="adminAnnouncementFormHeading" class="text-sm font-semibold text-[var(--text)]">New announcement</h3>' +
      '<label class="block"><span class="' +
      label +
      '">Title</span>' +
      '<input id="adminAnnouncementTitle" type="text" name="title" required maxlength="500" class="' +
      input +
      '" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Body</span>' +
      '<textarea id="adminAnnouncementBody" name="body" rows="5" required class="' +
      textarea +
      '"></textarea></label>' +
      '<label class="flex cursor-pointer items-center gap-3">' +
      '<input id="adminAnnouncementPublished" type="checkbox" class="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]" />' +
      '<span class="text-sm font-medium text-[var(--text)]">Published (visible on the public site)</span></label>' +
      '<label class="block"><span class="' +
      label +
      '">Display order</span>' +
      '<input id="adminAnnouncementDisplayOrder" type="number" name="display_order" value="0" step="1" class="max-w-[12rem] ' +
      input +
      '" />' +
      '<span class="mt-1 block text-xs text-[var(--muted)]">Lower numbers appear first.</span></label>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="submit" id="adminAnnouncementPostBtn" class="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">Save</button>' +
      '<button type="button" id="adminAnnouncementClearBtn" class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]">New announcement</button>' +
      '</div></form>' +
      '<div class="mt-8 border-t border-[var(--border)] pt-6">' +
      '<h3 class="text-sm font-semibold text-[var(--text)]">All announcements</h3>' +
      '<ul id="adminAnnouncementsList" class="mt-4 list-none space-y-4 p-0"></ul></div></section>' +
      '</div>' +
      '<div class="flex flex-col gap-6 lg:col-span-5">' +
      '<section class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Update email BCC list</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">These addresses receive blind copies when teaching status or other admin updates are sent. People can join this list from the Stay Connected form if they opt in.</p>' +
      '<form id="adminBccForm" class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">' +
      '<label class="block min-w-0 flex-1"><span class="' +
      label +
      '">Email address</span>' +
      '<input id="adminBccEmail" type="email" autocomplete="email" placeholder="name@example.com" class="' +
      input +
      '" /></label>' +
      '<button type="submit" id="adminBccAddBtn" class="shrink-0 rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">Add</button></form>' +
      '<p id="adminBccStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<ul id="adminBccList" class="mt-4 list-none space-y-2 p-0"></ul></section>' +
      '<section class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Contact messages</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">Messages submitted through the public Stay Connected form (after Turnstile verification).</p>' +
      '<p id="adminContactLoading" class="content-text mt-4 text-sm text-[var(--muted)]" hidden role="status">Loading messages…</p>' +
      '<p id="adminContactStatus" class="content-text mt-2 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<div id="adminContactList" class="mt-4 flex flex-col gap-4"></div></section>' +
      '</div></div></div></div>'
    );
  };
})(typeof window !== 'undefined' ? window : globalThis);
