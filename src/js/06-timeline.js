/* ============================================================
   Timeline view — all papers on a shared date axis
   ============================================================ */

const TimelineView = {
  mergeLinked: false,
  visible: null,        // Set of _keys shown (only papers with events)
  sortBy: 'id_early',
  sortDir: 1,
  menuOpen: false,
  sortMenuOpen: false,

  mount() {
    document.addEventListener('click', e => {
      let changed = false;
      if (this.menuOpen && !e.target.closest('.tl-paperfilter')) { this.menuOpen = false; changed = true; }
      if (this.sortMenuOpen && !e.target.closest('.tl-sort')) { this.sortMenuOpen = false; changed = true; }
      if (changed) this.renderToolbar();
    });
    this.syncFromSettings();
  },

  /* pull persisted settings into working state */
  syncFromSettings() {
    const s = Store.settings.timeline;
    this.mergeLinked = !!s.mergeLinked;
    this.sortBy = s.sortBy || 'id_early';
    this.sortDir = s.sortDir === -1 ? -1 : 1;
    this.visible = s.visibleKeys ? new Set(s.visibleKeys) : null;
  },

  save() {
    Store.updateTimelineSettings({
      mergeLinked: this.mergeLinked,
      sortBy: this.sortBy,
      sortDir: this.sortDir,
      visibleKeys: this.visible ? [...this.visible] : null,
    });
  },

  /* Papers eligible for the timeline: those with at least one dated event. */
  eligiblePapers() { return Store.papers.filter(hasEvents); },

  ensureVisible() {
    const eligibleKeys = new Set(this.eligiblePapers().map(p => p._key));
    if (this.visible === null) { this.visible = new Set(eligibleKeys); return; }
    // drop keys no longer eligible; add any newly-eligible papers as visible
    const next = new Set([...this.visible].filter(k => eligibleKeys.has(k)));
    const known = new Set(this._knownEligible || []);
    eligibleKeys.forEach(k => { if (!known.has(k)) next.add(k); });
    this._knownEligible = [...eligibleKeys];
    this.visible = next;
  },

  render() {
    this.ensureVisible();
    this.renderToolbar();
    this.renderCanvas();
  },

  renderToolbar() {
    const bar = $('#tlToolbar');
    bar.innerHTML = '';
    const eligible = this.eligiblePapers();
    if (Store.papers.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';

    // ----- paper filter dropdown (only papers with events) -----
    const shownCount = this.visible.size;
    const filterBtn = el('button', { class: 'btn btn-sm', onclick: e => { e.stopPropagation(); this.menuOpen = !this.menuOpen; this.sortMenuOpen = false; this.renderToolbar(); } },
      `Papers: ${shownCount}/${eligible.length} ▾`);
    const filterWrap = el('div', { class: 'tl-paperfilter group' }, filterBtn);
    if (this.menuOpen) {
      const menu = el('div', { class: 'menu' });
      menu.appendChild(el('div', { class: 'menu-actions' },
        el('button', { class: 'btn btn-sm btn-ghost', onclick: () => { this.visible = new Set(eligible.map(p => p._key)); this.save(); this.render(); } }, 'All'),
        el('button', { class: 'btn btn-sm btn-ghost', onclick: () => { this.visible = new Set(); this.save(); this.render(); } }, 'None')));
      if (eligible.length === 0) {
        menu.appendChild(el('div', { style: 'padding:8px 6px;font-size:13px;color:var(--ink-faint)' }, 'No papers have dated events yet.'));
      }
      eligible.forEach(p => {
        const cb = el('input', { type: 'checkbox', checked: this.visible.has(p._key),
          onchange: e => { if (e.target.checked) this.visible.add(p._key); else this.visible.delete(p._key); this.save(); this.renderCanvas(); this.refreshFilterLabel(); } });
        menu.appendChild(el('label', {}, cb, el('span', { class: 'pid' }, p.id || '—'), el('span', {}, p.title || 'Untitled')));
      });
      filterWrap.appendChild(menu);
    }
    bar.appendChild(filterWrap);

    // ----- sort control -----
    const curSort = TL_SORTS.find(s => s.value === this.sortBy) || TL_SORTS[0];
    const dirGlyph = this.sortDir > 0 ? '↑' : '↓';
    const sortBtn = el('button', { class: 'btn btn-sm', onclick: e => { e.stopPropagation(); this.sortMenuOpen = !this.sortMenuOpen; this.menuOpen = false; this.renderToolbar(); } },
      `Sort: ${curSort.label} ${dirGlyph} ▾`);
    const sortWrap = el('div', { class: 'tl-sort group' }, sortBtn);
    if (this.sortMenuOpen) {
      const menu = el('div', { class: 'menu' });
      TL_SORTS.forEach(s => {
        const active = s.value === this.sortBy;
        menu.appendChild(el('label', { class: active ? 'active' : '' },
          el('input', { type: 'radio', name: 'tlsort', checked: active,
            onchange: () => { this.sortBy = s.value; this.save(); this.renderCanvas(); this.renderToolbar(); } }),
          el('span', {}, s.label)));
      });
      menu.appendChild(el('div', { class: 'menu-actions', style: 'border-top:1px solid var(--rule-soft);border-bottom:none;margin:6px 0 0;padding:8px 6px 2px' },
        el('button', { class: 'btn btn-sm' + (this.sortDir > 0 ? ' btn-primary' : ''), onclick: () => { this.sortDir = 1; this.save(); this.renderCanvas(); this.renderToolbar(); } }, 'Ascending ↑'),
        el('button', { class: 'btn btn-sm' + (this.sortDir < 0 ? ' btn-primary' : ''), onclick: () => { this.sortDir = -1; this.save(); this.renderCanvas(); this.renderToolbar(); } }, 'Descending ↓')));
      sortWrap.appendChild(menu);
    }
    bar.appendChild(sortWrap);

    // ----- merge linked toggle -----
    const toggle = el('label', { class: 'inline' },
      el('input', { type: 'checkbox', checked: this.mergeLinked, onchange: e => { this.mergeLinked = e.target.checked; this.save(); this.renderCanvas(); } }),
      'Merge journal papers with their source conference paper');
    bar.appendChild(el('div', { class: 'group' }, toggle));
  },

  refreshFilterLabel() {
    const btn = $('#tlToolbar .tl-paperfilter > button');
    if (btn) btn.firstChild.textContent = `Papers: ${this.visible.size}/${this.eligiblePapers().length} ▾`;
  },

  /* Build the list of lanes to draw, then sort them. */
  buildLanes() {
    const eligible = this.eligiblePapers();
    const shown = eligible.filter(p => this.visible.has(p._key));
    let lanes;
    if (!this.mergeLinked) {
      lanes = shown.map(p => ({
        id: p.id, title: p.title, status: p.status, route: p.route, derivedFrom: p.derivedFrom,
        earlyId: p.id, lateId: p.id,
        segments: this.paperSegments(p, p.id),
      }));
    } else {
      const byId = Object.fromEntries(Store.papers.map(p => [p.id, p]));
      const consumed = new Set();
      lanes = [];
      shown.forEach(p => {
        if (p.route === 'journal' && p.derivedFrom && byId[p.derivedFrom]) {
          const conf = byId[p.derivedFrom];
          consumed.add(conf._key);
          const segs = [...this.paperSegments(conf, conf.id), ...this.paperSegments(p, p.id)];
          segs.sort((a, b) => a.start - b.start);
          lanes.push({ id: `${conf.id} → ${p.id}`, title: p.title, status: p.status, route: 'journal', derivedFrom: '', merged: true,
            earlyId: conf.id, lateId: p.id, segments: segs });
        }
      });
      shown.forEach(p => {
        if (consumed.has(p._key)) return;
        if (p.route === 'journal' && p.derivedFrom && byId[p.derivedFrom]) return;
        lanes.push({ id: p.id, title: p.title, status: p.status, route: p.route, derivedFrom: p.derivedFrom,
          earlyId: p.id, lateId: p.id, segments: this.paperSegments(p, p.id) });
      });
    }
    return this.sortLanes(lanes);
  },

  sortLanes(lanes) {
    const dir = this.sortDir;
    const laneBounds = l => {
      let min = Infinity, max = -Infinity;
      l.segments.forEach(s => { min = Math.min(min, +s.start); max = Math.max(max, +s.end); });
      return [min, max];
    };
    const keyer = {
      id_early: l => l.earlyId || '',
      id_late:  l => l.lateId || '',
      first_ev: l => laneBounds(l)[0],
      last_ev:  l => laneBounds(l)[1],
    }[this.sortBy] || (l => l.earlyId);
    return lanes.slice().sort((a, b) => {
      const av = keyer(a), bv = keyer(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  },

  /* Segments = consecutive dated events -> bars; plus a trailing "current" bar to today. */
  paperSegments(p, ownerId) {
    const evs = datedEvents(p);
    const segs = [];
    let rIndex = 0;
    for (let i = 0; i < evs.length - 1; i++) {
      const a = evs[i], b = evs[i + 1];
      let role = null, label = '';
      if (isSubmissionType(a.type) && isDecisionEventType(b.type)) {
        role = 'review'; label = 'R' + rIndex; rIndex++;
      } else if (isDecisionEventType(a.type) && isResubmitType(b.type)) {
        role = 'authors';
      }
      segs.push({ start: parseDate(a.date), end: parseDate(b.date), from: a, to: b, owner: ownerId, current: false, role, label });
    }
    if (evs.length === 1) {
      segs.push({ start: parseDate(evs[0].date), end: parseDate(evs[0].date), from: evs[0], to: evs[0], owner: ownerId, current: false, point: true, role: null });
    }
    const last = evs[evs.length - 1];
    const terminalReached = evs.some(e => isTerminalType(e.type)) || p.status === 'published';
    if (last && !terminalReached) {
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
    if (this.eligiblePapers().length === 0) {
      host.appendChild(el('div', { class: 'empty' }, el('h3', {}, 'No dated events'),
        el('p', {}, 'Add dates to publication events to position papers on the timeline.')));
      return;
    }
    if (lanes.length === 0) {
      host.appendChild(el('div', { class: 'empty' }, el('h3', {}, 'No papers selected'), el('p', {}, 'Use the Papers filter to choose what to plot.')));
      return;
    }

    // ----- legend -----
    host.appendChild(this.legendEl());

    // ----- domain -----
    let min = Infinity, max = -Infinity;
    withDates.forEach(l => l.segments.forEach(s => { min = Math.min(min, +s.start); max = Math.max(max, +s.end); }));
    min = new Date(min); max = new Date(max);
    if (+min === +max) { min = new Date(+min - 30 * DAY); max = new Date(+max + 30 * DAY); }
    const pad = Math.max((max - min) * 0.04, 5 * DAY);
    min = new Date(+min - pad); max = new Date(+max + pad);
    const span = max - min || DAY;

    const LANE_LABEL_W = 220;
    const avail = Math.max(360, (host.clientWidth || 900) - LANE_LABEL_W - 2);
    const byDay = Math.ceil(span / DAY) * 0.35;
    const trackW = Math.max(avail, byDay);
    const totalW = LANE_LABEL_W + trackW;
    const xOf = d => ((d - min) / span) * trackW;
    const dateAt = px => new Date(+min + (px / trackW) * span);

    const inner = el('div', { class: 'tl-inner', style: `width:${totalW}px` });

    // ----- axis header (year row + month-number row) -----
    const header = el('div', { class: 'tl-header' });
    const corner = el('div', { class: 'tl-corner', style: `width:${LANE_LABEL_W}px;min-width:${LANE_LABEL_W}px` }, 'Timeline');
    const axis = el('div', { class: 'tl-axis', style: `width:${trackW}px` });
    // calendar shading behind the ticks/lanes is drawn per-lane; on the axis we
    // show year labels (top) and month numbers (bottom).
    this.yearTicks(min, max).forEach(t => {
      axis.appendChild(el('div', { class: 'tl-tick', style: `left:${xOf(t.date)}px` }, el('span', { class: 'yr' }, t.label)));
    });
    this.monthTicks(min, max, trackW).forEach(t => {
      const m = el('div', { class: 'tl-month', style: `left:${xOf(t.date)}px` }, el('span', {}, t.label));
      axis.appendChild(m);
    });
    header.appendChild(corner);
    header.appendChild(axis);
    inner.appendChild(header);

    // ----- lanes body (with calendar shading + crosshair overlay) -----
    const body = el('div', { class: 'tl-body' });

    // calendar shading layer spans the full track height behind lanes
    const shadeLayer = el('div', { class: 'tl-shade-layer', style: `left:${LANE_LABEL_W}px;width:${trackW}px` });
    this.calendarBands(min, max).forEach(band => {
      const x1 = xOf(band.start), x2 = xOf(band.end);
      shadeLayer.appendChild(el('div', {
        class: 'tl-shade',
        style: `left:${x1}px;width:${Math.max(1, x2 - x1)}px;background:${band.color}`,
        title: band.title,
      }));
    });
    body.appendChild(shadeLayer);

    // crosshair
    const crosshair = el('div', { class: 'tl-crosshair', style: `left:${LANE_LABEL_W}px` },
      el('div', { class: 'tl-crosshair-date' }));
    body.appendChild(crosshair);

    const lanesWrap = el('div', { class: 'tl-lanes' });
    lanes.forEach(l => lanesWrap.appendChild(this.laneEl(l, xOf, trackW)));
    body.appendChild(lanesWrap);

    // crosshair interactivity — track area only (right of the label column)
    lanesWrap.addEventListener('mousemove', e => {
      const rect = lanesWrap.getBoundingClientRect();
      const xInLanes = e.clientX - rect.left;      // 0 at label column start
      const xInTrack = xInLanes - LANE_LABEL_W;    // 0 at track start
      if (xInTrack < 0 || xInTrack > trackW) { crosshair.style.display = 'none'; return; }
      crosshair.style.display = 'block';
      crosshair.style.left = (LANE_LABEL_W + xInTrack) + 'px';
      const lbl = crosshair.querySelector('.tl-crosshair-date');
      lbl.textContent = fmtDate(dateAt(xInTrack).toISOString().slice(0, 10));
      // keep the floating label from overflowing the right edge
      lbl.style.transform = xInTrack > trackW - 90 ? 'translateX(-100%)' : 'translateX(0)';
    });
    lanesWrap.addEventListener('mouseleave', () => { crosshair.style.display = 'none'; });

    inner.appendChild(body);
    host.appendChild(el('div', { class: 'tl-canvas' }, inner));
  },

  legendEl() {
    return el('div', { class: 'tl-legend' },
      el('span', { class: 'lg' }, el('span', { class: 'sw review' }), el('b', {}, 'Under review'), ' (R0, R1, R2…)'),
      el('span', { class: 'lg' }, el('span', { class: 'sw authors' }), el('b', {}, 'With authors'), ' (revising)'),
      el('span', { class: 'lg' }, el('span', { class: 'sw other' }), el('b', {}, 'Other')),
      el('span', { class: 'lg' }, el('span', { class: 'sw current' }), el('b', {}, 'Ongoing'), ' (to today)'),
      Store.calendar.length ? el('span', { class: 'lg' }, el('span', { class: 'sw busy' }), el('b', {}, 'Busy'), ' / ', el('span', { class: 'sw relaxed' }), el('b', {}, 'Relaxed')) : null);
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
        if (w > 34 || s.current) seg.appendChild(el('div', { class: 'dur' }, s.current ? humanDuration(days) + ' · now' : humanDuration(days)));
        if (s.label && w > 22) seg.appendChild(el('div', { class: 'rlabel' }, s.label));
        track.appendChild(seg);
      }
      track.appendChild(this.nodeEl(s.from, xOf(s.start)));
    });
    const lastReal = [...l.segments].reverse().find(s => s.to && s.to !== s.from && !s.current);
    if (lastReal) track.appendChild(this.nodeEl(lastReal.to, xOf(lastReal.end)));

    return el('div', { class: 'tl-lane' }, label, track);
  },

  /* Event marker with an icon indicating its kind. */
  nodeEl(ev, x) {
    if (!ev) return document.createComment('');
    const kind = this.eventKind(ev);
    const cls = 'tl-node kind-' + kind;
    let tip = eventTypeLabel(ev.type) + ' · ' + fmtDate(ev.date);
    if (isDecisionType(ev.type) && ev.decision) tip += ' (' + ev.decision + ')';
    if (isVolIssueType(ev.type) && (ev.volume || ev.issue)) tip += ` · Vol ${ev.volume || '?'}, Iss ${ev.issue || '?'}`;
    if (ev.note) tip += ' — ' + ev.note;
    return el('div', { class: cls, style: `left:${x}px`, html: this.iconSVG(kind) },
      el('div', { class: 'node-tip' }, tip));
  },

  eventKind(ev) {
    if (isDecisionType(ev.type)) {
      if (ev.decision === 'accept') return 'accept';
      if (ev.decision === 'reject') return 'reject';
      if (ev.decision === 'revise') return 'revise';
      return 'decision';
    }
    if (isResubmitType(ev.type)) return 'resubmit';
    if (isSubmissionType(ev.type)) return 'submit';
    if (isTerminalType(ev.type)) return 'terminal';
    return 'generic';
  },

  iconSVG(kind) {
    // 20x20 icons, stroke uses currentColor set by the node's kind class
    const wrap = s => `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${s}</svg>`;
    switch (kind) {
      case 'submit':   return wrap('<path d="M10 15V5"/><path d="M6 9l4-4 4 4"/>');            // up arrow (send in)
      case 'resubmit': return wrap('<path d="M5 9a5 5 0 1 1 1.5 3.5"/><path d="M5 6v3h3"/>');   // circular arrow (resubmit)
      case 'accept':   return wrap('<path d="M5 10.5l3.2 3.2L15 6.5"/>');                        // check / tick
      case 'reject':   return wrap('<path d="M6 6l8 8"/><path d="M14 6l-8 8"/>');                // x cross
      case 'revise':   return wrap('<path d="M4 13.5V16h2.5L14 8.5 11.5 6 4 13.5z"/><path d="M11 6.5l2.5 2.5"/>'); // pencil (revise)
      case 'terminal': return wrap('<path d="M10 3l1.9 3.9 4.3.6-3.1 3 0.7 4.3L10 15.8 6.2 17.8l0.7-4.3-3.1-3 4.3-.6z"/>'); // star
      default:         return wrap('<circle cx="10" cy="10" r="3.2"/>');                         // dot
    }
  },

  yearTicks(min, max) {
    const ticks = [];
    // first year boundary at or after min
    let y = min.getFullYear();
    if (new Date(y, 0, 1) < min) y++;   // Jan 1 of min's year is before domain -> start next year
    // label the domain start with its own year (partial year at left edge)
    ticks.push({ date: new Date(min), label: String(min.getFullYear()) });
    for (let yr = y; ; yr++) {
      const d = new Date(yr, 0, 1);
      if (d > max) break;
      // avoid a near-duplicate right on top of the domain-start label
      if (+d - +min > 20 * DAY) ticks.push({ date: d, label: String(yr) });
    }
    return ticks;
  },

  monthTicks(min, max, trackW) {
    // approximate px per month; hide numbers if too dense
    const totalMonths = (max.getFullYear() - min.getFullYear()) * 12 + (max.getMonth() - min.getMonth()) + 1;
    const pxPerMonth = trackW / Math.max(1, totalMonths);
    const showEvery = pxPerMonth < 14 ? (pxPerMonth < 8 ? 6 : 3) : 1;
    const ticks = [];
    const d = new Date(min.getFullYear(), min.getMonth(), 1);
    while (d <= max) {
      if (d >= min) {
        const mi = d.getMonth(); // 0-11
        if (mi % showEvery === 0) ticks.push({ date: new Date(d), label: String(mi + 1) });
      }
      d.setMonth(d.getMonth() + 1);
    }
    return ticks;
  },

  /* Compute additive workload bands across the domain from overlapping periods.
     Each period contributes its numeric workload weight; we sum weights over a
     sweep of boundary points and map the running total to a colour. */
  calendarBands(min, max) {
    const periods = Store.calendar
      .map(p => ({ s: parseDate(p.start), e: parseDate(p.end), w: p.workload, name: p.name }))
      .filter(p => p.s && p.e && p.e >= p.s);
    if (!periods.length) return [];
    // clip to domain
    const lo = +min, hi = +max;
    const pts = new Set([lo, hi]);
    periods.forEach(p => { pts.add(Math.max(lo, +p.s)); pts.add(Math.min(hi, +p.e)); });
    const sorted = [...pts].filter(t => t >= lo && t <= hi).sort((a, b) => a - b);
    const bands = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (b <= a) continue;
      const mid = (a + b) / 2;
      let sum = 0; const names = [];
      periods.forEach(p => { if (+p.s <= mid && mid <= +p.e) { sum += p.w; names.push(`${p.name || 'Period'} (${(WORKLOAD_MAP[p.w] || {}).label || p.w})`); } });
      if (sum === 0 && !names.length) continue;
      bands.push({ start: new Date(a), end: new Date(b), color: this.shadeColor(sum), title: `${names.join(' + ')} → net ${sum > 0 ? 'busy +' + sum : sum < 0 ? 'relaxed ' + sum : 'neutral'}` });
    }
    return bands;
  },

  /* Map a summed workload weight to an rgba shade.
     Positive (busy) → warm red tint; negative (relaxed) → cool green tint. */
  shadeColor(sum) {
    if (sum === 0) return 'transparent';
    const mag = Math.min(Math.abs(sum), 6);      // cap intensity
    const alpha = 0.06 + mag * 0.055;            // 0.06 … ~0.39
    if (sum > 0) return `rgba(163, 53, 43, ${alpha.toFixed(3)})`;   // busy (danger-ish red)
    return `rgba(47, 125, 79, ${alpha.toFixed(3)})`;                // relaxed (green)
  },
};
