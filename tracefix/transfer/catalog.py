"""Static catalogue for the stalled add-money investigation: graph topology, tools, hypotheses, fixtures.

Nothing here is a hidden truth. Scenario labels live only in the simulator (engine.py); investigation tools and
the policy never import this module's scenario table.
"""

FAMILY = 'STALLED_ADD_MONEY'
LEGACY_FAMILY = 'QR_PAID_TWICE'
CURRENCY = 'BDT'

# Presenter-facing descriptions. The scenario id is never exposed to the admin/customer projections or to tools.
SCENARIOS = {
    'worker_fault': dict(
        title='Retryable wallet worker fault',
        premise='Funding posts, the credit worker fails before crediting, and the customer is left uncertain.',
        outcome='Checks locate the worker failure and a safe replay; staff approve resuming the original intent.'),
    'lost_ack': dict(
        title='Lost acknowledgement',
        premise='The wallet credit exists but the acknowledgement and callback never reach the customer channel.',
        outcome='The ledger confirms delivery; the customer status is refreshed without moving money again.'),
    'mapping_ambiguity': dict(
        title='Mapping ambiguity, missing authority',
        premise='Source records cannot be bound reliably to the intent and a partner source is unreachable.',
        outcome='Correction is blocked; an owned handoff and evidence report carry the next requirement.'),
    'late_completion': dict(
        title='Late original completion',
        premise='Original processing is only delayed and can still credit the wallet.',
        outcome='Investigation advises waiting and prevents an unsupported return; the late credit updates the same case.'),
}
DEFAULT_SCENARIO = 'worker_fault'

BANKS = [
    dict(code='MCB', name='Meghna Commercial Bank', mask='••4821'),
    dict(code='PTB', name='Padma Trust Bank', mask='••1930'),
    dict(code='JSB', name='Jamuna Savings Bank', mask='••7742'),
]
WALLET = dict(name='upay wallet', mask='••0172')

# ---------------------------------------------------------------- graph topology
GROUPS = [
    dict(id='request', title='Customer request', blurb='The transfer instruction was accepted.'),
    dict(id='bank', title='Bank', blurb='What the bank established.'),
    dict(id='connector', title='Connector', blurb='Delivery of the instruction to the wallet partner.'),
    dict(id='wallet', title='Wallet processing', blurb='Whether the wallet actually posted credit.'),
    dict(id='confirm', title='Confirmation', blurb='Whether a trustworthy outcome reached the customer.'),
]

# order is the top-to-bottom slot order inside a group; `core` nodes are visible at the default camera
NODES = [
    dict(id='intent', group='request', title='Payment intent', core=True, kind='process'),
    dict(id='validation', group='request', title='Request validation', core=False, kind='process'),
    dict(id='authorization', group='request', title='Authorization result', core=True, kind='process'),
    dict(id='idempotency', group='request', title='Idempotency record', core=False, kind='branch'),

    dict(id='funding-check', group='bank', title='Funding check', core=False, kind='process'),
    dict(id='bank-debit', group='bank', title='Bank debit or hold', core=True, kind='ledger'),
    dict(id='bank-response', group='bank', title='Bank response', core=True, kind='process'),

    dict(id='ref-mapping', group='connector', title='Reference mapping', core=True, kind='process'),
    dict(id='retry-history', group='connector', title='Retry history', core=False, kind='branch'),
    dict(id='routing-request', group='connector', title='Routing request', core=True, kind='process'),
    dict(id='partner-ack', group='connector', title='Partner acknowledgement', core=True, kind='process'),
    dict(id='callback-delivery', group='connector', title='Callback delivery', core=False, kind='branch'),

    dict(id='wallet-ingress', group='wallet', title='Wallet ingress', core=False, kind='process'),
    dict(id='durable-queue', group='wallet', title='Durable queue', core=True, kind='process'),
    dict(id='credit-worker', group='wallet', title='Credit worker', core=True, kind='process'),
    dict(id='wallet-ledger', group='wallet', title='Wallet ledger posting', core=True, kind='ledger'),
    dict(id='dead-letter', group='wallet', title='Dead-letter and error records', core=False, kind='branch'),

    dict(id='posting-verify', group='confirm', title='Posting verification', core=False, kind='process'),
    dict(id='reconciliation', group='confirm', title='Reconciliation', core=False, kind='branch'),
    dict(id='ack-return', group='confirm', title='Acknowledgement to customer', core=True, kind='process'),
    dict(id='customer-update', group='confirm', title='Customer status update', core=True, kind='process'),
    dict(id='return-path', group='confirm', title='Controlled return path', core=False, kind='branch'),
]

# kind: request = instruction travelling forward; ack = labelled return link; branch = related service/check
EDGES = [
    dict(id='e1', source='intent', target='validation', kind='request'),
    dict(id='e2', source='validation', target='authorization', kind='request'),
    dict(id='e3', source='authorization', target='funding-check', kind='request'),
    dict(id='e4', source='funding-check', target='bank-debit', kind='request'),
    dict(id='e5', source='bank-debit', target='bank-response', kind='request'),
    dict(id='e6', source='bank-response', target='ref-mapping', kind='request'),
    dict(id='e7', source='ref-mapping', target='routing-request', kind='request'),
    dict(id='e8', source='routing-request', target='wallet-ingress', kind='request'),
    dict(id='e9', source='wallet-ingress', target='durable-queue', kind='request'),
    dict(id='e10', source='durable-queue', target='credit-worker', kind='request'),
    dict(id='e11', source='credit-worker', target='wallet-ledger', kind='request'),
    dict(id='e12', source='wallet-ledger', target='posting-verify', kind='request'),
    dict(id='e13', source='durable-queue', target='partner-ack', kind='ack', label='enqueue ack'),
    dict(id='e14', source='partner-ack', target='ack-return', kind='ack', label='ack relay'),
    dict(id='e15', source='posting-verify', target='ack-return', kind='ack', label='credit ack'),
    dict(id='e16', source='ack-return', target='customer-update', kind='ack', label='status'),
    dict(id='b1', source='intent', target='idempotency', kind='branch', label='key'),
    dict(id='b2', source='routing-request', target='retry-history', kind='branch', label='attempts'),
    dict(id='b3', source='partner-ack', target='callback-delivery', kind='branch', label='callback'),
    dict(id='b4', source='credit-worker', target='dead-letter', kind='branch', label='errors'),
    dict(id='b5', source='wallet-ledger', target='reconciliation', kind='branch', label='match'),
    dict(id='b6', source='reconciliation', target='return-path', kind='branch', label='return option'),
]

TOPOLOGY = dict(groups=GROUPS, nodes=NODES, edges=EDGES)
NODE_IDS = {n['id'] for n in NODES}

# ---------------------------------------------------------------- investigation vocabulary
HYPOTHESES = [
    dict(id='ack_lost', title='Credit posted, acknowledgement lost'),
    dict(id='still_pending', title='Processing is still pending at the partner'),
    dict(id='mapping', title='Reference mapping mismatch'),
    dict(id='worker_retryable', title='Retryable worker failure before credit'),
    dict(id='duplicate', title='Duplicate-intent risk'),
    dict(id='source_unavailable', title='A required source is unavailable'),
]
HYPOTHESIS_STATUSES = ('unchecked', 'supported', 'ruled_out', 'unresolved')

TOOLS = {
    'bank_record_check': dict(label='Bank record check', node='bank-debit', source='Bank posting records'),
    'wallet_ledger_check': dict(label='Wallet ledger check', node='wallet-ledger', source='Wallet ledger adapter'),
    'partner_status_check': dict(label='Partner status check', node='partner-ack', source='Partner status endpoint'),
    'attempt_history_check': dict(label='Attempt and retry history', node='retry-history', source='Connector attempt log'),
    'mapping_check': dict(label='Reference mapping check', node='ref-mapping', source='Connector mapping table'),
    'worker_error_check': dict(label='Worker and error-record check', node='credit-worker', source='Authorized worker logs'),
    'eligibility_check': dict(label='Correction-eligibility check', node='reconciliation', source='Correction contract'),
}

CORRECTION_KINDS = {
    'RESUME_ORIGINAL': dict(label='Resume original processing', money=True),
    'REFRESH_CUSTOMER_STATUS': dict(label='Refresh the customer status', money=False),
    'MONITOR_ORIGINAL': dict(label='Wait for the original transfer and keep an owned follow-up', money=False),
    'RETURN_FUNDS': dict(label='Request a controlled return', money=True),
}

# Fixture timing, in synthetic milliseconds. The incident threshold is a disclosed fixture setting.
INCIDENT_AFTER_MS = 14000
ACK_TIMEOUT_AFTER_MS = 8200
CHECK_DURATION_MS = 1100
CHECK_GAP_MS = 900
DEFAULT_CHECK_BUDGET = 8
