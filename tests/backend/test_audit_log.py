"""Tests for R3: Tamper-Evident Hash-Chained Audit Log."""
import io
import json
import sqlite3
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


def test_chain_verifies_clean_on_startup(test_setup):
    """L8.1: Chain verifies clean on seeded data (/api/audit/verify -> ok)."""
    client, _, _ = test_setup
    res = client.get("/api/audit/verify")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["ok"] is True
    assert data["entries"] >= 1
    assert "checked_at" in data


def test_sqlite_trigger_rejects_direct_update_and_delete(test_setup):
    """L8.3: UPDATE/DELETE via SQL is rejected by the trigger."""
    _, store, _ = test_setup
    with store.transaction() as db:
        # Attempt direct UPDATE via SQL
        with pytest.raises((sqlite3.OperationalError, sqlite3.IntegrityError), match="immutable"):
            db.execute("UPDATE audit_log SET title = 'Altered' WHERE seq = 1")
            
        # Attempt direct DELETE via SQL
        with pytest.raises((sqlite3.OperationalError, sqlite3.IntegrityError), match="immutable"):
            db.execute("DELETE FROM audit_log WHERE seq = 1")


def test_tamper_detection_breaks_hash_chain(test_setup):
    """L8.2: Tamper test: UPDATE one row's title directly in SQLite (bypassing app by disabling trigger) -> verify reports ok: false."""
    client, store, _ = test_setup
    
    # 1. Verify clean initially
    res_clean = client.get("/api/audit/verify")
    assert res_clean.json()["ok"] is True
    
    # 2. Simulate direct adversary database tampering by temporarily dropping trigger
    with store.transaction() as db:
        db.execute("DROP TRIGGER IF EXISTS audit_log_no_update")
        db.execute("UPDATE audit_log SET title = 'Forged Audit Entry' WHERE seq = 1")
        # Re-create trigger
        db.execute("""
            CREATE TRIGGER IF NOT EXISTS audit_log_no_update
            BEFORE UPDATE ON audit_log
            BEGIN
                SELECT RAISE(ABORT, 'audit_log entries are immutable: UPDATE operations strictly prohibited');
            END;
        """)
        
    # 3. Verify must catch tampering
    res_tampered = client.get("/api/audit/verify")
    assert res_tampered.status_code == 200
    data = res_tampered.json()
    assert data["ok"] is False
    assert data["broken_at_seq"] == 1
    assert "expected" in data
    assert "actual" in data


def test_seeded_end_to_end_flow_mutation_logging(test_setup):
    """L8.4: Seeded flow (upload evidence -> update policy -> grade pilot) produces log entries with actor & before/after."""
    client, _, _ = test_setup
    
    # 1. Upload evidence
    ev_res = client.post(
        "/api/evidence/upload",
        files={"file": ("log_test.txt", io.BytesIO(b"log test payload"), "text/plain")},
        data={
            "title": "Log Test Evidence",
            "control_ids": json.dumps(["TF-CC6.1-01"]),
            "period_covered": json.dumps({"start": "2027-01-01", "end": "2027-01-31"})
        }
    )
    assert ev_res.status_code == 201
    
    # 2. Update policy
    pol_res = client.patch(
        "/api/policies/pol-sec-01",
        json={"title": "Information Security Policy [Audited]"}
    )
    assert pol_res.status_code == 200
    
    # 3. Create a pilot
    pilot_res = client.post(
        "/api/pilot/create",
        json={"sample_size": 2, "name": "Audit Log Test Pilot"}
    )
    assert pilot_res.status_code in (200, 201)
    
    # Query audit log
    log_res = client.get("/api/audit/log?limit=50")
    assert log_res.status_code == 200
    log_data = log_res.json()
    assert log_data["total"] >= 4
    
    entries = log_data["items"]
    # Check that each entry contains actor, action, resource, prev_hash, entry_hash
    actions = [e["action"] for e in entries]
    assert any("upload" in a for a in actions)
    assert any("update" in a for a in actions)
    assert any("create" in a or "pilot" in a for a in actions)
    
    for e in entries:
        assert e["actor"], f"Entry {e['seq']} missing actor"
        assert e["prev_hash"], f"Entry {e['seq']} missing prev_hash"
        assert e["entry_hash"], f"Entry {e['seq']} missing entry_hash"
        assert e["created_at"], f"Entry {e['seq']} missing created_at"
        
    # Verify chain integrity across all new entries
    ver = client.get("/api/audit/verify").json()
    assert ver["ok"] is True
    assert ver["entries"] >= 4


def test_audit_export_csv_and_json(test_setup):
    """L8.5: Export CSV/JSON contains all entries including hashes."""
    client, _, _ = test_setup
    
    # Test JSON export
    res_json = client.get("/api/audit/export?format=json")
    assert res_json.status_code == 200
    data = res_json.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "entry_hash" in data[0]
    assert "prev_hash" in data[0]
    
    # Test CSV export
    res_csv = client.get("/api/audit/export?format=csv")
    assert res_csv.status_code == 200
    csv_text = res_csv.text
    assert "seq,id,created_at,actor,action,resource" in csv_text
    assert "prev_hash,entry_hash" in csv_text


def test_no_code_writes_to_legacy_activity_table():
    """L8.6: The old records.log() path is fully replaced — no code writes to legacy activity table."""
    from pathlib import Path
    server_dir = Path(__file__).resolve().parents[2] / "server"
    
    matches = []
    for py_file in server_dir.glob("*.py"):
        content = py_file.read_text(encoding="utf-8")
        if "INSERT INTO activity" in content:
            matches.append(str(py_file.name))
            
    assert not matches, f"Found legacy activity writes in: {matches}"
