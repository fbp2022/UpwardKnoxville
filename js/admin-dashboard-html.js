/**
 * Dashboard markup is built only after authentication (see admin.js).
 * @param {string} assetPrefix '' from site root, '../' from /admin/ folder.
 */
(function (global) {
  function buildCommunicationsInnerMarkup() {
    var card =
      'rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-7 sm:shadow-[var(--shadow-md)]';
    var label = 'mb-2 block text-sm font-medium text-[var(--text)]';
    var input =
      'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[var(--text)] outline-none ring-[var(--accent)] transition focus:ring-2';
    var textarea =
      'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[var(--text)] outline-none ring-[var(--accent)] transition focus:ring-2';

    return (
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
      '</div></div>'
    );
  }

  global.__UPWARD_GET_ADMIN_MINISTRY_TOOLS_HTML__ = function () {
    return buildCommunicationsInnerMarkup();
  };

  global.__UPWARD_GET_ADMIN_DASHBOARD_HTML__ = function (assetPrefix) {
    var P = assetPrefix || '';
    var communicationsInner = buildCommunicationsInnerMarkup();
    var card =
      'rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-7 sm:shadow-[var(--shadow-md)]';
    var label = 'mb-2 block text-sm font-medium text-[var(--text)]';
    var input =
      'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[var(--text)] outline-none ring-[var(--accent)] transition focus:ring-2';
    var textarea =
      'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[var(--text)] outline-none ring-[var(--accent)] transition focus:ring-2';

    var navBtnClass =
      'admin-side-nav__btn w-full rounded-lg border border-transparent px-3 py-2.5 text-left text-sm font-medium text-[var(--muted)] transition hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]';

    function navButton(id, lbl, current) {
      return (
        '<button type="button" class="' +
        navBtnClass +
        '" data-admin-nav="' +
        id +
        '"' +
        (current ? ' aria-current="true"' : '') +
        '>' +
        lbl +
        '</button>'
      );
    }

    var jumpCard =
      'w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-left shadow-sm transition hover:border-[var(--accent)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] sm:p-7 sm:shadow-[var(--shadow-md)]';

    function overviewBtn(jump, title, bodyId, scrollToId) {
      var scrollAttr =
        scrollToId && String(scrollToId).length
          ? ' data-admin-scrollto="' + String(scrollToId).replace(/"/g, '') + '"'
          : '';
      return (
        '<button type="button" class="' +
        jumpCard +
        '" data-admin-jump="' +
        jump +
        '"' +
        scrollAttr +
        '>' +
        '<h2 class="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">' +
        title +
        '</h2>' +
        '<p id="' +
        bodyId +
        '" class="content-text mt-3 text-sm leading-relaxed text-[var(--text)]">—</p>' +
        '</button>'
      );
    }

    function panelShell(id, inner) {
      return (
        '<div id="admin-panel-' +
        id +
        '" class="hidden" hidden data-admin-panel="' +
        id +
        '">' +
        inner +
        '</div>'
      );
    }

    var leadershipPanel =
      '<div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">' +
      '<div class="lg:col-span-5">' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Leadership directory</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">Active leaders visible to authenticated staff. Add the first entry if this list is empty.</p>' +
      '<p id="adminLeadershipStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<ul id="adminLeadershipList" class="mt-4 max-h-[min(60vh,28rem)] list-none space-y-2 overflow-y-auto p-0"></ul></div></div>' +
      '<div class="lg:col-span-7">' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Add or edit</h2>' +
      '<form id="adminLeadershipForm" class="mt-6 space-y-4">' +
      '<input type="hidden" id="adminLeadershipEditingId" value="" autocomplete="off" />' +
      '<label class="block"><span class="' +
      label +
      '">Display name</span><input id="adminLeadershipDisplayName" type="text" class="' +
      input +
      '" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Role title</span><input id="adminLeadershipRoleTitle" type="text" class="' +
      input +
      '" placeholder="Elder, deacon, director…" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Contact email</span><input id="adminLeadershipEmail" type="email" class="' +
      input +
      '" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Notes</span><textarea id="adminLeadershipNotes" rows="3" class="' +
      textarea +
      '"></textarea></label>' +
      '<label class="flex cursor-pointer items-center gap-3">' +
      '<input id="adminLeadershipActive" type="checkbox" checked class="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]" />' +
      '<span class="text-sm font-medium text-[var(--text)]">Active</span></label>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="submit" id="adminLeadershipSaveBtn" class="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Save</button>' +
      '<button type="button" id="adminLeadershipClearBtn" class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]">Clear / new</button>' +
      '</div></form></div></div></div>';

    var meetingsPanel =
      '<div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">' +
      '<div class="lg:col-span-5">' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Meetings</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">Operations and leadership meetings. Run <code class="rounded bg-[var(--surface-hover)] px-1 font-mono text-xs">sql/admin_portal_schema.sql</code> if queries fail.</p>' +
      '<p id="adminMeetingsStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<ul id="adminMeetingsList" class="mt-4 max-h-[min(60vh,28rem)] list-none space-y-2 overflow-y-auto p-0"></ul></div></div>' +
      '<div class="lg:col-span-7">' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Schedule or log</h2>' +
      '<form id="adminMeetingsForm" class="mt-6 space-y-4">' +
      '<input type="hidden" id="adminMeetingsEditingId" value="" autocomplete="off" />' +
      '<label class="block"><span class="' +
      label +
      '">Title</span><input id="adminMeetingsTitle" type="text" required class="' +
      input +
      '" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Scheduled (local)</span><input id="adminMeetingsScheduledAt" type="datetime-local" class="' +
      input +
      '" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Location / link</span><input id="adminMeetingsLocation" type="text" class="' +
      input +
      '" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Agenda summary</span><textarea id="adminMeetingsAgenda" rows="3" class="' +
      textarea +
      '"></textarea></label>' +
      '<label class="block"><span class="' +
      label +
      '">Minutes URL</span><input id="adminMeetingsMinutesUrl" type="url" class="' +
      input +
      '" placeholder="https://…" /></label>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="submit" id="adminMeetingsSaveBtn" class="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Save</button>' +
      '<button type="button" id="adminMeetingsClearBtn" class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]">Clear / new</button>' +
      '</div></form></div></div></div>';

    var votingPanel =
      '<div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">' +
      '<div class="lg:col-span-5">' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Votes &amp; motions</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">Track motions and deadlines. This is an internal working list, not a legal ballot system.</p>' +
      '<p id="adminVotesStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<ul id="adminVotesList" class="mt-4 max-h-[min(60vh,28rem)] list-none space-y-2 overflow-y-auto p-0"></ul></div></div>' +
      '<div class="lg:col-span-7">' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Add or edit motion</h2>' +
      '<form id="adminVotesForm" class="mt-6 space-y-4">' +
      '<input type="hidden" id="adminVotesEditingId" value="" autocomplete="off" />' +
      '<label class="block"><span class="' +
      label +
      '">Title</span><input id="adminVotesTitle" type="text" required class="' +
      input +
      '" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Motion text</span><textarea id="adminVotesMotionText" rows="4" class="' +
      textarea +
      '"></textarea></label>' +
      '<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">' +
      '<label class="block"><span class="' +
      label +
      '">Status</span><select id="adminVotesStatusSelect" class="' +
      input +
      '">' +
      '<option value="draft">draft</option>' +
      '<option value="open">open</option>' +
      '<option value="closed">closed</option>' +
      '<option value="passed">passed</option>' +
      '<option value="failed">failed</option>' +
      '</select></label>' +
      '<label class="block"><span class="' +
      label +
      '">Closes (local)</span><input id="adminVotesClosesAt" type="datetime-local" class="' +
      input +
      '" /></label></div>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="submit" id="adminVotesSaveBtn" class="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Save</button>' +
      '<button type="button" id="adminVotesClearBtn" class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]">Clear / new</button>' +
      '</div></form></div></div></div>';

    var financialPanel =
      '<div class="space-y-6">' +
      '<header class="admin-section-head">' +
      '<p class="admin-dash-eyebrow">Internal only</p>' +
      '<h2 class="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">Finance</h2>' +
      '<p class="content-text mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">Manual ledger entries and reimbursement requests. Charts aggregate the ledger only—no bank feed yet.</p>' +
      '</header>' +
      '<div id="adminFinanceGate" class="admin-dash-card hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm" hidden>' +
      '<p class="content-text text-sm text-[var(--muted)]">You do not have permission to view finance data for this account.</p></div>' +
      '<div id="adminFinanceWorkspace" class="space-y-6">' +
      '<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">' +
      '<div class="admin-dash-stat rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Inflow</p>' +
      '<p id="adminFinanceStatInflow" class="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">—</p></div>' +
      '<div class="admin-dash-stat rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Outflow</p>' +
      '<p id="adminFinanceStatOutflow" class="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">—</p></div>' +
      '<div class="admin-dash-stat rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Net (filtered)</p>' +
      '<p id="adminFinanceStatNet" class="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">—</p></div>' +
      '<div class="admin-dash-stat rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Ledger rows</p>' +
      '<p id="adminFinanceStatRows" class="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">—</p></div>' +
      '</div>' +
      '<div class="' +
      card +
      '">' +
      '<div class="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">' +
      '<div class="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">' +
      '<label class="block min-w-0"><span class="' +
      label +
      '">From</span><input id="adminFinanceFilterFrom" type="date" class="' +
      input +
      '" /></label>' +
      '<label class="block min-w-0"><span class="' +
      label +
      '">To</span><input id="adminFinanceFilterTo" type="date" class="' +
      input +
      '" /></label>' +
      '<label class="block min-w-0"><span class="' +
      label +
      '">Category contains</span><input id="adminFinanceFilterCategory" type="text" class="' +
      input +
      '" placeholder="Any" /></label>' +
      '<label class="block min-w-0"><span class="' +
      label +
      '">Fund contains</span><input id="adminFinanceFilterFund" type="text" class="' +
      input +
      '" placeholder="Any" /></label>' +
      '<label class="block min-w-0"><span class="' +
      label +
      '">Status</span><select id="adminFinanceFilterStatus" class="' +
      input +
      '">' +
      '<option value="">Any</option>' +
      '<option value="pending">pending</option>' +
      '<option value="cleared">cleared</option>' +
      '<option value="recorded">recorded</option>' +
      '<option value="void">void</option>' +
      '</select></label>' +
      '</div>' +
      '<button type="button" id="adminFinanceApplyFilters" class="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Apply filters</button>' +
      '</div>' +
      '<p class="content-text mt-4 text-xs text-[var(--muted)]">View:</p>' +
      '<div id="adminFinanceViewSwitcher" class="mt-2 flex flex-wrap gap-2" role="group" aria-label="Finance visualization">' +
      '<button type="button" id="adminFinanceViewSummary" class="admin-finance-view-btn rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-xs font-semibold text-[var(--text)]" data-finance-view="summary">Summary</button>' +
      '<button type="button" id="adminFinanceViewTable" class="admin-finance-view-btn rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-xs font-semibold text-[var(--text)]" data-finance-view="table">Table</button>' +
      '<button type="button" id="adminFinanceViewLine" class="admin-finance-view-btn rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-xs font-semibold text-[var(--text)]" data-finance-view="line">Line</button>' +
      '<button type="button" id="adminFinanceViewBar" class="admin-finance-view-btn rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-xs font-semibold text-[var(--text)]" data-finance-view="bar">Bar</button>' +
      '<button type="button" id="adminFinanceViewDonut" class="admin-finance-view-btn rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-xs font-semibold text-[var(--text)]" data-finance-view="donut">Donut</button>' +
      '</div>' +
      '<div id="adminFinanceChartHost" class="admin-finance-chart-host mt-6 min-h-[14rem] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-hover)]/40"></div>' +
      '<div id="adminFinanceTableWrap" class="mt-4 hidden overflow-x-auto" hidden></div>' +
      '</div>' +
      '<div id="adminFinanceBankCard" class="' +
      card +
      '">' +
      '<h3 class="text-base font-semibold text-[var(--text)]">Bank integration</h3>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">Placeholder: connect a read-only bank feed per finance policy. Until then, export CSV from your institution and mirror key totals in the manual ledger above.</p>' +
      '</div>' +
      '<div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">' +
      '<div class="lg:col-span-5">' +
      '<div class="' +
      card +
      '">' +
      '<h3 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Manual ledger</h3>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">Income, expense, giving, reimbursements, and restricted funds (amounts in USD; stored in cents).</p>' +
      '<p id="adminFinanceLedgerStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<ul id="adminFinanceLedgerList" class="mt-4 max-h-[min(50vh,24rem)] list-none space-y-2 overflow-y-auto p-0"></ul></div></div>' +
      '<div class="lg:col-span-7">' +
      '<div class="' +
      card +
      '">' +
      '<h3 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Add or edit ledger row</h3>' +
      '<form id="adminFinanceLedgerForm" class="mt-6 space-y-4">' +
      '<input type="hidden" id="adminFinanceLedgerEditingId" value="" autocomplete="off" />' +
      '<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">' +
      '<label class="block"><span class="' +
      label +
      '">Kind</span><select id="adminFinanceLedgerKind" class="' +
      input +
      '">' +
      '<option value="income">income</option>' +
      '<option value="expense">expense</option>' +
      '<option value="giving">giving</option>' +
      '<option value="reimbursement">reimbursement</option>' +
      '<option value="benevolence">benevolence</option>' +
      '<option value="designated">designated</option>' +
      '<option value="budget">budget</option>' +
      '<option value="transfer">transfer</option>' +
      '</select></label>' +
      '<label class="block"><span class="' +
      label +
      '">Occurred on</span><input id="adminFinanceLedgerDate" type="date" class="' +
      input +
      '" /></label></div>' +
      '<label class="block"><span class="' +
      label +
      '">Amount (USD)</span><input id="adminFinanceLedgerAmount" type="number" step="0.01" min="0" class="' +
      input +
      '" /></label>' +
      '<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">' +
      '<label class="block"><span class="' +
      label +
      '">Fund</span><input id="adminFinanceLedgerFund" type="text" class="' +
      input +
      '" placeholder="General, building…" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Category</span><input id="adminFinanceLedgerCategory" type="text" class="' +
      input +
      '" /></label></div>' +
      '<label class="block"><span class="' +
      label +
      '">Status</span><select id="adminFinanceLedgerStatus" class="' +
      input +
      '">' +
      '<option value="recorded">recorded</option>' +
      '<option value="pending">pending</option>' +
      '<option value="cleared">cleared</option>' +
      '<option value="void">void</option>' +
      '</select></label>' +
      '<label class="block"><span class="' +
      label +
      '">Memo</span><textarea id="adminFinanceLedgerMemo" rows="2" class="' +
      textarea +
      '"></textarea></label>' +
      '<label class="block"><span class="' +
      label +
      '">Supporting doc URL (placeholder)</span><input id="adminFinanceLedgerDocUrl" type="url" class="' +
      input +
      '" placeholder="https://…" /></label>' +
      '<label class="flex cursor-pointer items-center gap-3">' +
      '<input id="adminFinanceLedgerCoi" type="checkbox" class="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]" />' +
      '<span class="text-sm font-medium text-[var(--text)]">Conflict-of-interest disclosure noted</span></label>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="submit" id="adminFinanceLedgerSaveBtn" class="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Save ledger row</button>' +
      '<button type="button" id="adminFinanceLedgerClearBtn" class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]">Clear / new</button>' +
      '</div></form></div></div></div>' +
      '<div class="admin-section-head mt-10 border-t border-[var(--border)] pt-8">' +
      '<h3 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Reimbursement &amp; expense requests</h3>' +
      '<p class="content-text mt-2 text-sm text-[var(--muted)]">Workflow queue separate from the general ledger.</p>' +
      '</div>' +
      '<div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">' +
      '<div class="lg:col-span-5">' +
      '<div class="' +
      card +
      '">' +
      '<h4 class="text-base font-semibold text-[var(--text)]">Open requests</h4>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">Internal reimbursement or expense requests (amounts stored in cents).</p>' +
      '<p id="adminFinancialStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<ul id="adminFinancialList" class="mt-4 max-h-[min(60vh,28rem)] list-none space-y-2 overflow-y-auto p-0"></ul></div></div>' +
      '<div class="lg:col-span-7">' +
      '<div class="' +
      card +
      '">' +
      '<h4 class="text-base font-semibold text-[var(--text)]">New request</h4>' +
      '<form id="adminFinancialForm" class="mt-6 space-y-4">' +
      '<input type="hidden" id="adminFinancialEditingId" value="" autocomplete="off" />' +
      '<label class="block"><span class="' +
      label +
      '">Request type</span><input id="adminFinancialType" type="text" class="' +
      input +
      '" placeholder="Reimbursement, vendor, event…" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Amount (USD)</span><input id="adminFinancialAmount" type="number" step="0.01" min="0" class="' +
      input +
      '" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Summary</span><textarea id="adminFinancialSummary" rows="3" required class="' +
      textarea +
      '"></textarea></label>' +
      '<label class="block"><span class="' +
      label +
      '">Status</span><select id="adminFinancialStatusSelect" class="' +
      input +
      '">' +
      '<option value="draft">draft</option>' +
      '<option value="submitted">submitted</option>' +
      '<option value="approved">approved</option>' +
      '<option value="paid">paid</option>' +
      '<option value="denied">denied</option>' +
      '</select></label>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="submit" id="adminFinancialSaveBtn" class="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Save</button>' +
      '<button type="button" id="adminFinancialClearBtn" class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]">Clear / new</button>' +
      '</div></form></div></div></div>' +
      '</div></div>';

    var documentsPanel =
      '<div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">' +
      '<div class="lg:col-span-5">' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Internal documents</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">Registry of links or storage paths (upload flow can be added later).</p>' +
      '<p id="adminDocumentsStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<ul id="adminDocumentsList" class="mt-4 max-h-[min(60vh,28rem)] list-none space-y-2 overflow-y-auto p-0"></ul></div></div>' +
      '<div class="lg:col-span-7">' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Add entry</h2>' +
      '<form id="adminDocumentsForm" class="mt-6 space-y-4">' +
      '<input type="hidden" id="adminDocumentsEditingId" value="" autocomplete="off" />' +
      '<label class="block"><span class="' +
      label +
      '">Title</span><input id="adminDocumentsTitle" type="text" required class="' +
      input +
      '" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Storage path or URL</span><input id="adminDocumentsPath" type="text" class="' +
      input +
      '" placeholder="bucket/path or https://…" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Visibility</span><select id="adminDocumentsVisibility" class="' +
      input +
      '">' +
      '<option value="staff">staff</option>' +
      '<option value="elders">elders</option>' +
      '<option value="board">board</option>' +
      '</select></label>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="submit" id="adminDocumentsSaveBtn" class="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Save</button>' +
      '<button type="button" id="adminDocumentsClearBtn" class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]">Clear / new</button>' +
      '</div></form></div></div></div>';

    var memberCarePanel =
      '<div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">' +
      '<div class="lg:col-span-5">' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Member care</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">High-level case tracking only—no clinical notes. Handle sensitive details offline.</p>' +
      '<p id="adminMemberCareStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<ul id="adminMemberCareList" class="mt-4 max-h-[min(60vh,28rem)] list-none space-y-2 overflow-y-auto p-0"></ul></div></div>' +
      '<div class="lg:col-span-7">' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Add or update case</h2>' +
      '<form id="adminMemberCareForm" class="mt-6 space-y-4">' +
      '<input type="hidden" id="adminMemberCareEditingId" value="" autocomplete="off" />' +
      '<label class="block"><span class="' +
      label +
      '">Case code (optional; unique)</span><input id="adminMemberCareCode" type="text" class="' +
      input +
      '" placeholder="Auto if left blank" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Summary</span><textarea id="adminMemberCareSummary" rows="3" required class="' +
      textarea +
      '"></textarea></label>' +
      '<label class="block"><span class="' +
      label +
      '">Status</span><select id="adminMemberCareStatusSelect" class="' +
      input +
      '">' +
      '<option value="open">open</option>' +
      '<option value="in_progress">in_progress</option>' +
      '<option value="closed">closed</option>' +
      '<option value="archived">archived</option>' +
      '</select></label>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="submit" id="adminMemberCareSaveBtn" class="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Save</button>' +
      '<button type="button" id="adminMemberCareClearBtn" class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]">Clear / new</button>' +
      '</div></form></div></div></div>';

    var settingsPanel =
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Portal settings</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">Read-only summary and migration reminders. Secrets stay in Supabase Dashboard only.</p>' +
      '<p id="adminSettingsStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<dl class="mt-6 grid grid-cols-1 gap-4 border-t border-[var(--border)] pt-6 sm:grid-cols-2">' +
      '<div><dt class="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Supabase</dt><dd id="adminSettingsSupabase" class="content-text mt-1 text-sm text-[var(--text)]">—</dd></div>' +
      '<div><dt class="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">BCC addresses</dt><dd id="adminSettingsBccCount" class="content-text mt-1 text-sm text-[var(--text)]">—</dd></div>' +
      '<div><dt class="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Contact messages</dt><dd id="adminSettingsContactCount" class="content-text mt-1 text-sm text-[var(--text)]">—</dd></div>' +
      '<div><dt class="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Governance docs</dt><dd id="adminSettingsGovCount" class="content-text mt-1 text-sm text-[var(--text)]">—</dd></div>' +
      '</dl>' +
      '<div class="mt-6 border-t border-[var(--border)] pt-6">' +
      '<h3 class="text-sm font-semibold text-[var(--text)]">SQL migrations</h3>' +
      '<p id="adminSettingsMigrations" class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]"></p></div>' +
      '<div class="mt-6 border-t border-[var(--border)] pt-6">' +
      '<h3 class="text-sm font-semibold text-[var(--text)]">Your roles</h3>' +
      '<p id="adminSettingsRolesNote" class="content-text mt-2 text-xs text-[var(--muted)]">Loaded from <code class="rounded bg-[var(--surface-hover)] px-1 font-mono text-[10px]">admin_profiles</code> when <code class="rounded bg-[var(--surface-hover)] px-1 font-mono text-[10px]">sql/supabase-admin-schema.sql</code> is applied.</p>' +
      '<ul id="adminSettingsRoles" class="mt-3 list-inside list-disc text-sm text-[var(--text)]"></ul>' +
      '<p class="content-text mt-2 text-xs text-[var(--muted)]">Permissions: <span id="adminSettingsPerms" class="font-mono text-[11px] text-[var(--text)]">—</span></p></div>' +
      '<div class="mt-6 border-t border-[var(--border)] pt-6">' +
      '<h3 class="text-sm font-semibold text-[var(--text)]">Recent audit events</h3>' +
      '<p class="content-text mt-2 text-xs text-[var(--muted)]">Append-only log for authenticated users (no delete via API).</p>' +
      '<ul id="adminSettingsAudit" class="mt-3 max-h-48 list-none space-y-2 overflow-y-auto p-0 text-sm"></ul></div></div>';

    return (
      '<div class="admin-dash-shell admin-dash-shell--portal w-full min-h-screen bg-[var(--bg)]">' +
      '<div class="admin-dash-inner mx-auto w-full max-w-[1400px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">' +
      '<header class="admin-dash-header admin-dash-header--hero mb-6 flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">' +
      '<div class="min-w-0 flex-1">' +
      '<h1 class="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">Upward Knoxville Admin</h1>' +
      '<p class="content-text mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">Manage teaching status, announcements, contact messages, and update emails.</p>' +
      '</div>' +
      '<div class="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">' +
      '<button type="button" id="adminNavToggle" class="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] lg:hidden" aria-controls="adminSideNav" aria-expanded="false">' +
      '<span aria-hidden="true">☰</span> Menu</button>' +
      '<a href="' +
      P +
      'index.html" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]">Back to site</a>' +
      '<button type="button" id="adminLogoutBtn" class="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Log out</button>' +
      '</div>' +
      '</header>' +
      '<div class="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">' +
      '<aside id="adminSideNav" class="admin-side-nav z-30 w-full shrink-0 lg:sticky lg:top-6 lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:w-56 lg:self-start lg:overflow-y-auto" aria-label="Admin sections">' +
      '<nav class="admin-side-nav__inner flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-sm" role="tablist">' +
      navButton('overview', 'Overview', true) +
      navButton('communications', 'Communications', false) +
      navButton('governance', 'Governance', false) +
      navButton('leadership', 'Leadership', false) +
      navButton('meetings', 'Meetings', false) +
      navButton('voting', 'Voting', false) +
      navButton('financial', 'Financial', false) +
      navButton('documents', 'Documents', false) +
      navButton('member_care', 'Member care', false) +
      navButton('settings', 'Settings', false) +
      '</nav></aside>' +
      '<main class="min-w-0 flex-1 space-y-6">' +
      '<div id="admin-panel-overview" data-admin-panel="overview">' +
      '<header class="admin-section-head mb-6">' +
      '<p class="admin-dash-eyebrow">Command center</p>' +
      '<h2 class="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">Overview</h2>' +
      '<p class="content-text mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">At-a-glance status across communications, governance, and operations. Every card opens the matching workspace.</p>' +
      '</header>' +
      '<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">' +
      overviewBtn('communications', 'Teaching', 'adminOverviewTeaching', 'adminTeachingForm') +
      overviewBtn('communications', 'Announcements', 'adminOverviewAnnouncements', 'adminAnnouncementFormHeading') +
      overviewBtn('communications', 'Contacts', 'adminOverviewContacts', 'adminContactList') +
      overviewBtn('communications', 'Update BCC', 'adminOverviewBcc', 'adminBccForm') +
      overviewBtn('governance', 'Governance drafts', 'adminOverviewGovernance', '') +
      overviewBtn('voting', 'Votes', 'adminOverviewVotes', '') +
      overviewBtn('meetings', 'Meetings', 'adminOverviewMeetings', '') +
      overviewBtn('financial', 'Finance', 'adminOverviewFinancial', '') +
      overviewBtn('documents', 'Documents', 'adminOverviewDocuments', '') +
      overviewBtn('member_care', 'Member care', 'adminOverviewMemberCare', '') +
      '</div>' +
      '<div class="' +
      card +
      ' mt-6">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Quick actions</h2>' +
      '<p class="content-text mt-2 text-sm text-[var(--muted)]">Jump to a workspace you use often.</p>' +
      '<div class="mt-4 flex flex-wrap gap-2">' +
      '<button type="button" data-admin-jump="communications" data-admin-scrollto="adminTeachingForm" class="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Teaching &amp; email</button>' +
      '<button type="button" data-admin-jump="communications" data-admin-scrollto="adminAnnouncementFormHeading" class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]">Announcements</button>' +
      '<button type="button" data-admin-jump="governance" class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)]">Governance</button>' +
      '</div></div></div>' +
      '<div id="admin-panel-communications" class="hidden" hidden data-admin-panel="communications">' +
      communicationsInner +
      '</div>' +
      '<div id="admin-panel-governance" class="hidden" hidden data-admin-panel="governance">' +
      '<div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">' +
      '<div class="lg:col-span-5">' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Governance library</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">Draft and review internal documents. Locked items cannot be edited until unlocked.</p>' +
      '<p id="adminGovernanceStatus" class="content-text mt-3 min-h-[1.25rem] text-sm text-[var(--muted)]" role="status" aria-live="polite"></p>' +
      '<ul id="adminGovernanceList" class="mt-4 max-h-[min(70vh,40rem)] list-none space-y-2 overflow-y-auto p-0"></ul></div></div>' +
      '<div class="lg:col-span-7">' +
      '<div class="' +
      card +
      '">' +
      '<h2 class="text-lg font-semibold text-[var(--text)] sm:text-xl">Edit document</h2>' +
      '<p class="content-text mt-2 text-sm leading-relaxed text-[var(--muted)]">Markdown in the body is stored as plain text for now. Saving records a revision row for history.</p>' +
      '<p class="content-text mt-3 text-xs leading-relaxed text-[var(--muted)]">Saving as <strong class="text-[var(--text)]">draft</strong> keeps work private; <strong class="text-[var(--text)]">Publish</strong> sets status to approved for leadership reference. Consult counsel before treating any draft as binding.</p>' +
      '<form id="adminGovernanceForm" class="mt-6 space-y-4">' +
      '<input type="hidden" id="adminGovernanceEditingId" value="" autocomplete="off" />' +
      '<label class="block"><span class="' +
      label +
      '">Slug (URL key)</span>' +
      '<input id="adminGovernanceSlug" type="text" required class="' +
      input +
      '" placeholder="e.g. bylaws" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Title</span>' +
      '<input id="adminGovernanceTitle" type="text" class="' +
      input +
      '" /></label>' +
      '<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">' +
      '<label class="block"><span class="' +
      label +
      '">Category</span>' +
      '<input id="adminGovernanceCategory" type="text" class="' +
      input +
      '" /></label>' +
      '<label class="block"><span class="' +
      label +
      '">Status</span>' +
      '<select id="adminGovernanceStatusSelect" class="' +
      input +
      '">' +
      '<option value="draft">draft</option>' +
      '<option value="under_review">under_review</option>' +
      '<option value="approved">approved</option>' +
      '<option value="archived">archived</option>' +
      '</select></label></div>' +
      '<label class="block"><span class="' +
      label +
      '">Body (markdown)</span>' +
      '<textarea id="adminGovernanceBody" rows="14" class="' +
      textarea +
      '"></textarea></label>' +
      '<label class="block"><span class="' +
      label +
      '">Internal notes (staff only)</span>' +
      '<textarea id="adminGovernanceInternalNotes" rows="3" class="' +
      textarea +
      '"></textarea></label>' +
      '<label class="flex cursor-pointer items-center gap-3">' +
      '<input id="adminGovernanceLocked" type="checkbox" class="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]" />' +
      '<span class="text-sm font-medium text-[var(--text)]">Locked (prevent edits)</span></label>' +
      '<div class="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">' +
      '<button type="button" id="adminGovernanceSaveDraftBtn" class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface)]">Save draft</button>' +
      '<button type="button" id="adminGovernancePublishBtn" class="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]">Publish</button>' +
      '<button type="button" id="adminGovernanceDuplicateBtn" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]">Duplicate</button>' +
      '<button type="button" id="adminGovernanceClearBtn" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]">Clear / New</button>' +
      '</div></form></div></div></div>' +
      panelShell('leadership', leadershipPanel) +
      panelShell('meetings', meetingsPanel) +
      panelShell('voting', votingPanel) +
      panelShell('financial', financialPanel) +
      panelShell('documents', documentsPanel) +
      panelShell('member_care', memberCarePanel) +
      panelShell('settings', settingsPanel) +
      '</main></div></div></div>'
    );
  };
})(typeof window !== 'undefined' ? window : globalThis);
