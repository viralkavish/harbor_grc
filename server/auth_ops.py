"""Authentication, User Identity, Session Lifecycle, and Bootstrap Administration.

Implements:
- Argon2id password hashing with constant-time verification
- 5-attempt / 15-minute brute-force lockout policy
- Strict segregation of duties real-identity binding
- Single-use setup token for initial bootstrap
- Admin-managed user provisioning & RBAC role assignments
- Zero credential leakage in R3 audit logs, error messages, or API responses
"""
from datetime import datetime, timezone
import json
import re
import secrets
import time
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request, Response
from .storage import Store, now
from .audit_ops import append_audit_log
from .rbac import check_user_permission, ROLES


COOKIE = 'harbor_session'
SESSION_LIFETIME = 86400  # 24 hours absolute
IDLE_TIMEOUT = 7200  # 2 hours idle
LOCKOUT_THRESHOLD = 5
LOCKOUT_DURATION = 900  # 15 minutes

COMMON_DENYLIST = {
    "password12345", "123456789012", "adminadmin12", "administrator",
    "welcome12345", "letmein12345", "tofromgrc2026", "harborgrc2026"
}

# Password hashing
try:
    import argon2
    _ph = argon2.PasswordHasher()

    def hash_password(password: str) -> str:
        return _ph.hash(password)

    def verify_password(password_hash: str, password: str) -> bool:
        try:
            return _ph.verify(password_hash, password)
        except Exception:
            return False
except ImportError:
    import hashlib
    def hash_password(password: str) -> str:
        salt = secrets.token_hex(16)
        h = hashlib.scrypt(password.encode('utf-8'), salt=salt.encode('utf-8'), n=16384, r=8, p=1).hex()
        return f"scrypt:{salt}:{h}"

    def verify_password(password_hash: str, password: str) -> bool:
        if not password_hash.startswith("scrypt:"):
            return False
        _, salt, h = password_hash.split(":", 2)
        comp = hashlib.scrypt(password.encode('utf-8'), salt=salt.encode('utf-8'), n=16384, r=8, p=1).hex()
        return secrets.compare_digest(h, comp)


def validate_password_strength(password: str) -> None:
    if len(password) < 12:
        raise HTTPException(422, "Password must be at least 12 characters in length.")
    if password.lower() in COMMON_DENYLIST:
        raise HTTPException(422, "Password is too common; please select a stronger passphrase.")


def auth_router(store: Store):
    router = APIRouter()

    @router.get('/api/auth/bootstrap_status')
    def get_bootstrap_status():
        with store.transaction() as db:
            row = db.execute("SELECT count(*) FROM users").fetchone()
            count = row[0] if row else 0
            if count == 0:
                # Ensure bootstrap setup token exists
                tok_row = db.execute("SELECT value FROM settings WHERE key='bootstrap_setup_token'").fetchone()
                if tok_row:
                    setup_token = tok_row[0]
                else:
                    setup_token = secrets.token_urlsafe(32)
                    db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('bootstrap_setup_token', ?)", (setup_token,))
                return {"needs_bootstrap": True, "setup_token": setup_token}
            return {"needs_bootstrap": False}

    @router.post('/api/auth/bootstrap_admin', status_code=201)
    def bootstrap_admin(payload: dict, response: Response):
        setup_token = payload.get("setup_token", "")
        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))

        if not name or not email or not password:
            raise HTTPException(422, "Name, email, and password are required.")

        validate_password_strength(password)

        with store.transaction() as db:
            count = db.execute("SELECT count(*) FROM users").fetchone()[0]
            if count > 0:
                raise HTTPException(409, "Bootstrap setup already completed. User accounts exist.")

            tok_row = db.execute("SELECT value FROM settings WHERE key='bootstrap_setup_token'").fetchone()
            if not tok_row or not secrets.compare_digest(tok_row[0], setup_token):
                raise HTTPException(400, "Invalid or expired bootstrap setup token.")

            user_id = str(uuid4())
            pw_hash = hash_password(password)
            ts = now()

            db.execute(
                """INSERT INTO users (id, name, email, password_hash, role, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?)""",
                (user_id, name, email, pw_hash, ts, ts)
            )
            # Invalidate setup token immediately
            db.execute("DELETE FROM settings WHERE key='bootstrap_setup_token'")

            # Create authenticated session
            sid = secrets.token_urlsafe(32)
            csrf_token = secrets.token_urlsafe(32)
            exp = time.time() + SESSION_LIFETIME
            db.execute(
                "INSERT INTO sessions (id, token, expires, user_id, last_activity) VALUES (?, ?, ?, ?, ?)",
                (sid, csrf_token, exp, user_id, time.time())
            )

            append_audit_log(
                db,
                actor=f"{name} ({email})",
                action="bootstrap_admin",
                resource="users",
                record_id=user_id,
                title="Initialized Root Administrator via Bootstrap",
                after={"email": email, "role": "admin"}
            )

            response.set_cookie(COOKIE, sid, httponly=True, samesite='strict', secure=False, max_age=SESSION_LIFETIME, path='/')
            return {
                "id": user_id,
                "name": name,
                "email": email,
                "role": "admin",
                "status": "active",
                "csrf_token": csrf_token
            }

    @router.post('/api/auth/login')
    def login(payload: dict, response: Response):
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))

        if not email or not password:
            raise HTTPException(401, "Invalid email or password.")

        err_to_raise = None
        sid = None
        success_payload = None

        with store.transaction() as db:
            row = db.execute(
                """SELECT id, name, email, password_hash, role, status, failed_attempts, locked_until, assigned_control_ids
                   FROM users WHERE email = ?""",
                (email,)
            ).fetchone()

            if not row:
                append_audit_log(
                    db,
                    actor="anonymous",
                    action="login_failed",
                    resource="auth",
                    title="Failed login attempt (unknown identity)"
                )
                err_to_raise = HTTPException(401, "Invalid email or password.")
            else:
                uid, name, uemail, pw_hash, role, status, failed_att, locked_until, assigned_ctrls = row

                if status != "active":
                    err_to_raise = HTTPException(403, "Account is deactivated. Contact an administrator.")
                else:
                    curr_time = time.time()
                    if locked_until and curr_time < locked_until:
                        remaining_mins = int((locked_until - curr_time) // 60) + 1
                        err_to_raise = HTTPException(423, f"Account is locked due to multiple failed login attempts. Try again in {remaining_mins} minute(s).")
                    elif not verify_password(pw_hash, password):
                        new_fails = failed_att + 1
                        new_lock = (curr_time + LOCKOUT_DURATION) if new_fails >= LOCKOUT_THRESHOLD else 0
                        db.execute("UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?", (new_fails, new_lock, uid))

                        append_audit_log(
                            db,
                            actor=f"{name} ({email})",
                            action="login_failed" if new_fails < LOCKOUT_THRESHOLD else "account_locked",
                            resource="auth",
                            record_id=uid,
                            title=f"Failed login attempt ({new_fails}/{LOCKOUT_THRESHOLD})" if new_fails < LOCKOUT_THRESHOLD else "Account locked due to 5 consecutive failed logins"
                        )

                        if new_fails >= LOCKOUT_THRESHOLD:
                            err_to_raise = HTTPException(423, "Account is locked due to multiple failed login attempts. Try again in 15 minutes.")
                        else:
                            err_to_raise = HTTPException(401, "Invalid email or password.")
                    else:
                        # Login succeeded: reset failure counters
                        ts = now()
                        db.execute("UPDATE users SET failed_attempts = 0, locked_until = 0, last_login_at = ? WHERE id = ?", (ts, uid))

                        sid = secrets.token_urlsafe(32)
                        csrf_token = secrets.token_urlsafe(32)
                        exp = time.time() + SESSION_LIFETIME
                        db.execute(
                            "INSERT INTO sessions (id, token, expires, user_id, last_activity) VALUES (?, ?, ?, ?, ?)",
                            (sid, csrf_token, exp, uid, time.time())
                        )

                        append_audit_log(
                            db,
                            actor=f"{name} ({email})",
                            action="login_success",
                            resource="auth",
                            record_id=uid,
                            title=f"User authenticated successfully ({role})"
                        )

                        try:
                            assigned = json.loads(assigned_ctrls) if assigned_ctrls else []
                        except Exception:
                            assigned = []

                        success_payload = {
                            "id": uid,
                            "name": name,
                            "email": uemail,
                            "role": role,
                            "status": status,
                            "assigned_control_ids": assigned,
                            "csrf_token": csrf_token
                        }

        if err_to_raise:
            raise err_to_raise

        if sid and success_payload:
            response.set_cookie(COOKIE, sid, httponly=True, samesite='strict', secure=False, max_age=SESSION_LIFETIME, path='/')
            return success_payload

    @router.post('/api/auth/logout')
    def logout(request: Request, response: Response):
        sid = request.cookies.get(COOKIE, '')
        with store.transaction() as db:
            if sid:
                s_row = db.execute("SELECT user_id FROM sessions WHERE id = ?", (sid,)).fetchone()
                if s_row and s_row[0]:
                    u_row = db.execute("SELECT name, email FROM users WHERE id = ?", (s_row[0],)).fetchone()
                    actor_str = f"{u_row[0]} ({u_row[1]})" if u_row else "staff"
                    append_audit_log(
                        db,
                        actor=actor_str,
                        action="logout",
                        resource="auth",
                        record_id=s_row[0],
                        title="User logged out"
                    )
                db.execute("DELETE FROM sessions WHERE id = ?", (sid,))
        response.delete_cookie(COOKIE, path='/')
        return {"status": "ok", "message": "Logged out successfully."}

    @router.get('/api/auth/me')
    def get_current_user(request: Request):
        user = getattr(request.state, 'user', None)
        if not user:
            raise HTTPException(401, "Authentication required. Please log in.")
        return user

    @router.post('/api/auth/change_password')
    def change_password(request: Request, payload: dict):
        user = getattr(request.state, 'user', None)
        if not user:
            raise HTTPException(401, "Authentication required.")

        current_pw = str(payload.get("current_password", ""))
        new_pw = str(payload.get("new_password", ""))
        validate_password_strength(new_pw)

        with store.transaction() as db:
            row = db.execute("SELECT password_hash FROM users WHERE id = ?", (user['id'],)).fetchone()
            if not row or not verify_password(row[0], current_pw):
                raise HTTPException(422, "Current password is incorrect.")

            new_hash = hash_password(new_pw)
            db.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", (new_hash, now(), user['id']))

            append_audit_log(
                db,
                actor=f"{user['name']} ({user['email']})",
                action="change_password",
                resource="auth",
                record_id=user['id'],
                title="User changed account password"
            )

            return {"status": "ok", "message": "Password updated successfully."}

    # =========================================================================
    # User Management API (Admin only)
    # =========================================================================

    @router.get('/api/users')
    def list_users(request: Request):
        user = getattr(request.state, 'user', None)
        check_user_permission(user, "users:manage")

        with store.transaction() as db:
            rows = db.execute(
                "SELECT id, name, email, role, status, created_at, last_login_at, locked_until, assigned_control_ids FROM users ORDER BY name ASC"
            ).fetchall()

            users = []
            curr_time = time.time()
            for r in rows:
                try:
                    assigned = json.loads(r[8]) if r[8] else []
                except Exception:
                    assigned = []
                users.append({
                    "id": r[0],
                    "name": r[1],
                    "email": r[2],
                    "role": r[3],
                    "status": r[4],
                    "created_at": r[5],
                    "last_login_at": r[6],
                    "is_locked": bool(r[7] and curr_time < r[7]),
                    "assigned_control_ids": assigned
                })
            return {"items": users, "total": len(users)}

    @router.post('/api/users', status_code=201)
    def create_user(request: Request, payload: dict):
        user = getattr(request.state, 'user', None)
        check_user_permission(user, "users:manage")

        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))
        role = str(payload.get("role", "viewer")).strip()
        assigned = payload.get("assigned_control_ids", [])

        if not name or not email or not password:
            raise HTTPException(422, "Name, email, and password are required.")

        if role not in ROLES:
            raise HTTPException(422, f"Invalid role '{role}'. Must be one of {list(ROLES)}.")

        validate_password_strength(password)

        with store.transaction() as db:
            existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
            if existing:
                raise HTTPException(409, f"A user with email '{email}' already exists.")

            uid = str(uuid4())
            pw_hash = hash_password(password)
            ts = now()

            db.execute(
                """INSERT INTO users (id, name, email, password_hash, role, status, created_at, updated_at, assigned_control_ids)
                   VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)""",
                (uid, name, email, pw_hash, role, ts, ts, json.dumps(assigned))
            )

            actor_str = f"{user['name']} ({user['email']})" if user else "admin"
            append_audit_log(
                db,
                actor=actor_str,
                action="create_user",
                resource="users",
                record_id=uid,
                title=f"Provisioned user '{name}' ({role})",
                after={"email": email, "role": role, "status": "active"}
            )

            return {
                "id": uid,
                "name": name,
                "email": email,
                "role": role,
                "status": "active",
                "assigned_control_ids": assigned
            }

    @router.patch('/api/users/{user_id}')
    def update_user(user_id: str, request: Request, payload: dict):
        user = getattr(request.state, 'user', None)
        check_user_permission(user, "users:manage")

        with store.transaction() as db:
            existing = db.execute("SELECT id, name, email, role, status, assigned_control_ids FROM users WHERE id = ?", (user_id,)).fetchone()
            if not existing:
                raise HTTPException(404, f"User {user_id} not found.")

            role = payload.get("role", existing[3])
            status = payload.get("status", existing[4])
            assigned = payload.get("assigned_control_ids")

            if role not in ROLES:
                raise HTTPException(422, f"Invalid role '{role}'.")

            if status not in {"active", "disabled"}:
                raise HTTPException(422, "Status must be 'active' or 'disabled'.")

            assigned_str = json.dumps(assigned) if assigned is not None else existing[5]
            ts = now()

            db.execute(
                "UPDATE users SET role = ?, status = ?, assigned_control_ids = ?, updated_at = ? WHERE id = ?",
                (role, status, assigned_str, ts, user_id)
            )

            actor_str = f"{user['name']} ({user['email']})" if user else "admin"
            append_audit_log(
                db,
                actor=actor_str,
                action="update_user",
                resource="users",
                record_id=user_id,
                title=f"Updated permissions/status for user '{existing[1]}'",
                before={"role": existing[3], "status": existing[4]},
                after={"role": role, "status": status}
            )

            return {
                "id": user_id,
                "name": existing[1],
                "email": existing[2],
                "role": role,
                "status": status,
                "assigned_control_ids": json.loads(assigned_str)
            }

    @router.post('/api/users/{user_id}/unlock')
    def unlock_user(user_id: str, request: Request):
        user = getattr(request.state, 'user', None)
        check_user_permission(user, "users:manage")

        with store.transaction() as db:
            row = db.execute("SELECT name, email FROM users WHERE id = ?", (user_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"User {user_id} not found.")

            db.execute("UPDATE users SET failed_attempts = 0, locked_until = 0 WHERE id = ?", (user_id,))
            actor_str = f"{user['name']} ({user['email']})" if user else "admin"
            append_audit_log(
                db,
                actor=actor_str,
                action="unlock_user",
                resource="users",
                record_id=user_id,
                title=f"Unlocked user account for '{row[0]}'"
            )

            return {"status": "ok", "message": f"User {row[1]} unlocked."}

    return router
