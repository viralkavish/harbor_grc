"""Snapshot backup generation matching scripts/restore.py validation rules."""
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import zipfile
from fastapi import APIRouter, Response
from .storage import now


def backup_router(store):
    router = APIRouter(prefix='/api')

    @router.get('/backup')
    def get_backup():
        mem_buffer = io.BytesIO()

        with tempfile.NamedTemporaryFile(suffix='.db', delete=True) as temp_db:
            # Create a consistent snapshot of the SQLite database under store.lock
            with store.lock:
                src = sqlite3.connect(store.path)
                dest = sqlite3.connect(temp_db.name)
                src.backup(dest)
                dest.close()
                src.close()

            with zipfile.ZipFile(mem_buffer, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
                # 1. Manifest
                manifest_data = {
                    'format': 'harbor-grc',
                    'version': 1,
                    'database': 'harbor.db',
                    'created_at': now()
                }
                zf.writestr('manifest.json', json.dumps(manifest_data, indent=2))

                # 2. Database
                zf.write(temp_db.name, arcname='harbor.db')

                # 3. Uploads directory and files
                zf.writestr('uploads/', '')
                uploads_dir = store.uploads
                if uploads_dir.exists():
                    for file_path in uploads_dir.iterdir():
                        if file_path.is_file():
                            zf.write(file_path, arcname=f"uploads/{file_path.name}")

        mem_buffer.seek(0)
        timestamp = now()[:10]
        filename = f"harbor-backup-{timestamp}.zip"

        return Response(
            content=mem_buffer.getvalue(),
            media_type='application/zip',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'X-Content-Type-Options': 'nosniff'
            }
        )

    return router
