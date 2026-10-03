'use strict';
/* TraceFix front end. Vanilla SPA rendered into #main.
   Business logic and API calls are unchanged from the previous UI; this file owns the
   Nexus-styled views (landing, walkthrough, customer portal, investigator desk, judge console). */

const main = document.querySelector('#main');
const feedback = document.querySelector('#feedback');
const navEl = document.querySelector('.nav');
const state = {
  session: null, cases: [], case: null, source: null, sourceRevision: null, busy: false, page: 'home', intake: null,
  faq: { tab: 'model', q: 0 },
  story: { step: 0, paid: false, ai: null, aiError: '', running: false, customer: null, customerError: '', loadingCustomer: false }
};

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => n == null ? 'Not established' : new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(n / 100);
const date = s => s ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(s)) + ' Dhaka' : 'Not saved';
const badge = (text, kind = '') => `<span class="badge ${kind}">${esc(text)}</span>`;
const label = l => l === 'SUPPORTED_BY_PASSAGE' ? badge('Passage supports') : l === 'CONTRADICTED_BY_PASSAGE' ? badge('Passage contradicts', 'danger') : badge('Insufficient text', 'warning');
const statusName = s => ({ OPEN: 'Open', WAITING_EVIDENCE: 'Waiting for evidence', ESCALATED: 'Escalated', REVIEWED: 'Evidence reviewed', OUTCOME_RECORDED: 'Outcome recorded' }[s] || s);
const key = () => crypto.randomUUID();
const future = () => new Date(Date.now() + 86400000 + 21600000).toISOString().slice(0, 16);
const reviewTime = f => f.get('next_review') + '+06:00';
const engineName = e => ({ rules_primary_with_trained_advisory: 'Rules · trained advisory', frozen_encoder_trained_head: 'Trained verifier', rules_fallback: 'Rules fallback · model unavailable', input_limit_abstention: 'Text limit · abstained' }[e] || e);
const IDENTITIES = [['customer', 'Customer 1', 'customer_1'], ['other_customer', 'Customer 2', 'customer_2'], ['staff', 'Investigator 1', 'staff_1'], ['other_staff', 'Investigator 2', 'staff_2'], ['judge', 'Judge', 'judge_1']];
const who = actor => (IDENTITIES.find(i => i[2] === actor) || [0, actor])[1];
const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
const btn = (text, { id = '', cls = '', attrs = '', type = 'button', after = '', before = '' } = {}) =>
  `<button type="${type}" class="btn ${cls}"${id ? ` id="${id}"` : ''}${attrs ? ' ' + attrs : ''}><span class="btn-label">${before ? icon(before) : ''}${text}${after ? icon(after) : ''}</span></button>`;
const link = (text, attrs = '', cls = '') => `<button type="button" class="link ${cls}" ${attrs}>${text}</button>`;
const setLabel = (b, text) => { const l = b.querySelector('.btn-label'); if (l) l.textContent = text; else b.textContent = text; };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function message(text, error = false) {
  clearTimeout(message.t);
  feedback.className = error ? 'error' : '';
  feedback.textContent = '';
  if (!text) return;
  const span = document.createElement('span');
  span.textContent = text;
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'toast-x'; x.setAttribute('aria-label', 'Dismiss message');
  x.innerHTML = icon('x');
  feedback.append(span, x);
  if (!error) message.t = setTimeout(() => message(''), 9000);
}

async function api(path, options = {}) {
  const r = await fetch('/api' + path, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  let data; try { data = await r.json(); } catch { throw Error('The server response could not be read. Your last saved state remains visible.'); }
  if (!r.ok) throw Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail));
  return data;
}

/* ---------- shell: page chrome, nav state, rendering ---------- */
function updateNav() {
  const s = state.session;
  const el = document.querySelector('#nav-session');
  if (el) {
    el.textContent = s ? who(s.actor) : 'Session_Idle';
    el.classList.toggle('live', !!s);
  }
  const current = state.page === 'home' ? '[data-nav="home"]' : state.page === 'story' ? '[data-nav="story"]' :
    s && ['list', 'case', 'intake', 'judge'].includes(state.page) ? `[data-role="${s.role}"]` : null;
  document.querySelectorAll('.nav-links button').forEach(b => b.removeAttribute('aria-current'));
  if (current) document.querySelector('.nav-links ' + current)?.setAttribute('aria-current', 'page');
}
function closeNav() { navEl.classList.remove('open'); document.querySelector('#nav-toggle')?.setAttribute('aria-expanded', 'false'); }
function setSession(s) { state.session = s; updateNav(); }

/* Renders a view. `scroll:false` keeps the reader's place when a view refreshes in place. */
function render(html, { page, scroll = true } = {}) {
  if (page) state.page = page;
  document.body.classList.toggle('is-home', state.page === 'home');
  main.innerHTML = html;
  closeNav();
  updateNav();
  afterRender();
  if (scroll) { window.scrollTo({ top: 0, behavior: 'auto' }); main.focus({ preventScroll: true }); }
}

let revealObserver = null;
function afterRender() {
  // Progress / chart widths are set through the CSSOM (inline style attributes are blocked by the CSP).
  main.querySelectorAll('[data-x]').forEach(el => { el.style.setProperty('--x', el.dataset.x); el.style.setProperty('--y', el.dataset.y); });
  const bars = [...main.querySelectorAll('[data-w],[data-reveal]')];
  if (bars.length) setTimeout(() => bars.forEach(el => { if (el.dataset.w) el.style.setProperty('--w', el.dataset.w); else el.classList.add('on'); }), 120);
  const items = [...main.querySelectorAll('.reveal')];
  if (revealObserver) revealObserver.disconnect();
  if (!items.length) return;
  if (reduceMotion || !('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('active')); return; }
  revealObserver = new IntersectionObserver(entries => {
    let delay = 0;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const t = entry.target;
      setTimeout(() => t.classList.add('active'), delay);
      delay += 90;
      revealObserver.unobserve(t);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  items.forEach(el => revealObserver.observe(el));
}

/* Flashlight glow on panels: delegated so it survives every re-render. */
document.addEventListener('pointermove', e => {
  const card = e.target.closest && e.target.closest('.glow-card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mouse-x', (e.clientX - r.left) + 'px');
  card.style.setProperty('--mouse-y', (e.clientY - r.top) + 'px');
}, { passive: true });

/* ---------- navigation & session ---------- */
async function navigate(page) {
  if (page === 'story') renderStory(); else renderHome();
}
function sessionLine() {
  return `<div class="session-line"><span>Server-issued fixture session: <strong>${esc(who(state.session.actor))}</strong></span><label for="switch-session">Switch fictional identity</label><select id="switch-session">${IDENTITIES.map(([v, t, actor]) => `<option value="${v}" ${actor === state.session.actor ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
}
async function switchRole(role) {
  if (state.busy) return;
  try {
    state.busy = true;
    setSession(await api('/session', { method: 'POST', body: JSON.stringify({ role }) }));
    state.case = null; state.source = null; message('');
    await loadList();
  } catch (e) { message(e.message, true); } finally { state.busy = false; }
}
async function loadList() {
  if (state.session.role === 'judge') { await judge(); return; }
  state.cases = await api('/cases');
  renderList();
}
async function openCase(id) {
  try {
    const c = await api('/cases/' + encodeURIComponent(id));
    state.case = c; state.source = c.evidence?.[0]?.id || null; state.sourceRevision = null;
    renderCase();
  } catch (e) { message(e.message, true); }
}

/* ==========================================================================
   LANDING
   ========================================================================== */
const FAQ = {
  model: { label: 'Model', items: [
    ['What does the model read?', 'It reads one claim against one passage, such as a receipt line or a merchant statement, and says whether the words support the claim, contradict it, or do not settle it. It works in Bangla, Banglish and English.'],
    ['How is it evaluated?', 'On two test suites, both published in the Judge console. The trained verifier reached 0.827 macro F1 on the grouped test; the rules baseline reached 0.972 on the separately authored challenge. Both readings are shown side by side.'],
    ['Why show two readings?', 'Rules and the trained verifier fail in different places. Showing both turns a disagreement into a signal for the investigator instead of a hidden error.'],
    ['Does a receipt count as proof?', 'A receipt is read as a claim and tied to its source. Confirmed cash comes from the merchant record. That separation is how a case avoids closing too early.']
  ] },
  process: { label: 'Process', items: [
    ['What happens when someone reports paying twice?', 'The complaint is saved with a stable reference, an owning investigator and a next review time. Bangla, Banglish and English are all accepted, and a formal receipt is optional.'],
    ['Does a completed QR close the case?', 'No. A confirmed QR payment confirms that QR payment. The second payment, its link to the same purchase, and any repayment are tracked separately.'],
    ['What if new evidence arrives mid-review?', 'The previous analysis is flagged, earlier reviews are marked, and the investigator re-analyzes with the full picture. Originals and corrections are always preserved.'],
    ['What does the customer see?', 'A clear saved status: what is confirmed, what is still open, and who reviews next. No jargon and no model scores.']
  ] },
  safety: { label: 'Safety', items: [
    ['Can TraceFix move money?', 'No. It is built for investigation only. Refunds and repayments stay with the provider, and a repayment request is never shown as returned money.'],
    ['Who makes the final call?', 'A human investigator records the decision with cited sources. Handoffs keep the current owner until the receiving investigator accepts.'],
    ['How does it connect to providers?', 'Through read-only source adapters: exact-reference lookups for payments, invoices and merchant acknowledgements. The demo ships with all three.'],
    ['Is every action traceable?', 'Yes. Every change is versioned and idempotent, sources keep their provenance, and the full audit history exports in the case dossier.']
  ] }
};
function faqArea() {
  const f = state.faq, group = FAQ[f.tab], item = group.items[f.q];
  return `<div class="tabs" role="tablist" aria-label="Question categories">${Object.entries(FAQ).map(([k, g]) => `<button type="button" role="tab" id="faq-tab-${k}" data-faq-tab="${k}" aria-selected="${k === f.tab}" aria-controls="faq-panel">${esc(g.label)}</button>`).join('')}</div>
  <div class="faq-grid mt-48">
    <div class="q-list" role="tablist" aria-orientation="vertical" aria-label="${esc(group.label)} questions">${group.items.map((it, i) => `<button type="button" class="q" role="tab" data-faq-q="${i}" aria-selected="${i === f.q}" aria-controls="faq-panel">${esc(it[0])}${icon(i === f.q ? 'chevron-right' : 'chevron-down')}</button>`).join('')}</div>
    <div class="q-answer panel glow-card" id="faq-panel" role="tabpanel" aria-live="polite"><span class="prompt">&gt;&gt; Reading log entry 0${f.q + 1}…</span><p>${esc(item[1])}</p></div>
  </div>`;
}
/* Real Bangladesh MFS figures. Sources:
   - Bangladesh Bank, Payment Systems Report 2025 (quarterly MFS dispute counts)
   - IPA, Financial Consumer Protection Survey: Bangladesh 2025 (share of DFS users affected) */
const MFS_TREND = ['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Oct – Dec'].map((q, i) => [q, [138082, 204330, 200175, 157018][i]]);
const MFS_METERS = [['Any service problem (12 mo)', 43], ['Fraud attempt (12 mo)', 21], ['Lost money to fraud (ever)', 12], ['Wrong-number transfer (ever)', 11]];
/* Visual language taken from the reference "Live Network Feed" line chart and "Integrity_Level" meters. */
function mfsChart() {
  const nf = n => n.toLocaleString('en-US'), max = Math.max(...MFS_TREND.map(r => r[1])), total = MFS_TREND.reduce((t, r) => t + r[1], 0);
  const X = [12.5, 37.5, 62.5, 87.5], Y = MFS_TREND.map(r => +(100 - r[1] / max * 62).toFixed(1));
  let d = `M${X[0]},${Y[0]}`;
  for (let i = 1; i < X.length; i++) { const m = (X[i - 1] + X[i]) / 2; d += ` C${m},${Y[i - 1]} ${m},${Y[i]} ${X[i]},${Y[i]}`; }
  const peak = MFS_TREND.findIndex(r => r[1] === max);
  return `<div class="chart">
    <div class="chart-group"><div class="trend-head"><h4>MFS disputes logged in 2025 · by quarter</h4><span class="tot">Total <b>${nf(total)}</b></span></div>
      <div class="trend" data-reveal role="img" aria-label="MFS disputes by quarter, 2025: ${MFS_TREND.map(r => `${r[0]} ${nf(r[1])}`).join(', ')}">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="mfs-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4DA3FF"/><stop offset="100%" stop-color="transparent"/></linearGradient></defs>
          <path class="ar" d="${d} L${X.at(-1)},100 L${X[0]},100 Z" fill="url(#mfs-grad)"/><path class="ln" d="${d}" vector-effect="non-scaling-stroke"/></svg>
        ${X.map((x, i) => `<span class="pt${i === peak ? ' hot' : ''}" data-x="${x}%" data-y="${Y[i]}%"></span>`).join('')}
        <div class="tip" data-x="${X[peak]}%" data-y="${Y[peak]}%"><p>Peak · ${esc(MFS_TREND[peak][0])}</p><p class="tv">${nf(max)}</p></div>
      </div>
      <div class="trend-axis">${MFS_TREND.map((r, i) => `<div class="${i === peak ? 'hot' : ''}"><span>${esc(r[0])}</span><b>${nf(r[1])}</b></div>`).join('')}</div></div>
    <div class="chart-group"><h4>DFS users affected · % of users</h4><div class="meters">${MFS_METERS.map(([name, v]) => `<div class="meter"><div class="meter-top"><span>${esc(name)}</span><b>${v}%</b></div><div class="meter-bar" role="img" aria-label="${esc(name)}: ${v}%"><i data-w="${v}%"></i></div></div>`).join('')}</div></div>
  </div><p class="chart-note">Sources: Bangladesh Bank, <em>Payment Systems Report 2025</em> · IPA, <em>Financial Consumer Protection Survey: Bangladesh 2025</em> (~1,000 active DFS users, Dhaka, Chattogram, Sherpur, Bagherat).</p>`;
}
const corners = '<span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>';
function roleCard(ico, title, text, scope, role, cta) {
  return `<article class="role-card panel-soft glow-card reveal">${corners}<div class="deco deco-glow"></div>
    <div class="role-top"><div class="role-ico">${icon(ico, 'icon-lg')}</div><span class="live-pill"><i></i>Active</span></div>
    <h3>${title}</h3><p>${text}</p>
    <ul class="role-scope">${scope.map(s => `<li>${icon('check')}<span>${s}</span></li>`).join('')}</ul>
    ${btn(cta, { cls: 'btn-block', attrs: `data-role="${role}"`, after: 'arrow-right' })}</article>`;
}
function renderHome() {
  state.page = 'home';
  render(`<div class="page-enter">
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <div class="hero-accent"><span class="tag"><span class="tag-solid">Track_06</span><span>transaction desk online</span></span>
        <div class="barcode" aria-hidden="true">${[1, 2, 0, 3, 1].map(w => `<i class="w${w}"></i>`).join('')}</div></div>
      <div class="hero-pre">Investigation sequence activated</div>
      <h1 id="hero-title">One purchase.<br>Every source<br>in view.</h1>
      <p class="hero-lede">Paid twice or stuck waiting for a transfer? TraceFix reconstructs bank, wallet, QR, cash and receipt records. Follow the saved investigation, review its evidence, then approve an eligible sandbox repair or assign an owned follow-up.</p>
      <div class="hero-cta"><a class="btn" href="/customer">Start a payment ${icon('arrow-right')}</a><a class="btn ghost" href="/operations">Open AI investigation desk</a></div>
    </div>
    <div class="hero-pod">
      <div class="pod-glow"></div><div class="pod-ring a"></div><div class="pod-ring b"></div>
      <div class="pod-fallback" id="pod-fallback">${icon('qr', 'icon-xl')}</div>
      <model-viewer id="upay-pod" src="/static/models/upay_pod.glb" alt="Interactive 3D model of a UPAY QR scanner pod" interaction-prompt="none" shadow-intensity="0" exposure="1.1" camera-orbit="290deg 72deg auto" field-of-view="22deg" camera-controls disable-zoom disable-pan touch-action="pan-y"></model-viewer>
      <div class="pod-caption">${icon('scan')}<span>UPAY QR scanner pod // drag to rotate</span></div>
    </div>
  </section>

  <section class="band mt-48" aria-labelledby="stats-title">
    <div class="band-inner center">
      <div class="sec-head center reveal"><span class="tag">Sys_Brief</span>
        <h2 id="stats-title">Millions pay by mobile. When it goes wrong, nobody sees the full picture.</h2>
        <p>TraceFix puts QR, cash, receipts and merchant records into one investigation, in Bangla and English.</p></div>
      <div class="fact-row">
        <div class="reveal"><p class="fact-num">699,605</p><p class="fact-cap">MFS disputes logged in 2025<br><small>Bangladesh Bank</small></p></div>
        <div class="reveal"><div class="partner-strip"><img src="/static/img/upay-logo-dark.png" alt="UPAY" width="54" height="54"><span>${icon('globe')}250M MFS accounts</span><span>${icon('network')}2.0M agents</span></div></div>
        <div class="reveal"><p class="fact-num">61.9%</p><p class="fact-cap">Of MFS complainants got no solution<br><small>TIB Bangladesh, 2025</small></p></div>
      </div>
    </div>
  </section>

  <section class="specs" aria-labelledby="specs-title"><div class="band-inner">
    <div class="sec-head bar reveal"><span class="tag">System_Specs</span>
      <div class="row"><h2 id="specs-title">Evidence, kept in order</h2><p>Every claim cites a preserved source. Every outcome waits for a human.</p></div></div>
    <div class="bento">
      <article class="bento-card c5 panel glow-card reveal"><div class="deco deco-glow"></div>
        <h3>Two payments, kept apart</h3><p>A completed QR record never settles the cash claim. Each tender is tracked with its own authority.</p>
        <div class="swap" aria-hidden="true">
          <div class="swap-row"><div class="who"><span>${icon('qr')}</span><div>QR · ৳500<span class="swap-state ok">Confirmed in provider record</span></div></div><span class="amt">PUR-103</span></div>
          <div class="swap-mid">${icon('arrow-up-down')}</div>
          <div class="swap-row dim"><div class="who"><span>${icon('banknote')}</span><div>Cash · ৳500<span class="swap-state claim">Reported, not confirmed</span></div></div><span class="amt">PUR-103</span></div>
        </div>
        ${link(`Follow a case${icon('arrow-right')}`, 'data-nav="story"')}
      </article>
      <article class="bento-card c7 panel glow-card reveal"><div class="deco deco-glow"></div>
        <h3>The problem, measured</h3><p>Mobile money moves over Tk 1.5 trillion a month across 250 million accounts. When a payment goes wrong, people are left chasing agents and hotlines.</p>
        ${mfsChart()}
      </article>
      <article class="bento-card c7 panel glow-card reveal">
        <div class="bento-icon">${icon('globe', 'icon-xl')}</div>
        <div><h3>Read-only source checks</h3><p>Provider, invoice and merchant records are verified without touching a single taka. A check adds evidence; it never moves money.</p></div>
      </article>
      <article class="bento-card c5 panel glow-card reveal">
        <div><h3>Human review owns the outcome</h3><p>Analysis refreshes when evidence changes. Every review cites its sources and records who decided.</p></div>
        <div class="orbit deco" aria-hidden="true"><div><div><i></i></div></div></div>
      </article>
    </div></div>
  </section>

  <section class="dossier-band" aria-labelledby="dossier-title">
    <div class="dossier panel">
      <div class="dossier-copy reveal"><span class="eyebrow">Dossier_Export</span>
        <h2 id="dossier-title">Versioned case dossier</h2>
        <div class="feature-pair">
          <div><div class="ico">${icon('lock')}</div><p>Originals are immutable. Corrections are preserved as numbered revisions.</p></div>
          <div><div class="ico">${icon('shield-check')}</div><p>Every assertion keeps its provenance, from provider record to customer claim.</p></div>
        </div>
        ${btn('Open investigator desk', { attrs: 'data-role="staff"', after: 'arrow-right' })}
      </div>
      <div class="dossier-card-wrap reveal"><div class="id-card" aria-label="Sample dossier card for case TF-260003">
        <div class="id-card-top"><span>Case_ID<br>TF-260003</span>${icon('rss', 'icon-lg')}</div>
        <h3>TraceFix</h3>
        <div class="lv"><p>Status</p><p>Open · cash unverified</p></div>
        <div class="barcode" aria-hidden="true">${[1, 2, 0, 3, 1, 2, 0, 1, 4, 1, 2, 0].map(w => `<i class="w${w}"></i>`).join('')}</div>
        <div class="id-card-foot"><span>Investigator 1</span><i></i></div>
      </div></div>
    </div>
  </section>

  <section class="faq" aria-labelledby="faq-title">
    <div class="sec-head center reveal"><span class="tag">Data_Logs</span><h2 id="faq-title">Network logs</h2></div>
    <div id="faq-area">${faqArea()}</div>
  </section>

  <section class="cta" aria-labelledby="cta-title"><div class="cta-inner">
    <h2 id="cta-title" class="reveal">Report a second payment</h2>
    <div class="cta-diagram" aria-hidden="true"><div class="line"></div><div class="node l"><i></i></div><div class="core"><i></i></div><div class="node r">${icon('menu')}</div></div>
    <form id="ref-form" class="reveal"><label for="ref-input" class="sr-only">Exact QR payment reference</label>
      <div class="input-group"><input id="ref-input" name="ref" type="text" maxlength="100" autocomplete="off" placeholder="ENTER QR REFERENCE (E.G. QR-DEMO-003)…">
      ${btn('Start report', { type: 'submit' })}</div>
      <span class="help">Opens the customer portal and starts your report. No reference? Leave it blank.</span></form>
  </div></section>

  <section class="terminals" aria-labelledby="roles-title"><div class="terminals-inner">
    <div class="sec-head center reveal"><span class="tag">Network_Topology</span><h2 id="roles-title">Three desks, one case</h2>
      <p>Each role sees only what it should. Switch between customer, investigator and judge views at any time.</p></div>
    <div class="role-grid">
      ${roleCard('user', 'Customer_Portal', 'Report paying twice and read the saved status. No model scores, no jargon.', ['Report a second payment', 'See only your own cases', 'Add details or a receipt'], 'customer', 'Enter as Customer 1')}
      ${roleCard('search', 'Investigator_Desk', 'Reconstruct the purchase from every source, run the analysis and keep the next step owned.', ['Claim / evidence matrix', 'Source checks, handoffs, reviews', 'Export a versioned dossier'], 'staff', 'Open the desk')}
      ${roleCard('bar-chart', 'Judge_Console', 'Open four curated journeys and inspect the actual model identity and saved results.', ['Four curated end-to-end journeys', 'Model training and metrics', 'Step through each source response'], 'judge', 'Open the console')}
    </div>
    <div class="center mt-48 reveal"><div class="status-pill">${icon('shield-check')}<span>Synthetic payments · evidence checks · approved sandbox corrections</span><span class="ticks" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div></div>
  </div></section>
</div>`, { page: 'home' });
  loadPod();
}
function loadPod() {
  if (!customElements.get('model-viewer') && !document.querySelector('script[data-model-viewer]')) {
    const s = document.createElement('script');
    s.type = 'module'; s.src = '/static/vendor/model-viewer.min.js?v=3'; s.dataset.modelViewer = '1';
    document.head.appendChild(s);
  }
  const pod = document.querySelector('#upay-pod');
  pod?.addEventListener('load', () => document.querySelector('#pod-fallback')?.setAttribute('hidden', ''));
}

/* ==========================================================================
   STORY (how it works)
   ========================================================================== */
const STORY = [
  { rail: 'Start', who: 'Everyone', title: 'One shop purchase. Two payments.', line: 'Follow the scene left to right. The model only appears when someone has to read the wording of a receipt or record.' },
  { rail: 'Pay', who: 'Customer', title: 'The QR payment never confirms', line: 'At Rafi Store the phone shows a real code for QR-DEMO-003. Paying it leaves the result unclear.' },
  { rail: 'Report', who: 'Customer', title: 'Cash for the same purchase', line: 'The customer pays ৳500 cash, then files one complaint. That file is already saved as TF-260003.' },
  { rail: 'Desk', who: 'Investigator', title: 'Two facts stay separate', line: 'The QR record can be confirmed. The cash claim cannot be confirmed from a customer upload alone.' },
  { rail: 'Model', who: 'Model', title: 'Where the AI helps', line: 'It reads one claim against one passage. It does not prove cash, approve a refund, or close the case.' },
  { rail: 'Status', who: 'Customer', title: 'The customer sees the saved step', line: 'They see what is confirmed, what is still missing, and who reviews next. They do not see model scores.' }
];
const say = code => code === 'SUPPORTED_BY_PASSAGE' ? 'The words support the claim.' : code === 'CONTRADICTED_BY_PASSAGE' ? 'The words contradict the claim.' : 'The words do not settle the claim.';
const phone = inner => `<div class="phone"><div class="phone-screen">${inner}</div></div>`;
function storyPair(c, claimId, test) {
  const claim = c.analysis.claims.find(x => x.id === claimId);
  const l = claim.links.find(test) || claim.links[0];
  return { claim: claim.text, excerpt: l.excerpt, trained: l.learned_label || l.label, used: l.label, source: l.source_status, engine: l.engine };
}
function clip(text, n = 140) { const s = String(text || ''); return s.length > n ? s.slice(0, n).trim() + '…' : s; }
function cashPair(c) {
  if (!c?.analysis) return null;
  return storyPair(c, 'cash', l => l.excerpt.includes('গ্রহণ') || /cash payment of|was received/i.test(l.excerpt));
}
function lifeScene(c, { highlight = 'all' } = {}) {
  const ref = c?.qr_reference || 'QR-DEMO-003';
  const amount = money(c?.reported_amount_minor ?? 50000);
  const cash = cashPair(c);
  const qrImg = `<img class="qr tiny" src="/static/qr-demo-003.svg" alt="QR code for ${esc(ref)}">`;
  const next = (c?.facts?.requirements || [])[0] || 'Ask the merchant whether cash was taken for this purchase.';
  const reading = cash ? say(cash.trained) : 'Waiting for a live read';
  const desk = cash ? say(cash.used) : 'Not shown yet';
  const source = cash ? cash.source : 'supplied / unverified';
  const excerpt = cash ? cash.excerpt : 'নগদ ৫০০ টাকা গ্রহণ করা হয়েছে। একই কেনাকাটার রসিদ।';
  const on = k => highlight === 'all' || highlight === k ? 'on' : '';
  return `<section class="life" aria-label="Real-life paid-twice scene">
  <article class="beat ${on('pay')}"><div class="beat-visual scene-shop"><div class="scene-tag">01 · Shop</div><div class="pay-top"><strong>Rafi Store</strong><span>Phone</span></div>${qrImg}<p class="pay-status">Processing</p><p>${esc(amount)} · ${esc(ref)}</p></div><p>QR is attempted. The phone never says success or failure.</p></article>
  <article class="beat ${on('cash')}"><div class="beat-visual cash-visual"><div class="scene-tag">02 · Counter</div><strong>${esc(amount)}</strong><span>Cash for the same purchase</span><p class="bangla-line">আমি QR এর পরে নগদ দিয়েছি</p></div><p>The customer pays again so they can leave with the goods.</p></article>
  <article class="beat beat-ai ${on('ai')}"><div class="beat-visual"><div class="scene-tag">03 · Model helps here</div><p class="claim-chip">Claim: a cash payment was received</p><blockquote>${esc(clip(excerpt, 160))}</blockquote><p><strong>Trained model.</strong> ${esc(reading)}</p><p><strong>Shown on the desk.</strong> ${esc(desk)}</p><p><strong>Source, without the model.</strong> ${esc(source)}</p></div><p>The AI only judges the wording. It cannot turn this receipt into confirmed cash.</p></article>
  <article class="beat ${on('impact')}"><div class="beat-visual impact-visual"><div class="scene-tag">04 · Impact</div><strong>Complaint stays open</strong><p>${esc(next)}</p><p class="impact-no">No refund from QR success. No refund from the receipt.</p></div><p>The investigator still owns the next human step.</p></article>
 </section>`;
}
function aiHelpMap(c) {
  const cash = cashPair(c);
  const flow = [
    ['Claim', 'A cash payment was received.'],
    ['Passage', clip(cash?.excerpt || 'নগদ ৫০০ টাকা গ্রহণ করা হয়েছে। একই কেনাকাটার রসিদ।', 90)],
    ['AI reading', cash ? say(cash.trained) : 'Run the model to see the live answer'],
    ['Impact', cash ? 'Cash stays unverified. Ask the merchant.' : 'Impact appears after the live read']
  ];
  return `<section class="ai-map panel" aria-label="Where the AI helps"><div class="ai-map-head"><span>Where the AI helps</span><h2>One claim. One passage. One reading.</h2><p>It does not decide money movement. It does not replace the investigator.</p></div><div class="ai-flow">${flow.map(([k, v], i) => `<article><span>0${i + 1} · ${esc(k)}</span><p>${esc(v)}</p></article>${i < 3 ? `<div class="ai-arrow" aria-hidden="true">${icon('arrow-right', 'icon-lg')}</div>` : ''}`).join('')}</div>
  <div class="impact-row"><article><span>Without this reading</span><h2>Easy to close too early</h2><p>Someone sees a completed QR later and treats the case as done. Or they treat a Bangla receipt as proof that cash moved.</p></article><article><span>With TraceFix</span><h2>The second payment stays a question</h2><p>${cash ? `The model said: ${say(cash.trained)} The desk shows: ${say(cash.used)} The source stays ${cash.source}. The next step is still a human request.` : 'Run the model on TF-260003. The live answer will fill this panel.'}</p></article></div></section>`;
}
function renderStory() {
  state.page = 'story';
  const s = state.story, step = STORY[s.step];
  const rail = STORY.map((item, i) => `<button type="button" class="rail-step ${i === s.step ? 'current' : i < s.step ? 'done' : ''}" data-story-step="${i}" ${i === s.step ? 'aria-current="step"' : ''}><span>0${i + 1}</span>${esc(item.rail)}</button>`).join('');
  let body = '';
  if (s.step === 0) body = `${lifeScene(s.ai, { highlight: 'all' })}<div class="cast">${[
    ['Customer', 'Pays at the shop, reports paying twice, and later reads only the saved status.'],
    ['Investigator', 'Owns the case, keeps QR and cash separate, and saves the next human step.'],
    ['Model', 'Reads a claim against a passage. Says support, contradiction, or not enough.']
  ].map(([name, job], i) => `<article class="cast-card panel glow-card"><span>Role 0${i + 1}</span><h2>${name}</h2><p>${job}</p></article>`).join('')}</div><p class="help">Nothing here moves money. The QR code, the shop, and the case are synthetic.</p>`;
  if (s.step === 1) body = `${lifeScene(null, { highlight: 'pay' })}<div class="stage">${phone(s.paid ? `<div class="pay-top"><strong>Rafi Store</strong><span>upay · fictional</span></div><div class="pay-amount">৳500</div><p class="pay-status">Processing</p><p>The shop app has not said success or failure.</p><div class="note warning">Do not treat this screen as a failed payment, and do not pay again only because the response disappeared.</div>` : `<div class="pay-top"><strong>Rafi Store</strong><span>Show this code</span></div><img class="qr" src="/static/qr-demo-003.svg" alt="QR code encoding the fictional payment reference QR-DEMO-003" width="148" height="148"><p class="qr-ref">QR-DEMO-003</p><p>One purchase · PUR-103 · ৳500</p>${btn('Pay ৳500', { id: 'phone-pay' })}`)}<div class="stage-copy"><p>${s.paid ? 'The customer is stuck on an unclear result. The next step is their report, not a second QR payment.' : 'Press Pay on the phone. The next arrow continues only after that payment screen turns unclear.'}</p></div></div>`;
  if (s.step === 2) body = `${lifeScene(null, { highlight: 'cash' })}<div class="stage">${phone(`<div class="pay-top"><strong>TraceFix</strong><span>Customer</span></div><p class="phone-kicker">Report paying twice</p><label>QR reference</label><div class="fake-input">QR-DEMO-003</div><p class="phone-ok">Your payment · PUR-103 · ৳500</p><label>Second payment</label><div class="fake-input">Cash · ৳500</div><label>What happened</label><div class="fake-text">আমি QR এর পরে একই কেনাকাটার জন্য নগদ টাকা দিয়েছি।</div><div class="phone-saved">Saved as TF-260003 · Investigator 1 owns the review</div>`)}<div class="stage-copy"><p>The phone is showing the complaint already stored for Customer 1. Filing it does not refund anyone.</p>${btn('Open this complaint as the customer', { id: 'open-story-customer', cls: 'ghost', after: 'arrow-right' })}</div></div>`;
  if (s.step === 3) body = `${lifeScene(s.ai, { highlight: 'impact' })}<div class="split-facts"><article class="panel glow-card"><span>From the QR record</span><h2>৳500 posted</h2><p>Simulated provider record for QR-DEMO-003 and purchase PUR-103. This confirms that QR payment only.</p>${badge('Confirmed in the mock source')}</article><article class="panel glow-card"><span>From the customer</span><h2>৳500 cash claimed</h2><p>আমি QR এর পরে একই কেনাকাটার জন্য নগদ টাকা দিয়েছি। A receipt transcript exists. The upload does not make the cash confirmed.</p>${badge('Reported, not confirmed', 'warning')}</article></div><p class="help">The investigator keeps those two facts apart, then asks the model to read the wording.</p>`;
  if (s.step === 4) {
    if (s.running) body = `${lifeScene(null, { highlight: 'ai' })}<p class="note">The trained model is reading the saved passages for TF-260003. The first read can take several seconds.</p>`;
    else if (!s.ai) body = `${lifeScene(null, { highlight: 'ai' })}${aiHelpMap(null)}${btn('Run the model on TF-260003', { id: 'run-model' })}<p class="help">${esc(s.aiError)}</p>`;
    else body = `${lifeScene(s.ai, { highlight: 'ai' })}${aiHelpMap(s.ai)}${btn('Open this scene on the investigator desk', { id: 'open-story-case', cls: 'ghost', after: 'arrow-right' })}`;
  }
  if (s.step === 5) {
    if (s.loadingCustomer) body = '<p class="note">Loading the customer’s saved status.</p>';
    else if (s.customerError) body = `<p class="error">${esc(s.customerError)}</p>${btn('Try the customer view again', { id: 'retry-customer' })}`;
    else if (s.customer) {
      const c = s.customer;
      body = `${lifeScene(s.ai, { highlight: 'impact' })}<div class="stage">${phone(`<div class="pay-top"><strong>TraceFix</strong><span>${esc(c.reference)}</span></div><p class="phone-kicker">Saved status</p><p><strong>Confirmed</strong></p><ul>${c.confirmed_facts.map(f => `<li>${esc(f)}</li>`).join('') || '<li>Nothing financial is confirmed yet.</li>'}</ul><p><strong>Still open</strong></p><ul>${c.unresolved.map(f => `<li>${esc(f)}</li>`).join('') || '<li>Waiting for investigator review.</li>'}</ul><div class="phone-saved">${esc(c.next_step)}</div>`)}<div class="stage-copy"><p>This is the only view the customer gets. A review time is an investigation step, not a promise that money will return.</p>${btn('Continue in the customer portal', { id: 'open-story-customer', after: 'arrow-right' })}</div></div>`;
    } else body = '<p class="note">Loading the customer’s saved status.</p>';
  }
  const nextLabel = s.step === 1 && !s.paid ? 'Pay on the phone first' : s.step === 5 ? 'Open the customer case' : 'Next step';
  render(`<div class="page story page-enter"><span class="eyebrow">How a paid-twice case moves</span><div class="story-rail" role="group" aria-label="Story steps">${rail}</div><p class="role-now">Role for this step: <strong>${esc(step.who)}</strong></p><h1>${esc(step.title)}</h1><p class="story-line">${esc(step.line)}</p>${body}<div class="story-nav">${btn('Back', { id: 'story-back', cls: 'ghost', before: 'arrow-left', attrs: s.step === 0 && !s.paid ? 'disabled' : '' })}<span>Step ${s.step + 1} of ${STORY.length}</span>${btn(nextLabel, { id: 'story-next', after: 'arrow-right', attrs: s.step === 1 && !s.paid ? 'disabled' : '' })}</div></div>`, { page: 'story' });
  if (s.step === 5 && !s.customer && !s.loadingCustomer && !s.customerError) loadStoryCustomer();
}
async function runStoryModel() {
  if (state.story.running) return;
  state.story.running = true; state.story.aiError = ''; renderStory();
  try {
    await api('/session', { method: 'POST', body: JSON.stringify({ role: 'staff' }) });
    setSession(await api('/session'));
    let c = await api('/cases/case_3');
    if (!c.analysis || !c.analysis_fresh) c = await api('/cases/case_3/analyze', { method: 'POST', headers: { 'Idempotency-Key': key() }, body: JSON.stringify({ version: c.version }) });
    state.story.ai = c;
  } catch (e) { state.story.aiError = e.message; }
  finally { state.story.running = false; renderStory(); }
}
async function loadStoryCustomer() {
  state.story.loadingCustomer = true;
  try {
    await api('/session', { method: 'POST', body: JSON.stringify({ role: 'customer' }) });
    setSession(await api('/session'));
    state.story.customer = await api('/cases/case_3');
    state.story.customerError = '';
  } catch (e) { state.story.customerError = e.message; }
  finally { state.story.loadingCustomer = false; if (state.page === 'story' && state.story.step === 5) renderStory(); }
}
async function storyNext() { const s = state.story; if (s.step === 1 && !s.paid) return; if (s.step < 5) { s.step += 1; renderStory(); return; } await openStoryCustomer(); }
function storyBack() { const s = state.story; if (s.step === 1 && s.paid) { s.paid = false; renderStory(); return; } if (s.step > 0) { s.step -= 1; renderStory(); } }
async function openStoryCustomer() { await switchRole('customer'); await openCase('case_3'); }
async function openStoryCase() { await switchRole('staff'); await openCase('case_3'); }

/* ==========================================================================
   CUSTOMER PORTAL + INVESTIGATOR INBOX
   ========================================================================== */
function renderList() {
  const staff = state.session.role === 'staff', rows = state.cases;
  const head = `<div class="page-head"><div><span class="eyebrow">${staff ? 'Operations / Inbox' : 'Customer / Portal'}</span><h1>${staff ? 'Investigations in view' : 'Your saved cases'}</h1><p>${staff ? 'Review the evidence, resolve missing questions, and keep the next step owned.' : 'Your complaint stays open while the second payment is investigated.'}</p></div><div class="actions">${!staff ? btn('Report paying twice', { id: 'new-case', before: 'plus' }) : ''}${btn('Refresh saved status', { id: 'refresh', cls: 'ghost', before: 'refresh' })}</div></div>`;
  const body = staff
    ? `<div class="stats"><div class="stat"><strong>${rows.length}</strong><span>Saved cases</span></div><div class="stat"><strong>${rows.filter(c => c.owner === state.session.actor).length}</strong><span>Owned by you</span></div><div class="stat"><strong>${rows.filter(c => c.overdue).length}</strong><span>Overdue reviews</span></div></div>
      <div class="table-wrap"><table><thead><tr><th>Case / purchase</th><th>Status</th><th>Owner</th><th>Unresolved question</th><th>Analysis</th><th>Next review</th></tr></thead><tbody>${rows.map(c => `<tr><td>${link(esc(c.reference), `data-case="${c.id}"`, 'case-link')}<small>${esc(c.purchase_id)} · ${money(c.reported_amount_minor)} reported</small></td><td>${badge(statusName(c.status), c.status === 'ESCALATED' ? 'warning' : 'neutral')}</td><td>${esc(who(c.owner))}</td><td>${esc(c.facts.requirements[0] || 'Evidence assembled; human review pending')}<small>${c.facts.split_tender ? 'Split tender: total does not imply duplicate payment.' : ''}</small></td><td>${badge(c.analysis_fresh ? 'Current' : c.analysis ? 'Stale' : 'Not run', c.analysis_fresh ? '' : 'warning')}</td><td>${date(c.next_review)}<small>${c.overdue ? 'Review overdue' : 'Saved follow-up'}</small></td></tr>`).join('')}</tbody></table></div>`
    : `<div class="case-list">${rows.map(c => `<article class="case-row panel glow-card"><div><h3>${esc(c.reference)} ${badge(statusName(c.status), 'neutral')}</h3><p>${money(c.reported_amount_minor)} claimed · ${esc(who(c.owner))}</p><p>Next review: ${date(c.next_review)}</p></div>${btn('View saved case', { cls: 'ghost', attrs: `data-case="${c.id}"`, after: 'arrow-right' })}</article>`).join('') || '<p class="empty">No cases for this fictional customer yet.</p>'}</div>`;
  render(`<div class="page page-enter">${sessionLine()}${head}${body}</div>`, { page: 'list' });
}
function renderCase(keepScroll = false) { state.session.role === 'customer' ? customerCase(keepScroll) : staffCase(keepScroll); }
function customerCase(keepScroll) {
  const c = state.case;
  render(`<div class="page page-narrow page-enter">${sessionLine()}${link(`${icon('arrow-left')} Your cases`, 'id="back-list"', 'plain back')}
  <section class="life customer-life" aria-label="What the customer can see"><article class="beat on"><div class="beat-visual"><div class="pay-top"><strong>Your phone</strong></div><p class="pay-status">QR unclear</p><p>${esc(c.reference)}</p></div><p>You paid, and the result was not clear.</p></article><article class="beat on"><div class="beat-visual cash-visual"><strong>${money(c.reported_amount_minor)}</strong><span>Reported again</span></div><p>You said this purchase was paid a second time.</p></article><article class="beat on"><div class="beat-visual impact-visual"><div class="scene-tag">Saved for you</div><strong>${c.confirmed_facts.length ? 'QR is confirmed. The complaint is not.' : 'Still being checked.'}</strong></div><p>You do not see the model. You see this status.</p></article></section>
  <div class="page-head mt-24"><div><span class="eyebrow">Saved investigation / ${esc(c.reference)}</span><h1>Your complaint is being reviewed</h1><p>${money(c.reported_amount_minor)} reported · ${badge(statusName(c.status), 'neutral')}</p></div>${btn('Refresh saved status', { id: 'refresh', cls: 'ghost', before: 'refresh' })}</div>
  <div class="note">A review time is a saved investigation step. It is not a repayment promise.</div>
  <div class="customer-facts"><div class="fact-line"><span class="fact-label">Confirmed in demo</span><ul>${c.confirmed_facts.map(f => `<li>${esc(f)}</li>`).join('') || '<li>No financial facts confirmed yet.</li>'}</ul></div><div class="fact-line"><span class="fact-label">Still unresolved</span><ul>${c.unresolved.map(f => `<li>${esc(f)}</li>`).join('') || '<li>The assembled evidence awaits a human review; no reimbursement is executed.</li>'}</ul></div><div class="fact-line"><span class="fact-label">Next saved step</span><div>${esc(c.next_step)}<span class="help">Investigator: ${esc(who(c.owner))} · Review: ${date(c.next_review)}</span></div></div></div>
  <div class="actions">${btn('Add details / ask for review', { id: 'add-details' })}${btn('Add a receipt', { id: 'upload-document', cls: 'ghost' })}</div>
  <h2 class="section-title">Saved updates</h2><ol class="notifications">${c.notifications.slice().reverse().map(n => `<li><time>${date(n.at)}</time>${esc(n.text)}</li>`).join('')}</ol></div>`, { page: 'case', scroll: !keepScroll });
}
function claimMatrix(c) {
  const a = c.analysis;
  if (!a) return c.evidence.map(e => `<button type="button" class="evidence-link" data-source="${e.id}"><span class="snippet">${esc(e.kind)}<small>${esc(e.id)} · ${esc(e.authority)}</small></span><span class="verdict">${badge('Inspect source', 'neutral')}</span></button>`).join('');
  return a.claims.map(cl => `<article class="claim"><h3>${esc(cl.text)}</h3>${cl.links.map(l => `<button type="button" class="evidence-link ${l.evidence_id === state.source ? 'selected' : ''}" data-source="${l.evidence_id}" data-revision="${l.transcript_version}"><span class="snippet">${esc(l.excerpt)}<small>${esc(l.evidence_id)} · transcript v${l.transcript_version} · ${esc(l.source_status)}</small>${l.mismatches.length ? `<small class="error">${esc(l.mismatches.join(' '))}</small>` : ''}</span><span class="verdict">${label(l.label)}<small>${esc(engineName(l.engine))}</small>${l.learned_label ? `<small>Trained: ${esc(l.learned_label.replaceAll('_', ' '))}</small>` : ''}</span></button>`).join('')}</article>`).join('');
}
function staffCase(keepScroll) {
  const c = state.case, f = c.facts, a = c.analysis;
  render(`<div class="page page-enter">${sessionLine()}${link(`${icon('arrow-left')} Investigator inbox`, 'id="back-list"', 'plain back')}
  <div class="page-head mt-24"><div><span class="eyebrow">Investigation / ${esc(c.reference)} · Evidence v${c.evidence_version}</span><h1>A purchase, reconstructed</h1><p>${esc(c.purchase_id)} · ${money(c.reported_amount_minor)} customer-reported · ${badge(statusName(c.status), 'neutral')}</p></div><div class="actions">${btn(a ? 'Analyze current evidence' : 'Run evidence analysis', { id: 'analyze' })}${btn('Refresh', { id: 'refresh', cls: 'ghost', before: 'refresh' })}</div></div>
  <div class="note ${!c.analysis_fresh && a ? 'warning' : ''}">${a ? (c.analysis_fresh ? 'Analysis uses the current evidence snapshot.' : 'What changed: evidence or assessment rules changed, so the previous analysis is stale. Analyze again before recording a review.') : 'Analysis not yet run. Financial source facts below use explicit fixture capabilities.'} Owner ${esc(who(c.owner))} · Next review ${date(c.next_review)}.</div>
  <div class="mt-24">${lifeScene(c)}</div>
  <div class="stats"><div class="stat"><strong>${money(f.recorded_paid_minor)}</strong><span>Recorded tender</span></div><div class="stat"><strong>${money(f.recorded_repaid_minor)}</strong><span>Recorded repayment</span></div><div class="stat"><strong>${money(f.purchase_total_minor)}</strong><span>Purchase total</span></div></div>
  ${f.split_tender ? '<div class="note warning">Split tender fits the purchase total. Multiple payment methods alone do not establish excess payment.</div>' : ''}
  <div class="workspace"><section class="work-main"><h2 class="section-title">Claim / evidence matrix</h2><p class="help">Passage interpretation is advisory. Source authority and exact-reference checks are separate.</p><div class="matrix">${claimMatrix(c)}</div>
  ${a ? `<details><summary>Actual model identity and limitations</summary><pre>${esc(JSON.stringify(a.model, null, 2))}</pre></details>` : ''}
  <h2 class="section-title">Unresolved requirements / rules</h2>${f.requirements.map(q => `<div class="request"><p>${esc(q)}</p>${link('Save an evidence request →', `data-question="${esc(q)}"`)}</div>`).join('') || '<p class="help">No rule-detected missing source. An investigator must still review the complete case.</p>'}
  ${c.tasks.filter(t => t.status === 'OPEN').map(t => `<div class="request"><strong>Saved request</strong><p>${esc(t.question)}</p><small>Owner ${esc(who(t.owner))} · ${date(t.next_review)}</small><br>${link('Record evidence response →', `data-resolve="${t.id}"`)}</div>`).join('')}
  <h2 class="section-title">Source timeline</h2><div class="timeline">${c.evidence.map(e => `<div class="event">${link(esc(e.kind), `data-source="${e.id}"`)}<p>${date(e.received_at)} · ${esc(e.verification)}</p></div>`).join('')}${c.checks.map(ch => `<div class="event"><strong>${esc(ch.kind)} check · ${esc(ch.state)}</strong><p>${esc(ch.result)}</p><small>${date(ch.as_of)} · ${esc(ch.scope)}</small></div>`).join('')}</div></section>
  <aside class="source-panel panel" id="source-panel" aria-label="Preserved evidence source"></aside></div>
  <div class="action-strip">${[
    ['add-evidence', 'Add supplied evidence'], ['correct-claim', 'Correct a claim'], !c.qr_reference && ['link-payment', 'Link an owned payment'], ['upload-document', 'Upload document'],
    ['check-source', 'Read-only source check'], ['request-evidence', 'Request evidence'], ['schedule-review', 'Schedule review'], ['handoff', 'Escalate / hand off']
  ].filter(Boolean).map(([id, t]) => btn(t, { id, cls: 'ghost btn-sm' })).join('')}${c.handoffs.some(h => h.status === 'REQUESTED' && h.destination === state.session.actor) ? btn('Accept handoff', { id: 'acknowledge', cls: 'btn-sm' }) : ''}${btn('Record human review', { id: 'review-decision', cls: 'ghost btn-sm' })}${btn('Export dossier', { id: 'export', cls: 'ghost btn-sm', before: 'download' })}</div>
  <details><summary>Saved handoffs, human review and audit history</summary><pre>${esc(JSON.stringify({ handoffs: c.handoffs, decisions: c.decisions, audit: c.audit }, null, 2))}</pre></details></div>`, { page: 'case', scroll: !keepScroll });
  renderSource();
}
function renderSource() {
  const panel = document.querySelector('#source-panel'); if (!panel) return;
  const e = state.case.evidence.find(e => e.id === state.source);
  if (!e) { panel.innerHTML = '<p>Select a passage to inspect its preserved source.</p>'; return; }
  const revision = e.revisions.find(r => r.version === state.sourceRevision) || e.revisions.at(-1);
  panel.innerHTML = `<span class="eyebrow">Preserved source / v${revision.version}${revision.version !== e.revisions.at(-1).version ? ' · historical citation' : ''}</span><h2>${esc(e.kind.replaceAll('_', ' '))}</h2>${badge(e.authority, e.kind.startsWith('mock_') ? '' : 'warning')}<span class="help">${esc(e.id)}</span>${e.blob && e.blob.mime.startsWith('image/') ? `<img alt="Customer-supplied original receipt, unverified" src="/api/evidence/${e.id}/file">` : ''}<div class="source-text">${esc(revision.text)}</div><dl class="source-meta"><dt>Supplied by</dt><dd>${esc(e.supplied_by)}</dd><dt>Verification</dt><dd>${esc(e.verification)}</dd><dt>Reference</dt><dd>${esc(e.reference || 'Not supplied')}</dd><dt>Purchase</dt><dd>${esc(e.purchase_id || 'Unlinked')}</dd><dt>Scope</dt><dd>${esc(e.scope)}</dd><dt>As of</dt><dd>${date(e.as_of)}</dd><dt>Original hash</dt><dd>${esc(e.original_hash.slice(0, 22))}…</dd></dl>${!e.kind.startsWith('mock_') ? btn('Correct transcript / reference', { id: 'correct-source', cls: 'ghost btn-sm' }) : '<p class="help">Mock records are immutable. Add a conflicting assertion rather than rewriting a source.</p>'}<details><summary>Immutable original and correction history</summary><pre>${esc(e.original)}</pre>${e.revisions.map(r => `<p><strong>v${r.version} · ${esc(r.actor)}</strong><br>${date(r.at)} · ${esc(r.reason)}<br>${link(`Read preserved revision ${r.version}`, `data-source="${e.id}" data-revision="${r.version}"`)}</p>`).join('')}</details>`;
  document.querySelectorAll('[data-source].evidence-link').forEach(b => b.classList.toggle('selected', b.dataset.source === e.id));
}

/* ---------- dialogs & mutations ---------- */
function field(name, title, type = 'text', value = '', help = '') { return `<div class="field"><label for="f-${name}">${title}</label>${type === 'textarea' ? `<textarea id="f-${name}" name="${name}" maxlength="4000" required>${esc(value)}</textarea>` : `<input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" required>`}${help ? `<small class="help">${help}</small>` : ''}</div>`; }
function select(name, title, options) { return `<div class="field"><label for="f-${name}">${title}</label><select id="f-${name}" name="${name}">${options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>`; }
let submitDialog = null;
function dialog(title, body, onSubmit, save = 'Save') {
  document.querySelector('#dialog-title').textContent = title; document.querySelector('#dialog-body').innerHTML = body;
  document.querySelector('#dialog-error').textContent = ''; setLabel(document.querySelector('#save-dialog'), save); submitDialog = onSubmit;
  document.querySelector('#action-dialog').showModal();
}
async function mutate(action, body, operationKey = key()) {
  const c = state.case;
  const result = await api(`/cases/${c.id}/${action}`, { method: 'POST', headers: { 'Idempotency-Key': operationKey }, body: JSON.stringify({ version: c.version, ...body }) });
  state.case = result; state.sourceRevision = null; renderCase(true); message('Saved. The case, ownership, and follow-up now reflect this change.'); return result;
}
function mutationDialog(title, body, action, convert) { const opKey = key(); dialog(title, body, async f => { await mutate(action, convert(f), opKey); }); }
function requestDialog(question = '') { mutationDialog('Save an in-app evidence request', field('question', 'One actionable evidence question', 'textarea', question) + field('next_review', 'Next review (Dhaka time)', 'datetime-local', future(), 'Saved investigation follow-up; not a repayment deadline.'), 'task', f => ({ question: f.get('question'), next_review: reviewTime(f) })); }

/* ---------- intake ---------- */
function intakeForm(reference = '') { state.page = 'intake'; state.intake = { key: key(), reference, step: 1 }; renderIntake(); }
function renderIntake() {
  const i = state.intake;
  render(`<div class="page page-narrow page-enter">${sessionLine()}${link(`${icon('arrow-left')} Your cases`, 'id="back-list"', 'plain back')}
  <div class="page-head mt-24"><div><span class="eyebrow">Customer / Report a second payment</span><h1>Tell us what happened</h1><p>Bangla, Banglish or English are welcome. A formal receipt is optional.</p></div></div>
  <div class="form-surface panel"><div class="step-label"><span class="${i.step === 1 ? 'active' : ''}">01 / Payment lookup</span><span class="${i.step === 2 ? 'active' : ''}">02 / Purchase &amp; report</span></div>
  <form id="intake-form">${i.step === 1 ? `<div class="field"><label for="intake-ref">Exact QR payment reference (optional)</label><input id="intake-ref" name="qr_reference" maxlength="100" value="${esc(i.reference)}" placeholder="QR-DEMO-003"><small class="help">We only show records belonging to your fictional customer session.</small></div><div class="actions">${btn('Look up reference', { id: 'lookup-payment', cls: 'ghost' })}${btn('Continue', { type: 'submit', after: 'arrow-right' })}</div><p id="lookup-result" role="status" class="help"></p>`
    : `<p class="help">Reference: ${esc(i.reference || 'Not supplied')} · ${esc(i.match ? 'Exact owned match' : 'Unlinked intake is accepted')}</p><div class="form-grid mt-16"><div class="field"><label for="purchase-id">Purchase / invoice (optional)</label><input id="purchase-id" name="purchase_id" maxlength="100" value="${esc(i.match?.purchase_id || '')}"></div><div class="field"><label for="amount">Amount you believe was paid again (BDT)</label><input id="amount" name="amount" inputmode="decimal" type="number" min="0.01" max="1000000" step="0.01" required value="500"></div></div>${select('second_method', 'Second payment method', [['cash', 'Cash'], ['qr', 'Another QR payment'], ['other', 'Another method']])}<div class="field"><label for="description">What happened? (optional)</label><textarea id="description" name="description" maxlength="4000" placeholder="একই কেনাকাটার জন্য দুবার পেমেন্ট হয়েছে…"></textarea></div><div class="note">Your report will be accepted with a saved investigator and next review. It does not execute a payment or certify an outcome.</div><p id="intake-error" class="error" role="alert"></p><div class="actions mt-24">${btn('Back', { id: 'previous-step', cls: 'ghost', before: 'arrow-left' })}${btn('Save complaint', { type: 'submit' })}</div>`}</form></div></div>`, { page: 'intake' });
}

/* ---------- judge ---------- */
async function judge() {
  const [demo, evaluation] = await Promise.all([api('/demo'), api('/evaluation')]);
  const done = evaluation.status === 'completed';
  render(`<div class="page page-enter">${sessionLine()}<div class="page-head"><div><span class="eyebrow">Judge / Synthetic journeys</span><h1>Inspect the complete investigation</h1><p>Four curated demonstrations, actual model artifacts, and saved evaluation results.</p></div></div>
  <div class="note warning">All case records are fictional. Demo journeys are separate from the performance test. No independent human review or real provider integration has occurred.</div>
  <div class="journeys">${demo.journeys.map((j, n) => `<div class="journey panel glow-card"><div><span>0${n + 1}</span><strong>${esc(j.title)}</strong></div>${btn('Open with investigator session', { cls: 'ghost btn-sm', attrs: `data-judge-case="${j.case_id}"`, after: 'arrow-right' })}</div>`).join('')}</div>
  <div class="request"><h3>Journey 4: reveal the next source response</h3><p>Advance the synthetic repayment source, then open case 4 as an investigator and run a repayment check. Availability alone does not add evidence.</p>${btn('Reveal mock repayment availability', { id: 'advance-demo', cls: 'btn-sm' })}</div>
  <section class="evaluation"><span class="eyebrow">Measured results / Exploratory</span><h2>${done ? 'Saved model evaluation' : esc(evaluation.status)}</h2>${done ? `<p>Frozen multilingual encoder; trained classifier head. Metrics assess passage labels, not financial truth.</p><div class="note warning">Evaluation v${evaluation.version}. ${esc(evaluation.test_status || 'First-run exploratory result.')} Labels have no independent human review.</div><p class="mt-16"><a href="/api/evaluation?version=1" target="_blank" rel="noopener">Inspect preserved first-run results (v1) ↗</a></p>${Object.entries(evaluation.suites).map(([name, s]) => `<h3>${esc(name.replaceAll('_', ' '))}</h3><p class="help">${s.trained_verifier.pairs} pairs · ${s.trained_verifier.case_bundles} fictional bundles · agent-authored labels</p><div class="table-wrap mt-16"><table><thead><tr><th>Method</th><th>Macro F1</th><th>Accuracy</th><th>Unsupported support</th><th>ms / pair</th></tr></thead><tbody>${Object.entries(s).map(([method, m]) => `<tr><td>${esc(method.replaceAll('_', ' '))}</td><td>${m.macro_f1.toFixed(3)}</td><td>${(m.accuracy * 100).toFixed(1)}%</td><td>${(m.unsupported_support_fraction * 100).toFixed(1)}%</td><td>${m.mean_ms_per_pair.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`).join('')}<ul class="mt-24">${evaluation.limitations.map(l => `<li>${esc(l)}</li>`).join('')}</ul><details><summary>Actual training configuration, hashes and confusion matrices</summary><pre>${esc(JSON.stringify(evaluation, null, 2))}</pre></details>` : '<p>Run the evaluation command in the repository runbook. Metrics appear only after a completed benchmark is saved.</p>'}</section></div>`, { page: 'judge' });
}

/* ---------- landing CTA: start a report from an exact reference ---------- */
async function startReport(ref) {
  if (state.busy) return;
  try {
    state.busy = true;
    setSession(await api('/session', { method: 'POST', body: JSON.stringify({ role: 'customer' }) }));
    state.case = null; state.source = null; message('');
    intakeForm(ref);
  } catch (e) { message(e.message, true); } finally { state.busy = false; }
}

/* ==========================================================================
   EVENTS
   ========================================================================== */
document.addEventListener('click', async ev => {
  const b = ev.target.closest('button,a[data-nav]'); if (!b) return;
  try {
    if (b.id === 'nav-toggle') { const open = navEl.classList.toggle('open'); b.setAttribute('aria-expanded', String(open)); return; }
    if (b.classList.contains('toast-x')) { message(''); return; }
    if (b.dataset.nav) { ev.preventDefault(); await navigate(b.dataset.nav); return; }
    if (b.dataset.faqTab) { state.faq = { tab: b.dataset.faqTab, q: 0 }; document.querySelector('#faq-area').innerHTML = faqArea(); document.querySelector(`[data-faq-tab="${state.faq.tab}"]`)?.focus(); return; }
    if (b.dataset.faqQ != null) { state.faq.q = Number(b.dataset.faqQ); document.querySelector('#faq-area').innerHTML = faqArea(); document.querySelector(`[data-faq-q="${state.faq.q}"]`)?.focus(); return; }
    if (b.dataset.storyStep != null) { state.story.step = Number(b.dataset.storyStep); renderStory(); return; }
    if (b.dataset.role) { await switchRole(b.dataset.role); return; }
    if (b.dataset.case) { await openCase(b.dataset.case); return; }
    if (b.dataset.source) { state.source = b.dataset.source; state.sourceRevision = b.dataset.revision ? Number(b.dataset.revision) : null; renderSource(); return; }
    if (b.dataset.question) { requestDialog(b.dataset.question); return; }
    if (b.dataset.resolve) { mutationDialog('Record a cited evidence response', select('evidence_id', 'Evidence addressing the request', state.case.evidence.map(e => [e.id, e.kind + ' / ' + e.id])) + field('reason', 'Resolution and remaining uncertainty', 'textarea'), 'resolve-task', f => ({ task_id: b.dataset.resolve, evidence_id: f.get('evidence_id'), reason: f.get('reason') })); return; }
    if (b.dataset.judgeCase) { const id = b.dataset.judgeCase; await switchRole('staff'); await openCase(id); return; }
    switch (b.id) {
      case 'story-back': storyBack(); break;
      case 'story-next': await storyNext(); break;
      case 'phone-pay': state.story.paid = true; renderStory(); break;
      case 'run-model': await runStoryModel(); break;
      case 'retry-customer': state.story.customerError = ''; state.story.customer = null; renderStory(); break;
      case 'open-story-customer': await openStoryCustomer(); break;
      case 'open-story-case': await openStoryCase(); break;
      case 'back-list': await loadList(); break;
      case 'refresh': if (state.case && state.page === 'case') await openCase(state.case.id); else await loadList(); message('Saved status refreshed. No source check or analysis was run.'); break;
      case 'new-case': intakeForm(); break;
      case 'previous-step': state.intake.step = 1; renderIntake(); break;
      case 'lookup-payment': { const ref = document.querySelector('#intake-ref').value.trim(); state.intake.reference = ref; const el = document.querySelector('#lookup-result'); try { state.intake.match = await api('/payments/' + encodeURIComponent(ref)); el.textContent = `Owned match: ${state.intake.match.purchase_id} · ${money(state.intake.match.amount_minor)}. Continue to report.`; } catch (e) { state.intake.match = null; el.textContent = e.message; } break; }
      case 'analyze': b.disabled = true; setLabel(b, 'Analyzing current passages…'); await mutate('analyze', {}); break;
      case 'add-details': mutationDialog('Add details or request further review', field('text', 'Your additional details', 'textarea'), 'details', f => ({ text: f.get('text') })); break;
      case 'correct-claim': mutationDialog('Correct a proposed claim; preserve history', select('claim_id', 'Claim to revise', [['qr', 'QR completion'], ['cash', 'Second payment'], ['same', 'Same purchase'], ['repayment', 'Repayment']]) + field('text', 'Revised claim text', 'textarea') + field('reason', 'Reason for correction', 'textarea'), 'claim', f => ({ claim_id: f.get('claim_id'), text: f.get('text'), reason: f.get('reason') })); break;
      case 'link-payment': mutationDialog('Link an exact owned payment', field('reference', 'Exact QR reference') + field('reason', 'Verified mapping rationale', 'textarea'), 'link', f => ({ reference: f.get('reference'), reason: f.get('reason') })); break;
      case 'add-evidence': mutationDialog('Add supplied evidence', select('kind', 'Supplied source type', [['staff_supplied', 'Staff supplied / unverified'], ['customer_supplied', 'Customer supplied / unverified'], ['merchant_supplied', 'Merchant supplied / unverified'], ['repayment_request', 'Repayment request / unconfirmed']]) + field('text', 'Exact source passage', 'textarea') + `<div class="field"><label for="f-reference">Source reference (optional)</label><input id="f-reference" name="reference" maxlength="100"></div>` + select('assertion', 'Merchant conflict marker', [['', 'No explicit denial'], ['denial', 'Explicit merchant denial']]), 'evidence', f => ({ kind: f.get('kind'), text: f.get('text'), reference: f.get('reference'), assertion: f.get('assertion') })); break;
      case 'correct-source': { const e = state.case.evidence.find(e => e.id === state.source); mutationDialog('Correct transcript; preserve the original', field('text', 'Corrected transcript', 'textarea', e.revisions.at(-1).text) + field('reason', 'Reason for correction', 'textarea') + `<div class="field"><label for="f-reference">Corrected reference (optional)</label><input id="f-reference" name="reference" maxlength="100" value="${esc(e.reference || '')}"></div>`, 'correct', f => ({ evidence_id: e.id, text: f.get('text'), reason: f.get('reason'), reference: f.get('reference') })); break; }
      case 'upload-document': { const opKey = key(); dialog('Add an original document', `<div class="field"><label for="f-file">PNG, JPEG or UTF-8 text (maximum 2 MiB)</label><input id="f-file" name="file" type="file" accept="image/png,image/jpeg,text/plain" required></div><div class="field"><label for="f-transcript">Human transcript (required for images)</label><textarea id="f-transcript" name="transcript" maxlength="4000"></textarea><small class="help">No automatic OCR is performed. The verifier reads this transcript, not the image.</small></div>`, async f => { f.set('version', state.case.version); state.case = await api(`/cases/${state.case.id}/upload`, { method: 'POST', headers: { 'Idempotency-Key': opKey }, body: f }); renderCase(true); message('Original document saved as unverified supplied evidence.'); }); break; }
      case 'check-source': mutationDialog('Run a permitted read-only mock check', select('kind', 'Source to check', [['qr', 'QR completion'], ['repayment', 'Completed repayment']]) + select('available', 'Source simulation', [['yes', 'Available'], ['no', 'Simulate unavailable']]), 'check', f => ({ kind: f.get('kind'), simulate_unavailable: f.get('available') === 'no' })); break;
      case 'request-evidence': requestDialog(state.case.facts.requirements[0] || 'Confirm the purchase-level mapping and unresolved statement.'); break;
      case 'schedule-review': mutationDialog('Save the next investigation review', field('next_review', 'Next review (Dhaka time)', 'datetime-local', future()), 'review', f => ({ next_review: reviewTime(f) })); break;
      case 'handoff': mutationDialog('Request handoff; keep current ownership', select('destination', 'Receiving investigator', [[state.case.owner === 'staff_1' ? 'staff_2' : 'staff_1', 'Investigator ' + (state.case.owner === 'staff_1' ? '2' : '1')]]) + field('reason', 'Reason for handoff / escalation', 'textarea'), 'handoff', f => ({ destination: f.get('destination'), reason: f.get('reason') })); break;
      case 'acknowledge': await mutate('acknowledge', {}); break;
      case 'review-decision': mutationDialog('Record human review, with source citations', select('decision', 'Review decision', [['EVIDENCE_ASSEMBLED', 'Evidence assembled for review'], ['FURTHER_EVIDENCE', 'Further evidence required'], ['REFERRAL', 'Referral / escalation'], ['OUTCOME_RECORDED', 'Repayment outcome recorded from a completed source']]) + field('note', 'Review note', 'textarea') + select('evidence_id', 'Supporting preserved source', state.case.evidence.map(e => [e.id, e.kind + ' · ' + e.id])), 'decision', f => ({ decision: f.get('decision'), note: f.get('note'), evidence_ids: [f.get('evidence_id')] })); break;
      case 'export': { const r = await fetch(`/api/cases/${state.case.id}/dossier`); if (!r.ok) throw Error('Dossier export could not be authorized.'); const blob = await r.blob(), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = state.case.reference + '-dossier.md'; a.click(); URL.revokeObjectURL(url); message('Versioned dossier downloaded. Source assertions retain their provenance.'); break; }
      case 'advance-demo': await api('/demo/advance', { method: 'POST', body: '{}' }); message('Mock availability saved. Run the repayment source check in the investigator workspace to add evidence.'); break;
      case 'close-dialog': case 'cancel-dialog': document.querySelector('#action-dialog').close(); break;
    }
  } catch (e) { message(e.message, true); if (b.id === 'analyze') { b.disabled = false; setLabel(b, 'Analyze current evidence'); } }
});
document.addEventListener('change', async e => { if (e.target.id === 'switch-session') await switchRole(e.target.value); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeNav();
  // Arrow-key navigation inside the FAQ question list (vertical tablist).
  if (e.target.matches?.('.q') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    const n = FAQ[state.faq.tab].items.length;
    state.faq.q = (state.faq.q + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
    document.querySelector('#faq-area').innerHTML = faqArea();
    document.querySelector(`[data-faq-q="${state.faq.q}"]`)?.focus();
  }
});
document.addEventListener('submit', async ev => {
  if (ev.target.id === 'ref-form') { ev.preventDefault(); await startReport(new FormData(ev.target).get('ref').trim()); return; }
  if (ev.target.id === 'action-form') { ev.preventDefault(); const save = document.querySelector('#save-dialog'); save.disabled = true; try { await submitDialog(new FormData(ev.target)); document.querySelector('#action-dialog').close(); } catch (e) { document.querySelector('#dialog-error').textContent = e.message; } finally { save.disabled = false; } return; }
  if (ev.target.id === 'intake-form') {
    ev.preventDefault(); const f = new FormData(ev.target), i = state.intake;
    if (i.step === 1) { i.reference = f.get('qr_reference').trim(); if (i.reference !== i.match?.reference) i.match = null; i.step = 2; renderIntake(); return; }
    const b = ev.target.querySelector('button[type=submit]'); b.disabled = true;
    try {
      const decimal = String(f.get('amount'));
      if (!/^\d+(\.\d{1,2})?$/.test(decimal)) throw Error('Enter BDT with at most two decimal places.');
      const [whole, fraction = ''] = decimal.split('.'); const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
      const c = await api('/cases', { method: 'POST', headers: { 'Idempotency-Key': i.key }, body: JSON.stringify({ qr_reference: i.reference, purchase_id: f.get('purchase_id'), amount_minor: amount, second_method: f.get('second_method'), description: f.get('description') }) });
      state.case = c; renderCase(); message('Complaint saved with a stable reference, investigator and next review. Add optional evidence from the case.');
    } catch (e) { document.querySelector('#intake-error').textContent = e.message; b.disabled = false; }
  }
});

renderHome();
api('/session').then(setSession).catch(() => { });
