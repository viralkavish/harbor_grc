import io
import pytest
from starlette.testclient import TestClient


SAMPLE_ACCESS_POLICY = """# Access Control & Authentication Policy

## 1. Multi-Factor Authentication
Multi-Factor Authentication (MFA) is strictly mandatory for all workforce accounts, administrative consoles, and remote cloud infrastructure. Workforce members must use approved TOTP authenticator apps or FIDO2 hardware keys.

## 2. Access Provisioning
All new user accounts require formal manager approval prior to provisioning. Access privileges adhere strictly to the principle of least privilege and role-based access control (RBAC).

## 3. Account Deprovisioning
Upon personnel separation or employee termination, IT must revoke and deactivate all user credentials within 24 hours of notice.

## 4. Quarterly Access Recertification
Management conducts quarterly access reviews across all production environments and customer databases. Managers must record formal keep or revoke determinations for each entitlement.
"""

SAMPLE_CONFLICTING_POLICY = """# Insecure Authentication Policy
Multi-factor authentication (MFA) is optional and left to user discretion.
Administrators may use single-factor passwords for convenience.
"""

SAMPLE_GAP_POLICY = """# High-Level Review Policy
We believe in reviewing user access periodically.
User access reviews are conducted by team leads as needed.
"""


def test_jev_evaluate_policy_content(client: TestClient):
    res = client.post('/api/jev/evaluate', json={
        'title': 'Test Access Policy',
        'content': SAMPLE_ACCESS_POLICY
    })
    assert res.status_code == 200
    data = res.json()
    assert 'summary' in data
    assert 'results' in data
    assert data['summary']['compatible_count'] >= 3

    # Check CC6.1-MFA
    mfa = next((r for r in data['results'] if r['control_code'] == 'CC6.1-MFA'), None)
    assert mfa is not None
    assert mfa['verdict'] == 'compatible'
    assert mfa['score'] >= 0.90
    assert len(mfa['matched_excerpts']) > 0

    # Check CC6.4-RECERT
    recert = next((r for r in data['results'] if r['control_code'] == 'CC6.4-RECERT'), None)
    assert recert is not None
    assert recert['verdict'] == 'compatible'

    # Check CC6.3-REVOKE
    revoke = next((r for r in data['results'] if r['control_code'] == 'CC6.3-REVOKE'), None)
    assert revoke is not None
    assert revoke['verdict'] == 'compatible'


def test_jev_conflict_detection(client: TestClient):
    res = client.post('/api/jev/evaluate', json={
        'title': 'Insecure Policy',
        'content': SAMPLE_CONFLICTING_POLICY
    })
    assert res.status_code == 200
    data = res.json()
    mfa = next((r for r in data['results'] if r['control_code'] == 'CC6.1-MFA'), None)
    assert mfa is not None
    assert mfa['verdict'] == 'conflict'
    assert len(mfa['gaps']) > 0
    assert len(mfa['recommendations']) > 0


def test_jev_gap_detection(client: TestClient):
    res = client.post('/api/jev/evaluate', json={
        'title': 'Vague Review Policy',
        'content': SAMPLE_GAP_POLICY
    })
    assert res.status_code == 200
    data = res.json()
    recert = next((r for r in data['results'] if r['control_code'] == 'CC6.4-RECERT'), None)
    assert recert is not None
    assert recert['verdict'] == 'gap'
    assert len(recert['recommendations']) > 0


def test_jev_upload_and_evaluate(client: TestClient):
    file_bytes = io.BytesIO(SAMPLE_ACCESS_POLICY.encode('utf-8'))
    res = client.post(
        '/api/jev/upload_and_evaluate',
        files={'file': ('company_access_policy.md', file_bytes, 'text/markdown')}
    )
    assert res.status_code == 200
    data = res.json()
    assert data['filename'] == 'company_access_policy.md'
    assert data['summary']['compatible_count'] >= 3


def test_jev_link_compatible_controls(client: TestClient):
    # Fetch existing policies
    policies_res = client.get('/api/policies')
    assert policies_res.status_code == 200
    policies = policies_res.json()['items']
    assert len(policies) > 0
    test_policy = policies[0]

    # Link controls ctl-01 and ctl-04
    link_res = client.post(
        f"/api/jev/policies/{test_policy['id']}/link_compatible",
        json={'control_ids': ['ctl-01', 'ctl-04']}
    )
    assert link_res.status_code == 200
    link_data = link_res.json()
    assert 'ctl-01' in link_data['linked_control_ids']
    assert 'ctl-04' in link_data['linked_control_ids']
