/* ============================================================
   Timeline view — all papers on a shared date axis
   ============================================================ */

const TimelineView = {
  mergeLinked: false,
  visible: null,        // Set of _keys shown; null = all
  menuOpen: false,

  mount() {
    document.addEventListener('click', e => {
      if (this.menuOpen && !e.target.closest('.tl-paperfilter')) { this.menuOpen = false; this.renderToolbar(); }
    });
  },

  ensureVisible() {
    if (this.visible === null) this.visible = new Set(Store.papers.map(p => p._key));
    // prune keys that no longer exist; add brand-new papers as visible
    const keys = new Set(Store.papers.map(p => p._key));
    this.visible = new Set([...this.visible].filter(k => keys.has(k)));
    Store.papers.forEach(p => { if (![...this.visible].includes(p._key)) { /* leave new papers hidden? no—show */ } });
  },

  render() {
    this.ensureVisible();
    this.renderToolbar();
    this.renderCanvas();
  },

  renderToolbar() {
    const bar = $('#tlToolbar');
    bar.innerHTML = '';
    if (Store.papers.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';

    // paper filter dropdown
    const shownCount = this.visible.size;
    const filterBtn = el('button', { class: 'btn btn-sm', onclick: e => { e.stopPropagation(); this.menuOpen = !this.menuOpen; this.renderToolbar(); } },
      `Papers: ${shownCount}/${Store.papers.length} ▾`);
    const filterWrap = el('div', { class: 'tl-paperfilter group' }, filterBtn);

    if (this.menuOpen) {
      const menu = el('div', { class: 'menu' });
      menu.appendChild(el('div', { class: 'menu-actions' },
        el('button', { class: 'btn btn-sm btn-ghost', onclick: () => { this.visible = new Set(Store.papers.map(p => p._key)); this.render(); } }, 'All'),
        el('button', { class: 'btn btn-sm btn-ghost', onclick: () => { this.visible = new Set(); this.render(); } }, 'None')));
      Store.papers.forEach(p => {
        const cb = el('input', { type: 'checkbox', checked: this.visible.has(p._key),
          onchange: e => { if (e.target.checked) this.visible.add(p._key); else this.visible.delete(p._key); this.renderCanvas(); this.refreshFilterLabel(); } });
        menu.appendChild(el('label', {}, cb, el('span', { class: 'pid' }, p.id || '—'), el('span', {}, p.title || 'Untitled')));
      });
      filterWrap.appendChild(menu);
    }
    bar.appendChild(filterWrap);

    // merge linked toggle
    const toggle = el('label', { class: 'inline' },
      el('input', { type: 'checkbox', checked: this.mergeLinked, onchange: e => { this.mergeLinked = e.target.checked; this.renderCanvas(); } }),
      'Merge journal papers with their source conference paper');
    bar.appendChild(el('div', { class: 'group' }, toggle));
  },

  refreshFilterLabel() {
    const btn = $('#tlToolbar .tl-paperfilter > button');
    if (btn) btn.firstChild.textContent = `Papers: ${this.visible.size}/${Store.papers.length} ▾`;
  },

  /* Build the list of lanes to draw. A lane = { title, badge, papers:[{paper, events}] } */
  buildLanes() {
    const shown = Store.papers.filter(p => this.visible.has(p._key));
    if (!this.mergeLinked) {
      return shown.map(p => ({
        id: p.id, title: p.title, status: p.status, route: p.route, derivedFrom: p.derivedFrom,
        segments: this.paperSegments(p, p.id),
      }));
    }
    // merged mode: a journal paper with derivedFrom folds its source conference paper into one lane
    const byId = Object.fromEntries(Store.papers.map(p => [p.id, p]));
    const consumed = new Set(); // conference papers folded into a journal lane
    const lanes = [];
    shown.forEach(p => {
      if (p.route === 'journal' && p.derivedFrom && byId[p.derivedFrom]) {
        const conf = byId[p.derivedFrom];
        consumed.add(conf._key);
        const segs = [...this.paperSegments(conf, conf.id), ...this.paperSegments(p, p.id)];
        segs.sort((a, b) => a.start - b.start);
        lanes.push({ id: `${conf.id} → ${p.id}`, title: p.title, status: p.status, route: 'journal', derivedFrom: '', merged: true, segments: segs });
      }
    });
    shown.forEach(p => {
      if (consumed.has(p._key)) return;
      if (p.route === 'journal' && p.derivedFrom && byId[p.derivedFrom]) return; // already emitted as merged
      lanes.push({ id: p.id, title: p.title, status: p.status, route: p.route, derivedFrom: p.derivedFrom, segments: this.paperSegments(p, p.id) });
    });
    return lanes;
  },

  /* Segments = consecutive dated events -> bars; plus a trailing "current" bar to today
     if the paper is not in a terminal state. Each segment is classified into a
     review-cycle role:
       - 'review'  : submission/resubmission -> decision   (labelled R0, R1, ...)
       - 'authors' : decision -> resubmission              ("with authors")
       - null      : outside the review cycle (pre-submission, post-decision, misc)
     R-numbering restarts per paper, so a merged conference+journal lane starts
     fresh at R0 for the journal venue. */
  paperSegments(p, ownerId) {
    const evs = sortedEvents(p).filter(e => parseDate(e.date));
    const segs = [];
    let rIndex = 0;
    for (let i = 0; i < evs.length - 1; i++) {
      const a = evs[i], b = evs[i + 1];
      let role = null, label = '';
      if (isSubmissionType(a.type) && isDecisionEventType(b.type)) {
        role = 'review';
        label = 'R' + rIndex;
        rIndex++;
      } else if (isDecisionEventType(a.type) && isResubmitType(b.type)) {
        role = 'authors';
      }
      segs.push({
        start: parseDate(a.date), end: parseDate(b.date),
        from: a, to: b, owner: ownerId, current: false, role, label,
      });
    }
    // node-only markers even if a single event
    if (evs.length === 1) {
      segs.push({ start: parseDate(evs[0].date), end: parseDate(evs[0].date), from: evs[0], to: evs[0], owner: ownerId, current: false, point: true, role: null });
    }
    // trailing current bar
    const last = evs[evs.length - 1];
    const terminalReached = evs.some(e => isTerminalType(e.type)) || p.status === 'published';
    if (last && !terminalReached) {
      // if the paper is currently awaiting a decision (last event was a submission
      // or resubmission), the ongoing period is itself an open review round.
      let role = null, label = '';
      if (isSubmissionType(last.type)) { role = 'review'; label = 'R' + rIndex; }
      segs.push({ start: parseDate(last.date), end: new Date(todayISO() + 'T00:00:00'), from: last, to: null, owner: ownerId, current: true, role, label });
    }
    return segs;
  },

  renderCanvas() {
    const host = $('#timelineHost');
    host.innerHTML = '';

    if (Store.papers.length === 0) {
      host.appendChild(el('div', { class: 'empty' },
        el('h3', {}, 'Nothing to plot yet'),
        el('p', {}, 'Add papers with dated publication events to see them here.')));
      return;
    }

    const lanes = this.buildLanes();
    const withDates = lanes.filter(l => l.segments.length > 0);
    if (lanes.length === 0) {
      host.appendChild(el('div', { class: 'empty' }, el('h3', {}, 'No papers selected'), el('p', {}, 'Use the Papers filter to choose what to plot.')));
      return;
    }
    if (withDates.length === 0) {
      host.appendChild(el('div', { class: 'empty' }, el('h3', {}, 'No dated events'),
        el('p', {}, 'Add dates to publication events to position them on the timeline.')));
      return;
    }

    // legend
    host.appendChild(el('div', { class: 'tl-legend' },
      el('span', { class: 'lg' }, el('span', { class: 'sw review' }), el('b', {}, 'Under review'), ' (R0, R1, R2…)'),
      el('span', { class: 'lg' }, el('span', { class: 'sw authors' }), el('b', {}, 'With authors'), ' (revising)'),
      el('span', { class: 'lg' }, el('span', { class: 'sw other' }), el('b', {}, 'Other')),
      el('span', { class: 'lg' }, el('span', { class: 'sw current' }), el('b', {}, 'Ongoing'), ' (to today)')));

    // domain
    let min = Infinity, max = -Infinity;
    withDates.forEach(l => l.segments.forEach(s => { min = Math.min(min, +s.start); max = Math.max(max, +s.end); }));
    min = new Date(min); max = new Date(max);
    if (+min === +max) { min = new Date(+min - 30 * DAY); max = new Date(+max + 30 * DAY); }
    const pad = Math.max((max - min) * 0.04, 5 * DAY);
    min = new Date(+min - pad); max = new Date(+max + pad);
    const span = max - min || DAY;

    const LANE_LABEL_W = 220;
    // Fit the track to the available canvas width by default so every lane is
    // visible at once. Enforce a floor of ~0.35px/day so long pipelines can
    // scroll horizontally for detail rather than collapsing markers together.
    const avail = Math.max(360, (host.clientWidth || 900) - LANE_LABEL_W - 2);
    const byDay = Math.ceil(span / DAY) * 0.35;
    const trackW = Math.max(avail, byDay);
    const totalW = LANE_LABEL_W + trackW;
    const xOf = d => ((d - min) / span) * trackW;

    const inner = el('div', { class: 'tl-inner', style: `width:${totalW}px` });

    // axis
    const axis = el('div', { class: 'tl-axis', style: `margin-left:${LANE_LABEL_W}px;width:${trackW}px` });
    this.axisTicks(min, max).forEach(t => {
      axis.appendChild(el('div', { class: 'tl-tick', style: `left:${xOf(t.date)}px` }, el('span', {}, t.label)));
    });
    inner.appendChild(el('div', { style: 'display:flex' },
      el('div', { style: `width:${LANE_LABEL_W}px;min-width:${LANE_LABEL_W}px;background:#f7f4ec;border-right:1px solid var(--rule)` }),
      axis));

    // lanes
    lanes.forEach(l => inner.appendChild(this.laneEl(l, xOf, trackW)));

    host.appendChild(el('div', { class: 'tl-canvas' }, inner));
  },

  laneEl(l, xOf, trackW) {
    const label = el('div', { class: 'lane-label' },
      el('span', { class: 'pid' + (l.merged ? ' link' : '') }, l.id || '—'),
      el('span', { class: 'lt' }, l.title || 'Untitled'),
      statusBadge(l.status),
      (!l.merged && l.route === 'journal' && l.derivedFrom) ? el('span', { class: 'tl-linkflag' }, '↳ from ' + l.derivedFrom) : null);

    const track = el('div', { class: 'lane-track', style: `width:${trackW}px` });

    l.segments.forEach(s => {
      if (!s.point) {
        const x1 = xOf(s.start), x2 = xOf(s.end);
        const w = Math.max(2, x2 - x1);
        const roleCls = s.role === 'review' ? ' role-review' : s.role === 'authors' ? ' role-authors' : '';
        const seg = el('div', { class: 'tl-seg' + (s.current ? ' current' : '') + roleCls, style: `left:${x1}px;width:${w}px` });
        const days = daysBetween(s.start, s.end);
        // duration label above the bar
        if (w > 34 || s.current) seg.appendChild(el('div', { class: 'dur' }, s.current ? humanDuration(days) + ' · now' : humanDuration(days)));
        // R-round label sits on the bar itself
        if (s.label && w > 22) seg.appendChild(el('div', { class: 'rlabel' }, s.label));
        track.appendChild(seg);
      }
      // start node
      track.appendChild(this.nodeEl(s.from, xOf(s.start)));
    });
    // final terminal/last node (the "to" of last real segment)
    const lastReal = [...l.segments].reverse().find(s => s.to && s.to !== s.from && !s.current);
    if (lastReal) track.appendChild(this.nodeEl(lastReal.to, xOf(lastReal.end)));

    return el('div', { class: 'tl-lane' }, label, track);
  },

  nodeEl(ev, x) {
    if (!ev) return document.createComment('');
    const decision = isDecisionType(ev.type);
    const terminal = isTerminalType(ev.type);
    const cls = 'tl-node' + (terminal ? ' terminal' : decision ? ' decision' : '');
    let tip = eventTypeLabel(ev.type) + ' · ' + fmtDate(ev.date);
    if (decision && ev.decision) tip += ' (' + ev.decision + ')';
    if (isVolIssueType(ev.type) && (ev.volume || ev.issue)) tip += ` · Vol ${ev.volume || '?'}, Iss ${ev.issue || '?'}`;
    if (ev.note) tip += ' — ' + ev.note;
    return el('div', { class: cls, style: `left:${x}px` }, el('div', { class: 'node-tip' }, tip));
  },

  axisTicks(min, max) {
    const span = max - min;
    const ticks = [];
    const months = span / (30 * DAY);
    let step; // in months
    if (months <= 8) step = 1;
    else if (months <= 20) step = 3;
    else if (months <= 48) step = 6;
    else step = 12;
    const d = new Date(min.getFullYear(), min.getMonth(), 1);
    while (d <= max) {
      if (d >= min) {
        const label = step >= 12 ? String(d.getFullYear())
          : d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        ticks.push({ date: new Date(d), label });
      }
      d.setMonth(d.getMonth() + step);
    }
    return ticks;
  },
};
