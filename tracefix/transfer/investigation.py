"""Bounded investigation loop.

Starting an investigation authorizes at most `budget` read-only checks on one case. The runner validates every action
from the policy against the allowlist, the budget and a no-repeat rule, preserves each result as an immutable
observation, and emits requested/completed/unavailable events that the graph renders. It never moves money.
"""
import json
import secrets

from .. import store
from ..domain import now, uid
from . import catalog, datadna, journal, policy, privacy, tools
from .engine import check_budget, customer_update, handler, mutate_case, owner_label, payment_row, run_row, schedule


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
    envelope = datadna.open_envelope(actor, owner_label(actor), case, payment, budget=check_budget())
    state = dict(hyp={h['id']: dict(status='unchecked', rationale='', cites=[]) for h in catalog.HYPOTHESES}, used=[], pending=None, envelope=envelope)
    db.execute('INSERT INTO tx_investigations(id,case_id,payment_id,run_id,mode,status,budget,checks_used,started_ms,started_by,state) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
               (inv_id, case['id'], payment['id'], run['id'], policy.MODE, 'running', check_budget(), 0, run['clock_ms'], actor, json.dumps(state)))
    c = mutate_case(db, case['id'], lambda c: c.__setitem__('status', 'OPEN'), actor=actor, action='investigation_started')
    cust = customer_update(db, run, payment, 'update', 'An investigator is checking the saved payment records.', headline='Investigation started',
                           next_step='We are comparing bank and wallet records. This page updates automatically.', case=c)
    journal.emit(db, 'INVESTIGATION_STARTED', run_id=run['id'], payment_id=payment['id'], case_id=case['id'], case_version=c['version'],
                 sim_ms=run['clock_ms'], cust=cust,
                 payload=dict(investigation_id=inv_id, mode=policy.MODE, mode_label=policy.MODE_LABEL, budget=check_budget(), started_by=actor,
                              hypotheses=[dict(id=h['id'], title=h['title'], status='unchecked') for h in catalog.HYPOTHESES]))
    journal.emit(db, 'DATADNA_ENVELOPE', run_id=run['id'], payment_id=payment['id'], case_id=case['id'], case_version=c['version'], sim_ms=run['clock_ms'],
                 payload=dict(envelope, investigation_id=inv_id, kind='investigation'))
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


def check_context(db, run, case_id, payment, *, inv=None, actor=None, origin='investigation'):
    """The DataDNA actor context for one check. Verification reads open their own short purpose-bound envelope."""
    case = store.get_case(db, case_id)
    if inv:
        actor = inv['started_by']
        env = inv['state'].get('envelope') or datadna.open_envelope(actor, owner_label(actor), case, payment)  # runs saved before DataDNA existed
    else:
        actor = actor or case['owner']
        env = datadna.open_envelope(actor, owner_label(actor), case, payment, purpose_id='verify_correction', tools=['wallet_ledger_check'])
        journal.emit(db, 'DATADNA_ENVELOPE', run_id=run['id'], payment_id=payment['id'], case_id=case_id, case_version=case['version'], sim_ms=run['clock_ms'],
                     payload=dict(env, investigation_id=None, kind='verification'))
    return datadna.context(case, payment, env, actor=actor, actor_label=owner_label(actor), origin=origin)


def complete_check(db, run, case_id, payment, tool, check_id, *, performed=(), investigation_id=None, origin='investigation', ctx=None):
    """Gate and run the read-only tool as of now, preserve the observation, bump the evidence version, announce the result.

    Two DataDNA layers sit in front of the tool. The case-scoped access decision (privacy.authorize_check) is saved first and
    decides whether the source may be read at all; the five-gate review then decides what is released. A refused call reads
    nothing, and each decision is saved as its own journal event next to the check result.
    """
    case = store.get_case(db, case_id)
    ctx = ctx or check_context(db, run, case_id, payment, origin=origin)
    access = privacy.authorize_check(db, run, case, payment, tool, ctx['actor'], check_id=check_id, investigation_id=investigation_id)
    res, dna = datadna.gate_tool(ctx, tool, lambda: tools.run_tool(db, tool, payment, run['clock_ms'], performed, access_decision=access), check_id=check_id, sim_ms=run['clock_ms'])
    if res is None:
        res = datadna.blocked_result(tool, dna)
    c = mutate_case(db, case_id, lambda c: c.__setitem__('evidence_version', c['evidence_version'] + 1), action='observation_recorded')
    oid = 'OBS-' + secrets.token_hex(3).upper()
    as_of = now()
    obs = dict(id=oid, case_id=case_id, payment_id=payment['id'], tool=tool, label=catalog.TOOLS[tool]['label'], status=res['status'],
               as_of=as_of, as_of_ms=run['clock_ms'], source=res['source'], scope=res['scope'], summary=res['summary'], data=res['data'],
               evidence_version=c['evidence_version'], investigation_id=investigation_id, origin=origin, check_id=check_id, data_dna=access)
    db.execute('INSERT INTO tx_observations(id,case_id,payment_id,run_id,tool,status,as_of_ms,as_of,source,scope,summary,data,evidence_version,investigation_id,origin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
               (oid, case_id, payment['id'], run['id'], tool, res['status'], run['clock_ms'], as_of, res['source'], res['scope'], res['summary'],
                json.dumps(res['data'], ensure_ascii=False), c['evidence_version'], investigation_id, origin))
    dna['observation_id'] = oid
    journal.emit(db, 'DATADNA_REVIEWED', run_id=run['id'], payment_id=payment['id'], case_id=case_id, case_version=c['version'],
                 node_id=catalog.TOOLS[tool]['node'], sim_ms=run['clock_ms'], payload=dna)
    kind = 'CHECK_COMPLETED' if res['status'] == 'completed' else 'CHECK_UNAVAILABLE'
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
    ctx = check_context(db, run, inv['case_id'], payment, inv=inv)
    obs, case = complete_check(db, run, inv['case_id'], payment, args['tool'], args['check_id'], performed=performed, investigation_id=inv['id'], ctx=ctx)
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
    # The planner may ask for more context than the purpose needs. Each ask goes through the same five gates.
    for request_id in datadna.followups(args['tool'], obs):
        dna = datadna.review_request(ctx, request_id, trigger=obs['id'], sim_ms=run['clock_ms'])
        journal.emit(db, 'DATADNA_REVIEWED', run_id=run['id'], payment_id=payment['id'], case_id=inv['case_id'], case_version=case['version'],
                     node_id=catalog.TOOLS[args['tool']]['node'], sim_ms=run['clock_ms'], payload=dna)
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
    records = journal.datadna_records(db, case['id'], payment['id'])
    journal.emit(db, 'DATADNA_PLAN', run_id=run['id'], payment_id=payment['id'], case_id=case['id'], case_version=store.get_case(db, case['id'])['version'], sim_ms=run['clock_ms'],
                 payload=dict(investigation_id=inv['id'], envelope_id=(inv['state'].get('envelope') or {}).get('id'), outcome=conclusion['outcome'], kind=conclusion.get('kind'),
                              tally=datadna.tally(records), closed_at=now(),
                              steps=datadna.compile_plan(records, outcome=conclusion['outcome'], kind=conclusion.get('kind'), performed=inv['state']['used'],
                                                         envelope=inv['state'].get('envelope'))))
    report.save(db, run, case['id'], reason='investigation_concluded')
