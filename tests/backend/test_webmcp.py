import json
from fastapi.testclient import TestClient
from server.app import create_app


def test_webmcp_well_known_discovery():
    client = TestClient(create_app(), base_url="http://127.0.0.1:8765")
    
    # 1. /.well-known/web-mcp
    res = client.get("/.well-known/web-mcp")
    assert res.status_code == 200, f"Expected 200 from /.well-known/web-mcp, got {res.status_code}"
    data = res.json()
    assert "tools" in data, "Discovery JSON must include 'tools'"
    assert "protocol_version" in data
    assert len(data["tools"]) >= 8, f"Expected at least 8 WebMCP tools, got {len(data['tools'])}"
    
    tool_names = [t["name"] for t in data["tools"]]
    assert "navigate_view" in tool_names
    assert "get_workspace_overview" in tool_names
    assert "get_framework_harmonization" in tool_names
    assert "list_records" in tool_names
    assert "create_record" in tool_names
    assert "evaluate_policy_jev" in tool_names


def test_webmcp_jsonrpc_tools_list_and_call():
    client = TestClient(create_app(), base_url="http://127.0.0.1:8765")
    
    # 1. JSON-RPC tools/list
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list",
        "params": {}
    }
    res = client.post("/api/mcp", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["jsonrpc"] == "2.0"
    assert "result" in data
    assert "tools" in data["result"]
    assert any(t["name"] == "get_workspace_overview" for t in data["result"]["tools"])
    
    # 2. JSON-RPC tools/call (get_workspace_overview)
    call_payload = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": "get_workspace_overview",
            "arguments": {}
        }
    }
    res = client.post("/api/mcp", json=call_payload)
    assert res.status_code == 200
    call_data = res.json()
    assert "result" in call_data
    content = call_data["result"].get("content", [])
    assert len(content) > 0
    assert "readiness" in content[0]["text"]
