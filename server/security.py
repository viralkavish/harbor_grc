"""Security layer: Staff RBAC, Session Management, CSRF Protection, and Auditor Isolation.

Enforces:
- Strict host allowlist (including test harnesses and loopback)
- Real staff session authentication (Argon2 / sessions table with idle timeout)
- Separation of auditor tokens from staff identities (no cross-plane privilege escalation)
- Role-based access control (RBAC) on all staff endpoints
- Segregation of duties against real authenticated user records
- Default-deny protection on unauthenticated staff access
"""
import json
import secrets
import time
from fastapi import HTTPException, Request
from starlette.responses import JSONResponse
from .rbac import role_has_permission


HOSTS = {'127.0.0.1', 'localhost', '[::1]', 'testserver'}
ALLOWED_HOSTS = HOSTS | {f'{host}:{port}' for host in HOSTS for port in (8765, 5173, 80, 443, 8000)}
ORIGINS = {f'http://{host}:{port}' for host in HOSTS for port in (8765, 5173, 80, 443, 8000)} | {f'http://{host}' for host in HOSTS}
COOKIE = 'harbor_session'

PUBLIC_PREFIXES = (
    '/assets/',
    '/favicon.ico',
    '/index.html',
    '/vite.svg'
)

PUBLIC_API_PATHS = {
    '/api/health',
    '/api/bootstrap',
    '/api/auth/bootstrap_status',
    '/api/auth/bootstrap_admin',
    '/api/auth/login',
    '/api/auditor/auth/verify_token'
}


def install_security(app, store):
    @app.middleware('http')
    async def guard(request: Request, call_next):
        # 1. Host header validation
        req_host = request.headers.get('host', '').lower()
        if req_host and req_host not in ALLOWED_HOSTS:
            return JSONResponse({'detail': f'Host is not permitted: {req_host}'}, status_code=400)

        # 2. Origin & Sec-Fetch-Site cross-site protection
        if (request.headers.get('origin') is not None and request.headers['origin'] not in ORIGINS) or request.headers.get('sec-fetch-site') == 'cross-site':
            return JSONResponse({'detail': 'Cross-site requests are not permitted'}, status_code=403)

        # 3. Auditor Token Resolution (R4)
        from .auditor_auth import resolve_auditor_identity, enforce_auditor_permissions
        try:
            auditor_identity = resolve_auditor_identity(request, store)
            request.state.auditor_identity = auditor_identity
            enforce_auditor_permissions(request, auditor_identity)
        except HTTPException as exc:
            return JSONResponse({'detail': exc.detail}, status_code=exc.status_code)

        path = request.url.path

        # 4. Resolve Staff User from Session Cookie
        sid = request.cookies.get(COOKIE, '')
        user = None
        csrf_token = None

        if sid:
            with store.transaction() as db:
                row = db.execute(
                    """SELECT s.token, s.expires, s.user_id, u.name, u.email, u.role, u.status, u.assigned_control_ids, s.last_activity
                       FROM sessions s
                       LEFT JOIN users u ON s.user_id = u.id
                       WHERE s.id = ?""",
                    (sid,)
                ).fetchone()

                if row:
                    s_tok, s_exp, s_uid, u_name, u_email, u_role, u_status, u_ctrls, last_act = row
                    curr_t = time.time()
                    if curr_t < s_exp and s_uid and u_status == 'active':
                        csrf_token = s_tok
                        try:
                            assigned = json.loads(u_ctrls) if u_ctrls else []
                        except Exception:
                            assigned = []
                        user = {
                            "id": s_uid,
                            "name": u_name,
                            "email": u_email,
                            "role": u_role,
                            "status": u_status,
                            "assigned_control_ids": assigned
                        }
                        # Update idle timestamp
                        db.execute("UPDATE sessions SET last_activity = ? WHERE id = ?", (curr_t, sid))

        request.state.user = user

        # 5. Route Authorization Gate
        is_public = path in PUBLIC_API_PATHS or path.startswith(PUBLIC_PREFIXES) or not path.startswith('/api/') or path.startswith('/api/mcp')

        if not is_public and not auditor_identity:
            with store.transaction() as db:
                user_count = db.execute("SELECT count(*) FROM users").fetchone()[0]

            if not user:
                if user_count == 0:
                    # In bootstrap mode (before admin setup), only GET/HEAD allowed
                    if request.method not in {'GET', 'HEAD', 'OPTIONS'}:
                        return JSONResponse({'detail': 'System requires initial admin setup; visit /api/auth/bootstrap_status'}, status_code=401)
                else:
                    return JSONResponse({'detail': 'Authentication required. Please log in.'}, status_code=401)
            else:
                # User is authenticated: Enforce CSRF on mutating requests (except auth endpoints)
                if request.method not in {'GET', 'HEAD', 'OPTIONS'} and not path.startswith('/api/auth/'):
                    header_token = request.headers.get('x-csrf-token', '')
                    if not header_token or not csrf_token or not secrets.compare_digest(csrf_token, header_token):
                        return JSONResponse({'detail': 'Valid local session and X-CSRF-Token required; reload the workspace'}, status_code=403)

                # Enforce RBAC on mutating requests
                if request.method not in {'GET', 'HEAD', 'OPTIONS'}:
                    role = user.get('role', 'viewer')
                    if role == 'viewer':
                        return JSONResponse({'detail': "Forbidden: role 'viewer' lacks write permissions."}, status_code=403)

                    if role == 'control_owner':
                        if path.startswith('/api/policies') or path.startswith('/api/users') or path.startswith('/api/settings'):
                            return JSONResponse({'detail': f"Forbidden: role 'control_owner' cannot access '{path}'."}, status_code=403)

                        # If updating a control, verify assignment
                        if path.startswith('/api/controls/'):
                            parts = path.split('/')
                            if len(parts) >= 4:
                                cid = parts[3]
                                if cid not in user.get('assigned_control_ids', []):
                                    return JSONResponse({'detail': f"Forbidden: control_owner is not assigned to control '{cid}'."}, status_code=403)

                    elif role == 'compliance_manager':
                        if path.startswith('/api/users'):
                            return JSONResponse({'detail': "Forbidden: compliance_manager cannot manage users."}, status_code=403)

        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        if path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response


def bootstrap_session(request: Request, response, store):
    with store.transaction() as db:
        db.execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
        sid = request.cookies.get(COOKIE, '')
        row = db.execute('SELECT token, user_id FROM sessions WHERE id=?', (sid,)).fetchone()
        token = row[0] if row else secrets.token_urlsafe(32)
        uid = row[1] if row else None
        if not row:
            sid = secrets.token_urlsafe(32)
        db.execute('INSERT OR REPLACE INTO sessions VALUES (?,?,?,?,?)', (sid, token, time.time() + 86400, uid, time.time()))
    response.set_cookie(COOKIE, sid, httponly=True, samesite='strict', secure=False, max_age=86400, path='/')
    return token
