// Pure reducer from saved journal events to everything the admin workspace draws.
//
// Nothing here invents an outcome: node states, hypotheses, checks and the log are all folded from events the backend
// saved. Replay simply runs this same reducer over a prefix of the saved history, so it can never re-run a financial
// operation.

export const STATE_LABEL = {
  unknown: 'Unknown', pending: 'Waiting', running: 'In progress', completed: 'Completed', failed: 'Failed', unavailable: 'Source unavailable',
};
export const HYP_LABEL = { unchecked: 'Unchecked', supported: 'Supported', ruled_out: 'Ruled out for this scope', unresolved: 'Unresolved' };
export const NODE_SHORT = {
  'bank-debit': 'Bank debit or hold', 'partner-ack': 'Partner acknowledgement', 'dead-letter': 'Dead-letter and errors',
  'ack-return': 'Acknowledgement to customer', 'return-path': 'Controlled return path', 'callback-delivery': 'Callback delivery',
};

export class TraceModel {
  constructor(topology, hypotheses = [], tools = {}) {
    this.topology = topology;
    this.tools = tools;
    this.nodes = {};
    for (const n of topology.nodes) {
      this.nodes[n.id] = {
        id: n.id, group: n.group, title: n.title, kind: n.kind, core: n.core,
        processing: 'unknown', headline: '', fact: '', amount: null, attempt: 1, recovered: false,
        inspected: false, inspecting: false, history: [], obs: [],
      };
    }
    this.hyps = hypotheses.map((h) => ({ id: h.id, title: h.title, status: 'unchecked', rationale: '', cites: [] }));
    this.checks = [];
    this.observations = {};
    this.log = [];
    this.revealed = new Set();
    this.seen = new Set();
    this.payment = { status: 'IN_PROGRESS' };
    this.case = null;
    this.investigation = null;
    this.proposed = null;
    this.blocked = null;
    this.handoff = null;
    this.report = null;
    this.data_dna_decisions = [];
    this.clock = { paused: false, speed: 1, clock_ms: 0 };
    this.simMs = 0;
    this.lastSeq = 0;
    this.rev = { nodes: 0, hyps: 0, log: 0, checks: 0, plan: 0, meta: 0, privacy: 0 };
  }

  apply(e) {
    if (this.seen.has(e.event_id)) return [];
    this.seen.add(e.event_id);
    this.lastSeq = Math.max(this.lastSeq, e.sequence);
    this.simMs = Math.max(this.simMs, e.sim_ms || 0);
    const p = e.payload || {};
    const fx = [];
    const note = (tag, text, tone = 'info', cites = []) => {
      this.log.push({ seq: e.sequence, at: e.occurred_at, sim_ms: e.sim_ms, tag, text, tone, cites, type: e.type });
      this.rev.log++;
    };
    switch (e.type) {
      case 'DATA_DNA_DECISION': {
        const d = p.decision;
        if (!d || this.data_dna_decisions.some(x => x.id === d.id)) break;
        this.data_dna_decisions.push(d);
        this.rev.privacy++;
        const label = { ALLOWED: 'Allowed', MINIMIZED: 'Minimized', BLOCKED: 'Blocked', NEEDS_REVIEW: 'Needs review' }[d.decision] || d.decision;
        note('DataDNA', `${label}: ${String(d.source).replaceAll('_', ' ')}. ${d.reason}${d.affects_case === false ? ' Boundary demonstration; incident evidence is unchanged.' : ''}`, d.decision === 'BLOCKED' ? 'bad' : d.decision === 'NEEDS_REVIEW' ? 'warn' : 'info');
        break;
      }
      case 'INTENT_CREATED':
        this.setNode(p.node_id, p, e);
        this.payment = { ...this.payment, reference: p.reference, amount_minor: p.amount_minor, bank_label: p.bank_label, wallet_label: p.wallet_label, created_at: e.occurred_at };
        note('Payment', `Add-money request ${p.reference} received.`, 'info');
        fx.push({ type: 'node', id: p.node_id });
        break;
      case 'STAGE_OBSERVED':
        this.setNode(p.node_id, p, e);
        if (p.node_id === 'partner-ack' && p.state === 'failed') {
          if (this.payment.status !== 'COMPLETED') this.payment.status = 'UNCERTAIN';
          note('Payment', 'The partner acknowledgement timed out. The wallet credit is not confirmed.', 'warn');
        }
        if (p.recovered) note('Correction', 'Attempt 2 recovered the credit worker step; attempt 1 stays in history.', 'good');
        fx.push({ type: 'node', id: p.node_id });
        break;
      case 'INCIDENT_OPENED':
        this.case = { ...(this.case || {}), reference: p.reference, owner: p.owner, status: 'OPEN', reason: p.reason };
        this.rev.meta++;
        note('Incident', `Incident ${p.reference} opened (${String(p.reason || '').replace('_', ' ')}). Owner: ${p.owner}.`, 'warn');
        break;
      case 'COMPLAINT_ATTACHED':
        note('Incident', 'The customer report was attached to the existing incident. No duplicate case was created.', 'info');
        break;
      case 'INVESTIGATION_STARTED':
        this.investigation = { id: p.investigation_id, status: 'running', budget: p.budget, used: 0, mode: p.mode, mode_label: p.mode_label };
        this.hyps.forEach((h) => Object.assign(h, { status: 'unchecked', rationale: '', cites: [] }));
        this.rev.hyps++;
        this.rev.meta++;
        note('Investigation', `Investigation started. ${p.budget} read-only checks authorised. ${p.mode_label}.`, 'probe');
        fx.push({ type: 'investigation', state: 'running' });
        break;
      case 'CHECK_REQUESTED': {
        const n = this.nodes[p.node_id];
        if (n) n.inspecting = true;
        this.revealed.add(p.node_id);
        if (this.investigation && p.origin === 'investigation') this.investigation.used += 1;
        this.checks.push({ id: p.check_id, tool: p.tool, label: p.label, node_id: p.node_id, rationale: p.rationale, hypotheses: p.hypotheses || [], cites: p.cites || [], origin: p.origin, status: 'running', requested_at: e.occurred_at, sim_ms: e.sim_ms });
        this.rev.checks++;
        this.rev.nodes++;
        note('Check', `${p.label} requested. ${p.rationale || ''}`.trim(), 'probe', p.cites || []);
        fx.push({ type: 'probe-start', node: p.node_id, check: p.check_id });
        break;
      }
      case 'CHECK_COMPLETED':
      case 'CHECK_UNAVAILABLE': {
        const o = p.observation;
        this.observations[o.id] = o;
        const check = this.checks.find((c) => c.id === p.check_id);
        if (check) Object.assign(check, { status: p.status, observation_id: o.id, completed_at: e.occurred_at });
        const target = this.nodes[e.node_id || (check && check.node_id)];
        if (target) {
          target.inspecting = false;
          target.inspected = true;
          if (!target.obs.includes(o.id)) target.obs.push(o.id);
        }
        for (const u of p.node_updates || []) {
          this.revealed.add(u.node_id);
          this.setNode(u.node_id, u, e, true);
          const n = this.nodes[u.node_id];
          if (n && !n.obs.includes(o.id)) n.obs.push(o.id);
          fx.push({ type: 'node', id: u.node_id });
        }
        this.rev.checks++;
        this.rev.nodes++;
        note('Check', `${p.label}: ${o.summary}`, p.status === 'unavailable' ? 'warn' : 'info', [o.id]);
        fx.push({ type: 'probe-done', node: e.node_id || (check && check.node_id), check: p.check_id, status: p.status });
        break;
      }
      case 'FINDING_RECORDED': {
        const h = this.hyps.find((x) => x.id === p.hypothesis_id);
        if (h) Object.assign(h, { status: p.status, rationale: p.rationale, cites: p.cites || [] });
        this.rev.hyps++;
        const tone = p.status === 'supported' ? 'good' : p.status === 'unresolved' ? 'warn' : 'info';
        note('Finding', `${p.title}: ${HYP_LABEL[p.status]}. ${p.rationale}`, tone, p.cites || []);
        fx.push({ type: 'hypothesis', id: p.hypothesis_id });
        break;
      }
      case 'INVESTIGATION_CONCLUDED':
        if (this.investigation) Object.assign(this.investigation, { status: 'concluded', outcome: p.outcome, summary: p.summary, used: p.checks_used });
        this.rev.meta++;
        note('Investigation', p.summary, p.outcome === 'proposal' ? 'good' : 'warn', p.cites || []);
        fx.push({ type: 'investigation', state: 'concluded' });
        break;
      case 'CORRECTION_PROPOSED':
        this.proposed = p;
        this.rev.plan++;
        note('Plan', `Proposed: ${p.label}. Waiting for staff approval.`, 'good', p.observation_ids || []);
        break;
      case 'CORRECTION_APPROVED':
        note('Plan', `${p.label} approved by ${p.approved_by === 'staff_2' ? 'Investigator 2' : 'Investigator 1'}.`, 'good');
        this.rev.plan++;
        break;
      case 'CORRECTION_COMPLETED':
        note('Correction', p.outcome && p.outcome.message ? p.outcome.message : 'Correction completed.', 'good');
        this.rev.plan++;
        break;
      case 'CORRECTION_BLOCKED':
        this.blocked = p;
        this.rev.plan++;
        note('Correction', `Automatic correction is blocked. ${p.summary || ''}`.trim(), 'bad');
        break;
      case 'HANDOFF_CREATED':
        this.handoff = p;
        this.rev.plan++;
        note('Handoff', `Handed to ${p.queue}. Next requirement: ${p.next_requirement}`, 'warn');
        break;
      case 'CASE_STATUS_CHANGED':
        this.case = { ...(this.case || {}), status: p.status, resolution: p.resolution, reference: p.reference || (this.case && this.case.reference) };
        this.rev.meta++;
        break;
      case 'PAYMENT_COMPLETED':
        this.payment.status = 'COMPLETED';
        this.rev.meta++;
        note('Payment', `Wallet credit confirmed (${p.how}).`, 'good');
        fx.push({ type: 'complete' });
        break;
      case 'REPORT_SAVED':
        this.report = { version: p.version, sha256: p.sha256 };
        this.rev.meta++;
        break;
      case 'CLOCK_CHANGED':
        this.clock = { paused: p.paused, speed: p.speed, clock_ms: p.clock_ms };
        this.rev.meta++;
        break;
      default:
        break;
    }
    return fx;
  }

  setNode(id, u, e, fromCheck = false) {
    const n = this.nodes[id];
    if (!n) return;
    if (u.state) n.processing = u.state;
    if (u.title !== undefined) n.headline = u.title;
    if (u.fact !== undefined) n.fact = u.fact;
    if (u.amount_minor != null) n.amount = u.amount_minor;
    if (u.attempt_no != null && !fromCheck) n.attempt = u.attempt_no;
    if (u.recovered) n.recovered = true;
    n.history.push({
      seq: e.sequence, at: e.occurred_at, state: n.processing, headline: n.headline, fact: n.fact, attempt: u.attempt_no ?? n.attempt,
      source: fromCheck ? 'check' : 'processing',
    });
    this.rev.nodes++;
  }
}

export function buildModel(snapshot, events = snapshot.events, upto = events.length) {
  const m = new TraceModel(snapshot.topology, snapshot.hypotheses, snapshot.tools);
  for (let i = 0; i < upto; i++) m.apply(events[i]);
  return m;
}
