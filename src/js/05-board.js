/* ============================================================
   Kanban board view — drag to change work status
   ============================================================ */

const BoardView = {
  dragKey: null,

  render() {
    const host = $('#boardHost');
    host.innerHTML = '';
    if (Store.papers.length === 0) {
      host.appendChild(el('div', { class: 'empty' },
        el('h3', {}, 'Nothing on the board'),
        el('p', {}, 'Add a paper to see it here, grouped by work status.')));
      return;
    }
    const board = el('div', { class: 'board' });
    STATUSES.forEach(s => {
      const papers = Store.papers.filter(p => p.status === s.value);
      const body = el('div', { class: 'column-body', dataset: { status: s.value } });
      papers.forEach(p => body.appendChild(this.card(p)));

      const col = el('div', { class: 'column', dataset: { status: s.value } },
        el('div', { class: 'column-head' },
          el('span', {}, el('span', { class: 'badge ' + s.cls, style: 'font-size:12px' }, el('span', { class: 'dot' }), s.label)),
          el('span', { class: 'n' }, String(papers.length))),
        body);

      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drop-target'); });
      col.addEventListener('dragleave', () => col.classList.remove('drop-target'));
      col.addEventListener('drop', e => {
        e.preventDefault();
        col.classList.remove('drop-target');
        if (!this.dragKey) return;
        const p = Store.get(this.dragKey);
        if (p && p.status !== s.value) {
          p.status = s.value;
          Store.upsert(p);
          App.renderAll();
          toast(`${p.id || 'Paper'} → ${s.label}`);
        }
        this.dragKey = null;
      });
      board.appendChild(col);
    });
    host.appendChild(board);
  },

  card(p) {
    const route = ROUTES.find(r => r.value === p.route);
    const sCls = (STATUS_MAP[p.status] || {}).cls || 'st-onhold';
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--' + sCls.replace('st-', 'st-')).trim();
    const card = el('div', {
      class: 'card', draggable: 'true',
      style: 'border-left-color:var(--' + sCls.replace('st-', 'st-') + ')',
      onclick: () => openPaperModal(p._key),
    },
      el('div', { class: 'card-top' },
        el('span', { class: 'pid' }, p.id || '—'),
        el('span', { class: 'route-tag' }, route ? route.label : '')),
      el('div', { class: 'card-title' }, p.title || 'Untitled'),
      el('div', { class: 'card-meta' },
        p.coauthors ? el('span', {}, p.coauthors) : el('span', { style: 'color:var(--ink-faint)' }, 'No coauthors'),
        p.events.length ? el('span', { style: 'font-family:var(--mono)' }, p.events.length + ' event' + (p.events.length === 1 ? '' : 's')) : null,
        (p.route === 'journal' && p.derivedFrom) ? el('span', { class: 'pid link' }, '↳ ' + p.derivedFrom) : null));

    card.addEventListener('dragstart', () => { this.dragKey = p._key; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); this.dragKey = null; });
    return card;
  },
};
