"""Enforces the project rule: Every change must record a version bump and changelog entry."""

import json
from pathlib import Path
import re
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def test_version_synchronization():
    # 1. Parse client/src/version.ts
    version_ts = (PROJECT_ROOT / "client" / "src" / "version.ts").read_text(encoding="utf-8")
    m_ver = re.search(r"export const APP_VERSION = '([^']+)';", version_ts)
    assert m_ver is not None, "Could not find APP_VERSION in client/src/version.ts"
    current_version = m_ver.group(1)

    # 2. Check client/package.json
    pkg = json.loads((PROJECT_ROOT / "client" / "package.json").read_text(encoding="utf-8"))
    assert pkg.get("version") == current_version, f"package.json version {pkg.get('version')} does not match {current_version}"

    # 3. Check server/app.py
    server_app = (PROJECT_ROOT / "server" / "app.py").read_text(encoding="utf-8")
    m_app = re.search(r"FastAPI\(title='Harbor GRC', version='([^']+)'", server_app)
    assert m_app is not None and m_app.group(1) == current_version, f"server/app.py version mismatch with {current_version}"

    # 4. Check worker/index.ts
    worker_ts = (PROJECT_ROOT / "worker" / "index.ts").read_text(encoding="utf-8")
    m_worker = re.search(r'pathname === "/api/health"\)[\s\S]*?version:\s*"([^"]+)"', worker_ts)
    assert m_worker is not None and m_worker.group(1) == current_version, f"worker/index.ts version mismatch with {current_version}"

    # 5. Check CHANGELOG.md contains current version heading
    changelog_md = (PROJECT_ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    assert f"## [{current_version}]" in changelog_md, f"CHANGELOG.md missing heading for ## [{current_version}]"

    # 6. Check client/src/version.ts CHANGELOG array contains current version entry
    assert f"version: '{current_version}'" in version_ts, f"client/src/version.ts CHANGELOG array missing entry for {current_version}"
