"""Tests for R2: Evidence Vault Hardening, Provenance, Versioning, and Integrity."""
import io
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from server.app import create_app
from server.storage import Store


@pytest.fixture
def test_setup(tmp_path):
    app = create_app(tmp_path)
    client = TestClient(app, base_url="http://127.0.0.1:8765")
    token = client.get("/api/bootstrap").json()["csrf_token"]
    client.headers["X-CSRF-Token"] = token
    store = app.state.store
    return client, store, tmp_path


def test_hash_stored_equals_disk_recomputed(test_setup):
    """E7.1: Hash stored at capture equals a recomputed hash of the file on disk."""
    client, store, _ = test_setup
    file_content = b"Evidence Payload: Okta MFA Enforcement Report Q1 2027"
    
    res = client.post(
        "/api/evidence/upload",
        files={"file": ("okta_mfa_q1.txt", io.BytesIO(file_content), "text/plain")},
        data={
            "title": "Okta MFA Configuration",
            "control_ids": json.dumps(["TF-CC6.1-01"]),
            "period_covered": json.dumps({"start": "2027-01-01", "end": "2027-03-31"}),
            "source_system": "okta",
            "collection_method": "automated"
        }
    )
    assert res.status_code == 201, res.text
    ev = res.json()
    assert ev["sha256"]
    assert ev["version"] == 1
    assert ev["captured_at"]
    assert ev["integrity_status"] == "unchecked"
    assert ev["period_covered"] == {"start": "2027-01-01", "end": "2027-03-31"}
    
    # Verify file on disk
    upload_file = store.uploads / f"{ev['id']}_{ev['filename']}"
    assert upload_file.exists()
    import hashlib
    disk_hash = hashlib.sha256(upload_file.read_bytes()).hexdigest()
    assert ev["sha256"] == disk_hash


def test_reupload_creates_v2_v1_immutable_and_versions_chain(test_setup):
    """E7.2: Re-upload with supersedes_id creates v2; v1 metadata PATCH -> 409; /versions returns the chain."""
    client, _, _ = test_setup
    
    # 1. Upload initial version (v1)
    res1 = client.post(
        "/api/evidence/upload",
        files={"file": ("firewall_rules_v1.json", io.BytesIO(b'{"rules": [80, 443]}'), "application/json")},
        data={
            "title": "Production Firewall Ingress Rules",
            "control_ids": json.dumps(["TF-CC6.6-01"]),
            "period_covered": json.dumps({"start": "2027-01-01", "end": "2027-01-31"}),
            "source_system": "aws-config"
        }
    )
    assert res1.status_code == 201, res1.text
    ev1 = res1.json()
    assert ev1["version"] == 1
    
    # 2. Re-upload with supersedes_id -> creates v2
    res2 = client.post(
        "/api/evidence/upload",
        files={"file": ("firewall_rules_v2.json", io.BytesIO(b'{"rules": [443]}'), "application/json")},
        data={
            "title": "Production Firewall Ingress Rules (Hardened)",
            "control_ids": json.dumps(["TF-CC6.6-01"]),
            "period_covered": json.dumps({"start": "2027-02-01", "end": "2027-02-28"}),
            "source_system": "aws-config",
            "supersedes_id": ev1["id"]
        }
    )
    assert res2.status_code == 201, res2.text
    ev2 = res2.json()
    assert ev2["version"] == 2
    assert ev2["supersedes_id"] == ev1["id"]
    
    # 3. Attempt to mutate v1 metadata -> must return 409 Conflict
    patch_res = client.patch(f"/api/evidence/{ev1['id']}", json={"title": "Unauthorized Mutation of v1"})
    assert patch_res.status_code == 409, patch_res.text
    
    # 4. Check /versions endpoint returns the full chain (oldest -> newest)
    v_res = client.get(f"/api/evidence/{ev2['id']}/versions")
    assert v_res.status_code == 200, v_res.text
    chain = v_res.json()["versions"]
    assert len(chain) == 2
    assert chain[0]["id"] == ev1["id"]
    assert chain[0]["version"] == 1
    assert chain[1]["id"] == ev2["id"]
    assert chain[1]["version"] == 2
    
    # Deleting v1 (non-head) must fail with 409
    del_v1 = client.delete(f"/api/evidence/{ev1['id']}")
    assert del_v1.status_code == 409


def test_tamper_detection_and_safe_download(test_setup):
    """E7.3: Tamper test: flip one byte of the stored file, call verify -> integrity_status=failed, download returns 500."""
    client, store, _ = test_setup
    
    res = client.post(
        "/api/evidence/upload",
        files={"file": ("audit_log_sample.csv", io.BytesIO(b"timestamp,actor,action\n2027-01-01,sec,login"), "text/csv")},
        data={
            "title": "Central Audit Log Export",
            "control_ids": json.dumps(["TF-CC7.3-01"]),
            "period_covered": json.dumps({"start": "2027-01-01", "end": "2027-01-15"})
        }
    )
    assert res.status_code == 201, res.text
    ev = res.json()
    
    # 1. Normal verify passes
    ver_res1 = client.post(f"/api/evidence/{ev['id']}/verify")
    assert ver_res1.status_code == 200
    assert ver_res1.json()["integrity_status"] == "verified"
    
    # 2. Tamper with the file on disk (flip bytes)
    upload_file = store.uploads / f"{ev['id']}_{ev['filename']}"
    raw_data = bytearray(upload_file.read_bytes())
    raw_data[0] = ord('X')  # Tamper with byte
    upload_file.write_bytes(bytes(raw_data))
    
    # 3. Verify must report failed
    ver_res2 = client.post(f"/api/evidence/{ev['id']}/verify")
    assert ver_res2.status_code == 200
    assert ver_res2.json()["integrity_status"] == "failed"
    
    # 4. Download endpoint must refuse to serve tampered file and return 500
    dl_res = client.get(f"/api/evidence/{ev['id']}/file")
    assert dl_res.status_code == 500


def test_legal_hold_blocks_deletion(test_setup):
    """E7.4: legal_hold=true -> DELETE -> 409."""
    client, _, _ = test_setup
    
    res = client.post(
        "/api/evidence/upload",
        files={"file": ("incident_brief.pdf", io.BytesIO(b"%PDF-1.4 simulated incident report"), "application/pdf")},
        data={
            "title": "Incident Severity 1 RCA",
            "control_ids": json.dumps(["TF-CC7.4-01"]),
            "period_covered": json.dumps({"start": "2027-02-01", "end": "2027-02-05"}),
            "legal_hold": "true"
        }
    )
    assert res.status_code == 201
    ev = res.json()
    assert ev["legal_hold"] is True
    
    # Deleting under legal hold must return 409 Conflict
    del_res = client.delete(f"/api/evidence/{ev['id']}")
    assert del_res.status_code == 409, del_res.text
    assert "legal hold" in del_res.json()["detail"].lower()


def test_observation_window_coverage_and_gaps(test_setup):
    """E7.5: Coverage endpoint returns correct gaps for seeded data (two non-contiguous covered periods)."""
    client, _, _ = test_setup
    cid = "TF-CC6.4-01"  # Quarterly user access reviews
    
    # Period 1: Jan 1 to Jan 31
    client.post(
        "/api/evidence/upload",
        files={"file": ("uar_jan.pdf", io.BytesIO(b"UAR Jan"), "application/pdf")},
        data={
            "title": "UAR January 2027",
            "control_ids": json.dumps([cid]),
            "period_covered": json.dumps({"start": "2027-01-01", "end": "2027-01-31"})
        }
    )
    
    # Period 2: Mar 1 to Mar 31 (Feb is an explicit gap!)
    client.post(
        "/api/evidence/upload",
        files={"file": ("uar_mar.pdf", io.BytesIO(b"UAR Mar"), "application/pdf")},
        data={
            "title": "UAR March 2027",
            "control_ids": json.dumps([cid]),
            "period_covered": json.dumps({"start": "2027-03-01", "end": "2027-03-31"})
        }
    )
    
    # Query coverage for Q1 (Jan 1 to Mar 31)
    cov_res = client.get(f"/api/evidence/coverage?control_id={cid}&window_start=2027-01-01&window_end=2027-03-31")
    assert cov_res.status_code == 200, cov_res.text
    cov = cov_res.json()
    
    assert cov["control_id"] == cid
    assert cov["window_start"] == "2027-01-01"
    assert cov["window_end"] == "2027-03-31"
    assert cov["is_fully_covered"] is False
    assert len(cov["covered_ranges"]) == 2
    assert cov["covered_ranges"][0] == {"start": "2027-01-01", "end": "2027-01-31"}
    assert cov["covered_ranges"][1] == {"start": "2027-03-01", "end": "2027-03-31"}
    
    # Gaps must include Feb 1 to Feb 28
    assert len(cov["gaps"]) == 1
    assert cov["gaps"][0]["start"] == "2027-02-01"
    assert cov["gaps"][0]["end"] == "2027-02-28"
    assert cov["gaps"][0]["days"] == 28


def test_upload_without_period_covered_rejected(test_setup):
    """E7.6: Upload without period_covered -> 422."""
    client, _, _ = test_setup
    
    res = client.post(
        "/api/evidence/upload",
        files={"file": ("undated_file.txt", io.BytesIO(b"No period covered"), "text/plain")},
        data={
            "title": "Undated Artifact",
            "control_ids": json.dumps(["TF-CC1.1-01"])
        }
    )
    assert res.status_code == 422, res.text
    assert "period_covered" in res.text
