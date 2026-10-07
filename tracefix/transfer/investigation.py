"""Bounded investigation loop.

Starting an investigation authorizes at most `budget` read-only checks on one case. The runner validates every action
from the policy against the allowlist, the budget and a no-repeat rule, preserves each result as an immutable
observation, and emits requested/completed/unavailable events that the graph renders. It never moves money.
"""
import json
import secrets

from .. import store
from ..domain import now, uid
from . import catalog, journal, policy, privacy, tools
from .engine import check_budget, customer_update, handler, mutate_case, payment_row, run_row, schedule


def _obs_by_tool(db, case_id, investigation_id):
    out = {}
    for r in db.execute('SELECT * FROM tx_observations WHERE case_id=? AND investigation_id=? AND origin=? ORDER BY rowid', (case_id, investigation_id, 'investigation')):
        out[r['tool']] = dict(id=r['id'], tool=r['tool'], status=r['status'], summary=r['summary'], data=json.loads(r['data']))
    return out


def _inv(db, inv_id):
    r = db.execute('SELECT * FROM tx_investigations WHERE id=?', (inv_id,)).fetchone()
    if not r:
        return None
    d = dict(r)
    d['state'] = json.loads(d['state'])
    return d


def _save_state(db, inv):
    db.execute('UPDATE tx_investigations SET state=?, checks_used=?, status=? WHERE id=?',
               (json.dumps(inv['state']), inv['checks_used'], inv['status'], inv['id']))


def start(db, run, case, payment, actor):
    if payment['status'] == 'COMPLETED' or case['status'] == 'OUTCOME_RECORDED':
        raise ValueError('This payment is already confirmed; there is nothing left to investigate.')
    inv_id = uid('inv')
    state = dict(hyp={h['id']: dict(status='unchecked', rationale='', cites=[]) for h in catalog.HYPOTHESES}, used=[], pending=None)
    db.execute('INSERT INTO tx_investigations(id,case_id,payment_id,run_id,mode,status,budget,checks_used,started_ms,started_by,state) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
               (inv_id, case['id'], payment['id'], run['id'], policy.MODE, 'running', check_budget(), 0, run['clock_ms'], actor, json.dumps(state)))
    c = mutate_case(db, case['id'], lambda c: c.__setitem__('status', 'OPEN'), actor=actor, action='investigation_started')
    cust = customer_update(db, run, payment, 'update', 'An investigator is checking the saved payment records.', headline='Investigation started',
                           next_step='We are comparing bank and wallet records. This page updates automatically.', case=c)
    journal.emit(db, 'INVESTIGATION_STARTED', run_id=run['id'], payment_id=payment['id'], case_id=case['id'], case_version=c['version'],
                 sim_ms=run['clock_ms'], cust=cust,
                 payload=dict(investigation_id=inv_id, mode=policy.MODE, mode_label=policy.MODE_LABEL, budget=check_budget(), started_by=actor,
                              hypotheses=[dict(id=h['id'], title=h['title'], status='unchecked') for h in catalog.HYPOTHESES]))
    schedule(db, run['id'], payment['id'], run['clock_ms'] + 700, 'INV_PLAN', investigation_id=inv_id)
    return _inv(db, inv_id)


# --- shared by investigation and post-correction verification ---------------------------------------------------
def request_check(db, run, case_id, payment, tool, *, rationale, hypotheses=(), cites=(), investigation_id=None, origin='investigation'):
    spec = catalog.TOOLS[tool]
    check_id = uid('chk')
    journal.emit(db, 'CHECK_REQUESTED', run_id=run['id'], payment_id=payment['id'], case_id=case_id, case_version=_cv(db, case_id),
                 node_id=spec['node'], sim_ms=run['clock_ms'],
                 payload=dict(check_id=check_id, tool=tool, label=spec['label'], node_id=spec['node'], rationale=rationale,
                              hypotheses=list(hypotheses), cites=list(cites), origin=origin, investigation_id=investigation_id))
    return check_id


def _cv(db, case_id):
    r = db.execute('SELECT body FROM cases WHERE id=?', (case_id,)).fetchone()
    return json.loads(r['body'])['version'] if r else None


def complete_check(db, run, case_id, payment, tool, check_id, *, performed=(), investigation_id=None, origin='investigation'):
    """Run the read-only tool as of now, preserve the observation, bump the evidence version, announce the result."""
    case = store.get_case(db, case_id)
    inv = _inv(db, investigation_id) if investigation_id else None
    approval = db.execute('SELECT approved_by FROM tx_corrections WHERE case_id=? AND approved_by IS NOT NULL ORDER BY rowid DESC LIMIT 1', (case_id,)).fetchone() if not inv else None
    actor = inv['started_by'] if inv else (approval['approved_by'] if approval else case['owner'])
    access = privacy.authorize_check(db, run, case, payment, tool, actor, check_id=check_id, investigation_id=investigation_id)
    res = tools.run_tool(db, tool, payment, run['clock_ms'], performed, access_decision=access)
    c = mutate_case(db, case_id, lambda c: c.__setitem__('evidence_version', c['evidence_version'] + 1), action='observation_recorded')
    oid = 'OBS-' + secrets.token_hex(3).upper()
    as_of = now()
    obs = dict(id=oid, case_id=case_id, payment_id=payment['id'], tool=tool, label=catalog.TOOLS[tool]['label'], status=res['status'],
               as_of=as_of, as_of_ms=run['clock_ms'], source=res['source'], scope=res['scope'], summary=res['summary'], data=res['data'],
               evidence_version=c['evidence_version'], investigation_id=investigation_id, origin=origin, check_id=check_id, data_dna=access)
    db.execute('INSERT INTO tx_observations(id,case_id,payment_id,run_id,tool,status,as_of_ms,as_of,source,scope,summary,data,evidence_version,investigation_id,origin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
               (oid, case_id, payment['id'], run['id'], tool, res['status'], run['clock_ms'], as_of, res['source'], res['scope'], res['summary'],
                json.dumps(res['data'], ensure_ascii=False), c['evidence_version'], investigation_id, origin))
    kind = 'CHECK_UNAVAILABLE' if res['status'] == 'unavailable' else 'CHECK_COMPLETED'
    journal.emit(db, kind, run_id=run['id'], payment_id=payment['id'], case_id=case_id, case_version=c['version'],
                 node_id=catalog.TOOLS[tool]['node'], sim_ms=run['clock_ms'],
                 payload=dict(check_id=check_id, tool=tool, label=obs['label'], status=res['status'], observation=obs,
                              node_updates=res['node_updates'], origin=origin, investigation_id=investigation_id))
    return obs, c


# --- loop ---------------------------------------------------------------------------------------------------------
@handler('INV_PLAN')
def _plan(db, step, args):
    inv = _inv(db, args['investigation_id'])
    if not inv or inv['status'] != 'running':
        return
    run = run_row(db, step['run_id'])
    payment = payment_row(db, inv['payment_id'])
    case = store.get_case(db, inv['case_id'])
    if payment['status'] == 'COMPLETED':  # the original completed while we were checking: stop on sufficient evidence
        return _finish(db, run, inv, case, payment, dict(outcome='no_action', kind=None, cites=[],
                       summary='The payment completed while the investigation was running. No correction is needed.'))
    view = dict(obs=_obs_by_tool(db, case['id'], inv['id']), hyp=inv['state']['hyp'], budget=inv['budget'], used=inv['checks_used'])
    action = policy.next_action(view)
    if action['type'] == 'check':
        # Validate the policy's action rather than trusting it.
        if action['tool'] not in catalog.TOOLS or action['tool'] in inv['state']['used']:
            action = dict(type='conclude')
        elif inv['checks_used'] >= inv['budget']:
            action = dict(type='conclude', budget=True)
    if action['type'] == 'conclude':
        conclusion = policy.conclude(view)
        if action.get('budget') and conclusion['outcome'] == 'handoff':
            conclusion['next_requirement'] = 'The automatic check budget was reached. ' + conclusion['next_requirement']
        return _finish(db, run, inv, case, payment, conclusion)
    check_id = request_check(db, run, case['id'], payment, action['tool'], rationale=action['rationale'], hypotheses=action['hypotheses'],
                             cites=action['cites'], investigation_id=inv['id'])
    inv['checks_used'] += 1
    inv['state']['used'].append(action['tool'])
    inv['state']['pending'] = dict(check_id=check_id, tool=action['tool'])
    _save_state(db, inv)
    schedule(db, run['id'], payment['id'], run['clock_ms'] + catalog.CHECK_DURATION_MS, 'INV_DONE',
             investigation_id=inv['id'], check_id=check_id, tool=action['tool'])


@handler('INV_DONE')
def _done(db, step, args):
    inv = _inv(db, args['investigation_id'])
    if not inv or inv['status'] != 'running':
        return
    run = run_row(db, step['run_id'])
    payment = payment_row(db, inv['payment_id'])
    performed = [r['tool'] for r in db.execute("SELECT DISTINCT tool FROM tx_observations WHERE investigation_id=? AND status='completed'", (inv['id'],))]
    obs, case = complete_check(db, run, inv['case_id'], payment, args['tool'], args['check_id'], performed=performed, investigation_id=inv['id'])
    if obs['data_dna']['decision'] in ('BLOCKED', 'NEEDS_REVIEW'):
        return _finish(db, run, inv, case, payment, dict(outcome='handoff', kind=None, cites=[obs['id']],
            summary='The investigation paused because the requested source access was not permitted. No cause is inferred from withheld data.',
            next_requirement='Privacy owner must review the saved DataDNA decision and restore a permitted case-scoped request before the investigation resumes.'))
    view = dict(obs=_obs_by_tool(db, inv['case_id'], inv['id']), hyp=inv['state']['hyp'], budget=inv['budget'], used=inv['checks_used'])
    for f in policy.assess(args['tool'], obs, view):
        inv['state']['hyp'][f['hypothesis_id']] = dict(status=f['status'], rationale=f['rationale'], cites=f['cites'])
        title = next(h['title'] for h in catalog.HYPOTHESES if h['id'] == f['hypothesis_id'])
        journal.emit(db, 'FINDING_RECORDED', run_id=run['id'], payment_id=payment['id'], case_id=inv['case_id'], case_version=case['version'],
                     sim_ms=run['clock_ms'], payload=dict(hypothesis_id=f['hypothesis_id'], title=title, status=f['status'],
                                                           rationale=f['rationale'], cites=f['cites'], investigation_id=inv['id']))
    inv['state']['pending'] = None
    _save_state(db, inv)
    schedule(db, run['id'], payment['id'], run['clock_ms'] + catalog.CHECK_GAP_MS, 'INV_PLAN', investigation_id=inv['id'])


def _finish(db, run, inv, case, payment, conclusion):
    from . import correction, report
    inv['status'] = 'concluded'
    inv['state']['conclusion'] = dict(outcome=conclusion['outcome'], kind=conclusion.get('kind'), summary=conclusion['summary'])
    _save_state(db, inv)
    case = store.get_case(db, case['id'])
    journal.emit(db, 'INVESTIGATION_CONCLUDED', run_id=run['id'], payment_id=payment['id'], case_id=case['id'], case_version=case['version'],
                 sim_ms=run['clock_ms'],
                 payload=dict(investigation_id=inv['id'], outcome=conclusion['outcome'], kind=conclusion.get('kind'), summary=conclusion['summary'],
                              cites=conclusion.get('cites', []), checks_used=inv['checks_used'], budget=inv['budget']))
    if conclusion['outcome'] == 'proposal':
        correction.propose(db, run, case, payment, inv, conclusion)
    elif conclusion['outcome'] == 'handoff':
        correction.handoff(db, run, case, payment, inv, conclusion)
    report.save(db, run, case['id'], reason='investigation_concluded')
