import json
from fastapi.testclient import TestClient
from server.app import create_app


def test_webmcp_well_known_discovery_all_tools():
    client = TestClient(create_app(), base_url="http://127.0.0.1:8765")
    
    # 1. Check /.well-known/web-mcp
    res = client.get("/.well-known/web-mcp")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()
    assert "tools" in data
    assert data["protocol"] == "webmcp"
    assert len(data["tools"]) >= 20, f"Expected at least 20 WebMCP tools, got {len(data['tools'])}"
    
    tool_names = {t["name"] for t in data["tools"]}
    expected_tools = [
        "navigate_view", "get_workspace_overview", "search_workspace",
        "list_records", "get_record", "create_record", "update_record", "delete_record",
        "run_continuous_checks", "get_framework_harmonization", "get_roadmap",
        "update_roadmap_task", "verify_live_readiness", "get_soc2_readiness",
        "generate_audit_sample", "get_auditor_hub", "update_pbc_status",
        "evaluate_policy_jev", "link_compatible_controls", "get_policy_versions",
        "auto_populate_system_description", "analyze_vendor_soc2", "auto_fill_questionnaire"
    ]
    for et in expected_tools:
        assert et in tool_names, f"Expected tool '{et}' to be registered in WebMCP catalog"


def test_webmcp_security_and_redaction():
    client = TestClient(create_app(), base_url="http://127.0.0.1:8765")
    
    # 1. Attempt invalid resource access / traversal
    res = client.post("/api/mcp", json={
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "list_records",
            "arguments": {"resource": "../../etc/passwd"}
        }
    })
    assert res.status_code == 200
    data = res.json()
    assert data["result"]["isError"] is True, "Must reject path traversal in resource names"
    
    # 2. Workspace overview must not leak raw API keys
    res = client.post("/api/mcp", json={
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": "get_workspace_overview",
            "arguments": {}
        }
    })
    assert res.status_code == 200
    text = json.dumps(res.json())
    assert "apikey_21687f1" not in text, "Must never leak real API keys in WebMCP responses"


def test_webmcp_crud_lifecycle():
    client = TestClient(create_app(), base_url="http://127.0.0.1:8765")
    
    # 1. Create a task via WebMCP
    create_res = client.post("/api/mcp", json={
        "jsonrpc": "2.0",
        "id": 10,
        "method": "tools/call",
        "params": {
            "name": "create_record",
            "arguments": {
                "resource": "tasks",
                "payload": {
                    "title": "WebMCP Automated Compliance Sweep",
                    "priority": "high",
                    "status": "todo"
                }
            }
        }
    })
    assert create_res.status_code == 200
    result_obj = json.loads(create_res.json()["result"]["content"][0]["text"])
    assert result_obj["created"] is True
    record_id = result_obj["item"]["id"]
    
    # 2. Get the record
    get_res = client.post("/api/mcp", json={
        "jsonrpc": "2.0",
        "id": 11,
        "method": "tools/call",
        "params": {
            "name": "get_record",
            "arguments": {"resource": "tasks", "id": record_id}
        }
    })
    assert get_res.status_code == 200
    get_obj = json.loads(get_res.json()["result"]["content"][0]["text"])
    assert get_obj["item"]["title"] == "WebMCP Automated Compliance Sweep"
    
    # 3. Update the record
    update_res = client.post("/api/mcp", json={
        "jsonrpc": "2.0",
        "id": 12,
        "method": "tools/call",
        "params": {
            "name": "update_record",
            "arguments": {
                "resource": "tasks",
                "id": record_id,
                "payload": {"status": "done"}
            }
        }
    })
    assert update_res.status_code == 200
    update_obj = json.loads(update_res.json()["result"]["content"][0]["text"])
    assert update_obj["item"]["status"] == "done"
    
    # 4. Delete the record
    del_res = client.post("/api/mcp", json={
        "jsonrpc": "2.0",
        "id": 13,
        "method": "tools/call",
        "params": {
            "name": "delete_record",
            "arguments": {"resource": "tasks", "id": record_id}
        }
    })
    assert del_res.status_code == 200
    del_obj = json.loads(del_res.json()["result"]["content"][0]["text"])
    assert del_obj["deleted"] is True
