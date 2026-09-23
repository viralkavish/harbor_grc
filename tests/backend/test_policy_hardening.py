"""Tests for R6: Policy Management Hardening, Segregation of Duties, Version Restore & Acceptance Currency."""
import io
import json
from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from server.app import create_app
from server.storage import Store, now





def test_segregation_of_duties_same_identity_rejected(test_setup):
    """P7.1: Submit then approve as the same identity -> 422."""
    client, _, _ = test_setup
    
    # 1. Author A submits policy for review
    submit_res = client.post("/api/policies/pol-sec-01/submit", json={"author": "alice@tofrom.com"})
    assert submit_res.status_code == 200, submit_res.text
    pol = submit_res.json()
    assert pol["status"] == "in_review"
    assert pol["submitted_by"] == "alice@tofrom.com"
    
    # 2. Same author A attempts to approve -> must fail with 422 (SoD violation)
    approve_res = client.post("/api/policies/pol-sec-01/approve", json={"approver": "alice@tofrom.com"})
    assert approve_res.status_code == 422, approve_res.text
    assert "segregation of duties" in approve_res.json()["detail"].lower()


def test_approval_workflow_different_identities_succeeds(test_setup):
    """P7.2: Submit as author A, approve as B -> published with approved_by=B."""
    client, _, _ = test_setup
    
    # 1. Author A submits
    client.post("/api/policies/pol-sec-01/submit", json={"author": "alice@tofrom.com"})
    
    # 2. Executive B approves
    approve_res = client.post("/api/policies/pol-sec-01/approve", json={"approver": "bob_ciso@tofrom.com"})
    assert approve_res.status_code == 200, approve_res.text
    pol = approve_res.json()
    assert pol["status"] == "published"
    assert pol["approved_by"] == "bob_ciso@tofrom.com"
    assert pol["approved_version"] == pol["version"]
    assert pol["approved_at"]
    
    # Check that review_date was reset to +365 days
    exp_review = (date.today() + timedelta(days=365)).isoformat()
    assert pol["review_date"] == exp_review


def test_rejection_workflow_returns_to_draft_with_reason(test_setup):
    """P7.3: Reject -> status draft with reason stored; logged."""
    client, _, _ = test_setup
    
    # 1. Submit
    client.post("/api/policies/pol-sec-01/submit", json={"author": "alice@tofrom.com"})
    
    # 2. Reviewer rejects
    reject_res = client.post("/api/policies/pol-sec-01/reject", json={
        "rejector": "bob_ciso@tofrom.com",
        "reason": "Missing cloud IAM emergency break-glass procedure."
    })
    assert reject_res.status_code == 200, reject_res.text
    pol = reject_res.json()
    assert pol["status"] == "draft"
    assert "break-glass" in pol["rejection_reason"]


def test_version_restore_creates_next_version_with_draft_status(test_setup):
    """P7.4: Restore v1 while on v3 -> creates v4 with v1's content; v1-v3 untouched; status draft."""
    client, _, _ = test_setup
    
    # Baseline: pol-sec-01 is v1
    get_v1 = client.get("/api/policies/pol-sec-01").json()
    v1_content = get_v1["content"]
    assert get_v1["version"] == 1
    
    # Update to v2
    client.patch("/api/policies/pol-sec-01", json={"content": v1_content + "\n## Revision 2 Addition"})
    get_v2 = client.get("/api/policies/pol-sec-01").json()
    assert get_v2["version"] == 2
    
    # Update to v3
    client.patch("/api/policies/pol-sec-01", json={"content": v1_content + "\n## Revision 3 Addition"})
    get_v3 = client.get("/api/policies/pol-sec-01").json()
    assert get_v3["version"] == 3
    
    # Restore v1 -> must create v4 copying v1's content
    restore_res = client.post("/api/policies/pol-sec-01/restore/1", json={"actor": "admin@tofrom.com"})
    assert restore_res.status_code == 200, restore_res.text
    v4 = restore_res.json()
    assert v4["version"] == 4
    assert v4["status"] == "draft"
    assert v4["content"] == v1_content
    
    # Verify historical versions are intact
    versions_res = client.get("/api/policies/pol-sec-01/versions")
    assert versions_res.status_code == 200
    v_items = versions_res.json()["items"]
    versions_recorded = [v["version"] for v in v_items]
    assert 1 in versions_recorded
    assert 2 in versions_recorded
    assert 3 in versions_recorded


def test_version_at_and_approved_endpoint(test_setup):
    """P7.5: version_at returns the correct approved version for dates before/after re-approval."""
    client, store, _ = test_setup
    
    # 1. Initial approval of v1 on past date (e.g. 2026-06-01)
    with store.transaction() as db:
        db.execute(
            """INSERT INTO policy_versions (id, policy_id, version, content, created_at, approved_by, approved_at)
               VALUES ('v1-snap', 'pol-sec-01', 1, 'Policy Content v1 Baseline', '2026-06-01T10:00:00Z', 'ciso@tofrom.com', '2026-06-01T10:00:00Z')"""
        )
        db.execute(
            """INSERT INTO policy_versions (id, policy_id, version, content, created_at, approved_by, approved_at)
               VALUES ('v2-snap', 'pol-sec-01', 2, 'Policy Content v2 Hardened', '2027-01-15T10:00:00Z', 'ciso@tofrom.com', '2027-01-15T10:00:00Z')"""
        )
        
    # Check date before v2 was approved (e.g. 2026-12-31)
    res_2026 = client.get("/api/policies/pol-sec-01/version_at?date=2026-12-31")
    assert res_2026.status_code == 200, res_2026.text
    v_2026 = res_2026.json()
    assert v_2026["version"] == 1
    assert "Baseline" in v_2026["content"]
    
    # Check date after v2 was approved (e.g. 2027-02-01)
    res_2027 = client.get("/api/policies/pol-sec-01/version_at?date=2027-02-01")
    assert res_2027.status_code == 200, res_2027.text
    v_2027 = res_2027.json()
    assert v_2027["version"] == 2
    assert "Hardened" in v_2027["content"]
    
    # Test GET /approved returns latest approved version
    client.post("/api/policies/pol-sec-01/submit", json={"author": "alice@tofrom.com"})
    client.post("/api/policies/pol-sec-01/approve", json={"approver": "bob@tofrom.com"})
    appr_res = client.get("/api/policies/pol-sec-01/approved")
    assert appr_res.status_code == 200
    assert appr_res.json()["status"] == "published"


def test_annual_review_enforcement_and_review_due_endpoint(test_setup):
    """P7.6: review_due lists an overdue policy and one due in 20 days; approving resets the clock."""
    client, store, _ = test_setup
    today = date.today()
    overdue_date = (today - timedelta(days=10)).isoformat()
    due_soon_date = (today + timedelta(days=20)).isoformat()
    
    from server.records import save
    with store.transaction() as db:
        # Set pol-sec-01 overdue
        pol1 = Store.get(db, 'policies', 'pol-sec-01')
        assert pol1 is not None
        pol1['review_date'] = overdue_date
        pol1['status'] = 'published'
        save(db, 'policies', pol1)
        
        # Set pol-acc-02 due in 20 days
        pol2 = Store.get(db, 'policies', 'pol-acc-02')
        assert pol2 is not None
        pol2['review_date'] = due_soon_date
        pol2['status'] = 'published'
        save(db, 'policies', pol2)
        
    res = client.get("/api/policies/review_due")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["overdue_count"] >= 1
    assert any(p["id"] == "pol-sec-01" for p in data["overdue"])
    assert data["due_soon_count"] >= 1
    assert any(p["id"] == "pol-acc-02" for p in data["due_soon"])
    
    # Approving resets review_date to +365 days
    client.post("/api/policies/pol-sec-01/submit", json={"author": "author@tofrom.com"})
    client.post("/api/policies/pol-sec-01/approve", json={"approver": "approver@tofrom.com"})
    
    pol1_updated = client.get("/api/policies/pol-sec-01").json()
    assert pol1_updated["review_date"] == (today + timedelta(days=365)).isoformat()


def test_acceptance_status_matrix_current_vs_stale_vs_missing(test_setup):
    """P7.7: After publishing v2, a v1 accepter shows stale."""
    client, store, _ = test_setup
    
    # 1. Create active employee
    emp_res = client.post("/api/people", json={
        "title": "Alice Developer",
        "email": "alice.dev@tofrom.com",
        "department": "Engineering",
        "status": "active"
    })
    assert emp_res.status_code == 201
    emp = emp_res.json()
    
    # 2. Publish v1 of pol-sec-01
    client.post("/api/policies/pol-sec-01/submit", json={"author": "editor1@tofrom.com"})
    client.post("/api/policies/pol-sec-01/approve", json={"approver": "approver1@tofrom.com"})
    pol_v1 = client.get("/api/policies/pol-sec-01").json()
    v1_num = pol_v1["approved_version"]
    
    # 3. Employee accepts v1
    acc_res = client.post("/api/policies/pol-sec-01/accept", json={
        "person_name": "Alice Developer",
        "person_email": "alice.dev@tofrom.com",
        "signature_text": "Alice Developer"
    })
    assert acc_res.status_code == 200
    
    # Check acceptance status on v1 -> current
    status_v1 = client.get("/api/policies/pol-sec-01/acceptance_status").json()
    alice_status1 = next((p for p in status_v1["personnel"] if p["email"] == "alice.dev@tofrom.com"), None)
    assert alice_status1 is not None
    assert alice_status1["status"] == "current"
    
    # 4. Content updated & v2 published
    client.patch("/api/policies/pol-sec-01", json={"content": pol_v1["content"] + "\n## Revision 2 Changes"})
    client.post("/api/policies/pol-sec-01/submit", json={"author": "editor2@tofrom.com"})
    client.post("/api/policies/pol-sec-01/approve", json={"approver": "approver2@tofrom.com"})
    
    # Check acceptance status on v2 -> Alice must now show as STALE (accepted v1, latest is v2)
    status_v2 = client.get("/api/policies/pol-sec-01/acceptance_status").json()
    assert status_v2["approved_version"] > v1_num
    alice_status2 = next((p for p in status_v2["personnel"] if p["email"] == "alice.dev@tofrom.com"), None)
    assert alice_status2 is not None
    assert alice_status2["status"] == "stale"
    assert alice_status2["accepted_version"] == v1_num


def test_all_mutations_logged_in_r3_audit_log(test_setup):
    """P7.8: Every P1-P5 mutation appears in the R3 audit log with actor and before/after."""
    client, _, _ = test_setup
    
    author = "sarah.author@tofrom.com"
    approver = "marcus.ciso@tofrom.com"
    
    client.post("/api/policies/pol-sec-01/submit", json={"author": author})
    client.post("/api/policies/pol-sec-01/approve", json={"approver": approver})
    
    # Check R3 log
    log_res = client.get("/api/audit/log?resource=policies&limit=10")
    assert log_res.status_code == 200
    entries = log_res.json()["items"]
    
    actions = [e["action"] for e in entries]
    assert "submit_policy" in actions
    assert "approve_policy" in actions
    
    submit_entry = next((e for e in entries if e["action"] == "submit_policy"), None)
    assert submit_entry is not None
    assert submit_entry["actor"] == author
    assert submit_entry["after"] is not None
    assert submit_entry["after"]["status"] == "in_review"
    
    approve_entry = next((e for e in entries if e["action"] == "approve_policy"), None)
    assert approve_entry is not None
    assert approve_entry["actor"] == approver
    assert approve_entry["after"] is not None
    assert approve_entry["after"]["status"] == "published"


def test_policy_version_history_with_author_and_change_reason_and_print_view(test_setup):
    """Asserts editing policy captures who and why in version history, and print view renders cleanly."""
    client, _, _ = test_setup

    # 1. Create a new policy
    create_res = client.post("/api/policies", json={
        "title": "DNI 2025 Incident Response Policy",
        "description": "Incident response guidelines",
        "owner": "ciso@tofrom.com",
        "content": "# Incident Response\n\nAll incidents must be triaged within 15 minutes.",
        "change_reason": "Initial authoring for DNI 2025 readiness"
    })
    assert create_res.status_code == 201
    pol = create_res.json()
    pol_id = pol["id"]

    # 2. Edit the policy with explicit reason
    edit_res = client.patch(f"/api/policies/{pol_id}", json={
        "content": "# Incident Response\n\nAll incidents must be triaged within 10 minutes.\nTabletop exercises run bi-annually.",
        "change_reason": "Tightened SLA from 15m to 10m per DNI 2025 recommendations"
    })
    assert edit_res.status_code == 200
    updated_pol = edit_res.json()
    assert updated_pol["version"] == 2

    # 3. Fetch version history
    v_res = client.get(f"/api/policies/{pol_id}/versions")
    assert v_res.status_code == 200
    v_data = v_res.json()
    items = v_data["items"]
    assert len(items) >= 2
    # Verify that change_reason and updated_by are present
    v2 = next((v for v in items if v["version"] == 2), None)
    v1 = next((v for v in items if v["version"] == 1), None)
    assert v1 is not None
    assert v1["change_reason"] is not None
    assert v1["updated_by"] is not None

    # 4. Fetch executive print view
    print_res = client.get(f"/api/policies/{pol_id}/print")
    assert print_res.status_code == 200
    assert "text/html" in print_res.headers["content-type"]
    assert "tofromGRC" in print_res.text
    assert "Document Revision History" in print_res.text
    assert "Segregation of Duties" in print_res.text

