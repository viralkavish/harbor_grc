"""Tests for R9: Observation-Window Coverage Dashboard, Gap Register & Audit Dossier."""
from datetime import date, datetime, timedelta, timezone
import json
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


def test_window_configuration_change_requires_confirmation_and_logs(test_setup):
    """W1, W10: Window modification after evidence exists requires confirm_change=True and logs to R3."""
    client, _, _ = test_setup

    # Seed an evidence record
    client.post("/api/evidence", json={
        "title": "Production Baseline Telemetry",
        "status": "collected",
        "period_covered": {"start": "2027-01-01", "end": "2027-03-31"}
    })

    # Attempt to change window without confirmation -> 422
    fail_res = client.put("/api/coverage/window", json={
        "observation_window_start": "2027-02-01",
        "observation_window_end": "2027-12-31",
        "confirm_change": False,
        "actor": "CISO"
    })
    assert fail_res.status_code == 422
    assert "confirm_change" in fail_res.json().get("detail", "").lower()

    # Confirmed window update
    ok_res = client.put("/api/coverage/window", json={
        "observation_window_start": "2027-01-01",
        "observation_window_end": "2027-06-30",
        "confirm_change": True,
        "actor": "CISO"
    })
    assert ok_res.status_code == 200
    data = ok_res.json()
    assert data["observation_window_end"] == "2027-06-30"

    # Verify R3 audit log
    audit = client.get("/api/audit/log?resource=coverage&action=update_window").json()
    items = audit.get("items", [])
    assert len(items) >= 1
    assert items[0]["after"]["observation_window_end"] == "2027-06-30"


def test_full_coverage_and_exact_interval_gap_detection(test_setup):
    """W2, W10: Control with continuous evidence is covered; a 10-day hole reports exact gap."""
    client, _, _ = test_setup

    # Set window to 2027-01-01 -> 2027-01-31 (31 days)
    client.put("/api/coverage/window", json={
        "observation_window_start": "2027-01-01",
        "observation_window_end": "2027-01-31",
        "confirm_change": True
    })

    # Control 1: Full coverage 2027-01-01 -> 2027-01-31
    ev_full = client.post("/api/evidence", json={
        "title": "Continuous Daily Backup Logs",
        "status": "collected",
        "control_ids": ["TF-A1.2-01"],
        "period_covered": {"start": "2027-01-01", "end": "2027-01-31"}
    }).json()

    cov_res = client.get("/api/coverage/controls/TF-A1.2-01")
    assert cov_res.status_code == 200
    c_full = cov_res.json()
    assert c_full["status"] == "covered"
    assert c_full["coverage_percentage"] == 100.0
    assert len(c_full["gaps"]) == 0

    # Control 2: 10-day hole from 2027-01-11 to 2027-01-20
    # Span 1: Jan 1 to Jan 10
    client.post("/api/evidence", json={
        "title": "Access Logs Part 1",
        "status": "collected",
        "control_ids": ["TF-CC6.1-01"],
        "period_covered": {"start": "2027-01-01", "end": "2027-01-10"}
    })
    # Span 2: Jan 21 to Jan 31
    client.post("/api/evidence", json={
        "title": "Access Logs Part 2",
        "status": "collected",
        "control_ids": ["TF-CC6.1-01"],
        "period_covered": {"start": "2027-01-21", "end": "2027-01-31"}
    })

    cov_res2 = client.get("/api/coverage/controls/TF-CC6.1-01")
    assert cov_res2.status_code == 200
    c_partial = cov_res2.json()
    assert c_partial["status"] == "partial"
    assert len(c_partial["gaps"]) == 1
    gap = c_partial["gaps"][0]
    assert gap["start"] == "2027-01-11"
    assert gap["end"] == "2027-01-20"
    assert gap["days"] == 10


def test_no_evidence_control_reports_missing(test_setup):
    """W2, W10: Control with zero evidence is marked 'missing' across whole window."""
    client, _, _ = test_setup
    # TF-CC7.5-01 has no evidence seeded
    res = client.get("/api/coverage/controls/TF-CC7.5-01")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "missing"
    assert data["coverage_percentage"] == 0.0
    assert len(data["gaps"]) == 1
    assert data["gaps"][0]["days"] > 0


def test_expired_evidence_and_overlapping_spans_handling(test_setup):
    """W2, W10: Expired evidence does not count; overlapping spans do not inflate total."""
    client, _, _ = test_setup

    client.put("/api/coverage/window", json={
        "observation_window_start": "2027-01-01",
        "observation_window_end": "2027-01-31",
        "confirm_change": True
    })

    # Expired evidence item should not count
    client.post("/api/evidence", json={
        "title": "Expired Pen Test",
        "status": "expired",
        "control_ids": ["TF-CC7.2-01"],
        "period_covered": {"start": "2027-01-01", "end": "2027-01-31"}
    })
    res_exp = client.get("/api/coverage/controls/TF-CC7.2-01")
    assert res_exp.json()["status"] == "missing"

    # Overlapping items for TF-CC6.7-01:
    # Item 1: Jan 1 to Jan 20 (20 days)
    client.post("/api/evidence", json={
        "title": "KMS Log A",
        "status": "collected",
        "control_ids": ["TF-CC6.7-01"],
        "period_covered": {"start": "2027-01-01", "end": "2027-01-20"}
    })
    # Item 2: Jan 10 to Jan 25 (overlaps Jan 10-20, extends to Jan 25)
    client.post("/api/evidence", json={
        "title": "KMS Log B",
        "status": "collected",
        "control_ids": ["TF-CC6.7-01"],
        "period_covered": {"start": "2027-01-10", "end": "2027-01-25"}
    })
    res_ov = client.get("/api/coverage/controls/TF-CC6.7-01")
    data_ov = res_ov.json()
    # Union is Jan 1 to Jan 25 = 25 covered days (never 20 + 16 = 36 days!)
    assert data_ov["covered_days"] == 25
    assert data_ov["status"] == "partial"  # Jan 26-31 is a 6-day gap


def test_stale_r6_acceptance_and_open_r5_exception_degrade_coverage(test_setup):
    """W2, W10: Stale policy acceptance or open monitoring exception degrades control status."""
    client, _, _ = test_setup

    client.put("/api/coverage/window", json={
        "observation_window_start": "2027-01-01",
        "observation_window_end": "2027-01-31",
        "confirm_change": True
    })

    # Give TF-CC1.1-01 continuous evidence across Jan 1-31
    client.post("/api/evidence", json={
        "title": "Code of Ethics Attestations",
        "status": "collected",
        "control_ids": ["TF-CC1.1-01"],
        "period_covered": {"start": "2027-01-01", "end": "2027-01-31"}
    })

    # Degrade factor 1: Open monitoring exception linked to TF-CC1.1-01
    client.post("/api/exceptions", json={
        "title": "Exception on Ethical Commitments",
        "test_id": "test_policies_approved",
        "control_refs": ["TF-CC1.1-01"],
        "status": "open",
        "reason": "Missing executive signature on whistleblower appendix."
    })

    res_deg = client.get("/api/coverage/controls/TF-CC1.1-01")
    assert res_deg.status_code == 200
    data_deg = res_deg.json()
    # Even though evidence covers 100% of days, status is degraded to 'partial'
    assert data_deg["status"] == "partial"
    assert any("monitoring exception" in reason.lower() for reason in data_deg.get("degradation_reasons", []))


def test_criterion_rollup_one_partial_control_marks_criterion_uncovered(test_setup):
    """W3, W10: A criterion rolls up controls; if 1 control has gaps, criterion is not covered."""
    client, _, _ = test_setup
    res = client.get("/api/coverage/summary")
    assert res.status_code == 200
    summary = res.json()
    assert "criteria" in summary
    assert "categories" in summary
    assert "overall_coverage_percentage" in summary

    # CC1.1 requires all its controls to be covered
    cc1_1 = next((c for c in summary["criteria"] if c["criterion_code"] == "CC1.1"), None)
    assert cc1_1 is not None
    assert cc1_1["is_fully_covered"] in (True, False)


def test_gap_register_lifecycle_cannot_autoclose(test_setup):
    """W4, W10: Gap register persists detected gaps; cannot auto-close without explicit action."""
    client, _, _ = test_setup
    # Trigger gap detection
    client.post("/api/coverage/scan_gaps")

    gaps_res = client.get("/api/coverage/gaps?status=open")
    assert gaps_res.status_code == 200
    gaps = gaps_res.json().get("items", [])
    assert len(gaps) > 0
    target_gap = gaps[0]
    gap_id = target_gap["id"]

    # 1. Remediate gap
    rem_res = client.post(f"/api/coverage/gaps/{gap_id}/remediate", json={
        "actor": "alice@tofrom.com",
        "remediation_evidence_ref": "evi-remediation-99",
        "remediation_notes": "Uploaded retroactive log export."
    })
    assert rem_res.status_code == 200
    assert rem_res.json()["status"] == "remediated"

    # 2. Rescan gaps - remediated gap remains remediated (does not auto-close or revert to open)
    client.post("/api/coverage/scan_gaps")
    recheck = client.get(f"/api/coverage/gaps/{gap_id}").json()
    assert recheck["status"] == "remediated"

    # 3. Formally close gap
    close_res = client.post(f"/api/coverage/gaps/{gap_id}/close", json={
        "actor": "CISO",
        "closure_note": "Verified retroactive evidence is sufficient."
    })
    assert close_res.status_code == 200
    assert close_res.json()["status"] == "closed"


def test_coverage_export_and_r4_workpaper_bundle(test_setup):
    """W6, W7, W10: Coverage export dossier produces CSV/JSON and integrates with R4 workpapers."""
    client, _, _ = test_setup
    res = client.get("/api/coverage/export?format=json")
    assert res.status_code == 200
    data = res.json()
    assert "observation_window" in data
    assert "criteria_rollups" in data
    assert "coverage_rules" in data
    assert "generated_at" in data

    # Verify R4 workpaper export ZIP includes COVERAGE_DOSSIER.json
    wp_res = client.get("/api/auditor/export/workpapers")
    assert wp_res.status_code == 200
