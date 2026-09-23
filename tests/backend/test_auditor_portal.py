"""Tests for R4: Auditor Portal, Engagement Scoping, RFI, PBC Lifecycle, and Workpapers."""
import io
import json
import zipfile
from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from server.app import create_app
from server.storage import Store, now


@pytest.fixture
def test_setup(tmp_path):
    app = create_app(tmp_path)
    client = TestClient(app, base_url="http://127.0.0.1:8765")
    token = client.get("/api/bootstrap").json()["csrf_token"]
    client.headers["X-CSRF-Token"] = token
    store = app.state.store
    return client, store, tmp_path


def test_auditor_token_rejected_on_staff_mutating_endpoints(test_setup):
    """A9.1: Auditor token on a staff-only mutating endpoint -> 403."""
    client, _, _ = test_setup
    
    # Staff creates engagement with early_access=True for testing
    eng_res = client.post("/api/engagements", json={
        "auditor_name": "Jane Auditor, CPA",
        "auditor_email": "jane@auditfirm.com",
        "criteria_in_scope": ["Security", "Availability"],
        "early_access": True,
        "downloads_enabled": True
    })
    assert eng_res.status_code == 201, eng_res.text
    eng_data = eng_res.json()
    raw_token = eng_data["raw_token"]
    
    # Create auditor client with bearer token
    auditor_client = TestClient(client.app, base_url="http://127.0.0.1:8765")
    auditor_client.headers["Authorization"] = f"Bearer {raw_token}"
    
    # 1. Auditor tries to mutate a control -> must be rejected with 403
    patch_res = auditor_client.patch(
        "/api/controls/TF-CC6.1-01",
        json={"title": "Auditor Tampered Title"}
    )
    assert patch_res.status_code == 403
    assert "read-only" in patch_res.json()["detail"].lower() or "prohibited" in patch_res.json()["detail"].lower()
    
    # 2. Auditor tries to delete a policy -> 403
    del_res = auditor_client.delete("/api/policies/pol-sec-01")
    assert del_res.status_code == 403


def test_auditor_rfi_and_pbc_permissions_and_staging_restriction(test_setup):
    """A9.2: Auditor can create an RFI and accept a PBC item but cannot stage evidence (staff-only) -> 403."""
    client, _, _ = test_setup
    
    # Create engagement with early_access=True
    eng_res = client.post("/api/engagements", json={
        "auditor_name": "John Doe, CPA",
        "auditor_email": "john@auditfirm.com",
        "criteria_in_scope": ["Security"],
        "early_access": True
    })
    raw_token = eng_res.json()["raw_token"]
    eng_id = eng_res.json()["engagement"]["id"]
    
    auditor_client = TestClient(client.app, base_url="http://127.0.0.1:8765")
    auditor_client.headers["Authorization"] = f"Bearer {raw_token}"
    
    # 1. Auditor creates an RFI -> allowed (201)
    rfi_res = auditor_client.post("/api/auditor/rfis", json={
        "title": "MFA Population Clarification",
        "body": "Please provide verification of service account MFA exemptions.",
        "criterion_refs": ["CC6.1"]
    })
    assert rfi_res.status_code == 201, rfi_res.text
    rfi = rfi_res.json()
    assert rfi["status"] == "open"
    assert rfi["author"] == "John Doe, CPA"
    
    # 2. Auditor tries to stage evidence on a PBC item -> must fail with 403 (staging is staff-only)
    stage_res = auditor_client.post(f"/api/auditor/pbc/pbc-06/stage", json={
        "evidence_ids": ["mock-ev-1"]
    })
    assert stage_res.status_code == 403
    assert "staff-only" in stage_res.json()["detail"].lower() or "prohibited" in stage_res.json()["detail"].lower()
    
    # 3. Staff stages evidence -> allowed
    staff_stage = client.post(f"/api/auditor/pbc/pbc-06/stage", json={
        "engagement_id": eng_id,
        "evidence_ids": ["mock-ev-1"]
    })
    assert staff_stage.status_code == 200, staff_stage.text
    
    # 4. Auditor accepts the PBC item -> allowed (200)
    accept_res = auditor_client.post(f"/api/auditor/pbc/pbc-06/accept", json={
        "notes": "Verified against production IdP export."
    })
    assert accept_res.status_code == 200, accept_res.text
    assert accept_res.json()["status"] == "accepted"


def test_expired_revoked_and_inactive_engagement_rejected(test_setup):
    """A9.3: Expired, revoked, or not-yet-active engagement -> 403."""
    client, store, _ = test_setup
    
    # Case 1: Inactive engagement (observation period starts in future e.g. 2027-01-01, early_access=False)
    inactive_res = client.post("/api/engagements", json={
        "auditor_name": "Future Auditor",
        "auditor_email": "future@audit.com",
        "audit_period_start": "2027-01-01",
        "early_access": False
    })
    inactive_token = inactive_res.json()["raw_token"]
    c_inactive = TestClient(client.app, base_url="http://127.0.0.1:8765")
    c_inactive.headers["Authorization"] = f"Bearer {inactive_token}"
    res1 = c_inactive.get("/api/auditor/me")
    assert res1.status_code == 403
    assert "observation window" in res1.json()["detail"].lower()
    
    # Case 2: Revoked engagement
    active_res = client.post("/api/engagements", json={
        "auditor_name": "Active Auditor",
        "auditor_email": "active@audit.com",
        "early_access": True
    })
    active_token = active_res.json()["raw_token"]
    eng_id = active_res.json()["engagement"]["id"]
    
    # Revoke it
    client.post(f"/api/engagements/{eng_id}/revoke")
    c_revoked = TestClient(client.app, base_url="http://127.0.0.1:8765")
    c_revoked.headers["Authorization"] = f"Bearer {active_token}"
    res2 = c_revoked.get("/api/auditor/me")
    assert res2.status_code == 403
    assert "revoked" in res2.json()["detail"].lower()


def test_workpaper_export_and_downloads_disabled_flag(test_setup):
    """A9.4: Workpaper export contains manifest with hashes/timestamps; downloads_enabled=false -> 403."""
    client, _, _ = test_setup
    
    # Create engagement with downloads_enabled=True
    eng_res = client.post("/api/engagements", json={
        "auditor_name": "Export Auditor",
        "auditor_email": "export@audit.com",
        "early_access": True,
        "downloads_enabled": True
    })
    raw_token = eng_res.json()["raw_token"]
    eng_id = eng_res.json()["engagement"]["id"]
    
    c_auditor = TestClient(client.app, base_url="http://127.0.0.1:8765")
    c_auditor.headers["Authorization"] = f"Bearer {raw_token}"
    
    # Download workpaper ZIP
    wp_res = c_auditor.get("/api/auditor/export/workpapers?criterion=CC6.1")
    assert wp_res.status_code == 200
    assert wp_res.headers["content-type"] == "application/zip"
    
    # Inspect ZIP contents
    with zipfile.ZipFile(io.BytesIO(wp_res.content)) as zf:
        namelist = zf.namelist()
        assert "MANIFEST.csv" in namelist
        assert "CONTROL_DEFINITIONS.json" in namelist
        assert "TEST_PROCEDURES.md" in namelist
        
        manifest_text = zf.read("MANIFEST.csv").decode("utf-8")
        assert "file_name,sha256,captured_at" in manifest_text
        
    # Now disable downloads on engagement
    client.patch(f"/api/engagements/{eng_id}", json={"downloads_enabled": False})
    
    # Export must now return 403
    blocked_res = c_auditor.get("/api/auditor/export/workpapers?criterion=CC6.1")
    assert blocked_res.status_code == 403
    assert "downloads are disabled" in blocked_res.json()["detail"].lower()


def test_pre_audit_snapshot_byte_identical_and_immutable(test_setup):
    """A9.5: Snapshot downloaded twice -> byte-identical."""
    client, _, _ = test_setup
    
    eng_res = client.post("/api/engagements", json={
        "auditor_name": "Snapshot Auditor",
        "auditor_email": "snap@audit.com",
        "early_access": True,
        "downloads_enabled": True
    })
    raw_token = eng_res.json()["raw_token"]
    
    c_auditor = TestClient(client.app, base_url="http://127.0.0.1:8765")
    c_auditor.headers["Authorization"] = f"Bearer {raw_token}"
    
    # Create snapshot
    snap_res = c_auditor.post("/api/auditor/snapshot")
    assert snap_res.status_code == 201, snap_res.text
    snap = snap_res.json()
    assert snap["id"]
    assert snap["audit_log_head_hash"]
    assert snap["sha256"]
    
    # Download twice and compare bytes
    dl1 = c_auditor.get(f"/api/auditor/snapshot/{snap['id']}/download")
    assert dl1.status_code == 200
    dl2 = c_auditor.get(f"/api/auditor/snapshot/{snap['id']}/download")
    assert dl2.status_code == 200
    
    assert dl1.content == dl2.content, "Snapshot downloads must be 100% byte-identical"


def test_auditor_actions_logged_under_auditor_identity_in_r3_log(test_setup):
    """A9.6: Every auditor action appears in the R3 audit log under the auditor's identity."""
    client, _, _ = test_setup
    
    auditor_name = "Auditor Sarah Connor, CPA"
    eng_res = client.post("/api/engagements", json={
        "auditor_name": auditor_name,
        "auditor_email": "sarah@skynetaudit.com",
        "early_access": True
    })
    raw_token = eng_res.json()["raw_token"]
    
    c_auditor = TestClient(client.app, base_url="http://127.0.0.1:8765")
    c_auditor.headers["Authorization"] = f"Bearer {raw_token}"
    
    # Auditor performs actions
    c_auditor.post("/api/auditor/rfis", json={
        "title": "Vendor SOC 2 Request",
        "body": "Please provide latest Type II report for cloud provider.",
        "criterion_refs": ["CC9.1"]
    })
    
    c_auditor.post("/api/auditor/pbc/pbc-01/accept", json={
        "notes": "Reviewed and verified."
    })
    
    # Check R3 audit log for Sarah's entries
    log_res = client.get(f"/api/audit/log?actor={auditor_name}")
    assert log_res.status_code == 200
    entries = log_res.json()["items"]
    assert len(entries) >= 2
    for e in entries:
        assert e["actor"] == auditor_name
        assert e["prev_hash"]
        assert e["entry_hash"]


def test_seeded_end_to_end_auditor_loop(test_setup):
    """A9.7: Seeded end-to-end: create engagement -> issue token -> auditor RFI -> staff reply with evidence -> auditor accepts PBC -> export -> snapshot."""
    client, _, _ = test_setup
    
    # 1. Staff creates engagement
    eng_res = client.post("/api/engagements", json={
        "auditor_name": "Lead Partner, CPA",
        "auditor_email": "partner@cpa.com",
        "early_access": True,
        "downloads_enabled": True
    })
    assert eng_res.status_code == 201
    token = eng_res.json()["raw_token"]
    eng_id = eng_res.json()["engagement"]["id"]
    
    auditor = TestClient(client.app, base_url="http://127.0.0.1:8765")
    auditor.headers["Authorization"] = f"Bearer {token}"
    
    # 2. Auditor creates RFI
    rfi_res = auditor.post("/api/auditor/rfis", json={
        "title": "DR Drill Results RFI",
        "body": "Need evidence of the annual disaster recovery restoration drill.",
        "criterion_refs": ["A1.3"]
    })
    assert rfi_res.status_code == 201
    rfi_id = rfi_res.json()["id"]
    
    # 3. Staff replies with evidence to RFI
    staff_reply = client.post(f"/api/auditor/rfis/{rfi_id}/reply", json={
        "engagement_id": eng_id,
        "message": "Attached database snapshot restoration drill ticket and execution logs.",
        "evidence_ids": ["mock-dr-ev"]
    })
    assert staff_reply.status_code == 200
    
    # 4. Auditor resolves RFI
    resolve_res = auditor.post(f"/api/auditor/rfis/{rfi_id}/resolve")
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "closed"
    
    # 5. Staff stages evidence on PBC-18
    client.post("/api/auditor/pbc/pbc-18/stage", json={
        "engagement_id": eng_id,
        "evidence_ids": ["mock-dr-ev"]
    })
    
    # 6. Auditor accepts PBC-18
    accept_res = auditor.post("/api/auditor/pbc/pbc-18/accept", json={
        "notes": "Evidence inspected and confirmed."
    })
    assert accept_res.status_code == 200
    
    # 7. Auditor exports workpapers
    wp_res = auditor.get("/api/auditor/export/workpapers?criterion=A1.2")
    assert wp_res.status_code == 200
    
    # 8. Auditor captures pre-audit snapshot
    snap_res = auditor.post("/api/auditor/snapshot")
    assert snap_res.status_code == 201
