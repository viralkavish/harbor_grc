"""Tests for R7: Defensible, Reproducible Sampling Engine with Zero Fabricated Attributes."""
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from server.app import create_app





def test_no_hardcoded_true_verification_attributes_remain():
    """S5, S9: Grep test ensuring zero fabricated verification claims remain in codebase."""
    project_root = Path(__file__).resolve().parent.parent.parent
    soc2_file = project_root / "server" / "soc2_engine.py"
    sampling_file = project_root / "server" / "sampling_ops.py"

    content = soc2_file.read_text(encoding="utf-8")
    if sampling_file.exists():
        content += sampling_file.read_text(encoding="utf-8")

    assert '"background_check_verified": True' not in content
    assert "'background_check_verified': True" not in content
    assert '"soc2_cert_verified": True' not in content
    assert "'soc2_cert_verified': True" not in content


def test_missing_completeness_statement_rejected_with_422(test_setup):
    """S3, S9: completeness_statement is mandatory; missing or whitespace -> 422."""
    client, _, _ = test_setup
    payload = {
        "population_type": "workforce",
        "method": "random",
        "sample_size": 3,
        "seed": 42
    }
    # Omitted completeness_statement
    res = client.post("/api/sampling/generate", json=payload)
    assert res.status_code == 422
    assert "completeness_statement" in res.json().get("detail", "").lower()

    # Whitespace completeness_statement
    payload["completeness_statement"] = "   "
    res2 = client.post("/api/sampling/generate", json=payload)
    assert res2.status_code == 422


def test_seeded_random_sampling_is_byte_identical_on_regenerate(test_setup):
    """S2, S9: Same seed + parameters produces exact identical sample IDs and items."""
    client, _, _ = test_setup
    payload = {
        "name": "Q1 2027 Workforce New Hires Sample",
        "population_type": "workforce",
        "completeness_statement": "Reconciled against HRIS active directory headcount of Q1 new hires.",
        "method": "random",
        "sample_size": 3,
        "seed": 12345,
        "control_refs": ["TF-CC1.4-01"]
    }

    res1 = client.post("/api/sampling/generate", json=payload)
    assert res1.status_code in (200, 201), res1.text
    sample1 = res1.json()

    res2 = client.post("/api/sampling/generate", json=payload)
    assert res2.status_code in (200, 201), res2.text
    sample2 = res2.json()

    # Distinct records created (no silent replacement)
    assert sample1["id"] != sample2["id"]
    # Identical sample_ids drawn due to deterministic seed
    assert sample1["sample_ids"] == sample2["sample_ids"]
    assert sample1["sample_size"] == sample2["sample_size"]
    assert sample1["seed"] == 12345


def test_consecutive_generations_persist_distinct_records(test_setup):
    """S1, S9: Every draw is persisted as a distinct record in samples table."""
    client, _, _ = test_setup
    payload = {
        "name": "Audit Sample A",
        "population_type": "vendors",
        "completeness_statement": "All active vendors processing customer data.",
        "method": "random",
        "sample_size": 2,
        "seed": 999
    }
    res1 = client.post("/api/sampling/generate", json=payload)
    res2 = client.post("/api/sampling/generate", json=payload)

    list_res = client.get("/api/sampling")
    assert list_res.status_code == 200
    items = list_res.json().get("items", [])
    sample_ids = {s["id"] for s in items}
    assert res1.json()["id"] in sample_ids
    assert res2.json()["id"] in sample_ids


def test_population_size_matches_filtered_source_count(test_setup):
    """S3, S9: population_size on sample matches source count under active filters."""
    client, _, _ = test_setup
    payload = {
        "population_type": "controls",
        "completeness_statement": "All operational SOC 2 controls excluding not_applicable.",
        "method": "random",
        "sample_size": 5,
        "seed": 777
    }
    res = client.post("/api/sampling/generate", json=payload)
    assert res.status_code in (200, 201)
    data = res.json()

    ctrl_res = client.get("/api/controls")
    active_controls = [c for c in ctrl_res.json().get("items", []) if c.get("status") != "not_applicable"]
    assert data["population_size"] == len(active_controls)


def test_judgmental_picks_require_rationale_per_item(test_setup):
    """S4, S9: Method 'judgmental' requires rationale for every selected item."""
    client, _, _ = test_setup
    people = client.get("/api/people").json().get("items", [])
    if not people:
        client.post("/api/people", json={"title": "Test Engineer", "email": "test@tofrom.com", "status": "active"})
        people = client.get("/api/people").json().get("items", [])

    p_id = people[0]["id"]

    # Missing rationale -> 422
    invalid_payload = {
        "population_type": "workforce",
        "completeness_statement": "Tested high-risk administrative personnel.",
        "method": "judgmental",
        "judgmental_picks": [{"id": p_id, "rationale": "  "}]
    }
    res = client.post("/api/sampling/generate", json=invalid_payload)
    assert res.status_code == 422
    assert "rationale" in res.json().get("detail", "").lower()

    # Valid rationale -> 200/201
    valid_payload = {
        "population_type": "workforce",
        "completeness_statement": "Tested high-risk administrative personnel.",
        "method": "judgmental",
        "judgmental_picks": [{"id": p_id, "rationale": "System administrator with production SSH access."}]
    }
    res_valid = client.post("/api/sampling/generate", json=valid_payload)
    assert res_valid.status_code in (200, 201)
    data = res_valid.json()
    assert data["method"] == "judgmental"
    assert p_id in data["sample_ids"]


def test_sample_verification_endpoint_verifies_untampered_sample(test_setup):
    """S6, S9: POST /api/sampling/{id}/verify reproduces sample and returns match."""
    client, _, _ = test_setup
    payload = {
        "name": "Reproducibility Verification Test Sample",
        "population_type": "controls",
        "completeness_statement": "Population verified against 61 Trust Services Criteria.",
        "method": "random",
        "sample_size": 4,
        "seed": 54321
    }
    gen_res = client.post("/api/sampling/generate", json=payload)
    assert gen_res.status_code in (200, 201)
    sample_id = gen_res.json()["id"]

    # Call verify endpoint
    ver_res = client.post(f"/api/sampling/{sample_id}/verify")
    assert ver_res.status_code == 200
    v = ver_res.json()
    assert v["match"] is True
    assert v["expected_sample_ids"] == v["reproduced_sample_ids"]
    assert "verified_at" in v

    # Verify R3 audit logging
    audit = client.get(f"/api/audit/log?resource=samples&record_id={sample_id}").json()
    actions = [item["action"] for item in audit.get("items", [])]
    assert "generate_sample" in actions
    assert "verify_sample" in actions


def test_zero_fabricated_attributes_in_sample_items(test_setup):
    """S5, S9: Sample items carry only real attributes from underlying record; no hardcoded True."""
    client, _, _ = test_setup
    # Create person without verified background check
    client.post("/api/people", json={
        "title": "Jane Doe",
        "email": "jane@tofrom.com",
        "status": "active",
        "background_check": "unverified"
    })

    payload = {
        "population_type": "workforce",
        "completeness_statement": "Active personnel sample.",
        "method": "random",
        "sample_size": 5,
        "seed": 101
    }
    res = client.post("/api/sampling/generate", json=payload)
    assert res.status_code in (200, 201)
    items = res.json().get("sample_items", [])
    assert len(items) > 0

    for item in items:
        # None should have a fabricated True
        assert item.get("background_check_verified") is not True
        assert item.get("soc2_cert_verified") is not True
