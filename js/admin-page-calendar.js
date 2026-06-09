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

  function toLocal(dt) {
    if (!dt) return '';
    var d = new Date(dt);
    if (isNaN(d.getTime())) return '';
    var pad = function (n) {
      return n < 10 ? '0' + n : String(n);
    };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  async function renderList(client, mount) {
    var sel = await client.from('events').select('*').order('starts_at', { ascending: false });
    if (sel.error) throw sel.error;
    var rows = sel.data || [];
    var h =
      '<table class="min-w-full text-sm"><thead><tr class="border-b text-[var(--muted)]"><th class="py-2">Title</th><th class="py-2">Starts</th><th class="py-2">Public</th><th class="py-2"></th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h +=
        '<tr class="border-b"><td class="py-2">' +
        esc(r.title) +
        '</td><td>' +
        esc(r.starts_at ? new Date(r.starts_at).toLocaleString() : '') +
        '</td><td>' +
        (r.show_publicly ? 'yes' : 'no') +
        '</td><td><button type="button" class="text-[var(--accent)]" data-eid="' +
        esc(r.id) +
        '">Edit</button></td></tr>';
    });
    h += '</tbody></table>';
    mount.innerHTML = h;
    mount.querySelectorAll('[data-eid]').forEach(function (b) {
      b.onclick = function () {
        openForm(client, b.getAttribute('data-eid'));
      };
    });
  }

  async function openForm(client, id) {
    var m = $('calFormMount');
    var row = null;
    if (id) {
      var sel = await client.from('events').select('*').eq('id', id).maybeSingle();
      if (sel.error) throw sel.error;
      row = sel.data;
    }
    m.innerHTML =
      '<form id="evForm" class="space-y-3 ' +
      card +
      '">' +
      '<input type="hidden" id="eid" value="' +
      esc(id || '') +
      '" />' +
      '<label class="block text-sm">Title<input required id="etitle" class="mt-1 w-full rounded border px-3 py-2" value="' +
      esc(row && row.title) +
      '" /></label>' +
      '<label class="block text-sm">Description<textarea id="edesc" rows="3" class="mt-1 w-full rounded border px-3 py-2">' +
      esc(row && row.description) +
      '</textarea></label>' +
      '<label class="block text-sm">Location<input id="eloc" class="mt-1 w-full rounded border px-3 py-2" value="' +
      esc(row && row.location) +
      '" /></label>' +
      '<label class="flex gap-2 text-sm"><input type="checkbox" id="eall"' +
      (row && row.all_day ? ' checked' : '') +
      ' />All day</label>' +
      '<label class="block text-sm">Starts at<input type="datetime-local" required id="estart" class="mt-1 w-full rounded border px-3 py-2" value="' +
      esc(toLocal(row && row.starts_at)) +
      '" /></label>' +
      '<label class="block text-sm">Ends at<input type="datetime-local" id="eend" class="mt-1 w-full rounded border px-3 py-2" value="' +
      esc(toLocal(row && row.ends_at)) +
      '" /></label>' +
      '<label class="flex gap-2 text-sm"><input type="checkbox" id="epub"' +
      (row && row.show_publicly ? ' checked' : '') +
      ' />Show publicly on events page</label>' +
      '<p id="est" class="text-xs text-[var(--muted)]"></p>' +
      '<div class="flex gap-2"><button type="submit" class="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Save</button>' +
      '<button type="button" id="ecan" class="rounded border px-4 py-2 text-sm">Cancel</button></div></form>';
    $('ecan').onclick = function () {
      m.innerHTML = '';
    };
    $('evForm').onsubmit = async function (ev) {
      ev.preventDefault();
      var uid = (await client.auth.getUser()).data.user.id;
      var start = $('estart').value;
      if (!start) return;
      var payload = {
        title: $('etitle').value.trim(),
        description: $('edesc').value.trim() || null,
        location: $('eloc').value.trim() || null,
        starts_at: new Date(start).toISOString(),
        ends_at: $('eend').value ? new Date($('eend').value).toISOString() : null,
        all_day: !!$('eall').checked,
        show_publicly: !!$('epub').checked,
      };
      try {
        var eid = $('eid').value.trim();
        if (eid) {
          var u = await client.from('events').update(payload).eq('id', eid);
          if (u.error) throw u.error;
        } else {
          payload.created_by = uid;
          var ins = await client.from('events').insert([payload]);
          if (ins.error) throw ins.error;
        }
        if (window.UpwardAdmin.writeAuditLog) await window.UpwardAdmin.writeAuditLog('event', eid || 'new', eid ? 'update' : 'create', {});
        m.innerHTML = '';
        await renderList(client, $('elist'));
      } catch (e) {
        $('est').textContent = e.message || 'err';
      }
    };
  }

  async function init() {
    var app = document.getElementById('admin-app');
    if (!app || !window.UpwardAdmin) return;
    var r = await window.UpwardAdmin.requireAdmin();
    if (!r.user) return;
    var g = window.UpwardAdmin.requirePermission('calendar.manage');
    if (!g.ok) {
      app.innerHTML = window.UpwardAdmin.getShellHtml('calendar', block(g.message));
      window.UpwardAdmin.bindShellLogoutOnce();
      return;
    }
    var client = r.client;
    app.innerHTML = window.UpwardAdmin.getShellHtml(
      'calendar',
      '<div class="flex justify-between"><h2 class="text-lg font-semibold">Events</h2><button type="button" id="eadd" class="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">New event</button></div>' +
        '<div id="elist" class="' +
        card +
        ' mt-4"></div><div id="calFormMount" class="mt-4"></div>'
    );
    window.UpwardAdmin.bindShellLogoutOnce();
    await renderList(client, $('elist'));
    $('eadd').onclick = function () {
      openForm(client, '');
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () {
    init().catch(console.error);
  });
  else init().catch(console.error);
})();
