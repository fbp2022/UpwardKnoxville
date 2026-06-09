(function () {
  'use strict';

  var card =
    'rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-7 sm:shadow-[var(--shadow-md)]';
  var rolesCache = [];

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return window.UpwardAdmin && window.UpwardAdmin.escapeHtml ? window.UpwardAdmin.escapeHtml(s) : String(s || '');
  }

  function block(msg) {
    return (
      '<div class="' +
      card +
      '"><p class="content-text text-sm">' +
      esc(msg) +
      '</p></div>'
    );
  }

  function photoUrl(client, path) {
    if (!path || !client) return '';
    var r = client.storage.from('team-photos').getPublicUrl(path);
    return r && r.data && r.data.publicUrl ? r.data.publicUrl : '';
  }

  async function loadRoles(client) {
    var sel = await client.from('admin_roles').select('id,key,label').order('sort_order', { ascending: true });
    if (sel.error) throw sel.error;
    rolesCache = sel.data || [];
    return rolesCache;
  }

  function roleCheckboxes(selectedIds) {
    var map = {};
    (selectedIds || []).forEach(function (id) {
      map[String(id)] = true;
    });
    var html =
      '<fieldset class="mt-4"><legend class="text-sm font-medium text-[var(--text)]">Roles (optional)</legend><div class="mt-2 flex flex-wrap gap-3">';
    rolesCache.forEach(function (r) {
      var id = r.id;
      var checked = map[String(id)] ? ' checked' : '';
      html +=
        '<label class="flex items-center gap-2 text-sm"><input type="checkbox" class="tm-role h-4 w-4 rounded border-[var(--border)]" data-role-id="' +
        esc(id) +
        '"' +
        checked +
        ' />' +
        esc(r.label || r.key) +
        '</label>';
    });
    html += '</div></fieldset>';
    return html;
  }

  async function saveMemberRoles(client, memberId, roleIds) {
    await client.from('team_member_roles').delete().eq('team_member_id', memberId);
    if (roleIds && roleIds.length) {
      var rows = roleIds.map(function (rid) {
        return { team_member_id: memberId, role_id: rid };
      });
      var ins = await client.from('team_member_roles').insert(rows);
      if (ins.error) throw ins.error;
    }
  }

  async function loadList(client, container) {
    var sel = await client
      .from('team_members')
      .select('*, team_member_roles(role_id, admin_roles(key,label))')
      .order('full_name', { ascending: true });
    if (sel.error) throw sel.error;
    var rows = sel.data || [];
    var tb =
      '<div class="overflow-x-auto"><table class="min-w-full text-left text-sm"><thead><tr class="border-b border-[var(--border)] text-[var(--muted)]">' +
      '<th class="py-2 pr-4">Name</th><th class="py-2 pr-4">Title</th><th class="py-2 pr-4">Visibility</th><th class="py-2 pr-4">Public</th><th class="py-2 pr-4">Active</th><th class="py-2"> </th></tr></thead><tbody>';
    rows.forEach(function (row) {
      var rlabels = [];
      (row.team_member_roles || []).forEach(function (tr) {
        if (tr.admin_roles && tr.admin_roles.label) rlabels.push(tr.admin_roles.label);
      });
      tb +=
        '<tr class="border-b border-[var(--border)]">' +
        '<td class="py-2 pr-4 font-medium text-[var(--text)]">' +
        esc(row.full_name) +
        '</td>' +
        '<td class="py-2 pr-4 content-text">' +
        esc(row.public_title || '') +
        '</td>' +
        '<td class="py-2 pr-4">' +
        esc(row.visibility_level || '') +
        '</td>' +
        '<td class="py-2 pr-4">' +
        (row.show_publicly ? 'Yes' : 'No') +
        '</td>' +
        '<td class="py-2 pr-4">' +
        (row.is_active ? 'Yes' : 'No') +
        '</td>' +
        '<td class="py-2"><button type="button" class="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]" data-edit-id="' +
        esc(row.id) +
        '">Edit</button></td>' +
        '</tr>';
    });
    tb += '</tbody></table></div>';
    container.innerHTML = tb;
    container.querySelectorAll('[data-edit-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openForm(client, btn.getAttribute('data-edit-id'));
      });
    });
  }

  async function openForm(client, id) {
    var wrap = $('teamFormMount');
    if (!wrap) return;
    var row = null;
    var roleIds = [];
    if (id) {
      var sel = await client
        .from('team_members')
        .select('*, team_member_roles(role_id)')
        .eq('id', id)
        .maybeSingle();
      if (sel.error) throw sel.error;
      row = sel.data;
      (row.team_member_roles || []).forEach(function (x) {
        if (x.role_id) roleIds.push(x.role_id);
      });
    }
    var vis = row && row.visibility_level ? row.visibility_level : 'hidden';
    var img = row && row.photo_path ? photoUrl(client, row.photo_path) : '';
    wrap.innerHTML =
      '<form id="teamMemberForm" class="space-y-4">' +
      '<input type="hidden" id="teamEditId" value="' +
      esc(id || '') +
      '" />' +
      '<label class="block"><span class="mb-1 block text-sm font-medium text-[var(--text)]">Full name</span>' +
      '<input required id="teamFullName" class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" value="' +
      esc(row && row.full_name ? row.full_name : '') +
      '" /></label>' +
      '<label class="block"><span class="mb-1 block text-sm font-medium text-[var(--text)]">Public title</span>' +
      '<input id="teamPublicTitle" class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" value="' +
      esc(row && row.public_title ? row.public_title : '') +
      '" /></label>' +
      '<label class="block"><span class="mb-1 block text-sm font-medium text-[var(--text)]">Bio</span>' +
      '<textarea id="teamBio" rows="4" class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">' +
      esc(row && row.bio ? row.bio : '') +
      '</textarea></label>' +
      '<label class="block"><span class="mb-1 block text-sm font-medium text-[var(--text)]">Internal notes</span>' +
      '<textarea id="teamInternal" rows="2" class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">' +
      esc(row && row.internal_notes ? row.internal_notes : '') +
      '</textarea></label>' +
      '<label class="block"><span class="mb-1 block text-sm font-medium text-[var(--text)]">Visibility</span>' +
      '<select id="teamVisibility" class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">' +
      ['hidden', 'helper', 'leader', 'primary_leader']
        .map(function (v) {
          return (
            '<option value="' +
            esc(v) +
            '"' +
            (vis === v ? ' selected' : '') +
            '>' +
            esc(v) +
            '</option>'
          );
        })
        .join('') +
      '</select></label>' +
      '<label class="flex items-center gap-2 text-sm"><input type="checkbox" id="teamShowPublic" class="h-4 w-4 rounded border-[var(--border)]"' +
      (row && row.show_publicly ? ' checked' : '') +
      ' /><span>Show publicly (still requires leader visibility for the public team page)</span></label>' +
      '<label class="flex items-center gap-2 text-sm"><input type="checkbox" id="teamActive" class="h-4 w-4 rounded border-[var(--border)]"' +
      (!row || row.is_active !== false ? ' checked' : '') +
      ' /><span>Active</span></label>' +
      roleCheckboxes(roleIds) +
      '<label class="block"><span class="mb-1 block text-sm font-medium text-[var(--text)]">Photo</span>' +
      (img ? '<p class="mb-2 text-xs"><img src="' + esc(img) + '" alt="" class="h-20 w-20 rounded-full object-cover ring-1 ring-[var(--border)]" /></p>' : '') +
      '<input type="file" id="teamPhotoFile" accept="image/*" class="text-sm" /></label>' +
      '<p id="teamFormStatus" class="text-sm text-[var(--muted)]" role="status"></p>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="submit" class="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">Save</button>' +
      '<button type="button" id="teamFormCancel" class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium">Cancel</button>' +
      '</div></form>';

    $('teamFormCancel').addEventListener('click', function () {
      wrap.innerHTML = '';
    });

    $('teamMemberForm').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var st = $('teamFormStatus');
      if (st) st.textContent = 'Saving…';
      var uid = (await client.auth.getUser()).data.user.id;
      var editId = $('teamEditId').value.trim();
      var payload = {
        full_name: $('teamFullName').value.trim(),
        public_title: $('teamPublicTitle').value.trim() || null,
        bio: $('teamBio').value.trim() || null,
        internal_notes: $('teamInternal').value.trim() || null,
        visibility_level: $('teamVisibility').value,
        show_publicly: !!$('teamShowPublic').checked,
        is_active: !!$('teamActive').checked,
        updated_by: uid,
      };
      wrap.querySelectorAll('.tm-role:checked').forEach(function (cb) {
        selectedRoles.push(cb.getAttribute('data-role-id'));
      });
      try {
        var memberId = editId;
        if (editId) {
          var upd = await client.from('team_members').update(payload).eq('id', editId).select('id').single();
          if (upd.error) throw upd.error;
        } else {
          var ins = await client.from('team_members').insert([payload]).select('id').single();
          if (ins.error) throw ins.error;
          memberId = ins.data.id;
        }
        var fileEl = $('teamPhotoFile');
        if (fileEl && fileEl.files && fileEl.files[0]) {
          var file = fileEl.files[0];
          var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 4);
          var path = 'public/' + memberId + '.' + ext;
          var up = await client.storage.from('team-photos').upload(path, file, { upsert: true, contentType: file.type || undefined });
          if (up.error) throw up.error;
          var pu = await client.from('team_members').update({ photo_path: path }).eq('id', memberId);
          if (pu.error) throw pu.error;
        }
        await saveMemberRoles(client, memberId, selectedRoles);
        if (window.UpwardAdmin.writeAuditLog) {
          await window.UpwardAdmin.writeAuditLog('team_member', memberId, editId ? 'update' : 'create', { payload: payload });
        }
        if (st) st.textContent = 'Saved.';
        wrap.innerHTML = '';
        await loadList(client, $('teamList'));
      } catch (e) {
        if (st) st.textContent = e && e.message ? e.message : 'Save failed.';
      }
    });
  }

  async function init() {
    var app = document.getElementById('admin-app');
    if (!app || !window.UpwardAdmin) return;
    var r = await window.UpwardAdmin.requireAdmin();
    if (!r.user) return;
    var gate = window.UpwardAdmin.requirePermission('team.manage');
    if (!gate.ok) {
      app.innerHTML = window.UpwardAdmin.getShellHtml('team', block(gate.message || 'Access denied.'));
      window.UpwardAdmin.bindShellLogoutOnce();
      return;
    }
    var client = r.client;
    await loadRoles(client);

    var inner =
      '<div class="flex flex-wrap items-center justify-between gap-3">' +
      '<h2 class="text-lg font-semibold text-[var(--text)]">Team members</h2>' +
      '<button type="button" id="teamAddBtn" class="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">Add member</button></div>' +
      '<div id="teamList" class="' +
      card +
      ' mt-4"></div>' +
      '<div id="teamFormMount" class="mt-4"></div>';

    app.innerHTML = window.UpwardAdmin.getShellHtml('team', inner);
    window.UpwardAdmin.bindShellLogoutOnce();
    var listEl = $('teamList');
    await loadList(client, listEl);
    $('teamAddBtn').addEventListener('click', function () {
      openForm(client, '');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init().catch(function (e) {
        console.error(e);
      });
    });
  } else {
    init().catch(function (e) {
      console.error(e);
    });
  }
})();
