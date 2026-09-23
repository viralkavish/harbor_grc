"""Parameterized SQLite persistence. One transaction per logical write."""
import base64
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
from threading import RLock
from cryptography.fernet import Fernet

WORKSPACE = dict(name='tofromGRC Workspace', organization='tofrom', owner='Security Lead', description='Internal SOC 2 Type II readiness workspace for tofrom.',
                 trust_title='Security at tofrom', trust_description='SOC 2 Type II Readiness',
                 trust_policy_ids=[], trust_evidence_ids=[],
                 jev_api_key='', jev_endpoint='https://api.typesafe.ai/v1',
                 company='tofrom', criteria=['Security', 'Availability', 'Confidentiality'],
                 audit_type='Type II', observation_start='2027-01-01', auditor='',
                 onboarding_completed=False, dni_permission_confirmed=False)


def now():
    return datetime.now(timezone.utc).isoformat()


def get_fernet(root_dir: Path | None = None) -> Fernet:
    env_key = os.environ.get('JEV_KEY_ENCRYPTION_KEY', '').strip()
    if env_key:
        try:
            return Fernet(env_key.encode('utf-8'))
        except Exception:
            derived = base64.urlsafe_b64encode(hashlib.sha256(env_key.encode('utf-8')).digest())
            return Fernet(derived)
    target_dir = root_dir or Store._global_root
    if target_dir is not None:
        key_file = Path(target_dir) / '.encryption_key'
        if key_file.exists():
            return Fernet(key_file.read_bytes().strip())
        key = Fernet.generate_key()
        try:
            key_file.write_bytes(key)
            key_file.chmod(0o600)
        except Exception:
            pass
        return Fernet(key)
    # Deterministic fallback key derived from static salt
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(b'twofrom_default_key_fallback').digest()))


def encrypt_key(plain: str, root_dir: Path | None = None) -> str:
    if not plain:
        return ""
    if plain.startswith("enc:"):
        return plain
    f = get_fernet(root_dir)
    token = f.encrypt(plain.encode('utf-8')).decode('utf-8')
    return f"enc:{token}"


def decrypt_key(stored: str, root_dir: Path | None = None) -> str:
    if not stored:
        return ""
    if not stored.startswith("enc:"):
        return stored
    token = stored[4:]
    try:
        f = get_fernet(root_dir)
        return f.decrypt(token.encode('utf-8')).decode('utf-8')
    except Exception:
        return ""


def sanitize_workspace(ws: dict) -> dict:
    """Never return full API keys to the browser; return configuration boolean and 4-character preview."""
    sanitized = dict(ws)
    raw_key = sanitized.pop('jev_api_key', '') or ''
    if isinstance(raw_key, str) and raw_key.startswith("enc:"):
        raw_key = decrypt_key(raw_key)
    sanitized['api_key_configured'] = bool(raw_key)
    sanitized['jev_api_key_configured'] = bool(raw_key)
    sanitized['masked_key'] = f"...{raw_key[-4:]}" if raw_key else ""
    sanitized['jev_api_key_preview'] = f"...{raw_key[-4:]}" if raw_key else ""
    return sanitized


class Store:
    _global_root: Path | None = None

    def __init__(self, data_dir):
        self.root = Path(data_dir).resolve()
        Store._global_root = self.root
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
                CREATE TABLE IF NOT EXISTS pilots (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL,
                    created_at TEXT NOT NULL, policy_ids TEXT NOT NULL, sample_size INTEGER NOT NULL,
                    seed INTEGER, revealed_at TEXT, results TEXT);
                CREATE TABLE IF NOT EXISTS control_versions (
                    id TEXT PRIMARY KEY, control_id TEXT NOT NULL, version INTEGER NOT NULL,
                    body TEXT NOT NULL, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS pilot_pairs (
                    id TEXT PRIMARY KEY, pilot_id TEXT NOT NULL, policy_id TEXT NOT NULL,
                    policy_title TEXT NOT NULL, policy_snippet TEXT NOT NULL, control_id TEXT NOT NULL,
                    control_code TEXT NOT NULL, control_title TEXT NOT NULL, control_category TEXT NOT NULL,
                    jev_verdict TEXT, jev_confidence REAL, jev_score REAL, jev_decided_by TEXT,
                    jev_summary TEXT, human_verdict TEXT, graded_at TEXT,
                    FOREIGN KEY(pilot_id) REFERENCES pilots(id) ON DELETE CASCADE);
            ''')
            from .audit_ops import ensure_audit_log_initialized
            ensure_audit_log_initialized(db)
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
        raw = db.execute('SELECT value FROM settings WHERE key=?', ('workspace',)).fetchone()
        if not raw:
            return dict(WORKSPACE)
        ws = json.loads(raw[0])
        raw_key = ws.get('jev_api_key', '')
        if raw_key and isinstance(raw_key, str) and raw_key.startswith('enc:'):
            ws['jev_api_key'] = decrypt_key(raw_key)
        return ws

    @staticmethod
    def save_workspace(db, workspace: dict):
        ws_to_save = dict(workspace)
        raw_key = ws_to_save.get('jev_api_key', '')
        if raw_key and isinstance(raw_key, str) and not raw_key.startswith('enc:'):
            ws_to_save['jev_api_key'] = encrypt_key(raw_key)
        db.execute('UPDATE settings SET value=? WHERE key=?', (json.dumps(ws_to_save), 'workspace'))

    @staticmethod
    def get(db, resource, record_id):
        row = db.execute('SELECT body FROM records WHERE resource=? AND id=?', (resource, record_id)).fetchone()
        return json.loads(row[0]) if row else None

    @staticmethod
    def records(db, resource):
        return [json.loads(row[0]) for row in db.execute('SELECT body FROM records WHERE resource=? ORDER BY rowid', (resource,))]
