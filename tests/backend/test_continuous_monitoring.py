"""Tests for R5: Continuous Monitoring, Scheduler, Transparency & Exceptions Lifecycle."""
import io
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from server.app import create_app
from server.storage import Store





def test_no_legacy_control_codes_remain():
    """M8: Verify that continuous_tests.py and monitoring.py contain zero legacy control codes."""
    project_root = Path(__file__).resolve().parent.parent.parent
    ct_file = project_root / "server" / "continuous_tests.py"
    mon_file = project_root / "server" / "monitoring.py"

    content = ct_file.read_text(encoding="utf-8") + mon_file.read_text(encoding="utf-8")
    legacy_codes = [
        "CC1.1-GOV",
        "CC1.2-REVIEW",
        "HR.3-ACKNOWLEDGE",
        "CC6.7-ENC-REST",
        "CC6.6-NET-SEC",
        "CC6.1-MFA",
        "CC6.4-RECERT",
        "CC9.1-VENDOR-ASSESS",
        "CC9.2-DPA",
        "CC7.2-PEN-TEST",
        "GV.1-RISK-REG",
        "CC7.3-LOGGING",
        "HR.1-BACKGROUND",
        "CC2.1-COMM"
    ]
    for code in legacy_codes:
        assert code not in content, f"Legacy control code {code} found in continuous tests source code!"


def test_r1_catalog_ids_on_every_test_resolve_to_real_controls(test_setup):
    """M8: Verify all control_ids on every automated test map to valid R1 catalog controls."""
    client, _, _ = test_setup
    res = client.get("/api/tests")
    assert res.status_code == 200
    tests = res.json().get("tests", [])
    assert len(tests) >= 16

    ctrl_res = client.get("/api/controls")
    assert ctrl_res.status_code == 200
    catalog_ids = {c["id"] for c in ctrl_res.json().get("items", [])}

    for t in tests:
        ctrl_ids = t.get("control_ids", [])
        assert len(ctrl_ids) >= 1, f"Test {t['id']} has no mapped control_ids"
        for cid in ctrl_ids:
            assert cid in catalog_ids, f"Test {t['id']} maps to non-existent catalog control {cid}"


def test_manual_monitoring_run_persists_m1_m3_fields(test_setup):
    """M1, M3: Manual run stores a monitoring_runs row carrying all transparency fields."""
    client, _, _ = test_setup
    res = client.post("/api/monitoring/run", json={"actor": "SecOps Lead"})
    assert res.status_code == 200
    data = res.json()
    assert "id" in data
    assert data["triggered_by"] in ("manual", "SecOps Lead")
    assert "started_at" in data
    assert "completed_at" in data
    assert "results" in data
    assert len(data["results"]) >= 16

    for r in data["results"]:
        assert "test_id" in r
        assert "control_ids" in r
        assert r["status"] in ("pass", "warning", "fail")
        assert "summary" in r
        assert "source_system" in r
        assert "query_logic" in r
        assert "generated_at" in r
        assert "test_version" in r

    # Check GET /api/monitoring/runs and GET /api/monitoring/runs/latest
    list_res = client.get("/api/monitoring/runs")
    assert list_res.status_code == 200
    runs = list_res.json().get("items", [])
    assert len(runs) >= 1
    assert runs[0]["id"] == data["id"]

    latest_res = client.get("/api/monitoring/runs/latest")
    assert latest_res.status_code == 200
    latest = latest_res.json()
    assert latest["id"] == data["id"]


def test_scheduled_monitoring_run_execution(test_setup):
    """M2: Scheduled run stores triggered_by: 'schedule' and updates scheduler health."""
    client, _, _ = test_setup
    res = client.post("/api/monitoring/run_scheduled")
    assert res.status_code == 200
    data = res.json()
    assert data["triggered_by"] == "schedule"
    assert "started_at" in data
    assert "results" in data

    # Check scheduler status endpoint
    sched_res = client.get("/api/monitoring/scheduler")
    assert sched_res.status_code == 200
    sched = sched_res.json()
    assert "last_run_at" in sched
    assert "next_run_at" in sched
    assert "daily_schedule_time" in sched


def test_failing_test_auto_creates_deduplicated_exception(test_setup):
    """M4: A failing test auto-creates exactly one exception; consecutive failures deduplicate."""
    client, _, _ = test_setup
    # Seed a failing test: create an unowned control
    ctrl_res = client.post("/api/controls", json={
        "title": "Orphan Unowned Control",
        "description": "Testing exception creation",
        "status": "in_progress",
        "owner": ""
    })
    assert ctrl_res.status_code in (200, 201)

    # Execute first monitoring run
    run1 = client.post("/api/monitoring/run")
    assert run1.status_code == 200

    # Check exceptions endpoint
    exc_res = client.get("/api/exceptions?status=open")
    assert exc_res.status_code == 200
    excs = exc_res.json().get("items", [])
    unowned_excs = [e for e in excs if e["test_id"] == "test_control_ownership"]
    assert len(unowned_excs) == 1
    exc = unowned_excs[0]
    assert exc["status"] == "open"
    assert "TF-CC1.3-01" in exc["control_refs"] or len(exc["control_refs"]) > 0

    # Execute second monitoring run - failure persists but exception must NOT be duplicated
    run2 = client.post("/api/monitoring/run")
    assert run2.status_code == 200

    exc_res2 = client.get("/api/exceptions?status=open")
    excs2 = exc_res2.json().get("items", [])
    unowned_excs2 = [e for e in excs2 if e["test_id"] == "test_control_ownership"]
    assert len(unowned_excs2) == 1
    assert unowned_excs2[0]["id"] == exc["id"]


def test_exception_lifecycle_and_r3_audit_logging(test_setup):
    """M4, M6: Exception lifecycle (open -> acknowledged -> remediated -> closed) logged in R3."""
    client, _, _ = test_setup
    # Create exception via test failure or direct seed
    run = client.post("/api/monitoring/run")
    assert run.status_code == 200

    excs = client.get("/api/exceptions").json().get("items", [])
    if not excs:
        # Force a failing test if none exist
        client.post("/api/controls", json={"title": "Unowned", "status": "in_progress", "owner": ""})
        client.post("/api/monitoring/run")
        excs = client.get("/api/exceptions").json().get("items", [])

    assert len(excs) >= 1
    exc_id = excs[0]["id"]

    # 1. Assign owner (open -> acknowledged)
    assign_res = client.post(f"/api/exceptions/{exc_id}/assign", json={
        "owner": "alice@tofrom.com",
        "due_date": "2027-02-01",
        "actor": "SecOps Manager"
    })
    assert assign_res.status_code == 200
    assert assign_res.json()["owner"] == "alice@tofrom.com"
    assert assign_res.json()["status"] == "acknowledged"

    # 2. Add an append-only note
    note_res = client.post(f"/api/exceptions/{exc_id}/note", json={
        "author": "alice@tofrom.com",
        "text": "Investigating unowned controls register."
    })
    assert note_res.status_code == 200
    assert len(note_res.json()["notes"]) >= 1

    # 3. Remediate with evidence
    rem_res = client.post(f"/api/exceptions/{exc_id}/remediate", json={
        "actor": "alice@tofrom.com",
        "note": "Assigned CISO as owner across all active controls.",
        "evidence_ids": ["evi-sample-01"]
    })
    assert rem_res.status_code == 200
    assert rem_res.json()["status"] == "remediated"

    # 4. Close exception
    close_res = client.post(f"/api/exceptions/{exc_id}/close", json={
        "actor": "SecOps Lead",
        "reason": "Remediation verified clean in continuous run."
    })
    assert close_res.status_code == 200
    assert close_res.json()["status"] == "closed"

    # Verify R3 audit trail entries
    audit = client.get(f"/api/audit/log?resource=exceptions&record_id={exc_id}").json()
    actions = [item["action"] for item in audit.get("items", [])]
    assert "assign_exception" in actions
    assert "remediate_exception" in actions
    assert "close_exception" in actions


def test_auditor_testing_support_exposes_m3_transparency_fields(test_setup):
    """M3 & Run notes: /api/auditor/testing_support exposes M3 transparency fields."""
    client, _, _ = test_setup
    # First make sure at least one monitoring run occurred
    client.post("/api/monitoring/run")

    res = client.get("/api/auditor/testing_support")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert len(data["items"]) > 0

    first = data["items"][0]
    assert "monitoring_results" in first
    m = first["monitoring_results"]
    assert "source_system" in m
    assert "query_logic" in m
    assert "test_version" in m
    assert "last_tested_at" in m
