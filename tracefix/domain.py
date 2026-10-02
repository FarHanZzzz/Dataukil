"""Deterministic evidence facts. Textual inference never grants source authority."""
from datetime import datetime, timezone, timedelta
import hashlib
import uuid


def now():
    return datetime.now(timezone.utc).isoformat()


def uid(prefix):
    return prefix + '_' + uuid.uuid4().hex[:12]


def evidence(text, kind='customer_supplied', reference=None, amount=None, purchase=None, capability=None):
    stamp = now()
    return dict(id=uid('ev'), kind=kind, supplied_by='mock_adapter' if kind.startswith('mock_') else 'customer',
                received_at=stamp, event_at=stamp, as_of=stamp, scope='this fictional purchase only',
                reference=reference, purchase_id=purchase, amount_minor=amount, capability=capability,
                verification='documented synthetic fixture contract' if kind.startswith('mock_') else 'unverified supplied assertion',
                authority='confirmed within simulated source contract' if kind.startswith('mock_') else 'supplied / unverified',
                original=text, original_hash=hashlib.sha256(text.encode()).hexdigest(),
                revisions=[dict(version=1, text=text, actor='fixture', at=stamp, reason='original')], blob=None)


def current_text(e):
    return e['revisions'][-1]['text']


def facts(c):
    # Only explicit capabilities from trusted mock adapters can establish source facts.
    valid = [e for e in c['evidence'] if e['kind'].startswith('mock_') and e['purchase_id'] == c['purchase_id']]
    qr = [e for e in valid if e['capability'] == 'qr_completed' and e['reference'] == c['qr_reference']]
    cash = [e for e in valid if e['capability'] == 'cash_received']
    repayment = [e for e in valid if e['capability'] == 'repayment_completed' and e['reference'] == c['qr_reference']]
    total = next((e['amount_minor'] for e in valid if e['capability'] == 'purchase_total'), None)
    paid = sum(e['amount_minor'] or 0 for e in qr + cash)
    returned = sum(e['amount_minor'] or 0 for e in repayment)
    missing = []
    if not qr:
        missing.append('Confirm the exact QR reference under the simulated payment source.')
    if not cash and c['second_method'] == 'cash':
        missing.append('Obtain a merchant acknowledgement of the alleged cash payment and purchase reference.')
    if total is None:
        missing.append('Obtain an invoice identifying this purchase and its total.')
    if c['second_method'] == 'qr' and not any(e['capability'] == 'second_qr_completed' for e in valid):
        missing.append('Establish whether the second QR reference belongs to the same purchase.')
    denial = any(e['kind'] == 'merchant_supplied' and e.get('assertion') == 'denial' for e in c['evidence'])
    if denial:
        missing.insert(0, 'Resolve the conflicting merchant denial with a cited purchase-level record.')
    return dict(qr_confirmed=bool(qr), cash_confirmed=bool(cash), purchase_total_minor=total,
                recorded_paid_minor=paid, recorded_repaid_minor=returned,
                recorded_excess_minor=max(0, paid - total - returned) if total is not None else None,
                requirements=missing, conflict=denial,
                split_tender=total is not None and len(qr+cash)>1 and paid <= total)


def fresh(c):
    from ml.features import RULES_VERSION
    return bool(c.get('analysis') and c['analysis']['evidence_version'] == c['evidence_version'] and c['analysis'].get('rules_version')==RULES_VERSION)


def customer_view(c):
    f = facts(c)
    confirmed = []
    if f['qr_confirmed']:
        confirmed.append('The QR payment is confirmed in the simulated provider record. This alone does not resolve your paid-twice complaint.')
    if f['cash_confirmed']:
        confirmed.append('The mock merchant confirmation records cash for this purchase.')
    if f['recorded_repaid_minor']:
        confirmed.append(f"A simulated completed-repayment record shows BDT {f['recorded_repaid_minor']/100:.2f} returned.")
    return {k:c[k] for k in ['id','reference','version','status','owner','created_at','updated_at','next_review','reported_amount_minor','second_method']} | dict(
        scale=2, currency='BDT', confirmed_facts=confirmed, unresolved=f['requirements'],
        next_step=c['tasks'][-1]['question'] if c['tasks'] and c['tasks'][-1]['status']=='OPEN' else 'The assigned investigator will review the saved evidence.',
        notifications=c['notifications'], synthetic=True)


def seed_cases():
    result = []
    for n, customer, method, description in [
        (1,'customer_1','cash','QR was unclear, so I paid cash for invoice INV-101.'),
        (2,'customer_2','qr','Two payments have the same amount. Please check their purchases.'),
        (3,'customer_1','cash','আমি QR এর পরে একই কেনাকাটার জন্য নগদ টাকা দিয়েছি।'),
        (4,'customer_1','cash','Cash and QR were both paid. A repayment was requested.')]:
        purchase = f'PUR-{100+n}'
        ref = f'QR-DEMO-{n:03}'
        c = dict(id=f'case_{n}',reference=f'TF-260{n:03}',customer_id=customer,purchase_id=purchase,
                 qr_reference=ref, second_method=method, description=description,
                 reported_amount_minor=50000, owner='staff_1',status='OPEN',version=1,evidence_version=1,
                 created_at=now(),updated_at=now(),next_review=(datetime.now(timezone.utc)+timedelta(hours=24)).isoformat(),
                 evidence=[],analysis=None,analyses=[],checks=[],tasks=[],handoffs=[],decisions=[],notifications=[])
        c['evidence'] = [evidence(description, purchase=purchase),
             evidence(f'QR payment {ref} completed. BDT 500 was posted for purchase {purchase}.',
                      'mock_payment',ref,50000,purchase,'qr_completed')]
        if n in (1,2,4):
            c['evidence'].append(evidence(f'Invoice for purchase {purchase}. Purchase total BDT 500.',
                                         'mock_invoice',f'INV-{100+n}',50000,purchase,'purchase_total'))
        if n in (1,4):
            c['evidence'].append(evidence(f'Cash payment of BDT 500 was received for purchase {purchase}. Both payments are for the same purchase.',
                                         'mock_merchant',f'INV-{100+n}',50000,purchase,'cash_received'))
        if n == 2:
            c['evidence'].append(evidence('The second QR payment QR-DEMO-202 belongs to a different purchase PUR-202. These are two separate purchases.',
                                         'mock_payment','QR-DEMO-202',50000,'PUR-202','qr_completed'))
        if n == 3:
            c['evidence'].append(evidence('নগদ ৫০০ টাকা গ্রহণ করা হয়েছে। একই কেনাকাটার রসিদ।',reference='RECEIPT-103',amount=50000,purchase=purchase))
        if n == 4:
            c['evidence'].append(evidence('Repayment of BDT 500 requested. It is not completed yet.',
                                         'repayment_request',ref,50000,purchase,'repayment_requested'))
        c['notifications'].append(dict(at=now(),text='Your complaint was accepted. An investigator and next review are saved.'))
        result.append(c)
    return result
