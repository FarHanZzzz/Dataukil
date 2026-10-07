"""Additive SQLite schema for the add-money investigation. Legacy tables are untouched.

Rollback: every table is prefixed `tx_`; `DROP TABLE` on the `tx_*` tables (listed in `TABLES`) removes the feature
without affecting QR cases. Transfer cases themselves live in the existing `cases` table with a `family` field.
"""

TABLES = ['tx_runs', 'tx_payments', 'tx_steps', 'tx_events', 'tx_attempts', 'tx_postings', 'tx_posting_lines',
          'tx_worker_logs', 'tx_mappings', 'tx_partner', 'tx_callbacks', 'tx_observations', 'tx_investigations',
          'tx_corrections', 'tx_reports', 'tx_chats', 'tx_chat_turns']

SQL = '''
CREATE TABLE IF NOT EXISTS tx_runs(
  id TEXT PRIMARY KEY, scenario TEXT NOT NULL, speed REAL NOT NULL DEFAULT 1, paused INTEGER NOT NULL DEFAULT 0,
  clock_ms INTEGER NOT NULL DEFAULT 0, seed INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL, replaces TEXT);

CREATE TABLE IF NOT EXISTS tx_payments(
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL, owner TEXT NOT NULL, idem_key TEXT NOT NULL, digest TEXT NOT NULL,
  amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, bank_code TEXT NOT NULL, bank_label TEXT NOT NULL,
  wallet_label TEXT NOT NULL, reference TEXT NOT NULL, status TEXT NOT NULL, fulfillment TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL, created_ms INTEGER NOT NULL, case_id TEXT, incident_ms INTEGER, reported INTEGER NOT NULL DEFAULT 0,
  UNIQUE(owner, idem_key));
CREATE INDEX IF NOT EXISTS tx_payments_run ON tx_payments(run_id);

CREATE TABLE IF NOT EXISTS tx_steps(
  id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, payment_id TEXT, due_ms INTEGER NOT NULL,
  kind TEXT NOT NULL, args TEXT NOT NULL DEFAULT '{}', done INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS tx_steps_due ON tx_steps(run_id, done, due_ms);

CREATE TABLE IF NOT EXISTS tx_events(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE, run_id TEXT NOT NULL, payment_id TEXT,
  case_id TEXT, case_version INTEGER, type TEXT NOT NULL, occurred_at TEXT NOT NULL, sim_ms INTEGER NOT NULL DEFAULT 0,
  node_id TEXT, payload TEXT NOT NULL, cust TEXT);
CREATE INDEX IF NOT EXISTS tx_events_payment ON tx_events(payment_id, seq);
CREATE INDEX IF NOT EXISTS tx_events_case ON tx_events(case_id, seq);

CREATE TABLE IF NOT EXISTS tx_attempts(
  id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id TEXT NOT NULL, attempt_no INTEGER NOT NULL, parent_no INTEGER,
  kind TEXT NOT NULL, started_ms INTEGER NOT NULL, outcome TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
  UNIQUE(payment_id, attempt_no));

-- Logical funding-leg uniqueness: one posting per leg per payment, immutable once written.
CREATE TABLE IF NOT EXISTS tx_postings(
  id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, leg TEXT NOT NULL CHECK(leg IN ('BANK_DEBIT','WALLET_CREDIT','BANK_RETURN')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0), currency TEXT NOT NULL, attempt_no INTEGER NOT NULL,
  ref TEXT NOT NULL, created_ms INTEGER NOT NULL, created_at TEXT NOT NULL, correction_id TEXT,
  UNIQUE(payment_id, leg));
CREATE TABLE IF NOT EXISTS tx_posting_lines(
  posting_id TEXT NOT NULL, account TEXT NOT NULL, side TEXT NOT NULL CHECK(side IN ('D','C')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0));

CREATE TABLE IF NOT EXISTS tx_worker_logs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id TEXT NOT NULL, attempt_no INTEGER NOT NULL, at_ms INTEGER NOT NULL,
  level TEXT NOT NULL, code TEXT NOT NULL, message TEXT NOT NULL, retryable INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS tx_mappings(
  id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id TEXT NOT NULL, source_ref TEXT NOT NULL, candidate TEXT NOT NULL,
  candidate_label TEXT NOT NULL, at_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tx_partner(
  id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id TEXT NOT NULL, at_ms INTEGER NOT NULL, state TEXT NOT NULL,
  source_available INTEGER NOT NULL DEFAULT 1, caps TEXT NOT NULL DEFAULT '{}', detail TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS tx_callbacks(
  id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id TEXT NOT NULL, at_ms INTEGER NOT NULL, status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, detail TEXT NOT NULL DEFAULT '');

CREATE TABLE IF NOT EXISTS tx_observations(
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, payment_id TEXT NOT NULL, run_id TEXT NOT NULL, tool TEXT NOT NULL,
  status TEXT NOT NULL, as_of_ms INTEGER NOT NULL, as_of TEXT NOT NULL, source TEXT NOT NULL, scope TEXT NOT NULL,
  summary TEXT NOT NULL, data TEXT NOT NULL, evidence_version INTEGER NOT NULL, investigation_id TEXT, origin TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS tx_obs_case ON tx_observations(case_id);

CREATE TABLE IF NOT EXISTS tx_investigations(
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, payment_id TEXT NOT NULL, run_id TEXT NOT NULL, mode TEXT NOT NULL,
  status TEXT NOT NULL, budget INTEGER NOT NULL, checks_used INTEGER NOT NULL DEFAULT 0, started_ms INTEGER NOT NULL,
  started_by TEXT NOT NULL, state TEXT NOT NULL DEFAULT '{}');
CREATE UNIQUE INDEX IF NOT EXISTS tx_inv_one_running ON tx_investigations(case_id) WHERE status='running';

CREATE TABLE IF NOT EXISTS tx_corrections(
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, payment_id TEXT NOT NULL, investigation_id TEXT, kind TEXT NOT NULL,
  status TEXT NOT NULL, label TEXT NOT NULL, eligibility TEXT NOT NULL, evidence_version INTEGER NOT NULL,
  observation_ids TEXT NOT NULL DEFAULT '[]', created_ms INTEGER NOT NULL, created_at TEXT NOT NULL,
  approved_by TEXT, approved_at TEXT, idem_key TEXT, digest TEXT, outcome TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS tx_corr_once ON tx_corrections(payment_id, kind) WHERE status IN ('executing','completed');

CREATE TABLE IF NOT EXISTS tx_reports(
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, sha256 TEXT NOT NULL,
  body TEXT NOT NULL, markdown TEXT NOT NULL, UNIQUE(case_id, version));

CREATE TABLE IF NOT EXISTS tx_chats(
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, payment_id TEXT NOT NULL REFERENCES tx_payments(id), created_at TEXT NOT NULL,
  isolated INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS tx_chat_turns(
  id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT NOT NULL REFERENCES tx_chats(id), idem_key TEXT NOT NULL,
  digest TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('processing','completed','failed')),
  lease TEXT NOT NULL, lease_until REAL NOT NULL, response TEXT, created_at TEXT NOT NULL,
  UNIQUE(chat_id, idem_key));
CREATE UNIQUE INDEX IF NOT EXISTS tx_chat_one_processing ON tx_chat_turns(chat_id) WHERE status='processing';

CREATE TRIGGER IF NOT EXISTS tx_postings_no_update BEFORE UPDATE ON tx_postings BEGIN SELECT RAISE(ABORT,'postings are immutable'); END;
CREATE TRIGGER IF NOT EXISTS tx_postings_no_delete BEFORE DELETE ON tx_postings BEGIN SELECT RAISE(ABORT,'postings are immutable'); END;
CREATE TRIGGER IF NOT EXISTS tx_lines_no_update BEFORE UPDATE ON tx_posting_lines BEGIN SELECT RAISE(ABORT,'postings are immutable'); END;
CREATE TRIGGER IF NOT EXISTS tx_lines_no_delete BEFORE DELETE ON tx_posting_lines BEGIN SELECT RAISE(ABORT,'postings are immutable'); END;
CREATE TRIGGER IF NOT EXISTS tx_obs_no_update BEFORE UPDATE ON tx_observations BEGIN SELECT RAISE(ABORT,'observations are immutable'); END;
CREATE TRIGGER IF NOT EXISTS tx_obs_no_delete BEFORE DELETE ON tx_observations BEGIN SELECT RAISE(ABORT,'observations are immutable'); END;
CREATE TRIGGER IF NOT EXISTS tx_events_no_update BEFORE UPDATE ON tx_events BEGIN SELECT RAISE(ABORT,'events are immutable'); END;
CREATE TRIGGER IF NOT EXISTS tx_events_no_delete BEFORE DELETE ON tx_events BEGIN SELECT RAISE(ABORT,'events are immutable'); END;
'''


def ensure(db):
    try:  # readers (SSE, polling) and the clock writer run concurrently; WAL keeps them from blocking each other
        db.execute('PRAGMA journal_mode=WAL')
    except Exception:
        pass
    db.executescript(SQL)
    if 'isolated' not in {r[1] for r in db.execute('PRAGMA table_info(tx_chats)')}:
        db.execute('ALTER TABLE tx_chats ADD COLUMN isolated INTEGER NOT NULL DEFAULT 0')
