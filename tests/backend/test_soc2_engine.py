"""Tests for SOC 2 Type 1 & Type 2 audit readiness engine, PBC list, and sampling tools."""
import io
import json
import zipfile
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

    # Phase E1: Observation tracker & per-control evidence status
    assert 'observation_tracker' in data
    assert data['observation_tracker']['start_date'] == '2027-01-01'
    assert 'days_remaining' in data['observation_tracker']
    assert 'per_control_evidence' in data
    assert 'evidence_coverage_pct' in data


def test_soc2_pbc_request_list(client):
    res = client.get('/api/soc2/pbc_list')
    assert res.status_code == 200
    data = res.json()
    assert 'items' in data
    assert data['total'] >= 20
    assert any('pbc-01' in item['id'] for item in data['items'])


def test_soc2_pbc_staging_and_export_package(client):
    # Phase E3: Stage evidence for PBC item
    stage_res = client.post('/api/soc2/pbc/pbc-06/stage_evidence', json={
        'title': 'Okta MFA Enforcement Policy Configuration Screenshot'
    })
    assert stage_res.status_code == 200
    assert stage_res.json()['status'] == 'created_and_staged'

    # Verify PBC list reflects staged item
    pbc_res = client.get('/api/soc2/pbc_list')
    item_06 = next(i for i in pbc_res.json()['items'] if i['id'] == 'pbc-06')
    assert item_06['status'] == 'staged'
    assert item_06['staged_count'] >= 1

    # Export auditor package ZIP
    pkg_res = client.get('/api/soc2/pbc/export_package')
    assert pkg_res.status_code == 200
    assert pkg_res.headers['content-type'] == 'application/zip'

    with zipfile.ZipFile(io.BytesIO(pkg_res.content)) as zf:
        namelist = zf.namelist()
        assert 'MANIFEST.json' in namelist
        assert 'PBC_AUDITOR_REPORT.md' in namelist
        manifest = json.loads(zf.read('MANIFEST.json'))
        assert manifest['organization'] == 'TwoFrom'
        assert manifest['observation_start'] == '2027-01-01'


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


def test_control_drift_monitoring_endpoints(client):
    # Phase E2: Control drift checks
    drift_res = client.get('/api/monitoring/drift')
    assert drift_res.status_code == 200
    data = drift_res.json()
    assert 'drift_count' in data
    assert 'is_drift_free' in data
    assert 'findings' in data
