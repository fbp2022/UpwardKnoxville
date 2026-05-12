/**
 * Dashboard markup is built only after authentication (see admin.js).
 * @param {string} assetPrefix '' from site root, '../' from /admin/ folder.
 */
(function (global) {
  global.__UPWARD_GET_ADMIN_DASHBOARD_HTML__ = function (assetPrefix) {
    var P = assetPrefix || '';
    return (
      '<div class="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-5 py-14 md:py-16">' +
      '<div class="soft-card w-full max-w-xl p-8 md:p-10">' +
      '<h2 class="text-xl font-semibold text-[var(--text)]">Teaching status</h2>' +
      '<p id="adminLastUpdated" class="content-text mt-2 text-sm leading-relaxed"></p>' +
      '<p id="adminEditorLoading" class="content-text mt-4 text-sm text-[var(--muted)]" hidden role="status">Loading…</p>' +
      '<form id="adminTeachingForm" class="mt-8 space-y-5">' +
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Current Book</span>' +
      '<input id="field-current-book" name="current_book" type="text" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" /></label>' +
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Current Chapter</span>' +
      '<input id="field-current-chapter" name="current_chapter" type="text" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" /></label>' +
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Current Verses</span>' +
      '<input id="field-current-verses" name="current_verses" type="text" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" /></label>' +
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Where We Left Off</span>' +
      '<textarea id="field-where-we-left-off" name="where_we_left_off" rows="3" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2"></textarea></label>' +
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Current Focus</span>' +
      '<textarea id="field-current-focus" name="current_focus" rows="3" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2"></textarea></label>' +
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Public Note</span>' +
      '<textarea id="field-public-note" name="public_note" rows="4" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2"></textarea></label>' +
      '<div class="flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="submit" id="adminSaveBtn" class="rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">Save changes</button>' +
      '<button type="button" id="adminLogoutBtn" class="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]">Log out</button>' +
      '</div>' +
      '<p id="adminEditorStatus" class="min-h-[1.25rem] text-sm text-[var(--muted)] sm:text-right" role="status" aria-live="polite"></p>' +
      '</div></form></div>' +
      '<div class="soft-card w-full max-w-xl p-8 md:p-10">' +
      '<h2 class="text-xl font-semibold text-[var(--text)]">Announcements</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed">Published posts appear on the site (order, then date). Drafts stay hidden until published.</p>' +
      '<p id="adminAnnouncementsLoading" class="content-text mt-4 text-sm text-[var(--muted)]" hidden role="status">Loading announcements…</p>' +
      '<p id="adminAnnouncementsStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<form id="adminAnnouncementForm" class="mt-6 space-y-4 border-t border-[var(--border)] pt-6">' +
      '<input type="hidden" id="adminAnnouncementEditingId" value="" autocomplete="off" />' +
      '<h3 id="adminAnnouncementFormHeading" class="text-sm font-semibold text-[var(--text)]">New announcement</h3>' +
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Title</span>' +
      '<input id="adminAnnouncementTitle" type="text" name="title" required maxlength="500" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" /></label>' +
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Body</span>' +
      '<textarea id="adminAnnouncementBody" name="body" rows="5" required class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2"></textarea></label>' +
      '<label class="flex cursor-pointer items-center gap-3">' +
      '<input id="adminAnnouncementPublished" type="checkbox" class="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]" />' +
      '<span class="text-sm font-medium text-[var(--text)]">Published (visible on the public site)</span></label>' +
      '<label class="block"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Display order</span>' +
      '<input id="adminAnnouncementDisplayOrder" type="number" name="display_order" value="0" step="1" class="w-full max-w-[12rem] rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" />' +
      '<span class="mt-1 block text-xs text-[var(--muted)]">Lower numbers appear first.</span></label>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="submit" id="adminAnnouncementPostBtn" class="rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">Save</button>' +
      '<button type="button" id="adminAnnouncementClearBtn" class="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]">New announcement</button>' +
      '</div></form>' +
      '<div class="mt-8 border-t border-[var(--border)] pt-6">' +
      '<h3 class="text-sm font-semibold text-[var(--text)]">All announcements</h3>' +
      '<ul id="adminAnnouncementsList" class="mt-4 list-none space-y-4 p-0"></ul></div></div>' +
      '<div class="soft-card w-full max-w-xl p-8 md:p-10">' +
      '<h2 class="text-xl font-semibold text-[var(--text)]">Update email BCC list</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed">These addresses receive blind copies when teaching status or other admin updates are sent. People can join this list from the Stay Connected form if they opt in.</p>' +
      '<form id="adminBccForm" class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">' +
      '<label class="block min-w-0 flex-1"><span class="mb-2 block text-sm font-medium text-[var(--text)]">Email address</span>' +
      '<input id="adminBccEmail" type="email" autocomplete="email" placeholder="name@example.com" class="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2" /></label>' +
      '<button type="submit" id="adminBccAddBtn" class="shrink-0 rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">Add</button></form>' +
      '<p id="adminBccStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<ul id="adminBccList" class="mt-4 list-none space-y-2 p-0"></ul></div>' +
      '<div class="soft-card w-full max-w-xl p-8 md:p-10">' +
      '<h2 class="text-xl font-semibold text-[var(--text)]">Contact messages</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed">Messages submitted through the public Stay Connected form (after Turnstile verification).</p>' +
      '<p id="adminContactLoading" class="content-text mt-4 text-sm text-[var(--muted)]" hidden role="status">Loading messages…</p>' +
      '<p id="adminContactStatus" class="content-text mt-2 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<div id="adminContactTableWrap" class="mt-4 overflow-x-auto"></div></div>' +
      '<p class="content-text text-center text-xs leading-relaxed">' +
      '<a href="' +
      P +
      'index.html" class="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">← Back to site</a></p></div>'
    );
  };
})(typeof window !== 'undefined' ? window : globalThis);
