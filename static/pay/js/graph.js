// Observed-transaction-trace canvas.
//
// A read-only inspection view: nodes cannot be dragged and edges cannot be edited, because production routing is not
// something an investigator changes by moving a line. Layout is deterministic (five left-to-right group columns, no
// force simulation), so nothing jumps during a recording. Every state shown here comes from the TraceModel, which
// folds saved backend events.

import { h, svg, clamp, reducedMotion, setText } from './util.js';
import { icon, NODE_ICONS, STATE_ICON } from './icons.js';
import { STATE_LABEL, NODE_SHORT } from './model.js';

const NW = 240;
const NH = 84;
const GAPX = 60;
const ROWGAP = 34;
const HEADER = 46;
const FRAME_PAD = 14;
const COL = { request: 0, bank: 1, connector: 2, wallet: 3, confirm: 4 };
// Slot order inside a column keeps related stages adjacent so most edges are short vertical or single-gap links.
const SLOTS = {
  request: ['intent', 'validation', 'authorization', 'idempotency'],
  bank: ['funding-check', 'bank-debit', 'bank-response'],
  connector: ['ref-mapping', 'routing-request', 'retry-history', 'partner-ack', 'callback-delivery'],
  wallet: ['wallet-ingress', 'durable-queue', 'credit-worker', 'wallet-ledger', 'dead-letter'],
  confirm: ['posting-verify', 'ack-return', 'customer-update', 'reconciliation', 'return-path'],
};
const CHAIN = ['intent', 'validation', 'authorization', 'funding-check', 'bank-debit', 'bank-response', 'ref-mapping', 'routing-request',
  'wallet-ingress', 'durable-queue', 'credit-worker', 'wallet-ledger', 'posting-verify'];
const ACKS = [['durable-queue', 'partner-ack', 'queue ack'], ['partner-ack', 'ack-return', 'ack relay'], ['posting-verify', 'ack-return', 'credit ack'], ['ack-return', 'customer-update', 'status']];
const BRANCHES = [['intent', 'idempotency', 'key'], ['routing-request', 'retry-history', 'attempts'], ['partner-ack', 'callback-delivery', 'callback'],
  ['credit-worker', 'dead-letter', 'errors'], ['wallet-ledger', 'reconciliation', 'match'], ['reconciliation', 'return-path', 'option']];
const SHORT_TITLE = { 'ack-return': 'Ack to customer', 'dead-letter': 'Dead-letter and errors', 'return-path': 'Controlled return path' };
const MARKERS = ['unknown', 'done', 'pending', 'failed', 'unavailable', 'probe'];

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function roundedPath(pts, r = 10) {
  const p = pts.filter((pt, i) => i === 0 || pt[0] !== pts[i - 1][0] || pt[1] !== pts[i - 1][1]);
  if (p.length < 2) return '';
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [x0, y0] = p[i - 1];
    const [x1, y1] = p[i];
    const [x2, y2] = p[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0);
    const l2 = Math.hypot(x2 - x1, y2 - y1);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = x1 - ((x1 - x0) / l1) * rr;
    const ay = y1 - ((y1 - y0) / l1) * rr;
    const bx = x1 + ((x2 - x1) / l2) * rr;
    const by = y1 + ((y2 - y1) / l2) * rr;
    d += ` L${ax} ${ay} Q${x1} ${y1} ${bx} ${by}`;
  }
  const last = p[p.length - 1];
  return d + ` L${last[0]} ${last[1]}`;
}

export class Graph {
  constructor(root, { onSelect = () => {}, onFollowChange = () => {} } = {}) {
    this.root = root;
    this.onSelect = onSelect;
    this.onFollowChange = onFollowChange;
    this.model = null;
    this.view = { x: 0, y: 0, k: 1 };
    this.follow = true;
    this.autoFit = true;
    this.expanded = new Set();
    this.selected = null;
    this.pos = {};
    this.edges = [];
    this.probes = new Map();
    this.sig = '';
    this.anim = null;
    this.build();
    this.bind();
    this.ro = new ResizeObserver(() => {
      if (this.autoFit && this.model) this.fit(false);
    });
    this.ro.observe(root);
  }

  // ---------------------------------------------------------------------------------------------- DOM
  build() {
    const r = this.root;
    r.classList.add('graph');
    r.setAttribute('tabindex', '0');
    r.setAttribute('role', 'application');
    r.setAttribute('aria-label', 'Observed transaction trace. Use arrow keys to pan, plus and minus to zoom, zero to fit.');
    this.world = h('div', { class: 'graph-world' });
    this.frameLayer = h('div', { class: 'graph-frames' });
    this.svg = svg('svg', { class: 'graph-edges', width: 1, height: 1, 'aria-hidden': 'true' });
    const defs = svg('defs');
    for (const m of MARKERS) {
      defs.append(svg('marker', { id: 'arrow-' + m, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto', markerUnits: 'userSpaceOnUse' },
        svg('path', { d: 'M1 1.5 8.5 5 1 8.5z', class: 'arrow arrow--' + m })));
    }
    this.edgeG = svg('g', { class: 'edge-layer' });
    this.probeG = svg('g', { class: 'probe-layer' });
    this.svg.append(defs, this.edgeG, this.probeG);
    this.nodeLayer = h('div', { class: 'graph-nodes' });
    this.chipLayer = h('div', { class: 'graph-chips' });
    this.hub = h('div', { class: 'ghub is-idle' }, icon('search', 18, 'ghub-ic'),
      h('div', { class: 'ghub-text' }, h('strong', { text: 'Investigation' }), (this.hubSub = h('small', { text: 'Not started' }))));
    this.world.append(this.frameLayer, this.svg, this.nodeLayer, this.chipLayer, this.hub);
    r.append(this.world);

    this.els = {};
    this.frames = {};
  }

  createNodes(model) {
    this.els = {};
    this.frames = {};
    this.nodeLayer.replaceChildren();
    this.frameLayer.replaceChildren();
    for (const g of model.topology.groups) {
      const toggle = h('button', { class: 'gframe-toggle', type: 'button', onclick: (ev) => { ev.stopPropagation(); this.toggleGroup(g.id); } });
      const count = h('span', { class: 'gframe-count' });
      const el = h('div', { class: 'gframe', dataset: { group: g.id } },
        h('div', { class: 'gframe-head' }, h('span', { class: 'gframe-title', text: g.title }), count, toggle));
      this.frames[g.id] = { el, toggle, count };
      this.frameLayer.append(el);
    }
    for (const n of model.topology.nodes) {
      const title = h('span', { class: 'gnode-title', text: SHORT_TITLE[n.id] || NODE_SHORT[n.id] || n.title });
      const badge = h('span', { class: 'gnode-badge' });
      const status = h('span', { class: 'gnode-status' });
      const fact = h('span', { class: 'gnode-fact' });
      const tag = h('span', { class: 'gnode-tag' });
      const el = h('div', { class: `gnode kind-${n.kind} st-unknown is-hidden`, tabindex: '-1', role: 'button', dataset: { id: n.id },
        onclick: () => this.select(n.id), onkeydown: (ev) => this.nodeKey(ev, n.id) },
      h('span', { class: 'handle handle--in', 'aria-hidden': 'true' }), h('span', { class: 'handle handle--out', 'aria-hidden': 'true' }),
      h('div', { class: 'gnode-top' }, icon(NODE_ICONS[n.id] || 'question', 17, 'gnode-ic'), title),
      h('div', { class: 'gnode-mid' }, badge, status, tag),
      fact);
      this.els[n.id] = { el, title, badge, status, fact, tag };
      this.nodeLayer.append(el);
    }
  }

  // ---------------------------------------------------------------------------------------------- model binding
  setModel(model) {
    const rebuild = !this.model || this.model.topology !== model.topology;
    this.model = model;
    if (rebuild) {
      this.createNodes(model);
      this.sig = '';
    }
    this.relayout(true);
    this.syncAll();
    if (this.autoFit) this.fit(false);
  }

  refresh(effects = []) {
    if (!this.model) return;
    const changed = this.relayout(false);
    for (const fx of effects) {
      if (fx.type === 'node') this.syncNode(fx.id, true);
    }
    this.syncAll();
    this.syncEdges();
    for (const fx of effects) {
      if (fx.type === 'probe-start') this.probeStart(fx.node, fx.check, changed);
      else if (fx.type === 'probe-done') this.probeDone(fx.check, fx.status);
      else if (fx.type === 'investigation') {
        this.setHub(fx.state);
        if (fx.state === 'concluded') setTimeout(() => this.fit(true), 700); // step back to the whole picture
      }
    }
  }

  setHub(state, mode) {
    this.hub.classList.remove('is-idle', 'is-running', 'is-concluded');
    this.hub.classList.add('is-' + state);
    setText(this.hubSub, state === 'running' ? 'Checking records' : state === 'concluded' ? 'Concluded' : 'Not started');
    if (mode) this.hub.title = mode;
  }

  visibleIds() {
    const m = this.model;
    return m.topology.nodes.filter((n) => n.core || this.expanded.has(n.group) || m.revealed.has(n.id)).map((n) => n.id);
  }

  // ---------------------------------------------------------------------------------------------- layout
  relayout(force) {
    const vis = this.visibleIds();
    const sig = vis.join(',') + '|' + (this.model.investigation ? this.model.investigation.status : '');
    if (!force && sig === this.sig) return false;
    const first = !this.sig;
    this.sig = sig;
    const visSet = new Set(vis);
    const pos = {};
    const frames = {};
    for (const g of this.model.topology.groups) {
      const ids = SLOTS[g.id].filter((id) => visSet.has(id));
      const colX = COL[g.id] * (NW + GAPX) + FRAME_PAD;
      const total = ids.length * NH + Math.max(0, ids.length - 1) * ROWGAP;
      const top = -total / 2;
      ids.forEach((id, i) => {
        pos[id] = { x: colX, y: top + i * (NH + ROWGAP), w: NW, h: NH, col: COL[g.id], idx: i, group: g.id };
      });
      frames[g.id] = { x: colX - FRAME_PAD, y: top - HEADER, w: NW + FRAME_PAD * 2, h: total + HEADER + FRAME_PAD, n: ids.length };
    }
    this.pos = pos;
    this.framePos = frames;
    const bottom = Math.max(...Object.values(frames).map((f) => f.y + f.h));
    this.bottom = bottom;
    this.totalW = 5 * (NW + GAPX) - GAPX + FRAME_PAD * 2;
    this.hubPos = { x: this.totalW / 2 - 105, y: bottom + 82, w: 210, h: 46 };
    this.applyLayout(first);
    return true;
  }

  applyLayout(instant) {
    const r = reducedMotion() || instant;
    this.world.classList.toggle('no-anim', r);
    for (const [id, e] of Object.entries(this.els)) {
      const p = this.pos[id];
      if (p) {
        const entering = e.el.classList.contains('is-hidden');
        e.el.style.setProperty('width', p.w + 'px');
        e.el.style.setProperty('height', p.h + 'px');
        if (entering) {
          // A node that was hidden appears in place (it fades in) instead of sliding in from the origin.
          e.el.style.setProperty('transition', 'none');
          e.el.style.setProperty('transform', `translate(${p.x}px, ${p.y}px)`);
          void e.el.offsetWidth;
          e.el.style.removeProperty('transition');
          e.el.classList.remove('is-hidden');
        } else {
          e.el.style.setProperty('transform', `translate(${p.x}px, ${p.y}px)`);
        }
        e.el.tabIndex = 0;
      } else {
        e.el.classList.add('is-hidden');
        e.el.tabIndex = -1;
      }
    }
    const model = this.model;
    for (const g of model.topology.groups) {
      const f = this.frames[g.id];
      const fp = this.framePos[g.id];
      f.el.style.setProperty('transform', `translate(${fp.x}px, ${fp.y}px)`);
      f.el.style.setProperty('width', fp.w + 'px');
      f.el.style.setProperty('height', fp.h + 'px');
      const all = model.topology.nodes.filter((n) => n.group === g.id).length;
      setText(f.count, `${fp.n} of ${all}`);
      const hidden = all - fp.n;
      const open = this.expanded.has(g.id);
      f.toggle.hidden = hidden === 0 && !open;
      f.toggle.replaceChildren(icon(open ? 'chevronUp' : 'chevronDown', 14), h('span', { text: open ? 'Hide related' : `Show ${hidden} related` }));
      f.toggle.setAttribute('aria-expanded', String(open));
      f.toggle.setAttribute('aria-label', `${open ? 'Hide' : 'Show'} related stages in ${g.title}`);
    }
    this.hub.style.setProperty('transform', `translate(${this.hubPos.x}px, ${this.hubPos.y}px)`);
    this.hub.style.setProperty('width', this.hubPos.w + 'px');
    this.hub.style.setProperty('height', this.hubPos.h + 'px');
    // Edges follow the settled node positions: hide, redraw, reveal.
    this.edgeG.classList.add('is-relayout');
    clearTimeout(this.edgeTimer);
    const draw = () => {
      this.drawEdges();
      this.rebuildProbes();
      this.edgeG.classList.remove('is-relayout');
    };
    if (r) draw();
    else this.edgeTimer = setTimeout(draw, 300);
    if (this.autoFit && !instant) setTimeout(() => this.fit(true), 40);
  }

  // ---------------------------------------------------------------------------------------------- edges
  buildEdgeList() {
    const vis = (id) => !!this.pos[id];
    const list = [];
    const chain = CHAIN.filter(vis);
    for (let i = 0; i < chain.length - 1; i++) list.push({ id: `c:${chain[i]}>${chain[i + 1]}`, from: chain[i], to: chain[i + 1], kind: 'request' });
    for (const [a, b, label] of ACKS) {
      let from = a;
      if (a === 'posting-verify' && !vis(a)) from = 'wallet-ledger';
      if (vis(from) && vis(b)) list.push({ id: `a:${from}>${b}`, from, to: b, kind: 'ack', label });
    }
    for (const [a, b, label] of BRANCHES) if (vis(a) && vis(b)) list.push({ id: `b:${a}>${b}`, from: a, to: b, kind: 'branch', label });
    return list;
  }

  route(e, lanes) {
    const A = this.pos[e.from];
    const B = this.pos[e.to];
    const ay = A.y + A.h / 2;
    const by = B.y + B.h / 2;
    const lane = (gap) => {
      const used = lanes.gap[gap] = (lanes.gap[gap] || 0) + 1;
      return [0, -12, 12, -22, 22, -6, 6][used - 1] || 0;
    };
    // same column
    if (A.col === B.col) {
      if (Math.abs(A.idx - B.idx) === 1) {
        const down = B.idx > A.idx;
        return [[A.x + A.w / 2, down ? A.y + A.h : A.y], [B.x + B.w / 2, down ? B.y : B.y + B.h]];
      }
      const k = (lanes.col[A.col] = (lanes.col[A.col] || 0) + 1);
      const x = A.x + A.w + 10 + k * 8;
      return [[A.x + A.w, ay], [x, ay], [x, by], [B.x + B.w, by]];
    }
    const forward = B.col > A.col;
    if (forward) {
      const g1 = A.col;
      const x1 = A.x + A.w + GAPX / 2 + lane(g1);
      if (B.col === A.col + 1) return [[A.x + A.w, ay], [x1, ay], [x1, by], [B.x, by]];
      const chan = this.bottom + 20 + (lanes.chan = (lanes.chan || 0) + 1) * 12;
      const x2 = B.x - GAPX / 2 + lane(B.col - 1);
      return [[A.x + A.w, ay], [x1, ay], [x1, chan], [x2, chan], [x2, by], [B.x, by]];
    }
    // backward (acknowledgement flowing against the request direction)
    const g1 = A.col - 1;
    const x1 = A.x - GAPX / 2 + lane(g1);
    if (B.col === A.col - 1) return [[A.x, ay], [x1, ay], [x1, by], [B.x + B.w, by]];
    const chan = this.bottom + 20 + (lanes.chan = (lanes.chan || 0) + 1) * 12;
    const x2 = B.x + B.w + GAPX / 2 + lane(B.col);
    return [[A.x, ay], [x1, ay], [x1, chan], [x2, chan], [x2, by], [B.x + B.w, by]];
  }

  drawEdges() {
    this.edgeG.replaceChildren();
    this.chipLayer.replaceChildren();
    this.edges = this.buildEdgeList();
    const lanes = { gap: {}, col: {}, chan: 0 };
    const placed = [];
    for (const e of this.edges) {
      const pts = this.route(e, lanes);
      e.pts = pts;
      e.path = svg('path', { class: 'edge-line', d: roundedPath(pts, 10) });
      e.g = svg('g', { class: `edge edge--${e.kind}`, dataset: { id: e.id } }, e.path);
      this.edgeG.append(e.g);
      if (e.label) {
        e.chip = h('span', { class: 'gchip gchip--' + e.kind, text: e.label });
        const at = this.chipSpot(e, placed);
        if (at) {
          e.chip.style.setProperty('left', at.x + 'px');
          e.chip.style.setProperty('top', at.y + 'px');
          placed.push(at.r);
          this.chipLayer.append(e.chip);
        } else {
          e.chip = null; // nowhere clear to put it; the edge still carries its meaning in the inspector
        }
      }
    }
    this.syncEdges();
  }

  /** First spot along the edge where the label clears every node and every label already placed. */
  chipSpot(e, placed) {
    const w = e.label.length * 6.1 + 16;
    const hgt = 20;
    const nodes = Object.values(this.pos);
    const segs = [];
    for (let i = 0; i < e.pts.length - 1; i++) {
      const [x0, y0] = e.pts[i];
      const [x1, y1] = e.pts[i + 1];
      segs.push({ x0, y0, x1, y1, len: Math.hypot(x1 - x0, y1 - y0) });
    }
    segs.sort((a, b) => b.len - a.len);
    for (const sg of segs) {
      for (const f of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const x = sg.x0 + (sg.x1 - sg.x0) * f;
        const y = sg.y0 + (sg.y1 - sg.y0) * f;
        const r = { l: x - w / 2 - 3, r: x + w / 2 + 3, t: y - hgt / 2 - 2, b: y + hgt / 2 + 2 };
        const hit = (q) => r.l < q.r && q.l < r.r && r.t < q.b && q.t < r.b;
        if (nodes.some((n) => hit({ l: n.x, r: n.x + n.w, t: n.y, b: n.y + n.h }))) continue;
        if (placed.some(hit)) continue;
        return { x, y, r };
      }
    }
    return null;
  }

  syncEdges() {
    const nodes = this.model.nodes;
    for (const e of this.edges) {
      if (!e.g) continue;
      const s = nodes[e.from].processing;
      const t = nodes[e.to].processing;
      let st = 'unknown';
      if (s !== 'unknown' && t !== 'unknown') {
        if (s === 'failed' || t === 'failed') st = 'failed';
        else if (s === 'unavailable' || t === 'unavailable') st = 'unavailable';
        else if (t === 'pending' || t === 'running' || s === 'pending') st = 'pending';
        else st = 'done';
      } else if (e.kind === 'request' && s === 'completed' && t === 'unknown') st = 'pending';
      if (e.kind === 'branch' && !(this.model.nodes[e.to].obs.length || this.model.nodes[e.to].processing !== 'unknown')) st = 'unknown';
      e.state = st;
      e.g.setAttribute('class', `edge edge--${e.kind} is-${st}`);
      e.path.setAttribute('marker-end', `url(#arrow-${st})`);
      if (e.id === 'b:routing-request>retry-history' && e.chip) {
        const r = nodes['retry-history'];
        const text = r.processing === 'unknown' ? 'attempts' : r.processing === 'completed' ? `attempt ${r.attempt} completed` : r.processing === 'failed' ? `attempt ${r.attempt} failed` : `attempt ${r.attempt} · no ack`;
        setText(e.chip, text);
        e.chip.classList.toggle('is-amber', r.processing === 'pending' || r.processing === 'failed');
        e.chip.classList.toggle('is-green', r.processing === 'completed');
      }
      if (e.chip) e.chip.classList.toggle('is-muted', st === 'unknown');
    }
  }

  // ---------------------------------------------------------------------------------------------- nodes
  syncAll() {
    for (const id of Object.keys(this.els)) this.syncNode(id, false);
    this.syncEdges();
  }

  syncNode(id, flash) {
    const n = this.model.nodes[id];
    const e = this.els[id];
    if (!n || !e) return;
    const el = e.el;
    const was = el.dataset.st;
    const st = n.processing;
    el.className = `gnode kind-${n.kind} st-${st}` + (el.classList.contains('is-hidden') ? ' is-hidden' : '') + (n.inspected ? ' is-inspected' : '') +
      (n.inspecting ? ' is-inspecting' : '') + (n.recovered ? ' is-recovered' : '') + (this.selected === id ? ' is-selected' : '') +
      (flash && was && was !== st ? ' is-changed' : '');
    el.dataset.st = st;
    if (flash) setTimeout(() => el.classList.remove('is-changed'), 700);
    const label = STATE_LABEL[st];
    if (e.badge.dataset.st !== st) {
      e.badge.replaceChildren(icon(STATE_ICON[st], 15, 'st-ic'));
      e.badge.dataset.st = st;
    }
    setText(e.status, n.inspecting ? 'Checking' : label);
    // One important secondary fact: the observed headline, else the latest record fact.
    const fact = n.headline || n.fact || (st === 'unknown' ? 'No record observed yet' : '');
    setText(e.fact, fact);
    e.fact.title = [n.headline, n.fact].filter(Boolean).join(' · ');
    e.status.title = label;
    const tag = n.recovered ? 'Recovered' : n.inspected ? 'Inspected' : '';
    setText(e.tag, tag);
    el.setAttribute('aria-label', `${n.title}. ${STATE_LABEL[st]}${n.headline ? ', ' + n.headline : ''}${n.fact ? '. ' + n.fact : ''}${n.inspected ? '. Inspected.' : ''}`);
    el.setAttribute('aria-pressed', String(this.selected === id));
  }

  select(id) {
    const prev = this.selected;
    this.selected = id;
    if (prev && this.els[prev]) this.syncNode(prev, false);
    if (id) this.syncNode(id, false);
    this.onSelect(id);
  }

  toggleGroup(g) {
    if (this.expanded.has(g)) this.expanded.delete(g);
    else this.expanded.add(g);
    this.relayout(true);
    this.syncAll();
  }

  expandAll(on) {
    this.expanded = on ? new Set(this.model.topology.groups.map((g) => g.id)) : new Set();
    this.relayout(true);
    this.syncAll();
  }

  allExpanded() {
    return this.model && this.expanded.size === this.model.topology.groups.length;
  }

  nodeKey(ev, id) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.select(id);
      return;
    }
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[ev.key];
    if (!dir) return;
    ev.preventDefault();
    ev.stopPropagation();
    const from = this.pos[id];
    let best = null;
    let bestScore = Infinity;
    for (const [oid, p] of Object.entries(this.pos)) {
      if (oid === id) continue;
      const dx = p.x - from.x;
      const dy = p.y - from.y;
      if (dir[0] && Math.sign(dx) !== dir[0]) continue;
      if (dir[1] && Math.sign(dy) !== dir[1]) continue;
      const score = dir[0] ? Math.abs(dx) + Math.abs(dy) * 2.2 : Math.abs(dy) + Math.abs(dx) * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = oid;
      }
    }
    if (best) {
      this.els[best].el.focus();
      this.ensureVisible(best);
    }
  }

  // ---------------------------------------------------------------------------------------------- probes
  probePoints(nodeId) {
    const p = this.pos[nodeId];
    if (!p) return null;
    const hub = this.hubPos;
    const hx = hub.x + hub.w / 2;
    const chan = this.bottom + 56;
    const py = p.y + p.h * 0.8;
    const gx = p.x - 12;
    return [[hx, hub.y], [hx, chan], [gx, chan], [gx, py], [p.x, py]];
  }

  probeStart(nodeId, checkId, relaid) {
    const begin = () => {
      const pts = this.probePoints(nodeId);
      if (!pts) return;
      const d = roundedPath(pts, 12);
      const path = svg('path', { class: 'probe-line', d, 'marker-end': 'url(#arrow-probe)' });
      const dot = svg('circle', { class: 'probe-dot', r: 5, cx: pts[0][0], cy: pts[0][1] });
      const g = svg('g', { class: 'probe is-active', dataset: { check: checkId } }, path, dot);
      this.probeG.append(g);
      this.probes.set(checkId, { g, path, dot, node: nodeId, done: false });
      if (!reducedMotion()) this.travel(path, dot, 750, false);
      else dot.setAttribute('class', 'probe-dot is-static');
    };
    if (relaid) setTimeout(begin, 320);
    else begin();
    if (this.follow) setTimeout(() => this.focusNode(nodeId), relaid ? 340 : 20);
  }

  probeDone(checkId, status) {
    const pr = this.probes.get(checkId);
    if (!pr) return;
    pr.done = true;
    pr.g.classList.toggle('is-unavailable', status === 'unavailable');
    if (!reducedMotion()) this.travel(pr.path, pr.dot, 520, true);
    setTimeout(() => {
      pr.g.classList.add('is-fading');
      setTimeout(() => {
        pr.g.remove();
        this.probes.delete(checkId);
      }, 600);
    }, reducedMotion() ? 1200 : 700);
  }

  rebuildProbes() {
    for (const [id, pr] of this.probes) {
      const pts = this.probePoints(pr.node);
      if (!pts) continue;
      pr.path.setAttribute('d', roundedPath(pts, 12));
    }
  }

  travel(path, dot, ms, reverse) {
    const len = path.getTotalLength();
    const t0 = performance.now();
    const step = (now) => {
      const t = clamp((now - t0) / ms, 0, 1);
      const pt = path.getPointAtLength((reverse ? 1 - t : t) * len);
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------------------------------------- camera
  apply() {
    const v = this.view;
    this.world.style.setProperty('transform', `translate(${v.x}px, ${v.y}px) scale(${v.k})`);
    this.root.style.setProperty('--zoom', String(v.k));
  }

  bounds() {
    const f = Object.values(this.framePos || {});
    if (!f.length) return { x: 0, y: 0, w: 1, h: 1 };
    const x0 = Math.min(...f.map((q) => q.x));
    const y0 = Math.min(...f.map((q) => q.y));
    const x1 = Math.max(...f.map((q) => q.x + q.w));
    const y1 = this.hubPos.y + this.hubPos.h;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  fit(animate = true) {
    if (!this.model || !this.framePos) return;
    const { clientWidth: W, clientHeight: H } = this.root;
    if (!W || !H) return;
    const b = this.bounds();
    const pad = 28;
    const k = clamp(Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h), 0.45, 1);
    const target = { k, x: (W - b.w * k) / 2 - b.x * k, y: (H - b.h * k) / 2 - b.y * k };
    this.autoFit = true;
    this.moveTo(target, animate ? 520 : 0);
  }

  focusNode(id, minZoom = 1) {
    const p = this.pos[id];
    if (!p || !this.follow) return;
    const { clientWidth: W, clientHeight: H } = this.root;
    const k = clamp(Math.max(this.view.k, minZoom), 0.45, 1.15);
    const target = { k, x: W * 0.5 - (p.x + p.w / 2) * k, y: H * 0.46 - (p.y + p.h / 2) * k };
    // do not zoom in aggressively: only pan when the node is already comfortably readable
    this.autoFit = false;
    this.moveTo(target, 560);
  }

  ensureVisible(id) {
    const p = this.pos[id];
    if (!p) return;
    const { clientWidth: W, clientHeight: H } = this.root;
    const k = this.view.k;
    const sx = p.x * k + this.view.x;
    const sy = p.y * k + this.view.y;
    let dx = 0;
    let dy = 0;
    if (sx < 20) dx = 40 - sx;
    else if (sx + p.w * k > W - 20) dx = W - 40 - (sx + p.w * k);
    if (sy < 20) dy = 40 - sy;
    else if (sy + p.h * k > H - 20) dy = H - 40 - (sy + p.h * k);
    if (dx || dy) this.moveTo({ ...this.view, x: this.view.x + dx, y: this.view.y + dy }, 220);
  }

  moveTo(target, ms) {
    cancelAnimationFrame(this.anim);
    if (!ms || reducedMotion()) {
      this.view = { ...target };
      this.apply();
      return;
    }
    const from = { ...this.view };
    const t0 = performance.now();
    const step = (now) => {
      const t = easeInOut(clamp((now - t0) / ms, 0, 1));
      this.view = { x: from.x + (target.x - from.x) * t, y: from.y + (target.y - from.y) * t, k: from.k + (target.k - from.k) * t };
      this.apply();
      if (t < 1) this.anim = requestAnimationFrame(step);
    };
    this.anim = requestAnimationFrame(step);
  }

  setFollow(on) {
    this.follow = on;
    this.onFollowChange(on);
  }

  manual() {
    // The user took the camera: stop following until they ask for it again.
    cancelAnimationFrame(this.anim);
    this.autoFit = false;
    if (this.follow) this.setFollow(false);
  }

  zoomAt(factor, cx, cy) {
    const { x, y, k } = this.view;
    const k2 = clamp(k * factor, 0.4, 1.6);
    const f = k2 / k;
    this.view = { k: k2, x: cx - (cx - x) * f, y: cy - (cy - y) * f };
    this.apply();
  }

  zoomBy(factor) {
    this.manual();
    this.zoomAt(factor, this.root.clientWidth / 2, this.root.clientHeight / 2);
  }

  bind() {
    const r = this.root;
    let drag = null;
    r.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || ev.target.closest('.gnode, button, .ghub, .graph-toolbar, .graph-legend')) return;
      drag = { x: ev.clientX, y: ev.clientY, vx: this.view.x, vy: this.view.y };
      r.setPointerCapture(ev.pointerId);
      r.classList.add('is-panning');
      this.manual();
    });
    r.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      this.view = { ...this.view, x: drag.vx + ev.clientX - drag.x, y: drag.vy + ev.clientY - drag.y };
      this.apply();
    });
    const end = () => {
      drag = null;
      r.classList.remove('is-panning');
    };
    r.addEventListener('pointerup', end);
    r.addEventListener('pointercancel', end);
    r.addEventListener('dblclick', (ev) => {
      if (!ev.target.closest('.gnode, button')) this.fit(true);
    });
    r.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      this.manual();
      const rect = r.getBoundingClientRect();
      const f = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0013));
      this.zoomAt(f, ev.clientX - rect.left, ev.clientY - rect.top);
    }, { passive: false });
    r.addEventListener('keydown', (ev) => {
      if (ev.target !== r) return;
      const step = 70;
      const k = ev.key;
      if (k === '0') this.fit(true);
      else if (k === '+' || k === '=') this.zoomBy(1.15);
      else if (k === '-' || k === '_') this.zoomBy(1 / 1.15);
      else if (k.startsWith('Arrow')) {
        ev.preventDefault();
        this.manual();
        const d = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[k];
        this.view = { ...this.view, x: this.view.x + d[0], y: this.view.y + d[1] };
        this.apply();
      } else if (k === 'Tab' || k === 'Enter') {
        const first = Object.entries(this.pos).sort((a, b) => a[1].col - b[1].col || a[1].idx - b[1].idx)[0];
        if (k === 'Enter' && first) this.els[first[0]].el.focus();
      }
    });
  }

  destroy() {
    this.ro.disconnect();
    cancelAnimationFrame(this.anim);
  }
}
