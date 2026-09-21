from pathlib import Path
import pytest


@pytest.fixture
def client(tmp_path):
    from server.app import create_app
    with TestClient(create_app(tmp_path), base_url="http://127.0.0.1:8765") as c:
        token = c.get('/api/bootstrap').json()['csrf_token']
        c.headers['X-CSRF-Token'] = token
        yield c


def test_session_protects_persistent_workspace(tmp_path):
    from server.app import create_app
    with TestClient(create_app(tmp_path), base_url='http://127.0.0.1:8765') as c:
        bootstrap = c.get('/api/bootstrap')
        assert bootstrap.status_code == 200
        assert bootstrap.json()['workspace']['name'] == 'Your workspace'
        assert 'HttpOnly' in bootstrap.headers['set-cookie']
        assert 'SameSite=strict' in bootstrap.headers['set-cookie']
        assert c.patch('/api/workspace', json={'name': 'Private Harbor'}).status_code == 403
        c.headers['X-CSRF-Token'] = bootstrap.json()['csrf_token']
        assert c.patch('/api/workspace', json={'name': 'Private Harbor'}).json()['name'] == 'Private Harbor'
        assert c.get('/api/health', headers={'Host': 'evil.example'}).status_code == 400
        for headers in [{'Origin':'https://evil.example'}, {'Sec-Fetch-Site':'cross-site'}]:
            assert c.get('/api/bootstrap', headers=headers).status_code == 403
        assert c.patch('/api/workspace', json={'unknown':True}).status_code == 422
        assert c.patch('/api/workspace', json={'trust_evidence_ids':['missing']}).status_code == 422
    with TestClient(create_app(tmp_path), base_url='http://127.0.0.1:8765') as c:
        assert c.get('/api/bootstrap').json()['workspace']['name'] == 'Private Harbor'
    assert (tmp_path/'harbor.db').is_file()

from fastapi.testclient import TestClient


def test_health_uses_factory_without_global_data_writes(tmp_path):
    from server.app import create_app
    with TestClient(create_app(tmp_path), base_url="http://127.0.0.1:8765") as client:
        assert client.get('/api/health').json() == {
            'status': 'ok', 'version': '0.2.0', 'storage': 'sqlite'
        }
