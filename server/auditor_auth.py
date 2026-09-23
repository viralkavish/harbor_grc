"""Auditor token resolution, session-scoped identity, and default-deny write protection."""
from datetime import date
import hashlib
import json
from fastapi import HTTPException, Request
from .storage import Store, now

AUDITOR_MUTATING_ALLOWLIST = {
    "/api/auditor/rfis",
    "/api/auditor/snapshot"
}


def resolve_auditor_identity(request: Request, store: Store) -> dict | None:
    """Resolves an engagement bearer token into a typed auditor identity, enforcing lifecycle constraints."""
    auth_header = request.headers.get("authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif request.headers.get("x-auditor-token"):
        token = request.headers.get("x-auditor-token", "").strip()
    elif "token" in request.query_params:
        token = request.query_params.get("token", "").strip()

    if not token or not token.startswith("tf_audit_"):
        return None

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    with store.transaction() as db:
        row = db.execute(
            """SELECT id, framework, audit_period_start, audit_period_end, criteria_in_scope,
                      auditor_name, auditor_email, status, early_access, downloads_enabled,
                      token_expires_at, revoked
               FROM engagements WHERE access_token_hash = ?""",
            (token_hash,)
        ).fetchone()

    if not row:
        raise HTTPException(403, "Invalid engagement bearer token.")

    eng_id = row[0]
    framework = row[1]
    period_start = row[2]
    period_end = row[3]
    criteria = json.loads(row[4]) if row[4] else []
    auditor_name = row[5]
    auditor_email = row[6]
    status = row[7]
    early_access = bool(row[8])
    downloads_enabled = bool(row[9])
    token_expires_at = row[10]
    revoked = bool(row[11])

    if revoked:
        raise HTTPException(403, "Engagement bearer token has been revoked.")

    if status == "closed":
        raise HTTPException(403, "Engagement is closed.")

    today_str = now()[:10]
    if token_expires_at and token_expires_at < today_str:
        raise HTTPException(403, "Engagement bearer token has expired.")

    if today_str < period_start and not early_access:
        raise HTTPException(
            403,
            f"Auditor access activates when the observation window opens (starts {period_start}). Early access has not been granted."
        )

    return {
        "role": "auditor",
        "engagement_id": eng_id,
        "framework": framework,
        "auditor_name": auditor_name,
        "auditor_email": auditor_email,
        "downloads_enabled": downloads_enabled,
        "criteria_in_scope": criteria,
        "audit_period_start": period_start,
        "audit_period_end": period_end
    }


def enforce_auditor_permissions(request: Request, identity: dict | None) -> None:
    """Enforces default-deny write policy on auditor identities outside the explicit allowlist."""
    if not identity or identity.get("role") != "auditor":
        return

    method = request.method.upper()
    if method in ("GET", "HEAD", "OPTIONS"):
        return

    path = request.url.path

    # Check exact match or sub-route allowlist
    if path in AUDITOR_MUTATING_ALLOWLIST:
        return

    # Check regex/pattern allowlist for RFIs and PBC acceptance
    if path.startswith("/api/auditor/rfis/") and (path.endswith("/reply") or path.endswith("/resolve")):
        return

    if path.startswith("/api/auditor/pbc/") and (path.endswith("/accept") or path.endswith("/mark_incomplete")):
        return

    # Auditor cannot stage evidence or mutate core resources
    raise HTTPException(
        403,
        "Auditor role has read-only access. Mutation operation is prohibited on this endpoint."
    )
