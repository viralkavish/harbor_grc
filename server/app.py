"""Application factory; importing this module never creates production data."""
import json
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from .storage import Store, WORKSPACE, sanitize_workspace
from .security import install_security, bootstrap_session
from .seed import seed_starter_data
from .dashboard import compute_dashboard
from .search import search_workspace
from .policies_ops import policy_router
from .evidence_ops import evidence_router
from .monitoring import monitoring_router
from .csv_ops import csv_router
from .backup_ops import backup_router
from .audits_ops import audit_router
from .audit_ops import audit_router as audit_log_router
from .integrations import integrations_router
from .continuous_tests import continuous_tests_router
from .personnel_ops import personnel_router
from .system_description_ops import system_description_router
from .roadmap_ops import roadmap_router
from .soc2_engine import soc2_router
from .jev_evaluator import jev_router
from .vanta_features_suite import top10_features_router
from .pilot import pilot_router
from .resource_routes import resource_router


VALID_TSC_CRITERIA = {"Security", "Availability", "Confidentiality", "Processing Integrity", "Privacy"}


def create_app(data_dir: Path | str | None = None, auto_seed: bool = True) -> FastAPI:
    root = data_dir or os.environ.get('HARBOR_DATA_DIR') or Path(__file__).resolve().parents[1] / 'data'
    store = Store(root)
    if auto_seed:
        seed_starter_data(store)

    app = FastAPI(title='tofromGRC', version='0.12.0', docs_url=None, redoc_url=None)
    app.state.store = store
    install_security(app, store)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        return JSONResponse({'detail': '; '.join(f"{'.'.join(map(str,e['loc']))}: {e['msg']}" for e in exc.errors())}, status_code=422)

    @app.get('/api/health')
    def health():
        return {'status': 'ok', 'version': '0.12.0', 'storage': 'sqlite'}

    @app.get('/api/bootstrap')
    def bootstrap(request: Request, response: Response):
        token = bootstrap_session(request, response, store)
        with store.transaction() as db:
            ws = sanitize_workspace(store.workspace(db))
            frameworks = Store.records(db, 'frameworks')
            from .schema import RESOURCES
            counts = {name: len(Store.records(db, name)) for name in RESOURCES}
            capabilities = {
                'csv_export': True,
                'csv_import': True,
                'evidence_upload': True,
                'monitoring': True,
                'policy_publishing': True,
                'policy_suggestions': True,
                'audit_export': True,
                'trust_center': False,
                'backup': True
            }
            return dict(workspace=ws, csrf_token=token, counts=counts, frameworks=frameworks, capabilities=capabilities)

    @app.get('/api/workspace')
    @app.get('/api/settings')
    def get_settings():
        with store.transaction() as db:
            ws = sanitize_workspace(store.workspace(db))
            return {'workspace': ws, 'settings': ws}

    @app.patch('/api/workspace')
    @app.patch('/api/settings')
    def update_workspace(payload: dict):
        with store.transaction() as db:
            workspace = store.workspace(db)
            from .audit_ops import append_audit_log
            old_ws = dict(workspace)
            for key, value in payload.items():
                if key not in WORKSPACE and key != 'clear_jev_api_key':
                    raise HTTPException(422, f'Unknown workspace field: {key}')
                if key in {'trust_policy_ids', 'trust_evidence_ids'}:
                    resource = 'policies' if key == 'trust_policy_ids' else 'evidence'
                    if not isinstance(value, list) or len(value) > 5000 or any(not isinstance(v, str) or not store.get(db, resource, v) for v in value):
                        raise HTTPException(422, f'{key}: expected existing {resource} IDs')
                elif key == 'criteria':
                    if not isinstance(value, list) or any(c not in VALID_TSC_CRITERIA for c in value):
                        raise HTTPException(422, 'criteria: invalid TSC criteria list')
                elif key in {'onboarding_completed', 'dni_permission_confirmed'}:
                    if not isinstance(value, bool):
                        raise HTTPException(422, f'{key}: expected boolean')
                elif not isinstance(value, str) or len(value) > 10000 or (key in {'name', 'company'} and not value.strip()):
                    raise HTTPException(422, f'{key}: invalid text')
                if key == 'jev_api_key':
                    if isinstance(value, str) and value.strip():
                        workspace['jev_api_key'] = value.strip()
                    elif payload.get('clear_jev_api_key'):
                        workspace['jev_api_key'] = ''
                else:
                    workspace[key] = value
            Store.save_workspace(db, workspace)
            append_audit_log(
                db,
                actor=str(workspace.get('owner') or "Security Lead"),
                action="update_settings",
                resource="workspace",
                record_id="workspace",
                title="Update Workspace Settings",
                before=sanitize_workspace(old_ws),
                after=sanitize_workspace(workspace)
            )
            return sanitize_workspace(workspace)

    @app.get('/api/workspace/scope')
    @app.get('/workspace/scope')
    def get_workspace_scope():
        with store.transaction() as db:
            ws = store.workspace(db)
            return {
                "company": ws.get('company', 'tofrom'),
                "organization": ws.get('organization', 'tofrom'),
                "criteria": ws.get('criteria', ['Security', 'Availability', 'Confidentiality']),
                "audit_type": ws.get('audit_type', 'Type II'),
                "observation_start": ws.get('observation_start', '2027-01-01'),
                "auditor": ws.get('auditor', ''),
                "onboarding_completed": bool(ws.get('onboarding_completed', False)),
                "dni_permission_confirmed": bool(ws.get('dni_permission_confirmed', False))
            }

    @app.patch('/api/workspace/scope')
    @app.patch('/workspace/scope')
    def update_workspace_scope(payload: dict):
        observation_start = payload.get('observation_start')
        if not observation_start or not isinstance(observation_start, str) or not observation_start.strip():
            raise HTTPException(422, "Field 'observation_start' is required (e.g. '2027-01-01').")

        criteria = payload.get('criteria')
        if not isinstance(criteria, list) or not criteria:
            raise HTTPException(422, "Field 'criteria' must be a non-empty list of valid TSC criteria.")

        invalid = [c for c in criteria if c not in VALID_TSC_CRITERIA]
        if invalid:
            raise HTTPException(422, f"Invalid TSC criteria: {', '.join(invalid)}. Allowed: {', '.join(sorted(VALID_TSC_CRITERIA))}")

        with store.transaction() as db:
            workspace = store.workspace(db)
            old_scope = {
                "company": workspace.get('company'),
                "criteria": workspace.get('criteria'),
                "observation_start": workspace.get('observation_start'),
                "audit_type": workspace.get('audit_type'),
                "auditor": workspace.get('auditor')
            }
            if 'company' in payload:
                company = str(payload['company']).strip()
                workspace['company'] = company
                workspace['organization'] = company
            workspace['criteria'] = criteria
            workspace['observation_start'] = observation_start.strip()
            if 'audit_type' in payload:
                workspace['audit_type'] = str(payload['audit_type']).strip()
            if 'auditor' in payload:
                workspace['auditor'] = str(payload['auditor']).strip()
            if 'dni_permission_confirmed' in payload:
                workspace['dni_permission_confirmed'] = bool(payload['dni_permission_confirmed'])
            if 'onboarding_completed' in payload:
                workspace['onboarding_completed'] = bool(payload['onboarding_completed'])

            Store.save_workspace(db, workspace)
            from .audit_ops import append_audit_log
            append_audit_log(
                db,
                actor=str(workspace.get('owner') or "Security Lead"),
                action="update_scope",
                resource="workspace",
                record_id="workspace",
                title="Update Audit Scope & Parameters",
                before=old_scope,
                after={
                    "company": workspace.get('company'),
                    "criteria": workspace.get('criteria'),
                    "observation_start": workspace.get('observation_start'),
                    "audit_type": workspace.get('audit_type'),
                    "auditor": workspace.get('auditor')
                }
            )
            return sanitize_workspace(workspace)

    @app.get('/api/dashboard')
    def get_dashboard():
        return compute_dashboard(store)

    @app.get('/api/search')
    def search(q: str = ''):
        return search_workspace(store, q)

    # Mount feature routers
    app.include_router(audit_log_router(store))
    app.include_router(policy_router(store))
    app.include_router(evidence_router(store))
    app.include_router(monitoring_router(store))
    app.include_router(csv_router(store))
    app.include_router(backup_router(store))
    app.include_router(audit_router(store))
    app.include_router(integrations_router())
    app.include_router(continuous_tests_router(store))
    app.include_router(personnel_router(store))
    app.include_router(system_description_router(store))
    app.include_router(roadmap_router(store))
    app.include_router(soc2_router(store))
    app.include_router(jev_router(store))
    app.include_router(pilot_router(store))
    app.include_router(top10_features_router(store))
    app.include_router(resource_router(store))

    # SPA static file distribution
    client_dist = Path(__file__).resolve().parents[1] / 'client' / 'dist'
    if client_dist.is_dir():
        assets_dir = client_dist / 'assets'
        if assets_dir.is_dir():
            app.mount('/assets', StaticFiles(directory=str(assets_dir)), name='assets')

        @app.get('/{full_path:path}')
        async def serve_spa(full_path: str):
            if full_path.startswith('api'):
                raise HTTPException(404, 'API endpoint not found')
            target = (client_dist / full_path).resolve()
            if str(target).startswith(str(client_dist.resolve())) and target.is_file():
                return FileResponse(target)
            return FileResponse(client_dist / 'index.html')

    return app
