"""Application factory; importing this module never creates production data."""
import json
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from .storage import Store, WORKSPACE
from .security import install_security, bootstrap_session
from .seed import seed_starter_data
from .dashboard import compute_dashboard
from .search import search_workspace
from .policies_ops import policy_router
from .evidence_ops import evidence_router
from .monitoring import monitoring_router
from .questionnaires_ops import questionnaire_router
from .csv_ops import csv_router
from .backup_ops import backup_router
from .audits_ops import audit_router
from .trust_ops import trust_router
from .integrations import integrations_router
from .continuous_tests import continuous_tests_router
from .personnel_ops import personnel_router
from .system_description_ops import system_description_router
from .roadmap_ops import roadmap_router
from .soc2_engine import soc2_router
from .jev_evaluator import jev_router
from .vanta_features_suite import top10_features_router
from .resource_routes import resource_router


def create_app(data_dir: Path | str | None = None, auto_seed: bool = True) -> FastAPI:
    root = data_dir or os.environ.get('HARBOR_DATA_DIR') or Path(__file__).resolve().parents[1] / 'data'
    store = Store(root)
    if auto_seed:
        seed_starter_data(store)

    app = FastAPI(title='Harbor GRC', version='0.6.0', docs_url=None, redoc_url=None)
    app.state.store = store
    install_security(app, store)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        return JSONResponse({'detail': '; '.join(f"{'.'.join(map(str,e['loc']))}: {e['msg']}" for e in exc.errors())}, status_code=422)

    @app.get('/api/health')
    def health():
        return {'status': 'ok', 'version': '0.6.0', 'storage': 'sqlite'}

    @app.get('/api/bootstrap')
    def bootstrap(request: Request, response: Response):
        token = bootstrap_session(request, response, store)
        with store.transaction() as db:
            ws = store.workspace(db)
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
                'trust_center': True,
                'backup': True
            }
            return dict(workspace=ws, csrf_token=token, counts=counts, frameworks=frameworks, capabilities=capabilities)

    @app.get('/api/workspace')
    @app.get('/api/settings')
    def get_settings():
        with store.transaction() as db:
            ws = store.workspace(db)
            return {'workspace': ws, 'settings': ws}

    @app.patch('/api/workspace')
    @app.patch('/api/settings')
    def update_workspace(payload: dict):
        with store.transaction() as db:
            workspace = store.workspace(db)
            for key, value in payload.items():
                if key not in WORKSPACE:
                    raise HTTPException(422, f'Unknown workspace field: {key}')
                if key in {'trust_policy_ids', 'trust_evidence_ids'}:
                    resource = 'policies' if key == 'trust_policy_ids' else 'evidence'
                    if not isinstance(value, list) or len(value) > 5000 or any(not isinstance(v, str) or not store.get(db, resource, v) for v in value):
                        raise HTTPException(422, f'{key}: expected existing {resource} IDs')
                elif not isinstance(value, str) or len(value) > 10000 or (key == 'name' and not value.strip()):
                    raise HTTPException(422, f'{key}: invalid text')
                workspace[key] = value
            db.execute('UPDATE settings SET value=? WHERE key=?', (json.dumps(workspace), 'workspace'))
            return workspace

    @app.get('/api/dashboard')
    def get_dashboard():
        return compute_dashboard(store)

    @app.get('/api/search')
    def search(q: str = ''):
        return search_workspace(store, q)

    # Mount feature routers
    app.include_router(policy_router(store))
    app.include_router(evidence_router(store))
    app.include_router(monitoring_router(store))
    app.include_router(questionnaire_router(store))
    app.include_router(csv_router(store))
    app.include_router(backup_router(store))
    app.include_router(audit_router(store))
    app.include_router(trust_router(store))
    app.include_router(integrations_router())
    app.include_router(continuous_tests_router(store))
    app.include_router(personnel_router(store))
    app.include_router(system_description_router(store))
    app.include_router(roadmap_router(store))
    app.include_router(soc2_router(store))
    app.include_router(jev_router(store))
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
