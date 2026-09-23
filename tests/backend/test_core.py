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
        assert bootstrap.json()['workspace']['name'] == 'tofromGRC Workspace'
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
            'status': 'ok', 'version': '0.13.0', 'storage': 'sqlite'
        }


def test_workspace_scope_validation_and_update(tmp_path):
    from server.app import create_app
    with TestClient(create_app(tmp_path), base_url="http://127.0.0.1:8765") as client:
        bootstrap = client.get('/api/bootstrap')
        client.headers['X-CSRF-Token'] = bootstrap.json()['csrf_token']

        # 1. Scope defaults
        scope = client.get('/api/workspace/scope').json()
        assert scope['company'] == 'tofrom'
        assert 'Security' in scope['criteria']

        # 2. Reject missing observation_start
        err1 = client.patch('/api/workspace/scope', json={
            'criteria': ['Security']
        })
        assert err1.status_code == 422
        assert 'observation_start' in err1.json()['detail']

        # 3. Reject invalid TSC criteria
        err2 = client.patch('/api/workspace/scope', json={
            'observation_start': '2027-01-01',
            'criteria': ['Security', 'InvalidCategory']
        })
        assert err2.status_code == 422
        assert 'Invalid TSC criteria' in err2.json()['detail']

        # 4. Valid update
        ok = client.patch('/api/workspace/scope', json={
            'company': 'TwoFrom',
            'criteria': ['Security', 'Availability', 'Confidentiality'],
            'audit_type': 'Type II',
            'observation_start': '2027-01-01',
            'auditor': 'A-LIGN',
            'dni_permission_confirmed': True,
            'onboarding_completed': True
        })
        assert ok.status_code == 200

        scope2 = client.get('/api/workspace/scope').json()
        assert scope2['observation_start'] == '2027-01-01'
        assert scope2['auditor'] == 'A-LIGN'
        assert scope2['onboarding_completed'] is True
        assert scope2['dni_permission_confirmed'] is True
