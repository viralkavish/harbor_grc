import io
import json
import sqlite3
import urllib.request
from unittest.mock import MagicMock
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

    # Check CC6.1
    mfa = next((r for r in data['results'] if r['control_code'] in ('CC6.1-MFA', 'CC6.1')), None)
    assert mfa is not None
    assert mfa['verdict'] == 'compatible'
    assert mfa['score'] >= 0.90
    assert len(mfa['matched_excerpts']) > 0
    assert mfa['decided_by'] == 'rubric-fallback'
    assert mfa['confidence'] is None
    assert mfa['heuristic_score'] >= 0.90

    # Check CC6.4
    recert = next((r for r in data['results'] if r['control_code'] in ('CC6.4-RECERT', 'CC6.4')), None)
    assert recert is not None
    assert recert['verdict'] == 'compatible'

    # Check CC6.3
    revoke = next((r for r in data['results'] if r['control_code'] in ('CC6.3-REVOKE', 'CC6.3')), None)
    assert revoke is not None
    assert revoke['verdict'] == 'compatible'


def test_jev_conflict_detection(client: TestClient):
    res = client.post('/api/jev/evaluate', json={
        'title': 'Insecure Policy',
        'content': SAMPLE_CONFLICTING_POLICY
    })
    assert res.status_code == 200
    data = res.json()
    mfa = next((r for r in data['results'] if r['control_code'] in ('CC6.1-MFA', 'CC6.1')), None)
    assert mfa is not None
    assert mfa['verdict'] == 'conflict'
    assert len(mfa['gaps']) > 0
    assert len(mfa['recommendations']) > 0
    assert mfa['decided_by'] == 'rubric-fallback'
    assert mfa['confidence'] is None
    assert mfa['heuristic_score'] is not None


def test_jev_gap_detection(client: TestClient):
    res = client.post('/api/jev/evaluate', json={
        'title': 'Vague Review Policy',
        'content': SAMPLE_GAP_POLICY
    })
    assert res.status_code == 200
    data = res.json()
    recert = next((r for r in data['results'] if r['control_code'] in ('CC6.4-RECERT', 'CC6.4')), None)
    assert recert is not None
    assert recert['verdict'] == 'gap'
    assert len(recert['recommendations']) > 0
    assert recert['decided_by'] == 'rubric-fallback'
    assert recert['confidence'] is None
    assert recert['heuristic_score'] is not None


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
    policies_res = client.get('/api/policies')
    assert policies_res.status_code == 200
    policies = policies_res.json()['items']
    assert len(policies) > 0
    test_policy = policies[0]

    link_res = client.post(
        f"/api/jev/policies/{test_policy['id']}/link_compatible",
        json={'control_ids': ['ctl-01', 'ctl-04']}
    )
    assert link_res.status_code == 200
    link_data = link_res.json()
    assert 'ctl-01' in link_data['linked_control_ids']
    assert 'ctl-04' in link_data['linked_control_ids']


def test_jev_status_and_test_key(client: TestClient):
    status_res = client.get('/api/jev/status')
    assert status_res.status_code == 200
    status = status_res.json()
    assert status['status'] == 'operational'
    assert status['provider'] == 'TypeSafe JEV System One'
    assert status['model'] == 'jev-1.13.0'
    assert status['pinned_model'] == 'jev-1.13.0'
    assert 'key_preview' not in status  # 19-char preview removed
    assert status['rubrics_count'] >= 7

    test_res = client.post(
        '/api/jev/test_key',
        json={'api_key': 'jev_live_sec_test_token_12345', 'endpoint': 'https://api.typesafe.ai/v1'}
    )
    assert test_res.status_code == 200
    res_data = test_res.json()
    assert res_data['valid'] is True
    assert res_data['model'] == 'jev-1.13.0'
    assert res_data['masked_key'] == '...2345'
    assert 'key_preview' not in res_data
    assert res_data['rubrics_count'] >= 7
    assert 'latency_ms' in res_data


def test_live_typesafe_answers_drive_verdicts_and_model_pinned(client: TestClient, monkeypatch):
    """B1 & B2 & B6: Assert live answers drive verdict, model jev-1.13.0 is pinned, and real confidence returned."""
    # Configure key
    client.patch('/api/workspace', json={'jev_api_key': 'apikey_mock_secret_key_9999'})

    captured_requests = []

    def mock_urlopen(req, timeout=8):
        body = json.loads(req.data.decode('utf-8'))
        captured_requests.append(body)
        mock_resp = MagicMock()
        mock_payload = {
            "model": "jev-1.13.0",
            "answers": {
                "q_CC6_1_MFA": {
                    "type": "choice",
                    "choice": "gap",  # Live TypeSafe returns GAP despite strong wording!
                    "confidence": 0.89,
                    "reasoning": "Live TypeSafe detected gap in MFA emergency access break-glass procedures."
                }
            },
            "usage": {"input_tokens": 120, "output_tokens": 45}
        }
        mock_resp.read.return_value = json.dumps(mock_payload).encode('utf-8')
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)

    res = client.post('/api/jev/evaluate', json={
        'title': 'Access Policy',
        'content': SAMPLE_ACCESS_POLICY
    })
    assert res.status_code == 200
    data = res.json()

    # Assert model was pinned to jev-1.13.0 in request to TypeSafe
    assert len(captured_requests) > 0
    assert captured_requests[0]["model"] == "jev-1.13.0"

    # Assert CC6.1 verdict was driven by live answer (gap, NOT compatible)
    mfa = next((r for r in data['results'] if r['control_code'] in ('CC6.1-MFA', 'CC6.1')), None)
    assert mfa is not None
    assert mfa['verdict'] == 'gap'
    assert mfa['decided_by'] == 'jev-live'
    assert mfa['confidence'] == 0.89
    assert mfa['heuristic_score'] is None
    assert "break-glass" in mfa['summary']


def test_key_security_no_full_key_exposure(client: TestClient):
    """B4: Never include full key in /bootstrap, PATCH /workspace, or any GET response."""
    raw_key = 'apikey_ultra_confidential_9876543210zyxw'
    patch_res = client.patch('/api/workspace', json={'jev_api_key': raw_key})
    assert patch_res.status_code == 200
    patch_data = patch_res.json()
    assert raw_key not in json.dumps(patch_data)
    assert patch_data['api_key_configured'] is True
    assert patch_data['masked_key'] == '...zyxw'

    boot_res = client.get('/api/bootstrap')
    assert boot_res.status_code == 200
    boot_data = boot_res.json()
    assert raw_key not in json.dumps(boot_data)
    assert boot_data['workspace']['api_key_configured'] is True
    assert boot_data['workspace']['masked_key'] == '...zyxw'

    get_res = client.get('/api/workspace')
    assert raw_key not in json.dumps(get_res.json())

    status_res = client.get('/api/jev/status')
    assert raw_key not in json.dumps(status_res.json())
    assert status_res.json()['masked_key'] == '...zyxw'


def test_at_rest_encryption_in_sqlite(client: TestClient, tmp_path):
    """B4: Assert key is encrypted at rest using Fernet and never stored as plaintext in SQLite."""
    raw_key = 'apikey_secret_at_rest_verification_token_4321'
    client.patch('/api/workspace', json={'jev_api_key': raw_key})

    db_path = tmp_path / 'harbor.db'
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT value FROM settings WHERE key='workspace'")
    row = cur.fetchone()
    stored_json_str = row[0]
    conn.close()

    # Plaintext key MUST NOT exist in SQLite database string
    assert raw_key not in stored_json_str
    # Stored key MUST be Fernet token prefixed with enc:
    stored_ws = json.loads(stored_json_str)
    assert stored_ws['jev_api_key'].startswith('enc:')
