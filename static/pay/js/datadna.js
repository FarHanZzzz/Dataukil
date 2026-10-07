// DataDNA on the operator surface: the funnel every personal-data access passes through, and the ledger popup that opens
// from it. Everything shown here comes from saved DATADNA_* events (see model.js); nothing is computed in the browser.

import { h, svg, fill, clear, reducedMotion, hms, simClock } from './util.js';
import { icon } from './icons.js';

export const DECISION = {
  passed: { key: 'pass', label: 'Cleared', tone: 'ok', icon: 'check' },
  controlled: { key: 'control', label: 'Controlled', tone: 'warn', icon: 'shield' },
  blocked: { key: 'block', label: 'Blocked', tone: 'bad', icon: 'x' },
};
const GATE_STATUS = {
  pass: { label: 'Clear', tone: 'ok', icon: 'check' },
  control: { label: 'Controlled', tone: 'warn', icon: 'shield' },
  block: { label: 'Blocked', tone: 'bad', icon: 'x' },
};
const KIND = { flow: 'Payment hand-off', check: 'Investigation check', ai_request: 'AI follow-up request', export: 'Report export' };
const OUTCOME = { released: 'Released', partial: 'Partly withheld', denied: 'Refused before reading' };
const FIELD_ACTION = { release: 'Released', mask: 'Masked', withhold: 'Withheld', exclude: 'Excluded' };
const GATE_ORDER = ['why', 'who', 'where', 'how', 'until'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function helix(size = 18, cls = '') {
  return icon('helix', size, cls);
}

function gateMeta(model, id) {
  const cfg = (model.dna.config && model.dna.config.gates) || [];
  return cfg.find((g) => g.id === id) || { id, n: GATE_ORDER.indexOf(id) + 1, question: id, title: id, asks: '' };
}
const dnaGates = (model) => GATE_ORDER.map((id) => gateMeta(model, id));
const principleTitle = (model, code) => {
  const p = model.dna.config && model.dna.config.principles && model.dna.config.principles[code];
  return p ? p.title : String(code || '').replace(/_/g, ' ');
};

// ------------------------------------------------------------------------------------------------------- payment journey
// The five hand-offs one add-money payment goes through. Statuses come only from saved events: a hand-off has a DataDNA
// review (done / held), is the one the run is waiting on (active), never got its reply (stalled) or has not been reached.
export const JOURNEY = [
  { id: 'request', title: 'Customer request', short: 'Customer app', ic: 'phone', node: 'intent' },
  { id: 'bank', title: 'Issuing bank', short: 'Funding debit', ic: 'bank', node: 'bank-debit' },
  { id: 'partner', title: 'Wallet partner', short: 'Credit instruction', ic: 'send', node: 'routing-request' },
  { id: 'ack', title: 'Partner reply', short: 'Acknowledgement', ic: 'reply', node: 'partner-ack' },
  { id: 'customer', title: 'Customer status', short: 'Message to customer', ic: 'message', node: 'customer-update' },
];
export const hasJourney = (model) => model.dna.envelopes.some((e) => e.kind === 'processing');

export function journeyOf(model) {
  const hops = model.dna.hops || {};
  const ack = model.nodes['partner-ack'];
  const finished = model.payment.status === 'COMPLETED';
  const live = hasJourney(model);
  let prev = true;
  return JOURNEY.map((j) => {
    const call = hops[j.id] || null;
    let st = 'waiting';
    if (call) st = call.decision === 'blocked' ? 'held' : call.state === 'unconfirmed' ? 'uncertain' : 'done';
    else if (j.id === 'ack' && ack && ack.processing === 'failed' && !finished) st = 'stalled';
    else if (live && prev && !finished) st = 'active';
    prev = !!call;
    return { ...j, call, st };
  });
}

const HOP_SUB = {
  waiting: () => 'Not reached yet',
  active: () => 'In progress',
  stalled: () => 'No reply. Stopped here',
};
function hopSub(model, hop) {
  if (HOP_SUB[hop.st]) return HOP_SUB[hop.st]();
  const c = hop.call;
  if (hop.st === 'held') { const g = c.blocked_at && gateMeta(model, c.blocked_at); return g ? `Held at ${g.n} ${g.question} ${g.term || ''}`.trim() : 'Held by DataDNA'; }
  if (hop.st === 'uncertain') return 'Told: not confirmed yet';
  const mask = c.fields.filter((f) => f.action === 'mask').length;
  const held = c.fields.filter((f) => f.action === 'withhold' || f.action === 'exclude').length;
  if (c.decision === 'controlled') return [mask ? `${mask} masked` : '', held ? `${held} withheld` : ''].filter(Boolean).join(' · ') || 'Sent with controls';
  return 'Only what is needed';
}

// ------------------------------------------------------------------------------------------------------------ funnel
const W = 560;
const CY = 62;
const LEAK_Y = 98;
const MOUTH = 26;
const GATE_X = [112, 200, 288, 376, 464];
const OUTLET = 520;
const GATE_TERM = { why: 'Customer consent', who: 'Parties', where: 'Systems', how: 'Masking', until: 'Retention' };
const halfH = (x) => 26 - (14 * (x - 40)) / 520;

export class DnaFunnel {
  constructor({ onOpen }) {
    this.onOpen = onOpen;
    this.model = null;
    this.queue = [];
    this.playing = false;
    this.destroyed = false;
    this.timers = new Set();
    this.epoch = 0; // bumped by reset() so an animation in flight stops touching the picture
    this.settled = null; // number of calls whose animation has finished while a backlog is playing
    this.lastCallId = null;
    this.parts = {};
    this.el = this.build();
  }

  build() {
    const gates = GATE_ORDER.map((id, i) => {
      const x = GATE_X[i];
      const hh = halfH(x) + 5;
      const g = svg('g', { class: 'dna-gate', 'data-gate': id },
        svg('path', { class: 'dna-leak', d: `M${x} ${CY + hh} V${LEAK_Y}` }),
        svg('g', { class: 'dna-leak-end', transform: `translate(${x} ${LEAK_Y + 6})` },
          svg('circle', { r: 6 }), svg('path', { d: 'M-2.4 -2.4 2.4 2.4M2.4 -2.4-2.4 2.4' })),
        svg('line', { class: 'dna-plate', x1: x, x2: x, y1: CY - hh, y2: CY + hh }),
        svg('circle', { class: 'dna-knob', cx: x, cy: CY - hh - 1, r: 3.4 }),
        svg('text', { class: 'dna-gate-term', x, y: CY - hh - 20 }, GATE_TERM[id]),
        svg('text', { class: 'dna-gate-n', x, y: CY - hh - 9 }, `${i + 1} ${['Why?', 'Who?', 'Where?', 'How?', 'Until when?'][i]}`),
        svg('text', { class: 'dna-gate-t', x, y: 120 }, ''));
      return g;
    });
    this.parts.gates = Object.fromEntries(GATE_ORDER.map((id, i) => [id, gates[i]]));
    this.parts.packet = svg('g', { class: 'dna-packet', opacity: 0 }, svg('circle', { class: 'dna-packet-halo', r: 11 }), svg('circle', { class: 'dna-packet-core', r: 5.5 }));
    this.parts.outlet = svg('g', { class: 'dna-outlet' }, svg('path', { d: `M${OUTLET - 18} ${CY} H${OUTLET + 20}` }), svg('path', { d: `M${OUTLET + 12} ${CY - 6} l8 6 -8 6` }));
    const defs = svg('defs', null,
      svg('linearGradient', { id: 'dnaFunnelFill', x1: 0, x2: 1, y1: 0, y2: 0 },
        svg('stop', { offset: '0%', class: 'dna-grad-a' }), svg('stop', { offset: '100%', class: 'dna-grad-b' })));
    const body = svg('path', { class: 'dna-body', d: `M${MOUTH + 8} ${CY - 28} Q${MOUTH - 4} ${CY} ${MOUTH + 8} ${CY + 28} L${OUTLET - 18} ${CY + 12} V${CY - 12} Z`, fill: 'url(#dnaFunnelFill)' });
    const map = svg('svg', { class: 'dna-svg', viewBox: `0 0 ${W} 128`, preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'Five DataDNA gates every add-money data hand-off passes through' },
      defs, body,
      svg('path', { class: 'dna-flow', d: `M${MOUTH + 6} ${CY} H${OUTLET - 16}` }),
      ...gates, this.parts.outlet, this.parts.packet,
      svg('text', { class: 'dna-inlet', x: 6, y: CY - 36 }, 'Data requests'),
      svg('text', { class: 'dna-inlet dna-inlet-out', x: W - 2, y: CY - 22, 'text-anchor': 'end' }, 'Released'));
    this.parts.svg = map;

    this.parts.status = h('span', { class: 'dna-now-text' }, 'Waiting for an investigation');
    this.parts.nowDot = h('span', { class: 'dna-now-dot' });
    this.parts.chips = {
      total: h('b', null, '0'), ctl: h('b', null, '0'), blk: h('b', null, '0'),
    };
    const chip = (cls, label, b) => h('span', { class: `dna-chip ${cls}` }, b, ' ', label);

    this.parts.hops = {};
    this.parts.journey = h('ol', { class: 'dna-journey', 'aria-label': 'Where this add-money payment is, and where it stopped' },
      ...JOURNEY.map((j, i) => {
        const ic = h('span', { class: 'dna-hop-ic' });
        const title = h('b', null, j.title);
        const sub = h('small', null, '');
        const btn = h('button', { type: 'button', class: 'dna-hop-btn', onclick: () => this.onOpen && this.onOpen(this.parts.hops[j.id].call ? this.parts.hops[j.id].call.id : null, 'journey') }, ic, h('span', { class: 'dna-hop-text' }, title, sub));
        const li = h('li', { class: 'dna-hop is-waiting', 'data-hop': j.id }, btn);
        this.parts.hops[j.id] = { li, btn, ic, sub, call: null, st: '' };
        return li;
      }));
    const top = h('button', { class: 'dna-top', type: 'button', 'aria-haspopup': 'dialog', 'aria-label': 'Open the DataDNA ledger: every data hand-off and every privacy concern for this payment', onclick: () => this.onOpen && this.onOpen() },
      h('span', { class: 'dna-brand' },
        h('span', { class: 'dna-mark' }, helix(22)),
        h('span', { class: 'dna-brand-text' }, h('strong', null, 'DataDNA'), h('small', null, 'Privacy you can enforce'))),
      h('span', { class: 'dna-pipe' }, map),
      h('span', { class: 'dna-side' },
        h('span', { class: 'dna-now' }, this.parts.nowDot, this.parts.status),
        h('span', { class: 'dna-chips' }, chip('dna-chip--n', 'reviewed', this.parts.chips.total), chip('dna-chip--warn', 'controlled', this.parts.chips.ctl), chip('dna-chip--bad', 'blocked', this.parts.chips.blk)),
        h('span', { class: 'dna-open' }, 'Open the DNA ledger', icon('arrowRight', 14))));
    this.parts.top = top;
    return h('div', { class: 'dna-band is-idle' }, top, this.parts.journey);
  }

  focus() {
    this.parts.top.focus({ preventScroll: true });
  }

  /** Keep the board below the band however tall the band currently is (journey row shown or not, narrow screens). */
  watchSize() {
    if (this.ro || typeof ResizeObserver === 'undefined') return;
    this.ro = new ResizeObserver(() => {
      const stage = this.el.parentElement;
      if (stage) stage.style.setProperty('--dna-h', `${Math.ceil(this.el.getBoundingClientRect().height)}px`);
    });
    this.ro.observe(this.el);
  }

  // The persistent picture: tallies under each gate, red leak lines where something was stopped, and the counters.
  render(model) {
    this.model = model;
    const d = model.dna;
    // While verdicts are still travelling through the gates, only the ones that have finished are counted.
    const upto = this.settled == null ? d.calls.length : Math.min(this.settled, d.calls.length);
    const calls = d.calls.slice(0, upto);
    const gates = Object.fromEntries(GATE_ORDER.map((id) => [id, { pass: 0, control: 0, block: 0 }]));
    const t = { total: calls.length, controlled: 0, blocked: 0 };
    for (const c of calls) {
      if (c.decision === 'controlled') t.controlled++;
      if (c.decision === 'blocked') t.blocked++;
      for (const g of c.gates) gates[g.id][g.status]++;
    }
    const has = d.calls.length > 0 || d.envelopes.length > 0;
    this.el.classList.toggle('is-idle', !has);
    this.renderJourney(model, upto);
    for (const id of GATE_ORDER) {
      const n = gates[id];
      const g = this.parts.gates[id];
      g.classList.toggle('is-leaking', n.block > 0);
      g.classList.toggle('has-control', n.control > 0);
      if (!n.block) g.classList.remove('is-drop');
      const label = g.querySelector('.dna-gate-t');
      const txt = n.pass + n.control + n.block === 0 ? '' : n.block ? `${n.block} stopped` : n.control ? `${n.control} controlled` : `${n.pass} clear`;
      if (label.textContent !== txt) label.textContent = txt;
    }
    this.parts.chips.total.textContent = t.total;
    this.parts.chips.ctl.textContent = t.controlled;
    this.parts.chips.blk.textContent = t.blocked;
    this.el.classList.toggle('has-blocks', t.blocked > 0);
    if (!this.playing && !this.queue.length) this.paintLast();
  }

  // The payment journey: one chip per hand-off, drawn from saved events, so it follows the add-money run as it moves.
  renderJourney(model, upto) {
    const live = hasJourney(model);
    this.parts.journey.hidden = !live;
    this.el.classList.toggle('has-journey', live);
    if (!live) return;
    // A hand-off whose verdict is still travelling through the gates is shown as in progress until it settles.
    const hold = new Set(model.dna.calls.slice(upto).map((c) => c.id));
    const hops = journeyOf(model);
    let stopped = null;
    for (const hop of hops) {
      const p = this.parts.hops[hop.id];
      let st = hop.st;
      if (hop.call && hold.has(hop.call.id)) st = 'active';
      if (st === 'held' || st === 'stalled') stopped = stopped || hop;
      if (p.st !== st || p.call !== hop.call) {
        p.st = st; p.call = hop.call;
        p.li.className = `dna-hop is-${st}`;
        p.li.setAttribute('aria-current', st === 'active' ? 'step' : 'false');
        clear(p.ic);
        p.ic.append(icon({ done: 'check', held: 'lock', stalled: 'x', uncertain: 'warning', active: 'ring', waiting: 'clock' }[st], 14));
      }
      const t = hopSub(model, { ...hop, st });
      if (p.sub.textContent !== t) p.sub.textContent = t;
      p.btn.title = hop.call ? `${hop.call.frm} to ${hop.call.to}: ${hop.call.summary}` : `${hop.title}: ${t}`;
    }
    this.stopped = stopped;
    this.el.classList.toggle('is-stopped-here', !!stopped);
  }

  paintLast() {
    const d = this.model && this.model.dna;
    if (!d) return;
    if (this.stopped) {
      const s = this.stopped;
      this.setNow(s.st === 'stalled' ? 'Stopped at the wallet partner: no acknowledgement came back' : `${s.title} held: ${s.call.blocked_at ? 'blocked at ' + gateMeta(this.model, s.call.blocked_at).question : 'blocked'}`, 'block');
      return;
    }
    const last = d.calls[d.calls.length - 1];
    this.setNow(last ? this.lineFor(last) : d.envelopes.length ? 'Access envelope open. Waiting for the first data call' : 'Waiting for an investigation', last ? DECISION[last.decision].key : 'idle');
  }

  lineFor(call) {
    const g = call.blocked_at && gateMeta(this.model, call.blocked_at);
    if (call.decision === 'blocked') return `${call.label}: ${call.kind === 'flow' ? 'held' : 'blocked'} at ${g ? `${g.n} ${g.question} ${g.term || ''}`.trim() : 'a gate'}`;
    if (call.decision === 'controlled') return `${call.label}: ${call.kind === 'flow' ? 'sent with masking and limits' : 'released with controls'}`;
    return `${call.label}: cleared all five gates`;
  }

  setNow(text, tone) {
    this.parts.status.textContent = text;
    this.parts.nowDot.className = `dna-now-dot is-${tone}`;
    this.el.setAttribute('data-now', tone);
  }

  // A check was requested but DataDNA has not answered yet: show the request waiting at the mouth of the funnel.
  reviewing(label) {
    if (this.destroyed || this.playing || this.queue.length) return;
    this.setNow(`Reviewing: ${label}`, 'wait');
    this.parts.packet.setAttribute('class', 'dna-packet is-wait');
    this.parts.packet.setAttribute('opacity', 1);
    this.parts.packet.setAttribute('transform', `translate(${MOUTH + 4} ${CY})`);
  }

  // Add a verdict to the animation queue. Without motion (or when far behind) it only updates the state.
  play(call, model) {
    if (this.destroyed) return;
    const idx = model ? model.dna.calls.indexOf(call) : -1;
    if (idx >= 0 && this.settled == null) this.settled = idx;
    this.queue.push({ call, idx });
    if (!this.playing) this.drain();
  }

  async drain() {
    const ep = this.epoch;
    this.playing = true;
    while (this.queue.length && !this.destroyed && ep === this.epoch) {
      const { call, idx } = this.queue.shift();
      const rush = this.queue.length > 2;
      await this.run(call, rush, ep);
      if (ep !== this.epoch || this.destroyed) return;
      if (idx >= 0) this.settled = idx + 1;
      if (this.model) this.render(this.model);
    }
    if (ep !== this.epoch || this.destroyed) return;
    this.playing = false;
    this.settled = null;
    if (this.model) this.render(this.model);
    await this.sleepT(700);
    if (ep === this.epoch && !this.playing && !this.queue.length && !this.destroyed) {
      this.resetGateColours();
      this.parts.packet.setAttribute('opacity', 0);
      if (this.model) this.paintLast();
    }
  }

  sleepT(ms) {
    return new Promise((res) => {
      const t = setTimeout(() => { this.timers.delete(t); res(); }, ms);
      this.timers.add(t);
    });
  }

  tween(ms, fn) {
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => {
        if (this.destroyed) return res();
        const k = Math.min(1, (now - t0) / ms);
        fn(k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
        if (k < 1) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });
  }

  resetGateColours() {
    for (const g of Object.values(this.parts.gates)) g.classList.remove('is-pass', 'is-control', 'is-block', 'is-checking', 'is-flash');
  }

  async run(call, rush, ep) {
    const stale = () => ep !== this.epoch || this.destroyed;
    const calm = reducedMotion();
    const status = Object.fromEntries(call.gates.map((g) => [g.id, g.status]));
    const key = DECISION[call.decision].key;
    this.resetGateColours();
    this.parts.svg.classList.remove('is-stopped');
    this.setNow(call.kind === 'flow' ? `Reviewing hand-off: ${call.frm} to ${call.to}` : `Reviewing: ${call.label}`, 'wait');
    const packet = this.parts.packet;
    packet.setAttribute('class', 'dna-packet is-wait');
    packet.setAttribute('opacity', 1);
    let x = MOUTH + 4;
    const place = (px) => { x = px; packet.setAttribute('transform', `translate(${px} ${CY})`); };
    place(x);
    const speed = rush ? 0.35 : 1;
    let stoppedAt = null;
    for (let i = 0; i < GATE_ORDER.length; i++) {
      const id = GATE_ORDER[i];
      const gate = this.parts.gates[id];
      if (!calm && !rush) {
        const from = x;
        const to = GATE_X[i] - 12;
        await this.tween(130 * speed, (k) => place(from + (to - from) * k));
        if (stale()) return;
      } else place(GATE_X[i] - 12);
      gate.classList.add('is-checking');
      if (!calm && !rush) { await this.sleepT(55); if (stale()) return; }
      gate.classList.remove('is-checking');
      const st = status[id];
      gate.classList.add(`is-${st}`, 'is-flash');
      if (st === 'block') {
        stoppedAt = id;
        packet.setAttribute('class', 'dna-packet is-block');
        this.parts.svg.classList.add('is-stopped');
        break;
      }
      if (st === 'control') packet.setAttribute('class', 'dna-packet is-control');
      else if (!packet.classList.contains('is-control')) packet.setAttribute('class', 'dna-packet is-pass');
      if (!calm && !rush) {
        const from = x;
        await this.tween(70 * speed, (k) => place(from + 22 * k));
        if (stale()) return;
      }
    }
    this.setNow(this.lineFor(call), key);
    this.markLastBlock(stoppedAt, call);
    if (stoppedAt) {
      if (!calm && !rush) { await this.sleepT(650); if (stale()) return; }
      packet.setAttribute('opacity', 0);
    } else if (!calm && !rush) {
      const from = x;
      await this.tween(160, (k) => place(from + (OUTLET - from) * k));
      if (stale()) return;
      packet.setAttribute('opacity', 0);
      this.parts.outlet.classList.add('is-lit');
      await this.sleepT(150);
      if (stale()) return;
      this.parts.outlet.classList.remove('is-lit');
    } else packet.setAttribute('opacity', 0);
  }

  markLastBlock(stoppedAt, call) {
    this.lastCallId = call.id;
    if (stoppedAt) {
      const g = this.parts.gates[stoppedAt];
      g.classList.remove('is-drop');
      void g.getBoundingClientRect();
      g.classList.add('is-drop');
    }
  }

  /** Drop pending animations and return to the persistent picture (used when history is rebuilt or replayed). */
  reset() {
    this.epoch++;
    this.settled = null;
    this.queue.length = 0;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.playing = false;
    this.resetGateColours();
    this.parts.packet.setAttribute('opacity', 0);
    for (const g of Object.values(this.parts.gates)) g.classList.remove('is-drop');
    if (this.model) this.render(this.model);
  }

  destroy() {
    this.destroyed = true;
    if (this.ro) this.ro.disconnect();
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}

// ----------------------------------------------------------------------------------------------------------- pieces
const tonePill = (tone, text, ic) => h('span', { class: `dna-pill dna-pill--${tone}` }, ic ? icon(ic, 12) : null, text);

export function decisionPill(call) {
  const d = DECISION[call.decision];
  return tonePill(d.tone, d.label, d.icon);
}

/** A small badge for an observation card. Clicking it opens the ledger on that call. */
export function dnaBadge(call, onOpen) {
  if (!call) return null;
  const d = DECISION[call.decision];
  const gate = call.decision === 'blocked' && call.blocked_at ? ` at gate ${GATE_ORDER.indexOf(call.blocked_at) + 1}` : '';
  return h('button', { class: `dna-badge dna-badge--${d.tone}`, type: 'button', title: call.summary, onclick: (e) => { e.stopPropagation(); onOpen(call.id); } },
    helix(12), `DataDNA: ${d.label}${gate}`);
}

function concernCard(model, k, call, { showCall = false, onOpenCall = null } = {}) {
  const blocked = k.status === 'blocked';
  return h('article', { class: `dna-concern dna-concern--${blocked ? 'bad' : 'warn'}` },
    h('header', null,
      h('span', { class: 'dna-concern-ic' }, icon(blocked ? 'x' : 'shield', 14)),
      h('strong', null, k.title),
      h('span', { class: 'dna-concern-meta' },
        tonePill(blocked ? 'bad' : 'warn', blocked ? 'Blocked' : 'Mitigated'),
        k.severity ? h('span', { class: `dna-sev dna-sev--${k.severity}` }, k.severity) : null)),
    h('div', { class: 'dna-concern-tags' },
      h('span', { class: 'dna-tag' }, principleTitle(model, k.principle)),
      h('span', { class: 'dna-tag dna-tag--gate' }, `Gate ${GATE_ORDER.indexOf(k.gate) + 1} · ${gateMeta(model, k.gate).question}`),
      showCall && call ? h('button', { class: 'dna-tag dna-tag--link', type: 'button', onclick: () => onOpenCall && onOpenCall(call.id) }, call.label) : null),
    k.detail ? h('p', { class: 'dna-concern-detail' }, k.detail) : null,
    k.handling ? h('div', { class: 'dna-concern-row' }, h('span', null, 'How the AI handled it'), h('p', null, k.handling)) : null,
    k.alternative ? h('div', { class: 'dna-concern-row dna-concern-row--alt' }, h('span', null, 'Compliant alternative'), h('p', null, k.alternative)) : null);
}

function planList(plan, model) {
  if (!plan) return h('p', { class: 'dna-empty-line' }, 'The plan is compiled from the saved DataDNA records when the investigation closes.');
  const mark = { done: ['check', 'Done'], action: ['flag', 'Operator action'], scheduled: ['clock', 'Scheduled'] };
  return h('ol', { class: 'dna-plan' }, plan.steps.map((s) => {
    const [ic, lab] = mark[s.status] || ['list', s.status];
    return h('li', { class: `dna-plan-step is-${s.status}` },
      h('span', { class: 'dna-plan-ic' }, icon(ic, 14)),
      h('div', null,
        h('strong', null, s.step),
        h('p', null, s.detail),
        h('div', { class: 'dna-plan-meta' },
          h('span', { class: 'dna-tag' }, s.owner),
          h('span', { class: `dna-tag dna-tag--${s.status}` }, lab),
          s.gate ? h('span', { class: 'dna-tag dna-tag--gate' }, `Gate ${GATE_ORDER.indexOf(s.gate) + 1} · ${gateMeta(model, s.gate).question}`) : null,
          (s.concerns || []).map((c) => h('span', { class: 'dna-tag' }, principleTitle(model, c))))));
  }));
}

/** The compact block in the Plan tab. */
export function dnaPlanBlock(model, onOpen) {
  const d = model.dna;
  if (!d.calls.length && !d.plan) return null;
  const t = d.tally;
  return h('section', { class: 'dna-planblock' },
    h('header', null, h('span', { class: 'dna-mark dna-mark--sm' }, helix(16)), h('h4', null, 'PDPA compliance plan'),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => onOpen(undefined, 'plan') }, 'Open ledger')),
    h('p', { class: 'dna-planblock-sum' }, `${t.total} data calls reviewed: ${t.passed} cleared, ${t.controlled} controlled, ${t.blocked} blocked. ${t.blocked_concerns} blocked concern${t.blocked_concerns === 1 ? '' : 's'} flagged.`),
    planList(d.plan, model),
    h('p', { class: 'dna-fine' }, (d.config && d.config.disclosure) || ''));
}

// ------------------------------------------------------------------------------------------------------------ ledger
export class DnaLedger {
  constructor({ model, onClose }) {
    this.model = model;
    this.onClose = onClose;
    this.tab = 'journey';
    this.filter = 'all';
    this.sel = null;
    this.hopSel = null;
    this.dlg = h('dialog', { class: 'dna-dialog', 'aria-labelledby': 'dna-title' });
    this.dlg.addEventListener('close', () => { this.onClose && this.onClose(); });
    this.dlg.addEventListener('click', (e) => { if (e.target === this.dlg) this.close(); });
    document.body.append(this.dlg);
  }

  /** Open the ledger. With no arguments it opens on the payment journey; a call id opens that call; a tab or hop picks the view. */
  open(callId, tab, hop) {
    if (hop) this.hopSel = hop;
    if (callId) { this.sel = callId; this.filter = 'all'; if (!tab) tab = 'calls'; }
    if (!callId && !tab) tab = hasJourney(this.model) ? 'journey' : 'calls';
    if (tab === 'journey' && !hasJourney(this.model)) tab = 'calls';
    this.tab = tab;
    this.paint();
    if (!this.dlg.open) this.dlg.showModal();
    const sel = this.dlg.querySelector('.dna-call.is-sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  close() { if (this.dlg.open) this.dlg.close(); }

  destroy() {
    this.close();
    this.dlg.remove();
  }

  setModel(model) {
    this.model = model;
    if (this.dlg.open) this.paint();
  }

  paint() {
    const m = this.model;
    const d = m.dna;
    const calls = d.calls;
    if (!this.sel || !d.byId[this.sel]) {
      const firstBlocked = calls.find((c) => c.decision === 'blocked');
      this.sel = (firstBlocked || calls[0] || {}).id || null;
    }
    const keepScroll = this.dlg.querySelector('.dna-calls') ? this.dlg.querySelector('.dna-calls').scrollTop : 0;
    const keepDetail = this.dlg.querySelector('.dna-detail') ? this.dlg.querySelector('.dna-detail').scrollTop : 0;
    const t = d.tally;
    const tile = (cls, n, label) => h('div', { class: `dna-tile ${cls}` }, h('b', null, n), h('span', null, label));
    const tabBtn = (id, label, count) => h('button', { class: `dna-tab${this.tab === id ? ' is-on' : ''}`, type: 'button', role: 'tab', 'aria-selected': this.tab === id, onclick: () => { this.tab = id; this.paint(); } },
      label, count !== undefined ? h('span', { class: 'dna-tab-n' }, count) : null);
    let body;
    if (this.tab === 'journey') body = this.journeyView();
    else if (this.tab === 'calls') body = this.callsView();
    else if (this.tab === 'concerns') body = this.concernsView();
    else body = this.planView();
    fill(this.dlg,
      h('div', { class: 'dna-modal' },
        h('header', { class: 'dna-modal-head' },
          h('span', { class: 'dna-mark' }, helix(24)),
          h('div', { class: 'dna-modal-title' },
            h('h2', { id: 'dna-title' }, 'DataDNA ledger'),
            h('p', null, 'Every data hand-off in this add-money payment and every read the AI made, the five questions each one had to answer, and every privacy concern flagged.')),
          h('button', { class: 'dna-x', type: 'button', 'aria-label': 'Close the ledger', onclick: () => this.close() }, icon('x', 18))),
        h('div', { class: 'dna-tiles' },
          tile('', t.total, 'Data calls reviewed'), tile('is-ok', t.passed, 'Cleared'), tile('is-warn', t.controlled, 'Sent with masking or limits'),
          tile('is-bad', t.blocked, 'Held or partly withheld'), tile('is-bad-soft', t.blocked_concerns, 'Blocked concerns flagged')),
        h('div', { class: 'dna-tabs', role: 'tablist' }, hasJourney(m) ? tabBtn('journey', 'Payment journey') : null, tabBtn('calls', 'Every data call', calls.length), tabBtn('concerns', 'Concerns', t.concerns), tabBtn('plan', 'Compliance plan')),
        body,
        h('footer', { class: 'dna-modal-foot' }, icon('lock', 13), h('span', null, (d.config && d.config.disclosure) || ''))));
    const list = this.dlg.querySelector('.dna-calls');
    if (list) list.scrollTop = keepScroll;
    const det = this.dlg.querySelector('.dna-detail');
    if (det) det.scrollTop = keepDetail;
  }

  callsView() {
    const m = this.model;
    const calls = m.dna.calls;
    if (!calls.length) {
      return h('div', { class: 'dna-body-pane' }, this.empty());
    }
    const counts = { all: calls.length, blocked: 0, controlled: 0, passed: 0 };
    for (const c of calls) counts[c.decision]++;
    const shown = calls.filter((c) => this.filter === 'all' || c.decision === this.filter);
    const filt = (id, label) => h('button', { class: `dna-filter${this.filter === id ? ' is-on' : ''}`, type: 'button', onclick: () => { this.filter = id; this.paint(); } }, label, h('span', null, counts[id]));
    const item = (c) => {
      const dd = DECISION[c.decision];
      const g = c.blocked_at ? gateMeta(m, c.blocked_at) : null;
      return h('button', { class: `dna-call dna-call--${dd.tone}${c.id === this.sel ? ' is-sel' : ''}`, type: 'button', onclick: () => { this.sel = c.id; this.paint(); } },
        h('span', { class: 'dna-call-ic' }, icon(dd.icon, 13)),
        h('span', { class: 'dna-call-main' },
          h('strong', null, c.label),
          h('small', null, c.kind === 'flow' ? `${c.frm} to ${c.to} · ` : '', c.decision === 'blocked' && g ? `${OUTCOME[c.outcome] || dd.label} · stopped at ${g.n} ${g.question}` : c.decision === 'controlled' ? 'Released with controls' : 'Cleared all five gates')),
        h('span', { class: 'dna-call-time' }, c.kind === 'ai_request' ? 'AI ask' : c.kind === 'export' ? 'Export' : simClock(c.sim_ms || 0)));
    };
    const sel = m.dna.byId[this.sel];
    return h('div', { class: 'dna-body-pane dna-split' },
      h('aside', { class: 'dna-rail' },
        h('div', { class: 'dna-filters' }, filt('all', 'All'), filt('blocked', 'Blocked'), filt('controlled', 'Controlled'), filt('passed', 'Cleared')),
        h('div', { class: 'dna-calls' }, shown.length ? shown.map(item) : h('p', { class: 'dna-empty-line' }, 'Nothing in this filter.'))),
      h('section', { class: 'dna-detail', 'aria-live': 'polite' }, sel ? this.callDetail(sel) : this.empty()));
  }

  // The payment journey: where this add-money payment is, which hand-offs DataDNA reviewed, and where it stopped.
  journeyView() {
    const m = this.model;
    const hops = journeyOf(m);
    const stalled = hops.find((x) => x.st === 'stalled');
    const held = hops.find((x) => x.st === 'held');
    const active = hops.find((x) => x.st === 'active');
    const finished = m.payment.status === 'COMPLETED';
    const reviewed = hops.filter((x) => x.call);
    const ctl = reviewed.filter((x) => x.call.decision === 'controlled').length;
    const unconfirmedTold = hops.find((x) => x.id === 'customer' && x.st === 'uncertain');
    let tone = 'ok'; let ic = 'check'; let head; let body;
    if (stalled) {
      tone = 'bad'; ic = 'x';
      head = 'Stopped at the wallet partner reply';
      body = `The wallet partner has not acknowledged the credit, so the money is not confirmed in the wallet. ${unconfirmedTold ? 'DataDNA recorded that the customer was told "not confirmed yet" and was sent no claim of success. ' : ''}Nothing more leaves the add-money service until the partner replies; an operator investigation reads only masked records.${held ? ` Earlier, the ${held.title.toLowerCase()} hand-off was held at ${gateMeta(m, held.call.blocked_at).question} (${gateMeta(m, held.call.blocked_at).term}) and only the reference and amount were sent.` : ''}`;
    } else if (held) {
      tone = 'bad'; ic = 'lock';
      const k = held.call.concerns.find((x) => x.status === 'blocked') || held.call.concerns[0];
      const g = held.call.blocked_at && gateMeta(m, held.call.blocked_at);
      head = `${held.title} was held at ${g ? `${g.n} ${g.question} (${g.term})` : 'a gate'}`;
      body = k ? `${k.detail} ${k.handling || ''}`.trim() : held.call.summary;
    } else if (finished) {
      head = 'Completed. Every hand-off passed DataDNA';
      body = `${reviewed.length} of 5 hand-offs were reviewed${ctl ? `; ${ctl} sent with masked numbers or limited fields` : ''}. Nothing beyond what each step needs left the add-money service.`;
    } else if (active) {
      tone = 'info'; ic = 'ring';
      head = `In progress: ${active.title}`;
      body = `${reviewed.length} of 5 hand-offs reviewed so far. Each hand-off is checked against the five questions before it leaves, and this view updates as the payment moves.`;
    } else {
      tone = 'info'; ic = 'clock';
      head = 'Waiting for the payment to move';
      body = 'Each hand-off of the add-money payment is reviewed here as it happens.';
    }
    const tones = { done: 'ok', uncertain: 'warn', held: 'bad', stalled: 'bad', active: 'wait', waiting: 'idle' };
    const icons = { done: 'check', uncertain: 'warning', held: 'lock', stalled: 'x', active: 'ring', waiting: 'clock' };
    if (!this.hopSel || !hops.some((x) => x.id === this.hopSel)) this.hopSel = (stalled || held || active || reviewed[reviewed.length - 1] || hops[0]).id;
    const sel = hops.find((x) => x.id === this.hopSel);
    const item = (x, i) => h('button', { class: `dna-call dna-call--${tones[x.st]}${x.id === this.hopSel ? ' is-sel' : ''}`, type: 'button', onclick: () => { this.hopSel = x.id; if (x.call) this.sel = x.call.id; this.paint(); } },
      h('span', { class: 'dna-call-ic' }, icon(icons[x.st], 13)),
      h('span', { class: 'dna-call-main' },
        h('strong', null, `${i + 1}. ${x.title}`),
        h('small', null, hopSub(m, x))),
      h('span', { class: 'dna-call-time' }, x.call ? simClock(x.call.sim_ms || 0) : ''));
    let detail;
    if (sel.call) detail = this.callDetail(sel.call);
    else if (sel.st === 'stalled') {
      detail = h('div', { class: 'dna-empty' },
        h('span', { class: 'dna-mark dna-mark--lg dna-mark--bad' }, icon('x', 30)),
        h('h3', null, 'No acknowledgement came back'),
        h('p', null, 'There is nothing to review at this hand-off because no data has come back from the wallet partner. The run is waiting on it, which is where the payment stopped.'),
        h('p', null, 'What DataDNA protected meanwhile: the customer was never told the credit was done, and no one has been given a wallet number or account number to chase it. Investigators read masked records through the same five gates.'));
    } else {
      detail = h('div', { class: 'dna-empty' },
        h('span', { class: 'dna-mark dna-mark--lg' }, helix(30)),
        h('h3', null, sel.st === 'active' ? `${sel.title} is next` : `${sel.title} has not been reached`),
        h('p', null, sel.st === 'active' ? 'DataDNA is about to review this hand-off. It will be listed here with its five answers as soon as it is reviewed.' : 'This hand-off comes after the one the payment is waiting on. It will be reviewed when the payment gets here.'));
    }
    return h('div', { class: 'dna-body-pane dna-journeypane' },
      h('section', { class: `dna-where dna-where--${tone}` },
        h('span', { class: 'dna-where-ic' }, icon(ic, 18)),
        h('div', null, h('strong', null, head), h('p', null, body))),
      h('div', { class: 'dna-split dna-split--journey' },
        h('aside', { class: 'dna-rail' },
          h('div', { class: 'dna-rail-head' }, 'One add-money payment, five hand-offs'),
          h('div', { class: 'dna-calls' }, hops.map(item))),
        h('section', { class: 'dna-detail', 'aria-live': 'polite' }, detail)));
  }

  empty() {
    const gates = dnaGates(this.model);
    return h('div', { class: 'dna-empty' },
      h('span', { class: 'dna-mark dna-mark--lg' }, helix(30)),
      h('h3', null, 'No data has moved yet'),
      h('p', null, 'Every hand-off of the add-money payment and every read the AI makes passes these five questions first, and each is listed here with its answers.'),
      h('ol', { class: 'dna-five' }, gates.map((g) => h('li', null, h('b', null, `${g.n}. ${g.question} ${g.term || ''}`.trim()), h('span', null, g.asks)))));
  }

  callDetail(c) {
    const m = this.model;
    const dd = DECISION[c.decision];
    const g = c.blocked_at ? gateMeta(m, c.blocked_at) : null;
    const trigger = c.trigger ? m.observations[c.trigger] : null;
    const answerExtra = (id) => {
      const a = c.dna[id] || {};
      const rows = [];
      if (id === 'why') { if (a.basis) rows.push(['Lawful basis', a.basis]); if (a.necessity) rows.push(['Necessity', String(a.necessity).replace(/_/g, ' ')]); }
      if (id === 'who') {
        if (c.kind === 'flow') { rows.push(['From', a.requester]); rows.push(['To', a.recipient]); rows.push(['Acting for', a.on_behalf_of]); rows.push(['Customer', a.subject]); }
        else { rows.push(['On behalf of', `${a.on_behalf_of} (${a.role})`]); rows.push(['Case owner', a.owner]); rows.push(['About', a.subject]); }
      }
      if (id === 'where') { rows.push(['System', a.system]); rows.push(['Scope', a.scope]); rows.push(['Leaves our systems', a.cross_org ? (c.kind === 'flow' ? 'Yes, listed fields only' : 'Yes, reference only') : 'No']); }
      if (id === 'how') { rows.push(['Method', a.method]); rows.push(['Fields', `${a.released || 0} released · ${a.masked || 0} masked · ${a.withheld || 0} withheld`]); }
      if (id === 'until') { if (a.expires_at) rows.push(['Expires', new Date(a.expires_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })]); if (a.class_) rows.push(['Class', a.class_]); }
      return rows.length ? h('dl', { class: 'dna-kv' }, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])) : null;
    };
    const ladder = h('ol', { class: 'dna-ladder' }, c.gates.map((gate) => {
      const st = GATE_STATUS[gate.status];
      const meta = gateMeta(m, gate.id);
      const first = gate.id === c.blocked_at;
      return h('li', { class: `dna-rung dna-rung--${st.tone}${first ? ' is-first' : ''}` },
        h('span', { class: 'dna-rung-node' }, h('b', null, gate.n)),
        h('div', { class: 'dna-rung-body' },
          h('header', null,
            h('div', null, h('span', { class: 'dna-rung-q' }, gate.question), h('span', { class: 'dna-rung-term' }, meta.term || ''), h('span', { class: 'dna-rung-title' }, meta.title)),
            tonePill(st.tone, first ? 'Blocked here first' : st.label, st.icon)),
          h('p', { class: 'dna-rung-answer' }, (c.dna[gate.id] && c.dna[gate.id].answer) || ''),
          answerExtra(gate.id),
          h('details', { class: 'dna-checks' },
            h('summary', null, `${gate.checks.length} check${gate.checks.length === 1 ? '' : 's'} at this gate`),
            h('ul', null, gate.checks.map((k) => h('li', { class: `dna-check dna-check--${k.status}` },
              h('span', { class: 'dna-check-ic' }, icon(k.status === 'ok' ? 'check' : k.status === 'control' ? 'shield' : 'x', 12)),
              h('div', null, h('strong', null, k.label), h('p', null, k.note))))))));
    }));
    const fields = c.fields && c.fields.length ? h('div', { class: 'dna-fields' },
      h('h4', null, 'Field-level decision'),
      h('table', null,
        h('thead', null, h('tr', null, ['Field', 'Class', 'Decision', 'Why'].map((x) => h('th', null, x)))),
        h('tbody', null, c.fields.map((f) => h('tr', { class: `is-${f.action}` },
          h('td', null, h('code', null, f.name)), h('td', null, f.cls), h('td', null, h('span', { class: `dna-fa dna-fa--${f.action}` }, FIELD_ACTION[f.action] || f.action)), h('td', null, f.note || '')))))) : null;
    const concerns = c.concerns.length ? h('div', { class: 'dna-concerns' },
      h('h4', null, `${c.concerns.length} concern${c.concerns.length === 1 ? '' : 's'} flagged on this call`),
      [...c.concerns].sort((a, b) => (a.status === 'blocked' ? 0 : 1) - (b.status === 'blocked' ? 0 : 1)).map((k) => concernCard(m, k, c))) : h('p', { class: 'dna-clean' }, icon('check', 14), 'No concerns flagged on this call.');
    return h('div', { class: 'dna-callview' },
      h('header', { class: `dna-callhead dna-callhead--${dd.tone}` },
        h('div', null,
          h('div', { class: 'dna-callkind' }, KIND[c.kind] || c.kind, c.kind === 'flow' ? ` ${c.hop_n} of 5` : '', ' · ', h('code', null, c.id)),
          h('h3', null, c.label),
          h('p', null, c.summary)),
        h('div', { class: 'dna-callverdict' }, decisionPill(c), h('small', null, OUTCOME[c.outcome] || ''))),
      c.ask ? h('blockquote', { class: 'dna-ask' }, h('span', null, 'The AI asked for'), c.ask) : null,
      c.kind === 'ai_request' && trigger ? h('p', { class: 'dna-trigger' }, icon('link', 13), `Raised after: ${trigger.summary}`) : null,
      c.note ? h('p', { class: 'dna-note' }, c.note) : null,
      h('div', { class: 'dna-ladder-wrap' }, h('h4', null, 'The five answers'), ladder),
      fields, concerns,
      h('p', { class: 'dna-meta' }, `Envelope ${c.envelope_id || 'none'} · ${c.purpose || 'no purpose'} · reviewed ${hms(c.at)}${c.observation_id ? ` · cited as ${c.observation_id}` : ''}`));
  }

  concernsView() {
    const m = this.model;
    const items = [];
    for (const c of m.dna.calls) for (const k of c.concerns) items.push({ k, c });
    if (!items.length) return h('div', { class: 'dna-body-pane dna-scroll' }, this.empty());
    const group = (status, title, sub) => {
      const list = items.filter((x) => x.k.status === status);
      if (!list.length) return null;
      return h('section', { class: 'dna-group' },
        h('header', null, h('h3', null, title), h('span', { class: 'dna-tab-n' }, list.length), h('p', null, sub)),
        h('div', { class: 'dna-grid' }, list.map(({ k, c }) => concernCard(m, k, c, { showCall: true, onOpenCall: (id) => { this.sel = id; this.tab = 'calls'; this.filter = 'all'; this.paint(); } }))));
    };
    return h('div', { class: 'dna-body-pane dna-scroll' },
      group('blocked', 'Blocked', 'Access that was refused or limited. Nothing protected was fetched or released.'),
      group('mitigated', 'Mitigated', 'Access that was released only after a control reduced what leaves.'));
  }

  planView() {
    const m = this.model;
    const d = m.dna;
    const env = d.envelopes.filter((e) => e.kind !== 'export');
    return h('div', { class: 'dna-body-pane dna-scroll' },
      h('div', { class: 'dna-plancols' },
        h('section', null, h('h3', null, 'Compliant plan'), planList(d.plan, m)),
        h('section', null,
          h('h3', null, 'Access envelopes'),
          env.length ? env.map((e) => h('article', { class: 'dna-env' },
            h('header', null, h('code', null, e.id), h('span', { class: 'dna-tag' }, e.kind === 'verification' ? 'Verification read' : 'Investigation')),
            h('dl', { class: 'dna-kv' },
              h('dt', null, 'Purpose'), h('dd', null, e.purpose), h('dt', null, 'Lawful basis'), h('dd', null, e.basis_label || e.basis),
              h('dt', null, 'Scope'), h('dd', null, e.scope), h('dt', null, 'Opened for'), h('dd', null, e.actor_label),
              h('dt', null, 'Allowed reads'), h('dd', null, `${(e.tools || []).length} read-only tools`), h('dt', null, 'Kept for'), h('dd', null, `${e.retention_days} days after the case closes`)))) : h('p', { class: 'dna-empty-line' }, 'No envelope has been opened.'),
          h('p', { class: 'dna-fine' }, 'Legal clause mapping is written in plain language and needs review by counsel. Retention periods are fixture settings; the deletion job is recorded here, not executed.'))));
  }
}

// -------------------------------------------------------------------------------------------------------- report page
/** The "Data protection" section of the case report. `dp` is the report's data_protection object. */
export function reportDataProtection(dp, cfg) {
  const principle = (code) => {
    const p = cfg && cfg.principles && cfg.principles[code];
    return p ? p.title : String(code || '').replace(/_/g, ' ');
  };
  const gateName = (id) => ['Why?', 'Who?', 'Where?', 'How?', 'Until when?'][GATE_ORDER.indexOf(id)] || id;
  const t = dp.tally || {};
  const calls = dp.calls || [];
  return h('div', { class: 'dna-report' },
    h('p', { class: 'dna-report-sum' }, helix(14), ` ${t.total || 0} data calls reviewed: ${t.passed || 0} cleared, ${t.controlled || 0} controlled, ${t.blocked || 0} blocked.`),
    calls.map((c) => {
      const dd = DECISION[c.decision];
      return h('article', { class: `dna-rcall dna-rcall--${dd.tone}` },
        h('header', null, h('strong', null, c.label), decisionPill(c), h('code', null, c.id)),
        h('p', null, c.summary),
        h('dl', { class: 'dna-kv dna-kv--wide' }, GATE_ORDER.map((g) => [h('dt', null, gateName(g)), h('dd', null, c.dna[g] || '')])),
        c.concerns.map((k) => h('div', { class: `dna-rconcern dna-rconcern--${k.status === 'blocked' ? 'bad' : 'warn'}` },
          h('strong', null, `${k.status === 'blocked' ? 'Blocked' : 'Mitigated'}: ${k.title}`), ' ', h('span', { class: 'dna-tag' }, principle(k.principle)),
          k.handling ? h('p', null, h('em', null, 'Handled: '), k.handling) : null,
          k.alternative ? h('p', null, h('em', null, 'Compliant alternative: '), k.alternative) : null)));
    }),
    dp.plan && dp.plan.length ? h('div', { class: 'dna-rplan' }, h('h4', null, 'Compliance plan'), h('ul', null, dp.plan.map((s) => h('li', null, h('b', null, `[${s.status}] ${s.step}`), ` (${s.owner}): ${s.detail}`)))) : null,
    h('p', { class: 'dna-fine' }, dp.disclosure || ''));
}
