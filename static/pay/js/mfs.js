// Add-money front door. The guide resumes saved server progress; it never advances or approves a payment.
import { get, post, startSession, ApiError } from './api.js';
import { h, fill, link, navigate, taka, simClock, toast } from './util.js';
import { icon } from './icons.js';
import { withRun, journey, siteHeader, flowStrip, investigationPreview, rememberPayment, rememberRun } from './guide.js';

const DISCLOSURE = 'Synthetic demo · Fictional BDT and partner records. No real transfers.';
const SCENARIOS = {
  worker_fault: ['Wallet processing stops', 'The bank approves, but the wallet worker stops before crediting.'],
  lost_ack: ['Confirmation goes missing', 'The money arrives, but the confirmation never reaches the customer.'],
  mapping_ambiguity: ['The records do not match', 'An unclear reference and unavailable source require an owned follow-up.'],
  late_completion: ['The original transfer is delayed', 'Processing takes longer; the original request can still complete.'],
};

export async function mount(app, path, requestedRun) {
  document.title = 'Add money · DataUkil';
  const [scenarios, initialRuns] = await Promise.all([get('/scenarios'), get('/runs')]);
  if (!app.isConnected) return () => {};
  let runs = initialRuns;
  // Only an explicit bookmark or this tab's chosen walkthrough can resume a run.
  // A backend default (even one used in another tab) is not a scenario selection.
  let remembered = null;
  try { remembered = sessionStorage.getItem('tf.pay.walkthrough'); } catch { /* optional persistence */ }
  const chosen = runs.find(r => r.id === (requestedRun || remembered));
  runs.forEach(rememberRun);
  const S = { run: chosen || null, scenario: chosen?.scenario || null, busy: false, stopped: false };
  if (requestedRun && !chosen) {
    app.append(h('div', { class: 'mfs' }, siteHeader(), h('main', { class: 'am-recovery' },
      h('p', { class: 'am-kicker', text: 'Saved journey' }), h('h1', { text: 'This run is not in the recent list' }),
      h('p', { text: 'The overview lists the twelve most recent runs. Your payment bookmark can still open its saved record. Choose a recent journey or start a new one below.' }),
      link('/mfs', { class: 'btn btn--primary' }, 'View recent journeys'))));
    return () => {};
  }
  if (S.run) {
    history.replaceState({}, '', withRun('/mfs', S.run.id));
    try { sessionStorage.setItem('tf.pay.walkthrough', S.run.id); } catch { /* optional persistence */ }
  }
  const guideHost = h('div');
  const nextLink = link('#setup', { class: 'btn btn--primary btn--lg', id: 'continue-walkthrough' }, 'Choose a scenario', icon('arrowRight', 18));
  const nextNote = h('p', { class: 'am-next-note', role: 'status' });
  const scenarioList = h('div', { class: 'am-scenarios', role: 'radiogroup', 'aria-label': 'Scenario' });
  const startBtn = h('button', { class: 'btn btn--primary', type: 'button', id: 'start-walkthrough' });
  const selectionNote = h('p', { class: 'am-selection-note', role: 'status', text: 'Choose one scenario to enable Start walkthrough.' });
  const setup = h('details', { class: 'am-setup', id: 'setup', open: !S.run }, h('summary', {}, h('span', {}, h('small', { class: 'am-kicker', text: '01 / Start your walkthrough' }), h('strong', { text: 'What would you like to explore?' })), icon('chevronDown', 20)),
    h('div', { class: 'am-setup-body' }, h('p', { class: 'am-muted', text: 'Choose a story. You’ll add money, track the transfer, and investigate what happened. No technical knowledge needed.' }), scenarioList,
      h('div', { class: 'am-setup-action' }, h('div', {}, selectionNote, h('p', { class: 'am-muted small', text: 'Next: enter an amount and review it before confirming. All money is fictional.' })), startBtn)));
  const runPanel = h('section', { class: 'am-current', 'aria-label': 'Current journey' });
  const demoLink = link('/admin/queue', { class: 'btn btn--secondary am-demo-entry' }, icon('search', 18), 'Explore investigation demo', icon('arrowRight', 18));
  const demoNote = h('p', { class: 'am-demo-note' });
  const demoCard = link('/admin/queue', { class: 'am-demo-card', 'aria-label': 'Open investigation workspace' },
    h('div', { class: 'am-demo-top' }, h('span', { class: 'am-kicker', text: 'Inside the investigation' }), h('span', { class: 'mono', text: 'WORKSPACE PREVIEW' })),
    investigationPreview(), h('div', { class: 'am-demo-copy' }, h('h2', { text: 'Follow the evidence.' }),
      h('p', { text: 'See the bank, wallet, and source records come together on one investigation board.' }),
      h('span', { class: 'am-demo-action' }, 'Open investigation workspace', icon('arrowRight', 20)), demoNote));
  const recent = h('details', { class: 'am-recent' }, h('summary', { text: 'Recent journeys' }));
  app.append(h('div', { class: 'mfs' }, siteHeader(S.run?.id),
    h('main', { class: 'mfs-main', id: 'main' },
      h('section', { class: 'mfs-hero' }, h('div', { class: 'am-hero-copy' },
        h('p', { class: 'am-kicker', text: 'DataUkil / Bank-to-wallet walkthrough' }),
        h('h1', {}, 'Add money.', h('br'), h('span', { text: 'See the whole story.' })),
        h('p', { class: 'mfs-lead', text: 'A transfer is more than a button. Follow it from your bank to your wallet—and see how an investigator finds the next step when something goes wrong.' }),
        h('div', { class: 'mfs-cta' }, nextLink, demoLink), nextNote,
        h('p', { class: 'am-hero-disclosure', text: 'Interactive walkthrough · Fictional money · Progress saved' })), demoCard),
      guideHost,
      h('section', { class: 'am-workflow-grid' }, runPanel, setup), recent,
      h('footer', { class: 'am-footer' }, h('span', { text: 'DataUkil / Connected by evidence.' }), h('span', { text: DISCLOSURE })))));

  for (const s of scenarios) {
    const [title, premise] = SCENARIOS[s.id] || [s.title, s.premise];
    const [ic, tag] = { worker_fault: ['wallet', 'A good place to start'], lost_ack: ['message', 'Missing confirmation'], mapping_ambiguity: ['link', 'Unclear records'], late_completion: ['clock', 'Delayed processing'] }[s.id] || ['route', 'Explore this story'];
    const card = h('article', { class: 'am-scenario' + (S.scenario === s.id ? ' is-on' : '') });
    card.append(h('label', {}, h('input', { type: 'radio', name: 'scenario', value: s.id, checked: S.scenario === s.id,
      onchange: () => {
        S.scenario = s.id;
        setup.classList.add('has-selection');
        startBtn.disabled = S.busy;
        selectionNote.textContent = 'Selected: ' + title;
        scenarioList.querySelectorAll('.am-scenario').forEach(el => el.classList.toggle('is-on', el.querySelector('input').value === S.scenario));
      } }), h('div', { class: 'am-scenario-copy' }, h('div', { class: 'am-scenario-heading' }, h('span', { class: 'am-scenario-icon' }, icon(ic, 20)), h('span', { class: 'am-scenario-tag', text: tag })), h('strong', { text: title }), h('p', { text: premise }))),
      h('details', { class: 'am-scenario-detail' }, h('summary', { text: 'Presenter notes' }), h('p', { text: s.premise }), h('p', { text: s.outcome })));
    scenarioList.append(card);
  }

  async function start() {
    if (S.busy || !S.scenario) return;
    S.busy = true; startBtn.disabled = true; startBtn.textContent = 'Starting your journey…';
    try {
      S.run = await post('/runs', { scenario: S.scenario, ...(S.run ? { replaces: S.run.id } : {}) });
      if (chosen) rememberRun({ id: chosen.id, status: 'archived' });
      rememberRun(S.run);
      try { sessionStorage.setItem('tf.pay.walkthrough', S.run.id); } catch { /* optional persistence */ }
      await startSession('presenter', S.run.id);
      history.replaceState({}, '', withRun('/mfs', S.run.id));
      navigate(withRun('/customer/payment', S.run.id));
    } catch (e) {
      toast(e instanceof ApiError ? e.detail : 'Could not start this journey. Please try again.', 'bad');
      S.busy = false; painted = ''; paint();
    }
  }
  startBtn.addEventListener('click', start);
  nextLink.addEventListener('click', () => { if (nextLink.hash === '#setup') setup.open = true; });

  let painted = '';
  const clockValue = h('strong', { class: 'mono' });
  function paint() {
    const progress = journey(S.run);
    const signature = JSON.stringify([S.run?.id, S.run?.status, S.run?.paused, S.run?.speed, S.run?.payments, runs.map(r => [r.id, r.status, r.payments.at(-1)?.id])]);
    clockValue.textContent = 'T+' + simClock(S.run?.clock_ms || 0);
    if (signature === painted) return;
    painted = signature;
    fill(guideHost, flowStrip(progress.step, { run: S.run?.id, payment: S.run?.payments.at(-1)?.id, caseId: S.run?.payments.at(-1)?.case_id }));
    nextLink.href = progress.href;
    fill(nextLink, progress.label, icon('arrowRight', 18));
    nextNote.textContent = progress.note;
    startBtn.disabled = S.busy || !S.scenario;
    startBtn.textContent = S.run ? 'Start a new journey' : 'Start walkthrough';
    runPanel.hidden = !S.run;
    setup.classList.toggle('has-selection', Boolean(S.scenario));
    if (S.scenario) selectionNote.textContent = 'Selected: ' + (SCENARIOS[S.scenario]?.[0] || S.scenario);
    const demoRun = S.run || runs.find(r => r.payments.length && r.status === 'active') || runs.find(r => r.payments.length);
    const demoPayment = demoRun?.payments.at(-1);
    const demoUrl = withRun(demoPayment ? '/admin/cases/' + demoPayment.id : '/admin/queue', demoRun?.id || S.run?.id);
    demoLink.href = demoUrl;
    demoCard.href = demoUrl;
    demoNote.textContent = demoPayment ? 'Opens a saved investigation in this tab.' : 'Start a scenario to bring your own transfer into the workspace.';
    const r = S.run, p = r?.payments.at(-1);
    if (!r) {
      fill(runPanel, h('span', { class: 'am-kicker', text: 'Your journey starts here' }), h('div', { class: 'am-current-icon' }, icon('route', 32)),
        h('h2', { text: 'One request. A complete picture.' }), h('p', { class: 'am-muted', text: 'Choose a scenario, add money, then follow the saved status. If a case opens, the investigation connects the evidence to an accountable next action.' }),
        h('ul', { class: 'am-benefits' }, ['Review before you confirm', 'Resume the same saved payment', 'See what is known and what comes next'].map(text => h('li', {}, icon('check', 16), text))));
    } else {
      r.payments.forEach(p => rememberPayment(p.id, r.id));
      const archived = r.status !== 'active';
      const controls = h('details', { class: 'am-clock-controls' }, h('summary', { text: 'Presentation controls' }),
        h('div', { class: 'am-clock-row' }, clockValue, h('span', { class: 'seg', role: 'group', 'aria-label': 'Processing speed' }, [1, 2, 4].map(speed => h('button', {
          type: 'button', class: 'seg-btn' + (r.speed === speed ? ' is-on' : ''), disabled: archived, 'aria-pressed': String(r.speed === speed), onclick: () => clock('speed', speed) }, speed + '×'))),
          h('button', { class: 'btn btn--secondary btn--sm', type: 'button', disabled: archived, onclick: () => clock(r.paused ? 'play' : 'pause') }, icon(r.paused ? 'play' : 'pause', 14), r.paused ? 'Play' : 'Pause')),
        h('p', { class: 'am-muted small', text: 'The saved processing clock runs while work is pending. Pause freezes processing; replay only reads saved history.' }));
      fill(runPanel, h('div', { class: 'am-current-top' }, h('span', { class: 'am-kicker', text: 'Current journey' }), h('span', { class: 'pill pill--' + (archived ? 'idle' : r.paused ? 'warn' : 'ok'), text: archived ? 'Archived · read only' : r.paused ? 'Paused' : 'Active' })),
        h('h2', { text: SCENARIOS[r.scenario]?.[0] || r.scenario_title }), h('p', { class: 'am-muted', text: progress.note }),
        p ? h('div', { class: 'am-payment-summary' }, h('small', { class: 'mono', text: p.reference }), h('strong', { text: taka(p.amount_minor) }),
          h('span', { class: 'pill pill--' + (p.status === 'COMPLETED' ? 'ok' : p.status === 'UNCERTAIN' ? 'warn' : 'wait'), text: p.status === 'COMPLETED' ? 'Credit confirmed' : p.status === 'UNCERTAIN' ? 'Not confirmed yet' : 'Processing' }),
          link(withRun('/customer/payment/' + p.id, r.id), { class: 'btn btn--secondary am-status-entry' }, 'View customer status', icon('arrowRight', 18))) : h('p', { class: 'am-muted', text: archived ? 'This run has no payment. Start a new journey to add money.' : 'No payment submitted yet.' }),
        archived ? h('p', { class: 'am-archive-note', text: 'Saved records remain readable. Start a new journey to create a payment or change the clock.' }) : null,
        link(archived && !p ? '#setup' : progress.href, { class: 'btn btn--primary am-resume-entry', onclick: () => { if (archived && !p) setup.open = true; } }, archived && !p ? 'Choose a new scenario' : progress.label, icon('arrowRight', 18)),
        link(withRun(p ? '/admin/cases/' + p.id : '/admin/queue', r.id), { class: 'am-companion btn btn--secondary', target: '_blank', rel: 'noopener' }, icon('external', 18), 'Open companion investigation view'), controls);
      if (archived && !p) { nextLink.href = '#setup'; fill(nextLink, 'Choose a new scenario', icon('arrowRight', 18)); }
    }
    fill(recent, h('summary', { text: 'Recent journeys' }), h('ul', {}, runs.filter(r => r.payments.length || r.id === requestedRun).map(r => h('li', {},
      link(withRun('/mfs', r.id), {}, h('span', {}, SCENARIOS[r.scenario]?.[0] || r.scenario_title, h('small', { class: 'mono', text: r.id })), h('span', { text: r.status === 'active' ? 'Resume →' : 'Read archived →' }))))));
  }
  async function clock(action, speed) {
    try { await post(`/runs/${S.run.id}/clock`, { action, speed }); await poll(); }
    catch (e) { toast(e instanceof ApiError ? e.detail : 'Clock change failed.', 'bad'); }
  }
  let polling = false;
  async function poll() {
    if (polling || S.stopped) return;
    polling = true;
    try {
      const fresh = await get('/runs');
      if (S.stopped) return;
      runs = fresh;
      runs.forEach(rememberRun);
      if (S.run) S.run = runs.find(r => r.id === S.run.id) || S.run;
      paint();
      nextNote.textContent = journey(S.run).note;
    } catch { nextNote.textContent = 'Could not refresh live progress. Your last saved state remains visible.'; }
    finally { polling = false; }
  }
  paint();
  const timer = setInterval(poll, 1500);
  return () => { S.stopped = true; clearInterval(timer); };
}
