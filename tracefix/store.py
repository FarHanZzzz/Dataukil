from pathlib import Path
import os
import sqlite3
import json
from contextlib import contextmanager
from .domain import seed_cases, now

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get('TRACEFIX_DB', ROOT / 'runtime' / 'tracefix.sqlite3'))


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
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
        ''')
        from .transfer import schema as transfer_schema  # additive tx_* tables for the add-money investigation
        transfer_schema.ensure(db)
        if not db.execute('SELECT 1 FROM cases LIMIT 1').fetchone():
            for c in seed_cases():
                db.execute('INSERT INTO cases VALUES (?,?)',(c['id'],json.dumps(c,ensure_ascii=False)))
        db.execute("INSERT OR IGNORE INTO demo VALUES ('repayment_available','false')")


def get_case(db, case_id):
    r = db.execute('SELECT body FROM cases WHERE id=?',(case_id,)).fetchone()
    return json.loads(r['body']) if r else None


def save_case(db,c):
    db.execute('INSERT OR REPLACE INTO cases VALUES (?,?)',(c['id'],json.dumps(c,ensure_ascii=False)))


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
