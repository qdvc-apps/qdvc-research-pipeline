/* ============================================================
   QDVC Research Pipeline — data model & store
   ============================================================ */

const STORAGE_KEY = 'qdvc.pipeline.v1';
const SCHEMA = 1;

const STATUSES = [
  { value: 'onhold',   label: 'On hold',        cls: 'st-onhold' },
  { value: 'withme',   label: 'With me',        cls: 'st-withme' },
  { value: 'coauthor', label: 'With a coauthor',cls: 'st-coauthor' },
  { value: 'review',   label: 'Under review',   cls: 'st-review' },
  { value: 'published',label: 'Published',      cls: 'st-published' },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]));

const ROUTES = [
  { value: 'conference', label: 'Conference' },
  { value: 'journal',    label: 'Journal' },
  { value: 'other',      label: 'Other' },
];

/* Event types per route. `detail` flags a type that carries structured fields. */
const EVENT_TYPES = {
  conference: [
    { value: 'conf_submitted',   label: 'Submitted to conference' },
    { value: 'conf_decision',    label: 'Received decision from conference', detail: 'decision' },
    { value: 'conf_resubmitted', label: 'Resubmitted to conference' },
    { value: 'conf_proceedings', label: 'Included in conference proceedings' },
    { value: 'conf_presented',   label: 'Presented at conference', terminal: true },
  ],
  journal: [
    { value: 'jrn_submitted',    label: 'Submitted to journal' },
    { value: 'jrn_decision',     label: 'Received decision from journal', detail: 'decision' },
    { value: 'jrn_resubmitted',  label: 'Resubmitted to journal' },
    { value: 'jrn_online',       label: 'Published online', terminal: true },
    { value: 'jrn_print',        label: 'Published in print', detail: 'volissue', terminal: true },
  ],
  other: [], // freeform only
};

const DECISIONS = [
  { value: 'reject', label: 'Reject' },
  { value: 'revise', label: 'Revise' },
  { value: 'accept', label: 'Accept' },
];

/* Flat lookup for any event type value -> definition */
const EVENT_TYPE_MAP = {};
Object.values(EVENT_TYPES).flat().forEach(t => { EVENT_TYPE_MAP[t.value] = t; });

function eventTypesForRoute(route) { return EVENT_TYPES[route] || []; }
function eventTypeLabel(v) {
  if (!v) return 'Untagged event';
  return EVENT_TYPE_MAP[v] ? EVENT_TYPE_MAP[v].label : v;
}
function isDecisionType(v) { return EVENT_TYPE_MAP[v] && EVENT_TYPE_MAP[v].detail === 'decision'; }
function isVolIssueType(v) { return EVENT_TYPE_MAP[v] && EVENT_TYPE_MAP[v].detail === 'volissue'; }
function isTerminalType(v) { return !!(EVENT_TYPE_MAP[v] && EVENT_TYPE_MAP[v].terminal); }

/* Review-cycle classification. A submission or resubmission sends the paper into
   review; a decision ends a review round; a resubmission returns it to review
   after the authors revise. */
const SUBMIT_TYPES   = new Set(['conf_submitted', 'conf_resubmitted', 'jrn_submitted', 'jrn_resubmitted']);
const RESUBMIT_TYPES = new Set(['conf_resubmitted', 'jrn_resubmitted']);
function isSubmissionType(v)  { return SUBMIT_TYPES.has(v); }
function isResubmitType(v)    { return RESUBMIT_TYPES.has(v); }
function isDecisionEventType(v) { return isDecisionType(v); }

const ID_RE = /^[0-9]{2}[A-Z]{2}$/;
function isValidId(id) { return ID_RE.test(id || ''); }

function uid() { return 'e' + Math.random().toString(36).slice(2, 9); }

/* ---------- Store ---------- */
const Store = {
  papers: [],

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.papers = Array.isArray(data.papers) ? data.papers : [];
      } else {
        this.papers = [];
      }
    } catch (e) {
      console.error('Load failed', e);
      this.papers = [];
    }
    this.papers.forEach(normalizePaper);
  },

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.serialize()));
    } catch (e) {
      toast('Could not save to browser storage. Storage may be full.', true);
    }
  },

  serialize() {
    return { schema: SCHEMA, exportedAt: new Date().toISOString(), papers: this.papers };
  },

  get(id) { return this.papers.find(p => p.id === id) || null; },
  getByKey(key) { return this.papers.find(p => p._key === key) || null; },

  idExists(id, exceptKey) {
    return this.papers.some(p => p.id === id && p._key !== exceptKey);
  },

  upsert(paper) {
    normalizePaper(paper);
    const i = this.papers.findIndex(p => p._key === paper._key);
    if (i >= 0) this.papers[i] = paper; else this.papers.push(paper);
    this.persist();
  },

  remove(key) {
    // clear any journal->conference links pointing at the removed paper's id
    const removed = this.papers.find(p => p._key === key);
    this.papers = this.papers.filter(p => p._key !== key);
    if (removed) {
      this.papers.forEach(p => { if (p.derivedFrom === removed.id) p.derivedFrom = ''; });
    }
    this.persist();
  },

  replaceAll(papers) {
    this.papers = papers;
    this.papers.forEach(normalizePaper);
    this.persist();
  },
};

function normalizePaper(p) {
  if (!p._key) p._key = uid();
  p.id = (p.id || '').toUpperCase();
  p.title = p.title || '';
  p.coauthors = p.coauthors || '';
  p.status = STATUS_MAP[p.status] ? p.status : 'onhold';
  p.route = ROUTES.some(r => r.value === p.route) ? p.route : 'conference';
  p.derivedFrom = p.derivedFrom || '';
  if (!Array.isArray(p.events)) p.events = [];
  p.events.forEach(ev => {
    if (!ev._key) ev._key = uid();
    ev.date = ev.date || '';
    ev.type = ev.type || '';
    ev.decision = ev.decision || '';
    ev.volume = ev.volume || '';
    ev.issue = ev.issue || '';
    ev.note = ev.note || '';
  });
  return p;
}

function blankPaper() {
  return normalizePaper({ id: '', title: '', coauthors: '', status: 'onhold', route: 'conference', derivedFrom: '', events: [] });
}

function newEvent() {
  return { _key: uid(), date: '', type: '', decision: '', volume: '', issue: '', note: '' };
}
