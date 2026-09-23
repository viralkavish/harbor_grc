"""Tests for R1: Versioned AICPA Trust Services Criteria (TSC 2017, as amended 2022) Control Catalog."""
import pytest
from fastapi.testclient import TestClient
from server.app import create_app
from server.tsc_catalog import TSC_CATALOG, CATALOG_VINTAGE


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path), base_url="http://127.0.0.1:8765") as c:
        token = c.get("/api/bootstrap").json()["csrf_token"]
        c.headers["X-CSRF-Token"] = token
        yield c


def test_tsc_catalog_all_61_criteria_present(client):
    """Asserts all 61 Trust Services Criteria (TSC-2017-2022) are present with complete fields."""
    res = client.get("/api/controls")
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    
    # Check total count is at least 61
    assert len(items) >= 61
    
    # Check all 61 codes are represented
    expected_cc = [f"CC1.{i}" for i in range(1, 6)] + \
                  [f"CC2.{i}" for i in range(1, 4)] + \
                  [f"CC3.{i}" for i in range(1, 5)] + \
                  [f"CC4.{i}" for i in range(1, 3)] + \
                  [f"CC5.{i}" for i in range(1, 4)] + \
                  [f"CC6.{i}" for i in range(1, 9)] + \
                  [f"CC7.{i}" for i in range(1, 6)] + \
                  ["CC8.1", "CC9.1", "CC9.2"]
    expected_a = [f"A1.{i}" for i in range(1, 4)]
    expected_c = [f"C1.{i}" for i in range(1, 3)]
    expected_pi = [f"PI1.{i}" for i in range(1, 6)]
    expected_p = ["P1.1", "P2.1", "P3.1", "P3.2", "P4.1", "P4.2", "P4.3", "P5.1", "P5.2",
                  "P6.1", "P6.2", "P6.3", "P6.4", "P6.5", "P6.6", "P6.7", "P7.1", "P8.1"]
    
    all_61_codes = expected_cc + expected_a + expected_c + expected_pi + expected_p
    assert len(all_61_codes) == 61
    
    present_codes = {item.get("code") for item in items}
    for code in all_61_codes:
        assert code in present_codes, f"Criterion {code} missing from controls!"
    
    # Check completeness of fields for each control
    for item in items:
        if not item.get("id", "").startswith("TF-"):
            continue
        assert item.get("catalog_vintage") == CATALOG_VINTAGE
        assert item.get("title"), f"Missing title on {item['id']}"
        assert item.get("description"), f"Missing description on {item['id']}"
        assert item.get("criterion_mapping"), f"Missing criterion_mapping on {item['id']}"
        assert isinstance(item.get("points_of_focus"), list) and len(item["points_of_focus"]) > 0, \
            f"Missing or empty points_of_focus on {item['id']}"
        assert item.get("owner"), f"Missing owner on {item['id']}"
        assert item.get("test_procedure"), f"Missing test_procedure on {item['id']}"
        assert item.get("evidence_requirement"), f"Missing evidence_requirement on {item['id']}"
        assert item.get("type") in ("preventive", "detective", "corrective"), f"Invalid type on {item['id']}"
        assert item.get("nature") in ("manual", "automated"), f"Invalid nature on {item['id']}"
        assert item.get("frequency") in ("annual", "quarterly", "monthly", "weekly", "daily", "continuous"), \
            f"Invalid frequency on {item['id']}"


def test_catalog_meta_endpoint(client):
    """Asserts GET /api/controls/catalog_meta exposes the catalog vintage and criteria distribution."""
    res = client.get("/api/controls/catalog_meta")
    assert res.status_code == 200, res.text
    meta = res.json()
    assert meta["vintage"] == "TSC-2017-2022"
    assert meta["total_criteria"] == 61
    assert meta["breakdown"]["common_criteria"] == 33
    assert meta["breakdown"]["availability"] == 3
    assert meta["breakdown"]["confidentiality"] == 2
    assert meta["breakdown"]["processing_integrity"] == 5
    assert meta["breakdown"]["privacy"] == 18


def test_control_versioning_and_retrieval(client):
    """Asserts editing a control creates a new immutable version and historical version is retrievable."""
    cid = "TF-CC6.1-01"
    
    # 1. Fetch initial control state
    c_res = client.get(f"/api/controls/{cid}")
    assert c_res.status_code == 200, c_res.text
    c_data = c_res.json()
    orig_title = c_data["title"]
    orig_version = c_data.get("version", 1)
    
    # 2. Update control definition
    new_desc = "Updated MFA enforcement procedure during Q3 audit observation window."
    patch_res = client.patch(f"/api/controls/{cid}", json={
        "title": f"{orig_title} [Hardened]",
        "description": new_desc
    })
    assert patch_res.status_code == 200, patch_res.text
    updated = patch_res.json()
    assert updated["version"] == orig_version + 1
    assert updated["description"] == new_desc
    assert updated["title"] == f"{orig_title} [Hardened]"
    
    # 3. List version history
    versions_res = client.get(f"/api/controls/{cid}/versions")
    assert versions_res.status_code == 200, versions_res.text
    v_list = versions_res.json()["versions"]
    assert len(v_list) >= 1
    assert any(v["version"] == orig_version for v in v_list)
    
    # 4. Retrieve exact historical version
    hist_res = client.get(f"/api/controls/{cid}/versions/{orig_version}")
    assert hist_res.status_code == 200, hist_res.text
    hist_snapshot = hist_res.json()
    assert hist_snapshot["version"] == orig_version
    assert hist_snapshot["body"]["title"] == orig_title
    assert hist_snapshot["body"]["description"] == c_data["description"]
