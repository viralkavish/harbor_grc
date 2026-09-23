#!/usr/bin/env python3
"""Harbor GRC Version Bump & Changelog Sync Utility.

Ensures every release adheres to Semantic Versioning (SemVer 2.0.0) and maintains
100% synchronization across frontend UI, in-app changelog, backend FastAPI app,
Cloudflare Worker, and test assertions.

Usage:
    python scripts/bump_version.py --type patch --title "Fix X" --highlights "Fixed issue A" "Updated B"
    python scripts/bump_version.py --type minor --title "Feature Y" --highlights "Added feature C"
    python scripts/bump_version.py --type major --title "Version 1.0" --highlights "Major release"
    python scripts/bump_version.py --check  # Verifies all files are in sync
"""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent

VERSION_FILE = PROJECT_ROOT / "client" / "src" / "version.ts"
CHANGELOG_MD = PROJECT_ROOT / "CHANGELOG.md"
PACKAGE_JSON = PROJECT_ROOT / "client" / "package.json"
SERVER_APP = PROJECT_ROOT / "server" / "app.py"
WORKER_INDEX = PROJECT_ROOT / "worker" / "index.ts"
TEST_CORE = PROJECT_ROOT / "tests" / "backend" / "test_core.py"


def get_current_version() -> str:
    content = VERSION_FILE.read_text(encoding="utf-8")
    m = re.search(r"export const APP_VERSION = '([^']+)';", content)
    if not m:
        raise ValueError(f"Could not parse APP_VERSION from {VERSION_FILE}")
    return m.group(1)


def compute_next_version(current: str, bump_type: str) -> str:
    parts = list(map(int, current.split(".")))
    if len(parts) != 3:
        raise ValueError(f"Invalid SemVer: {current}")
    major, minor, patch = parts
    if bump_type == "major":
        return f"{major + 1}.0.0"
    elif bump_type == "minor":
        return f"{major}.{minor + 1}.0"
    elif bump_type == "patch":
        return f"{major}.{minor}.{patch + 1}"
    else:
        raise ValueError(f"Unknown bump type: {bump_type}")


def update_version_ts(new_version: str, release_date: str, title: str, highlights: list[str]) -> None:
    content = VERSION_FILE.read_text(encoding="utf-8")
    content = re.sub(r"export const APP_VERSION = '[^']+';", f"export const APP_VERSION = '{new_version}';", content)
    content = re.sub(r"export const RELEASE_DATE = '[^']+';", f"export const RELEASE_DATE = '{release_date}';", content)

    # Demote previous 'Latest' badge in CHANGELOG array to empty or 'Stable'
    content = content.replace("badge: 'Latest',", "badge: 'Stable',")

    # Format new changelog entry in TypeScript
    js_highlights = ",\n".join(f"      {json.dumps(h)}" for h in highlights)
    new_entry = f"""  {{
    version: '{new_version}',
    date: '{release_date}',
    badge: 'Latest',
    title: {json.dumps(title)},
    highlights: [
{js_highlights}
    ]
  }},"""

    marker = "export const CHANGELOG: ChangelogEntry[] = ["
    if marker in content:
        content = content.replace(marker, f"{marker}\n{new_entry}")
    else:
        raise ValueError("Could not find CHANGELOG array marker in version.ts")

    VERSION_FILE.write_text(content, encoding="utf-8")
    print(f"✓ Updated {VERSION_FILE.relative_to(PROJECT_ROOT)}")


def update_changelog_md(new_version: str, release_date: str, title: str, highlights: list[str], bump_type: str) -> None:
    content = CHANGELOG_MD.read_text(encoding="utf-8")
    section_name = "Added" if bump_type in ("major", "minor") else "Fixed"

    md_highlights = "\n".join(f"- {h}" for h in highlights)
    new_section = f"""## [{new_version}] - {release_date}

### {section_name}
- **{title}**
{md_highlights}

---
"""

    marker = "---\n\n## ["
    if marker in content:
        content = content.replace(marker, f"---\n\n{new_section}\n## [", 1)
    else:
        content += f"\n\n{new_section}"

    CHANGELOG_MD.write_text(content, encoding="utf-8")
    print(f"✓ Updated {CHANGELOG_MD.relative_to(PROJECT_ROOT)}")


def update_package_json(new_version: str) -> None:
    data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    data["version"] = new_version
    PACKAGE_JSON.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"✓ Updated {PACKAGE_JSON.relative_to(PROJECT_ROOT)}")


def update_server_app(new_version: str) -> None:
    content = SERVER_APP.read_text(encoding="utf-8")
    content = re.sub(r"app = FastAPI\(title='(?:Harbor|TwoFrom|tofrom)(?:GRC|\s+GRC)', version='[^']+'", f"app = FastAPI(title='tofromGRC', version='{new_version}'", content)
    content = re.sub(r"'version': '[^']+', 'storage': 'sqlite'", f"'version': '{new_version}', 'storage': 'sqlite'", content)
    SERVER_APP.write_text(content, encoding="utf-8")
    print(f"✓ Updated {SERVER_APP.relative_to(PROJECT_ROOT)}")


def update_worker_index(new_version: str) -> None:
    content = WORKER_INDEX.read_text(encoding="utf-8")
    content = re.sub(
        r'(pathname === "/api/health"\)[\s\S]*?version:\s*")[^"]+(")',
        rf'\g<1>{new_version}\g<2>',
        content
    )
    WORKER_INDEX.write_text(content, encoding="utf-8")
    print(f"✓ Updated {WORKER_INDEX.relative_to(PROJECT_ROOT)}")


def update_test_core(new_version: str) -> None:
    content = TEST_CORE.read_text(encoding="utf-8")
    content = re.sub(r"'status': 'ok', 'version': '[^']+', 'storage': 'sqlite'", f"'status': 'ok', 'version': '{new_version}', 'storage': 'sqlite'", content)
    TEST_CORE.write_text(content, encoding="utf-8")
    print(f"✓ Updated {TEST_CORE.relative_to(PROJECT_ROOT)}")


def check_sync() -> bool:
    cur = get_current_version()
    pkg_ver = json.loads(PACKAGE_JSON.read_text(encoding="utf-8")).get("version")
    app_ver_m = re.search(r"version='([^']+)'", SERVER_APP.read_text(encoding="utf-8"))
    app_ver = app_ver_m.group(1) if app_ver_m else None
    worker_ver_m = re.search(r'pathname === "/api/health"\)[\s\S]*?version:\s*"([^"]+)"', WORKER_INDEX.read_text(encoding="utf-8"))
    worker_ver = worker_ver_m.group(1) if worker_ver_m else None

    print(f"Status check for Harbor GRC (target: {cur}):")
    print(f"  client/src/version.ts:  {cur}")
    print(f"  client/package.json:   {pkg_ver}")
    print(f"  server/app.py:         {app_ver}")
    print(f"  worker/index.ts:       {worker_ver}")

    ok = (cur == pkg_ver == app_ver == worker_ver)
    if ok:
        print("✓ All files are 100% synchronized!")
    else:
        print("✗ Version mismatch detected!")
    return ok


def main():
    parser = argparse.ArgumentParser(description="Bump Harbor GRC version and update changelog.")
    parser.add_argument("--type", choices=["patch", "minor", "major"], help="SemVer increment type")
    parser.add_argument("--version", help="Explicit version override (e.g. 0.3.0)")
    parser.add_argument("--title", help="Changelog release title")
    parser.add_argument("--highlights", nargs="+", help="Release highlights / bullet points")
    parser.add_argument("--check", action="store_true", help="Check synchronization without modifying files")

    args = parser.parse_args()

    if args.check:
        sys.exit(0 if check_sync() else 1)

    if not args.type and not args.version:
        parser.error("Must provide either --type [patch|minor|major] or --version X.Y.Z")

    current = get_current_version()
    new_version = args.version or compute_next_version(current, args.type)
    release_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bump_type = args.type or ("major" if new_version.endswith(".0.0") else "minor" if new_version.endswith(".0") else "patch")
    title = args.title or f"Release v{new_version}"
    highlights = args.highlights or [title]

    print(f"Bumping Harbor GRC: v{current} -> v{new_version} ({bump_type.upper()})")
    update_version_ts(new_version, release_date, title, highlights)
    update_changelog_md(new_version, release_date, title, highlights, bump_type)
    update_package_json(new_version)
    update_server_app(new_version)
    update_worker_index(new_version)
    update_test_core(new_version)

    print(f"\nSuccessfully bumped to v{new_version} and updated changelog across all project files!")
    check_sync()


if __name__ == "__main__":
    main()
