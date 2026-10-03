// MFS: the front door to the stalled add-money investigation. One page that lays out the whole sequence, tracks where
// the current run is in it, and opens the customer and operations views in their own tabs. Each tab creates its own
// scoped session, so the customer and operations pages never overwrite one another.
import { get, post, ApiError } from './api.js';
import { h, clear, fill, link, taka, simClock, toast } from './util.js';
import { icon } from './icons.js';

const DISCLOSURE = 'Simulated partners and fictional BDT. No real accounts, transfers or provider credentials are involved.';

const STEPS = [
  { id: 'scenario', icon: 'layers', title: 'Choose the fault', text: 'Pick what the partners will get wrong. The investigation does not know the answer in advance.' },
  { id: 'customer', icon: 'phone', title: 'Customer adds money', text: 'The customer reviews the amount and masked bank, then confirms once. A repeat tap cannot send a second request.' },
  { id: 'stall', icon: 'clock', title: 'The credit is not confirmed', text: 'The bank has approved, the wallet has not confirmed. The customer is told so plainly and an incident opens.' },
  { id: 'investigate', icon: 'search', title: 'Staff investigate', text: 'Read-only checks light up the trace graph. A hypothesis changes only when a returned record supports it.' },
  { id: 'decide', icon: 'doc', title: 'Decide and report', text: 'Approve a correction or hand off with an owned next step, then export the cited report.' },
];

// Which step the run is on, from the latest payment's phase.
function position(run) {
  if (!run) return { cur: 0, note: 'No run yet' };
  const p = run.payments[run.payments.length - 1];
  if (!p) return { cur: 1, note: 'Waiting for the customer' };
  switch (p.phase) {
    case 'submitted': return { cur: 2, note: p.status === 'UNCERTAIN' ? 'Not confirmed yet' : 'Processing' };
    case 'incident': return { cur: 3, note: 'Incident open, ready to investigate' };
    case 'investigating': return { cur: 3, note: 'Investigation running' };
    case 'decision': return { cur: 4, note: 'Ready to decide' };
    case 'handoff': return { cur: 5, note: 'Owned handoff saved. Payment remains unconfirmed.' };
    default: return { cur: 5, note: 'Resolved. Start a new run to go again' };
  }
}

export async function mount(app) {
  document.title = 'MFS · Stalled add-money · TraceFix';
  const scenarios = await get('/scenarios');
  let runs = await get('/runs');
  const S = { scenario: 'worker_fault', run: null };
  const pick = () => runs.find((r) => r.status === 'active') || null;
  S.run = pick();
  if (S.run) S.scenario = S.run.scenario;

  const open = (url) => window.open(url, '_blank', 'noopener');
  const runQ = () => '?run=' + encodeURIComponent(S.run.id);
  const latest = () => (S.run && S.run.payments.length ? S.run.payments[S.run.payments.length - 1] : null);

  const scenarioList = h('div', { class: 'scn-list', role: 'radiogroup', 'aria-label': 'Scenario' });
  const runPanel = h('section', { class: 'run-panel', 'aria-label': 'Current run' });
  const startBtn = h('button', { class: 'btn btn--primary', type: 'button' });
  const heroBtn = h('button', { class: 'btn btn--primary btn--lg', type: 'button' });
  const seq = h('ol', { class: 'seq', 'aria-label': 'Walkthrough steps' });
  const seqNote = h('p', { class: 'seq-note', role: 'status' });

  app.append(h('div', { class: 'mfs' },
    h('header', { class: 'demo-top mfs-top' },
      link('/mfs', { class: 'brand', 'aria-label': 'MFS home' }, h('span', { class: 'brand-mark' }, icon('pulse', 17)), h('span', { class: 'brand-name' }, h('strong', { text: 'MFS' }), h('small', { text: 'TraceFix · Stalled add-money' }))),
      h('nav', { class: 'mfs-nav', 'aria-label': 'Pages' },
        h('a', { href: '#sequence', text: 'Walkthrough' }),
        h('a', { href: '#run', text: 'Run controls' }),
        h('a', { href: '/', class: 'mfs-out' }, 'TraceFix site', icon('arrowRight', 14)))),
    h('main', { class: 'mfs-main', id: 'main' },
      h('section', { class: 'mfs-hero' },
        h('p', { class: 'mfs-eyebrow', text: 'Mobile financial services' }),
        h('h1', { text: 'A wallet top-up stalls. Follow it from the customer to the evidence.' }),
        h('p', { class: 'mfs-lead', text: 'The bank approved the money and the wallet never confirmed. This page runs the whole case: what the customer sees, how staff trace the fault on a live graph, and the cited report that closes it.' }),
        h('div', { class: 'mfs-cta' }, heroBtn, h('a', { class: 'btn btn--secondary btn--lg', href: '#sequence' }, 'See the five steps'))),
      h('section', { class: 'mfs-seq', id: 'sequence', 'aria-labelledby': 'seq-h' },
        h('div', { class: 'mfs-seq-head' }, h('h2', { id: 'seq-h', text: 'The walkthrough' }), seqNote),
        seq),
      h('section', { class: 'demo-grid', id: 'run' },
        h('section', { class: 'demo-col', 'aria-labelledby': 'scn-h' }, h('h2', { id: 'scn-h', text: 'Fault to demonstrate' }), scenarioList,
          h('div', { class: 'demo-actions' }, startBtn,
            h('p', { class: 'muted small', text: 'Starting a run creates a new isolated identity. Earlier runs stay readable and no project records are changed.' }))),
        h('section', { class: 'demo-col', 'aria-labelledby': 'run-h' }, h('h2', { id: 'run-h', text: 'Current run' }), runPanel)),
      h('footer', { class: 'demo-foot' }, h('p', { class: 'muted small', text: DISCLOSURE })))));

  // ------------------------------------------------------------------------------------------------ sequence
  function stepAction(step, state) {
    const p = latest();
    const a = (label, ic, onclick, disabled) => h('button', { class: 'btn btn--sm ' + (state === 'now' ? 'btn--primary' : 'btn--secondary'), type: 'button', disabled, onclick }, icon(ic, 14), label);
    switch (step.id) {
      case 'scenario': return a(S.run ? 'Change fault' : 'Start run', 'layers', () => document.getElementById('run').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), false);
      case 'customer': return a('Open customer view', 'external', () => open('/customer/payment' + runQ()), !S.run);
      case 'stall': return a('Watch as the customer', 'external', () => open('/customer/payment/' + p.id + runQ()), !p);
      case 'investigate': return a('Open trace graph', 'external', () => open('/admin/cases/' + p.id + runQ()), !p);
      default: return a('Open the report', 'external', () => open('/admin/cases/' + p.id + '/report' + runQ()), !p || !p.case_id);
    }
  }

  function paintSeq() {
    const { cur, note } = position(S.run);
    setNote(note);
    fill(seq, ...STEPS.map((step, i) => {
      const state = i < cur ? 'done' : i === cur ? 'now' : 'next';
      return h('li', { class: 'seq-step is-' + state, 'aria-current': state === 'now' ? 'step' : null },
        h('span', { class: 'seq-dot' }, state === 'done' ? icon('check', 15) : h('span', { class: 'seq-n', text: String(i + 1) })),
        h('div', { class: 'seq-body' },
          h('strong', { text: step.title }),
          h('p', { text: step.text }),
          stepAction(step, state)));
    }));
  }
  function setNote(note) {
    seqNote.textContent = S.run ? `${S.run.scenario_title} · ${note}` : 'Start a run to begin';
  }

  // ------------------------------------------------------------------------------------------------ scenarios & run
  function paintScenarios() {
    fill(scenarioList, ...scenarios.map((s) => h('label', { class: 'scn' + (S.scenario === s.id ? ' is-on' : '') },
      h('input', { type: 'radio', name: 'scn', value: s.id, checked: S.scenario === s.id, onchange: () => { S.scenario = s.id; paintScenarios(); paintStart(); } }),
      h('div', {}, h('strong', { text: s.title }), h('p', { text: s.premise }), h('small', { text: 'Expected: ' + s.outcome })))));
  }

  function paintStart() {
    const same = S.run && S.run.scenario === S.scenario;
    startBtn.replaceChildren(icon(S.run ? 'refresh' : 'play', 16), document.createTextNode(S.run ? (same ? ' Reset this run' : ' Start new run with this fault') : ' Start run'));
    const finished = S.run && position(S.run).cur >= STEPS.length;
    heroBtn.replaceChildren(icon(finished ? 'refresh' : S.run ? 'external' : 'play', 18), document.createTextNode(finished ? ' Start a new run' : S.run ? ' Open customer view' : ' Start the walkthrough'));
  }

  async function startRun() {
    startBtn.disabled = heroBtn.disabled = true;
    try {
      S.run = await post('/runs', { scenario: S.scenario, replaces: S.run ? S.run.id : undefined });
      runs = await get('/runs');
      S.run = runs.find((r) => r.id === S.run.id) || S.run;
      toast('Run started. Open the customer view to add money.', 'ok');
    } catch (e) {
      toast(e instanceof ApiError ? e.detail : 'Could not start a run.', 'bad');
    } finally {
      startBtn.disabled = heroBtn.disabled = false;
      paintStart();
      paintRun(true);
      paintSeq();
      if (S.run) document.getElementById('sequence').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }
  startBtn.addEventListener('click', startRun);
  heroBtn.addEventListener('click', () => (S.run && position(S.run).cur < STEPS.length ? open('/customer/payment' + runQ()) : startRun()));

  async function clock(action, speed) {
    try {
      await post(`/runs/${S.run.id}/clock`, { action, speed });
      await poll();
    } catch (e) {
      toast(e instanceof ApiError ? e.detail : 'Clock change failed.', 'bad');
    }
  }

  const nodes = {};

  function paintRun(rebuild) {
    const r = S.run;
    if (!r) {
      fill(runPanel, h('div', { class: 'run-empty' }, icon('play', 22), h('p', { text: 'No run yet. Start one to enable the controls.' })));
      nodes.built = false;
      return;
    }
    if (rebuild || !nodes.built) {
      nodes.built = true;
      nodes.clock = h('span', { class: 'mono clock-val' });
      nodes.state = h('span', { class: 'pill pill--sm' });
      nodes.pay = h('ul', { class: 'run-pay' });
      nodes.speed = h('div', { class: 'seg', role: 'group', 'aria-label': 'Presentation speed' }, [1, 2, 4].map((s) => h('button', { type: 'button', class: 'seg-btn', dataset: { s }, onclick: () => clock('speed', s) }, s + 'x')));
      nodes.pp = h('button', { class: 'btn btn--secondary btn--sm', type: 'button', onclick: () => clock(S.run.paused ? 'play' : 'pause') });
      nodes.admin = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('external', 16), 'Open operations view');
      nodes.admin.addEventListener('click', () => {
        const p = latest();
        open((p ? '/admin/cases/' + p.id : '/admin/queue') + runQ());
      });
      fill(runPanel,
        h('div', { class: 'run-head' }, h('div', {}, h('strong', { class: 'run-name', text: r.scenario_title }), h('small', { class: 'mono', text: r.id })), nodes.state),
        h('div', { class: 'run-open' },
          h('button', { class: 'btn btn--primary', type: 'button', onclick: () => open('/customer/payment' + runQ()) }, icon('external', 16), 'Open customer view'), nodes.admin),
        h('div', { class: 'run-clock' },
          h('div', {}, h('small', { class: 'lbl', text: 'Processing clock' }), nodes.clock),
          nodes.speed, nodes.pp),
        h('p', { class: 'muted small', text: 'The clock advances only while a payment is being processed. Pause freezes it, so no new processing step happens until you press play. Saved history stays readable, and replay in the operations view never re-runs an operation.' }),
        h('h3', { class: 'insp-h2', text: 'Payments in this run' }), nodes.pay);
    }
    nodes.clock.textContent = 'T+' + simClock(r.clock_ms) + (r.paused ? '  paused' : '');
    nodes.state.className = 'pill pill--sm pill--' + (r.status === 'active' ? (r.paused ? 'warn' : 'ok') : 'idle');
    nodes.state.textContent = r.status === 'active' ? (r.paused ? 'Paused' : 'Running') : 'Archived';
    nodes.speed.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('is-on', +b.dataset.s === r.speed));
    nodes.pp.replaceChildren(icon(r.paused ? 'play' : 'pause', 15), document.createTextNode(r.paused ? ' Play' : ' Pause'));
    const sig = JSON.stringify(r.payments);
    if (nodes.paySig !== sig) {
      nodes.paySig = sig;
      fill(nodes.pay, ...(r.payments.length ? r.payments.map((p) => h('li', {}, h('span', { class: 'mono', text: p.reference || p.id.slice(0, 12) }), h('strong', { text: taka(p.amount_minor) }),
        h('span', { class: 'pill pill--sm pill--' + ({ COMPLETED: 'ok', UNCERTAIN: 'warn' }[p.status] || 'wait'), text: { COMPLETED: 'Completed', UNCERTAIN: 'Not confirmed', IN_PROGRESS: 'Processing' }[p.status] || p.status }),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => open('/admin/cases/' + p.id + runQ()) }, 'Open in operations')))
        : [h('li', { class: 'muted', text: 'None yet. Submit one from the customer view.' })]));
    }
  }

  async function poll() {
    try {
      runs = await get('/runs');
      const cur = S.run ? runs.find((r) => r.id === S.run.id) : pick();
      S.run = cur || S.run;
      paintRun(false);
      const sig = JSON.stringify([S.run && S.run.payments.map((p) => p.phase + p.status), !!S.run]);
      if (sig !== nodes.seqSig) {
        nodes.seqSig = sig;
        paintSeq();
        paintStart();
      }
    } catch { /* keep the last values */ }
  }

  paintScenarios();
  paintStart();
  paintRun(true);
  paintSeq();
  const timer = setInterval(poll, 1000);
  return () => clearInterval(timer);
}
