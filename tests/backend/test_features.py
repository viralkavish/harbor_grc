"""Integration tests for all newly added endpoints and operations."""
import io
import json
import zipfile
import pytest
from conftest import create


def test_dashboard_and_search_endpoints(client):
    dash = client.get('/api/dashboard')
    assert dash.status_code == 200
    data = dash.json()
    assert 'counts' in data
    assert 'readiness' in data
    assert 'framework_readiness' in data
    assert 'open_risks' in data
    assert 'risk_matrix' in data
    assert 'attention' in data
    assert len(data['risk_matrix']) == 25  # 5x5 matrix

    # Search
    search = client.get('/api/search', params={'q': 'Security'})
    assert search.status_code == 200
    results = search.json()['results']
    assert len(results) > 0
    assert any('Security' in r['title'] or 'Security' in r['snippet'] for r in results)


def test_policy_publishing_versioning_and_export(client):
    policy = create(client, 'policies', title='Data Retention', content='# Retention Policy\nRetain for 7 years.')
    assert policy['status'] == 'draft'
    assert policy['version'] == 1

    # Publish policy
    res = client.post(f"/api/policies/{policy['id']}/publish", json={'approver': 'Chief Security Officer'})
    assert res.status_code == 200
    published = res.json()
    assert published['status'] == 'published'
    assert published['approver'] == 'Chief Security Officer'
    assert published['approved_at'] is not None

    # Update content -> should demote to draft and bump version
    updated = client.patch(f"/api/policies/{policy['id']}", json={'content': '# Retention Policy v2\nRetain for 10 years.'})
    assert updated.status_code == 200
    v2 = updated.json()
    assert v2['status'] == 'draft'
    assert v2['version'] == 2

    # Verify versions endpoint
    versions = client.get(f"/api/policies/{policy['id']}/versions").json()
    assert versions['total'] >= 1
    assert any(v['version'] == 1 for v in versions['items'])

    # Export markdown
    export = client.get(f"/api/policies/{policy['id']}/export")
    assert export.status_code == 200
    assert 'text/markdown' in export.headers['content-type']
    assert '# Data Retention' in export.text


def test_evidence_upload_and_download(client):
    content = b"Mock Audit Evidence Report\nHash: abc123xyz"
    files = {'file': ('evidence_2026.txt', io.BytesIO(content), 'text/plain')}
    data = {
        'title': 'Firewall Audit Report',
        'description': 'Annual configuration audit',
        'period_covered': json.dumps({'start': '2027-01-01', 'end': '2027-12-31'})
    }

    upload_res = client.post('/api/evidence/upload', files=files, data=data)
    assert upload_res.status_code == 201
    evidence = upload_res.json()
    assert evidence['title'] == 'Firewall Audit Report'
    assert evidence['file_size'] == len(content)
    assert evidence['sha256'] is not None
    assert evidence['filename'] == 'evidence_2026.txt'

    # Download file
    download_res = client.get(f"/api/evidence/{evidence['id']}/file")
    assert download_res.status_code == 200
    assert download_res.content == content
    assert download_res.headers['x-content-type-options'] == 'nosniff'


def test_monitoring_checks_and_run(client):
    get_res = client.get('/api/monitoring')
    assert get_res.status_code == 200
    data = get_res.json()
    assert 'checks' in data
    assert len(data['checks']) == 7

    # Run monitoring
    run_res = client.post('/api/monitoring/run')
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data['last_run'] is not None
    assert any(c['id'] == 'unassigned_controls' for c in run_data['checks'])


def test_csv_export_and_import(client):
    # Export vendors
    create(client, 'vendors', title='Cloudflare Inc', website='https://cloudflare.com', tier='critical')
    export_res = client.get('/api/export/vendors')
    assert export_res.status_code == 200
    assert 'text/csv' in export_res.headers['content-type']
    assert 'Cloudflare Inc' in export_res.text

    # Formula injection safety check
    create(client, 'vendors', title='=cmd|/c calc!A0', website='https://example.com')
    export_unsafe = client.get('/api/export/vendors')
    assert "'=cmd|/c calc!A0" in export_unsafe.text

    # Import vendors dry run
    csv_data = "title,website,tier,category\nAcme Hosting,https://acme.com,medium,Hosting\n"
    files = {'file': ('vendors.csv', io.BytesIO(csv_data.encode('utf-8')), 'text/csv')}
    dry_res = client.post('/api/import/vendors', files=files, data={'dry_run': 'true'})
    assert dry_res.status_code == 200
    assert dry_res.json()['imported'] == 0
    assert len(dry_res.json()['preview']) == 1

    # Actual import
    files2 = {'file': ('vendors.csv', io.BytesIO(csv_data.encode('utf-8')), 'text/csv')}
    import_res = client.post('/api/import/vendors', files=files2, data={'dry_run': 'false'})
    assert import_res.status_code == 200
    assert import_res.json()['imported'] == 1

    # Invalid import row -> 422
    bad_csv = "title,website,tier\n,https://acme.com,invalid_tier\n"
    files3 = {'file': ('bad.csv', io.BytesIO(bad_csv.encode('utf-8')), 'text/csv')}
    bad_res = client.post('/api/import/vendors', files=files3, data={'dry_run': 'false'})
    assert bad_res.status_code == 422


def test_backup_and_audit_exports(client):
    # Backup ZIP
    backup_res = client.get('/api/backup')
    assert backup_res.status_code == 200
    assert backup_res.headers['content-type'] == 'application/zip'
    with zipfile.ZipFile(io.BytesIO(backup_res.content)) as zf:
        names = zf.namelist()
        assert 'manifest.json' in names
        assert 'harbor.db' in names

    # Audit export
    audit = create(client, 'audits', title='SOC 2 2026 Audit', auditor='A-LIGN')
    audit_res = client.get(f"/api/audits/{audit['id']}/export")
    assert audit_res.status_code == 200
    with zipfile.ZipFile(io.BytesIO(audit_res.content)) as zf:
        names = zf.namelist()
        assert 'manifest.json' in names
        assert 'AUDIT_DOSSIER.md' in names


def test_integrations_catalog(client):
    res = client.get('/api/integrations')
    assert res.status_code == 200
    items = res.json()['items']
    available = [i for i in items if i['status'] == 'available']
    not_impl = [i for i in items if i['status'] == 'not_implemented']
    assert len(available) >= 2  # CSV & uploads
    assert len(not_impl) >= 4   # Google, AWS, GitHub, Slack
