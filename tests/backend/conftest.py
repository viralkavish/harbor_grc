import pytest
from fastapi.testclient import TestClient
from server.app import create_app


def authenticate_client(client):
    try:
        status = client.get('/api/auth/bootstrap_status').json()
        if status.get('needs_bootstrap'):
            client.post('/api/auth/bootstrap_admin', json={
                'setup_token': status['setup_token'],
                'name': 'Test Admin',
                'email': 'admin@tofrom.internal',
                'password': 'AdminPassword12345!'
            })
        else:
            client.post('/api/auth/login', json={
                'email': 'admin@tofrom.internal',
                'password': 'AdminPassword12345!'
            })
    except Exception:
        pass


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path), base_url='http://127.0.0.1:8765') as c:
        authenticate_client(c)
        c.headers['X-CSRF-Token'] = c.get('/api/bootstrap').json().get('csrf_token', '')
        yield c


@pytest.fixture
def test_setup(tmp_path):
    app = create_app(tmp_path)
    c = TestClient(app, base_url='http://127.0.0.1:8765')
    authenticate_client(c)
    token = c.get('/api/bootstrap').json().get('csrf_token', '')
    c.headers['X-CSRF-Token'] = token
    store = app.state.store
    return c, store, tmp_path


def create(client, resource, **fields):
    response = client.post('/api/' + resource, json={'title': 'Test ' + resource, **fields})
    assert response.status_code == 201, response.text
    return response.json()
