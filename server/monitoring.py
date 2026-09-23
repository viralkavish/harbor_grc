"""Continuous monitoring engine, persisted run history, scheduler, and exceptions lifecycle.

Implements M1-M6 requirements:
- Persisted monitoring_runs table with M3 transparency fields
- Configurable daily scheduler with health probes
- Automated-test transparency (source_system, query_logic, generated_at, test_version)
- Exceptions lifecycle (open -> acknowledged -> remediated -> closed) with deduplication
- Universal R3 audit logging
"""
from datetime import date, datetime, timedelta, timezone
import json
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Query
from .storage import Store, now
from .audit_ops import append_audit_log
from .continuous_tests import evaluate_continuous_tests


CHECK_DEFINITIONS = [
    {
        "id": "unassigned_controls",
        "title": "Controls without assigned owners",
        "description": "Ensures every applicable compliance control has a designated owner accountable for its operating effectiveness."
    },
    {
        "id": "expired_evidence",
        "title": "Expired compliance evidence",
        "description": "Verifies that all collected evidence attachments and attestations remain within their valid period."
    },
    {
        "id": "overdue_policy_reviews",
        "title": "Overdue policy reviews",
        "description": "Flags policies that have exceeded their scheduled annual or periodic review date."
    },
    {
        "id": "overdue_vendor_reviews",
        "title": "Overdue vendor security reviews",
        "description": "Identifies third-party vendors whose risk assessment or contract renewal date has passed."
    },
    {
        "id": "overdue_tasks",
        "title": "Overdue remediation tasks",
        "description": "Monitors open action items and compliance remediation tasks that have missed their due date."
    },
    {
        "id": "unencrypted_assets",
        "title": "Unencrypted company assets",
        "description": "Surfaces hardware and data stores explicitly recorded as unencrypted. Unassessed records remain neutral."
    },
    {
        "id": "open_access_reviews",
        "title": "Incomplete user access reviews",
        "description": "Checks access review campaigns for accounts or entitlements still pending an explicit keep or revoke decision."
    }
]


def evaluate_checks(db):
    today = date.today().isoformat()
    checks = []

    # 1. Unassigned controls
    controls = Store.records(db, 'controls')
    findings_1 = []
    for c in controls:
        if c.get('status') != 'not_applicable' and not c.get('owner', '').strip():
            findings_1.append({
                'resource': 'controls',
                'id': c['id'],
                'title': f"{c.get('code', '')} {c['title']}".strip(),
                'reason': 'No owner assigned to control'
            })
    checks.append({
        **CHECK_DEFINITIONS[0],
        'status': 'fail' if findings_1 else 'pass',
        'finding_count': len(findings_1),
        'findings': findings_1
    })

    # 2. Expired evidence
    evidence = Store.records(db, 'evidence')
    findings_2 = []
    for e in evidence:
        if e.get('status') == 'expired' or (e.get('expires_date') and e['expires_date'] < today):
            findings_2.append({
                'resource': 'evidence',
                'id': e['id'],
                'title': e['title'],
                'reason': f"Evidence expired on {e.get('expires_date') or 'prior date'}"
            })
    checks.append({
        **CHECK_DEFINITIONS[1],
        'status': 'fail' if findings_2 else 'pass',
        'finding_count': len(findings_2),
        'findings': findings_2
    })

    # 3. Overdue policy reviews
    policies = Store.records(db, 'policies')
    findings_3 = []
    for p in policies:
        if p.get('review_date') and p['review_date'] < today:
            findings_3.append({
                'resource': 'policies',
                'id': p['id'],
                'title': p['title'],
                'reason': f"Review was due on {p['review_date']}"
            })
    checks.append({
        **CHECK_DEFINITIONS[2],
        'status': 'fail' if findings_3 else 'pass',
        'finding_count': len(findings_3),
        'findings': findings_3
    })

    # 4. Overdue vendor reviews
    vendors = Store.records(db, 'vendors')
    findings_4 = []
    for v in vendors:
        reasons = []
        if v.get('review_date') and v['review_date'] < today:
            reasons.append(f"Security review overdue ({v['review_date']})")
        if v.get('renewal_date') and v['renewal_date'] < today:
            reasons.append(f"Contract renewal overdue ({v['renewal_date']})")
        if reasons:
            findings_4.append({
                'resource': 'vendors',
                'id': v['id'],
                'title': v['title'],
                'reason': '; '.join(reasons)
            })
    checks.append({
        **CHECK_DEFINITIONS[3],
        'status': 'fail' if findings_4 else 'pass',
        'finding_count': len(findings_4),
        'findings': findings_4
    })

    # 5. Overdue tasks
    tasks = Store.records(db, 'tasks')
    findings_5 = []
    for t in tasks:
        if t.get('due_date') and t['due_date'] < today and t.get('status') != 'done':
            findings_5.append({
                'resource': 'tasks',
                'id': t['id'],
                'title': t['title'],
                'reason': f"Task was due on {t['due_date']}"
            })
    checks.append({
        **CHECK_DEFINITIONS[4],
        'status': 'fail' if findings_5 else 'pass',
        'finding_count': len(findings_5),
        'findings': findings_5
    })

    # 6. Unencrypted assets
    assets = Store.records(db, 'assets')
    findings_6 = []
    for a in assets:
        if a.get('encrypted') is False:
            findings_6.append({
                'resource': 'assets',
                'id': a['id'],
                'title': a['title'],
                'reason': 'Asset explicitly recorded as unencrypted'
            })
    checks.append({
        **CHECK_DEFINITIONS[5],
        'status': 'fail' if findings_6 else 'pass',
        'finding_count': len(findings_6),
        'findings': findings_6
    })

    # 7. Open access review decisions
    reviews = Store.records(db, 'access_reviews')
    findings_7 = []
    for ar in reviews:
        if ar.get('status') != 'completed':
            pending_count = sum(1 for e in ar.get('entries', []) if e.get('decision') == 'pending')
            if pending_count > 0:
                findings_7.append({
                    'resource': 'access_reviews',
                    'id': ar['id'],
                    'title': ar['title'],
                    'reason': f"{pending_count} access decision(s) still pending"
                })
    checks.append({
        **CHECK_DEFINITIONS[6],
        'status': 'fail' if findings_7 else 'pass',
        'finding_count': len(findings_7),
        'findings': findings_7
    })

    return checks


def compute_next_run(schedule_time_str: str = "06:00") -> str:
    """Computes the ISO timestamp of the next scheduled run."""
    try:
        hour, minute = map(int, schedule_time_str.split(":"))
    except Exception:
        hour, minute = 6, 0

    now_utc = datetime.now(timezone.utc)
    target = now_utc.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= now_utc:
        target += timedelta(days=1)
    return target.isoformat()


def execute_monitoring_run(db, triggered_by: str = "manual", actor: str = "Security Lead") -> dict:
    started_at = now()
    results = evaluate_continuous_tests(db)
    completed_at = now()
    run_id = str(uuid4())

    passing = sum(1 for r in results if r['status'] == 'pass')
    warning = sum(1 for r in results if r['status'] == 'warning')
    failing = sum(1 for r in results if r['status'] == 'fail')

    summary = {
        "total": len(results),
        "passing": passing,
        "warning": warning,
        "failing": failing,
        "health_percent": round((passing / len(results)) * 100, 1) if results else 0.0
    }

    # Auto-create exceptions on fail results (with deduplication)
    for r in results:
        if r['status'] == 'fail':
            test_id = r['id']
            # Check if open or acknowledged exception already exists
            existing = db.execute(
                """SELECT id, history, notes FROM exceptions
                   WHERE test_id = ? AND status IN ('open', 'acknowledged')""",
                (test_id,)
            ).fetchone()

            if existing:
                exc_id, hist_raw, notes_raw = existing
                try:
                    hist = json.loads(hist_raw)
                except Exception:
                    hist = []
                hist.append({
                    "from": "persisted_failure",
                    "to": "repeat_failure",
                    "actor": "system",
                    "timestamp": completed_at,
                    "reason": f"Repeat test failure observed: {r['summary']}"
                })
                db.execute(
                    "UPDATE exceptions SET history = ?, updated_at = ? WHERE id = ?",
                    (json.dumps(hist), completed_at, exc_id)
                )
            else:
                new_exc_id = str(uuid4())
                ctrl_refs = json.dumps(r.get('control_ids', []))
                init_notes = json.dumps([
                    {
                        "id": str(uuid4()),
                        "author": "system",
                        "text": f"Continuous monitoring check failed: {r['summary']}",
                        "created_at": completed_at
                    }
                ])
                init_hist = json.dumps([
                    {
                        "from": None,
                        "to": "open",
                        "actor": "system",
                        "timestamp": completed_at,
                        "reason": r['summary']
                    }
                ])
                due_date = (date.today() + timedelta(days=14)).isoformat()
                title = f"Control Gap: {r['title']}"

                db.execute(
                    """INSERT INTO exceptions
                       (id, test_id, control_refs, title, status, owner, due_date, notes, created_at, updated_at, history)
                       VALUES (?, ?, ?, ?, 'open', '', ?, ?, ?, ?, ?)""",
                    (new_exc_id, test_id, ctrl_refs, title, due_date, init_notes, completed_at, completed_at, init_hist)
                )
                append_audit_log(
                    db,
                    actor="system",
                    action="create_exception",
                    resource="exceptions",
                    record_id=new_exc_id,
                    title=title,
                    after={"test_id": test_id, "control_refs": r.get('control_ids', []), "status": "open"}
                )

    # Persist monitoring run
    db.execute(
        """INSERT INTO monitoring_runs (id, started_at, completed_at, triggered_by, results, summary)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (run_id, started_at, completed_at, triggered_by, json.dumps(results), json.dumps(summary))
    )

    # Update settings metadata
    checks = evaluate_checks(db)
    for c in checks:
        c['last_run'] = completed_at

    legacy_result = {
        'checks': checks,
        'last_run': completed_at,
        'disclaimer': 'Local record checks — no connected cloud telemetry'
    }
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_monitoring_run', ?)",
        (json.dumps(legacy_result),)
    )

    if triggered_by == "schedule":
        db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_scheduled_run_at', ?)",
            (completed_at,)
        )

    # Audit log
    append_audit_log(
        db,
        actor=actor,
        action="monitoring_run",
        resource="monitoring",
        record_id=run_id,
        title=f"Monitoring Suite Run ({triggered_by})",
        after=summary
    )

    return {
        "id": run_id,
        "started_at": started_at,
        "completed_at": completed_at,
        "triggered_by": triggered_by,
        "results": results,
        "summary": summary,
        "checks": checks,
        "last_run": completed_at,
        "disclaimer": "Local record checks & continuous host telemetry"
    }


def monitoring_router(store):
    router = APIRouter()

    @router.get('/api/monitoring')
    @router.get('/api/monitoring/checks')
    def get_monitoring():
        with store.transaction() as db:
            last_run_row = db.execute(
                "SELECT value FROM settings WHERE key='last_monitoring_run'"
            ).fetchone()
            if last_run_row:
                try:
                    return json.loads(last_run_row[0])
                except Exception:
                    pass

            checks = evaluate_checks(db)
            return {
                'checks': checks,
                'last_run': None,
                'disclaimer': 'Local record checks — no connected cloud telemetry'
            }

    @router.get('/api/monitoring/drift')
    def get_control_drift():
        """Returns active compliance control drift alerts across policies, access reviews, and evidence."""
        with store.transaction() as db:
            checks = evaluate_checks(db)
            drift_findings = []
            for c in checks:
                if c['id'] in ('expired_evidence', 'overdue_policy_reviews', 'open_access_reviews', 'unassigned_controls'):
                    for f in c.get('findings', []):
                        drift_findings.append({
                            'check_id': c['id'],
                            'title': c['title'],
                            'item_title': f.get('title'),
                            'resource': f.get('resource'),
                            'id': f.get('id'),
                            'reason': f.get('reason'),
                            'detected_at': now()
                        })
            return {
                "drift_count": len(drift_findings),
                "is_drift_free": len(drift_findings) == 0,
                "findings": drift_findings
            }

    @router.post('/api/monitoring/run')
    def run_monitoring(payload: dict | None = None):
        actor = (payload.get('actor') if payload else None) or "Security Lead"
        with store.transaction() as db:
            return execute_monitoring_run(db, triggered_by=actor, actor=actor)

    @router.post('/api/monitoring/run_scheduled')
    def run_scheduled_monitoring():
        with store.transaction() as db:
            return execute_monitoring_run(db, triggered_by="schedule", actor="system")

    @router.get('/api/monitoring/runs')
    def list_monitoring_runs(limit: int = 50, offset: int = 0):
        with store.transaction() as db:
            rows = db.execute(
                """SELECT id, started_at, completed_at, triggered_by, results, summary
                   FROM monitoring_runs ORDER BY completed_at DESC LIMIT ? OFFSET ?""",
                (limit, offset)
            ).fetchall()
            items = []
            for r in rows:
                try:
                    res = json.loads(r[4])
                except Exception:
                    res = []
                try:
                    sm = json.loads(r[5])
                except Exception:
                    sm = {}
                items.append({
                    "id": r[0],
                    "started_at": r[1],
                    "completed_at": r[2],
                    "triggered_by": r[3],
                    "results": res,
                    "summary": sm
                })
            count_row = db.execute("SELECT count(*) FROM monitoring_runs").fetchone()
            total = count_row[0] if count_row else len(items)
            return {"items": items, "total": total}

    @router.get('/api/monitoring/runs/latest')
    def get_latest_monitoring_run():
        with store.transaction() as db:
            row = db.execute(
                """SELECT id, started_at, completed_at, triggered_by, results, summary
                   FROM monitoring_runs ORDER BY completed_at DESC LIMIT 1"""
            ).fetchone()
            if not row:
                raise HTTPException(404, "No monitoring runs have executed yet.")
            try:
                res = json.loads(row[4])
            except Exception:
                res = []
            try:
                sm = json.loads(row[5])
            except Exception:
                sm = {}
            return {
                "id": row[0],
                "started_at": row[1],
                "completed_at": row[2],
                "triggered_by": row[3],
                "results": res,
                "summary": sm
            }

    @router.get('/api/monitoring/scheduler')
    def get_scheduler_status():
        with store.transaction() as db:
            row = db.execute(
                "SELECT value FROM settings WHERE key='last_scheduled_run_at'"
            ).fetchone()
            last_run = row[0] if row else None
            sched_time = "06:00"
            next_run = compute_next_run(sched_time)
            return {
                "status": "active",
                "daily_schedule_time": sched_time,
                "last_run_at": last_run,
                "next_run_at": next_run
            }

    # Exceptions Endpoints
    @router.get('/api/exceptions')
    def list_exceptions(status: str | None = None, q: str | None = None, limit: int = 50, offset: int = 0):
        with store.transaction() as db:
            query = """SELECT id, test_id, control_refs, title, status, owner, due_date, tags, reason, notes, created_at, updated_at, history
                       FROM exceptions WHERE 1=1"""
            params: list = []
            if status and status != 'all':
                query += " AND status = ?"
                params.append(status)
            if q:
                query += " AND (title LIKE ? OR reason LIKE ? OR owner LIKE ?)"
                pattern = f"%{q}%"
                params.extend([pattern, pattern, pattern])

            query += " ORDER BY created_at DESC"
            rows = db.execute(query, params).fetchall()

            items = []
            for r in rows:
                try:
                    c_refs = json.loads(r[2])
                except Exception:
                    c_refs = []
                try:
                    tags = json.loads(r[7])
                except Exception:
                    tags = []
                try:
                    notes = json.loads(r[9])
                except Exception:
                    notes = []
                try:
                    hist = json.loads(r[12])
                except Exception:
                    hist = []
                items.append({
                    "id": r[0],
                    "test_id": r[1],
                    "control_refs": c_refs,
                    "title": r[3],
                    "status": r[4],
                    "owner": r[5],
                    "due_date": r[6],
                    "tags": tags,
                    "reason": r[8],
                    "notes": notes,
                    "created_at": r[10],
                    "updated_at": r[11],
                    "history": hist
                })
            return {"items": items[offset:offset+limit], "total": len(items)}

    @router.post('/api/exceptions', status_code=201)
    def create_exception_record(payload: dict):
        with store.transaction() as db:
            from .records import validate
            validated = validate('exceptions', payload)
            ts = now()
            exc_id = str(uuid4())
            title = validated.get('title', 'New Exception')
            status = validated.get('status') or 'open'
            owner = validated.get('owner', '')
            due_date = validated.get('due_date')
            tags = validated.get('tags', [])
            reason = validated.get('reason', '')
            test_id = validated.get('test_id', '')
            control_refs = list(validated.get('control_refs') or [])
            if validated.get('control_id'):
                control_refs.append(validated.get('control_id'))
            notes = validated.get('notes', [])
            hist = validated.get('history', [{'from': None, 'to': status, 'actor': 'user', 'timestamp': ts}])

            db.execute(
                """INSERT INTO exceptions
                   (id, test_id, control_refs, title, status, owner, due_date, tags, reason, notes, created_at, updated_at, history)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (exc_id, test_id, json.dumps(control_refs), title, status, owner, due_date, json.dumps(tags), reason, json.dumps(notes), ts, ts, json.dumps(hist))
            )
            item = {
                "id": exc_id,
                "test_id": test_id,
                "control_refs": control_refs,
                "title": title,
                "status": status,
                "owner": owner,
                "due_date": due_date,
                "tags": tags,
                "reason": reason,
                "notes": notes,
                "created_at": ts,
                "updated_at": ts,
                "history": hist
            }
            append_audit_log(db, actor=owner or "user", action="create", resource="exceptions", record_id=exc_id, title=title, after=item)
            return item

    @router.get('/api/exceptions/{exc_id}')
    def get_exception_record(exc_id: str):
        with store.transaction() as db:
            row = db.execute(
                """SELECT id, test_id, control_refs, title, status, owner, due_date, tags, reason, notes, created_at, updated_at, history
                   FROM exceptions WHERE id = ?""",
                (exc_id,)
            ).fetchone()
            if not row:
                raise HTTPException(404, f"Exception {exc_id} not found.")
            return {
                "id": row[0],
                "test_id": row[1],
                "control_refs": json.loads(row[2]) if row[2] else [],
                "title": row[3],
                "status": row[4],
                "owner": row[5],
                "due_date": row[6],
                "tags": json.loads(row[7]) if row[7] else [],
                "reason": row[8],
                "notes": json.loads(row[9]) if row[9] else [],
                "created_at": row[10],
                "updated_at": row[11],
                "history": json.loads(row[12]) if row[12] else []
            }

    @router.patch('/api/exceptions/{exc_id}')
    def patch_exception_record(exc_id: str, payload: dict):
        with store.transaction() as db:
            from .records import validate
            row = db.execute(
                """SELECT id, test_id, control_refs, title, status, owner, due_date, tags, reason, notes, created_at, updated_at, history
                   FROM exceptions WHERE id = ?""",
                (exc_id,)
            ).fetchone()
            if not row:
                raise HTTPException(404, f"Exception {exc_id} not found.")

            current = {
                "id": row[0],
                "test_id": row[1],
                "control_refs": json.loads(row[2]) if row[2] else [],
                "title": row[3],
                "status": row[4],
                "owner": row[5],
                "due_date": row[6],
                "tags": json.loads(row[7]) if row[7] else [],
                "reason": row[8],
                "notes": json.loads(row[9]) if row[9] else [],
                "created_at": row[10],
                "updated_at": row[11],
                "history": json.loads(row[12]) if row[12] else []
            }
            validated = validate('exceptions', payload, current)
            updated = dict(current)
            updated.update(validated)
            ts = now()
            updated['updated_at'] = ts

            db.execute(
                """UPDATE exceptions
                   SET title = ?, status = ?, owner = ?, due_date = ?, tags = ?, reason = ?, notes = ?, updated_at = ?
                   WHERE id = ?""",
                (updated['title'], updated['status'], updated['owner'], updated['due_date'], json.dumps(updated['tags']), updated['reason'], json.dumps(updated['notes']), ts, exc_id)
            )
            append_audit_log(db, actor=updated.get('owner') or "user", action="update", resource="exceptions", record_id=exc_id, title=updated['title'], before=current, after=updated)
            return updated

    @router.delete('/api/exceptions/{exc_id}')
    def delete_exception_record(exc_id: str):
        with store.transaction() as db:
            row = db.execute("SELECT id, title FROM exceptions WHERE id = ?", (exc_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Exception {exc_id} not found.")
            db.execute("DELETE FROM exceptions WHERE id = ?", (exc_id,))
            append_audit_log(db, actor="user", action="delete", resource="exceptions", record_id=exc_id, title=row[1])
            return {"deleted": True}

    @router.post('/api/exceptions/{exc_id}/assign')
    def assign_exception(exc_id: str, payload: dict):
        owner = payload.get('owner', '').strip()
        due_date = payload.get('due_date')
        actor = payload.get('actor') or "SecOps Manager"
        if not owner:
            raise HTTPException(422, "Owner is required to assign exception.")

        with store.transaction() as db:
            row = db.execute("SELECT id, status, notes, history, title FROM exceptions WHERE id = ?", (exc_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Exception {exc_id} not found.")

            old_status = row[1]
            try:
                notes = json.loads(row[2])
            except Exception:
                notes = []
            try:
                hist = json.loads(row[3])
            except Exception:
                hist = []

            new_status = "acknowledged" if old_status == "open" else old_status
            ts = now()
            notes.append({
                "id": str(uuid4()),
                "author": actor,
                "text": f"Assigned to {owner}. Target remediation date: {due_date or 'unspecified'}.",
                "created_at": ts
            })
            hist.append({
                "from": old_status,
                "to": new_status,
                "actor": actor,
                "timestamp": ts,
                "reason": f"Assigned owner {owner}"
            })

            db.execute(
                """UPDATE exceptions
                   SET owner = ?, due_date = ?, status = ?, notes = ?, history = ?, updated_at = ?
                   WHERE id = ?""",
                (owner, due_date, new_status, json.dumps(notes), json.dumps(hist), ts, exc_id)
            )

            append_audit_log(
                db,
                actor=actor,
                action="assign_exception",
                resource="exceptions",
                record_id=exc_id,
                title=f"Assigned: {row[4]}",
                before={"owner": "", "status": old_status},
                after={"owner": owner, "status": new_status, "due_date": due_date}
            )

            return {
                "id": exc_id,
                "owner": owner,
                "due_date": due_date,
                "status": new_status,
                "notes": notes,
                "history": hist,
                "updated_at": ts
            }

    @router.post('/api/exceptions/{exc_id}/note')
    def add_exception_note(exc_id: str, payload: dict):
        author = payload.get('author') or "Security Lead"
        text = payload.get('text', '').strip()
        if not text:
            raise HTTPException(422, "Note text cannot be empty.")

        with store.transaction() as db:
            row = db.execute("SELECT id, notes, title FROM exceptions WHERE id = ?", (exc_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Exception {exc_id} not found.")

            try:
                notes = json.loads(row[1])
            except Exception:
                notes = []

            ts = now()
            notes.append({
                "id": str(uuid4()),
                "author": author,
                "text": text,
                "created_at": ts
            })

            db.execute("UPDATE exceptions SET notes = ?, updated_at = ? WHERE id = ?", (json.dumps(notes), ts, exc_id))

            append_audit_log(
                db,
                actor=author,
                action="note_exception",
                resource="exceptions",
                record_id=exc_id,
                title=f"Note on: {row[2]}",
                after={"note_text": text}
            )

            return {"id": exc_id, "notes": notes, "updated_at": ts}

    @router.post('/api/exceptions/{exc_id}/remediate')
    def remediate_exception(exc_id: str, payload: dict):
        actor = payload.get('actor') or "Security Lead"
        note_text = payload.get('note', '').strip() or "Remediation submitted with evidence."
        evidence_ids = payload.get('evidence_ids', [])

        with store.transaction() as db:
            row = db.execute("SELECT id, status, notes, history, title FROM exceptions WHERE id = ?", (exc_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Exception {exc_id} not found.")

            old_status = row[1]
            try:
                notes = json.loads(row[2])
            except Exception:
                notes = []
            try:
                hist = json.loads(row[3])
            except Exception:
                hist = []

            ts = now()
            notes.append({
                "id": str(uuid4()),
                "author": actor,
                "text": f"Remediation: {note_text} (Evidence: {', '.join(evidence_ids) if evidence_ids else 'None'})",
                "created_at": ts
            })
            hist.append({
                "from": old_status,
                "to": "remediated",
                "actor": actor,
                "timestamp": ts,
                "reason": note_text,
                "evidence_ids": evidence_ids
            })

            db.execute(
                """UPDATE exceptions
                   SET status = 'remediated', notes = ?, history = ?, updated_at = ?
                   WHERE id = ?""",
                (json.dumps(notes), json.dumps(hist), ts, exc_id)
            )

            append_audit_log(
                db,
                actor=actor,
                action="remediate_exception",
                resource="exceptions",
                record_id=exc_id,
                title=f"Remediated: {row[4]}",
                before={"status": old_status},
                after={"status": "remediated", "evidence_ids": evidence_ids, "note": note_text}
            )

            return {
                "id": exc_id,
                "status": "remediated",
                "notes": notes,
                "history": hist,
                "updated_at": ts
            }

    @router.post('/api/exceptions/{exc_id}/close')
    def close_exception(exc_id: str, payload: dict | None = None):
        actor = (payload.get('actor') if payload else None) or "Security Lead"
        reason = (payload.get('reason') if payload else None) or "Exception verified resolved."

        with store.transaction() as db:
            row = db.execute("SELECT id, status, notes, history, title FROM exceptions WHERE id = ?", (exc_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Exception {exc_id} not found.")

            old_status = row[1]
            try:
                notes = json.loads(row[2])
            except Exception:
                notes = []
            try:
                hist = json.loads(row[3])
            except Exception:
                hist = []

            ts = now()
            notes.append({
                "id": str(uuid4()),
                "author": actor,
                "text": f"Closed exception: {reason}",
                "created_at": ts
            })
            hist.append({
                "from": old_status,
                "to": "closed",
                "actor": actor,
                "timestamp": ts,
                "reason": reason
            })

            db.execute(
                """UPDATE exceptions
                   SET status = 'closed', notes = ?, history = ?, updated_at = ?
                   WHERE id = ?""",
                (json.dumps(notes), json.dumps(hist), ts, exc_id)
            )

            append_audit_log(
                db,
                actor=actor,
                action="close_exception",
                resource="exceptions",
                record_id=exc_id,
                title=f"Closed: {row[4]}",
                before={"status": old_status},
                after={"status": "closed", "reason": reason}
            )

            return {
                "id": exc_id,
                "status": "closed",
                "notes": notes,
                "history": hist,
                "updated_at": ts
            }

    return router
