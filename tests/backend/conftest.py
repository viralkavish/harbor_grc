import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path):
    from server.app import create_app
    with TestClient(create_app(tmp_path), base_url='http://127.0.0.1:8765') as c:
        c.headers['X-CSRF-Token'] = c.get('/api/bootstrap').json()['csrf_token']
        yield c


def create(client, resource, **fields):
    response = client.post('/api/' + resource, json={'title': 'Test ' + resource, **fields})
    assert response.status_code == 201, response.text
    return response.json()
