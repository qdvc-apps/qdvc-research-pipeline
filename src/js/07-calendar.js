/* ============================================================
   Academic calendar — manage workload periods
   ============================================================ */

function openCalendarModal() {
  renderCalendarModal();
  document.addEventListener('keydown', calEsc);
}
function closeCalendarModal() {
  $('#modalHost').innerHTML = '';
  document.removeEventListener('keydown', calEsc);
}
function calEsc(e) { if (e.key === 'Escape') closeCalendarModal(); }

function renderCalendarModal() {
  const host = $('#modalHost');
  host.innerHTML = '';

  const listHost = el('div', { id: 'calList' });

  const body = el('div', { class: 'modal-body' },
    el('p', { style: 'margin:0 0 16px;color:var(--ink-soft);font-size:13px' },
      'Add teaching semesters, breaks, or other periods that change how much time you have for research. Overlapping periods stack: busy over busy shades darker, relaxed over busy lightens it. These appear as shaded bands behind the timeline.'),
    listHost,
    el('button', { class: 'btn btn-sm', type: 'button', onclick: () => { addPeriodRow(); } }, '+ Add period'));

  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    el('div', { class: 'modal-head' },
      el('h2', {}, 'Academic calendar'),
      el('button', { class: 'close-x', 'aria-label': 'Close', onclick: closeCalendarModal }, '×')),
    body,
    el('div', { class: 'modal-foot' },
      el('div', {}, el('span', { style: 'font-size:12px;color:var(--ink-faint)' }, 'Changes save automatically.')),
      el('div', { class: 'right' },
        el('button', { class: 'btn btn-primary', type: 'button', onclick: closeCalendarModal }, 'Done'))));

  const scrim = el('div', { class: 'modal-scrim', onclick: e => { if (e.target === scrim) closeCalendarModal(); } }, modal);
  host.appendChild(scrim);
  renderPeriodList();
}

function renderPeriodList() {
  const host = $('#calList');
  if (!host) return;
  host.innerHTML = '';
  if (Store.calendar.length === 0) {
    host.appendChild(el('div', { class: 'events-empty' }, 'No periods yet. Add your first academic period below.'));
    return;
  }
  // show in date order for legibility
  const ordered = Store.calendar.slice().sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  ordered.forEach(pd => host.appendChild(periodRowEl(pd)));
}

function periodRowEl(pd) {
  const nameIn = el('input', { type: 'text', value: pd.name, placeholder: 'e.g. Semester 1',
    oninput: e => { pd.name = e.target.value; Store.upsertPeriod(pd); refreshTimelineIfVisible(); } });
  const startIn = el('input', { type: 'date', value: pd.start,
    oninput: e => { pd.start = e.target.value; Store.upsertPeriod(pd); refreshTimelineIfVisible(); } });
  const endIn = el('input', { type: 'date', value: pd.end,
    oninput: e => { pd.end = e.target.value; Store.upsertPeriod(pd); refreshTimelineIfVisible(); } });
  const workSel = el('select', { oninput: e => { pd.workload = parseInt(e.target.value, 10); Store.upsertPeriod(pd); refreshTimelineIfVisible(); } },
    ...WORKLOADS.map(w => el('option', { value: w.value, selected: pd.workload === w.value }, `${w.label} (${w.value > 0 ? '+' + w.value : w.value})`)));

  const invalid = pd.start && pd.end && pd.end < pd.start;

  return el('div', { class: 'period-row' },
    el('div', { class: 'field', style: 'margin:0' }, el('label', {}, 'Period name'), nameIn),
    el('div', { class: 'field', style: 'margin:0' }, el('label', {}, 'Start'), startIn),
    el('div', { class: 'field', style: 'margin:0' }, el('label', {}, 'End'),
      endIn, invalid ? el('div', { class: 'error', style: 'min-height:0' }, 'End is before start.') : null),
    el('div', { class: 'field', style: 'margin:0' }, el('label', {}, 'Workload impact'), workSel),
    el('button', { class: 'btn btn-sm btn-danger', type: 'button', title: 'Remove period',
      onclick: () => { Store.removePeriod(pd._key); renderPeriodList(); refreshTimelineIfVisible(); } }, 'Remove'));
}

function addPeriodRow() {
  const pd = blankPeriod();
  Store.upsertPeriod(pd);
  renderPeriodList();
  refreshTimelineIfVisible();
}

function refreshTimelineIfVisible() {
  if (App.view === 'timeline') TimelineView.renderCanvas();
}
