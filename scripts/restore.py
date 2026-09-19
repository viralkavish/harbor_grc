#!/usr/bin/env python3
"""Restore a Harbor GRC backup into a NEW directory; never overwrite live data."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import sqlite3
import stat
import sys
import tempfile
import zipfile


def validate_archive(source: zipfile.ZipFile) -> None:
    members = source.infolist()
    names = [info.filename for info in members]
    if len(names) != len(set(names)):
        raise ValueError("Duplicate archive members are not permitted")
    if sum(info.file_size for info in members) > 512 * 1024 * 1024:
        raise ValueError("Backup exceeds the 512 MiB offline restore limit")
    for info in members:
        name = info.filename
        is_upload = name.startswith("uploads/") and name.count("/") == 1 and name.removeprefix("uploads/") not in ("", ".", "..")
        if "\\" in name or name not in ("manifest.json", "harbor.db", "uploads/") and not is_upload:
            raise ValueError(f"Unsafe archive member: {name!r}")
        kind = stat.S_IFMT(info.external_attr >> 16)
        if kind not in (0, stat.S_IFREG, stat.S_IFDIR) or (kind == stat.S_IFDIR and name != "uploads/"):
            raise ValueError("Links and special files are not permitted")
    if "manifest.json" not in names or "harbor.db" not in names:
        raise ValueError("Not a Harbor GRC backup: missing manifest or database")
    if source.getinfo("manifest.json").file_size > 65536:
        raise ValueError("Backup manifest is too large")
    manifest = json.loads(source.read("manifest.json"))
    if not isinstance(manifest, dict) or manifest.get("format") != "harbor-grc" or manifest.get("version") != 1 or manifest.get("database") != "harbor.db":
        raise ValueError("Unsupported backup format or version")


def restore(archive: Path, target: Path) -> None:
    if target.exists() or target.is_symlink():
        raise ValueError("Target must be a new, nonexistent directory. Stop the app and keep the old data as a backup.")
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".harbor-restore-", dir=target.parent) as temp:
        stage = Path(temp) / "data"
        stage.mkdir(mode=0o700)
        (stage / "uploads").mkdir(mode=0o700)
        with zipfile.ZipFile(archive) as source:
            validate_archive(source)
            (stage / "harbor.db").write_bytes(source.read("harbor.db"))
            (stage / "harbor.db").chmod(0o600)
            for name in source.namelist():
                if name.startswith("uploads/") and not name.endswith("/"):
                    destination = stage / "uploads" / Path(name).name
                    with source.open(name) as incoming, destination.open("xb") as outgoing:
                        shutil.copyfileobj(incoming, outgoing)
                    destination.chmod(0o600)
        connection = sqlite3.connect((stage / "harbor.db").as_uri() + "?mode=ro", uri=True)
        try:
            if connection.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
                raise ValueError("SQLite integrity check failed")
        finally:
            connection.close()
        os.rename(stage, target)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--target", type=Path, required=True, help="New directory to restore into; must not already exist")
    args = parser.parse_args()
    os.umask(0o077)
    try:
        restore(args.archive, args.target)
    except (ValueError, OSError, KeyError, zipfile.BadZipFile, sqlite3.Error) as error:
        print(f"Restore refused: {error}", file=sys.stderr)
        return 1
    print(f"Restored to {args.target.resolve()}. Keep the service stopped until this directory is selected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
