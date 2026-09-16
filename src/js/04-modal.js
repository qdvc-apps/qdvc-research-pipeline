/* ============================================================
   Paper create / edit modal
   ============================================================ */

let editing = null; // working copy

function openPaperModal(key) {
  const source = key ? Store.get(key) : null;
  editing = source ? JSON.parse(JSON.stringify(source)) : blankPaper();
  if (!editing._key) editing._key = uid();
  renderModal(!source);
}

function closeModal() {
  editing = null;
  $('#modalHost').innerHTML = '';
  document.removeEventListener('keydown', escClose);
}
function escClose(e) { if (e.key === 'Escape') closeModal(); }

function renderModal(isNew) {
  const host = $('#modalHost');
  host.innerHTML = '';

  const idField = el('div', { class: 'field', id: 'f-id' },
    el('label', {}, 'Paper ID ', el('span', { class: 'hint' }, '— format 00AA (2 digits, 2 capitals)')),
    el('input', { type: 'text', id: 'in-id', value: editing.id, maxlength: '4', placeholder: '26AB',
      style: 'font-family:var(--mono);text-transform:uppercase;max-width:140px',
      oninput: e => { e.target.value = e.target.value.toUpperCase(); editing.id = e.target.value; clearErr('f-id'); } }),
    el('div', { class: 'error', id: 'err-id' }));

  const titleField = el('div', { class: 'field', id: 'f-title' },
    el('label', {}, 'Title'),
    el('input', { type: 'text', id: 'in-title', value: editing.title, placeholder: 'e.g. Videoconferencing fatigue in distributed teams',
      oninput: e => { editing.title = e.target.value; clearErr('f-title'); } }),
    el('div', { class: 'error', id: 'err-title' }));

  const coField = el('div', { class: 'field' },
    el('label', {}, 'Coauthors ', el('span', { class: 'hint' }, '— comma separated')),
    el('input', { type: 'text', value: editing.coauthors, placeholder: 'A. Smith, B. Doe',
      oninput: e => { editing.coauthors = e.target.value; } }));

  const statusSel = el('select', { oninput: e => { editing.status = e.target.value; } },
    ...STATUSES.map(s => el('option', { value: s.value, selected: editing.status === s.value }, s.label)));
  const statusField = el('div', { class: 'field' }, el('label', {}, 'Work status'), statusSel);

  const routeSel = el('select', { id: 'in-route', oninput: e => onRouteChange(e.target.value) },
    ...ROUTES.map(r => el('option', { value: r.value, selected: editing.route === r.value }, r.label)));
  const routeField = el('div', { class: 'field' }, el('label', {}, 'Publication route'), routeSel);

  const derivedHost = el('div', { id: 'derivedHost' });

  const eventsHost = el('div', { id: 'eventsHost' });

  const body = el('div', { class: 'modal-body' },
    el('div', { class: 'row2' }, idField, statusField),
    titleField,
    coField,
    el('div', { class: 'row2' }, routeField, derivedHost),
    el('fieldset', { class: 'fieldset' },
      el('legend', {}, 'Publication events'),
      eventsHost,
      el('button', { class: 'btn btn-sm', type: 'button', onclick: addEventRow }, '+ Add event')));

  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    el('div', { class: 'modal-head' },
      el('h2', {}, isNew ? 'New paper' : 'Edit paper'),
      el('button', { class: 'close-x', 'aria-label': 'Close', onclick: closeModal }, '×')),
    body,
    el('div', { class: 'modal-foot' },
      el('div', {}, isNew ? '' : el('button', { class: 'btn btn-danger', type: 'button',
        onclick: () => { const p = Store.get(editing._key); closeModal(); if (p) confirmDelete(p); } }, 'Delete')),
      el('div', { class: 'right' },
        el('button', { class: 'btn', type: 'button', onclick: closeModal }, 'Cancel'),
        el('button', { class: 'btn btn-primary', type: 'button', onclick: savePaper }, 'Save paper'))));

  const scrim = el('div', { class: 'modal-scrim', onclick: e => { if (e.target === scrim) closeModal(); } }, modal);
  host.appendChild(scrim);
  document.addEventListener('keydown', escClose);

  renderDerived();
  renderEvents();
  $('#in-id').focus();
}

function onRouteChange(route) {
  editing.route = route;
  // drop event tags that no longer belong to this route (keep the event, untag it)
  const valid = new Set(eventTypesForRoute(route).map(t => t.value));
  editing.events.forEach(ev => { if (ev.type && !valid.has(ev.type)) { ev.type = ''; ev.decision = ''; ev.volume = ''; ev.issue = ''; } });
  if (route !== 'journal') editing.derivedFrom = '';
  renderDerived();
  renderEvents();
}

function renderDerived() {
  const host = $('#derivedHost');
  host.innerHTML = '';
  if (editing.route !== 'journal') { host.appendChild(el('div', { class: 'field' })); return; }
  const candidates = Store.papers.filter(p => p._key !== editing._key && p.route === 'conference' && p.id);
  const sel = el('select', { oninput: e => { editing.derivedFrom = e.target.value; } },
    el('option', { value: '' }, '— none —'),
    ...candidates.map(p => el('option', { value: p.id, selected: editing.derivedFrom === p.id },
      `${p.id} · ${p.title || 'Untitled'}`)));
  // if current value references a paper not in candidates (e.g. missing), still show it
  if (editing.derivedFrom && !candidates.some(p => p.id === editing.derivedFrom)) {
    sel.appendChild(el('option', { value: editing.derivedFrom, selected: true }, editing.derivedFrom + ' (unlinked)'));
  }
  host.appendChild(el('div', { class: 'field' },
    el('label', {}, 'Developed from ', el('span', { class: 'hint' }, '— conference paper')),
    sel));
}

function addEventRow() {
  editing.events.push(newEvent());
  renderEvents();
}

function renderEvents() {
  const host = $('#eventsHost');
  host.innerHTML = '';
  if (editing.events.length === 0) {
    host.appendChild(el('div', { class: 'events-empty' }, 'No events yet. Add submissions, decisions, and milestones to build the timeline.'));
    return;
  }
  editing.events.forEach((ev, i) => host.appendChild(eventRowEl(ev, i)));
}

function eventRowEl(ev, i) {
  const types = eventTypesForRoute(editing.route);
  const typeSel = el('select', { oninput: e => { ev.type = e.target.value; if (!isDecisionType(ev.type)) ev.decision = ''; if (!isVolIssueType(ev.type)) { ev.volume = ''; ev.issue = ''; } renderEvents(); } },
    el('option', { value: '' }, 'Untagged'),
    ...types.map(t => el('option', { value: t.value, selected: ev.type === t.value }, t.label)));

  const dateIn = el('input', { type: 'date', value: ev.date, oninput: e => { ev.date = e.target.value; } });

  const kids = [
    el('div', { class: 'field', style: 'margin:0' }, el('label', {}, 'Date'), dateIn),
    el('div', { class: 'field', style: 'margin:0' }, el('label', {}, 'Type'), typeSel),
    el('button', { class: 'btn btn-sm btn-danger rm', type: 'button', title: 'Remove event',
      onclick: () => { editing.events.splice(i, 1); renderEvents(); } }, 'Remove'),
  ];

  if (isDecisionType(ev.type)) {
    const decSel = el('select', { oninput: e => { ev.decision = e.target.value; } },
      el('option', { value: '' }, '— decision —'),
      ...DECISIONS.map(d => el('option', { value: d.value, selected: ev.decision === d.value }, d.label)));
    kids.push(el('div', { class: 'detail-line' },
      el('div', { class: 'field', style: 'margin:0' }, el('label', {}, 'Decision'), decSel),
      el('div', {})));
  }
  if (isVolIssueType(ev.type)) {
    kids.push(el('div', { class: 'detail-line' },
      el('div', { class: 'field', style: 'margin:0' }, el('label', {}, 'Volume'),
        el('input', { type: 'text', value: ev.volume, placeholder: 'e.g. 12', oninput: e => { ev.volume = e.target.value; } })),
      el('div', { class: 'field', style: 'margin:0' }, el('label', {}, 'Issue'),
        el('input', { type: 'text', value: ev.issue, placeholder: 'e.g. 3', oninput: e => { ev.issue = e.target.value; } }))));
  }
  kids.push(el('div', { class: 'note-line' },
    el('div', { class: 'field', style: 'margin:0' }, el('label', {}, 'Note ', el('span', { class: 'hint' }, '— optional')),
      el('input', { type: 'text', value: ev.note, placeholder: 'e.g. venue, reviewer notes', oninput: e => { ev.note = e.target.value; } }))));

  return el('div', { class: 'event-row' }, ...kids);
}

function clearErr(fieldId) {
  const f = $('#' + fieldId);
  if (f) { f.classList.remove('invalid'); const e = f.querySelector('.error'); if (e) e.textContent = ''; }
}
function setErr(fieldId, msg) {
  const f = $('#' + fieldId);
  if (f) { f.classList.add('invalid'); const e = f.querySelector('.error'); if (e) e.textContent = msg; }
}

function savePaper() {
  let ok = true;
  const id = (editing.id || '').toUpperCase().trim();
  editing.id = id;
  if (!isValidId(id)) { setErr('f-id', 'ID must be 2 digits then 2 capital letters, e.g. 26AB.'); ok = false; }
  else if (Store.idExists(id, editing._key)) { setErr('f-id', 'Another paper already uses this ID.'); ok = false; }
  if (!editing.title.trim()) { setErr('f-title', 'Give the paper a title.'); ok = false; }
  if (!ok) { toast('Please fix the highlighted fields.', true); return; }

  Store.upsert(editing);
  const savedId = editing.id;
  closeModal();
  App.renderAll();
  toast('Saved ' + savedId);
}
