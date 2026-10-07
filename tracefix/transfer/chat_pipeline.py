"""Text-request topology and replay over the Add Money simulation's immutable journal.

Only committed backend events move the browser's packet. Replay never invokes a model or source.
Policy-review packets represent metadata checks, not reads of protected records.
"""
import json

from fastapi import HTTPException

from . import engine, journal


def node(identifier, label, detail, x, y, kind='process'):
    return dict(id=identifier, label=label, detail=detail, x=x, y=y, kind=kind)


NODES = [
    node('input', 'Customer text', 'Untrusted message', 30, 65),
    node('identity', 'Session identity', 'Actual customer role', 235, 65),
    node('api', 'Model API', 'External inference', 440, 65),
    node('classify', 'Intent router', 'Normal or deceptive?', 645, 65),
    node('public', 'Support answer', 'General knowledge only', 850, 65),
    node('reply', 'Customer reply', 'Safe response delivered', 1055, 65),
    node('demo', 'Keyword fallback', 'Only on API failure', 440, 230, 'fallback'),
    node('planner', 'Fooled assistant', 'Proposes protected reads', 645, 230),
    node('gateway', 'Tool request', 'Allow-listed proposal', 850, 230),
    node('dna', 'DataDNA boundary', 'Evaluate request metadata', 1055, 230, 'gate'),
    node('why', '01 · Why?', 'Purpose / lawful basis', 1055, 405, 'gate'),
    node('who', '02 · Who?', 'Authority / need to know', 850, 405, 'gate'),
    node('where', '03 · Where?', 'Source / customer scope', 645, 405, 'gate'),
    node('how', '04 · How?', 'Minimisation / masking', 440, 405, 'gate'),
    node('until', '05 · Until when?', 'Retention schedule', 235, 405, 'gate'),
    node('blocked', 'Access blocked', 'Source callback prevented', 30, 405, 'denial'),
    node('audit', 'Saved decision', 'Immutable simulation journal', 30, 575),
    node('backend', 'Protected backend', 'NOT CALLED · 0 reads', 1055, 575, 'source'),
]
EDGES = [
    ('input', 'identity'), ('identity', 'api'), ('api', 'classify'),
    ('api', 'demo'), ('demo', 'classify'), ('classify', 'public'), ('public', 'reply'),
    ('classify', 'planner'), ('planner', 'gateway'), ('gateway', 'dna'),
    ('dna', 'why'), ('why', 'who'), ('who', 'where'), ('where', 'how'),
    ('how', 'until'), ('until', 'blocked'), ('blocked', 'audit'), ('audit', 'reply'),
    ('dna', 'backend'),
]
TOPOLOGY = dict(nodes=NODES, edges=[dict(source=a, target=b, restricted=b == 'backend') for a, b in EDGES],
                width=1265, height=700)


def emit(db, chat, turn, node_id, detail, *, state='done', source=None, tool=None):
    payment = engine.payment_row(db, chat['payment_id'])
    previous = db.execute("""SELECT COALESCE(MAX(sim_ms),-450) FROM tx_events
        WHERE payment_id=? AND type='CHAT_PIPELINE_STAGE' AND json_extract(payload,'$.turn_id')=?
        AND json_extract(payload,'$.lease')=?""", (payment['id'], turn['id'], turn['lease'])).fetchone()[0]
    return journal.emit(db, 'CHAT_PIPELINE_STAGE', run_id=payment['run_id'], payment_id=payment['id'],
                        case_id=payment['case_id'], node_id=node_id, sim_ms=previous + 450,
                        payload=dict(chat_id=chat['id'], turn_id=turn['id'], lease=turn['lease'],
                                     state=state, detail=detail, source=source, tool=tool))


def events(db, chat, turn):
    rows = db.execute("""SELECT seq,node_id,sim_ms,occurred_at,payload FROM tx_events
        WHERE payment_id=? AND type='CHAT_PIPELINE_STAGE' AND json_extract(payload,'$.chat_id')=?
        AND json_extract(payload,'$.turn_id')=? AND json_extract(payload,'$.lease')=? ORDER BY seq""",
                      (chat['payment_id'], chat['id'], turn['id'], turn['lease'])).fetchall()
    result = []
    for row in rows:
        p = json.loads(row['payload'])
        result.append(dict(sequence=row['seq'], node=row['node_id'], sim_ms=row['sim_ms'],
                           occurred_at=row['occurred_at'], state=p['state'], detail=p['detail'],
                           source=p['source'], tool=p['tool']))
    return result


def active_turn(db, identifier, key, lease):
    import time
    turn = db.execute('SELECT * FROM tx_chat_turns WHERE chat_id=? AND idem_key=?', (identifier, key)).fetchone()
    if not turn or turn['lease'] != lease or turn['status'] != 'processing' or turn['lease_until'] <= time.time():
        raise HTTPException(409, 'Message processing expired. Retry with the same operation key.')
    return turn
