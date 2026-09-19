"""Offline restore acceptance tests use private temporary directories only."""
from __future__ import annotations

import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import zipfile

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "restore.py"


def make_backup(tmp_path: Path, extra: dict[str, bytes] | None = None) -> Path:
    source = tmp_path / "source.db"
    con = sqlite3.connect(source)
    con.execute("CREATE TABLE verification (value TEXT)")
    con.execute("INSERT INTO verification VALUES (?)", ("persisted value",))
    con.commit()
    con.close()
    archive = tmp_path / "snapshot.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps({"format": "harbor-grc", "version": 1, "database": "harbor.db"}))
        z.write(source, "harbor.db")
        z.writestr("uploads/evidence.txt", b"original evidence\n")
        for path, value in (extra or {}).items():
            z.writestr(path, value)
    return archive


def run_restore(archive: Path, target: Path) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPT), str(archive), "--target", str(target)], capture_output=True, text=True)


def test_restores_consistent_database_and_evidence_to_new_directory(tmp_path):
    archive = make_backup(tmp_path)
    target = tmp_path / "restored"
    result = run_restore(archive, target)
    assert result.returncode == 0, result.stderr
    with sqlite3.connect(target / "harbor.db") as con:
        assert con.execute("SELECT value FROM verification").fetchone() == ("persisted value",)
    assert (target / "uploads/evidence.txt").read_bytes() == b"original evidence\n"
    assert target.stat().st_mode & 0o077 == 0
    assert (target / "harbor.db").stat().st_mode & 0o077 == 0


@pytest.mark.parametrize("unsafe_name", ["../outside.txt", "/tmp/harbor-outside.txt", "uploads/../secret.txt", "uploads/nested/file.txt", "uploads\\escape.txt", "unexpected.env"])
def test_rejects_unsafe_or_unknown_archive_members_without_writes(tmp_path, unsafe_name):
    archive = make_backup(tmp_path, {unsafe_name: b"untrusted"})
    target = tmp_path / "restored"
    result = run_restore(archive, target)
    assert result.returncode != 0
    assert "unsafe" in result.stderr.lower()
    assert not target.exists()
    assert not (tmp_path / "outside.txt").exists()


@pytest.mark.parametrize("change", ["manifest", "database", "duplicate", "symlink", "oversized", "missing_manifest"])
def test_rejects_invalid_backups_without_installing_them(tmp_path, change):
    archive = make_backup(tmp_path)
    with zipfile.ZipFile(archive) as z:
        members = {name: z.read(name) for name in z.namelist()}
    if change == "manifest":
        members["manifest.json"] = b'{"format":"other-product","version":99,"database":"harbor.db"}'
    if change == "database":
        members["harbor.db"] = b"not a database"
    if change == "missing_manifest":
        del members["manifest.json"]
    if change == "oversized":
        members["manifest.json"] = b" " * (65536 + 1)
    with zipfile.ZipFile(archive, "w") as z:
        for name, content in members.items():
            z.writestr(name, content)
        if change == "duplicate":
            with pytest.warns(UserWarning):
                z.writestr("harbor.db", members["harbor.db"])
        if change == "symlink":
            info = zipfile.ZipInfo("uploads/link")
            info.create_system = 3
            info.external_attr = 0o120777 << 16
            z.writestr(info, b"/etc/passwd")
    target = tmp_path / "restored"
    result = run_restore(archive, target)
    assert result.returncode != 0
    assert not target.exists()


def test_never_overwrites_existing_data(tmp_path):
    archive = make_backup(tmp_path)
    target = tmp_path / "existing"
    target.mkdir()
    sentinel = target / "keep.txt"
    sentinel.write_text("my real data")
    result = run_restore(archive, target)
    assert result.returncode != 0
    assert sentinel.read_text() == "my real data"
