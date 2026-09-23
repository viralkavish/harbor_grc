"""Loopback trust boundary and CSRF; deliberately not account authentication."""
import secrets
import time
from fastapi import HTTPException
from starlette.responses import JSONResponse

HOSTS = {'127.0.0.1', 'localhost', '[::1]'}
ALLOWED_HOSTS = HOSTS | {f'{host}:{port}' for host in HOSTS for port in (8765, 5173)}
ORIGINS = {f'http://{host}:{port}' for host in HOSTS for port in (8765, 5173)}
COOKIE = 'harbor_session'


def install_security(app, store):
    @app.middleware('http')
    async def guard(request, call_next):
        if request.headers.get('host', '').lower() not in ALLOWED_HOSTS:
            return JSONResponse({'detail':'Host is not permitted'}, status_code=400)
        if (request.headers.get('origin') is not None and request.headers['origin'] not in ORIGINS) or request.headers.get('sec-fetch-site') == 'cross-site':
            return JSONResponse({'detail':'Cross-site requests are not permitted'}, status_code=403)

        from .auditor_auth import resolve_auditor_identity, enforce_auditor_permissions
        try:
            auditor_identity = resolve_auditor_identity(request, store)
            request.state.auditor_identity = auditor_identity
            enforce_auditor_permissions(request, auditor_identity)
        except HTTPException as exc:
            return JSONResponse({'detail': exc.detail}, status_code=exc.status_code)

        if not auditor_identity and request.method not in {'GET', 'HEAD', 'OPTIONS'} and not request.url.path.startswith('/api/mcp'):
            sid, token = request.cookies.get(COOKIE, ''), request.headers.get('x-csrf-token', '')
            with store.transaction() as db:
                session = db.execute('SELECT token,expires FROM sessions WHERE id=?', (sid,)).fetchone()
            if not session or session['expires'] < time.time() or not secrets.compare_digest(session['token'], token):
                return JSONResponse({'detail':'Valid local session and X-CSRF-Token required; reload the workspace'}, status_code=403)
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        if request.url.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response


def bootstrap_session(request, response, store):
    with store.transaction() as db:
        db.execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
        sid = request.cookies.get(COOKIE, '')
        row = db.execute('SELECT token FROM sessions WHERE id=?', (sid,)).fetchone()
        token = row[0] if row else secrets.token_urlsafe(32)
        if not row:
            sid = secrets.token_urlsafe(32)
        db.execute('INSERT OR REPLACE INTO sessions VALUES (?,?,?)', (sid, token, time.time() + 86400))
    response.set_cookie(COOKIE, sid, httponly=True, samesite='strict', secure=False, max_age=86400, path='/')
    return token
