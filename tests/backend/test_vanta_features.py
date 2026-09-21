"""Tests for advanced Vanta-parity capabilities: policy templates, acceptance tracking, continuous tests, and trust access."""
import io
import zipfile
import pytest
from conftest import create


def test_policy_templates_and_creation(client):
    res = client.get('/api/policies/templates')
    assert res.status_code == 200
    templates = res.json()['items']
    assert len(templates) >= 10
    assert any(t['id'] == 'tpl-use-09' for t in templates)

    # Create policy from template
    create_res = client.post('/api/policies/from_template', json={
        'template_id': 'tpl-use-09',
        'title': 'Corporate Acceptable Use Standard',
        'substitutions': {'organization_name': 'Acme Global'}
    })
    assert create_res.status_code == 201
    policy = create_res.json()
    assert policy['title'] == 'Corporate Acceptable Use Standard'
    assert 'Acme Global' in policy['content']


def test_policy_acceptance_and_packet_export(client):
    pol = create(client, 'policies', title='Information Security Policy', content='# InfoSec Policy\nContent here.')
    client.post(f"/api/policies/{pol['id']}/publish", json={'approver': 'Chief Security Officer'})

    # Create active personnel
    person = create(client, 'people', title='Alice Dev', email='alice@company.com', status='active')

    # Record acceptance
    acc_res = client.post(f"/api/policies/{pol['id']}/accept", json={
        'person_id': person['id'],
        'person_name': 'Alice Dev',
        'person_email': 'alice@company.com',
        'signature_text': 'Alice Dev'
    })
    assert acc_res.status_code == 200
    assert acc_res.json()['accepted'] is True

    # Check acceptances report
    stats_res = client.get(f"/api/policies/{pol['id']}/acceptances")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats['total'] >= 1
    assert stats['compliant_employees'] >= 1
    assert stats['compliance_percent'] > 0

    # Policy Packet export
    packet_res = client.get('/api/policies/packet')
    assert packet_res.status_code == 200
    assert packet_res.headers['content-type'] == 'application/zip'
    with zipfile.ZipFile(io.BytesIO(packet_res.content)) as zf:
        names = zf.namelist()
        assert 'manifest.json' in names
        assert 'POLICY_PACKET.md' in names
        assert 'acceptance_audit_log.json' in names


def test_continuous_automated_tests_engine(client):
    tests_res = client.get('/api/tests')
    assert tests_res.status_code == 200
    data = tests_res.json()
    assert 'tests' in data
    assert data['total'] == 16
    assert 'health_percent' in data

    # Run tests
    run_res = client.post('/api/tests/run')
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data['last_run'] is not None
    assert any(t['id'] == 'test_host_disk_encryption' for t in run_data['tests'])
    assert any(t['id'] == 'test_host_firewall' for t in run_data['tests'])
    assert any(t['id'] == 'test_network_open_ports' for t in run_data['tests'])
    assert any(t['id'] == 'test_system_description' for t in run_data['tests'])


def test_system_description_and_roadmap(client):
    # System description
    desc_res = client.get('/api/system_description')
    assert desc_res.status_code == 200
    doc = desc_res.json()
    assert 'sections' in doc
    assert len(doc['sections']) >= 10

    # Export
    exp_res = client.get('/api/system_description/export')
    assert exp_res.status_code == 200
    assert 'text/markdown' in exp_res.headers['content-type']
    assert 'AICPA' in exp_res.text

    # Roadmap
    road_res = client.get('/api/roadmap')
    assert road_res.status_code == 200
    road = road_res.json()
    assert len(road['phases']) == 6
    assert road['total_tasks'] == 18

    # Toggle task
    toggle_res = client.patch('/api/roadmap/tasks/p1_t3', json={'completed': True})
    assert toggle_res.status_code == 200
    assert toggle_res.json()['completed'] is True

    # Live verification
    verify_res = client.post('/api/roadmap/verify_live')
    assert verify_res.status_code == 200
    assert 'automated_score' in verify_res.json()

    # Observation window
    obs_res = client.patch('/api/roadmap/observation_window', json={'window_months': 6, 'status': 'in_observation'})
    assert obs_res.status_code == 200
    assert obs_res.json()['window_months'] == 6

    # Roadmap export
    export_res = client.get('/api/roadmap/export')
    assert export_res.status_code == 200
    assert 'SOC 2 Type II Readiness Trajectory' in export_res.text


def test_trust_center_access_requests(client):
    req_res = client.post('/api/trust/request_access', json={
        'name': 'Auditor Bob',
        'email': 'bob@schellman.com',
        'company': 'Schellman & Co',
        'nda_signed': True
    })
    assert req_res.status_code == 200
    assert req_res.json()['status'] == 'approved'

    # List requests
    list_res = client.get('/api/trust/requests')
    assert list_res.status_code == 200
    items = list_res.json()['items']
    assert any(r['email'] == 'bob@schellman.com' for r in items)


def test_personnel_compliance_and_onboarding(client):
    person = create(client, 'people', title='Charlie Engineer', email='charlie@acme.com', status='active', training_completed=False)

    # Check compliance
    comp_res = client.get('/api/personnel/compliance')
    assert comp_res.status_code == 200

    # Complete training
    train_res = client.post(f"/api/personnel/{person['id']}/complete_training")
    assert train_res.status_code == 200
    assert train_res.json()['training_completed'] is True

    # Bulk accept policies
    bulk_res = client.post(f"/api/personnel/{person['id']}/accept_all_policies")
    assert bulk_res.status_code == 200
    assert len(bulk_res.json()['acknowledged_policy_ids']) >= 0
