"""DataDNA: a purpose-bound gate for every personal-data access the investigation automation makes.

Every data call answers five questions before any record reaches the investigation:

    1 WHY?        customer consent and transaction purpose: did the customer ask for this, and is the data needed?
    2 WHO?        parties: customer, issuing bank, wallet partner or payments operator, and the authority each holds
    3 WHERE?      systems: the bank, connector and wallet records of this payment only, and no other holder's data
    4 HOW?        masking: read-only, allow-listed fields, account and wallet numbers masked or withheld before release
    5 UNTIL WHEN? retention: the transaction-record schedule and its expiry

It runs in two places. Every hop the add-money engine makes (customer app, issuing bank, wallet partner, acknowledgement,
customer status) is reviewed as the payment moves, and every read the investigation automation makes is gated before it runs.

The module is pure over its arguments. It has no database handle, no scenario label and no access to the simulator, so a
verdict can only come from the request, the actor context and the record the tool actually returned. Each decision is a
saved, immutable journal event; the operator sees what the AI did and why, instead of reviewing every access by hand.

Decisions: ``passed`` (all gates clear), ``controlled`` (released with a control such as masking) and ``blocked`` (a gate
failed: the access, or the part of it that touched protected data, was refused). A refused request is never fetched.

The principle names below are a plain-language mapping of common data-protection duties, not legal advice. Confirm the
clause references against the PDPA text with counsel before production use. Retention periods are fixture settings.
"""
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

DISCLOSURE = ('DataDNA is rules-based and runs on synthetic records. Principle names are a plain-language mapping of data-protection '
              'duties to be confirmed against the PDPA text by counsel. Retention periods are fixture settings; scheduled deletion is recorded, not executed.')

GATES = [
    dict(id='why', n=1, question='Why?', term='Customer consent', title='Customer consent and transaction purpose',
         asks='Did the customer ask for this add-money transfer, and is this data needed to complete or resolve it?'),
    dict(id='who', n=2, question='Who?', term='Parties', title='Customer, bank, wallet partner or operator',
         asks='Which party is asking, and are they allowed to see this on this payment?'),
    dict(id='where', n=3, question='Where?', term='Systems', title='Bank, connector and wallet systems',
         asks='Does it stay with this payment\'s bank, connector and wallet records, with no other holder\'s data?'),
    dict(id='how', n=4, question='How?', term='Masking', title='Masked account and wallet numbers',
         asks='Is only the needed field released, read-only, with account and wallet numbers masked?'),
    dict(id='until', n=5, question='Until when?', term='Retention', title='Transaction-record retention',
         asks='Is there a retention schedule for this payment record, and when does it expire?'),
]
GATE_IDS = [g['id'] for g in GATES]

PRINCIPLES = {
    'purpose_limitation': dict(title='Transaction purpose', gate='why', blurb='Use data only for the purpose it was collected or opened for.'),
    'lawful_basis': dict(title='Customer consent and lawful basis', gate='why', blurb='Every use of personal data needs a recorded lawful basis.'),
    'need_to_know': dict(title='Operator need-to-know', gate='who', blurb='Only the right people, with the right authority, see personal data.'),
    'scope_limitation': dict(title='This payment only', gate='where', blurb='Reach no further than the matter under investigation.'),
    'third_party_data': dict(title='Other wallet holders\' data', gate='where', blurb='Other people\'s data is not read without their basis or consent.'),
    'cross_org': dict(title='Bank and wallet-partner disclosure', gate='where', blurb='Data leaving for a partner or file export is limited and logged.'),
    'minimisation': dict(title='Only the fields needed', gate='how', blurb='Take only the fields the purpose needs.'),
    'identifier_masking': dict(title='Account and wallet-number masking', gate='how', blurb='Direct identifiers are masked or withheld.'),
    'storage_limitation': dict(title='Transaction-record retention', gate='until', blurb='Keep data only as long as the purpose needs, with a schedule.'),
}

PURPOSES = {
    'process_add_money': dict(label='Process the customer\'s add-money request', basis='contract',
                              basis_label='Performance of the add-money transfer the customer requested'),
    'resolve_unconfirmed_credit': dict(label='Resolve an unconfirmed wallet credit for this payment', basis='contract',
                                       basis_label='Performance of the add-money transfer the customer requested'),
    'verify_correction': dict(label='Confirm an approved correction posted correctly', basis='contract',
                              basis_label='Performance of the add-money transfer the customer requested'),
    'accountability_record': dict(label='Keep an accountable record of the investigation', basis='legitimate_interest',
                                  basis_label='Legitimate interest in an auditable investigation record'),
}

PERSONAL = {'financial', 'payment_ref', 'account_identifier', 'contact', 'identity'}
CLASS_LABEL = dict(financial='Transaction amount and posting', payment_ref='Payment or posting reference', account_identifier='Bank account or wallet number (MSISDN)',
                   contact='Phone or email', identity='Name or national ID', ops='Processing state and logs')

PHONE = re.compile(r'(?<![\w])(?:\+?880|0)1\d{9}(?![\w])')
LONG_DIGITS = re.compile(r'(?<![\w.,])\d{9,}(?![\w.,])')  # not inside an alphanumeric id such as dna_0123456789ab
EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')


def retention_days(cls):
    base = int(os.environ.get('TRACEFIX_DATADNA_RETENTION_DAYS', '90') or 90)
    return base if cls == 'personal' else min(30, base)


def retention_class(classes):
    return 'personal' if any(c in PERSONAL for c in classes) else 'ops'


# ---------------------------------------------------------------------------------------------------- profiles
def _f(name, cls, action, note):
    return dict(name=name, cls=cls, action=action, note=note)


TOOL_PROFILES = {
    'bank_record_check': dict(
        purposes=('resolve_unconfirmed_credit',), source='Bank posting records', system='Funding bank posting ledger', cross_org=True,
        cross_note='The bank record is located by this payment\'s reference only. No customer name, phone or account number is sent.',
        necessity='required', subject='self', scope='intent', direct_ids=False,
        fields=[_f('Intent amount and currency', 'financial', 'release', 'Needed to compare with the posted debit.'),
                _f('Debit posting reference', 'payment_ref', 'release', 'Cited as evidence in the report.'),
                _f('Debit amount and posted time', 'financial', 'release', 'Needed to show the debit is exact.'),
                _f('Customer bank account on the posting line', 'account_identifier', 'exclude', 'Not needed to confirm that a debit exists. Never selected.')],
        allow={'intent_amount_minor', 'currency', 'debit_count', 'debits', 'returns', 'amount_matches'}),
    'wallet_ledger_check': dict(
        purposes=('resolve_unconfirmed_credit', 'verify_correction'), source='Wallet ledger adapter', system='upay wallet ledger', cross_org=False,
        necessity='required', subject='self', scope='intent', direct_ids=False,
        fields=[_f('Credit posting reference and amount', 'financial', 'release', 'Needed to prove whether the credit posted.'),
                _f('Posted time and attempt number', 'ops', 'release', 'Shows which attempt credited the wallet.'),
                _f('Wallet account on the ledger line', 'account_identifier', 'exclude', 'Not needed to prove a credit exists. Never selected.')],
        allow={'found', 'posting', 'as_of'}),
    'partner_status_check': dict(
        purposes=('resolve_unconfirmed_credit',), source='Partner status endpoint', system='Wallet partner status service', cross_org=True,
        cross_note='The partner is asked about this payment reference only. No customer identifiers are shared with it.',
        necessity='required', subject='none', scope='intent', direct_ids=False,
        fields=[_f('Processing state and capabilities', 'ops', 'release', 'Tells whether the original can still complete.'),
                _f('Callback delivery status', 'ops', 'release', 'Explains a lost acknowledgement.'),
                _f('Partner-side customer details', 'identity', 'exclude', 'Not needed to read processing state. Never selected.')],
        allow={'source_available', 'detail', 'state', 'capabilities', 'callback'}),
    'attempt_history_check': dict(
        purposes=('resolve_unconfirmed_credit',), source='Connector attempt log', system='Connector attempt log', cross_org=False,
        necessity='required', subject='none', scope='intent', direct_ids=False,
        fields=[_f('Attempt numbers, kind and connector outcome', 'ops', 'release', 'Needed to rule out a duplicate intent.')],
        allow={'count', 'attempts'}),
    'mapping_check': dict(
        purposes=('resolve_unconfirmed_credit',), source='Connector mapping table', system='Connector mapping table', cross_org=False,
        necessity='required', subject='dynamic', scope='intent', direct_ids=True, maskable=True,
        fields='dynamic', allow={'verified', 'ambiguous', 'candidates', 'candidate_count', 'candidate_tokens'}),
    'worker_error_check': dict(
        purposes=('resolve_unconfirmed_credit',), source='Authorized worker logs', system='Credit worker logs', cross_org=False,
        necessity='required', subject='none', scope='intent', direct_ids=True, maskable=True,
        fields=[_f('Log level, code and message', 'ops', 'release', 'Needed to locate a worker error. Free text is scanned for identifiers.'),
                _f('Attempt number and retryable flag', 'ops', 'release', 'Needed to judge whether a replay is safe.')],
        allow={'available', 'record_count', 'records', 'error', 'warnings'}),
    'eligibility_check': dict(
        purposes=('resolve_unconfirmed_credit',), source='Correction contract', system='Correction contract rules', cross_org=False,
        necessity='required', subject='none', scope='intent', direct_ids=False,
        fields=[_f('Derived eligibility facts and reasons', 'ops', 'release', 'Computed from checks already released. No new source is read.')],
        allow={'options', 'missing_proof', 'facts'}),
}

EXPORT_PROFILE = dict(
    purposes=('accountability_record',), source='Saved operator report', system='DataUkil report store', cross_org=True,
    cross_note='The export leaves the platform as a file. The download is recorded against the investigator.',
    necessity='required', subject='none', scope='intent', direct_ids=True, maskable=True,
    fields=[_f('Report text built from released observations', 'ops', 'release', 'Contains only fields already released by the gates.')], allow=set())

# AI follow-up requests. The investigation planner may ask for more context than the purpose needs; DataDNA decides.
FOLLOWUPS = {
    'internal_credentials': dict(
        label='Internal credentials and service secrets', source='Internal credential vault', system='Synthetic credential vault',
        ask='The chatbot was persuaded to request service credentials or backend secrets.',
        necessity='not_needed', authority='dpo', scope='wider', subject='none', cross_org=False, source_approved=False,
        direct_ids=True, maskable=False, retention=None, classes=('ops',),
        fields=[_f('Service API tokens', 'ops', 'withhold', 'Credentials are never available to a customer assistant.'),
                _f('Database passwords and signing keys', 'ops', 'withhold', 'Secrets are outside the payment support purpose.')],
        alternative='Explain the customer-facing payment flow without accessing any credentials.'),
    'internal_configuration': dict(
        label='Internal backend configuration', source='Internal operations configuration', system='Synthetic operations store',
        ask='The chatbot was persuaded to request internal configuration, private endpoints or backend instructions.',
        necessity='not_needed', authority='dpo', scope='wider', subject='none', cross_org=False, source_approved=False,
        direct_ids=False, maskable=False, retention=None, classes=('ops',),
        fields=[_f('Private configuration and operational instructions', 'ops', 'withhold', 'Outside customer payment support.')],
        alternative='Use public support instructions and the signed-in customer status page.'),
    'bank_statement_history': dict(
        label='Customer bank statement (last 90 days)', trigger='bank_record_check', source='Funding bank statements', system='Funding bank statement export',
        ask='To rule out a duplicate payment, the AI asked for the customer\'s wider bank history.',
        necessity='not_needed', authority='consent', scope='wider', subject='self', cross_org=True, source_approved=False,
        direct_ids=True, maskable=False, retention=None,
        classes=('financial', 'account_identifier'),
        fields=[_f('Every transaction in the last 90 days', 'financial', 'withhold', 'Reaches beyond this payment.'),
                _f('Full bank account number', 'account_identifier', 'withhold', 'Direct identifier that cannot be masked and still used.')],
        alternative='Use the attempt history for this intent. It answers the duplicate question without wider financial history.'),
    'customer_contact_details': dict(
        label='Customer phone and email', trigger='partner_status_check', source='Customer profile service', system='Customer profile service',
        ask='To test whether the missed confirmation reached the customer\'s device, the AI asked for their contact details.',
        necessity='supporting', authority=None, scope='intent', subject='self', cross_org=False, source_approved=True,
        direct_ids=True, maskable=False, retention=None, less_intrusive='The signed-in customer status page already receives every update, so contact details are not required.',
        classes=('contact',),
        fields=[_f('Phone number', 'contact', 'withhold', 'Direct identifier. A masked value cannot be used to send a message.'),
                _f('Email address', 'contact', 'withhold', 'Direct identifier. A masked value cannot be used to send a message.')],
        alternative='Refresh the customer status inside the signed-in page. No contact details are read.'),
    'candidate_wallet_holders': dict(
        label='Names and phones of the candidate wallet holders', trigger='mapping_check', source='Wallet holder directory', system='Wallet holder directory',
        ask='To work out which wallet the customer meant, the AI asked who holds each candidate wallet.',
        necessity='supporting', authority='dpo', scope='intent', subject='third_party', cross_org=False, source_approved=True,
        direct_ids=True, maskable=False, retention=None,
        classes=('identity', 'contact'),
        fields=[_f('Holder names', 'identity', 'withhold', 'Belongs to people who are not party to this complaint.'),
                _f('Holder phone numbers', 'contact', 'withhold', 'Belongs to people who are not party to this complaint.')],
        alternative='Ask the wallet partner to confirm the intended wallet. Other holders\' details are not read.'),
}


def followups(tool, obs):
    """Request ids the planner would raise after a returned observation. Pure over the observation."""
    out = []
    status = obs.get('status')
    data = obs.get('data') or {}
    if tool == 'bank_record_check' and status == 'completed':
        out.append('bank_statement_history')
    if tool == 'partner_status_check' and status == 'completed' and (data.get('callback') or {}).get('status') == 'FAILED':
        out.append('customer_contact_details')
    if tool == 'mapping_check' and status == 'completed' and data.get('ambiguous'):
        out.append('candidate_wallet_holders')
    return out


# ---------------------------------------------------------------------------------------------------- context
def open_envelope(actor, actor_label, case, payment, *, purpose_id='resolve_unconfirmed_credit', budget=None, tools=None):
    p = PURPOSES[purpose_id]
    return dict(id='ENV-' + secrets.token_hex(3).upper(), purpose_id=purpose_id, purpose=p['label'], basis=p['basis'], basis_label=p['basis_label'],
                actor=actor, actor_label=actor_label, scope=f"this intent only ({payment['reference']})", reference=payment['reference'],
                tools=sorted(tools if tools is not None else TOOL_PROFILES), budget=budget, granted_at=_now(),
                retention_days=retention_days('personal'), subject='the paying customer')


def context(case, payment, envelope, *, actor, actor_label, role='staff', origin='investigation', authorities=()):
    return dict(actor=actor, actor_label=actor_label, role=role, owner=case['owner'], owner_label=_owner_label(case['owner']), case_id=case['id'],
                payment_id=payment['id'], reference=payment['reference'], envelope=envelope, origin=origin, authorities=tuple(authorities))


def _owner_label(actor):
    return {'staff_1': 'Investigator 1', 'staff_2': 'Investigator 2'}.get(actor, actor)


def _now():
    return datetime.now(timezone.utc).isoformat()


def _expiry(days):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


# ---------------------------------------------------------------------------------------------------- evaluation
def _chk(label, status, note, concern=None, handling=None, alternative=None, severity=None):
    return dict(label=label, status=status, note=note, concern=concern, handling=handling, alternative=alternative, severity=severity)


def mask_ref(value):
    s = str(value or '')
    return s if len(s) <= 2 else s[:2] + '\u2022\u2022\u2022\u2022' + s[-2:]


def scrub(text):
    """Mask phone numbers, e-mail addresses and long digit runs in free text. Returns (clean, count)."""
    n = 0

    def sub(m):
        nonlocal n
        n += 1
        return '[masked]'
    out = text
    for rx in (EMAIL, PHONE, LONG_DIGITS):
        out = rx.sub(sub, out)
    return out, n


def _attrs(profile, facts):
    a = dict(profile)
    if a.get('subject') == 'dynamic':
        a['subject'] = 'third_party' if facts and facts.get('third_party') else 'self'
    a.setdefault('authority', None)
    a.setdefault('source_approved', True)
    a.setdefault('less_intrusive', None)
    a.setdefault('maskable', True)
    a.setdefault('retention', 'auto')
    return a


def _why(ctx, a, label_purposes):
    env = ctx.get('envelope')
    out = []
    if not env:
        out.append(_chk('An access envelope covers this request', 'fail', 'No investigation purpose is open, so there is nothing to bound this access.',
                        'purpose_limitation', handling='The request was refused before any record was read.', severity='high'))
    else:
        out.append(_chk('An access envelope covers this request', 'ok', f"{env['id']} · {env['purpose']}"))
        if env['purpose_id'] not in label_purposes:
            out.append(_chk('Request purpose matches the envelope', 'fail', f"This source is not authorised for the purpose \"{env['purpose']}\".",
                            'purpose_limitation', handling='The request was refused before any record was read.', severity='high'))
        else:
            out.append(_chk('Request purpose matches the envelope', 'ok', 'The source is declared for this purpose.'))
    if a['necessity'] == 'not_needed':
        out.append(_chk('Necessary for the purpose', 'fail', a.get('ask', '') + ' The question can be answered without it.', 'purpose_limitation',
                        handling='Refused. Nothing was fetched.', alternative=a.get('alternative'), severity='high'))
    else:
        out.append(_chk('Necessary for the purpose', 'ok', 'Required evidence.' if a['necessity'] == 'required' else 'Supports the investigation.'))
    if env:
        if a['scope'] == 'wider':
            out.append(_chk('Lawful basis covers this data', 'fail', f"{env['basis_label']} covers this payment only, not the customer's wider history.",
                            'lawful_basis', handling='Refused. Nothing was fetched.', alternative=a.get('alternative'), severity='high'))
        else:
            out.append(_chk('Lawful basis covers this data', 'ok', env['basis_label']))
    return out


def _who(ctx, a):
    out = []
    if ctx['role'] != 'staff':
        out.append(_chk('Requester is a signed-in payments operator', 'fail', f"A {ctx['role']} session cannot request investigation data.", 'need_to_know',
                        handling='The request was refused before any record was read.', severity='high'))
    else:
        out.append(_chk('Requester is a signed-in payments operator', 'ok', f"DataUkil AI acting for {ctx['actor_label']}."))
    if ctx['actor'] == ctx['owner']:
        out.append(_chk('Investigator owns the case', 'ok', f"{ctx['owner_label']} owns this case."))
    else:
        out.append(_chk('Investigator owns the case', 'control', f"{ctx['actor_label']} is not the case owner ({ctx['owner_label']}). Access is allowed for review and logged for need-to-know.",
                        'need_to_know', handling='Released with the investigator named in the record.', severity='low'))
    if a['authority']:
        held = a['authority'] in ctx['authorities']
        need = {'consent': "the customer's explicit consent", 'dpo': 'sign-off from the Data Protection Officer'}[a['authority']]
        if held:
            out.append(_chk('Required authority is on record', 'ok', f'{need.capitalize()} is on record.'))
        else:
            out.append(_chk('Required authority is on record', 'fail', f'This data needs {need}. None is on record, and the AI cannot grant itself one.', 'need_to_know',
                            handling='Refused. Nothing was fetched.', alternative=a.get('alternative'), severity='high'))
    return out


def _where(ctx, a, facts):
    out = []
    if a['source_approved']:
        out.append(_chk('Source is on the approved list', 'ok', a.get('source', '')))
    else:
        out.append(_chk('Source is on the approved list', 'fail', f"{a.get('source', 'This source')} is not an approved source for this purpose.", 'scope_limitation',
                        handling='Refused. Nothing was fetched.', alternative=a.get('alternative'), severity='medium'))
    if a['scope'] == 'intent':
        out.append(_chk('Scope limited to this intent', 'ok', f"{ctx['reference']} only."))
    else:
        out.append(_chk('Scope limited to this intent', 'fail', f"The request reaches beyond {ctx['reference']} into the customer's wider history.", 'scope_limitation',
                        handling='Refused. Nothing was fetched.', alternative=a.get('alternative'), severity='high'))
    if a['subject'] == 'third_party':
        n = (facts or {}).get('candidates')
        detail = (f"{n} candidate wallets are unverified and may belong to other people. " if n else 'The data belongs to people who are not party to this complaint. ') + \
                 'Their details need their own basis or consent.'
        out.append(_chk('Account belongs to this customer', 'fail', detail, 'third_party_data',
                        handling=(facts or {}).get('handling') or 'Refused. Nothing was fetched.', alternative=a.get('alternative'), severity='high'))
    else:
        out.append(_chk('Account belongs to this customer', 'ok', "The paying customer's own payment." if a['subject'] == 'self' else 'No personal data of a third party.'))
    if a['cross_org']:
        out.append(_chk('Bank or wallet-partner flow is limited', 'control', a.get('cross_note') or 'Data would leave for another organisation.', 'cross_org',
                        handling='Only the payment reference crosses the boundary; the call is logged.', severity='low'))
    return out


def _how(ctx, a, fields, facts):
    out = [_chk('Read-only access', 'ok', 'No tool behind the gate can write or move money.')]
    withheld = [f for f in fields if f['action'] == 'withhold']
    excluded = [f for f in fields if f['action'] == 'exclude']
    masked = [f for f in fields if f['action'] == 'mask']
    if a['direct_ids']:
        if withheld and not a['maskable']:
            out.append(_chk('Account and wallet numbers protected', 'fail', 'The request needs direct identifiers in clear text. A masked value cannot serve the request.', 'identifier_masking',
                            handling='Refused. Nothing was fetched.', alternative=a.get('alternative'), severity='high'))
        elif (facts or {}).get('withheld'):
            out.append(_chk('Account and wallet numbers protected', 'fail', f"{facts['withheld']} identifier(s) were withheld before release because their holder is unverified.", 'identifier_masking',
                            handling='Only the count of candidates was released. Identifiers were replaced before the record reached the investigation.', alternative=a.get('alternative'), severity='high'))
        elif masked or (facts or {}).get('scrubbed'):
            n = (facts or {}).get('scrubbed') or len(masked)
            out.append(_chk('Account and wallet numbers protected', 'control', f"{n} identifier(s) were masked before release.", 'identifier_masking',
                            handling='Masked values were released; the unmasked values never reached the investigation.', severity='low'))
        else:
            out.append(_chk('Account and wallet numbers protected', 'ok', 'No direct identifiers were present in the released record.'))
    else:
        out.append(_chk('Account and wallet numbers protected', 'ok', 'No direct identifiers are requested.'))
    if a.get('less_intrusive'):
        out.append(_chk('Least intrusive method', 'fail', a['less_intrusive'], 'minimisation', handling='Refused. Nothing was fetched.', alternative=a.get('alternative'), severity='medium'))
    elif excluded or (facts or {}).get('dropped'):
        names = [f['name'] for f in excluded] + [f"unlisted field {k}" for k in (facts or {}).get('dropped', [])]
        out.append(_chk('Fields limited to an allow-list', 'control', 'Not selected: ' + '; '.join(names) + '.', 'minimisation',
                        handling='Only allow-listed fields were read and released.', severity='low'))
    else:
        out.append(_chk('Fields limited to an allow-list', 'ok', 'Only the fields the purpose needs.'))
    return out


def _until(ctx, a, classes):
    out = []
    if a['retention'] is None:
        out.append(_chk('A storage schedule exists', 'fail', 'No retention schedule exists for this data under this purpose, so it would be kept without an end date.',
                        'storage_limitation', handling='Refused. Nothing was stored.', alternative=a.get('alternative'), severity='medium'))
    else:
        cls = retention_class(classes)
        out.append(_chk('A storage schedule exists', 'ok', f"{retention_days(cls)} days after the case closes ({'personal data' if cls == 'personal' else 'processing records'})."))
    return out


def _gate_status(checks):
    if any(c['status'] == 'fail' for c in checks):
        return 'block'
    if any(c['status'] == 'control' for c in checks):
        return 'control'
    return 'pass'


def _headline(gate, status, checks):
    for c in checks:
        if c['status'] == 'fail':
            return c['note']
    if status == 'control':
        c = next(c for c in checks if c['status'] == 'control')
        return c['note']
    return {'why': 'Purpose and basis confirmed.', 'who': 'Requester authorised.', 'where': 'Approved source, this intent, own data.',
            'how': 'Read-only, field-limited, identifier-safe.', 'until': 'Storage schedule assigned.'}[gate]


def _fields_for(tool, profile, facts, result):
    if profile['fields'] != 'dynamic':
        return [dict(f) for f in profile['fields']]
    third = bool(facts and facts.get('third_party'))
    n = (facts or {}).get('candidates', 0)
    return [_f('Number of matching wallets', 'ops', 'release', 'Needed to tell whether the reference is ambiguous.'),
            _f('Candidate wallet reference', 'account_identifier', 'withhold' if third else 'mask', f"{n} candidates are unverified, so their references are withheld." if third else 'Masked to its first and last characters.'),
            _f('Candidate wallet label', 'account_identifier', 'withhold' if third else 'release', 'Unverified wallets may belong to other people.' if third else "The customer's own wallet, already masked.")]


def _release(tool, profile, result):
    """Filter the raw tool result to the allow-list and redact it. Returns (clean_result, facts)."""
    facts = dict(dropped=[], withheld=0, scrubbed=0, third_party=False, candidates=0)
    data = dict(result.get('data') or {})
    allow = profile['allow']
    if allow:
        for k in [k for k in data if k not in allow]:
            facts['dropped'].append(k)
            data.pop(k)
    if tool == 'mapping_check':
        cands = data.get('candidates') or []
        facts['candidates'] = len(cands)
        if data.get('verified') and not data.get('ambiguous'):
            # The access policy may already have reduced candidates to opaque tokens; only legacy rows carry a reference to mask.
            data['candidates'] = [dict(ref=mask_ref(c.get('ref')), label=c.get('label')) if ('ref' in c or 'label' in c) else dict(c) for c in cands]
        else:
            facts['third_party'] = True
            facts['withheld'] = len(cands) * 2
            facts['handling'] = f"Only the count of candidate wallets was released. {len(cands) * 2} identifiers were withheld before they reached the investigation."
            data['candidates'] = [dict(ref='withheld', label=f'Unverified wallet {i + 1} (holder not disclosed)', **({'token': c['token']} if c.get('token') else {})) for i, c in enumerate(cands)]
    if tool == 'worker_error_check':
        count = 0

        def clean(row):
            nonlocal count
            row = dict(row)
            for k in ('message',):
                if isinstance(row.get(k), str):
                    row[k], c = scrub(row[k])
                    count += c
            return row
        if data.get('records'):
            data['records'] = [clean(r) for r in data['records']]
        if data.get('error'):
            data['error'] = clean(data['error'])
        facts['scrubbed'] = count
    out = dict(result)
    out['data'] = data
    return out, facts


def _evaluate(ctx, profile, *, tool=None, facts=None, result=None, request_id=None, extra_classes=()):
    a = _attrs(profile, facts)
    a['source'] = profile.get('source')
    fields = _fields_for(tool, profile, facts, result)
    classes = tuple(profile.get('classes') or sorted({f['cls'] for f in fields if f['action'] != 'exclude'}))
    gates = []
    why = _why(ctx, a, profile['purposes'] if 'purposes' in profile else ('resolve_unconfirmed_credit',))
    gates.append(('why', why))
    gates.append(('who', _who(ctx, a)))
    gates.append(('where', _where(ctx, a, facts)))
    gates.append(('how', _how(ctx, a, fields, facts)))
    gates.append(('until', _until(ctx, a, classes)))
    out = []
    concerns = []
    for gid, checks in gates:
        st = _gate_status(checks)
        meta = next(g for g in GATES if g['id'] == gid)
        out.append(dict(id=gid, n=meta['n'], question=meta['question'], title=meta['title'], status=st, headline=_headline(gid, st, checks), checks=checks))
        for c in checks:
            if c['concern'] and c['status'] in ('fail', 'control'):
                p = PRINCIPLES[c['concern']]
                concerns.append(dict(code=c['concern'], principle=p['title'], gate=gid, severity=c['severity'] or ('high' if c['status'] == 'fail' else 'low'),
                                     status='blocked' if c['status'] == 'fail' else 'mitigated', title=c['label'], detail=c['note'],
                                     handling=c['handling'], alternative=c['alternative']))
    return dict(gates=out, fields=fields, concerns=concerns, classes=list(classes), attrs=a)


def _decision(gates):
    sts = [g['status'] for g in gates]
    if 'block' in sts:
        return 'blocked'
    if 'control' in sts:
        return 'controlled'
    return 'passed'


def _answers(ctx, ev, a, decision, outcome, fields, label):
    env = ctx.get('envelope') or {}
    released = sum(1 for f in fields if f['action'] == 'release')
    masked = sum(1 for f in fields if f['action'] == 'mask')
    withheld = sum(1 for f in fields if f['action'] in ('withhold', 'exclude'))
    retained = outcome != 'denied'
    cls = retention_class(ev['classes'])
    days = retention_days(cls)
    return dict(
        why=dict(answer=env.get('purpose') or 'No purpose is open', basis=env.get('basis_label'), necessity=a['necessity']),
        who=dict(answer=f"DataUkil AI for {ctx['actor_label']}", requester='DataUkil AI (rules-based)', on_behalf_of=ctx['actor_label'], role=ctx['role'], owner=ctx['owner_label'],
                 subject={'self': 'the paying customer', 'none': 'no individual (system record)', 'third_party': 'people who are not party to this complaint'}[a['subject']]),
        where=dict(answer=f"{a.get('source')} · {ctx['reference']} only" if a['scope'] == 'intent' else f"{a.get('source')} · beyond {ctx['reference']}", system=a.get('system') or a.get('source'),
                   scope='this intent' if a['scope'] == 'intent' else 'wider than this intent', cross_org=bool(a['cross_org'])),
        how=dict(answer=('Read-only. ' + f"{released} released, {masked} masked, {withheld} withheld.") if outcome != 'denied' else f"Refused before reading. {withheld} requested fields withheld.",
                 released=released, masked=masked, withheld=withheld, method='read-only, allow-listed fields'),
        until=dict(answer=(f"{days} days after the case closes" if retained else 'Nothing retained'), days=days if retained else 0,
                   expires_at=_expiry(days) if retained else None, class_=cls if retained else None))


def _summary(label, decision, outcome, blocked_at, gates, concerns, followup=False):
    if decision == 'passed':
        return f"{label}: all five gates cleared."
    if decision == 'controlled':
        c = [c for c in concerns if c['status'] == 'mitigated']
        return f"{label}: released with {len(c)} control{'s' if len(c) != 1 else ''}."
    gate = next(g for g in gates if g['id'] == blocked_at)
    n = len([c for c in concerns if c['status'] == 'blocked'])
    if outcome == 'denied':
        return f"{label}: refused at gate {gate['n']} ({gate['question']}). {n} concern{'s' if n != 1 else ''} flagged; nothing was fetched."
    return f"{label}: partially blocked at gate {gate['n']} ({gate['question']}). Protected identifiers were withheld; {n} concern{'s' if n != 1 else ''} flagged."


def _record(ctx, kind, label, ev, decision, outcome, *, tool=None, check_id=None, request_id=None, trigger=None, sim_ms=0, observation_id=None, note=None, ask=None, answers=None, extra=None):
    gates = ev['gates']
    blocked_at = next((g['id'] for g in gates if g['status'] == 'block'), None)
    a = ev['attrs']
    return dict(id='DNA-' + secrets.token_hex(3).upper(), kind=kind, tool=tool, request=request_id, label=label, check_id=check_id, observation_id=observation_id, trigger=trigger,
                decision=decision, outcome=outcome, blocked_at=blocked_at, ask=ask, summary=_summary(label, decision, outcome, blocked_at, gates, ev['concerns']),
                dna=answers or _answers(ctx, ev, a, decision, outcome, ev['fields'], label), gates=gates, fields=ev['fields'], concerns=ev['concerns'],
                envelope_id=(ctx.get('envelope') or {}).get('id'), purpose=(ctx.get('envelope') or {}).get('purpose'), actor=ctx['actor'], actor_label=ctx['actor_label'],
                origin=ctx['origin'], sim_ms=sim_ms, note=note, **(extra or {}))


# ---------------------------------------------------------------------------------------------------- public API
def gate_tool(ctx, tool, run, *, check_id=None, sim_ms=0):
    """Gate one read-only tool call. `run()` returns the raw tool result and is called only if the pre-read gates allow it.

    Returns ``(result_or_None, record)``. A refused call returns ``None`` and nothing was read. An allowed call returns the
    allow-listed, redacted result; that filtered result is the only thing the investigation can see or store.
    """
    profile = TOOL_PROFILES[tool]
    label = _tool_label(tool)
    pre = _evaluate(ctx, profile, tool=tool)
    if any(g['status'] == 'block' and g['id'] in ('why', 'who') for g in pre['gates']):
        return None, _record(ctx, 'check', label, pre, 'blocked', 'denied', tool=tool, check_id=check_id, sim_ms=sim_ms)
    raw = run()
    clean, facts = _release(tool, profile, raw)
    ev = _evaluate(ctx, profile, tool=tool, facts=facts, result=clean)
    decision = _decision(ev['gates'])
    outcome = 'partial' if decision == 'blocked' else 'released'
    return clean, _record(ctx, 'check', label, ev, decision, outcome, tool=tool, check_id=check_id, sim_ms=sim_ms)


def review_request(ctx, request_id, *, trigger=None, sim_ms=0):
    """Gate an AI follow-up request. Nothing is fetched unless every gate clears (none of the built-in requests do)."""
    prof = dict(FOLLOWUPS[request_id])
    prof.setdefault('purposes', ('resolve_unconfirmed_credit',))
    prof['allow'] = set()
    ev = _evaluate(ctx, prof, request_id=request_id)
    decision = _decision(ev['gates'])
    outcome = 'denied' if decision == 'blocked' else 'released'
    return _record(ctx, 'ai_request', prof['label'], ev, decision, outcome, request_id=request_id, trigger=trigger, sim_ms=sim_ms, ask=prof['ask'])


def scan_export(text):
    _, n = scrub(text)
    return n


def review_export(ctx, fmt, text, *, sim_ms=0):
    """Gate a report download. The scan is run over the exact bytes about to leave the platform."""
    found = scan_export(text)
    facts = dict(scrubbed=0, withheld=found)
    prof = dict(EXPORT_PROFILE)
    ev = _evaluate(ctx, prof, tool='report_export', facts=facts)
    decision = _decision(ev['gates'])
    label = f"Report export ({fmt.upper()})"
    return _record(ctx, 'export', label, ev, decision, 'denied' if decision == 'blocked' else 'released', tool='report_export', sim_ms=sim_ms,
                   note=f"Scanned the file: {found} unmasked identifier(s) found.")


def _tool_label(tool):
    from . import catalog
    return catalog.TOOLS[tool]['label']


def blocked_result(tool, record):
    from . import catalog
    reasons = [c['detail'] for c in record['concerns'] if c['status'] == 'blocked'] or [record['summary']]
    spec = catalog.TOOLS[tool]
    return dict(status='blocked', summary='DataDNA refused this check before any record was read. ' + reasons[0], data=dict(blocked=True, reasons=reasons),
                node_updates=[dict(node_id=spec['node'], state='unavailable', title='Blocked by DataDNA', fact=reasons[0])],
                source=spec['source'], scope='refused', tool=tool)


# ---------------------------------------------------------------------------------------------------- payment hops
# The add-money engine moves a payment through five hand-offs. Each is reviewed as it happens, using only facts read from
# the saved records (never the simulator's scenario label), so the same rules apply to every scenario.
HOP_ORDER = ['request', 'bank', 'partner', 'ack', 'customer']
HOPS = {
    'request': dict(
        n=1, label='Customer add-money request', node='intent', frm='Customer app', to='Add-money service', party='the paying customer',
        system='DataUkil add-money service', cross_org=False,
        need='The amount and the two accounts are needed to create the transfer.', consent='The customer confirmed the amount and accounts on the review step.',
        fields=[_f('Amount and currency', 'financial', 'release', 'Needed to create the transfer.'),
                _f('Funding bank account', 'account_identifier', 'mask', 'Stored and shown as the bank name and last four digits.'),
                _f('Destination wallet number (MSISDN)', 'account_identifier', 'mask', 'Stored and shown with the middle digits hidden.'),
                _f('Idempotency key', 'ops', 'release', 'Stops a double tap from creating a second transfer.')]),
    'bank': dict(
        n=2, label='Funding request to the issuing bank', node='bank-debit', frm='Add-money service', to='Issuing bank', party="the customer's own bank",
        system='Bank funding and posting API', cross_org=True, cross_note='Only the payment reference, the amount and the bank\'s own account token reach the bank.',
        need='The bank needs the reference and amount to place and confirm the debit.', consent='The customer asked to fund the wallet from this bank account.',
        fields=[_f('Payment reference', 'payment_ref', 'release', 'Lets the bank match the debit to this payment.'),
                _f('Amount and currency', 'financial', 'release', 'Needed to place the debit.'),
                _f('Bank account token', 'account_identifier', 'release', "The bank's own identifier for the customer's account; needed to place the debit."),
                _f('Destination wallet number (MSISDN)', 'account_identifier', 'withhold', 'The bank does not need to know which wallet receives the credit.'),
                _f('Customer name and phone', 'identity', 'exclude', 'Never selected for a funding request.')]),
    'partner': dict(
        n=3, label='Credit instruction to the wallet partner', node='routing-request', frm='Add-money service', to='Wallet partner', party='the wallet partner',
        system='Wallet partner connector', cross_org=True, cross_note='Only the payment reference, the amount and the destination wallet reach the partner.',
        need='The partner needs the reference, amount and destination wallet to post the credit.', consent='The customer asked for this credit to the wallet.',
        fields=[_f('Payment reference', 'payment_ref', 'release', 'Lets the partner match the credit to this payment.'),
                _f('Amount and currency', 'financial', 'release', 'Needed to post the credit.'),
                _f('Destination wallet number (MSISDN)', 'account_identifier', 'mask', 'Sent as the wallet label with the middle digits hidden.'),
                _f('Funding bank account', 'account_identifier', 'withhold', 'The wallet partner does not need the funding account.'),
                _f('Customer name and phone', 'identity', 'exclude', 'Never selected for a credit instruction.')]),
    'ack': dict(
        n=4, label='Acknowledgement from the wallet partner', node='partner-ack', frm='Wallet partner', to='Add-money service', party='the wallet partner',
        system='Wallet partner callback', cross_org=True, cross_note='Only the posting reference, status and amount come back from the partner.',
        need='The posting reference is the proof that the wallet was credited.', consent='The credit is the transfer the customer asked for.',
        fields=[_f('Posting reference and status', 'payment_ref', 'release', 'Proof that the credit posted.'),
                _f('Amount and currency', 'financial', 'release', 'Checked against the debit.'),
                _f('Wallet holder details', 'identity', 'exclude', 'Never selected from the acknowledgement.')]),
    'customer': dict(
        n=5, label='Status message to the customer', node='customer-update', frm='Add-money service', to='Customer app', party='the paying customer',
        system='Customer status page', cross_org=False,
        need='The customer needs to know whether the money arrived.', consent='The customer is the person who made the request.',
        fields=[_f('Status headline and next step', 'ops', 'release', 'The only text the customer page receives.'),
                _f('Amount and currency', 'financial', 'release', 'Shown so the customer can recognise the payment.')]),
}


def open_processing_envelope(payment):
    """The purpose-bound envelope that covers the whole life of one add-money payment."""
    p = PURPOSES['process_add_money']
    return dict(id='ENV-' + secrets.token_hex(3).upper(), kind='processing', purpose_id='process_add_money', purpose=p['label'], basis=p['basis'], basis_label=p['basis_label'],
                actor='system', actor_label='DataUkil add-money service', scope=f"this payment only ({payment['reference']})", reference=payment['reference'],
                tools=list(HOP_ORDER), budget=None, granted_at=_now(), retention_days=retention_days('personal'), subject='the paying customer')


def _hop_fields(hop, state, facts):
    fields = [dict(f) for f in HOPS[hop]['fields']]
    if hop == 'partner' and (facts or {}).get('candidates', 1) > 1:
        for f in fields:
            if f['name'].startswith('Destination wallet'):
                f.update(action='withhold', note=f"{facts['candidates']} wallets match this reference, so the wallet label was held back from the message.")
    if hop == 'customer' and state == 'confirmed':
        fields.append(_f('Wallet posting reference', 'payment_ref', 'release', 'Shown once the credit is confirmed.'))
    return fields


def _flow_gates(env, payment, hop, state, facts, fields):
    p = HOPS[hop]
    ref = payment['reference']
    why, who, where, how, until = [], [], [], [], []
    if env:
        why.append(_chk('A purpose is recorded for this payment', 'ok', f"{env['id']} · {env['purpose']}"))
    else:
        why.append(_chk('A purpose is recorded for this payment', 'fail', 'No processing purpose is open for this payment.', 'purpose_limitation',
                        handling='The hand-off was held before any data left.', severity='high'))
    why.append(_chk('Needed to complete the transfer', 'ok', p['need']))
    why.append(_chk('Customer consent and basis', 'ok' if env else 'fail', f"{(env or {}).get('basis_label', 'No basis recorded')}. {p['consent']}" if env else 'No lawful basis is recorded.',
                    None if env else 'lawful_basis', None if env else 'The hand-off was held before any data left.', severity=None if env else 'high'))
    who.append(_chk('Sender is a registered add-money component', 'ok', p['frm']))
    who.append(_chk('Recipient is the data subject or a contracted party', 'ok', f"{p['to']} ({p['party']})."))
    who.append(_chk('Operators see masked values only', 'ok', 'The hop record names fields and decisions. The unmasked numbers stay in the payment systems.'))
    where.append(_chk('Stays inside this payment', 'ok', f"{p['system']} · {ref} only."))
    if hop == 'partner':
        n = (facts or {}).get('candidates', 1)
        if n > 1:
            where.append(_chk('Destination wallet is verified', 'fail',
                              f"{n} wallets match reference {ref}. Until the intended wallet is confirmed, a message can reach another wallet holder.", 'third_party_data',
                              handling='The instruction was limited to the payment reference and amount. The wallet label was held back from the message to the partner.',
                              alternative='Ask the wallet partner to confirm the intended wallet before any wallet detail is sent.', severity='high'))
        else:
            where.append(_chk('Destination wallet is verified', 'ok', "The reference maps to one wallet: the customer's saved destination."))
    if p['cross_org']:
        where.append(_chk('Bank or wallet-partner flow is limited', 'control', p['cross_note'], 'cross_org',
                          handling='Only fields on the hand-off allow-list cross the boundary, and each one is recorded.', severity='low'))
    masked = [f for f in fields if f['action'] == 'mask']
    held = [f for f in fields if f['action'] in ('withhold', 'exclude')]
    how.append(_chk('Hand-off is recorded with the fields it carried', 'ok', 'Each field below is saved with its decision.'))
    if masked:
        how.append(_chk('Account and wallet numbers masked', 'control', f"{len(masked)} number{'s' if len(masked) != 1 else ''} masked: " + '; '.join(f['name'] for f in masked) + '.',
                        'identifier_masking', handling='Masked values were stored and sent. The full numbers were not released.', severity='low'))
    else:
        how.append(_chk('Account and wallet numbers masked', 'ok', 'No account or wallet number is carried by this hand-off.'))
    if held:
        how.append(_chk('Only the fields this hop needs', 'control', 'Not sent: ' + '; '.join(f['name'] for f in held) + '.', 'minimisation',
                        handling='Only allow-listed fields were sent.', severity='low'))
    else:
        how.append(_chk('Only the fields this hop needs', 'ok', 'Every field is needed by this hop.'))
    days = retention_days('personal')
    until.append(_chk('A storage schedule exists', 'ok', f"{days} days after the payment completes (transaction record)."))
    return [('why', why), ('who', who), ('where', where), ('how', how), ('until', until)]


def review_flow(env, payment, hop, *, state='sent', facts=None, sim_ms=0):
    """Review one hand-off of the add-money payment. Pure over its arguments; returns the saved record."""
    p = HOPS[hop]
    fields = _hop_fields(hop, state, facts)
    gates, concerns = [], []
    for gid, checks in _flow_gates(env, payment, hop, state, facts, fields):
        st = _gate_status(checks)
        meta = next(g for g in GATES if g['id'] == gid)
        gates.append(dict(id=gid, n=meta['n'], question=meta['question'], title=meta['title'], status=st, headline=_headline(gid, st, checks), checks=checks))
        for c in checks:
            if c['concern'] and c['status'] in ('fail', 'control'):
                pr = PRINCIPLES[c['concern']]
                concerns.append(dict(code=c['concern'], principle=pr['title'], gate=gid, severity=c['severity'] or ('high' if c['status'] == 'fail' else 'low'),
                                     status='blocked' if c['status'] == 'fail' else 'mitigated', title=c['label'], detail=c['note'], handling=c['handling'], alternative=c['alternative']))
    decision = _decision(gates)
    outcome = 'partial' if decision == 'blocked' else 'released'
    released = sum(1 for f in fields if f['action'] == 'release')
    masked = sum(1 for f in fields if f['action'] == 'mask')
    withheld = sum(1 for f in fields if f['action'] in ('withhold', 'exclude'))
    days = retention_days('personal')
    label = p['label'] + (' (credit confirmed)' if hop == 'customer' and state == 'confirmed' else ' (not confirmed yet)' if hop == 'customer' and state == 'unconfirmed' else '')
    answers = dict(
        why=dict(answer=(env or {}).get('purpose') or 'No purpose is open', basis=(env or {}).get('basis_label'), necessity='required'),
        who=dict(answer=f"{p['frm']} \u2192 {p['to']}", requester=p['frm'], recipient=p['to'], on_behalf_of=p['party'], role='add-money service', owner='No operator needed', subject='the paying customer'),
        where=dict(answer=f"{p['system']} \u00b7 {payment['reference']} only", system=p['system'], scope='this payment', cross_org=p['cross_org']),
        how=dict(answer=f"{released} released, {masked} masked, {withheld} withheld.", released=released, masked=masked, withheld=withheld, method='allow-listed fields, numbers masked'),
        until=dict(answer=f"{days} days after the payment completes", days=days, expires_at=_expiry(days), class_='personal'))
    ev = dict(gates=gates, fields=fields, concerns=concerns, classes=sorted({f['cls'] for f in fields}), attrs={})
    ctx = dict(actor='system', actor_label='DataUkil add-money service', origin='payment', envelope=env)
    return _record(ctx, 'flow', label, ev, decision, outcome, sim_ms=sim_ms, answers=answers,
                   extra=dict(hop=hop, hop_n=p['n'], state=state, frm=p['frm'], to=p['to'], node=p['node'], reference=payment['reference']))


# ---------------------------------------------------------------------------------------------------- summaries and plan
def tally(records):
    t = dict(total=len(records), passed=0, controlled=0, blocked=0, concerns=0, blocked_concerns=0, mitigated_concerns=0)
    for r in records:
        t[r['decision']] += 1
        for c in r['concerns']:
            t['concerns'] += 1
            t['blocked_concerns' if c['status'] == 'blocked' else 'mitigated_concerns'] += 1
    return t


def compile_plan(records, *, outcome=None, kind=None, performed=(), envelope=None):
    """A compliant plan built from what actually happened. Steps say who owns them and whether they are done."""
    performed = set(performed)
    steps = []
    env = envelope or next((dict(id=r['envelope_id'], purpose=r['purpose']) for r in records if r.get('envelope_id') and r['kind'] != 'flow'), None)
    flows = [r for r in records if r['kind'] == 'flow']
    n_checks = len([r for r in records if r['kind'] == 'check'])
    if env:
        steps.append(dict(step='Keep every access inside one purpose-bound envelope',
                          detail=f"{n_checks} read-only check{'s' if n_checks != 1 else ''} ran for \"{env.get('purpose')}\" on this intent only ({env.get('id')}).", owner='AI', status='done', gate='why'))
    if flows:
        held = [r for r in flows if r['decision'] == 'blocked']
        detail = (f"{len(flows)} hand-offs between the customer app, the bank, the wallet partner and the customer status page were reviewed as the payment moved. "
                  'Account and wallet numbers were masked and no name or phone number left the add-money service.')
        if held:
            detail += ' Held back: ' + '; '.join(f"{r['label']} ({(next((c['detail'] for c in r['concerns'] if c['status'] == 'blocked'), r['summary']))})" for r in held)
        steps.append(dict(step='Send each party only what its hand-off needs', detail=detail, owner='System', status='done', gate='where',
                          concerns=sorted({c['code'] for r in flows for c in r['concerns']})))
    seen = set()
    for r in records:
        if r['kind'] != 'ai_request' or r['decision'] != 'blocked' or r['request'] in seen:
            continue
        seen.add(r['request'])
        codes = sorted({c['code'] for c in r['concerns'] if c['status'] == 'blocked'})
        alt = FOLLOWUPS.get(r['request'], {}).get('alternative')
        if r['request'] == 'bank_statement_history':
            used = 'attempt_history_check' in performed
            steps.append(dict(step='Do not widen the bank query', detail=('The duplicate question was tested with the attempt history for this intent. ' if used else
                                                                         'The single bank debit posting already answers the duplicate question. ') + 'The customer\'s wider bank history was not read.',
                              owner='AI', status='done', gate='where', concerns=codes))
        elif r['request'] == 'customer_contact_details':
            steps.append(dict(step='Use the signed-in status page, not contact details', detail=alt or 'No contact details were read.', owner='AI', status='done', gate='how', concerns=codes))
        elif r['request'] == 'candidate_wallet_holders':
            steps.append(dict(step='Confirm the wallet with the partner, not by reading other holders', detail=(alt or '') + ' This is the next requirement on the owned handoff.', owner='Operator', status='action', gate='where', concerns=codes))
        else:
            steps.append(dict(step=f"Resolve: {r['label']}", detail=alt or r['summary'], owner='Operator', status='action', gate=r['blocked_at'], concerns=codes))
    partial = [r for r in records if r['kind'] == 'check' and r['decision'] == 'blocked']
    if partial and 'candidate_wallet_holders' not in seen:
        for r in partial:
            c = next((c for c in r['concerns'] if c['alternative']), None)
            steps.append(dict(step='Keep protected identifiers withheld', detail=(c and c['alternative']) or r['summary'], owner='Operator', status='action', gate=r['blocked_at'],
                              concerns=sorted({c['code'] for c in r['concerns'] if c['status'] == 'blocked'})))
    if any(r['decision'] == 'controlled' and any(c['code'] == 'cross_org' for c in r['concerns']) for r in records if r['kind'] == 'check'):
        steps.append(dict(step='Limit what crosses to other organisations', detail='The bank and the wallet partner were asked about this payment reference only. No customer name, phone or account number was sent.',
                          owner='AI', status='done', gate='where', concerns=['cross_org']))
    if outcome == 'proposal' and kind in ('RESUME_ORIGINAL',):
        steps.append(dict(step='Approve the correction by name', detail='Resuming the funded intent moves money. A named investigator approves it; the backend rechecks ownership and funding, and the verification read runs inside a new purpose-bound check.',
                          owner='Operator', status='action', gate='who', concerns=['need_to_know']))
    elif outcome == 'proposal':
        steps.append(dict(step='Approve the record update by name', detail='No money moves. A named investigator approves the status refresh and it is logged.', owner='Operator', status='action', gate='who', concerns=['need_to_know']))
    elif outcome == 'handoff':
        steps.append(dict(step='Hand over the next requirement, not the raw data', detail='The owned handoff carries the requirement and the cited observations. Source records stay in the saved evidence.', owner='Operator', status='action', gate='who', concerns=['need_to_know']))
    steps.append(dict(step='Let the customer see their own status only', detail='The customer page receives status messages. Staff notes, source records and DataDNA concerns are not part of the customer view.', owner='System', status='done', gate='how', concerns=[]))
    steps.append(dict(step='Close the access envelope and start the retention clock', detail=f"Observations are kept {retention_days('personal')} days after the case closes. The schedule is recorded; the deletion job is not implemented in this prototype.",
                      owner='System', status='scheduled', gate='until', concerns=['storage_limitation']))
    return steps


def compact(r):
    """The report-safe projection of one record."""
    return dict(id=r['id'], kind=r['kind'], label=r['label'], decision=r['decision'], outcome=r['outcome'], blocked_at=r['blocked_at'], summary=r['summary'],
                dna={k: v['answer'] for k, v in r['dna'].items()}, concerns=[dict(code=c['code'], principle=c['principle'], gate=c['gate'], status=c['status'], title=c['title'],
                detail=c['detail'], handling=c['handling'], alternative=c['alternative']) for c in r['concerns']], observation_id=r.get('observation_id'),
                trigger=r.get('trigger'), ask=r.get('ask'), hop=r.get('hop'), state=r.get('state'), frm=r.get('frm'), to=r.get('to'))
