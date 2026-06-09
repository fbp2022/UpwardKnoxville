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

  async function renderList(client, mount) {
    var sel = await client.from('admin_notices').select('*').order('updated_at', { ascending: false });
    if (sel.error) throw sel.error;
    var rows = sel.data || [];
    var h =
      '<table class="min-w-full text-sm"><thead><tr class="border-b text-[var(--muted)]"><th class="py-2">Title</th><th class="py-2">Type</th><th class="py-2">Public</th><th class="py-2"></th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h +=
        '<tr class="border-b"><td class="py-2">' +
        esc(r.title) +
        '</td><td>' +
        esc(r.notice_type) +
        '</td><td>' +
        (r.show_publicly ? 'yes' : 'no') +
        '</td><td><button type="button" class="text-[var(--accent)]" data-nid="' +
        esc(r.id) +
        '">Edit</button></td></tr>';
    });
    h += '</tbody></table>';
    mount.innerHTML = h;
    mount.querySelectorAll('[data-nid]').forEach(function (b) {
      b.onclick = function () {
        openForm(client, b.getAttribute('data-nid'));
      };
    });
  }

  async function openForm(client, id) {
    var m = $('noticeFormMount');
    var row = null;
    if (id) {
      var sel = await client.from('admin_notices').select('*').eq('id', id).maybeSingle();
      if (sel.error) throw sel.error;
      row = sel.data;
    }
    m.innerHTML =
      '<form id="noticeForm" class="space-y-3 ' +
      card +
      '">' +
      '<input type="hidden" id="nid" value="' +
      esc(id || '') +
      '" />' +
      '<label class="block text-sm">Title<input required id="ntitle" class="mt-1 w-full rounded border px-3 py-2" value="' +
      esc(row && row.title) +
      '" /></label>' +
      '<label class="block text-sm">Body<textarea id="nbody" rows="4" class="mt-1 w-full rounded border px-3 py-2">' +
      esc(row && row.body) +
      '</textarea></label>' +
      '<label class="text-sm">Type<select id="ntype" class="mt-1 w-full rounded border px-3 py-2">' +
      ['info', 'alert', 'gathering', 'prayer']
        .map(function (t) {
          return (
            '<option value="' +
            t +
            '"' +
            (row && row.notice_type === t ? ' selected' : '') +
            '>' +
            t +
            '</option>'
          );
        })
        .join('') +
      '</select></label>' +
      '<label class="flex gap-2 text-sm"><input type="checkbox" id="npub"' +
      (row && row.show_publicly ? ' checked' : '') +
      ' />Show publicly</label>' +
      '<label class="flex gap-2 text-sm"><input type="checkbox" id="nemail"' +
      (row && row.send_email_update ? ' checked' : '') +
      ' />Send email update (stored only; hook not wired)</label>' +
      '<p id="nst" class="text-xs text-[var(--muted)]"></p>' +
      '<div class="flex gap-2"><button type="submit" class="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Save</button>' +
      '<button type="button" id="ncan" class="rounded border px-4 py-2 text-sm">Cancel</button></div></form>';
    $('ncan').onclick = function () {
      m.innerHTML = '';
    };
    $('noticeForm').onsubmit = async function (ev) {
      ev.preventDefault();
      var uid = (await client.auth.getUser()).data.user.id;
      var payload = {
        title: $('ntitle').value.trim(),
        body: $('nbody').value.trim() || null,
        notice_type: $('ntype').value,
        show_publicly: !!$('npub').checked,
        send_email_update: !!$('nemail').checked,
      };
      try {
        var nid = $('nid').value.trim();
        if (nid) {
          var u = await client.from('admin_notices').update(payload).eq('id', nid);
          if (u.error) throw u.error;
        } else {
          payload.created_by = uid;
          var ins = await client.from('admin_notices').insert([payload]);
          if (ins.error) throw ins.error;
        }
        if (window.UpwardAdmin.writeAuditLog) await window.UpwardAdmin.writeAuditLog('admin_notice', nid || 'new', nid ? 'update' : 'create', {});
        m.innerHTML = '';
        await renderList(client, $('nlist'));
      } catch (e) {
        $('nst').textContent = e.message || 'err';
      }
    };
  }

  async function init() {
    var app = document.getElementById('admin-app');
    if (!app || !window.UpwardAdmin) return;
    var r = await window.UpwardAdmin.requireAdmin();
    if (!r.user) return;
    var g = window.UpwardAdmin.requirePermission('notices.manage');
    if (!g.ok) {
      app.innerHTML = window.UpwardAdmin.getShellHtml('notices', block(g.message));
      window.UpwardAdmin.bindShellLogoutOnce();
      return;
    }
    var client = r.client;
    app.innerHTML = window.UpwardAdmin.getShellHtml(
      'notices',
      '<div class="flex justify-between"><h2 class="text-lg font-semibold">Notices</h2><button type="button" id="nadd" class="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">New</button></div>' +
        '<div id="nlist" class="' +
        card +
        ' mt-4"></div><div id="noticeFormMount" class="mt-4"></div>'
    );
    window.UpwardAdmin.bindShellLogoutOnce();
    await renderList(client, $('nlist'));
    $('nadd').onclick = function () {
      openForm(client, '');
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () {
    init().catch(console.error);
  });
  else init().catch(console.error);
})();
