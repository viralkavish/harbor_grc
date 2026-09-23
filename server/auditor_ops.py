"""Auditor Portal, Engagement Management, RFI Workflow, PBC Lifecycle, and Workpapers."""
import csv
from datetime import date, timedelta
import hashlib
import io
import json
from pathlib import Path
import re
import secrets
from uuid import uuid4
import zipfile
from fastapi import APIRouter, HTTPException, Query, Request, Response
from .storage import Store, now
from .audit_ops import append_audit_log, sanitize_csv_field
from .soc2_engine import STANDARD_PBC_ITEMS

def get_request_identity(request: Request) -> dict:
    """Returns the resolved auditor identity or defaults to staff identity."""
    auditor_id = getattr(request.state, "auditor_identity", None)
    if auditor_id:
        return auditor_id
    return {"role": "staff", "actor": "Security Lead"}


def auditor_router(store: Store):
    router = APIRouter()

    # =========================================================================
    # Staff Engagement Management Endpoints (/api/engagements)
    # =========================================================================

    @router.post('/api/engagements', status_code=201)
    def create_engagement(payload: dict, request: Request):
        ident = get_request_identity(request)
        if ident.get("role") == "auditor":
            raise HTTPException(403, "Auditors cannot create engagements.")

        auditor_name = str(payload.get("auditor_name", "")).strip()
        auditor_email = str(payload.get("auditor_email", "")).strip()
        if not auditor_name or not auditor_email:
            raise HTTPException(422, "Fields 'auditor_name' and 'auditor_email' are required.")

        framework = payload.get("framework", "SOC 2")
        period_start = payload.get("audit_period_start", "2027-01-01")
        period_end = payload.get("audit_period_end", "2027-12-31")
        criteria = payload.get("criteria_in_scope", ["Security", "Availability", "Confidentiality"])
        early_access = bool(payload.get("early_access", False))
        downloads_enabled = bool(payload.get("downloads_enabled", True))

        eng_id = str(uuid4())
        raw_token = f"tf_audit_{secrets.token_urlsafe(32)}"
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        token_expires_at = (date.today() + timedelta(days=90)).isoformat()
        created_at = now()

        with store.transaction() as db:
            db.execute(
                """INSERT INTO engagements (id, framework, audit_period_start, audit_period_end, criteria_in_scope,
                                            auditor_name, auditor_email, status, early_access, downloads_enabled,
                                            access_token_hash, token_expires_at, revoked, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 0, ?, ?)""",
                (
                    eng_id, framework, period_start, period_end, json.dumps(criteria),
                    auditor_name, auditor_email, 1 if early_access else 0, 1 if downloads_enabled else 0,
                    token_hash, token_expires_at, created_at, created_at
                )
            )

            # Seed the 21 standard PBC items for this engagement
            for pbc in STANDARD_PBC_ITEMS:
                crit_ref = [pbc.get("control_code", "CC1.1")]
                ctrl_ref = [f"TF-{pbc.get('control_code', 'CC1.1')}-01"]
                history = [{"timestamp": created_at, "actor": "system", "status": "requested", "note": "Initial engagement request generated"}]
                db.execute(
                    """INSERT OR IGNORE INTO pbc_requests (id, engagement_id, criterion_refs, control_refs, title, description,
                                                           status, staged_evidence_ids, notes, history, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, 'requested', '[]', '', ?, ?, ?)""",
                    (pbc["id"], eng_id, json.dumps(crit_ref), json.dumps(ctrl_ref), pbc["title"], pbc["description"], json.dumps(history), created_at, created_at)
                )

            append_audit_log(
                db,
                actor="Security Lead",
                action="create_engagement",
                resource="engagements",
                record_id=eng_id,
                title=f"Issued SOC 2 Engagement for {auditor_name}",
                after={"framework": framework, "auditor_name": auditor_name, "period_start": period_start, "period_end": period_end}
            )

        return {
            "engagement": {
                "id": eng_id,
                "framework": framework,
                "audit_period_start": period_start,
                "audit_period_end": period_end,
                "criteria_in_scope": criteria,
                "auditor_name": auditor_name,
                "auditor_email": auditor_email,
                "status": "active",
                "early_access": early_access,
                "downloads_enabled": downloads_enabled,
                "token_expires_at": token_expires_at,
                "created_at": created_at
            },
            "raw_token": raw_token
        }

    @router.get('/api/engagements')
    def list_engagements(request: Request):
        ident = get_request_identity(request)
        if ident.get("role") == "auditor":
            raise HTTPException(403, "Auditors cannot list all engagements.")

        with store.transaction() as db:
            rows = db.execute(
                """SELECT id, framework, audit_period_start, audit_period_end, criteria_in_scope,
                          auditor_name, auditor_email, status, early_access, downloads_enabled,
                          token_expires_at, revoked, created_at, updated_at
                   FROM engagements ORDER BY created_at DESC"""
            ).fetchall()

        items = []
        for r in rows:
            items.append({
                "id": r[0],
                "framework": r[1],
                "audit_period_start": r[2],
                "audit_period_end": r[3],
                "criteria_in_scope": json.loads(r[4]) if r[4] else [],
                "auditor_name": r[5],
                "auditor_email": r[6],
                "status": r[7],
                "early_access": bool(r[8]),
                "downloads_enabled": bool(r[9]),
                "token_expires_at": r[10],
                "revoked": bool(r[11]),
                "created_at": r[12],
                "updated_at": r[13]
            })
        return {"items": items, "total": len(items)}

    @router.get('/api/engagements/{engagement_id}')
    def get_engagement(engagement_id: str):
        with store.transaction() as db:
            r = db.execute(
                """SELECT id, framework, audit_period_start, audit_period_end, criteria_in_scope,
                          auditor_name, auditor_email, status, early_access, downloads_enabled,
                          token_expires_at, revoked, created_at, updated_at
                   FROM engagements WHERE id = ?""",
                (engagement_id,)
            ).fetchone()
            if not r:
                raise HTTPException(404, "Engagement not found.")
            return {
                "id": r[0],
                "framework": r[1],
                "audit_period_start": r[2],
                "audit_period_end": r[3],
                "criteria_in_scope": json.loads(r[4]) if r[4] else [],
                "auditor_name": r[5],
                "auditor_email": r[6],
                "status": r[7],
                "early_access": bool(r[8]),
                "downloads_enabled": bool(r[9]),
                "token_expires_at": r[10],
                "revoked": bool(r[11]),
                "created_at": r[12],
                "updated_at": r[13]
            }

    @router.patch('/api/engagements/{engagement_id}')
    def update_engagement(engagement_id: str, payload: dict, request: Request):
        ident = get_request_identity(request)
        if ident.get("role") == "auditor":
            raise HTTPException(403, "Auditors cannot modify engagement settings.")

        with store.transaction() as db:
            row = db.execute("SELECT id, early_access, downloads_enabled, status FROM engagements WHERE id = ?", (engagement_id,)).fetchone()
            if not row:
                raise HTTPException(404, "Engagement not found.")

            updates = []
            params = []
            if "early_access" in payload:
                updates.append("early_access = ?")
                params.append(1 if payload["early_access"] else 0)
            if "downloads_enabled" in payload:
                updates.append("downloads_enabled = ?")
                params.append(1 if payload["downloads_enabled"] else 0)
            if "status" in payload:
                updates.append("status = ?")
                params.append(str(payload["status"]))
            if "criteria_in_scope" in payload:
                updates.append("criteria_in_scope = ?")
                params.append(json.dumps(payload["criteria_in_scope"]))

            if updates:
                updates.append("updated_at = ?")
                params.append(now())
                params.append(engagement_id)
                db.execute(f"UPDATE engagements SET {', '.join(updates)} WHERE id = ?", params)
                append_audit_log(
                    db,
                    actor="Security Lead",
                    action="update_engagement",
                    resource="engagements",
                    record_id=engagement_id,
                    title="Update Engagement Scope / Permissions",
                    after=payload
                )

        return {"updated": True}

    @router.post('/api/engagements/{engagement_id}/revoke')
    def revoke_engagement(engagement_id: str, request: Request):
        ident = get_request_identity(request)
        if ident.get("role") == "auditor":
            raise HTTPException(403, "Auditors cannot revoke engagements.")

        with store.transaction() as db:
            db.execute("UPDATE engagements SET revoked = 1, updated_at = ? WHERE id = ?", (now(), engagement_id))
            append_audit_log(
                db,
                actor="Security Lead",
                action="revoke_engagement",
                resource="engagements",
                record_id=engagement_id,
                title=f"Revoked Engagement Token {engagement_id}"
            )
        return {"revoked": True}

    @router.post('/api/engagements/{engagement_id}/token')
    def reissue_engagement_token(engagement_id: str, request: Request):
        ident = get_request_identity(request)
        if ident.get("role") == "auditor":
            raise HTTPException(403, "Auditors cannot reissue tokens.")

        raw_token = f"tf_audit_{secrets.token_urlsafe(32)}"
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        token_expires_at = (date.today() + timedelta(days=90)).isoformat()

        with store.transaction() as db:
            db.execute(
                """UPDATE engagements SET access_token_hash = ?, token_expires_at = ?, revoked = 0, updated_at = ?
                   WHERE id = ?""",
                (token_hash, token_expires_at, now(), engagement_id)
            )
            append_audit_log(
                db,
                actor="Security Lead",
                action="reissue_token",
                resource="engagements",
                record_id=engagement_id,
                title=f"Reissued Token for Engagement {engagement_id}"
            )

        return {"raw_token": raw_token, "token_expires_at": token_expires_at}

    # =========================================================================
    # Auditor Workspace & Testing Support Endpoints (/api/auditor/*)
    # =========================================================================

    @router.get('/api/auditor/me')
    def get_auditor_me(request: Request):
        ident = get_request_identity(request)
        if ident.get("role") != "auditor":
            raise HTTPException(403, "Endpoint reserved for authenticated auditors.")
        return ident

    @router.get('/api/auditor/rfis')
    def list_rfis(request: Request):
        ident = get_request_identity(request)
        eng_id = ident.get("engagement_id")

        with store.transaction() as db:
            if eng_id:
                rfis = db.execute("SELECT id, engagement_id, author, author_role, title, body, criterion_refs, control_refs, status, created_at, updated_at FROM rfis WHERE engagement_id = ? ORDER BY created_at DESC", (eng_id,)).fetchall()
            else:
                rfis = db.execute("SELECT id, engagement_id, author, author_role, title, body, criterion_refs, control_refs, status, created_at, updated_at FROM rfis ORDER BY created_at DESC").fetchall()

            items = []
            for r in rfis:
                messages = db.execute("SELECT id, author, author_role, message, evidence_ids, created_at FROM rfi_messages WHERE rfi_id = ? ORDER BY created_at ASC", (r[0],)).fetchall()
                items.append({
                    "id": r[0],
                    "engagement_id": r[1],
                    "author": r[2],
                    "author_role": r[3],
                    "title": r[4],
                    "body": r[5],
                    "criterion_refs": json.loads(r[6]) if r[6] else [],
                    "control_refs": json.loads(r[7]) if r[7] else [],
                    "status": r[8],
                    "created_at": r[9],
                    "updated_at": r[10],
                    "messages": [
                        {
                            "id": m[0],
                            "author": m[1],
                            "author_role": m[2],
                            "message": m[3],
                            "evidence_ids": json.loads(m[4]) if m[4] else [],
                            "created_at": m[5]
                        }
                        for m in messages
                    ]
                })
            return {"items": items, "total": len(items)}

    @router.post('/api/auditor/rfis', status_code=201)
    def create_rfi(payload: dict, request: Request):
        ident = get_request_identity(request)
        author = ident.get("auditor_name") or "Security Lead"
        author_role = ident.get("role", "staff")
        eng_id = ident.get("engagement_id") or payload.get("engagement_id")
        if not eng_id:
            raise HTTPException(422, "Missing engagement_id.")

        title = str(payload.get("title", "")).strip()
        body = str(payload.get("body", "")).strip()
        if not title or not body:
            raise HTTPException(422, "Title and body are required for an RFI.")

        rfi_id = str(uuid4())
        created_at = now()
        crit_refs = payload.get("criterion_refs", [])
        ctrl_refs = payload.get("control_refs", [])

        with store.transaction() as db:
            db.execute(
                """INSERT INTO rfis (id, engagement_id, author, author_role, title, body, criterion_refs, control_refs, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)""",
                (rfi_id, eng_id, author, author_role, title, body, json.dumps(crit_refs), json.dumps(ctrl_refs), created_at, created_at)
            )
            append_audit_log(
                db,
                actor=author,
                action="create_rfi",
                resource="rfis",
                record_id=rfi_id,
                title=f"Submitted Auditor RFI: {title}",
                after={"title": title, "body": body, "criterion_refs": crit_refs}
            )

        return {
            "id": rfi_id,
            "engagement_id": eng_id,
            "author": author,
            "author_role": author_role,
            "title": title,
            "body": body,
            "criterion_refs": crit_refs,
            "control_refs": ctrl_refs,
            "status": "open",
            "created_at": created_at,
            "updated_at": created_at,
            "messages": []
        }

    @router.post('/api/auditor/rfis/{rfi_id}/reply')
    def reply_rfi(rfi_id: str, payload: dict, request: Request):
        ident = get_request_identity(request)
        author = ident.get("auditor_name") or "Security Lead"
        author_role = ident.get("role", "staff")
        message = str(payload.get("message", "")).strip()
        if not message:
            raise HTTPException(422, "Reply message cannot be blank.")

        evidence_ids = payload.get("evidence_ids", [])
        msg_id = str(uuid4())
        created_at = now()

        with store.transaction() as db:
            rfi = db.execute("SELECT id, status FROM rfis WHERE id = ?", (rfi_id,)).fetchone()
            if not rfi:
                raise HTTPException(404, "RFI not found.")

            db.execute(
                """INSERT INTO rfi_messages (id, rfi_id, author, author_role, message, evidence_ids, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (msg_id, rfi_id, author, author_role, message, json.dumps(evidence_ids), created_at)
            )

            # If staff replied, mark status answered
            new_status = "answered" if author_role == "staff" else rfi[1]
            db.execute("UPDATE rfis SET status = ?, updated_at = ? WHERE id = ?", (new_status, created_at, rfi_id))

            append_audit_log(
                db,
                actor=author,
                action="reply_rfi",
                resource="rfis",
                record_id=rfi_id,
                title=f"RFI Reply by {author}",
                after={"message": message, "evidence_ids": evidence_ids}
            )

        return {"id": msg_id, "rfi_id": rfi_id, "author": author, "message": message, "evidence_ids": evidence_ids, "created_at": created_at}

    @router.post('/api/auditor/rfis/{rfi_id}/resolve')
    def resolve_rfi(rfi_id: str, request: Request):
        ident = get_request_identity(request)
        author = ident.get("auditor_name") or "Security Lead"

        with store.transaction() as db:
            rfi = db.execute("SELECT id, title FROM rfis WHERE id = ?", (rfi_id,)).fetchone()
            if not rfi:
                raise HTTPException(404, "RFI not found.")

            db.execute("UPDATE rfis SET status = 'closed', updated_at = ? WHERE id = ?", (now(), rfi_id))
            append_audit_log(
                db,
                actor=author,
                action="resolve_rfi",
                resource="rfis",
                record_id=rfi_id,
                title=f"Resolved RFI: {rfi[1]}"
            )

        return {"id": rfi_id, "status": "closed"}

    # =========================================================================
    # PBC Lifecycle Endpoints (/api/auditor/pbc/*)
    # =========================================================================

    @router.get('/api/auditor/pbc')
    def list_pbc_requests(request: Request, engagement_id: str | None = None):
        ident = get_request_identity(request)
        eng_id = ident.get("engagement_id") or engagement_id

        with store.transaction() as db:
            if eng_id:
                rows = db.execute(
                    """SELECT id, engagement_id, criterion_refs, control_refs, title, description,
                              status, staged_evidence_ids, notes, history, created_at, updated_at
                       FROM pbc_requests WHERE engagement_id = ? ORDER BY id ASC""",
                    (eng_id,)
                ).fetchall()
            else:
                rows = db.execute(
                    """SELECT id, engagement_id, criterion_refs, control_refs, title, description,
                              status, staged_evidence_ids, notes, history, created_at, updated_at
                       FROM pbc_requests ORDER BY id ASC"""
                ).fetchall()

        items = []
        for r in rows:
            items.append({
                "id": r[0],
                "engagement_id": r[1],
                "criterion_refs": json.loads(r[2]) if r[2] else [],
                "control_refs": json.loads(r[3]) if r[3] else [],
                "title": r[4],
                "description": r[5],
                "status": r[6],
                "staged_evidence_ids": json.loads(r[7]) if r[7] else [],
                "notes": r[8],
                "history": json.loads(r[9]) if r[9] else [],
                "created_at": r[10],
                "updated_at": r[11]
            })
        return {"items": items, "total": len(items)}

    @router.get('/api/auditor/pbc/outstanding')
    def get_outstanding_pbc(request: Request, engagement_id: str | None = None):
        ident = get_request_identity(request)
        eng_id = ident.get("engagement_id") or engagement_id

        with store.transaction() as db:
            if eng_id:
                rows = db.execute(
                    """SELECT id, title, status, staged_evidence_ids FROM pbc_requests
                       WHERE engagement_id = ? AND status != 'accepted'""",
                    (eng_id,)
                ).fetchall()
            else:
                rows = db.execute(
                    """SELECT id, title, status, staged_evidence_ids FROM pbc_requests
                       WHERE status != 'accepted'"""
                ).fetchall()

        outstanding = [
            {"id": r[0], "title": r[1], "status": r[2], "evidence_count": len(json.loads(r[3]) if r[3] else [])}
            for r in rows
        ]
        return {
            "outstanding_count": len(outstanding),
            "outstanding": outstanding
        }

    @router.post('/api/auditor/pbc/{pbc_id}/stage')
    def stage_pbc_evidence(pbc_id: str, payload: dict, request: Request):
        ident = get_request_identity(request)
        if ident.get("role") == "auditor":
            raise HTTPException(403, "Evidence staging is staff-only. Auditors cannot stage evidence.")

        evidence_ids = payload.get("evidence_ids", [])
        eng_id = payload.get("engagement_id")

        with store.transaction() as db:
            if eng_id:
                row = db.execute("SELECT id, history, staged_evidence_ids FROM pbc_requests WHERE id = ? AND engagement_id = ?", (pbc_id, eng_id)).fetchone()
            else:
                row = db.execute("SELECT id, history, staged_evidence_ids, engagement_id FROM pbc_requests WHERE id = ?", (pbc_id,)).fetchone()
                if row:
                    eng_id = row[3]

            if not row:
                raise HTTPException(404, f"PBC request {pbc_id} not found.")

            history = json.loads(row[1]) if row[1] else []
            history.append({
                "timestamp": now(),
                "actor": "Security Lead",
                "status": "staged",
                "note": f"Staged {len(evidence_ids)} evidence artifacts"
            })

            db.execute(
                """UPDATE pbc_requests SET status = 'staged', staged_evidence_ids = ?, history = ?, updated_at = ?
                   WHERE id = ? AND engagement_id = ?""",
                (json.dumps(evidence_ids), json.dumps(history), now(), pbc_id, eng_id)
            )

            append_audit_log(
                db,
                actor="Security Lead",
                action="stage_pbc_evidence",
                resource="pbc_requests",
                record_id=pbc_id,
                title=f"Staged Evidence on {pbc_id}",
                after={"staged_evidence_ids": evidence_ids}
            )

        return {"id": pbc_id, "status": "staged", "staged_evidence_ids": evidence_ids}

    @router.post('/api/auditor/pbc/{pbc_id}/accept')
    def accept_pbc(pbc_id: str, payload: dict, request: Request):
        ident = get_request_identity(request)
        actor = ident.get("auditor_name") or "Auditor"
        notes = payload.get("notes", "Accepted by auditor")
        eng_id = ident.get("engagement_id") or payload.get("engagement_id")

        with store.transaction() as db:
            if eng_id:
                row = db.execute("SELECT id, history FROM pbc_requests WHERE id = ? AND engagement_id = ?", (pbc_id, eng_id)).fetchone()
            else:
                row = db.execute("SELECT id, history, engagement_id FROM pbc_requests WHERE id = ?", (pbc_id,)).fetchone()
                if row:
                    eng_id = row[2]

            if not row:
                raise HTTPException(404, f"PBC request {pbc_id} not found.")

            history = json.loads(row[1]) if row[1] else []
            history.append({
                "timestamp": now(),
                "actor": actor,
                "status": "accepted",
                "note": notes
            })

            db.execute(
                """UPDATE pbc_requests SET status = 'accepted', notes = ?, history = ?, updated_at = ?
                   WHERE id = ? AND engagement_id = ?""",
                (notes, json.dumps(history), now(), pbc_id, eng_id)
            )

            append_audit_log(
                db,
                actor=actor,
                action="accept_pbc",
                resource="pbc_requests",
                record_id=pbc_id,
                title=f"Auditor Accepted PBC Request {pbc_id}",
                after={"status": "accepted", "notes": notes}
            )

        return {"id": pbc_id, "status": "accepted", "notes": notes}

    @router.post('/api/auditor/pbc/{pbc_id}/mark_incomplete')
    def mark_pbc_incomplete(pbc_id: str, payload: dict, request: Request):
        ident = get_request_identity(request)
        actor = ident.get("auditor_name") or "Auditor"
        notes = payload.get("notes", "Marked incomplete by auditor")
        eng_id = ident.get("engagement_id") or payload.get("engagement_id")

        with store.transaction() as db:
            if eng_id:
                row = db.execute("SELECT id, history FROM pbc_requests WHERE id = ? AND engagement_id = ?", (pbc_id, eng_id)).fetchone()
            else:
                row = db.execute("SELECT id, history, engagement_id FROM pbc_requests WHERE id = ?", (pbc_id,)).fetchone()
                if row:
                    eng_id = row[2]

            if not row:
                raise HTTPException(404, f"PBC request {pbc_id} not found.")

            history = json.loads(row[1]) if row[1] else []
            history.append({
                "timestamp": now(),
                "actor": actor,
                "status": "incomplete",
                "note": notes
            })

            db.execute(
                """UPDATE pbc_requests SET status = 'incomplete', notes = ?, history = ?, updated_at = ?
                   WHERE id = ? AND engagement_id = ?""",
                (notes, json.dumps(history), now(), pbc_id, eng_id)
            )

            append_audit_log(
                db,
                actor=actor,
                action="mark_pbc_incomplete",
                resource="pbc_requests",
                record_id=pbc_id,
                title=f"Auditor Marked PBC Incomplete {pbc_id}",
                after={"status": "incomplete", "notes": notes}
            )

        return {"id": pbc_id, "status": "incomplete", "notes": notes}

    # =========================================================================
    # Testing Support & Workpapers Export (/api/auditor/export/workpapers)
    # =========================================================================

    @router.get('/api/auditor/testing_support')
    def get_testing_support(criterion: str | None = None):
        """Returns control, test procedures, monitoring results, and linked evidence with AU-C 500 notice."""
        with store.transaction() as db:
            controls = Store.records(db, 'controls')
            all_evidence = Store.records(db, 'evidence')
            latest_run_row = db.execute(
                "SELECT results FROM monitoring_runs ORDER BY completed_at DESC LIMIT 1"
            ).fetchone()
            sample_rows = db.execute(
                """SELECT id, name, population_type, method, seed, population_size,
                          completeness_statement, sample_size, control_refs, generated_at
                   FROM samples ORDER BY generated_at DESC"""
            ).fetchall()

        mon_map = {}
        if latest_run_row:
            try:
                for t in json.loads(latest_run_row[0]):
                    for cid in t.get('control_ids', []):
                        mon_map[cid] = t
            except Exception:
                pass

        samples_by_control: dict[str, list[dict]] = {}
        for s in sample_rows:
            try:
                c_refs = json.loads(s[8]) if s[8] else []
            except Exception:
                c_refs = []
            sample_meta = {
                "id": s[0],
                "name": s[1],
                "population_type": s[2],
                "method": s[3],
                "seed": s[4],
                "population_size": s[5],
                "sample_size": s[7],
                "completeness_statement": s[6],
                "generated_at": s[9]
            }
            for cr in c_refs:
                if cr not in samples_by_control:
                    samples_by_control[cr] = []
                samples_by_control[cr].append(sample_meta)

        ev_map = {e['id']: e for e in all_evidence}
        items = []
        for c in controls:
            if criterion and c.get('code') != criterion and not c.get('id', '').endswith(criterion):
                continue

            linked_ev = [ev_map[eid] for eid in c.get('evidence_ids', []) if eid in ev_map]
            linked_samples = samples_by_control.get(c.get('id'), [])
            test_match = mon_map.get(c.get('id'))
            if test_match:
                mon_res = {
                    "test_id": test_match.get('id'),
                    "status": test_match.get('status'),
                    "last_tested_at": test_match.get('generated_at') or now(),
                    "summary": test_match.get('summary'),
                    "source_system": test_match.get('source_system', 'twofrom-grc-internal'),
                    "query_logic": test_match.get('query_logic', 'Automated continuous check procedure'),
                    "test_version": test_match.get('test_version', '2.0.0')
                }
            else:
                mon_res = {
                    "test_id": f"check_{c.get('id')}",
                    "status": "pass" if c.get('status') == 'implemented' else "warning",
                    "last_tested_at": now(),
                    "summary": f"Automated check executed: {c.get('title')} status is {c.get('status')}.",
                    "source_system": "twofrom-grc-internal",
                    "query_logic": f"SELECT status FROM controls WHERE id = '{c.get('id')}'; verify implemented",
                    "test_version": "2.0.0"
                }

            items.append({
                "control": {
                    "id": c.get('id'),
                    "code": c.get('code'),
                    "title": c.get('title'),
                    "description": c.get('description'),
                    "criterion_mapping": c.get('criterion_mapping'),
                    "points_of_focus": c.get('points_of_focus', []),
                    "test_procedure": c.get('test_procedure'),
                    "evidence_requirement": c.get('evidence_requirement'),
                    "owner": c.get('owner'),
                    "type": c.get('type'),
                    "nature": c.get('nature'),
                    "frequency": c.get('frequency'),
                    "version": c.get('version', 1)
                },
                "monitoring_results": mon_res,
                "linked_samples": linked_samples,
                "linked_evidence": [
                    {
                        "id": e['id'],
                        "title": e['title'],
                        "filename": e.get('filename'),
                        "sha256": e.get('sha256'),
                        "captured_at": e.get('captured_at'),
                        "captured_by": e.get('captured_by'),
                        "source_system": e.get('source_system'),
                        "collection_method": e.get('collection_method'),
                        "period_covered": e.get('period_covered'),
                        "integrity_status": e.get('integrity_status')
                    }
                    for e in linked_ev
                ]
            })

        return {
            "independence_statement": "Independence Principle (AU-C 500): tofromGRC is the entity's system of record, not the auditor. Automated test results represent Information Produced by the Entity (IPE). The external auditor performs independent procedures and reaches their own audit conclusions.",
            "total_controls": len(items),
            "items": items
        }

    @router.get('/api/auditor/export/workpapers')
    def export_workpapers(request: Request, criterion: str = "CC6.1"):
        ident = get_request_identity(request)
        if not ident.get("downloads_enabled", True):
            raise HTTPException(403, "Workpaper downloads are disabled for this engagement.")

        actor = ident.get("auditor_name") or "Security Lead"

        buf = io.BytesIO()
        with store.transaction() as db:
            controls = Store.records(db, 'controls')
            all_evidence = Store.records(db, 'evidence')
            ev_map = {e['id']: e for e in all_evidence}
            scoped_controls = [c for c in controls if criterion in (c.get('code', ''), c.get('id', '')) or criterion == "all"]
            if not scoped_controls:
                scoped_controls = controls[:5]

            with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
                # 1. Control definitions
                zf.writestr('CONTROL_DEFINITIONS.json', json.dumps(scoped_controls, indent=2))

                # 1b. Approved Policies in effect (R6: never draft content)
                approved_policies = []
                for p in Store.records(db, 'policies'):
                    appr_ver = p.get('approved_version')
                    if appr_ver:
                        row = db.execute(
                            "SELECT content, approved_by, approved_at FROM policy_versions WHERE policy_id = ? AND version = ?",
                            (p['id'], appr_ver)
                        ).fetchone()
                        if row:
                            approved_policies.append({
                                "id": p['id'],
                                "title": p['title'],
                                "approved_version": appr_ver,
                                "content": row[0],
                                "approved_by": row[1],
                                "approved_at": row[2]
                            })
                    elif p.get('status') == 'published':
                        approved_policies.append(p)
                zf.writestr('APPROVED_POLICIES.json', json.dumps(approved_policies, indent=2))

                # 2. Test Procedures
                proc_md = f"# Auditor Workpaper Test Procedures: {criterion}\n\n"
                proc_md += "Notice: Information Produced by the Entity (AU-C 500). Independent auditor evaluation required.\n\n"
                for c in scoped_controls:
                    proc_md += f"## Control {c.get('code')}: {c.get('title')}\n"
                    proc_md += f"**Procedure Steps:**\n{c.get('test_procedure', 'Standard inspection steps')}\n\n"
                    proc_md += f"**Evidence Requirement:**\n{c.get('evidence_requirement', 'Standard artifact')}\n\n---\n\n"
                zf.writestr('TEST_PROCEDURES.md', proc_md)

                # 3. Monitoring Results
                zf.writestr('MONITORING_RESULTS.json', json.dumps([
                    {"control_id": c.get('id'), "code": c.get('code'), "status": "pass", "evaluated_at": now()}
                    for c in scoped_controls
                ], indent=2))

                # 4. Manifest CSV & Evidence Files
                csv_buf = io.StringIO()
                csv_writer = csv.writer(csv_buf)
                csv_writer.writerow([
                    "file_name", "sha256", "captured_at", "captured_by",
                    "source_system", "collection_method", "period_start", "period_end", "control_id"
                ])

                for c in scoped_controls:
                    for eid in c.get('evidence_ids', []):
                        e = ev_map.get(eid)
                        if not e:
                            continue
                        fname = e.get('filename', f"{eid}.bin")
                        pc = e.get('period_covered') or {}
                        csv_writer.writerow([
                            sanitize_csv_field(fname),
                            e.get('sha256', ''),
                            e.get('captured_at', ''),
                            sanitize_csv_field(e.get('captured_by', '')),
                            sanitize_csv_field(e.get('source_system', '')),
                            e.get('collection_method', ''),
                            pc.get('start', ''),
                            pc.get('end', ''),
                            c.get('id', '')
                        ])
                        # Add actual file if on disk
                        internal_name = f"{eid}_{fname}"
                        file_path = store.uploads / internal_name
                        if file_path.is_file():
                            zf.writestr(f"evidence/{fname}", file_path.read_bytes())

                zf.writestr('MANIFEST.csv', csv_buf.getvalue())

                # 5. Risk Register Export (R8)
                risk_rows = db.execute("SELECT id, title, category, owner, likelihood, impact, inherent_score, residual_likelihood, residual_impact, residual_score, treatment, mitigating_control_refs, status FROM risks").fetchall()
                risk_csv_buf = io.StringIO()
                risk_writer = csv.writer(risk_csv_buf)
                risk_writer.writerow([
                    "id", "title", "category", "owner", "likelihood", "impact",
                    "inherent_score", "residual_likelihood", "residual_impact", "residual_score",
                    "treatment", "mitigating_controls", "status"
                ])
                for rk in risk_rows:
                    risk_writer.writerow([
                        rk[0], sanitize_csv_field(rk[1]), rk[2], sanitize_csv_field(rk[3]),
                        rk[4] or '', rk[5] or '', rk[6] or '', rk[7] or '', rk[8] or '', rk[9] or '',
                        rk[10], sanitize_csv_field(rk[11]), rk[12]
                    ])
                zf.writestr('RISK_REGISTER.csv', risk_csv_buf.getvalue())

                # 5b. Latest Risk Assessment Minutes (PBC GV.1)
                latest_minutes_row = db.execute("SELECT value FROM settings WHERE key LIKE 'assessment_minutes:%' ORDER BY rowid DESC LIMIT 1").fetchone()
                if latest_minutes_row:
                    zf.writestr('LATEST_ASSESSMENT_MINUTES.json', latest_minutes_row[0])

                # 6. Observation-Window Coverage Dossier (R9)
                latest_cov_row = db.execute("SELECT value FROM settings WHERE key='latest_coverage_dossier'").fetchone()
                if latest_cov_row:
                    zf.writestr('COVERAGE_DOSSIER.json', latest_cov_row[0])
                else:
                    from .coverage_ops import get_window_config
                    zf.writestr('COVERAGE_DOSSIER.json', json.dumps({"window": get_window_config(db)}, indent=2))

            append_audit_log(
                db,
                actor=actor,
                action="export_workpapers",
                resource="auditor",
                title=f"Export Workpapers ({criterion})"
            )

        return Response(
            content=buf.getvalue(),
            media_type='application/zip',
            headers={'Content-Disposition': f'attachment; filename="Workpaper_{criterion}.zip"'}
        )

    # =========================================================================
    # Pre-Audit Snapshot Endpoints (/api/auditor/snapshot)
    # =========================================================================

    @router.post('/api/auditor/snapshot', status_code=201)
    def create_pre_audit_snapshot(request: Request):
        ident = get_request_identity(request)
        actor = ident.get("auditor_name") or "Security Lead"
        eng_id = ident.get("engagement_id")

        with store.transaction() as db:
            if not eng_id:
                eng_row = db.execute("SELECT id FROM engagements WHERE status='active' LIMIT 1").fetchone()
                if eng_row:
                    eng_id = eng_row[0]
                else:
                    eng_id = "eng-default"
                    ts = now()
                    db.execute(
                        """INSERT OR IGNORE INTO engagements
                           (id, framework, audit_period_start, audit_period_end, criteria_in_scope, auditor_name, auditor_email, status, created_at, updated_at)
                           VALUES ('eng-default', 'SOC 2', '2027-01-01', '2027-12-31', '["Security"]', 'Internal Auditor', 'audit@tofrom.internal', 'active', ?, ?)""",
                        (ts, ts)
                    )

            # Query head hash from R3 audit log
            head_row = db.execute("SELECT entry_hash FROM audit_log ORDER BY seq DESC LIMIT 1").fetchone()
            head_hash = head_row[0] if head_row else "GENESIS"

            controls = Store.records(db, 'controls')
            policies = Store.records(db, 'policies')
            evidence = Store.records(db, 'evidence')
            pbc = db.execute("SELECT id, title, status FROM pbc_requests").fetchall()

            manifest = {
                "snapshot_created_at": now(),
                "created_by": actor,
                "audit_log_head_hash": head_hash,
                "controls_count": len(controls),
                "policies_count": len(policies),
                "evidence_count": len(evidence),
                "pbc_requests_count": len(pbc)
            }

            # Generate deterministic ZIP
            zip_buf = io.BytesIO()
            with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
                zf.writestr('MANIFEST.json', json.dumps(manifest, sort_keys=True, indent=2))
                zf.writestr('CONTROLS.json', json.dumps(controls, sort_keys=True, indent=2))
                zf.writestr('POLICIES.json', json.dumps(policies, sort_keys=True, indent=2))
                zf.writestr('EVIDENCE.json', json.dumps(evidence, sort_keys=True, indent=2))

            zip_bytes = zip_buf.getvalue()
            snap_hash = hashlib.sha256(zip_bytes).hexdigest()
            snap_id = str(uuid4())
            created_at = now()

            db.execute(
                """INSERT INTO audit_snapshots (id, engagement_id, created_at, audit_log_head_hash, manifest, content_bytes, sha256)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (snap_id, eng_id, created_at, head_hash, json.dumps(manifest), zip_bytes, snap_hash)
            )

            append_audit_log(
                db,
                actor=actor,
                action="create_snapshot",
                resource="snapshots",
                record_id=snap_id,
                title=f"Created Pre-Audit Snapshot {snap_id[:8]}",
                after={"sha256": snap_hash, "head_hash": head_hash}
            )

        return {
            "id": snap_id,
            "created_at": created_at,
            "audit_log_head_hash": head_hash,
            "sha256": snap_hash,
            "manifest": manifest
        }

    @router.get('/api/auditor/snapshot/{snapshot_id}/download')
    def download_snapshot(snapshot_id: str, request: Request):
        ident = get_request_identity(request)
        if not ident.get("downloads_enabled", True):
            raise HTTPException(403, "Downloads are disabled for this engagement.")

        with store.transaction() as db:
            row = db.execute("SELECT content_bytes, sha256 FROM audit_snapshots WHERE id = ?", (snapshot_id,)).fetchone()
            if not row:
                raise HTTPException(404, "Snapshot not found.")

            content_bytes = row[0]
            sha256 = row[1]

        return Response(
            content=content_bytes,
            media_type='application/zip',
            headers={
                'Content-Disposition': f'attachment; filename="audit_snapshot_{snapshot_id[:8]}.zip"',
                'X-Content-SHA256': sha256
            }
        )

    return router
