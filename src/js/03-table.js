/* ============================================================
   Table view
   ============================================================ */

const TableView = {
  sortKey: 'id',
  sortDir: 1,
  search: '',
  fStatus: '',
  fRoute: '',

  mount() {
    $('#tableSearch').addEventListener('input', e => { this.search = e.target.value.trim().toLowerCase(); this.render(); });
    const sf = $('#tableStatusFilter');
    STATUSES.forEach(s => sf.appendChild(el('option', { value: s.value }, s.label)));
    sf.addEventListener('change', e => { this.fStatus = e.target.value; this.render(); });
    const rf = $('#tableRouteFilter');
    ROUTES.forEach(r => rf.appendChild(el('option', { value: r.value }, r.label)));
    rf.addEventListener('change', e => { this.fRoute = e.target.value; this.render(); });
  },

  rows() {
    let rows = Store.papers.slice();
    if (this.fStatus) rows = rows.filter(p => p.status === this.fStatus);
    if (this.fRoute) rows = rows.filter(p => p.route === this.fRoute);
    if (this.search) {
      const q = this.search;
      rows = rows.filter(p =>
        p.id.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.coauthors.toLowerCase().includes(q));
    }
    const k = this.sortKey, dir = this.sortDir;
    rows.sort((a, b) => {
      let av, bv;
      if (k === 'events') { av = a.events.length; bv = b.events.length; }
      else if (k === 'status') { av = STATUS_MAP[a.status].label; bv = STATUS_MAP[b.status].label; }
      else { av = (a[k] || '').toString().toLowerCase(); bv = (b[k] || '').toString().toLowerCase(); }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  },

  render() {
    const host = $('#tableHost');
    host.innerHTML = '';
    const rows = this.rows();

    if (Store.papers.length === 0) {
      host.appendChild(el('div', { class: 'empty' },
        el('h3', {}, 'No papers yet'),
        el('p', {}, 'Track your first research project from ideation through to publication.'),
        el('button', { class: 'btn btn-primary', onclick: () => openPaperModal(null) }, 'New paper')));
      return;
    }
    if (rows.length === 0) {
      host.appendChild(el('div', { class: 'empty' },
        el('h3', {}, 'No matches'),
        el('p', {}, 'No papers match your search or filters.')));
      return;
    }

    const arrow = key => this.sortKey === key ? el('span', { class: 'arrow' }, this.sortDir > 0 ? '▲' : '▼') : '';
    const th = (key, label) => el('th', { onclick: () => this.sort(key) }, label, arrow(key));

    const table = el('table', {},
      el('thead', {}, el('tr', {},
        th('id', 'ID'), th('title', 'Title'), th('coauthors', 'Coauthors'),
        th('status', 'Status'), th('route', 'Route'), th('events', 'Events'),
        el('th', { style: 'text-align:right' }, 'Actions'))),
      el('tbody', {}, ...rows.map(p => this.rowEl(p))));

    host.appendChild(el('div', { class: 'table-wrap' }, table));
  },

  rowEl(p) {
    const route = ROUTES.find(r => r.value === p.route);
    const derived = p.route === 'journal' && p.derivedFrom
      ? el('span', { class: 'pid link', title: 'Developed from ' + p.derivedFrom, style: 'margin-left:6px' }, '↳ ' + p.derivedFrom)
      : null;
    return el('tr', { onclick: e => { if (!e.target.closest('button')) openPaperModal(p._key); }, style: 'cursor:pointer' },
      el('td', {}, el('span', { class: 'pid' }, p.id || '—')),
      el('td', { class: 'cell-title' }, p.title || el('span', { style: 'color:var(--ink-faint);font-family:var(--sans);font-weight:400' }, 'Untitled')),
      el('td', { class: 'cell-coauthors' }, p.coauthors || '—'),
      el('td', {}, statusBadge(p.status)),
      el('td', {}, el('span', { class: 'route-tag' }, route ? route.label : p.route), derived),
      el('td', { style: 'font-family:var(--mono);color:var(--ink-soft)' }, String(p.events.length)),
      el('td', { class: 'cell-actions' },
        el('button', { class: 'btn btn-sm btn-ghost', onclick: () => openPaperModal(p._key) }, 'Edit'),
        el('button', { class: 'btn btn-sm btn-danger', style: 'margin-left:6px', onclick: () => confirmDelete(p) }, 'Delete')));
  },

  sort(key) {
    if (this.sortKey === key) this.sortDir *= -1;
    else { this.sortKey = key; this.sortDir = 1; }
    this.render();
  },
};

function confirmDelete(p) {
  const label = p.title ? `"${p.title}"` : (p.id || 'this paper');
  if (confirm(`Delete ${label}? This cannot be undone.`)) {
    Store.remove(p._key);
    App.renderAll();
    toast('Deleted ' + (p.id || 'paper'));
  }
}
