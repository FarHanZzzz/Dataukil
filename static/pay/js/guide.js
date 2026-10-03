// Presentation-only journey helpers. Financial truth still comes from authorized server projections.
import { h, link, fill, svg } from './util.js';
import { icon } from './icons.js';

export const STEPS = ['Choose a scenario', 'Add money', 'Track the transfer', 'Investigate', 'Outcome and report'];

export function withRun(path, run) {
  const url = new URL(path, location.origin);
  if (run) url.searchParams.set('run', run);
  return url.pathname + url.search + url.hash;
}

export function rememberPayment(payment, run) {
  if (!run || !payment) return;
  try { sessionStorage.setItem('tf.pay.run.' + payment, run); } catch { /* storage may be disabled */ }
}

export function paymentRun(payment) {
  try { return sessionStorage.getItem('tf.pay.run.' + payment); } catch { return null; }
}

export function rememberRun(run) {
  // Only availability is shared across companion tabs; tokens, drafts and payments stay tab-scoped.
  try { localStorage.setItem('tf.pay.runState.' + run.id, run.status); } catch { /* optional persistence */ }
}

export function archivedRun(run) {
  try { return localStorage.getItem('tf.pay.runState.' + run) === 'archived'; } catch { return false; }
}

export function knownRun(run) {
  try { return localStorage.getItem('tf.pay.runState.' + run); } catch { return null; }
}

export function journey(run) {
  if (!run) return { step: 0, note: 'Choose a scenario to begin', label: 'Choose a scenario', href: '#setup' };
  const p = run.payments.at(-1);
  const url = path => withRun(path, run.id);
  if (!p) return { step: 1, note: 'Ready for your first request', label: 'Add money', href: url('/customer/payment') };
  if (p.phase === 'handoff') return { step: 4, note: 'Follow-up saved · wallet credit remains unconfirmed', label: 'Read the follow-up report', href: url('/admin/cases/' + p.id + '/report') };
  if (p.phase === 'resolved' || p.status === 'COMPLETED') return { step: 4, note: 'Wallet credit confirmed', label: p.case_id ? 'Read the outcome report' : 'View confirmed payment', href: url(p.case_id ? '/admin/cases/' + p.id + '/report' : '/customer/payment/' + p.id) };
  if (p.phase === 'decision') return { step: 4, note: 'Decision ready · review the saved plan', label: 'Review the decision', href: url('/admin/cases/' + p.id) };
  if (['incident', 'investigating'].includes(p.phase)) return { step: 3, note: p.phase === 'incident' ? 'Incident opened · ready to investigate' : 'Investigation in progress', label: p.phase === 'incident' ? 'Open investigation' : 'Follow the investigation', href: url('/admin/cases/' + p.id) };
  return { step: 2, note: p.status === 'UNCERTAIN' ? 'Wallet credit not confirmed yet' : 'Transfer is processing', label: 'Track your transfer', href: url('/customer/payment/' + p.id) };
}

export function siteHeader(run) {
  return h('header', { class: 'am-header' },
    link('/', { class: 'am-brand' }, h('span', { class: 'am-brand-mark', 'aria-hidden': 'true' }, h('i')), h('span', {}, h('strong', { text: 'DataUkil' }), h('small', { text: 'Add money' }))),
    h('nav', { class: 'am-site-nav', 'aria-label': 'Primary' },
      link(withRun('/mfs', run), { 'aria-current': 'page' }, 'Add money'),
      link('/qr-demo', {}, 'QR + cash'),
      h('details', { class: 'am-workspaces', onkeydown: e => {
        if (e.key === 'Escape') { e.currentTarget.open = false; e.currentTarget.querySelector('summary').focus(); e.stopPropagation(); }
      } }, h('summary', {}, 'Workspaces', icon('chevronDown', 12)),
        h('div', {}, link('/', {}, 'Home'), link('/customer', {}, 'Transfer dashboard'), link('/operations', {}, 'Transfer operations')))));
}

export function flowStrip(step, { run, payment, caseId } = {}) {
  const paths = [withRun('/mfs', run), withRun('/customer/payment', run), payment ? withRun('/customer/payment/' + payment, run) : null,
    payment ? withRun('/admin/cases/' + payment, run) : null, caseId ? withRun('/admin/cases/' + caseId + '/report', run) : null];
  const strip = h('nav', { class: 'am-guide', 'aria-label': 'Add-money walkthrough' });
  const list = h('ol', { class: 'am-step-list' }, STEPS.map((text, i) => {
    const attrs = { class: 'am-step ' + (i < step ? 'is-done' : i === step ? 'is-current' : 'is-next'), 'aria-current': i === step ? 'step' : null };
    const content = [h('span', { class: 'am-step-number' }, i < step ? icon('check', 14) : String(i + 1)), h('span', { text })];
    // Never route a submitted payment back to a new request through a completed stage.
    const path = i === 1 && payment ? paths[2] : paths[i];
    return h('li', {}, path && i <= step ? link(path, attrs, content) : h('span', attrs, content));
  }));
  const toggle = h('button', { class: 'am-step-toggle', type: 'button', 'aria-expanded': 'false', onclick: () => {
    const open = strip.classList.toggle('is-expanded');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Hide steps' : 'View all steps';
  } }, 'View all steps');
  fill(strip, h('div', { class: 'am-step-compact' }, h('span', {}, `Step ${step + 1} of 5 · `, h('strong', { text: STEPS[step] })), toggle), list);
  return strip;
}

export function routeIllustration() {
  const items = [['bank', '01', 'Linked bank', 'Funding source'], ['wallet', '02', 'Your wallet', 'Credit destination'], ['search', '03', 'Investigation', 'Every source in view']];
  return h('div', { class: 'am-route-art', 'aria-label': 'From a linked bank to your wallet, with an investigation when needed' },
    h('div', { class: 'am-art-top' }, h('span', { class: 'am-kicker', text: 'Connected by evidence' }), h('span', { class: 'am-art-signal' }, '●', ' Saved & traceable')),
    h('div', { class: 'am-art-amount' }, h('small', { text: 'ONE REQUEST. A CLEAR NEXT STEP.' }), h('strong', {}, 'Bank', h('span', { text: ' → ' }), 'Wallet')),
    h('div', { class: 'am-art-route' }, items.map(([ic, n, title, detail]) => h('div', { class: 'am-art-node' },
      h('div', { class: 'am-art-icon' }, icon(ic, 22)), h('small', { class: 'mono', text: n }), h('strong', { text: title }), h('span', { text: detail })))),
    h('div', { class: 'am-art-foot' }, icon('doc', 16), 'An outcome grounded in the records', icon('arrowRight', 16)));
}

export function investigationPreview() {
  // A decorative schematic, not a financial status or a second interactive graph.
  const node = (cls, ic, title, detail) => h('div', { class: 'am-preview-node ' + cls }, icon(ic, 20), h('strong', { text: title }), h('small', { text: detail }));
  return h('div', { class: 'am-board-preview', 'aria-hidden': 'true' },
    svg('svg', { viewBox: '0 0 420 210', preserveAspectRatio: 'none', class: 'am-preview-wires' },
      svg('path', { d: 'M75 45H210V100M345 45H210M75 170H210V100M345 170H210' })),
    node('am-preview-bank', 'bank', 'Bank records', 'Funding source'),
    node('am-preview-wallet', 'wallet', 'Wallet ledger', 'Credit evidence'),
    h('div', { class: 'am-preview-hub' }, icon('search', 24), h('span', { text: 'Investigate' })),
    node('am-preview-checks', 'layers', 'Source checks', 'Read the evidence'),
    node('am-preview-outcome', 'doc', 'Next action', 'An owned outcome'));
}
