"""Tamper-evident, hash-chained audit log with SQLite trigger immutability."""
import csv
import hashlib
import io
import json
from typing import Any
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import JSONResponse, StreamingResponse
from .storage import Store, now


def sanitize_csv_field(val: Any) -> str:
    """Neutralizes formula injection characters (=, +, -, @, \\t, \\r) in CSV cells."""
    if val is None:
        return ""
    text = str(val)
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{text}"
    return text


def compute_entry_hash(
    prev_hash: str,
    entry_id: str,
    actor: str,
    action: str,
    resource: str,
    record_id: str,
    title: str,
    before: Any,
    after: Any,
    created_at: str
) -> str:
    """Computes deterministic SHA-256 hash over canonical JSON representation of entry fields."""
    canonical_dict = {
        "prev_hash": str(prev_hash),
        "id": str(entry_id),
        "actor": str(actor),
        "action": str(action),
        "resource": str(resource),
        "record_id": str(record_id),
        "title": str(title),
        "before": before,
        "after": after,
        "created_at": str(created_at)
    }
    canonical_bytes = json.dumps(canonical_dict, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(canonical_bytes).hexdigest()


def append_audit_log(
    db,
    actor: str,
    action: str,
    resource: str,
    record_id: str = "",
    title: str = "",
    before: dict | list | None = None,
    after: dict | list | None = None,
    created_at: str | None = None
) -> dict:
    """Appends an immutable entry to the tamper-evident hash-chained audit log."""
    effective_actor = (actor or "").strip() or "system"
    effective_created_at = created_at or now()

    # Query latest entry to retrieve prev_hash
    last_row = db.execute("SELECT seq, entry_hash FROM audit_log ORDER BY seq DESC LIMIT 1").fetchone()
    prev_hash = last_row[1] if last_row else "GENESIS"

    entry_id = str(uuid4())
    entry_hash = compute_entry_hash(
        prev_hash=prev_hash,
        entry_id=entry_id,
        actor=effective_actor,
        action=action,
        resource=resource,
        record_id=record_id,
        title=title,
        before=before,
        after=after,
        created_at=effective_created_at
    )

    before_json = json.dumps(before, sort_keys=True) if before is not None else None
    after_json = json.dumps(after, sort_keys=True) if after is not None else None

    db.execute(
        """INSERT INTO audit_log (id, actor, action, resource, record_id, title, before, after, created_at, prev_hash, entry_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (entry_id, effective_actor, action, resource, record_id, title, before_json, after_json, effective_created_at, prev_hash, entry_hash)
    )

    return {
        "id": entry_id,
        "actor": effective_actor,
        "action": action,
        "resource": resource,
        "record_id": record_id,
        "title": title,
        "before": before,
        "after": after,
        "created_at": effective_created_at,
        "prev_hash": prev_hash,
        "entry_hash": entry_hash
    }


def verify_audit_log_chain(db) -> dict:
    """Verifies cryptographic hash-chain continuity from seq 1 to head."""
    rows = db.execute(
        """SELECT seq, id, actor, action, resource, record_id, title, before, after, created_at, prev_hash, entry_hash
           FROM audit_log ORDER BY seq ASC"""
    ).fetchall()

    if not rows:
        return {"ok": True, "entries": 0, "checked_at": now()}

    expected_prev = "GENESIS"
    for r in rows:
        seq = r[0]
        entry_id = r[1]
        actor = r[2]
        action = r[3]
        resource = r[4]
        record_id = r[5]
        title = r[6]
        before = json.loads(r[7]) if r[7] is not None else None
        after = json.loads(r[8]) if r[8] is not None else None
        created_at = r[9]
        stored_prev = r[10]
        stored_entry = r[11]

        # 1. Check prev_hash linkage
        if stored_prev != expected_prev:
            return {
                "ok": False,
                "broken_at_seq": seq,
                "reason": "prev_hash chain discontinuity",
                "expected": expected_prev,
                "actual": stored_prev
            }

        # 2. Recompute and verify entry_hash
        computed_hash = compute_entry_hash(
            prev_hash=stored_prev,
            entry_id=entry_id,
            actor=actor,
            action=action,
            resource=resource,
            record_id=record_id,
            title=title,
            before=before,
            after=after,
            created_at=created_at
        )

        if computed_hash != stored_entry:
            return {
                "ok": False,
                "broken_at_seq": seq,
                "reason": "entry_hash signature mismatch (content tampered)",
                "expected": computed_hash,
                "actual": stored_entry
            }

        expected_prev = stored_entry

    return {
        "ok": True,
        "entries": len(rows),
        "checked_at": now()
    }


def query_audit_log(
    db,
    actor: str = "",
    action: str = "",
    resource: str = "",
    record_id: str = "",
    since: str = "",
    until: str = "",
    limit: int = 100,
    offset: int = 0
) -> dict:
    """Paginated search over tamper-evident audit log entries."""
    conditions = []
    params = []

    if actor:
        conditions.append("actor = ?")
        params.append(actor)
    if action:
        conditions.append("action = ?")
        params.append(action)
    if resource:
        conditions.append("resource = ?")
        params.append(resource)
    if record_id:
        conditions.append("record_id = ?")
        params.append(record_id)
    if since:
        conditions.append("created_at >= ?")
        params.append(since)
    if until:
        conditions.append("created_at <= ?")
        params.append(until)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    count_sql = f"SELECT count(*) FROM audit_log {where_clause}"
    total = db.execute(count_sql, params).fetchone()[0]

    query_sql = f"""
        SELECT seq, id, actor, action, resource, record_id, title, before, after, created_at, prev_hash, entry_hash
        FROM audit_log {where_clause}
        ORDER BY seq DESC LIMIT ? OFFSET ?
    """
    rows = db.execute(query_sql, params + [min(max(limit, 1), 1000), max(offset, 0)]).fetchall()

    items = []
    for r in rows:
        items.append({
            "seq": r[0],
            "id": r[1],
            "actor": r[2],
            "action": r[3],
            "resource": r[4],
            "record_id": r[5],
            "title": r[6],
            "before": json.loads(r[7]) if r[7] is not None else None,
            "after": json.loads(r[8]) if r[8] is not None else None,
            "created_at": r[9],
            "prev_hash": r[10],
            "entry_hash": r[11]
        })

    return {"items": items, "total": total}


def ensure_audit_log_initialized(db) -> None:
    """Ensures audit_log table exists and creates the Genesis entry if empty."""
    db.executescript("""
        CREATE TABLE IF NOT EXISTS audit_log (
            seq INTEGER PRIMARY KEY AUTOINCREMENT,
            id TEXT NOT NULL,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            resource TEXT NOT NULL,
            record_id TEXT NOT NULL,
            title TEXT NOT NULL,
            before TEXT,
            after TEXT,
            created_at TEXT NOT NULL,
            prev_hash TEXT NOT NULL,
            entry_hash TEXT NOT NULL
        );

        CREATE TRIGGER IF NOT EXISTS audit_log_no_update
        BEFORE UPDATE ON audit_log
        BEGIN
            SELECT RAISE(ABORT, 'audit_log entries are immutable: UPDATE operations strictly prohibited');
        END;

        CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
        BEFORE DELETE ON audit_log
        BEGIN
            SELECT RAISE(ABORT, 'audit_log entries are immutable: DELETE operations strictly prohibited');
        END;
    """)

    count = db.execute("SELECT count(*) FROM audit_log").fetchone()[0]
    if count == 0:
        # Genesis entry
        genesis_id = str(uuid4())
        genesis_created_at = now()
        genesis_hash = compute_entry_hash(
            prev_hash="GENESIS",
            entry_id=genesis_id,
            actor="system",
            action="genesis",
            resource="system",
            record_id="root",
            title="Audit Log Genesis & Baseline Initialization",
            before=None,
            after={"status": "initialized", "vintage": "TSC-2017-2022"},
            created_at=genesis_created_at
        )
        db.execute(
            """INSERT INTO audit_log (id, actor, action, resource, record_id, title, before, after, created_at, prev_hash, entry_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                genesis_id,
                "system",
                "genesis",
                "system",
                "root",
                "Audit Log Genesis & Baseline Initialization",
                None,
                json.dumps({"status": "initialized", "vintage": "TSC-2017-2022"}, sort_keys=True),
                genesis_created_at,
                "GENESIS",
                genesis_hash
            )
        )


def audit_router(store: Store):
    router = APIRouter(prefix='/api/audit')

    @router.get('/verify')
    def verify_log():
        """Recomputes the cryptographic SHA-256 hash chain and returns integrity status."""
        with store.transaction() as db:
            return verify_audit_log_chain(db)

    @router.get('/log')
    def read_log(
        actor: str = Query(""),
        action: str = Query(""),
        resource: str = Query(""),
        record_id: str = Query(""),
        since: str = Query(""),
        until: str = Query(""),
        limit: int = Query(100),
        offset: int = Query(0)
    ):
        """Returns paginated audit log entries with optional filters."""
        with store.transaction() as db:
            return query_audit_log(
                db,
                actor=actor,
                action=action,
                resource=resource,
                record_id=record_id,
                since=since,
                until=until,
                limit=limit,
                offset=offset
            )

    @router.get('/export')
    def export_log(format: str = Query("json")):
        """Exports the full tamper-evident audit log with all hashes as CSV or JSON."""
        with store.transaction() as db:
            rows = db.execute(
                """SELECT seq, id, created_at, actor, action, resource, record_id, title, prev_hash, entry_hash, before, after
                   FROM audit_log ORDER BY seq ASC"""
            ).fetchall()

        if format.lower() == "csv":
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow([
                "seq", "id", "created_at", "actor", "action", "resource",
                "record_id", "title", "prev_hash", "entry_hash", "before", "after"
            ])
            for r in rows:
                writer.writerow([
                    r[0],
                    r[1],
                    r[2],
                    sanitize_csv_field(r[3]),
                    sanitize_csv_field(r[4]),
                    sanitize_csv_field(r[5]),
                    sanitize_csv_field(r[6]),
                    sanitize_csv_field(r[7]),
                    r[8],
                    r[9],
                    sanitize_csv_field(r[10]),
                    sanitize_csv_field(r[11])
                ])
            return Response(
                content=buf.getvalue(),
                media_type="text/csv",
                headers={"Content-Disposition": 'attachment; filename="tofrom_audit_log.csv"'}
            )
        else:
            entries = []
            for r in rows:
                entries.append({
                    "seq": r[0],
                    "id": r[1],
                    "created_at": r[2],
                    "actor": r[3],
                    "action": r[4],
                    "resource": r[5],
                    "record_id": r[6],
                    "title": r[7],
                    "prev_hash": r[8],
                    "entry_hash": r[9],
                    "before": json.loads(r[10]) if r[10] is not None else None,
                    "after": json.loads(r[11]) if r[11] is not None else None
                })
            return JSONResponse(content=entries)

    return router
