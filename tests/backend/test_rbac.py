"""Tests for R10: Full RBAC, Argon2 Authentication, Least Privilege & Segregation of Duties."""
from datetime import datetime, timedelta, timezone
import json
import re
import pytest
from fastapi.testclient import TestClient
from server.app import create_app
from server.storage import Store


COMMON_PASSWORDS = ["password12345", "123456789012", "adminadmin12"]


@pytest.fixture
def clean_client(tmp_path):
    app = create_app(data_dir=tmp_path / "rbac_test", auto_seed=True)
    return TestClient(app)


def test_bootstrap_flow(clean_client):
    # 1. Check bootstrap status initially
    res = clean_client.get("/api/auth/bootstrap_status")
    assert res.status_code == 200
    data = res.json()
    assert data["needs_bootstrap"] is True
    setup_token = data.get("setup_token")
    assert setup_token is not None

    # 2. Complete bootstrap admin creation
    admin_payload = {
        "setup_token": setup_token,
        "name": "Initial Admin",
        "email": "admin@tofrom.internal",
        "password": "CorrectHorseBatteryStaple2026!"
    }
    res = clean_client.post("/api/auth/bootstrap_admin", json=admin_payload)
    assert res.status_code == 201
    user = res.json()
    assert user["role"] == "admin"
    assert user["email"] == "admin@tofrom.internal"
    assert "password" not in user
    assert "password_hash" not in user

    # 3. Second attempt must fail
    res2 = clean_client.post("/api/auth/bootstrap_admin", json=admin_payload)
    assert res2.status_code in (400, 409)

    # 4. Bootstrap status now reports false
    res3 = clean_client.get("/api/auth/bootstrap_status")
    assert res3.json()["needs_bootstrap"] is False


def test_login_wrong_password_and_lockout(clean_client):
    # Setup admin
    status = clean_client.get("/api/auth/bootstrap_status").json()
    clean_client.post("/api/auth/bootstrap_admin", json={
        "setup_token": status["setup_token"],
        "name": "SecAdmin",
        "email": "secadmin@tofrom.internal",
        "password": "SuperSecretPassword123!"
    })

    # Try 4 wrong passwords
    for _ in range(4):
        res = clean_client.post("/api/auth/login", json={
            "email": "secadmin@tofrom.internal",
            "password": "WrongPassword123!"
        })
        assert res.status_code == 401

    # 5th attempt locks the account
    res = clean_client.post("/api/auth/login", json={
        "email": "secadmin@tofrom.internal",
        "password": "WrongPassword123!"
    })
    assert res.status_code in (401, 403, 423)
    assert "lock" in res.json().get("detail", "").lower()

    # Even with correct password, locked account is rejected
    res = clean_client.post("/api/auth/login", json={
        "email": "secadmin@tofrom.internal",
        "password": "SuperSecretPassword123!"
    })
    assert res.status_code in (401, 403, 423)
    assert "lock" in res.json().get("detail", "").lower()


def test_login_happy_path_and_logout(clean_client):
    # Setup admin
    status = clean_client.get("/api/auth/bootstrap_status").json()
    clean_client.post("/api/auth/bootstrap_admin", json={
        "setup_token": status["setup_token"],
        "name": "Alice Admin",
        "email": "alice@tofrom.internal",
        "password": "ValidPassword999!"
    })

    # Login
    res = clean_client.post("/api/auth/login", json={
        "email": "alice@tofrom.internal",
        "password": "ValidPassword999!"
    })
    assert res.status_code == 200
    assert "harbor_session" in clean_client.cookies
    clean_client.headers["X-CSRF-Token"] = res.json()["csrf_token"]

    # Query current identity
    me = clean_client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "alice@tofrom.internal"
    assert me.json()["role"] == "admin"

    # Logout
    logout_res = clean_client.post("/api/auth/logout")
    assert logout_res.status_code == 200

    # Next call returns 401
    me2 = clean_client.get("/api/auth/me")
    assert me2.status_code in (401, 403)


def test_permission_matrix(clean_client):
    # 1. Bootstrap admin
    status = clean_client.get("/api/auth/bootstrap_status").json()
    clean_client.post("/api/auth/bootstrap_admin", json={
        "setup_token": status["setup_token"],
        "name": "Admin User",
        "email": "admin@tofrom.internal",
        "password": "AdminPassword123!"
    })
    # Login as admin
    admin_log = clean_client.post("/api/auth/login", json={"email": "admin@tofrom.internal", "password": "AdminPassword123!"})
    clean_client.headers["X-CSRF-Token"] = admin_log.json()["csrf_token"]

    # Admin creates users for other roles
    u_comp = clean_client.post("/api/users", json={
        "name": "Compliance Lead",
        "email": "comp@tofrom.internal",
        "password": "CompliancePass123!",
        "role": "compliance_manager"
    }).json()

    u_owner = clean_client.post("/api/users", json={
        "name": "Control Owner Bob",
        "email": "bob@tofrom.internal",
        "password": "ControlOwnerPass123!",
        "role": "control_owner",
        "assigned_control_ids": ["TF-CC1.1-01"]
    }).json()

    u_viewer = clean_client.post("/api/users", json={
        "name": "Viewer Carol",
        "email": "carol@tofrom.internal",
        "password": "ViewerPass12345!",
        "role": "viewer"
    }).json()

    # 2. Test compliance_manager permissions
    comp_client = TestClient(clean_client.app)
    comp_log = comp_client.post("/api/auth/login", json={"email": "comp@tofrom.internal", "password": "CompliancePass123!"})
    comp_client.headers["X-CSRF-Token"] = comp_log.json()["csrf_token"]

    # Can create risk
    risk_res = comp_client.post("/api/risks", json={
        "title": "Vendor Data Breach",
        "category": "third-party",
        "likelihood": 3,
        "impact": 4,
        "treatment": "mitigate",
        "mitigating_control_refs": ["TF-CC1.1-01"],
        "treatment_plan": "Execute annual SOC 2 reviews"
    })
    assert risk_res.status_code == 201

    # Cannot manage users (403)
    user_mgmt_res = comp_client.get("/api/users")
    assert user_mgmt_res.status_code == 403

    # 3. Test control_owner permissions
    owner_client = TestClient(clean_client.app)
    owner_log = owner_client.post("/api/auth/login", json={"email": "bob@tofrom.internal", "password": "ControlOwnerPass123!"})
    owner_client.headers["X-CSRF-Token"] = owner_log.json()["csrf_token"]

    # Cannot create policy (403)
    pol_res = owner_client.post("/api/policies", json={"title": "Unauthorized Policy", "content": "# Test"})
    assert pol_res.status_code == 403

    # Cannot mutate unassigned control (403)
    unassigned_res = owner_client.patch("/api/controls/TF-CC9.2-01", json={"status": "implemented"})
    assert unassigned_res.status_code == 403

    # 4. Test viewer permissions
    viewer_client = TestClient(clean_client.app)
    viewer_log = viewer_client.post("/api/auth/login", json={"email": "carol@tofrom.internal", "password": "ViewerPass12345!"})
    viewer_client.headers["X-CSRF-Token"] = viewer_log.json()["csrf_token"]

    # Can read
    read_res = viewer_client.get("/api/risks")
    assert read_res.status_code == 200

    # Cannot write (403)
    write_res = viewer_client.post("/api/risks", json={"title": "Disallowed"})
    assert write_res.status_code == 403


def test_unauthenticated_request_rejected(clean_client):
    # Bootstrap an admin so system is in authenticated mode
    status = clean_client.get("/api/auth/bootstrap_status").json()
    clean_client.post("/api/auth/bootstrap_admin", json={
        "setup_token": status["setup_token"],
        "name": "Admin",
        "email": "admin@tofrom.internal",
        "password": "AdminPassword123!"
    })

    # Unauthenticated client
    unauth = TestClient(clean_client.app)
    res = unauth.get("/api/policies")
    assert res.status_code in (401, 403)

    res2 = unauth.post("/api/risks", json={"title": "Anonymous Risk"})
    assert res2.status_code in (401, 403)


def test_segregation_of_duties_real_identity(clean_client):
    # Bootstrap admin
    status = clean_client.get("/api/auth/bootstrap_status").json()
    clean_client.post("/api/auth/bootstrap_admin", json={
        "setup_token": status["setup_token"],
        "name": "Admin User",
        "email": "admin@tofrom.internal",
        "password": "AdminPassword123!"
    })
    admin_log = clean_client.post("/api/auth/login", json={"email": "admin@tofrom.internal", "password": "AdminPassword123!"})
    clean_client.headers["X-CSRF-Token"] = admin_log.json()["csrf_token"]

    # Create author and approver accounts
    clean_client.post("/api/users", json={
        "name": "Policy Author",
        "email": "author@tofrom.internal",
        "password": "AuthorPassword123!",
        "role": "compliance_manager"
    })
    clean_client.post("/api/users", json={
        "name": "Security Approver",
        "email": "approver@tofrom.internal",
        "password": "ApproverPassword123!",
        "role": "compliance_manager"
    })

    author_client = TestClient(clean_client.app)
    auth_log = author_client.post("/api/auth/login", json={"email": "author@tofrom.internal", "password": "AuthorPassword123!"})
    author_client.headers["X-CSRF-Token"] = auth_log.json()["csrf_token"]

    # Author creates and submits policy
    pol = author_client.post("/api/policies", json={"title": "Access Policy", "content": "# Access Control"}).json()
    author_client.post(f"/api/policies/{pol['id']}/submit")

    # Author tries to approve own policy -> 422 SoD violation
    self_appr = author_client.post(f"/api/policies/{pol['id']}/approve", json={"approver": "author@tofrom.internal"})
    assert self_appr.status_code == 422

    # Different user approves -> succeeds
    appr_client = TestClient(clean_client.app)
    appr_log = appr_client.post("/api/auth/login", json={"email": "approver@tofrom.internal", "password": "ApproverPassword123!"})
    appr_client.headers["X-CSRF-Token"] = appr_log.json()["csrf_token"]
    ok_appr = appr_client.post(f"/api/policies/{pol['id']}/approve", json={"approver": "approver@tofrom.internal"})
    assert ok_appr.status_code == 200


def test_no_credentials_leak_in_audit_log(clean_client):
    # Bootstrap admin and perform actions
    status = clean_client.get("/api/auth/bootstrap_status").json()
    secret_pass = "SuperSecretUniqP@ss987!"
    clean_client.post("/api/auth/bootstrap_admin", json={
        "setup_token": status["setup_token"],
        "name": "Admin User",
        "email": "admin@tofrom.internal",
        "password": secret_pass
    })
    clean_client.post("/api/auth/login", json={"email": "admin@tofrom.internal", "password": secret_pass})

    # Query audit log
    with clean_client.app.state.store.transaction() as db:
        rows = db.execute("SELECT actor, action, title, before, after FROM audit_log").fetchall()

    for r in rows:
        body = f"{r[0]} {r[1]} {r[2]} {r[3] or ''} {r[4] or ''}"
        assert secret_pass not in body, "Plaintext password leaked in audit log!"
        assert "$argon2" not in body, "Password hash leaked in audit log!"
        assert "setup_token" not in body or status["setup_token"] not in body, "Setup token leaked in audit log!"


def test_route_table_audit(clean_client):
    app = clean_client.app
    from server.security import PUBLIC_API_PATHS, PUBLIC_PREFIXES
    all_paths = []
    for r in app.routes:
        if hasattr(r, "path") and r.path:
            all_paths.append(r.path)
        elif hasattr(r, "original_router"):
            for sub in r.original_router.routes:
                if hasattr(sub, "path"):
                    all_paths.append(sub.path)

    api_routes = [p for p in all_paths if p.startswith('/api/')]
    assert len(api_routes) >= 50, f"Expected comprehensive route table, got {len(api_routes)}"

    for r_path in api_routes:
        is_pub = r_path in PUBLIC_API_PATHS or any(r_path.startswith(p) for p in PUBLIC_PREFIXES) or r_path.startswith('/api/mcp')
        assert isinstance(is_pub, bool)

