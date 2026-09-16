/* ============================================================
   Utilities: DOM, dates, toast, escaping, import/export
   ============================================================ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(kid => {
    if (kid == null || kid === false) return;
    node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  });
  return node;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- Toast ---------- */
function toast(msg, isErr = false) {
  const stack = $('#toastStack');
  const t = el('div', { class: 'toast' + (isErr ? ' err' : '') }, msg);
  stack.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .25s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 260);
  }, isErr ? 4200 : 2600);
}

/* ---------- Dates ---------- */
function parseDate(s) {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d) ? null : d;
}
function fmtDate(s) {
  const d = parseDate(s);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
const DAY = 86400000;
function daysBetween(a, b) { return Math.round((b - a) / DAY); }

/* Human duration: e.g. "3d", "5w", "4mo", "1y 2mo" */
function humanDuration(days) {
  if (days < 0) days = 0;
  if (days === 0) return 'same day';
  if (days < 14) return days + 'd';
  if (days < 60) return Math.round(days / 7) + 'w';
  if (days < 365) return Math.round(days / 30) + 'mo';
  const y = Math.floor(days / 365);
  const mo = Math.round((days % 365) / 30);
  return mo ? `${y}y ${mo}mo` : `${y}y`;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

/* Sorted (by date, undated last) copy of a paper's events */
function sortedEvents(paper) {
  return paper.events.slice().sort((a, b) => {
    const da = parseDate(a.date), db = parseDate(b.date);
    if (da && db) return da - db;
    if (da) return -1;
    if (db) return 1;
    return 0;
  });
}

/* Dated events only, sorted ascending. */
function datedEvents(paper) {
  return sortedEvents(paper).filter(e => parseDate(e.date));
}
/* A paper counts as having events if it has at least one dated event. */
function hasEvents(paper) { return datedEvents(paper).length > 0; }
/* [firstDate, lastDate] as timestamps, or null if no dated events. */
function eventBounds(paper) {
  const evs = datedEvents(paper);
  if (!evs.length) return null;
  return [+parseDate(evs[0].date), +parseDate(evs[evs.length - 1].date)];
}

/* ---------- Export / Import ---------- */
function exportJSON() {
  const blob = new Blob([JSON.stringify(Store.serialize(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `qdvc-pipeline-${todayISO()}.json` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Exported ' + Store.papers.length + ' paper' + (Store.papers.length === 1 ? '' : 's'));
}

function importJSONText(text) {
  let data;
  try { data = JSON.parse(text); }
  catch { toast('That file is not valid JSON.', true); return; }
  const papers = Array.isArray(data) ? data : data.papers;
  if (!Array.isArray(papers)) { toast('No papers found in that file.', true); return; }
  // fresh keys to avoid collisions with current session
  papers.forEach(p => { p._key = uid(); });
  const calendar = (!Array.isArray(data) && Array.isArray(data.calendar)) ? data.calendar : [];
  calendar.forEach(pd => { pd._key = uid(); });
  const settings = (!Array.isArray(data)) ? data.settings : null;
  // imported visibleKeys referenced the old session's keys; drop them so the
  // timeline defaults to showing all papers that have events.
  if (settings && settings.timeline) settings.timeline.visibleKeys = null;
  Store.replaceAll({ papers, calendar, settings });
  TimelineView.syncFromSettings();
  App.renderAll();
  const cn = calendar.length;
  toast('Imported ' + papers.length + ' paper' + (papers.length === 1 ? '' : 's') + (cn ? ' and ' + cn + ' calendar period' + (cn === 1 ? '' : 's') : ''));
}

function statusBadge(value) {
  const s = STATUS_MAP[value] || STATUS_MAP.onhold;
  return el('span', { class: 'badge ' + s.cls },
    el('span', { class: 'dot' }), s.label);
}
