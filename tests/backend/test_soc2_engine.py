"""Tests for SOC 2 Type 1 & Type 2 audit readiness engine, PBC list, and sampling tools."""
import pytest
from conftest import create


def test_soc2_gap_analysis(client):
    res = client.get('/api/soc2/gap_analysis')
    assert res.status_code == 200
    data = res.json()
    assert 'type1_score' in data
    assert 'type2_score' in data
    assert 'type1_items' in data
    assert 'type2_items' in data
    assert len(data['type1_items']) >= 5
    assert len(data['type2_items']) >= 5


def test_soc2_pbc_request_list(client):
    res = client.get('/api/soc2/pbc_list')
    assert res.status_code == 200
    data = res.json()
    assert 'items' in data
    assert data['total'] >= 20
    assert any('pbc-01' in item['id'] for item in data['items'])


def test_soc2_population_sample_generator(client):
    # Sample workforce
    create(client, 'people', title='David SRE', email='david@company.com', status='active')
    create(client, 'people', title='Elena PM', email='elena@company.com', status='active')

    res = client.post('/api/soc2/sample_generator', json={
        'population_type': 'workforce',
        'sample_size': 2
    })
    assert res.status_code == 200
    data = res.json()
    assert data['population_type'] == 'workforce'
    assert len(data['samples']) <= 2
    assert 'background_check_verified' in data['samples'][0]


def test_soc2_cuecs_and_csocs(client):
    res = client.get('/api/soc2/cuecs_and_csocs')
    assert res.status_code == 200
    data = res.json()
    assert 'cuecs' in data
    assert 'csocs' in data
    assert data['total_cuecs'] >= 4
    assert data['total_csocs'] >= 4
