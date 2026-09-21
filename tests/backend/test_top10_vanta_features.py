"""Tests for the Top 10 Advanced Vanta & SOC 2 Platform Features Suite."""

import pytest
from fastapi.testclient import TestClient


def test_top10_features_suite(client: TestClient):
    # 1. Remediation Snippets
    snips_res = client.get('/api/tests/remediation_snippets')
    assert snips_res.status_code == 200
    snippets = snips_res.json()
    assert 'test_disk_encryption' in snippets
    assert 'test_host_firewall' in snippets
    assert 'snippet' in snippets['test_disk_encryption']

    # 2. Vendor SOC 2 & CUEC Extractor
    vendor_res = client.post('/api/vendors/analyze_soc2', json={
        'name': 'Amazon Web Services (AWS)',
        'category': 'Cloud Infrastructure',
        'has_soc2': True,
        'data_sensitivity': 'customer_pii'
    })
    assert vendor_res.status_code == 200
    v_data = vendor_res.json()
    assert v_data['risk_tier'] == 'critical'
    assert len(v_data['cuecs']) >= 4
    assert len(v_data['csocs']) >= 3
    assert 'Unqualified' in v_data['report_opinion']

    # 3. Auditor Autopilot Workspace & PBC Items
    hub_res = client.get('/api/auditor_hub')
    assert hub_res.status_code == 200
    hub = hub_res.json()
    assert hub['total_items'] == 21
    assert hub['accepted_count'] >= 15
    assert hub['readiness_percent'] > 70.0

    # Patch PBC item
    patch_pbc = client.patch('/api/auditor_hub/items/pbc-03', json={
        'status': 'accepted',
        'notes': 'Auditor verified 5 sample user provisioning tickets.'
    })
    assert patch_pbc.status_code == 200
    assert patch_pbc.json()['status'] == 'accepted'

    # 4. Cross-Framework Harmonization & Overlap Engine
    harm_res = client.get('/api/frameworks/harmonization')
    assert harm_res.status_code == 200
    harm = harm_res.json()
    assert 'framework_coverage' in harm
    assert 'ISO27001' in harm['framework_coverage']
    assert 'NIST-CSF' in harm['framework_coverage']
    assert harm['framework_coverage']['HIPAA']['coverage_pct'] > 70.0

    # 5. Policy-Grounded Security Questionnaire AI Auto-Fill
    q_res = client.post('/api/questionnaires/auto_fill', json={
        'questions': [
            'Do you enforce Multi-Factor Authentication (MFA) for all employees?',
            'How is customer data encrypted in transit and at rest?'
        ]
    })
    assert q_res.status_code == 200
    q_data = q_res.json()
    assert len(q_data['answers']) == 2
    assert q_data['answers'][0]['confidence_score'] >= 0.90
    assert 'CC6.1' in q_data['answers'][0]['source_citation']

    # 6. Quarterly User Access Review (UAR) Campaign Engine
    uar_res = client.post('/api/access_reviews/campaign', json={
        'name': 'Q3 2026 Access Review',
        'reviewer': 'CISO Alex'
    })
    assert uar_res.status_code == 200
    uar = uar_res.json()
    assert uar['status'] == 'certified'
    assert 'certification_hash' in uar

    latest_uar = client.get('/api/access_reviews/campaign/latest')
    assert latest_uar.status_code == 200
    assert latest_uar.json()['name'] is not None

    # 7. Workforce Device Posture & Training Certificate
    # First get people
    people_res = client.get('/api/people')
    assert people_res.status_code == 200
    people = people_res.json()['items']
    if people:
        p_id = people[0]['id']
        cert_res = client.get(f'/api/personnel/certificates/{p_id}')
        assert cert_res.status_code == 200
        cert = cert_res.json()
        assert 'certificate_id' in cert
        assert cert['passing_score'] == '100%'

    # 8. Vulnerability Management & Patch SLA Countdown Tracker
    vuln_res = client.get('/api/vulnerabilities')
    assert vuln_res.status_code == 200
    vulns = vuln_res.json()
    assert vulns['total'] >= 3
    assert 'critical' in vulns['sla_rules']

    # Add a vulnerability
    new_vuln = client.post('/api/vulnerabilities', json={
        'cve_id': 'CVE-2026-9999',
        'title': 'Test Vulnerability for SLA Tracking',
        'severity': 'high',
        'cvss': 7.8,
        'component': 'Test Service'
    })
    assert new_vuln.status_code == 200
    assert new_vuln.json()['sla_days'] == 30

    # 9. AI Governance & Model Inventory Register (ISO 42001 / EU AI Act)
    ai_res = client.get('/api/ai_governance/models')
    assert ai_res.status_code == 200
    ai_data = ai_res.json()
    assert ai_data['total_models'] >= 2
    assert ai_data['zero_data_retention_enforced'] is True

    add_ai = client.post('/api/ai_governance/models', json={
        'model_name': 'Claude 3.7 Sonnet',
        'provider': 'Anthropic',
        'use_case': 'Code Review & Security Analysis',
        'risk_tier': 'Minimal Risk (EU AI Act)'
    })
    assert add_ai.status_code == 200
    assert add_ai.json()['model_name'] == 'Claude 3.7 Sonnet'

    # 10. Live Telemetry Trust Center
    telemetry_res = client.get('/api/trust/telemetry')
    assert telemetry_res.status_code == 200
    telemetry = telemetry_res.json()
    assert telemetry['passing_controls'] >= 1
    assert 'SOC 2 Type II' in telemetry['certifications_active']
