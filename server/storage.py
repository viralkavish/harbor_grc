"""Parameterized SQLite persistence. One transaction per logical write."""
from contextlib import contextmanager
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from threading import RLock

WORKSPACE = dict(name='Your workspace', organization='', owner='', description='',
                 trust_title='Security at our organization', trust_description='',
                 trust_policy_ids=[], trust_evidence_ids=[],
                 jev_api_key='', jev_endpoint='https://api.typesafe.ai/v1')


def now():
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, data_dir):
        self.root = Path(data_dir).resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.uploads = self.root / 'uploads'
        self.uploads.mkdir(exist_ok=True, mode=0o700)
        self.path = self.root / 'harbor.db'
        self.lock = RLock()
        with self.transaction() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS records (
                    resource TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL,
                    PRIMARY KEY(resource,id));
                CREATE TABLE IF NOT EXISTS activity (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY, token TEXT NOT NULL, expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS policy_versions (
                    id TEXT PRIMARY KEY, policy_id TEXT NOT NULL, version INTEGER NOT NULL,
                    content TEXT NOT NULL, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS policy_acceptances (
                    id TEXT PRIMARY KEY, policy_id TEXT NOT NULL, person_id TEXT,
                    person_name TEXT NOT NULL, person_email TEXT NOT NULL, version INTEGER NOT NULL,
                    accepted_at TEXT NOT NULL, signature_text TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS trust_requests (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
                    company TEXT NOT NULL, nda_signed INTEGER NOT NULL DEFAULT 1,
                    status TEXT NOT NULL DEFAULT 'approved', requested_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS continuous_test_runs (
                    id TEXT PRIMARY KEY, run_at TEXT NOT NULL, summary TEXT NOT NULL);
            ''')
            db.execute('INSERT OR IGNORE INTO settings VALUES (?,?)', ('workspace', json.dumps(WORKSPACE)))
        self.path.chmod(0o600)

    @contextmanager
    def transaction(self):
        with self.lock:
            db = sqlite3.connect(self.path, timeout=30)
            db.row_factory = sqlite3.Row
            try:
                db.execute('PRAGMA foreign_keys=ON')
                db.execute('BEGIN IMMEDIATE')
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise
            finally:
                db.close()

    @staticmethod
    def workspace(db):
        return json.loads(db.execute('SELECT value FROM settings WHERE key=?', ('workspace',)).fetchone()[0])

    @staticmethod
    def get(db, resource, record_id):
        row = db.execute('SELECT body FROM records WHERE resource=? AND id=?', (resource, record_id)).fetchone()
        return json.loads(row[0]) if row else None

    @staticmethod
    def records(db, resource):
        return [json.loads(row[0]) for row in db.execute('SELECT body FROM records WHERE resource=? ORDER BY rowid', (resource,))]
