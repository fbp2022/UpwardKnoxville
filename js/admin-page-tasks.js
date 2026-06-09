(function () {
  'use strict';
  var card =
    'rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-7 sm:shadow-[var(--shadow-md)]';

  function $(id) {
    return document.getElementById(id);
  }
  function esc(s) {
    return window.UpwardAdmin && window.UpwardAdmin.escapeHtml ? window.UpwardAdmin.escapeHtml(s) : String(s || '');
  }
  function block(msg) {
    return '<div class="' + card + '"><p class="content-text text-sm">' + esc(msg) + '</p></div>';
  }

  async function loadMembers(client) {
    var sel = await client.from('team_members').select('id,full_name').eq('is_active', true).order('full_name');
    if (sel.error) throw sel.error;
    return sel.data || [];
  }

  async function renderList(client, mount) {
    var sel = await client
      .from('admin_tasks')
      .select('*, team_members(full_name)')
      .order('due_date', { ascending: true, nullsFirst: false });
    if (sel.error) throw sel.error;
    var rows = sel.data || [];
    var html =
      '<table class="min-w-full text-left text-sm"><thead><tr class="border-b border-[var(--border)] text-[var(--muted)]"><th class="py-2 pr-2">Title</th><th class="py-2 pr-2">Status</th><th class="py-2 pr-2">Priority</th><th class="py-2 pr-2">Due</th><th class="py-2"></th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html +=
        '<tr class="border-b border-[var(--border)]"><td class="py-2 pr-2">' +
        esc(r.title) +
        '</td><td class="py-2 pr-2">' +
        esc(r.status) +
        '</td><td class="py-2 pr-2">' +
        esc(r.priority) +
        '</td><td class="py-2 pr-2">' +
        esc(r.due_date || '') +
        '</td><td class="py-2"><button type="button" class="text-[var(--accent)]" data-tid="' +
        esc(r.id) +
        '">Edit</button></td></tr>';
    });
    html += '</tbody></table>';
    mount.innerHTML = html;
    mount.querySelectorAll('[data-tid]').forEach(function (b) {
      b.addEventListener('click', function () {
        openForm(client, b.getAttribute('data-tid'));
      });
    });
  }

  async function openForm(client, id) {
    var m = $('taskFormMount');
    var members = await loadMembers(client);
    var row = null;
    if (id) {
      var sel = await client.from('admin_tasks').select('*').eq('id', id).maybeSingle();
      if (sel.error) throw sel.error;
      row = sel.data;
    }
    var opts = members
      .map(function (tm) {
        return (
          '<option value="' +
          esc(tm.id) +
          '"' +
          (row && row.assigned_team_member_id === tm.id ? ' selected' : '') +
          '>' +
          esc(tm.full_name) +
          '</option>'
        );
      })
      .join('');
    m.innerHTML =
      '<form id="taskForm" class="space-y-3 ' +
      card +
      '">' +
      '<input type="hidden" id="taskId" value="' +
      esc(id || '') +
      '" />' +
      '<label class="block text-sm">Title<input required id="taskTitle" class="mt-1 w-full rounded border border-[var(--border)] px-3 py-2" value="' +
      esc(row && row.title) +
      '" /></label>' +
      '<label class="block text-sm">Description<textarea id="taskDesc" rows="3" class="mt-1 w-full rounded border border-[var(--border)] px-3 py-2">' +
      esc(row && row.description) +
      '</textarea></label>' +
      '<div class="grid gap-3 sm:grid-cols-2">' +
      '<label class="text-sm">Status<select id="taskStatus" class="mt-1 w-full rounded border border-[var(--border)] px-3 py-2">' +
      ['todo', 'in_progress', 'blocked', 'done']
        .map(function (s) {
          return (
            '<option value="' +
            s +
            '"' +
            (row && row.status === s ? ' selected' : !row && s === 'todo' ? ' selected' : '') +
            '>' +
            s +
            '</option>'
          );
        })
        .join('') +
      '</select></label>' +
      '<label class="text-sm">Priority<select id="taskPri" class="mt-1 w-full rounded border border-[var(--border)] px-3 py-2">' +
      ['low', 'normal', 'high', 'urgent']
        .map(function (s) {
          return (
            '<option value="' +
            s +
            '"' +
            (row && row.priority === s ? ' selected' : !row && s === 'normal' ? ' selected' : '') +
            '>' +
            s +
            '</option>'
          );
        })
        .join('') +
      '</select></label></div>' +
      '<label class="text-sm">Due date<input type="date" id="taskDue" class="mt-1 w-full rounded border border-[var(--border)] px-3 py-2" value="' +
      esc(row && row.due_date ? String(row.due_date).slice(0, 10) : '') +
      '" /></label>' +
      '<label class="text-sm">Assign to<select id="taskAssign" class="mt-1 w-full rounded border border-[var(--border)] px-3 py-2"><option value="">—</option>' +
      opts +
      '</select></label>' +
      '<label class="flex items-center gap-2 text-sm"><input type="checkbox" id="taskEmail" class="h-4 w-4"' +
      (row && row.send_email_update ? ' checked' : '') +
      ' />Send email update (stored only; outbound email not wired)</label>' +
      '<label class="flex items-center gap-2 text-sm"><input type="checkbox" id="taskPublic" class="h-4 w-4"' +
      (row && row.show_publicly ? ' checked' : '') +
      ' />Show publicly</label>' +
      '<p id="taskSt" class="text-xs text-[var(--muted)]"></p>' +
      '<div class="flex gap-2"><button type="submit" class="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Save</button>' +
      '<button type="button" id="taskCancel" class="rounded border px-4 py-2 text-sm">Cancel</button></div></form>';
    $('taskCancel').onclick = function () {
      m.innerHTML = '';
    };
    $('taskForm').onsubmit = async function (ev) {
      ev.preventDefault();
      var uid = (await client.auth.getUser()).data.user.id;
      var payload = {
        title: $('taskTitle').value.trim(),
        description: $('taskDesc').value.trim() || null,
        status: $('taskStatus').value,
        priority: $('taskPri').value,
        due_date: $('taskDue').value || null,
        assigned_team_member_id: $('taskAssign').value || null,
        send_email_update: !!$('taskEmail').checked,
        show_publicly: !!$('taskPublic').checked,
      };
      try {
        var tid = $('taskId').value.trim();
        if (tid) {
          var u = await client.from('admin_tasks').update(payload).eq('id', tid);
          if (u.error) throw u.error;
        } else {
          payload.created_by = uid;
          var ins = await client.from('admin_tasks').insert([payload]);
          if (ins.error) throw ins.error;
        }
        if (window.UpwardAdmin.writeAuditLog) await window.UpwardAdmin.writeAuditLog('admin_task', tid || 'new', tid ? 'update' : 'create', {});
        m.innerHTML = '';
        await renderList(client, $('taskList'));
      } catch (e) {
        $('taskSt').textContent = e.message || 'Error';
      }
    };
  }

  async function init() {
    var app = document.getElementById('admin-app');
    if (!app || !window.UpwardAdmin) return;
    var r = await window.UpwardAdmin.requireAdmin();
    if (!r.user) return;
    var g = window.UpwardAdmin.requirePermission('tasks.manage');
    if (!g.ok) {
      app.innerHTML = window.UpwardAdmin.getShellHtml('tasks', block(g.message));
      window.UpwardAdmin.bindShellLogoutOnce();
      return;
    }
    var client = r.client;
    app.innerHTML = window.UpwardAdmin.getShellHtml(
      'tasks',
      '<div class="flex justify-between gap-2"><h2 class="text-lg font-semibold">Tasks</h2><button type="button" id="taskAdd" class="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">New task</button></div>' +
        '<div id="taskList" class="' +
        card +
        ' mt-4 overflow-x-auto"></div><div id="taskFormMount" class="mt-4"></div>'
    );
    window.UpwardAdmin.bindShellLogoutOnce();
    await renderList(client, $('taskList'));
    $('taskAdd').onclick = function () {
      openForm(client, '');
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () {
    init().catch(console.error);
  });
  else init().catch(console.error);
})();
