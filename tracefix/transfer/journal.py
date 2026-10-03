"""Saved event journal. Every status the browsers show derives from rows written here.

Cursor model: `seq` is a global monotonic cursor. Each stream is a role-authorized filter over that journal, so a
gap in `seq` seen by one stream can be intentional filtering and is never treated as a missing financial event.
A client that reconnects replays `seq > cursor`; a snapshot returns the head read in the same transaction.
"""
import json
from ..domain import now, uid

STAFF_INBOX_TYPES = ('INTENT_CREATED', 'INCIDENT_OPENED', 'CASE_STATUS_CHANGED', 'PAYMENT_COMPLETED', 'HANDOFF_CREATED')


def emit(db, type, *, run_id, payment_id=None, case_id=None, case_version=None, node_id=None, payload=None, cust=None, sim_ms=0):
    event_id = uid('evt')
    cur = db.execute(
        'INSERT INTO tx_events(event_id,run_id,payment_id,case_id,case_version,type,occurred_at,sim_ms,node_id,payload,cust) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        (event_id, run_id, payment_id, case_id, case_version, type, now(), sim_ms, node_id,
         json.dumps(payload or {}, ensure_ascii=False), json.dumps(cust, ensure_ascii=False) if cust else None))
    return cur.lastrowid


def head(db):
    r = db.execute('SELECT COALESCE(MAX(seq),0) AS h FROM tx_events').fetchone()
    return r['h']


def staff_event(r):
    return dict(sequence=r['seq'], event_id=r['event_id'], simulation_id=r['run_id'], payment_id=r['payment_id'],
                case_id=r['case_id'], case_version=r['case_version'], type=r['type'], occurred_at=r['occurred_at'],
                sim_ms=r['sim_ms'], node_id=r['node_id'], payload=json.loads(r['payload']))


def customer_event(r):
    """Customer projection: only the pre-built customer payload, never the staff payload."""
    c = json.loads(r['cust'])
    return dict(sequence=r['seq'], event_id=r['event_id'], payment_id=r['payment_id'], occurred_at=r['occurred_at'], **c)


def staff_events(db, payment_id, run_id, after=0, limit=500):
    rows = db.execute(
        "SELECT * FROM tx_events WHERE seq>? AND (payment_id=? OR (run_id=? AND payment_id IS NULL AND type='CLOCK_CHANGED')) ORDER BY seq LIMIT ?",
        (after, payment_id, run_id, limit)).fetchall()
    return [staff_event(r) for r in rows]


def customer_events(db, payment_id, after=0, limit=500):
    rows = db.execute('SELECT * FROM tx_events WHERE seq>? AND payment_id=? AND cust IS NOT NULL ORDER BY seq LIMIT ?',
                      (after, payment_id, limit)).fetchall()
    return [customer_event(r) for r in rows]


def inbox_events(db, after=0, limit=500):
    marks = ','.join('?' * len(STAFF_INBOX_TYPES))
    rows = db.execute(f'SELECT * FROM tx_events WHERE seq>? AND type IN ({marks}) ORDER BY seq LIMIT ?',
                      (after, *STAFF_INBOX_TYPES, limit)).fetchall()
    return [staff_event(r) for r in rows]
