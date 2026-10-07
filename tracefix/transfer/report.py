"""Operator report: a structured template built only from preserved observations and logged actions.

Each material statement carries the observation or event it came from. The report never states a stronger conclusion
than the workspace shows. Ordinary failures are a *processing fault* or *reliability weakness*; a security
vulnerability is never inferred from a timeout or a failed callback.
"""
import hashlib
import html as _html
import json

from .. import data_dna, store
from ..domain import now, uid
from . import catalog, datadna, journal, policy, privacy
from .engine import bdt, hms, owner_label

DISCLOSURE = 'Simulated partners and fictional BDT. No real accounts, transfers or provider credentials are involved.'


def _obs(db, case_id):
    rows = db.execute('SELECT * FROM tx_observations WHERE case_id=? ORDER BY rowid', (case_id,)).fetchall()
    return [dict(id=r['id'], tool=r['tool'], label=catalog.TOOLS[r['tool']]['label'], status=r['status'], as_of=r['as_of'], source=r['source'],
                 scope=r['scope'], summary=r['summary'], data=json.loads(r['data']), origin=r['origin'], evidence_version=r['evidence_version'])
            for r in rows]


def build(db, case_id):
    case = store.get_case(db, case_id)
    pay = dict(db.execute('SELECT * FROM tx_payments WHERE id=?', (case['payment_id'],)).fetchone())
    obs = _obs(db, case_id)
    by_tool = {}
    for o in obs:
        by_tool[o['tool']] = o  # latest per tool
    inv = db.execute('SELECT * FROM tx_investigations WHERE case_id=? ORDER BY rowid DESC LIMIT 1', (case_id,)).fetchone()
    inv_state = json.loads(inv['state']) if inv else {}
    hyps = []
    for h in catalog.HYPOTHESES:
        s = inv_state.get('hyp', {}).get(h['id'], dict(status='unchecked', rationale='', cites=[]))
        hyps.append(dict(id=h['id'], title=h['title'], status=s['status'], rationale=s['rationale'], cites=s['cites']))
    plan = db.execute('SELECT * FROM tx_corrections WHERE case_id=? ORDER BY rowid DESC LIMIT 1', (case_id,)).fetchone()
    plan_d = None
    if plan:
        elig = json.loads(plan['eligibility'])
        plan_d = dict(kind=plan['kind'], label=plan['label'], status=plan['status'], approved_by=plan['approved_by'],
                      outcome=json.loads(plan['outcome']) if plan['outcome'] else None, evidence_version=plan['evidence_version'], data_dna=elig.get('data_dna'),
                      options=[dict(kind=o['kind'], label=catalog.CORRECTION_KINDS[o['kind']]['label'], eligible=o['eligible'], reasons=o['reasons']) for o in elig['options']])

    # Customer symptom and when it appeared (from saved events)
    sym = db.execute("SELECT occurred_at FROM tx_events WHERE payment_id=? AND type='STAGE_OBSERVED' AND node_id='partner-ack' AND payload LIKE '%timed out%' ORDER BY seq LIMIT 1",
                     (pay['id'],)).fetchone()
    symptom = dict(text='The wallet credit was not confirmed to the customer after the bank approved the request, and the partner acknowledgement timed out.',
                   appeared_at=sym['occurred_at'] if sym else None)

    facts, unknowns = [], []
    b = by_tool.get('bank_record_check')
    if b and b['status'] == 'completed' and b['data']['debit_count']:
        d = b['data']['debits'][0]
        facts.append(dict(text=f"A bank debit of {bdt(d['amount_minor'])} is posted ({d['ref']}); no return posting exists.", cites=[b['id']]))
    w = by_tool.get('wallet_ledger_check')
    if w and w['status'] == 'completed':
        if w['data']['found']:
            po = w['data']['posting']
            facts.append(dict(text=f"A wallet credit of {bdt(po['amount_minor'])} is posted ({po['ref']}, attempt {po['attempt_no']}).", cites=[w['id']]))
        else:
            unknowns.append(dict(text=f"No wallet credit matched as of {hms(w['as_of'])}. This is a time-scoped lookup, not proof that none will post.", cites=[w['id']]))
    pt = by_tool.get('partner_status_check')
    if pt and pt['status'] != 'completed':
        unknowns.append(dict(text='The partner status source was unavailable, so the processing state is unknown from that source.', cites=[pt['id']]))
    elif pt:
        facts.append(dict(text=f"The partner reports the instruction as '{pt['data']['state']}'.", cites=[pt['id']]))
    m = by_tool.get('mapping_check')
    if m and m['status'] == 'completed':
        if m['data']['ambiguous']:
            unknowns.append(dict(text=f"{len(m['data']['candidates'])} wallet accounts match the reference; the intended account is not verified.", cites=[m['id']]))
        elif m['data']['verified']:
            facts.append(dict(text='The intent maps to exactly one wallet account.', cites=[m['id']]))
    if case.get('resolution') == 'credit_confirmed':
        facts.append(dict(text='The customer status now shows a confirmed wallet credit.', cites=[o['id'] for o in obs if o['tool'] == 'wallet_ledger_check'][-1:]))

    # Located fault, strictly from evidence
    wk = by_tool.get('worker_error_check')
    callback = (pt or {}).get('data', {}).get('callback') if pt and pt['status'] == 'completed' else None
    if wk and wk['status'] == 'completed' and wk['data'].get('error'):
        e = wk['data']['error']
        fault = dict(kind='processing fault', statement=f"A {'retryable ' if e['retryable'] else ''}credit-worker error ({e['code']}) aborted attempt {e['attempt_no']} before the credit posted.", cites=[wk['id']])
    elif w and w['status'] == 'completed' and w['data']['found'] and callback and callback['status'] == 'FAILED':
        fault = dict(kind='reliability weakness', statement=f"The credit posted, but acknowledgement callback delivery failed {callback['attempts']} times, so the customer channel never confirmed it.", cites=[w['id'], pt['id']])
    elif m and m['status'] == 'completed' and m['data']['ambiguous']:
        fault = dict(kind='unconfirmed', statement='Cause remains unconfirmed. The reference maps to more than one wallet account, so no replay or credit can be attributed safely.', cites=[m['id']])
    elif wk and wk['status'] == 'completed' and 'INGRESS_BACKLOG' in wk['data'].get('warnings', []):
        fault = dict(kind='reliability weakness', statement='No error is recorded. The original instruction is queued behind an ingress backlog and can still complete.', cites=[wk['id']])
    else:
        fault = dict(kind='unconfirmed', statement='Cause remains unconfirmed.', cites=[])

    # Actions
    events = journal.staff_events(db, pay['id'], pay['run_id'], 0, 2000)
    log = []
    for e in events:
        t, p = e['type'], e['payload']
        if t == 'INCIDENT_OPENED':
            log.append(dict(at=e['occurred_at'], text=f"Incident opened ({p['reason'].replace('_', ' ')}); owner {p['owner']}.", cites=[]))
        elif t == 'COMPLAINT_ATTACHED':
            log.append(dict(at=e['occurred_at'], text='Customer report attached to the existing incident.', cites=[]))
        elif t == 'INVESTIGATION_STARTED':
            log.append(dict(at=e['occurred_at'], text=f"Investigation started by {owner_label(p['started_by'])}; {p['budget']} read-only checks authorized.", cites=[]))
        elif t == 'DATA_DNA_DECISION':
            d = p['decision']
            log.append(dict(at=e['occurred_at'], text=f"DataDNA {d['decision']}: {d.get('source_label', d['source'])}. {d['reason']}", cites=[d['id']]))
        elif t in ('CHECK_COMPLETED', 'CHECK_UNAVAILABLE'):
            o = p['observation']
            log.append(dict(at=e['occurred_at'], text=f"{p['label']}: {o['summary']}", cites=[o['id']]))
        elif t == 'CORRECTION_PROPOSED':
            log.append(dict(at=e['occurred_at'], text=f"Proposed: {p['label']}.", cites=p.get('observation_ids', [])))
        elif t == 'CORRECTION_APPROVED':
            log.append(dict(at=e['occurred_at'], text=f"{p['label']} approved by {owner_label(p['approved_by'])}.", cites=[]))
        elif t == 'CORRECTION_BLOCKED':
            log.append(dict(at=e['occurred_at'], text='Correction blocked: ' + (p.get('summary') or ''), cites=[]))
        elif t == 'CORRECTION_COMPLETED':
            log.append(dict(at=e['occurred_at'], text=p['outcome']['message'], cites=[]))
        elif t == 'HANDOFF_CREATED':
            log.append(dict(at=e['occurred_at'], text=f"Handed to the {p['queue']} queue ({p['owner']}). Next requirement: {p['next_requirement']}", cites=[]))
        elif t == 'PAYMENT_COMPLETED':
            log.append(dict(at=e['occurred_at'], text=f"Wallet credit confirmed ({p['how']}).", cites=[]))
    opts = (by_tool.get('eligibility_check') or {}).get('data', {}).get('options') or (plan_d['options'] if plan_d else [])
    unavailable = [dict(kind=o['kind'], label=catalog.CORRECTION_KINDS[o['kind']]['label'], reasons=o['reasons']) for o in opts if not o['eligible']]
    open_task = next((t for t in reversed(case['tasks']) if t['status'] == 'OPEN'), None)
    # Downloads are logged in the DataDNA ledger but left out of the document, so exporting a report never changes it.
    dna_records = [r for r in journal.datadna_records(db, case_id, pay['id']) if r['kind'] != 'export']
    concl = inv_state.get('conclusion') or {}
    data_protection = dict(
        tally=datadna.tally(dna_records), calls=[datadna.compact(r) for r in dna_records],
        envelope=next((dict(id=r['envelope_id'], purpose=r['purpose']) for r in dna_records if r.get('envelope_id') and r['kind'] != 'flow'), None),
        plan=datadna.compile_plan(dna_records, outcome=concl.get('outcome'), kind=concl.get('kind'), performed=inv_state.get('used', []), envelope=inv_state.get('envelope')),
        disclosure=datadna.DISCLOSURE)
    return dict(
        case_reference=case['reference'], payment_reference=pay['reference'], amount_minor=pay['amount_minor'], currency=pay['currency'],
        bank_label=pay['bank_label'], wallet_label=pay['wallet_label'], status=case['status'], resolution=case.get('resolution', 'open'),
        case_version=case['version'], evidence_version=case['evidence_version'], symptom=symptom, confirmed=facts, unknowns=unknowns,
        checks=[dict(id=o['id'], label=o['label'], as_of=o['as_of'], source=o['source'], scope=o['scope'], status=o['status'], summary=o['summary'], origin=o['origin']) for o in obs],
        hypotheses=hyps, fault=fault, plan=plan_d,
        blocked=unavailable,
        operator=dict(owner=owner_label(case['owner']), next_action=(open_task or {}).get('question') or ('None. The case is resolved.' if case.get('resolution') == 'credit_confirmed' else 'Review the saved evidence.'),
                      next_review=case['next_review']),
        log=log, data_protection=data_protection, data_dna=privacy.snapshot(db, case_id),
        execution_mode=policy.MODE_LABEL + ' (a deterministic policy over returned observations; no language model)', disclosure=DISCLOSURE)


def markdown(r):
    amount = bdt(r['amount_minor'])
    cite = lambda c: (' [' + ', '.join(c) + ']') if c else ''
    L = [f"# Operator report: {r['case_reference']}", '',
         f"Payment {r['payment_reference']} · {amount} · {r['bank_label']} → {r['wallet_label']}",
         f"Status: {r['status']} · resolution: {r['resolution'].replace('_', ' ')} · evidence v{r['evidence_version']}", '',
         '## Customer symptom', r['symptom']['text'] + (f" First visible at {hms(r['symptom']['appeared_at'])} (Asia/Dhaka)." if r['symptom']['appeared_at'] else ''), '',
         '## Confirmed facts']
    L += [f"- {f['text']}{cite(f['cites'])}" for f in r['confirmed']] or ['- None yet.']
    L += ['', '## Unknowns']
    L += [f"- {u['text']}{cite(u['cites'])}" for u in r['unknowns']] or ['- No open unknowns recorded.']
    L += ['', '## Checks performed']
    L += [f"- **{c['id']}** {c['label']} · {c['status']} · as of {hms(c['as_of'])} · {c['source']} · scope: {c['scope']}\n  {c['summary']}" for c in r['checks']] or ['- No checks have been run.']
    L += ['', '## Hypotheses']
    L += [f"- {h['title']}: **{h['status'].replace('_', ' ')}**" + (f" — {h['rationale']}{cite(h['cites'])}" if h['rationale'] else '') for h in r['hypotheses']]
    L += ['', f"## Located {r['fault']['kind']}", r['fault']['statement'] + cite(r['fault']['cites']), '', '## Proposed repair and outcome']
    if r['plan']:
        L.append(f"- {r['plan']['label']}: **{r['plan']['status']}**" + (f" (approved by {owner_label(r['plan']['approved_by'])})" if r['plan']['approved_by'] else ''))
        if r['plan']['outcome']:
            L.append(f"- Outcome: {r['plan']['outcome'].get('message') or r['plan']['outcome'].get('result')}")
    else:
        L.append('- No correction was proposed.')
    if r['blocked']:
        L += ['', '### Options not available, and why']
        for o in r['blocked']:
            L.append(f"- {o['label']}: " + ' '.join(o['reasons']))
    dp = r.get('data_protection')
    if dp:
        t = dp['tally']
        L += ['', '## Data protection (DataDNA)',
              f"{t['total']} data call{'s' if t['total'] != 1 else ''} reviewed through five gates (Why, Who, Where, How, Until when): {t['passed']} passed, {t['controlled']} released with controls, {t['blocked']} blocked. "
              f"{t['blocked_concerns']} concern{'s' if t['blocked_concerns'] != 1 else ''} blocked access; {t['mitigated_concerns']} {'was' if t['mitigated_concerns'] == 1 else 'were'} mitigated by a control."]
        for c in dp['calls']:
            tag = {'passed': 'PASSED', 'controlled': 'CONTROLLED', 'blocked': 'BLOCKED'}[c['decision']]
            L += ['', f"### {c['id']} · {c['label']} · {tag}" + (f" at gate {datadna.GATE_IDS.index(c['blocked_at']) + 1}" if c['blocked_at'] else '')]
            if c.get('ask'):
                L.append(f"- Request: {c['ask']}")
            L += [f"- Why: {c['dna']['why']}", f"- Who: {c['dna']['who']}", f"- Where: {c['dna']['where']}", f"- How: {c['dna']['how']}", f"- Until when: {c['dna']['until']}"]
            for k in c['concerns']:
                L.append(f"- Concern ({k['status']}) {k['principle']}: {k['detail']}" + (f" Handling: {k['handling']}" if k['handling'] else '') + (f" Compliant alternative: {k['alternative']}" if k['alternative'] else ''))
        L += ['', '### Compliance plan']
        L += [f"- [{s['status']}] {s['step']} ({s['owner']}): {s['detail']}" for s in dp['plan']]
        L += ['', dp['disclosure']]
    L += ['', '## Operator ownership', f"- Owner: {r['operator']['owner']}", f"- Next action: {r['operator']['next_action']}", f"- Next review: {'none, the case is closed' if r['operator']['next_action'].startswith('None') else hms(r['operator']['next_review']) + ' (Asia/Dhaka)'}",
          '', '## Action log']
    L += [f"- {hms(a['at'])} {a['text']}{cite(a['cites'])}" for a in r['log']]
    L += data_dna.report_lines(r.get('data_dna', {}).get('decisions', []))
    L += ['', '---', f"Execution mode: {r['execution_mode']}. Evidence version {r['evidence_version']}, case version {r['case_version']}.", r['disclosure'], '']
    return '\n'.join(L)


def to_html(r):
    md = markdown(r)
    body = []
    for line in md.split('\n'):
        e = _html.escape(line)
        if line.startswith('# '):
            body.append(f'<h1>{e[2:]}</h1>')
        elif line.startswith('### '):
            body.append(f'<h3>{e[4:]}</h3>')
        elif line.startswith('## '):
            body.append(f'<h2>{e[3:]}</h2>')
        elif line.startswith('- '):
            body.append(f'<p class="li">{e[2:]}</p>')
        elif line.strip() == '---':
            body.append('<hr>')
        elif line.strip():
            body.append(f'<p>{e}</p>')
    css = 'body{font:15px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#14232a}h1{font-size:24px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:#2b6a5a;margin-top:28px}.li{margin:4px 0 4px 16px}hr{border:0;border-top:1px solid #ccd}'
    return f'<!doctype html><meta charset="utf-8"><title>Operator report {_html.escape(r["case_reference"])}</title><style>{css}</style>' + '\n'.join(body)


def save(db, run, case_id, reason='requested'):
    """Persist a new report version only when the content changed (generated time is outside the hash)."""
    r = build(db, case_id)
    md = markdown(r)
    sha = hashlib.sha256(md.encode()).hexdigest()
    last = db.execute('SELECT * FROM tx_reports WHERE case_id=? ORDER BY version DESC LIMIT 1', (case_id,)).fetchone()
    if last and last['sha256'] == sha:
        return dict(id=last['id'], version=last['version'], sha256=sha, created=False)
    version = (last['version'] if last else 0) + 1
    rid = uid('rpt')
    db.execute('INSERT INTO tx_reports(id,case_id,version,created_at,sha256,body,markdown) VALUES (?,?,?,?,?,?,?)',
               (rid, case_id, version, now(), sha, json.dumps(r, ensure_ascii=False), md))
    if run:
        pay = db.execute('SELECT id FROM tx_payments WHERE case_id=?', (case_id,)).fetchone()
        journal.emit(db, 'REPORT_SAVED', run_id=run['id'], payment_id=pay['id'] if pay else None, case_id=case_id, sim_ms=run['clock_ms'],
                     payload=dict(report_id=rid, version=version, reason=reason, sha256=sha))
    return dict(id=rid, version=version, sha256=sha, created=True)
