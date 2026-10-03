// Admin surface: incident queue, observed-transaction-trace canvas, evidence inspector, investigation log, replay,
// plan approval and the operator report. Statuses come only from saved backend events and the authoritative snapshot.
import { get, post, download, LiveStream, sessionInfo, staffRunState, ApiError } from './api.js';
import { h, clear, fill, link, navigate, taka, hms, dayTime, simClock, uuid, toast, debounce, reducedMotion } from './util.js';
import { icon, STATE_ICON } from './icons.js';
import { Graph } from './graph.js';
import { buildModel, STATE_LABEL, HYP_LABEL } from './model.js';
import { withRun, rememberPayment, rememberRun, knownRun, siteHeader, flowStrip } from './guide.js';

const KIND_LABEL = { ledger: 'Authoritative posting source', process: 'Processing stage', branch: 'Related service or check' };
const PLAN_STATUS = { proposed: 'Awaiting approval', executing: 'Executing', completed: 'Completed', refused: 'Refused', superseded: 'Superseded by new evidence' };

async function requireActiveRun(id) {
  const status = await staffRunState(id);
  rememberRun({ id, status });
  if (status !== 'active') throw new ApiError(409, 'This journey is archived or unavailable in the recent list. Its saved records remain readable. Return to the Add money walkthrough before taking an action.');
}

function brand() {
  return link(withRun('/admin/queue', new URLSearchParams(location.search).get('run')), { class: 'brand', 'aria-label': 'Payment investigations' },
    h('span', { class: 'brand-mark' }, icon('pulse', 17)), h('span', { class: 'brand-name' }, h('strong', { text: 'DataUkil' }), h('small', { text: 'Payment investigations' })));
}

function queueLabel(it) {
  if (it.resolution === 'credit_confirmed' || it.payment_status === 'COMPLETED') return ['ok', 'Resolved'];
  if (it.resolution === 'handoff') return ['bad', 'Handoff'];
  if (it.case_status === 'WAITING_EVIDENCE') return ['warn', 'Follow-up'];
  if (it.incident) return ['warn', 'Incident'];
  if (it.payment_status === 'UNCERTAIN') return ['warn', 'Unconfirmed'];
  return ['wait', 'Processing'];
}

export async function mount(app, path) {
  const parts = path.split('/').filter(Boolean); // admin / queue | cases / :id / report
  document.title = 'Payment investigations · DataUkil';
  if (parts[1] === 'cases' && parts[2] && parts[3] === 'report') return mountReport(app, parts[2]);
  return mountWorkspace(app, parts[1] === 'cases' ? parts[2] : null);
}

// =====================================================================================================================
async function mountWorkspace(app, ident) {
  const S = {
    ident, snap: null, model: null, events: [], evSeen: new Set(), replay: null, selected: null, tab: 'evidence',
    auth: null, queue: { items: [], cursor: 0 }, conn: 'live', painted: {}, approveKeys: {}, busy: false, logOpen: true,
  };
  const info = sessionInfo();

  // ------------------------------------------------------------------------------------------------ skeleton
  const top = h('header', { class: 'ws-top' });
  const queueEl = h('aside', { class: 'ws-queue', 'aria-label': 'Incident queue' });
  const stage = h('section', { class: 'ws-stage' });
  const graphRoot = h('div', { class: 'graph-host' });
  const inspector = h('aside', { class: 'ws-inspect', 'aria-label': 'Evidence inspector' });
  const logEl = h('section', { class: 'ws-log', 'aria-label': 'Investigation log' });
  const replayBar = h('div', { class: 'replay-bar', hidden: true });
  const empty = h('div', { class: 'ws-empty' });
  stage.append(graphRoot, replayBar, empty);
  const ws = h('div', { class: 'ws' }, top, queueEl, stage, inspector, logEl);
  app.append(ws);
  // Keep the payment queue visible on ordinary desktop screens; collapse it only when the
  // graph needs the full canvas at compact laptop widths. Narrow layouts use the Queue drawer.
  document.body.classList.toggle('queue-collapsed', window.innerWidth < 1360);

  const graph = new Graph(graphRoot, {
    onSelect: (id) => {
      S.selected = id;
      if (id) { S.tab = 'evidence'; showMobilePane('details'); }
      paint(true);
      if (id && narrow.matches) requestAnimationFrame(() => inspector.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true }));
    },
    onFollowChange: () => paintToolbar(),
  });
  const toolbar = h('div', { class: 'graph-toolbar', role: 'toolbar', 'aria-label': 'Canvas controls' });
  const legend = legendEl();
  graphRoot.append(toolbar, legend);

  const narrow = matchMedia('(max-width: 1040px)');
  ws.dataset.mobilePane = 'board';
  const mobileNav = h('nav', { class: 'am-mobile-nav', 'aria-label': 'Investigation panels' });
  const queueDialog = h('dialog', { class: 'am-queue-dialog', 'aria-label': 'Payment queue' });
  const queueHome = h('div', { class: 'am-queue-home', hidden: true });
  queueEl.before(queueHome);
  app.append(queueDialog);
  const queueButton = h('button', { type: 'button', class: 'am-mobile-button', onclick: () => {
    queueDialog.append(queueEl);
    queueDialog.showModal();
    queueDialog.querySelector('button').focus();
  } }, icon('panelLeft', 16), 'Queue');
  queueDialog.append(h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => queueDialog.close() }, icon('x', 16), 'Close queue'));
  queueDialog.addEventListener('close', () => { queueHome.after(queueEl); queueButton.focus({ preventScroll: true }); });
  queueDialog.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const controls = [...queueDialog.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(el => el.getClientRects().length && getComputedStyle(el).display !== 'none');
    const first = controls[0], last = controls.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  function showMobilePane(pane) {
    if (!narrow.matches) return;
    ws.dataset.mobilePane = pane;
    mobileNav.querySelectorAll('[data-pane]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pane === pane)));
    if (pane === 'activity' && !S.logOpen) { S.logOpen = true; paintLog(); }
    if (pane === 'board') requestAnimationFrame(() => graph.autoFit && graph.fit(false));
  }
  mobileNav.append(queueButton, ...[['board', 'Board'], ['details', 'Details'], ['activity', 'Activity']].map(([pane, text]) => h('button', {
    type: 'button', class: 'am-mobile-button', dataset: { pane }, 'aria-pressed': String(pane === 'board'), onclick: () => showMobilePane(pane) }, text)));
  top.after(mobileNav);
  const resize = () => {
    if (!narrow.matches && queueDialog.open) queueDialog.close();
    paintTop();
    if (narrow.matches) showMobilePane(ws.dataset.mobilePane);
    requestAnimationFrame(() => graph.autoFit && graph.fit(false));
  };
  narrow.addEventListener('change', resize);

  const viewModel = () => (S.replay ? S.replay.model : S.model);

  // ------------------------------------------------------------------------------------------------ toolbar
  function paintToolbar() {
    const btn = (ic, label, fn, on, extra = '') => h('button', { class: 'tb' + (on ? ' is-on' : '') + extra, type: 'button', title: label, 'aria-label': label, 'aria-pressed': on === undefined ? null : String(!!on), onclick: fn }, icon(ic, 17));
    fill(toolbar,
      btn('fit', 'Fit view (0)', () => graph.fit(true)),
      btn('plus', 'Zoom in (+)', () => graph.zoomBy(1.2)),
      btn('minus', 'Zoom out (-)', () => graph.zoomBy(1 / 1.2)),
      h('span', { class: 'tb-sep' }),
      h('button', { class: 'tb tb--wide' + (graph.follow ? ' is-on' : ''), type: 'button', 'aria-pressed': String(graph.follow), title: 'Camera follows each check. Turns off when you pan or zoom.',
        onclick: () => { graph.setFollow(!graph.follow); }
      }, icon('target', 16), h('span', { text: 'Follow investigation' })),
      h('button', { class: 'tb tb--wide' + (graph.allExpanded() ? ' is-on' : ''), type: 'button', 'aria-pressed': String(!!graph.allExpanded()),
        title: 'Show every related stage and check', onclick: () => { graph.expandAll(!graph.allExpanded()); paintToolbar(); }
      }, icon('layers', 16), h('span', { text: graph.allExpanded() ? 'Collapse related' : 'Expand all' })));
  }

  // ------------------------------------------------------------------------------------------------ top bar
  function paintTop() {
    const menuOpen = narrow.matches && top.querySelector('.am-board-menu')?.open;
    const m = viewModel();
    const a = S.auth;
    const payment = a ? a.payment : null;
    const c = a && a.case;
    const status = payment ? payment.status : 'IN_PROGRESS';
    const inv = a && a.investigation;
    const running = inv && inv.status === 'running';
    const resolved = status === 'COMPLETED';
    let label = 'Start investigation';
    let disabled = false;
    let hint = '';
    if (!a) { disabled = true; label = 'Start investigation'; hint = 'Select an incident'; }
    else if (!c) { disabled = true; hint = `An incident opens if the outcome stays unconfirmed for ${Math.round(a.incident_after_ms / 1000)} s (configured threshold).`; }
    else if (resolved) { disabled = true; label = 'Resolved'; hint = 'The wallet credit is confirmed.'; }
    else if (running) { disabled = true; label = `Investigating ${inv.checks_used ?? 0}/${inv.budget}`; if (m.investigation) label = `Investigating ${m.investigation.used}/${m.investigation.budget}`; }
    else if (inv && inv.status === 'concluded') label = 'Investigate again';
    if (a && knownRun(a.run.id) !== 'active') { disabled = true; hint = 'This journey is archived or its availability could not be verified. Saved history remains readable; return to the walkthrough to recover.'; }
    if (S.replay) { disabled = true; hint = 'Replay shows saved history. Actions are disabled.'; }

    const start = h('button', { class: 'btn btn--primary btn--sm', type: 'button', disabled, title: hint || null, onclick: startInvestigation }, icon(running ? 'ring' : 'search', 16, running ? 'spin-ic' : ''), h('span', { text: label }));
    const chips = [];
    if (payment) {
      chips.push(h('span', { class: 'ref mono', text: c ? c.reference : payment.reference }));
      chips.push(h('span', { class: 'amt', text: taka(payment.amount_minor) }));
      chips.push(h('span', { class: 'sep' }));
      chips.push(h('span', { class: 'muted', text: payment.bank_label + '  to  ' + payment.wallet_label }));
      const [tone, text] = queueLabel({ payment_status: status, incident: !!c, resolution: c && c.resolution, case_status: c && c.status });
      chips.push(h('span', { class: 'pill pill--' + tone, text }));
      if (c) chips.push(h('span', { class: 'muted' }, 'Owner ', h('strong', { text: c.owner_label })));
    }
    const live = { live: ['ok', 'Live'], reconnecting: ['warn', 'Reconnecting'], polling: ['warn', 'Polling'] }[S.conn] || ['ok', 'Live'];
    fill(top,
      brand(),
      h('div', { class: 'top-case' }, chips),
      h('div', { class: 'top-actions' },
        m && m.simMs ? h('span', { class: 'mono sim-t', title: 'Processing clock for this run' + (m.clock.paused ? ' (paused)' : m.clock.speed !== 1 ? ` (x${m.clock.speed})` : '') }, 'T+' + simClock(m.simMs) + (m.clock.paused ? ' paused' : m.clock.speed !== 1 ? ` x${m.clock.speed}` : '')) : null,
        h('span', { class: 'conn-chip conn-chip--' + live[0], title: 'Live connection to the saved event journal' }, h('i'), live[1]),
        start,
        a && a.case ? h('button', { class: 'btn btn--ghost btn--sm' + (S.replay ? ' is-on' : ''), type: 'button', onclick: toggleReplay, 'aria-pressed': String(!!S.replay) }, icon('replay', 16), h('span', { text: S.replay ? 'Exit replay' : 'Replay' })) : null,
        a && a.case ? link(withRun('/admin/cases/' + a.case.id + '/report', a.run.id), { class: 'btn btn--ghost btn--sm' }, icon('doc', 16), h('span', { text: 'Report' })) : null,
        h('a', { class: 'btn btn--ghost btn--sm', href: withRun('/mfs', a?.run.id || info.runId), title: 'Back to the Add-money walkthrough', 'aria-label': 'Back to Add-money walkthrough' }, icon('layers', 16), h('span', { text: 'MFS' })),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', title: 'Hide the queue and secondary panels (P)', onclick: () => document.body.classList.toggle('presenting') }, icon('maximize', 16), h('span', { text: 'Present' })),
        h('span', { class: 'who', title: 'This tab holds its own investigator session' }, icon('user', 15), h('span', { text: info.label || 'Investigator' }))));
    if (narrow.matches) {
      const actions = top.querySelector('.top-actions');
      const menu = h('details', { class: 'am-board-menu', open: menuOpen, onkeydown: e => {
        if (e.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); e.stopPropagation(); }
      } }, h('summary', { text: 'More' }));
      const items = h('div');
      for (const el of [...actions.children]) {
        if (!el.classList.contains('btn--primary') && !el.classList.contains('sim-t') && !el.classList.contains('conn-chip')) items.append(el);
      }
      menu.append(items);
      actions.append(menu);
    }

  }

  async function startInvestigation() {
    if (S.busy) return;
    S.busy = true;
    try {
      await requireActiveRun(S.snap.run.id);
      await post(`/staff/cases/${S.snap.payment.id}/investigate`, {}, uuid());
      graph.setFollow(true);
      S.tab = 'hypotheses';
      await refreshAuth();
    } catch (e) {
      toast(e instanceof ApiError ? e.detail : 'Could not start the investigation.', 'bad');
    } finally {
      S.busy = false;
      paint(true);
    }
  }

  // ------------------------------------------------------------------------------------------------ queue
  function paintQueue() {
    const items = S.queue.items;
    const open = !document.body.classList.contains('queue-collapsed');
    fill(queueEl,
      h('div', { class: 'q-head' },
        h('button', { class: 'tb', type: 'button', title: open ? 'Collapse queue' : 'Expand queue', 'aria-label': open ? 'Collapse queue' : 'Expand queue',
          onclick: () => { document.body.classList.toggle('queue-collapsed'); paintQueue(); setTimeout(() => graph.autoFit && graph.fit(false), 260); } }, icon('panelLeft', 17)),
        h('strong', { class: 'q-title', text: 'Payments' }), h('span', { class: 'q-count mono', text: String(items.length) })),
      h('ul', { class: 'q-list' }, items.length ? items.map((it) => {
        const [tone, text] = queueLabel(it);
        const active = S.snap && (it.payment_id === S.snap.payment.id);
        return h('li', {}, link(withRun('/admin/cases/' + (it.case_id || it.payment_id), S.snap?.run.id || info.runId), { class: 'q-row' + (active ? ' is-active' : ''), 'aria-current': active ? 'true' : null },
          h('span', { class: 'q-top' }, h('span', { class: 'mono q-ref', text: it.reference }), h('span', { class: 'q-amt', text: taka(it.amount_minor) })),
          h('span', { class: 'q-bot' }, h('span', { class: 'pill pill--sm pill--' + tone, text }), h('span', { class: 'q-time mono', text: hms(it.created_at) }))));
      }) : h('li', { class: 'q-empty', text: 'New payments appear here as customers submit them.' })));
  }

  async function refreshQueue() {
    try {
      S.queue = await get('/staff/queue' + (info && info.runId ? '?run=' + encodeURIComponent(info.runId) : ''));
      paintQueue();
      paintEmpty();
    } catch { /* retried on the next event */ }
    return S.queue.cursor;
  }
  const refreshQueueSoon = debounce(refreshQueue, 250);

  // ------------------------------------------------------------------------------------------------ inspector
  function paintInspector() {
    const focusedTab = inspector.contains(document.activeElement) ? document.activeElement.dataset.tab : null;
    const m = viewModel();
    const body = inspector.querySelector('.insp-body');
    const scroll = body ? body.scrollTop : 0;
    const tabs = [['evidence', 'Evidence'], ['hypotheses', 'Hypotheses'], ['plan', 'Plan']];
    const planDot = S.auth && S.auth.plan && S.auth.plan.status === 'proposed' || (m && m.handoff);
    fill(inspector,
      h('div', { class: 'insp-tabs', role: 'tablist' }, tabs.map(([id, text]) => h('button', {
        class: 'insp-tab' + (S.tab === id ? ' is-on' : ''), type: 'button', role: 'tab', dataset: { tab: id }, id: 'insp-tab-' + id, tabindex: S.tab === id ? '0' : '-1', 'aria-controls': 'insp-panel', 'aria-selected': String(S.tab === id),
        onclick: () => { S.tab = id; paintInspector(); }, onkeydown: e => {
          const index = tabs.findIndex(([key]) => key === id);
          const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : e.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
          if (next !== null) { e.preventDefault(); S.tab = tabs[next][0]; paintInspector(); inspector.querySelector('[data-tab="' + S.tab + '"]').focus({ preventScroll: true }); }
        } }, text, id === 'plan' && planDot ? h('i', { class: 'tab-dot', 'aria-label': 'New' }) : null,
      id === 'hypotheses' && m && m.investigation && m.investigation.status === 'running' ? h('i', { class: 'tab-dot tab-dot--live' }) : null))),
      h('div', { class: 'insp-body', id: 'insp-panel', role: 'tabpanel', 'aria-labelledby': 'insp-tab-' + S.tab, tabindex: '0' }, !m ? null : S.tab === 'evidence' ? evidenceTab(m) : S.tab === 'hypotheses' ? hypothesesTab(m) : planTab(m)));
    inspector.querySelector('.insp-body').scrollTop = scroll;
    if (focusedTab) inspector.querySelector('[data-tab="' + focusedTab + '"]')?.focus({ preventScroll: true });
  }

  const kv = (rows) => h('dl', { class: 'kv' }, rows.filter(Boolean).map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', {}, v))));
  const pill = (tone, text, small) => h('span', { class: `pill pill--${tone}` + (small ? ' pill--sm' : ''), text });
  const cite = (id, m) => h('button', { class: 'cite mono', type: 'button', title: 'Open this observation', onclick: () => openObservation(id, m) }, id);

  function openObservation(id, m) {
    const o = m.observations[id];
    if (!o) return;
    const node = (m.tools[o.tool] || {}).node;
    S.selected = node || null;
    S.tab = 'evidence';
    graph.select(node);
    showMobilePane('details');
    graph.ensureVisible && node && graph.ensureVisible(node);
  }

  function obsCard(o, m) {
    const tone = o.status === 'unavailable' ? 'warn' : 'ok';
    return h('article', { class: 'obs' },
      h('header', { class: 'obs-head' }, h('span', { class: 'mono obs-id', text: o.id }), pill(tone, o.status === 'unavailable' ? 'Source unavailable' : 'Returned', true), h('time', { class: 'mono', text: hms(o.as_of) })),
      h('h4', { text: o.label }),
      h('p', { class: 'obs-sum', text: o.summary }),
      h('p', { class: 'obs-meta' }, h('span', { text: 'Source: ' + o.source }), h('span', { text: 'Scope: ' + o.scope })),
      h('details', { class: 'raw' }, h('summary', { text: 'Raw record' }), h('pre', { text: JSON.stringify(o.data, null, 2) })));
  }

  function evidenceTab(m) {
    const a = S.auth;
    if (S.selected && m.nodes[S.selected]) {
      const n = m.nodes[S.selected];
      const group = (m.topology.groups.find((g) => g.id === n.group) || {}).title;
      const hist = n.history.filter((x, i, arr) => i === 0 || x.state !== arr[i - 1].state || x.headline !== arr[i - 1].headline);
      return h('div', { class: 'insp-sec reveal' },
        h('button', { class: 'back-link', type: 'button', onclick: () => { S.selected = null; graph.select(null); } }, icon('arrowLeft', 14), 'Case overview'),
        h('h3', { class: 'insp-h', text: n.title }),
        h('p', { class: 'muted small', text: `${group} · ${KIND_LABEL[n.kind]}` }),
        h('div', { class: 'node-state st-' + n.processing },
          h('span', { class: 'node-state-ic' }, icon(STATE_ICON[n.processing], 18)),
          h('div', {}, h('strong', { text: STATE_LABEL[n.processing] }), n.headline ? h('p', { text: n.headline }) : null, n.fact ? h('p', { class: 'muted', text: n.fact }) : null,
            n.amount != null && n.processing === 'completed' ? h('p', { class: 'mono amt-line', text: 'Posted ' + taka(n.amount) }) : null)),
        n.recovered ? h('p', { class: 'note-recovered' }, icon('repeat', 15), 'Recovered. Attempt 1 failed and stays in history; attempt 2 completed.') : null,
        kv([['Inspection', n.inspected ? `Inspected ${n.obs.length} time${n.obs.length === 1 ? '' : 's'}` : n.inspecting ? 'Check in progress' : 'Not inspected']]),
        n.obs.length ? h('div', {}, h('h4', { class: 'insp-h2', text: 'Observations' }), [...n.obs].reverse().map((id) => obsCard(m.observations[id], m))) : h('p', { class: 'muted', text: 'No check has returned a record for this stage yet. Its state is whatever the processing events established.' }),
        hist.length > 1 ? h('div', {}, h('h4', { class: 'insp-h2', text: 'History' }),
          h('ol', { class: 'hist' }, [...hist].reverse().map((x) => h('li', { class: 'st-' + x.state }, h('span', { class: 'hist-ic' }, icon(STATE_ICON[x.state], 14)),
            h('div', {}, h('strong', { text: (x.headline || STATE_LABEL[x.state]) + (x.attempt > 1 ? ` · attempt ${x.attempt}` : '') }), h('time', { class: 'mono', text: hms(x.at) })))))) : null);
    }
    const p = a && a.payment;
    const c = a && a.case;
    return h('div', { class: 'insp-sec' },
      h('h3', { class: 'insp-h', text: 'Case overview' }),
      p ? kv([['Payment', h('span', { class: 'mono', text: p.reference })], ['Amount', taka(p.amount_minor)], ['From', p.bank_label], ['To', p.wallet_label],
        ['Customer status', p.status === 'COMPLETED' ? 'Wallet credit confirmed' : p.status === 'UNCERTAIN' ? 'Not confirmed yet' : 'Processing'],
        c ? ['Incident', h('span', { class: 'mono', text: c.reference })] : ['Incident', 'None yet'],
        c ? ['Owner', c.owner_label] : null, c ? ['Evidence version', h('span', { class: 'mono', text: String(c.evidence_version) })] : null,
        c && c.complaints && c.complaints.length ? ['Customer report', c.complaints[c.complaints.length - 1].text] : null]) : h('p', { class: 'muted', text: 'Select a payment from the queue.' }),
      h('h4', { class: 'insp-h2', text: 'Checks performed' }),
      m.checks.length ? h('ul', { class: 'checks' }, [...m.checks].reverse().map((ch) => h('li', {}, h('button', { class: 'check-row', type: 'button', onclick: () => { S.selected = ch.node_id; graph.select(ch.node_id); } },
        h('span', { class: 'check-ic st-' + (ch.status === 'running' ? 'running' : ch.status === 'unavailable' ? 'unavailable' : 'completed') }, icon(ch.status === 'running' ? 'ring' : ch.status === 'unavailable' ? 'warning' : 'check', 14, ch.status === 'running' ? 'spin-ic' : '')),
        h('span', { class: 'check-txt' }, h('strong', { text: ch.label }), h('small', { text: ch.rationale || '' })),
        ch.observation_id ? h('span', { class: 'mono obs-id', text: ch.observation_id }) : null)))) : h('p', { class: 'muted', text: 'No checks yet. Starting an investigation authorises a bounded set of read-only checks.' }));
  }

  function hypothesesTab(m) {
    const inv = m.investigation;
    const mode = (S.snap && S.snap.mode_label) || 'Rules-based investigation';
    return h('div', { class: 'insp-sec' },
      h('div', { class: 'mode-row' }, h('span', { class: 'mode-chip', title: 'A deterministic policy over returned observations. No language model is used.' }, icon('list', 14), mode),
        inv ? h('span', { class: 'budget mono', text: `${inv.used}/${inv.budget} checks` }) : null),
      inv ? h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': inv.budget, 'aria-valuenow': inv.used }, h('i', { css: { width: Math.min(100, (inv.used / inv.budget) * 100) + '%' } })) : null,
      !inv ? h('p', { class: 'muted', text: 'Hypotheses are plausible, permitted explanations. Each changes only when a returned observation supports it.' }) : null,
      h('ul', { class: 'hyps' }, m.hyps.map((x) => h('li', { class: 'hyp hyp--' + x.status },
        h('div', { class: 'hyp-top' }, h('strong', { text: x.title }), pill({ unchecked: 'idle', supported: 'ok', ruled_out: 'wait', unresolved: 'warn' }[x.status], HYP_LABEL[x.status], true)),
        x.rationale ? h('p', { class: 'hyp-why', text: x.rationale }) : null,
        x.cites.length ? h('p', { class: 'cites' }, x.cites.map((id) => cite(id, m))) : null))),
      inv && inv.status === 'concluded' ? h('div', { class: 'concl' }, h('strong', { text: 'Conclusion' }), h('p', { text: inv.summary })) : null);
  }

  function planTab(m) {
    const a = S.auth;
    const plan = a && a.plan;
    const blocks = [];
    if (plan) {
      const stale = plan.status === 'proposed' && a.case && a.case.evidence_version !== plan.evidence_version;
      const status = plan.status;
      const canApprove = !S.replay && knownRun(a.run.id) === 'active' && status === 'proposed' && !stale && (a.sandbox_enabled || !plan.moves_money);
      const key = (S.approveKeys[plan.plan_id] = S.approveKeys[plan.plan_id] || uuid());
      const btn = h('button', { class: 'btn btn--primary btn--block', type: 'button', disabled: !canApprove, onclick: async () => {
        btn.disabled = true;
        try {
          await requireActiveRun(a.run.id);
          await post(`/staff/cases/${a.payment.id}/corrections/${plan.plan_id}/approve`, { evidence_version: plan.evidence_version }, key);
          graph.setFollow(true);
          toast('Approved. Progress appears on the graph.', 'ok');
        } catch (e) {
          toast(e instanceof ApiError ? e.detail : 'Approval failed.', 'bad', 6500);
        } finally {
          await refreshAuth();
        }
      } }, icon('check', 16), 'Approve correction');
      blocks.push(h('div', { class: 'plan reveal' },
        h('div', { class: 'plan-top' }, h('strong', { class: 'plan-name', text: plan.label }), pill(status === 'completed' ? 'ok' : status === 'proposed' ? 'warn' : status === 'executing' ? 'probe' : 'idle', PLAN_STATUS[status] || status, true)),
        h('p', { class: 'plan-money' }, icon(plan.moves_money ? 'lock' : 'check', 15), plan.moves_money ? 'This correction moves money. The server revalidates ownership, funding, mapping and replay capability first.' : 'No money moves. This only updates records.'),
        h('h4', { class: 'insp-h2', text: 'Steps' }),
        h('ol', { class: 'steps' }, plan.steps.map((s) => h('li', { text: s }))),
        h('h4', { class: 'insp-h2', text: 'Eligibility from records checked at proposal' }),
        h('ul', { class: 'elig' }, plan.options.map((o) => h('li', { class: o.eligible ? 'is-yes' : 'is-no' }, h('span', { class: 'elig-ic' }, icon(o.eligible ? 'check' : 'x', 14)),
          h('div', {}, h('strong', { text: o.label || o.kind }), !o.eligible ? h('small', { text: o.reasons[0] || '' }) : null)))),
        plan.missing_proof && plan.missing_proof.length ? h('p', { class: 'muted small', text: 'Missing proof: ' + plan.missing_proof.join('; ') }) : null,
        h('p', { class: 'muted small mono' }, `Bound to evidence version ${plan.evidence_version}`, plan.observation_ids.length ? ' · ' : '', plan.observation_ids.map((id) => cite(id, m))),
        stale || status === 'superseded' ? h('p', { class: 'warn-box' }, icon('warning', 16), 'The evidence changed after this plan was proposed. It can no longer be approved. Run a new investigation to review the new records.') : null,
        plan.moves_money && !a.sandbox_enabled && status === 'proposed' ? h('p', { class: 'warn-box' }, icon('lock', 16), 'Correction execution is switched off on this server. Investigation and the report remain available.') : null,
        status === 'proposed' ? btn : null,
        plan.outcome ? h('p', { class: 'outcome ' + (plan.outcome.result === 'refused' ? 'is-bad' : 'is-good') }, icon(plan.outcome.result === 'refused' ? 'x' : 'check', 16), plan.outcome.message || (plan.outcome.reasons || []).join(' ')) : null,
        S.replay ? h('p', { class: 'muted small', text: 'Replay is read-only. Approvals are disabled.' }) : null));
    }
    if (m.blocked || m.handoff) {
      const reasons = (m.blocked && m.blocked.reasons) || [];
      const hand = m.handoff;
      blocks.push(h('div', { class: 'plan plan--blocked reveal' },
        h('div', { class: 'plan-top' }, h('strong', { class: 'plan-name', text: hand ? 'Automatic correction is blocked' : 'Correction refused' }), pill('bad', 'Blocked', true)),
        m.blocked && m.blocked.summary ? h('p', { text: m.blocked.summary }) : null,
        reasons.length ? h('ul', { class: 'elig' }, reasons.map((r) => h('li', { class: 'is-no' }, h('span', { class: 'elig-ic' }, icon('x', 14)), h('div', {}, h('strong', { text: r.label }), h('small', { text: (r.reasons || []).join(' ') }))))) : null,
        hand ? h('div', { class: 'handoff' }, h('h4', { class: 'insp-h2', text: 'Owned handoff' }),
          kv([['Owner', hand.owner], ['Queue', hand.queue], ['Next requirement', hand.next_requirement], ['Next review', hand.next_review ? dayTime(hand.next_review) : null]])) : null,
        a && a.case ? link(withRun('/admin/cases/' + a.case.id + '/report', a.run.id), { class: 'btn btn--secondary btn--block' }, icon('doc', 16), 'Open the operator report') : null));
    }
    if (!blocks.length) {
      return h('div', { class: 'insp-sec' }, h('h3', { class: 'insp-h', text: 'Correction plan' }),
        h('p', { class: 'muted', text: a && a.payment && a.payment.status === 'COMPLETED'
          ? 'No correction is needed. The wallet credit is confirmed in the saved records, so there is nothing to approve.'
          : 'No plan yet. After an investigation, a supported correction appears here for approval, or an owned handoff if automatic correction is not possible.' }));
    }
    return h('div', { class: 'insp-sec' }, h('h3', { class: 'insp-h', text: 'Correction plan' }), blocks);
  }

  // ------------------------------------------------------------------------------------------------ log
  function paintLog() {
    const m = viewModel();
    const list = logEl.querySelector('.log-list');
    const nearEnd = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 50;
    const prev = list ? list.scrollTop : 0;
    const entries = m ? m.log : [];
    fill(logEl,
      h('div', { class: 'log-head' }, h('strong', { text: 'Investigation log' }), h('span', { class: 'q-count mono', text: String(entries.length) }),
        h('button', { class: 'tb', type: 'button', title: S.logOpen ? 'Collapse log' : 'Expand log', 'aria-label': S.logOpen ? 'Collapse log' : 'Expand log', 'aria-expanded': String(S.logOpen),
          onclick: () => { S.logOpen = !S.logOpen; ws.classList.toggle('log-closed', !S.logOpen); paintLog(); setTimeout(() => graph.autoFit && graph.fit(false), 260); } }, icon(S.logOpen ? 'chevronDown' : 'chevronUp', 16))),
      S.logOpen ? h('ol', { class: 'log-list', tabindex: '0', 'aria-label': 'Events in order' }, entries.map((e) => h('li', { class: 'log-row tone-' + e.tone },
        h('time', { class: 'mono log-t', text: simClock(e.sim_ms || 0) }), h('span', { class: 'log-tag', text: e.tag }), h('span', { class: 'log-text' }, e.text),
        e.cites.length ? h('span', { class: 'cites' }, e.cites.slice(0, 4).map((id) => cite(id, m))) : null))) : null);
    const nl = logEl.querySelector('.log-list');
    if (nl) nl.scrollTop = nearEnd ? nl.scrollHeight : prev;
  }

  // ------------------------------------------------------------------------------------------------ empty state
  function paintEmpty() {
    empty.hidden = !!S.snap;
    if (S.snap) return;
    const latest = S.queue.items[0];
    fill(empty, h('div', { class: 'empty-card' }, h('span', { class: 'empty-ic' }, icon('pulse', 26)),
      h('h2', { text: 'Waiting for payments' }),
      h('p', { text: latest ? 'The newest payment is ready to open. Customer requests appear in the queue the moment they are submitted.' : 'When a customer submits an add-money request, it appears here with its processing stages.' }),
      latest ? link('/admin/cases/' + (latest.case_id || latest.payment_id), { class: 'btn btn--primary' }, 'Open ' + latest.reference, icon('arrowRight', 16)) : null));
  }

  // ------------------------------------------------------------------------------------------------ replay
  function toggleReplay() {
    if (S.replay) return exitReplay();
    const total = S.events.length;
    S.replay = { idx: 0, total, playing: true, speed: 1, timer: null, model: null };
    rebuildReplay(0);
    scheduleNext();
    paintReplay();
    paint(true);
  }

  function exitReplay() {
    if (S.replay) clearTimeout(S.replay.timer);
    S.replay = null;
    graph.setModel(S.model);
    syncHub(S.model);
    paintReplay();
    paint(true);
  }

  function rebuildReplay(i) {
    S.replay.idx = i;
    S.replay.model = buildModel(S.snap, S.events, i);
    graph.setModel(S.replay.model);
    syncHub(S.replay.model);
  }

  function scheduleNext() {
    const r = S.replay;
    if (!r) return;
    clearTimeout(r.timer);
    if (!r.playing) return;
    if (r.idx >= S.events.length) { r.playing = false; paintReplay(); return; }
    const next = S.events[r.idx];
    const prev = S.events[r.idx - 1];
    const gap = prev ? Math.max(0, (next.sim_ms || 0) - (prev.sim_ms || 0)) : 400;
    const delay = Math.min(1500, Math.max(110, gap)) / r.speed;
    r.timer = setTimeout(() => {
      if (!S.replay) return;
      const fx = S.replay.model.apply(S.events[S.replay.idx]);
      S.replay.idx += 1;
      graph.refresh(fx);
      syncHub(S.replay.model);
      paint(true);
      paintReplay();
      scheduleNext();
    }, r.idx === 0 ? 250 : delay);
  }

  function paintReplay() {
    const r = S.replay;
    replayBar.hidden = !r;
    if (!r) return;
    const at = S.events[Math.max(0, r.idx - 1)];
    const scrub = h('input', { type: 'range', min: 0, max: S.events.length, value: r.idx, class: 'scrub', 'aria-label': 'Replay position',
      oninput: (e) => { clearTimeout(r.timer); r.playing = false; rebuildReplay(+e.target.value); paint(true); paintReplay(); } });
    fill(replayBar,
      h('span', { class: 'replay-tag' }, icon('replay', 15), 'Replaying saved history'),
      h('button', { class: 'tb', type: 'button', 'aria-label': r.playing ? 'Pause replay' : 'Play replay', onclick: () => {
        if (r.idx >= S.events.length) rebuildReplay(0);
        r.playing = !r.playing;
        scheduleNext();
        paintReplay();
      } }, icon(r.playing ? 'pause' : 'play', 16)),
      scrub, h('span', { class: 'mono replay-pos', text: `${r.idx}/${S.events.length}${at ? '  T+' + simClock(at.sim_ms || 0) : ''}` }),
      h('div', { class: 'seg' }, [1, 2, 4].map((s) => h('button', { type: 'button', class: 'seg-btn' + (r.speed === s ? ' is-on' : ''), onclick: () => { r.speed = s; scheduleNext(); paintReplay(); } }, s + 'x'))),
      h('span', { class: 'muted small', text: 'Read-only. Nothing is re-executed.' }),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: exitReplay }, 'Return to live'));
  }

  // ------------------------------------------------------------------------------------------------ paint scheduler
  let queued = false;
  function paint(force) {
    if (force) S.painted = {};
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const m = viewModel();
      const sig = m ? JSON.stringify(m.rev) + (S.replay ? 'r' + S.replay.idx : '') + S.tab + S.selected + (S.auth ? S.auth.plan && S.auth.plan.status : '') + S.conn : 'none';
      if (S.painted.sig === sig && !force) return;
      S.painted.sig = sig;
      paintTop();
      paintInspector();
      paintLog();
    });
  }

  function syncHub(m) {
    const inv = m && m.investigation;
    graph.setHub(inv ? inv.status : 'idle');
  }

  // ------------------------------------------------------------------------------------------------ data
  const AUTH_EVENTS = new Set(['INCIDENT_OPENED', 'INVESTIGATION_STARTED', 'INVESTIGATION_CONCLUDED', 'CORRECTION_PROPOSED', 'CORRECTION_APPROVED', 'CORRECTION_COMPLETED',
    'CORRECTION_BLOCKED', 'HANDOFF_CREATED', 'PAYMENT_COMPLETED', 'CASE_STATUS_CHANGED', 'REPORT_SAVED', 'COMPLAINT_ATTACHED']);

  function takeAuth(snap) {
    S.auth = { payment: snap.payment, case: snap.case, plan: snap.plan, investigation: snap.investigation, report: snap.report, sandbox_enabled: snap.sandbox_enabled,
      incident_after_ms: snap.incident_after_ms, run: snap.run };
  }

  async function refreshAuth() {
    try {
      const snap = await get(`/staff/cases/${S.snap.payment.id}`);
      S.snap.mode_label = snap.mode_label;
      takeAuth(snap);
    } catch { /* keep the previous authoritative view */ }
    paint(true);
  }
  const refreshAuthSoon = debounce(refreshAuth, 180);

  function onEvent(e) {
    if (S.evSeen.has(e.event_id)) return;
    S.evSeen.add(e.event_id);
    S.events.push(e);
    const fx = S.replay ? (S.model.apply(e), []) : S.model.apply(e);
    if (!S.replay) {
      graph.refresh(fx);
      syncHub(S.model);
    }
    const needs = AUTH_EVENTS.has(e.type) || (S.auth && S.auth.plan && S.auth.plan.status === 'proposed' && (e.type === 'STAGE_OBSERVED' || e.type === 'CHECK_COMPLETED'));
    if (needs) refreshAuthSoon();
    if (e.type === 'INCIDENT_OPENED' || e.type === 'PAYMENT_COMPLETED') refreshQueueSoon();
    paint();
  }

  async function loadCase() {
    S.snap = await get(`/staff/cases/${S.ident}`);
    const availability = await staffRunState(S.snap.run.id).catch(() => 'unavailable');
    rememberRun({ id: S.snap.run.id, status: availability });
    rememberPayment(S.snap.payment.id, S.snap.run.id);
    if (app.isConnected) history.replaceState({}, '', withRun(location.pathname, S.snap.run.id));
    info.runId = S.snap.run.id;
    S.events = [...S.snap.events];
    S.evSeen = new Set(S.events.map((x) => x.event_id));
    S.model = buildModel(S.snap, S.events);
    takeAuth(S.snap);
    graph.setModel(S.model);
    syncHub(S.model);
    if (S.model.investigation && S.model.investigation.status === 'running') S.tab = 'hypotheses';
    else if (S.auth.plan && S.auth.plan.status === 'proposed') S.tab = 'plan';
    if (app.isConnected) document.title = (S.auth.case ? S.auth.case.reference : S.auth.payment.reference) + ' · Payment investigations · DataUkil';
    return S.snap.cursor;
  }

  // ------------------------------------------------------------------------------------------------ boot
  paintToolbar();
  paintQueue();
  paintTop();
  paintInspector();
  paintLog();
  await refreshQueue();
  let caseStream = null;
  if (S.ident) {
    try {
      const queueRun = info.runId;
      const cursor = await loadCase();
      if (S.snap.run.id !== queueRun) await refreshQueue();
      paintToolbar();
      paintEmpty();
      caseStream = new LiveStream({
        scope: 'payment:' + S.snap.payment.id, cursor, onEvent,
        onStatus: (s) => { S.conn = s; paint(true); },
        onResync: async () => {
          const c = await loadCase();
          paintEmpty();
          paint(true);
          return c;
        },
      }).start();
    } catch (e) {
      empty.hidden = false;
      fill(empty, h('div', { class: 'empty-card' }, h('h2', { text: 'Record not found' }), h('p', { text: e instanceof ApiError ? e.detail : 'This payment could not be loaded.' }),
        link('/admin/queue', { class: 'btn btn--primary' }, 'Back to the queue')));
    }
  } else {
    paintEmpty();
  }
  paint(true);

  const inbox = new LiveStream({
    scope: 'inbox', cursor: S.queue.cursor, onEvent: () => refreshQueueSoon(), onStatus: () => {},
    onResync: refreshQueue,
  }).start();

  const keys = (ev) => {
    if (ev.target.closest('input, textarea, select') || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === 'p' || ev.key === 'P') document.body.classList.toggle('presenting');
    else if (ev.key === 'Escape' && S.selected) { S.selected = null; graph.select(null); }
  };
  document.addEventListener('keydown', keys);
  const onToggle = () => setTimeout(() => graph.autoFit && graph.fit(false), 280);
  const mo = new MutationObserver(onToggle);
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const availabilityChanged = e => { if (e.key === 'tf.pay.runState.' + S.snap?.run.id) paint(true); };
  window.addEventListener('storage', availabilityChanged);

  return () => {
    window.removeEventListener('storage', availabilityChanged);
    narrow.removeEventListener('change', resize);
    if (queueDialog.open) queueDialog.close();
    queueDialog.remove();
    if (caseStream) caseStream.stop();
    inbox.stop();
    if (S.replay) clearTimeout(S.replay.timer);
    graph.destroy();
    document.removeEventListener('keydown', keys);
    mo.disconnect();
    document.body.classList.remove('presenting');
  };
}

function legendEl() {
  const items = [['completed', 'Completed'], ['running', 'In progress'], ['pending', 'Waiting'], ['failed', 'Failed'], ['unavailable', 'Source unavailable'], ['unknown', 'Unknown']];
  return h('details', { class: 'graph-legend' }, h('summary', {}, icon('list', 14), 'Legend'),
    h('ul', {}, items.map(([s, t]) => h('li', { class: 'st-' + s }, h('span', { class: 'lg-ic' }, icon(STATE_ICON[s], 13)), t)),
      h('li', { class: 'lg-probe' }, h('span', { class: 'lg-line' }), 'Investigation probe'),
      h('li', { class: 'lg-inspect' }, h('span', { class: 'lg-ring' }), 'Inspected (separate from state)')));
}

// =====================================================================================================================
async function mountReport(app, ident) {
  const data = await get(`/staff/cases/${ident}/report`);
  const r = data.report;
  const snapshot = await get(`/staff/cases/${ident}`);
  const runId = snapshot.run.id;
  rememberPayment(snapshot.payment.id, runId);
  if (!app.isConnected) return () => {};
  history.replaceState({}, '', withRun(location.pathname, runId));
  const cites = (ids) => ids && ids.length ? h('span', { class: 'cites' }, ids.map((i) => h('span', { class: 'cite mono', text: i }))) : null;
  const sec = (title, ...kids) => h('section', { class: 'rep-sec' }, h('h2', { text: title }), ...kids);
  app.append(h('div', { class: 'rep' },
    siteHeader(runId),
    flowStrip(4, { run: runId, payment: snapshot.payment.id, caseId: snapshot.case?.id }),
    h('header', { class: 'rep-top' }, h('span', { class: 'am-kicker', text: 'Evidence report' }),
      h('div', { class: 'rep-actions' },
        link(withRun('/admin/cases/' + ident, runId), { class: 'btn btn--ghost btn--sm' }, icon('arrowLeft', 16), 'Back to workspace'),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => download(`/staff/cases/${ident}/report.md`, `${r.case_reference}-report-v${data.version}.md`) }, icon('download', 16), 'Markdown'),
        h('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: () => download(`/staff/cases/${ident}/report.html`, `${r.case_reference}-report-v${data.version}.html`) }, icon('download', 16), 'HTML'))),
    h('article', { class: 'rep-doc' },
      h('p', { class: 'rep-eyebrow' }, 'Operator report · version ' + data.version),
      h('h1', { text: r.case_reference }),
      h('p', { class: 'rep-meta' }, `Payment ${r.payment_reference} · ${taka(r.amount_minor)} · ${r.bank_label} to ${r.wallet_label}`),
      h('p', { class: 'rep-meta' }, `Status ${r.status} · ${String(r.resolution).replace('_', ' ')} · evidence version ${r.evidence_version} · SHA-256 ${data.sha256.slice(0, 16)}`),
      h('section', { class: 'am-report-outcome' + (r.resolution === 'credit_confirmed' ? ' is-confirmed' : ' is-unconfirmed') }, h('strong', {}, icon(r.resolution === 'credit_confirmed' ? 'check' : 'warning', 18), ' ', r.resolution === 'credit_confirmed' ? 'Wallet credit confirmed' : r.resolution === 'handoff' ? 'Owned follow-up · credit unconfirmed' : 'Decision pending · credit unconfirmed'), h('p', { text: r.operator.next_action })),
      sec('Customer symptom', h('p', { text: r.symptom.text }), r.symptom.appeared_at ? h('p', { class: 'muted', text: 'First visible at ' + hms(r.symptom.appeared_at) + ' (Asia/Dhaka)' }) : null),
      sec('Confirmed facts', r.confirmed.length ? h('ul', {}, r.confirmed.map((f) => h('li', {}, f.text, ' ', cites(f.cites)))) : h('p', { class: 'muted', text: 'No facts have been confirmed by a check yet.' })),
      sec('Unknowns', r.unknowns.length ? h('ul', {}, r.unknowns.map((f) => h('li', {}, f.text, ' ', cites(f.cites)))) : h('p', { class: 'muted', text: 'No open unknowns recorded.' })),
      sec('Located fault', h('p', {}, h('strong', { text: r.fault.kind + ': ' }), r.fault.statement, ' ', cites(r.fault.cites))),
      sec('Hypotheses', h('ul', { class: 'rep-hyps' }, r.hypotheses.map((x) => h('li', {}, h('strong', { text: x.title }), ' ', h('span', { class: 'pill pill--sm pill--' + { supported: 'ok', ruled_out: 'wait', unresolved: 'warn', unchecked: 'idle' }[x.status], text: HYP_LABEL[x.status] }),
        x.rationale ? h('div', { class: 'muted', text: x.rationale }) : null, cites(x.cites))))),
      sec('Checks performed', r.checks.length ? h('table', { class: 'rep-table' }, h('thead', {}, h('tr', {}, ['Observation', 'Check', 'As of', 'Source and scope', 'Result'].map((t) => h('th', { text: t })))),
        h('tbody', {}, r.checks.map((c) => h('tr', {}, h('td', { class: 'mono', text: c.id }), h('td', { text: c.label }), h('td', { class: 'mono', text: hms(c.as_of) }), h('td', { text: `${c.source}. ${c.scope}` }), h('td', { text: c.summary }))))) : h('p', { class: 'muted', text: 'No checks have been run.' })),
      sec('Proposed repair and outcome', r.plan ? h('div', {}, h('p', {}, h('strong', { text: r.plan.label }), ' · ' + r.plan.status + (r.plan.approved_by ? ' · approved by ' + (r.plan.approved_by === 'staff_2' ? 'Investigator 2' : 'Investigator 1') : '')), r.plan.outcome ? h('p', { text: r.plan.outcome.message || '' }) : null)
        : h('p', { class: 'muted', text: 'No repair was proposed.' }),
      r.blocked.length ? h('div', {}, h('h3', { text: 'Options not available, and why' }), h('ul', {}, r.blocked.map((b) => h('li', {}, h('strong', { text: b.label + ': ' }), (b.reasons || []).join(' '))))) : null),
      sec('Operator ownership', h('p', {}, h('strong', { text: 'Owner: ' }), r.operator.owner), h('p', {}, h('strong', { text: 'Next action: ' }), r.operator.next_action)),
      sec('Action log', h('ol', { class: 'rep-log' }, r.log.map((l) => h('li', {}, h('time', { class: 'mono', text: hms(l.at) }), h('span', {}, l.text, ' ', cites(l.cites)))))),
      h('footer', { class: 'rep-foot' }, h('p', { text: r.execution_mode }), h('p', { class: 'muted', text: r.disclosure })))));
  app.querySelectorAll('.rep-table').forEach(table => { const wrap = h('div', { class: 'am-report-table', tabindex: '0', role: 'region', 'aria-label': 'Checks performed table' }); table.before(wrap); wrap.append(table); });
  return () => {};
}
