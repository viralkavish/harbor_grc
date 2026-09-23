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
                    id TEXT PRIMARY KEY, token TEXT NOT NULL, expires REAL NOT NULL,
                    user_id TEXT, last_activity REAL);
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_login_at TEXT,
                    failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until REAL DEFAULT 0,
                    assigned_control_ids TEXT NOT NULL DEFAULT '[]');
                CREATE TABLE IF NOT EXISTS policy_versions (
                    id TEXT PRIMARY KEY, policy_id TEXT NOT NULL, version INTEGER NOT NULL,
                    content TEXT NOT NULL, created_at TEXT NOT NULL,
                    approved_by TEXT, approved_at TEXT);
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
                CREATE TABLE IF NOT EXISTS engagements (
                    id TEXT PRIMARY KEY, framework TEXT NOT NULL DEFAULT 'SOC 2',
                    audit_period_start TEXT NOT NULL DEFAULT '2027-01-01',
                    audit_period_end TEXT NOT NULL DEFAULT '2027-12-31',
                    criteria_in_scope TEXT NOT NULL, auditor_name TEXT NOT NULL,
                    auditor_email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
                    early_access INTEGER NOT NULL DEFAULT 0, downloads_enabled INTEGER NOT NULL DEFAULT 1,
                    access_token_hash TEXT, token_expires_at TEXT, revoked INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS rfis (
                    id TEXT PRIMARY KEY, engagement_id TEXT NOT NULL, author TEXT NOT NULL,
                    author_role TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
                    criterion_refs TEXT NOT NULL DEFAULT '[]', control_refs TEXT NOT NULL DEFAULT '[]',
                    status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                    FOREIGN KEY(engagement_id) REFERENCES engagements(id) ON DELETE CASCADE);
                CREATE TABLE IF NOT EXISTS rfi_messages (
                    id TEXT PRIMARY KEY, rfi_id TEXT NOT NULL, author TEXT NOT NULL,
                    author_role TEXT NOT NULL, message TEXT NOT NULL,
                    evidence_ids TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL,
                    FOREIGN KEY(rfi_id) REFERENCES rfis(id) ON DELETE CASCADE);
                CREATE TABLE IF NOT EXISTS pbc_requests (
                    id TEXT NOT NULL, engagement_id TEXT NOT NULL,
                    criterion_refs TEXT NOT NULL DEFAULT '[]', control_refs TEXT NOT NULL DEFAULT '[]',
                    title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested',
                    staged_evidence_ids TEXT NOT NULL DEFAULT '[]', notes TEXT DEFAULT '',
                    history TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                    PRIMARY KEY(id, engagement_id),
                    FOREIGN KEY(engagement_id) REFERENCES engagements(id) ON DELETE CASCADE);
                CREATE TABLE IF NOT EXISTS audit_snapshots (
                    id TEXT PRIMARY KEY, engagement_id TEXT NOT NULL, created_at TEXT NOT NULL,
                    audit_log_head_hash TEXT NOT NULL, manifest TEXT NOT NULL,
                    content_bytes BLOB NOT NULL, sha256 TEXT NOT NULL,
                    FOREIGN KEY(engagement_id) REFERENCES engagements(id) ON DELETE CASCADE);
                CREATE TABLE IF NOT EXISTS monitoring_runs (
                    id TEXT PRIMARY KEY, started_at TEXT NOT NULL, completed_at TEXT NOT NULL,
                    triggered_by TEXT NOT NULL, results TEXT NOT NULL, summary TEXT);
                CREATE TABLE IF NOT EXISTS exceptions (
                    id TEXT PRIMARY KEY, test_id TEXT NOT NULL DEFAULT '', control_refs TEXT NOT NULL DEFAULT '[]',
                    title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', owner TEXT NOT NULL DEFAULT '',
                    due_date TEXT, tags TEXT NOT NULL DEFAULT '[]', reason TEXT NOT NULL DEFAULT '',
                    notes TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                    history TEXT NOT NULL DEFAULT '[]');
                CREATE TABLE IF NOT EXISTS samples (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, population_type TEXT NOT NULL,
                    population_source TEXT NOT NULL, population_size INTEGER NOT NULL,
                    population_filters TEXT NOT NULL, completeness_statement TEXT NOT NULL,
                    method TEXT NOT NULL, seed INTEGER, method_params TEXT,
                    sample_size INTEGER NOT NULL, sample_ids TEXT NOT NULL,
                    sample_items TEXT NOT NULL, generated_at TEXT NOT NULL,
                    generated_by TEXT NOT NULL, criterion_refs TEXT NOT NULL,
                    control_refs TEXT NOT NULL, notes TEXT);
                CREATE TABLE IF NOT EXISTS risks (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
                    category TEXT NOT NULL DEFAULT 'operational', owner TEXT NOT NULL DEFAULT '',
                    due_date TEXT, tags TEXT NOT NULL DEFAULT '[]',
                    likelihood INTEGER, impact INTEGER, inherent_score INTEGER,
                    mitigating_control_refs TEXT NOT NULL DEFAULT '[]',
                    treatment TEXT NOT NULL DEFAULT 'mitigate', treatment_plan TEXT NOT NULL DEFAULT '',
                    residual_likelihood INTEGER, residual_impact INTEGER, residual_score INTEGER,
                    risk_appetite TEXT NOT NULL DEFAULT 'within', status TEXT NOT NULL DEFAULT 'open',
                    review_cadence_days INTEGER NOT NULL DEFAULT 90, last_reviewed_at TEXT, next_review_at TEXT,
                    accepted_by TEXT, accepted_at TEXT, acceptance_expiry TEXT, acceptance_rationale TEXT,
                    review_history TEXT NOT NULL DEFAULT '[]', reopen_reason TEXT, closure_rationale TEXT,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT);
                CREATE TABLE IF NOT EXISTS coverage_gaps (
                    id TEXT PRIMARY KEY, control_id TEXT NOT NULL, criterion_code TEXT NOT NULL,
                    gap_start TEXT NOT NULL, gap_end TEXT NOT NULL, days INTEGER NOT NULL,
                    reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
                    detected_at TEXT NOT NULL, remediation_evidence_ref TEXT, remediation_notes TEXT,
                    accepted_by TEXT, accepted_at TEXT, acceptance_expiry TEXT, acceptance_rationale TEXT,
                    closure_note TEXT, closed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
            ''')
            from .audit_ops import ensure_audit_log_initialized
            ensure_audit_log_initialized(db)
            try:
                db.execute("ALTER TABLE policy_versions ADD COLUMN approved_by TEXT")
            except Exception:
                pass
            try:
                db.execute("ALTER TABLE policy_versions ADD COLUMN approved_at TEXT")
            except Exception:
                pass
            try:
                db.execute("ALTER TABLE sessions ADD COLUMN user_id TEXT")
            except Exception:
                pass
            try:
                db.execute("ALTER TABLE sessions ADD COLUMN last_activity REAL")
            except Exception:
                pass

            # Migrate existing generic risks into dedicated risks table (K10)
            try:
                for row in db.execute("SELECT body FROM records WHERE resource='risks'").fetchall():
                    r = json.loads(row[0])
                    rid = r.get('id')
                    if rid and not db.execute("SELECT id FROM risks WHERE id=?", (rid,)).fetchone():
                        l = r.get('likelihood')
                        i = r.get('impact')
                        rl = r.get('residual_likelihood')
                        ri = r.get('residual_impact')
                        inh = (l * i) if (isinstance(l, int) and isinstance(i, int)) else None
                        res_sc = (rl * ri) if (isinstance(rl, int) and isinstance(ri, int)) else None
                        ctrl_refs = r.get('control_ids') or r.get('mitigating_control_refs') or []
                        db.execute(
                            """INSERT OR IGNORE INTO risks
                               (id, title, description, category, owner, likelihood, impact, inherent_score,
                                mitigating_control_refs, treatment, treatment_plan, residual_likelihood, residual_impact,
                                residual_score, status, review_cadence_days, created_at, updated_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                            (
                                rid, r.get('title', 'Migrated Risk'), r.get('description', ''),
                                r.get('category', 'operational'), r.get('owner', ''),
                                l, i, inh, json.dumps(ctrl_refs),
                                r.get('treatment', 'mitigate'), r.get('treatment_plan', ''),
                                rl, ri, res_sc, r.get('status', 'open'),
                                r.get('review_cadence_days', 90),
                                r.get('created_at', now()), r.get('updated_at', now())
                            )
                        )
            except Exception:
                pass

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
