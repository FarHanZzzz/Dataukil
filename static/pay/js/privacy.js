// Explain saved policy decisions without reconstructing or exposing source values.
import { h } from './util.js';
import { icon } from './icons.js';

export const DNA_LABEL = { ALLOWED: 'Allowed', MINIMIZED: 'Minimized', BLOCKED: 'Blocked', NEEDS_REVIEW: 'Needs review' };
export const DNA_TONE = { ALLOWED: 'ok', MINIMIZED: 'probe', BLOCKED: 'bad', NEEDS_REVIEW: 'warn' };
const pretty = value => String(value || '').replaceAll('_', ' ');
const field = value => typeof value === 'string' ? pretty(value) : pretty(value.field || value.title || value.code);

export function dnaCounts(decisions = []) {
  return Object.fromEntries(Object.keys(DNA_LABEL).map(key => [key, decisions.filter(d => d.decision === key).length]));
}

export function dnaFunnel(decisions = [], compact = false) {
  const latest = decisions.at(-1);
  const stages = [
    ['01', 'Request', 'Case + actor + source'],
    ['02', 'Policy gate', 'Scope, purpose, basis, recipient'],
    ['03', 'Minimum fields', 'Release necessary fields only'],
    ['04', 'Saved decision', 'Reason, policy and owner'],
  ];
  return h('section', { class: 'dna-funnel' + (compact ? ' dna-funnel--compact' : ''), 'aria-label': 'DataDNA access funnel' },
    h('div', { class: 'dna-heading' }, h('span', { class: 'dna-mark' }, icon('lock', 17)), h('div', {}, h('strong', { text: 'DataDNA · before the source read' }), h('p', { text: 'A versioned policy decides which data the investigator may receive.' }))),
    h('ol', { class: 'dna-flow' }, stages.map(([n, title, note]) => h('li', { class: decisions.length ? 'is-established' : '' }, h('span', { class: 'dna-step-number', text: n }), h('div', {}, h('strong', { text: title }), h('small', { text: note }))))),
    h('p', { class: 'dna-funnel-state' }, latest ? `${decisions.length} saved decision${decisions.length === 1 ? '' : 's'} · latest: ${DNA_LABEL[latest.decision] || latest.decision}` : 'Ready for the first request. Stages above explain the configured policy; no access decision has been made yet.'));
}

export function dnaDecision(d, expanded = false) {
  const facts = [['Source', d.source_label || pretty(d.source)], ['Purpose', pretty(d.purpose)], ['Recipient', pretty(d.recipient)], ['Scope', d.scope], ['Basis', d.basis_label || pretty(d.basis)], ['Policy', d.policy_version], ['Actor', d.actor]];
  const rules = d.field_rules || [...(d.released_fields || []).map(f => ({ field: f, handling: 'RELEASED', reason: 'Necessary for the linked case.' })), ...(d.withheld_fields || []).map(f => ({ field: f, handling: 'WITHHELD', reason: d.reason }))];
  return h('details', { class: 'dna-decision dna-decision--' + (d.decision || '').toLowerCase(), open: expanded },
    h('summary', {}, h('div', {}, h('span', { class: 'mono dna-id', text: d.id }), h('strong', { text: d.source_label || pretty(d.source) })), h('span', { class: 'pill pill--' + (DNA_TONE[d.decision] || 'idle'), text: DNA_LABEL[d.decision] || d.decision })),
    h('div', { class: 'dna-decision-body' },
      d.demonstration || d.affects_case === false ? h('p', { class: 'dna-demo-label', text: 'Boundary demonstration · separate from incident evidence' }) : null,
      h('p', { class: 'dna-reason', text: d.reason }),
      h('dl', { class: 'dna-facts' }, facts.filter(([, v]) => v).map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v })))),
      h('div', { class: 'dna-field-group' }, h('strong', { text: 'Fields permitted for release' }), h('div', { class: 'dna-fields' }, (d.released_fields || []).length ? d.released_fields.map(f => h('span', { class: 'dna-field dna-field--released', text: field(f) })) : h('span', { class: 'muted', text: 'None — source retrieval withheld' }))),
      (d.withheld_fields || []).length ? h('div', { class: 'dna-field-group' }, h('strong', { text: 'Withheld field names' }), h('div', { class: 'dna-fields' }, d.withheld_fields.map(f => h('span', { class: 'dna-field dna-field--withheld', text: field(f) })))) : null,
      rules.length ? h('details', { class: 'dna-rules' }, h('summary', { text: 'Why each field was permitted or withheld' }), h('ul', {}, rules.map(r => h('li', {}, h('strong', { text: field(r.field) + ' · ' + (r.handling === 'RELEASED' ? 'permitted' : 'withheld') }), h('p', { text: r.reason }))))) : null,
      (d.concerns || []).map(c => h('section', { class: 'dna-concern' }, h('strong', { text: c.title }), h('p', { text: c.action }), h('small', { text: `Owner: ${pretty(c.owner)} · ${pretty(c.status)} · ${c.policy_ref || d.policy_version}` }))),
      h('p', { class: 'dna-retention', text: d.retention }),
      h('p', { class: 'dna-retention', text: 'Source availability and the actual retrieval outcome appear in the evidence observation. Permission to release a field does not establish that the source returned it.' }),
      h('p', { class: 'dna-retention', text: 'The audit entry stores field names and policy metadata; source values are not duplicated here.' })));
}

export function permissionCard() {
  return h('section', { class: 'dna-permissions' }, h('h4', { text: 'Who can do what?' }),
    h('dl', { class: 'dna-facts' }, [
      ['Investigator', 'Read permitted case records, compare evidence, and propose the next step.'],
      ['DataDNA', 'Enforce the synthetic policy before reads and record its decisions.'],
      ['Operator', 'Review the evidence and explicitly approve a current eligible correction.'],
      ['Executor', 'Recheck financial eligibility, execute once, and verify the ledger outcome.'],
      ['Privacy owner', 'Approve production policy, basis, recipients and lifecycle controls.'],
    ].map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v })))),
    h('p', { text: 'Add Money uses a deterministic investigation policy in this demo. Its investigator has no money-moving tool.' }));
}

export function investigationStory() {
  return h('details', { class: 'dna-investigation-story', open: true }, h('summary', { text: 'How this investigation works' }),
    h('ol', {}, [
      ['Detect the symptom', 'The configured timer notices a missing acknowledgement and opens an owned incident. A timeout alone does not identify the failed stage.'],
      ['Locate the cause', 'The investigator compares this payment’s bank, wallet and partner records. Each finding selects the next permitted check; no live trial transfer is needed to diagnose it.'],
      ['Propose from evidence', 'An existing credit needs a status refresh. A funded, uncredited, safely replayable intent may support one resume. Ambiguous records need an owned follow-up.'],
      ['Approve and verify', 'The operator reviews the proposal. The executor revalidates current evidence and eligibility, then checks the ledger and updates the customer.'],
    ].map(([title, text]) => h('li', {}, h('strong', { text: title }), h('p', { text })))),
    h('p', { class: 'dna-value', text: 'Operator benefit: one linked case replaces repeated system switching and duplicate record requests, with evidence, privacy decisions and the next action ready for review.' }));
}
