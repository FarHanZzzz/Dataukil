"""Case-scoped DataDNA decisions in the same immutable journal as the simulation."""
import json

from .. import data_dna
from . import catalog, journal


def decisions(db, case_id):
    if not case_id:
        return []
    rows = db.execute("SELECT payload FROM tx_events WHERE case_id=? AND type='DATA_DNA_DECISION' ORDER BY seq", (case_id,))
    return [json.loads(r['payload'])['decision'] for r in rows]


def snapshot(db, case_id):
    result = data_dna.summary(decisions(db, case_id))
    inv = db.execute('SELECT id FROM tx_investigations WHERE case_id=? ORDER BY rowid DESC LIMIT 1', (case_id,)).fetchone() if case_id else None
    if inv:
        context = plan_context(db, case_id, inv['id'])
        result['readiness'] = context['readiness'] if context['decision_ids'] else 'NOT_STARTED'
        result['current_investigation_id'] = inv['id']
    return result


def record(db, run, case, payment, decision, *, check_id=None, investigation_id=None):
    decision.update(check_id=check_id, investigation_id=investigation_id)
    journal.emit(db, 'DATA_DNA_DECISION', run_id=run['id'], payment_id=payment['id'],
                 case_id=case['id'], case_version=case['version'], sim_ms=run['clock_ms'],
                 payload=dict(decision=decision))
    return decision


def authorize_check(db, run, case, payment, tool, actor, *, check_id=None, investigation_id=None, stage='investigation'):
    decision = data_dna.tool_request(tool, case['id'], actor)
    if case.get('payment_id') != payment['id'] or case.get('customer_id') != payment['owner']:
        decision = data_dna.evaluate_access(case_id=case['id'], workflow='add_money', actor=actor,
                                           source=tool, fields=data_dna.TOOL_FIELDS[tool], scope_matches=False)
    decision['source_label'] = catalog.TOOLS[tool]['source']
    decision['stage'] = stage
    return record(db, run, case, payment, decision, check_id=check_id, investigation_id=investigation_id)


def plan_context(db, case_id, investigation_id=None):
    relevant = [d for d in decisions(db, case_id) if d.get('affects_case', True)
                and (not investigation_id or d.get('investigation_id') == investigation_id)]
    ready = bool(relevant) and all(d['decision'] in ('ALLOWED', 'MINIMIZED') and d['policy_version'] == data_dna.POLICY_VERSION for d in relevant)
    return dict(policy_version=data_dna.POLICY_VERSION, decision_ids=[d['id'] for d in relevant],
                readiness='READY' if ready else 'REVIEW_REQUIRED',
                constraints=['Read approved structured observations only.', 'Keep the existing intent and exact payment mapping.',
                             'Operator approval and fresh financial eligibility are required.',
                             'Record access metadata and verify the resulting ledger outcome.'],
                production_review='Privacy owner must approve the applicable basis, recipients and retention before real data is connected.')


def probe(db, run, case, payment, actor, kind):
    fields = ['posting_reference', 'amount_minor', 'unrelated_history']
    options = dict(unrelated_history=dict(scope_matches=False),
                   external_model=dict(recipient='unapproved_external_model'),
                   missing_basis=dict(basis=None))
    if kind not in options:
        raise ValueError('Choose unrelated_history, external_model or missing_basis.')
    d = data_dna.evaluate_access(case_id=case['id'], workflow='add_money', actor=actor,
                                 source='Synthetic access boundary demonstration', fields=fields, **options[kind])
    d.update(affects_case=False, demonstration=True, probe=kind)
    # This evaluates a denied request only. No tool or source adapter is called.
    return record(db, run, case, payment, d)
