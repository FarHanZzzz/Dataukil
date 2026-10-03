from pathlib import Path
import os
import sqlite3
import json
from contextlib import contextmanager
from .domain import seed_cases, now

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get('TRACEFIX_DB', ROOT / 'runtime' / 'tracefix.sqlite3'))


class ClosingConnection(sqlite3.Connection):
    """sqlite's ordinary context manager commits but does not close handles."""
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False, factory=ClosingConnection)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c


def initialize():
    with connect() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY, body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, actor TEXT, role TEXT, expires TEXT);
        CREATE TABLE IF NOT EXISTS operations(actor TEXT, scope TEXT, key TEXT, digest TEXT, response TEXT, PRIMARY KEY(actor,scope,key));
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, case_id TEXT, actor TEXT, action TEXT, at TEXT, version INTEGER, detail TEXT);
        CREATE TABLE IF NOT EXISTS demo(key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS simulations(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS incidents(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(customer_id,subject));
        CREATE TABLE IF NOT EXISTS case_incidents(case_id TEXT PRIMARY KEY REFERENCES cases(id), incident_id TEXT UNIQUE NOT NULL REFERENCES incidents(id));
        CREATE TABLE IF NOT EXISTS transactions(id TEXT PRIMARY KEY, incident_id TEXT UNIQUE NOT NULL REFERENCES incidents(id), customer_id TEXT NOT NULL, body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS transaction_events(id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES transactions(id), sequence INTEGER NOT NULL, body TEXT NOT NULL, UNIQUE(transaction_id,sequence));
        CREATE TABLE IF NOT EXISTS investigations(id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), status TEXT NOT NULL, body TEXT NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS one_active_investigation ON investigations(case_id) WHERE status='RUNNING';
        CREATE TABLE IF NOT EXISTS investigation_events(run_id TEXT NOT NULL REFERENCES investigations(id), sequence INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(run_id,sequence));
        CREATE TABLE IF NOT EXISTS hypotheses(run_id TEXT NOT NULL REFERENCES investigations(id), id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(run_id,id));
        CREATE TABLE IF NOT EXISTS recommendations(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES investigations(id), case_id TEXT NOT NULL REFERENCES cases(id), body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS approvals(id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), recommendation_id TEXT UNIQUE NOT NULL REFERENCES recommendations(id), status TEXT NOT NULL, body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS repair_attempts(id TEXT PRIMARY KEY, approval_id TEXT NOT NULL REFERENCES approvals(id), case_id TEXT NOT NULL REFERENCES cases(id), body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES transactions(id), identity TEXT UNIQUE NOT NULL, body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
        ''')
        from .transfer import schema as transfer_schema  # additive tx_* tables for the add-money investigation
        transfer_schema.ensure(db)
        if not db.execute('SELECT 1 FROM cases LIMIT 1').fetchone():
            for c in seed_cases():
                db.execute('INSERT INTO cases VALUES (?,?)',(c['id'],json.dumps(c,ensure_ascii=False)))
        db.execute("INSERT OR IGNORE INTO demo VALUES ('repayment_available','false')")
        for row in db.execute('SELECT body FROM cases').fetchall():
            save_case(db,json.loads(row['body']))
        db.execute('INSERT OR IGNORE INTO schema_versions VALUES (1,?)',(now(),))


def get_case(db, case_id):
    r = db.execute('SELECT body FROM cases WHERE id=?',(case_id,)).fetchone()
    return json.loads(r['body']) if r else None


def save_case(db,c):
    incident_id=c.setdefault('incident_id','incident_'+c['id'])
    db.execute('INSERT OR IGNORE INTO incidents VALUES (?,?,?,?)',
               (incident_id,c['customer_id'],'legacy-case:'+c['id'],c['created_at']))
    db.execute('INSERT INTO cases VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
               (c['id'],json.dumps(c,ensure_ascii=False)))
    db.execute('INSERT INTO case_incidents VALUES (?,?) ON CONFLICT(case_id) DO UPDATE SET incident_id=excluded.incident_id',
               (c['id'],incident_id))


def audit(db,c,actor,action,detail=''):
    db.execute('INSERT INTO audit(case_id,actor,action,at,version,detail) VALUES (?,?,?,?,?,?)',
               (c['id'],actor,action,now(),c['version'],detail))


@contextmanager
def transaction():
    db=connect()
    try:
        db.execute('BEGIN IMMEDIATE')
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
