// Customer surface: start an add-money request, follow its progress, and follow the linked investigation.
// Everything shown is a customer projection supplied by the server; no staff data ever reaches this page.
import { get, post, LiveStream, sessionInfo, ApiError } from './api.js';
import { h, clear, fill, link, navigate, taka, hms, dayTime, uuid, toast, debounce } from './util.js';
import { icon } from './icons.js';

const BANKS_FALLBACK = [];

function chrome(active, ...content) {
  const info = sessionInfo();
  return h('div', { class: 'cust-shell' },
    h('header', { class: 'cust-head' },
      h('div', { class: 'cust-head-in' },
        link('/customer/payment', { class: 'cust-brand', 'aria-label': 'Wallet home' }, h('span', { class: 'cust-mark' }, icon('wallet', 18)), h('span', { text: 'Wallet' })),
        h('nav', { class: 'cust-nav', 'aria-label': 'Primary' },
          link('/customer/payment', { class: active === 'add' ? 'is-active' : '', 'aria-current': active === 'add' ? 'page' : null }, 'Add money')),
        h('div', { class: 'cust-head-end' },
          h('span', { class: 'cust-user' }, icon('user', 16), h('span', { text: info.label || 'Customer' }))))),
    h('main', { class: 'cust-main', id: 'main' }, ...content));
}

// ---------------------------------------------------------------------------------------------- form
function intentKey(fingerprint) {
  // One logical operation per distinct request: a double click, retry or reload reuses the same key.
  try {
    const saved = JSON.parse(sessionStorage.getItem('tf.pay.intent') || 'null');
    if (saved && saved.fp === fingerprint) return saved.key;
  } catch {
    /* ignore */
  }
  const key = uuid();
  sessionStorage.setItem('tf.pay.intent', JSON.stringify({ fp: fingerprint, key }));
  return key;
}

async function mountForm(app, runId) {
  const cfg = await get('/config');
  const banks = cfg.banks || BANKS_FALLBACK;
  const state = { amount: '1000', bank: banks[0] && banks[0].code, step: 'edit', busy: false };
  const body = h('div', { class: 'pay-flow' });
  const recent = h('section', { class: 'activity', 'aria-labelledby': 'act-h' });
  app.append(chrome('add', body, recent));

  const minor = () => {
    const v = String(state.amount).replace(/,/g, '').trim();
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(v)) return null;
    const m = Math.round(parseFloat(v) * 100);
    return m >= cfg.min_minor && m <= cfg.max_minor ? m : null;
  };
  const bankOf = () => banks.find((b) => b.code === state.bank);

  function edit() {
    clear(body);
    const err = h('p', { class: 'field-error', id: 'amt-err', role: 'alert', hidden: true });
    const amountInput = h('input', {
      id: 'amount', class: 'amount-input', type: 'text', inputmode: 'decimal', autocomplete: 'off', value: state.amount,
      'aria-describedby': 'amt-err', 'aria-label': 'Amount in taka',
      oninput: (e) => {
        state.amount = e.target.value;
        summary();
      },
    });
    const chips = [500, 1000, 2000, 5000].map((v) => h('button', {
      type: 'button', class: 'chip' + (String(v) === String(state.amount) ? ' is-on' : ''), text: '\u09F3' + v.toLocaleString('en-US'),
      onclick: () => {
        state.amount = String(v);
        amountInput.value = state.amount;
        $$chips();
        summary();
      },
    }));
    const $$chips = () => chips.forEach((c, i) => c.classList.toggle('is-on', String([500, 1000, 2000, 5000][i]) === String(state.amount)));
    const sumEl = h('p', { class: 'pay-summary', 'aria-live': 'polite' });
    const go = h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Review');
    function summary() {
      $$chips();
      const m = minor();
      const b = bankOf();
      err.hidden = m !== null || !String(state.amount).trim();
      err.textContent = m === null && String(state.amount).trim() ? `Enter an amount from \u09F31 to \u09F3${(cfg.max_minor / 100).toLocaleString('en-US')}.` : '';
      sumEl.textContent = m !== null && b ? `${taka(m)} will move from ${b.name} ${b.mask} to your wallet.` : '';
      go.disabled = m === null;
    }
    const radios = banks.map((b) => h('label', { class: 'bank-row' + (b.code === state.bank ? ' is-on' : '') },
      h('input', { type: 'radio', name: 'bank', value: b.code, checked: b.code === state.bank, onchange: () => { state.bank = b.code; edit(); } }),
      h('span', { class: 'bank-ic' }, icon('bank', 18)),
      h('span', { class: 'bank-txt' }, h('strong', { text: b.name }), h('small', { class: 'mono', text: b.mask + ' · Linked account' })),
      h('span', { class: 'bank-dot', 'aria-hidden': 'true' })));
    body.append(h('form', { class: 'pay-card', novalidate: true, onsubmit: (e) => { e.preventDefault(); if (minor() !== null) { state.step = 'review'; review(); } } },
      h('h1', { class: 'pay-title', text: 'Add money' }),
      h('p', { class: 'pay-lead', text: 'Move money from a linked bank account into your wallet.' }),
      h('section', { class: 'pay-sec' },
        h('label', { class: 'sec-label', for: 'amount', text: 'Amount' }),
        h('div', { class: 'amount-wrap' }, h('span', { class: 'amount-cur', 'aria-hidden': 'true', text: '\u09F3' }), amountInput),
        err, h('div', { class: 'chips' }, chips)),
      h('fieldset', { class: 'pay-sec' }, h('legend', { class: 'sec-label', text: 'From' }), h('div', { class: 'bank-list' }, radios)),
      h('section', { class: 'pay-sec' }, h('span', { class: 'sec-label', text: 'To' }),
        h('div', { class: 'dest-row' }, h('span', { class: 'bank-ic bank-ic--wallet' }, icon('wallet', 18)),
          h('span', { class: 'bank-txt' }, h('strong', { text: cfg.wallet.name }), h('small', { class: 'mono', text: cfg.wallet.mask + ' · Your wallet' })))),
      sumEl, go));
    summary();
    amountInput.focus();
  }

  function review() {
    clear(body);
    const m = minor();
    const b = bankOf();
    const status = h('p', { class: 'pay-note', role: 'status' });
    const confirm = h('button', { class: 'btn btn--primary btn--block', type: 'button', text: `Confirm and add ${taka(m)}` });
    const back = h('button', { class: 'btn btn--ghost btn--block', type: 'button', text: 'Edit details', onclick: () => { state.step = 'edit'; edit(); } });
    confirm.addEventListener('click', async () => {
      if (state.busy) return;
      state.busy = true;
      confirm.disabled = back.disabled = true;
      confirm.textContent = 'Sending your request';
      status.textContent = '';
      try {
        const fp = `${m}|${state.bank}|${runId || ''}`;
        const snap = await post('/payments', { amount_minor: m, bank_code: state.bank, run_id: sessionInfo().runId }, intentKey(fp));
        sessionStorage.removeItem('tf.pay.intent');
        navigate('/customer/payment/' + snap.payment.id + (runId ? '?run=' + encodeURIComponent(runId) : ''));
      } catch (e) {
        state.busy = false;
        confirm.disabled = back.disabled = false;
        confirm.textContent = `Confirm and add ${taka(m)}`;
        status.textContent = e instanceof ApiError ? e.detail : 'We could not confirm the request result. Check recent activity before creating another transfer; retrying this unchanged request uses the same reference.';
      }
    });
    body.append(h('div', { class: 'pay-card' },
      h('h1', { class: 'pay-title', text: 'Review your request' }),
      h('p', { class: 'review-amount' }, h('span', { class: 'cur', text: '\u09F3' }), h('span', { text: taka(m, false) })),
      h('dl', { class: 'review-list' },
        h('div', {}, h('dt', { text: 'From' }), h('dd', {}, b.name, h('span', { class: 'mono sub', text: ' ' + b.mask }))),
        h('div', {}, h('dt', { text: 'To' }), h('dd', {}, cfg.wallet.name, h('span', { class: 'mono sub', text: ' ' + cfg.wallet.mask }))),
        h('div', {}, h('dt', { text: 'Fee' }), h('dd', { text: 'No fee' }))),
      h('p', { class: 'pay-fine', text: 'Your bank will be asked to approve this request. You will see the result on the next screen.' }),
      status, confirm, back));
    confirm.focus();
  }

  async function loadRecent() {
    const list = await get('/payments').catch(() => []);
    clear(recent);
    if (!list.length) return;
    recent.append(h('h2', { id: 'act-h', class: 'act-title', text: 'Recent activity' }),
      h('ul', { class: 'act-list' }, list.map((p) => h('li', {},
        link('/customer/payment/' + p.id, { class: 'act-row' },
          h('span', { class: 'act-main' }, h('strong', { text: 'Add money' }), h('small', { class: 'mono', text: p.reference + ' · ' + dayTime(p.created_at) })),
          h('span', { class: 'act-amt' }, h('strong', { text: taka(p.amount_minor) }), statusPill(p.status)))))));
  }

  edit();
  loadRecent();
  return () => {};
}

function statusPill(status) {
  const map = { COMPLETED: ['ok', 'Completed'], UNCERTAIN: ['warn', 'Not confirmed yet'], IN_PROGRESS: ['wait', 'Processing'] };
  const [tone, label] = map[status] || ['wait', 'Processing'];
  return h('span', { class: 'pill pill--' + tone, text: label });
}

// ---------------------------------------------------------------------------------------------- progress & case
async function mountProgress(app, id, mode) {
  const endpoint = mode === 'case' ? `/customer/cases/${id}` : `/payments/${id}`;
  let snap = await get(endpoint);
  const paymentId = snap.payment.id;
  const root = h('div', { class: 'status-page' });
  app.append(chrome('add', root));

  // persistent report box so typing is never lost to a re-render
  const note = h('textarea', { class: 'note-input', id: 'report-note', rows: 3, maxlength: 1000, placeholder: 'Add anything that may help (optional)', 'aria-label': 'Note for the investigator' });
  const reportBtn = h('button', { class: 'btn btn--secondary', type: 'button', text: 'Report an issue' });
  const reportMsg = h('p', { class: 'pay-note', role: 'status' });
  let reportKey = uuid();
  reportBtn.addEventListener('click', async () => {
    reportBtn.disabled = true;
    reportBtn.textContent = 'Sending report';
    try {
      snap = await post(`/payments/${paymentId}/report`, { note: note.value }, reportKey);
      reportMsg.textContent = '';
      render();
    } catch (e) {
      reportBtn.disabled = false;
      reportBtn.textContent = 'Report an issue';
      reportMsg.textContent = e instanceof ApiError ? e.detail : 'We could not send your report. Please try again.';
    }
  });
  const reportBox = h('section', { class: 'report-box' },
    h('h2', { class: 'sec-h', text: 'Something not right?' }),
    h('p', { class: 'muted', text: 'Report it here and the investigator will see it on this same case. Please do not send another transfer.' }),
    note, reportBtn, reportMsg);

  const seenTimeline = new Set();
  let firstRender = true;
  const conn = h('p', { class: 'conn', role: 'status', hidden: true });

  function stageIcon(s) {
    if (s.state === 'done') return icon('check', 14);
    if (s.state === 'uncertain') return icon('question', 14);
    if (s.state === 'current') return h('span', { class: 'dot-live' });
    return h('span', { class: 'dot-empty' });
  }

  function render() {
    const p = snap.payment;
    const done = p.status === 'COMPLETED';
    const unc = p.status === 'UNCERTAIN';
    const lead = mode === 'case' && snap.case ? caseLead(snap) : snap.lead;
    fill(root,
      h('div', { class: 'crumbs' }, link(mode === 'case' ? '/customer/payment/' + paymentId : '/customer/payment', { class: 'back' }, icon('arrowLeft', 16), mode === 'case' ? 'Back to payment' : 'Add money')),
      h('section', { class: 'status-hero tone-' + (done ? 'ok' : unc ? 'warn' : 'wait') },
        h('span', { class: 'status-ic', 'aria-hidden': 'true' }, done ? icon('check', 26) : unc ? icon('clock', 26) : h('span', { class: 'spin' })),
        h('div', {}, h('h1', { class: 'status-title', text: mode === 'case' && snap.case ? 'Investigation ' + snap.case.reference : snap.headline }),
          h('p', { class: 'status-lead', text: lead }))),
      h('section', { class: 'amount-block' },
        h('p', { class: 'amount-big' }, h('span', { class: 'cur', text: '\u09F3' }), h('span', { text: taka(p.amount_minor, false) })),
        h('p', { class: 'route' }, h('span', { text: p.bank_label }), icon('arrowRight', 15), h('span', { text: p.wallet_label })),
        h('p', { class: 'mono ref', text: 'Reference ' + p.reference + ' · Started ' + dayTime(p.created_at) })),
      mode === 'case' ? null : h('section', { class: 'stepper-sec', 'aria-labelledby': 'prog-h' },
        h('h2', { id: 'prog-h', class: 'sec-h', text: 'Progress' }),
        h('ol', { class: 'stepper' }, snap.stages.map((s) => h('li', { class: 'step is-' + s.state },
          h('span', { class: 'step-dot' }, stageIcon(s)), h('span', { class: 'step-label', text: s.label }),
          h('span', { class: 'step-state', text: { done: 'Done', uncertain: 'Not confirmed yet', current: 'In progress', pending: 'Waiting' }[s.state] }))))),
      snap.next_step ? h('section', { class: 'next-box' }, icon('activity', 18), h('div', {}, h('strong', { text: 'What happens next' }), h('p', { text: snap.next_step }))) : null,
      snap.case ? caseBlock(snap, mode) : null,
      snap.facts.length ? h('section', { class: 'facts-sec' }, h('h2', { class: 'sec-h', text: 'What we know' }),
        h('ul', { class: 'facts' }, snap.facts.map((f) => h('li', {}, icon('check', 15), h('span', { text: f }))))) : null,
      (mode !== 'case' && snap.can_report) ? reportBox : null,
      (mode !== 'case' && snap.payment.reported) ? h('p', { class: 'reported', role: 'status' }, icon('check', 16), 'Your report is attached to the investigation. No duplicate case was created.') : null,
      h('section', { class: 'timeline-sec', 'aria-labelledby': 'tl-h' }, h('h2', { id: 'tl-h', class: 'sec-h', text: 'Updates' }),
        h('ol', { class: 'timeline' }, [...snap.timeline].reverse().map((t) => {
          const fresh = !firstRender && !seenTimeline.has(t.sequence);
          seenTimeline.add(t.sequence);
          return h('li', { class: 'tl-item' + (fresh ? ' is-new' : '') },
            h('time', { class: 'mono', text: hms(t.at) }), h('span', { text: t.text }));
        }))),
      conn);
    firstRender = false;
  }

  function caseLead(s) {
    return s.case.resolved ? 'The investigation is complete.' : 'An investigator owns this case and is reviewing the saved payment records.';
  }

  function caseBlock(s, m) {
    const c = s.case;
    return h('section', { class: 'case-box' },
      h('div', { class: 'case-top' }, h('span', { class: 'case-ic' }, icon('search', 18)),
        h('div', {}, h('strong', { text: 'Investigation ' + c.reference }), h('small', { text: c.resolved ? 'Resolved' : 'In progress' }))),
      h('dl', { class: 'case-list' },
        h('div', {}, h('dt', { text: 'Owner' }), h('dd', { text: c.owner })),
        c.next_review ? h('div', {}, h('dt', { text: 'Next review' }), h('dd', { text: dayTime(c.next_review) })) : null,
        h('div', {}, h('dt', { text: 'Next step' }), h('dd', { text: c.next_step }))),
      m === 'case' ? null : link('/customer/cases/' + c.id, { class: 'btn btn--secondary' }, 'Follow the investigation', icon('arrowRight', 16)));
  }

  render();

  const refresh = debounce(async () => {
    try {
      snap = await get(endpoint);
      render();
    } catch {
      /* the next event or reconnect will retry */
    }
  }, 120);

  const stream = new LiveStream({
    scope: 'payment:' + paymentId,
    cursor: snap.cursor,
    onEvent: () => refresh(),
    onStatus: (s) => {
      conn.hidden = s === 'live';
      conn.textContent = s === 'polling' ? 'Live updates are paused. Checking for updates every few seconds.' : s === 'reconnecting' ? 'Reconnecting…' : '';
    },
    onResync: async () => {
      snap = await get(endpoint);
      render();
      return snap.cursor;
    },
  }).start();
  return () => stream.stop();
}

export async function mount(app, path, runId) {
  const parts = path.split('/').filter(Boolean); // customer / payment / :id
  const [, section, id] = parts;
  document.title = 'Add money · Wallet';
  try {
    if (section === 'payment' && id) return await mountProgress(app, id, 'payment');
    if (section === 'cases' && id) return await mountProgress(app, id, 'case');
    return await mountForm(app, runId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      app.append(chrome('add', h('div', { class: 'status-page' },
        h('h1', { class: 'status-title', text: 'We could not find that payment' }),
        h('p', { class: 'status-lead', text: 'It may belong to a different customer or no longer exist.' }),
        link('/customer/payment', { class: 'btn btn--primary' }, 'Add money'))));
      return () => {};
    }
    throw e;
  }
}
