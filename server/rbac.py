"""Role-Based Access Control (RBAC) Permission Matrix & Enforcement Engine.

Roles:
- admin: complete administrative and system control (including user management & settings)
- compliance_manager: operational GRC execution (controls, policies, evidence, risks, monitoring, sampling)
- control_owner: scoped management of assigned controls & linked evidence, policy attestation
- viewer: read-only access across staff views
- auditor: parallel external engagement token (never staff role; separate trust plane)
"""
from functools import wraps
from fastapi import HTTPException, Request


ROLES = {"admin", "compliance_manager", "control_owner", "viewer"}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": {
        "*:*",  # Superuser wildcard
        "users:manage",
        "settings:write",
        "policies:write",
        "policies:approve",
        "policies:read",
        "controls:write",
        "controls:read",
        "evidence:write",
        "evidence:read",
        "risks:write",
        "risks:accept",
        "risks:read",
        "monitoring:write",
        "monitoring:read",
        "sampling:write",
        "sampling:read",
        "coverage:write",
        "coverage:read",
        "audit:read",
        "audits:write",
        "personnel:write",
        "personnel:read"
    },
    "compliance_manager": {
        "policies:write",
        "policies:approve",
        "policies:read",
        "controls:write",
        "controls:read",
        "evidence:write",
        "evidence:read",
        "risks:write",
        "risks:accept",
        "risks:read",
        "monitoring:write",
        "monitoring:read",
        "sampling:write",
        "sampling:read",
        "coverage:write",
        "coverage:read",
        "audit:read",
        "audits:write",
        "personnel:write",
        "personnel:read"
    },
    "control_owner": {
        "controls:read",
        "controls:write",  # Checked against assigned_control_ids
        "evidence:read",
        "evidence:write",  # Checked against assigned_control_ids
        "policies:read",
        "policies:attest",
        "risks:read",
        "monitoring:read",
        "sampling:read",
        "coverage:read",
        "personnel:read"
    },
    "viewer": {
        "policies:read",
        "controls:read",
        "evidence:read",
        "risks:read",
        "monitoring:read",
        "sampling:read",
        "coverage:read",
        "audit:read",
        "personnel:read"
    }
}


def role_has_permission(role: str, permission: str) -> bool:
    perms = ROLE_PERMISSIONS.get(role, set())
    if "*:*" in perms:
        return True
    if permission in perms:
        return True
    # Resource wildcard check (e.g. 'policies:*')
    res_part = permission.split(":")[0] + ":*"
    return res_part in perms


def check_user_permission(user: dict | None, permission: str, target_control_id: str | None = None) -> None:
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required. Please log in.")

    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="User account is deactivated. Contact an administrator.")

    role = user.get("role", "viewer")
    if not role_has_permission(role, permission):
        raise HTTPException(status_code=403, detail=f"Forbidden: role '{role}' lacks permission '{permission}'.")

    # Scoped control_owner validation
    if role == "control_owner" and target_control_id:
        assigned = user.get("assigned_control_ids", [])
        if target_control_id not in assigned:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: control_owner is not assigned to control '{target_control_id}'."
            )
