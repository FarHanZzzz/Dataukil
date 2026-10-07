"""Versioned, deterministic data-access controls for the two synthetic journeys.

This is an executable demonstration policy, not a legal compliance certificate.
Decisions contain field names and policy metadata, never copies of source values.
Authentication and case ownership remain the responsibility of the calling route.
"""
import re

from .domain import now, uid

POLICY_VERSION = 'DNA-DEMO-2026.1'
PURPOSE = 'resolve_payment_case'
BASIS = 'synthetic_service_resolution'
RECIPIENTS = {'case_investigator', 'local_receipt_processor', 'operator', 'internal_policy_engine'}

# These are explicit adapter contracts. Unknown fields are withheld by default.
SAFE_FIELDS = {
    'intent_amount_minor', 'amount_minor', 'currency', 'reference', 'purchase_id',
    'posting_reference', 'posting_status', 'posted_at', 'debit_count', 'debits',
    'returns', 'amount_matches', 'found', 'posting', 'as_of', 'source_available',
    'state', 'capabilities', 'callback', 'callback_status', 'callback_attempts',
    'count', 'attempts', 'attempt_no', 'verified', 'ambiguous', 'candidate_count',
    'candidate_tokens', 'available', 'record_count', 'records', 'error', 'warnings',
    'error_code', 'retryable', 'options', 'missing_proof', 'facts', 'original_hash',
    'merchant', 'merchant_id', 'merchant_name', 'invoice', 'invoice_id', 'invoice_number',
    'purchase', 'date', 'purchase_date', 'purchase_time', 'timestamp', 'total_minor',
    'total', 'cash_minor', 'cash_paid_minor', 'qr_minor', 'qr_paid_minor', 'qr_reference',
    'qr_status', 'cash_status', 'payment_status', 'cash_payment', 'qr_payment',
    'payment_method', 'tender', 'tender_breakdown', 'line_items', 'item', 'quantity',
    'unit_price_minor', 'line_total_minor', 'refunded', 'receipt_number', 'receipt_fields',
    'field_regions', 'missing_fields', 'scan_id', 'review_id', 'source_id',
    'source_version', 'receipt_image_for_local_processing', 'receipt_transcript',
    'timeout', 'conflicting_records', 'cash_reference', 'subtotal_minor', 'tax_minor',
    'invoice_total_minor', 'cash_amount_minor', 'qr_posted_amount_minor', 'receipt_timestamp',
    'bank_debit_reference', 'bank_debit_verified', 'cash_received', 'order_exists', 'denial',
}
LOCAL_ONLY = {'receipt_image_for_local_processing', 'receipt_transcript'}
WITHHELD_FIELDS = {
    'customer_name': 'A customer identity is unnecessary for this case-scoped check.',
    'phone': 'A phone number is unnecessary for this investigation.',
    'full_account_number': 'Use the verified intent mapping; do not release a full account number.',
    'unrelated_history': 'Other customers and other purchases are outside this case.',
    'raw_receipt_image': 'The original stays in the local evidence workspace.',
    'raw_receipt_text': 'Release reviewed payment fields rather than unrestricted receipt text.',
    'candidate_account_identifiers': 'Release candidate count and opaque tokens, not account identities.',
    'internal_posting_ids': 'Posting references are sufficient; internal database identifiers stay at the source.',
    'raw_worker_payload': 'Release error codes and retryability instead of unrestricted diagnostic payloads.',
    'raw_diagnostic_text': 'Free text can contain personal data; use structured diagnostic codes.',
}
TOOL_FIELDS = {
    'bank_record_check': ['intent_amount_minor', 'currency', 'posting_reference', 'debit_count', 'debits', 'returns', 'amount_matches', 'internal_posting_ids'],
    'wallet_ledger_check': ['found', 'posting', 'posting_reference', 'as_of', 'internal_posting_ids'],
    'partner_status_check': ['source_available', 'state', 'capabilities', 'callback_status', 'callback_attempts', 'raw_diagnostic_text'],
    'attempt_history_check': ['count', 'attempts', 'attempt_no'],
    'mapping_check': ['verified', 'ambiguous', 'candidate_count', 'candidate_tokens', 'candidate_account_identifiers'],
    'worker_error_check': ['available', 'record_count', 'error_code', 'retryable', 'attempt_no', 'warnings', 'raw_worker_payload'],
    'eligibility_check': ['options', 'missing_proof', 'facts'],
}


def evaluate_access(*, case_id, workflow, actor, source, fields, purpose=PURPOSE,
                    recipient='case_investigator', scope_matches=True, basis=BASIS):
    """Evaluate before an adapter reads. A withheld request must not call its adapter."""
    requested = list(dict.fromkeys(str(f) for f in fields))
    issues = []
    decision, reason = 'ALLOWED', 'This case-scoped request uses the approved synthetic investigation purpose.'
    if not case_id or not actor or not source or workflow not in ('qr_cash', 'add_money'):
        decision, reason = 'BLOCKED', 'A valid case, authenticated actor, source and supported workflow are required.'
        issues.append(_concern('identity', 'Request identity is incomplete', 'Withhold the source read and restore the authorized case context.', 'operator'))
    elif not scope_matches:
        decision, reason = 'BLOCKED', 'The requested records fall outside this case. No source read was performed.'
        issues.append(_concern('scope', 'Unrelated data requested', 'Reject the request; investigate only the linked payment or purchase.', 'operator'))
    elif purpose != PURPOSE:
        decision, reason = 'BLOCKED', 'This purpose is outside the approved payment investigation policy.'
        issues.append(_concern('purpose', 'Purpose is not approved', 'Obtain a separately approved purpose before retrieving data.', 'privacy_owner'))
    elif recipient not in RECIPIENTS:
        decision, reason = 'BLOCKED', 'This recipient is not approved. No data was sent to a model or external destination.'
        issues.append(_concern('recipient', 'Unapproved destination', 'Privacy and security owners must review the recipient and processor arrangement.', 'privacy_owner'))
    elif basis != BASIS:
        decision, reason = 'NEEDS_REVIEW', 'The policy has no approved basis for this request. Source retrieval is paused.'
        issues.append(_concern('basis', 'Processing basis requires review', 'A privacy owner must establish an applicable basis; the investigator cannot invent one.', 'privacy_owner'))

    rules = []
    for field in requested:
        allowed = field in SAFE_FIELDS or bool(re.fullmatch(r'line_items\.\d+', field))
        explanation = WITHHELD_FIELDS.get(field, 'The field is not in the approved release contract.')
        if field in LOCAL_ONLY and recipient != 'local_receipt_processor':
            allowed = False
            explanation = 'Original receipt content is permitted only at the local receipt processor.'
        if decision in ('BLOCKED', 'NEEDS_REVIEW'):
            allowed, explanation = False, reason
        rules.append(dict(field=field, handling='RELEASED' if allowed else 'WITHHELD', reason='Necessary to check this payment within the approved purpose.' if allowed else explanation))
    released = [r['field'] for r in rules if r['handling'] == 'RELEASED']
    withheld = [r['field'] for r in rules if r['handling'] == 'WITHHELD']
    if decision == 'ALLOWED' and withheld:
        decision = 'MINIMIZED' if released else 'BLOCKED'
        reason = 'Only the approved structured fields are permitted for release; unnecessary identifiers and unrestricted content stay at the source.' if released else 'None of the requested fields is permitted. No source read was performed.'
        issues.append(_concern('minimization', 'Unnecessary fields withheld', 'Apply the adapter projection before storing the observation or displaying the result.', 'policy_engine', 'addressed'))
    return dict(id=uid('dna'), at=now(), case_id=case_id, workflow=workflow, actor=actor,
                source=source, purpose=purpose, recipient=recipient, basis=basis,
                basis_label='Synthetic service-resolution assumption; production legal approval required' if basis == BASIS else 'No approved basis',
                policy_version=POLICY_VERSION, decision=decision, reason=reason,
                requested_fields=requested, released_fields=released, withheld_fields=withheld,
                field_rules=rules, concerns=issues, affects_case=True, permission_only=True,
                scope='Linked payment / purchase only' if scope_matches else 'Outside the linked case',
                retention='Case-linked simulation record. Production retention schedule and deletion controls require institutional approval.',
                simulation=True)


def _concern(code, title, action, owner, status='open'):
    return dict(code=code, title=title, action=action, owner=owner, status=status, policy_ref=f'{POLICY_VERSION}/{code}')


def tool_request(tool, case_id, actor):
    return evaluate_access(case_id=case_id, workflow='add_money', actor=actor,
                           source=tool, fields=TOOL_FIELDS.get(tool, []))


def summary(decisions):
    decisions = list(decisions)
    counts = {k: sum(d['decision'] == k for d in decisions) for k in ('ALLOWED', 'MINIMIZED', 'BLOCKED', 'NEEDS_REVIEW')}
    # Preserve the complete audit history while evaluating the latest authorization
    # for each source/recipient contract. A fresh permitted request can replace a
    # prior refused request; its earlier audit entry remains visible.
    latest = {}
    for d in decisions:
        if d.get('affects_case', True):
            latest[(d['workflow'], d['source'], d['recipient'])] = d
    active = list(latest.values())
    unresolved = [d for d in active if d['decision'] in ('BLOCKED', 'NEEDS_REVIEW')]
    stale = [d for d in active if d['policy_version'] != POLICY_VERSION]
    return dict(policy_version=POLICY_VERSION, decisions=decisions, counts=counts, total=len(decisions),
                mode='Deterministic synthetic policy; no compliance certification',
                readiness='REVIEW_REQUIRED' if unresolved or stale else 'READY' if active else 'NOT_STARTED',
                boundaries=[
                    'Investigator: read approved case data, compare evidence and propose a plan.',
                    'DataDNA: validate scope, purpose, basis and recipient; minimize fields; save decision metadata.',
                    'Operator: approve a current eligible action. The investigator has no money-moving permission.',
                    'Privacy owner: approve production policy and resolve missing legal bases or recipient permissions.',
                ],
                next_review='Before production: privacy owner reviews legal basis, retention, processor contracts and security; repeat assurance when policies or recipients change.',
                audits=[
                    dict(title='Policy and legal review', owner='Privacy owner', status='PRODUCTION_REQUIRED', detail='Confirm the applicable law, lawful basis, notices, rights handling and any required independent audit.'),
                    dict(title='Security and access assurance', owner='Security team', status='PRODUCTION_REQUIRED', detail='Check identity, least privilege, source integrations, destinations and resistance to gate bypass.'),
                    dict(title='Data lifecycle assurance', owner='Data owner', status='PRODUCTION_REQUIRED', detail='Apply approved retention and deletion to originals, observations, reports, exports and cached copies.'),
                    dict(title='Decision quality assurance', owner='Operations lead', status='PRODUCTION_REQUIRED', detail='Review wrong diagnoses, stale evidence, denied reads, operator overrides and outcome verification.'),
                ], simulation=True)


def customer_summary(decisions):
    s = summary(decisions)
    return dict(total=s['total'], minimized=s['counts']['MINIMIZED'], blocked=s['counts']['BLOCKED'],
                message='The investigation checks records linked to your payment. Unnecessary data is withheld; an operator approves any proposed correction.', simulation=True)


def report_lines(decisions):
    s = summary(decisions)
    lines = ['', '## DataDNA access decisions', f"Policy: {s['policy_version']}. {s['mode']}.",
             'The policy basis is a synthetic fixture assumption. It must be approved for a production deployment.']
    for d in decisions:
        lines += [f"- [{d['id']}] {d['source']} → {d['recipient']}: {d['decision']} ({d['policy_version']})",
                  f"  Purpose: {d['purpose']}; basis: {d.get('basis_label', d['basis'])}; actor: {d['actor']}.",
                  f"  Fields permitted for release: {', '.join(d['released_fields']) or 'none'}. Withheld: {', '.join(d['withheld_fields']) or 'none'}.",
                  f"  {d['reason']}" + (' Boundary demonstration; does not alter incident evidence.' if not d.get('affects_case', True) else '')]
    lines += ['Field permission is separate from source availability; consult the cited observations for the actual retrieval outcome.', '', '### Remaining assurance and ownership']
    lines += [f"- {a['title']} — {a['owner']}: {a['detail']}" for a in s['audits']]
    lines += [s['next_review']]
    return lines
