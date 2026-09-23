"""Tests for R8: Hardened Risk Register, 5x5 Heatmap, Control Linkage & Assessment Minutes."""
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


def test_scores_computed_serverside_client_scores_ignored(test_setup):
    """K1, K11: inherent_score and residual_score are computed strictly server-side."""
    client, _, _ = test_setup
    payload = {
        "title": "Unencrypted Database Backups",
        "description": "Risk of backup media exposure during transit",
        "category": "security",
        "owner": "alice@tofrom.com",
        "likelihood": 4,
        "impact": 5,
        "inherent_score": 999,  # Malicious/fabricated client score
        "residual_likelihood": 2,
        "residual_impact": 3,
        "residual_score": 111,  # Malicious/fabricated client score
        "treatment": "mitigate",
        "treatment_plan": "Enforce KMS AES-256 encryption on all S3 backup buckets.",
        "mitigating_control_refs": ["TF-CC6.7-01"]
    }
    res = client.post("/api/risks", json=payload)
    assert res.status_code in (200, 201), res.text
    risk = res.json()

    # Inherent = 4 * 5 = 20, Residual = 2 * 3 = 6
    assert risk["inherent_score"] == 20
    assert risk["residual_score"] == 6
    assert risk["inherent_score"] != 999
    assert risk["residual_score"] != 111


def test_cannot_close_unmitigated_risk_rejected_with_422(test_setup):
    """K3, K11: A risk with treatment=mitigate and no mitigating controls cannot be closed (422)."""
    client, _, _ = test_setup
    payload = {
        "title": "Production Secrets in Cleartext Repositories",
        "description": "Risk of API keys committed to source control",
        "category": "security",
        "owner": "bob@tofrom.com",
        "likelihood": 4,
        "impact": 4,
        "treatment": "mitigate",
        "treatment_plan": "Implement pre-commit secret scanning hooks.",
        "mitigating_control_refs": []  # Zero mitigating controls!
    }
    res = client.post("/api/risks", json=payload)
    assert res.status_code in (200, 201)
    risk_id = res.json()["id"]

    # Attempt to close without mitigating controls -> 422
    close_res = client.post(f"/api/risks/{risk_id}/close", json={
        "actor": "bob@tofrom.com",
        "closure_rationale": "We think it is fine now."
    })
    assert close_res.status_code == 422
    assert "unmitigated" in close_res.json().get("detail", "").lower()

    # Link a valid mitigating control and retry closing
    patch_res = client.patch(f"/api/risks/{risk_id}", json={
        "mitigating_control_refs": ["TF-CC6.1-01"]
    })
    assert patch_res.status_code == 200

    close_res2 = client.post(f"/api/risks/{risk_id}/close", json={
        "actor": "bob@tofrom.com",
        "closure_rationale": "Pre-commit trufflehog hooks active and verified across all repos."
    })
    assert close_res2.status_code == 200
    assert close_res2.json()["status"] == "closed"


def test_risk_acceptance_requires_distinct_approver_and_expiry(test_setup):
    """K4, K11: Risk acceptance requires segregation of duties and expiration date."""
    client, _, _ = test_setup
    # Create risk owned by Alice
    res = client.post("/api/risks", json={
        "title": "Legacy Internal VPN Cleartext Protocol",
        "category": "operational",
        "owner": "alice@tofrom.com",
        "likelihood": 2,
        "impact": 3,
        "treatment": "accept"
    })
    assert res.status_code in (200, 201)
    risk_id = res.json()["id"]

    # Self-approval by owner Alice -> 422 (SoD violation)
    future_date = (date.today() + timedelta(days=90)).isoformat()
    sod_res = client.post(f"/api/risks/{risk_id}/accept", json={
        "approver": "alice@tofrom.com",
        "expiry_date": future_date,
        "acceptance_rationale": "Low traffic internal tool."
    })
    assert sod_res.status_code == 422
    assert "segregation of duties" in sod_res.json().get("detail", "").lower()

    # Missing expiry date -> 422
    missing_exp = client.post(f"/api/risks/{risk_id}/accept", json={
        "approver": "charlie-ciso@tofrom.com",
        "acceptance_rationale": "Accepting until Q3 migration."
    })
    assert missing_exp.status_code == 422

    # Independent executive approval by Charlie CISO with expiry
    valid_res = client.post(f"/api/risks/{risk_id}/accept", json={
        "approver": "charlie-ciso@tofrom.com",
        "expiry_date": future_date,
        "acceptance_rationale": "Accepted pending Q3 Zero-Trust network migration."
    })
    assert valid_res.status_code == 200
    assert valid_res.json()["status"] == "monitored"
    assert valid_res.json()["accepted_by"] == "charlie-ciso@tofrom.com"


def test_expired_risk_acceptance_reopens_risk(test_setup):
    """K4, K11: When an acceptance expires, the daily check re-opens the risk."""
    client, _, _ = test_setup
    past_date = (date.today() - timedelta(days=5)).isoformat()
    res = client.post("/api/risks", json={
        "title": "Temporary Development Port Exposure",
        "category": "security",
        "owner": "dev-lead@tofrom.com",
        "likelihood": 3,
        "impact": 3,
        "treatment": "accept"
    })
    risk_id = res.json()["id"]

    client.post(f"/api/risks/{risk_id}/accept", json={
        "approver": "ciso@tofrom.com",
        "expiry_date": past_date,
        "acceptance_rationale": "One-week testing window."
    })

    # Trigger scheduler sweep / expiration check
    client.post("/api/risks/check_expirations")

    # Risk should have automatically re-opened
    risk = client.get(f"/api/risks/{risk_id}").json()
    assert risk["status"] == "open"
    assert "expired" in risk.get("reopen_reason", "").lower()


def test_review_cadence_and_append_only_review_history(test_setup):
    """K5, K11: Reviews compute next_review_at and maintain append-only review history."""
    client, _, _ = test_setup
    res = client.post("/api/risks", json={
        "title": "Cloud Infrastructure Single Region Dependency",
        "category": "operational",
        "owner": "sre@tofrom.com",
        "likelihood": 3,
        "impact": 4,
        "treatment": "mitigate",
        "treatment_plan": "Multi-region failover architecture.",
        "mitigating_control_refs": ["TF-A1.1-01"],
        "review_cadence_days": 90
    })
    risk_id = res.json()["id"]

    # 1. Conduct first review: scores unchanged
    rev1 = client.post(f"/api/risks/{risk_id}/review", json={
        "reviewer": "risk-committee@tofrom.com",
        "decision": "scores_unchanged",
        "notes": "Q1 review complete; architecture designs in progress."
    })
    assert rev1.status_code == 200
    data1 = rev1.json()
    assert len(data1["review_history"]) == 1
    assert data1["review_history"][0]["decision"] == "scores_unchanged"
    assert data1["next_review_at"] is not None

    # 2. Conduct second review: re-scored lower residual impact
    rev2 = client.post(f"/api/risks/{risk_id}/review", json={
        "reviewer": "ciso@tofrom.com",
        "decision": "re_scored",
        "new_residual_likelihood": 1,
        "new_residual_impact": 2,
        "notes": "Secondary region pilot verified operational."
    })
    assert rev2.status_code == 200
    data2 = rev2.json()
    assert len(data2["review_history"]) == 2
    assert data2["residual_score"] == 2  # 1 * 2

    # Check reviews due endpoint
    due_res = client.get("/api/risks/reviews_due")
    assert due_res.status_code == 200


def test_reopening_requires_reason(test_setup):
    """K4, K11: Reopening a closed or monitored risk requires an explicit reason."""
    client, _, _ = test_setup
    res = client.post("/api/risks", json={
        "title": "Vendor Security Assessment Cadence",
        "category": "third-party",
        "owner": "vendor-manager@tofrom.com",
        "likelihood": 2,
        "impact": 2,
        "treatment": "mitigate",
        "treatment_plan": "Annual vendor reviews.",
        "mitigating_control_refs": ["TF-CC9.1-01"]
    })
    risk_id = res.json()["id"]

    # Close risk
    client.post(f"/api/risks/{risk_id}/close", json={
        "actor": "vendor-manager@tofrom.com",
        "closure_rationale": "All vendor audits on schedule."
    })

    # Attempt to reopen without reason -> 422
    reopen_fail = client.post(f"/api/risks/{risk_id}/reopen", json={
        "actor": "auditor@tofrom.com",
        "reason": "   "
    })
    assert reopen_fail.status_code == 422

    # Reopen with reason -> 200
    reopen_ok = client.post(f"/api/risks/{risk_id}/reopen", json={
        "actor": "auditor@tofrom.com",
        "reason": "New critical vendor onboarded without completed DPA."
    })
    assert reopen_ok.status_code == 200
    assert reopen_ok.json()["status"] == "in_treatment"


def test_assessment_minutes_generation_and_r4_workpaper_export(test_setup):
    """K6, K7, K11: Generate risk assessment minutes and confirm auditor access."""
    client, _, _ = test_setup
    # Create two scored risks
    client.post("/api/risks", json={
        "title": "Risk Alpha",
        "category": "security",
        "owner": "alice@tofrom.com",
        "likelihood": 3,
        "impact": 4,
        "treatment": "mitigate",
        "treatment_plan": "Plan Alpha",
        "mitigating_control_refs": ["TF-CC1.1-01"]
    })

    # Generate assessment minutes
    min_res = client.post("/api/risks/assessment_minutes", json={
        "meeting_title": "Q1 2027 Executive Risk Committee Assessment",
        "meeting_date": "2027-01-20",
        "attendees": ["Alice Lead", "Bob CISO", "Charlie Director"],
        "chair": "Bob CISO",
        "decisions_summary": "Reviewed 5x5 heatmap, approved 2 mitigations."
    })
    assert min_res.status_code in (200, 201)
    minutes = min_res.json()
    assert "meeting_title" in minutes
    assert "risks_assessed" in minutes
    assert len(minutes["risks_assessed"]) >= 1

    # Check auditor workpaper ZIP includes risk register
    wp_res = client.get("/api/auditor/export/workpapers")
    assert wp_res.status_code == 200
    assert wp_res.headers["content-type"] == "application/zip"
