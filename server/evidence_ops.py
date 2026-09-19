"""Evidence file upload, integrity hashing, and safe download streaming."""
import hashlib
import json
from pathlib import Path
import re
from uuid import uuid4
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Response
from fastapi.responses import FileResponse
from .storage import Store, now
from .records import get_record, save, log
from .relations import validate_links, sync_links

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MiB


def evidence_router(store):
    router = APIRouter(prefix='/api/evidence')

    @router.post('/upload', status_code=201)
    async def upload_evidence(
        file: UploadFile = File(...),
        title: str | None = Form(None),
        description: str = Form(""),
        control_ids: str = Form("[]"),
        expires_date: str | None = Form(None)
    ):
        raw_filename = Path(file.filename or "evidence.bin").name
        safe_filename = re.sub(r'[^a-zA-Z0-9_.\-]+', '_', raw_filename).strip('_') or "evidence.bin"
        evidence_id = str(uuid4())
        internal_name = f"{evidence_id}_{safe_filename}"
        target_path = store.uploads / internal_name

        hasher = hashlib.sha256()
        total_bytes = 0

        try:
            with open(target_path, "wb") as f:
                while chunk := await file.read(64 * 1024):
                    total_bytes += len(chunk)
                    if total_bytes > MAX_UPLOAD_BYTES:
                        raise HTTPException(422, "File exceeds maximum upload size of 25 MiB")
                    hasher.update(chunk)
                    f.write(chunk)
            target_path.chmod(0o600)
        except Exception:
            if target_path.exists():
                target_path.unlink()
            raise

        parsed_control_ids = []
        if control_ids:
            try:
                parsed = json.loads(control_ids) if isinstance(control_ids, str) and control_ids.strip().startswith('[') else [control_ids]
                if isinstance(parsed, list):
                    parsed_control_ids = [str(x) for x in parsed if x]
            except Exception:
                parsed_control_ids = []

        if expires_date and not re.fullmatch(r'\d{4}-\d{2}-\d{2}', expires_date):
            expires_date = None

        evidence_record = {
            'id': evidence_id,
            'title': (title or safe_filename)[:240],
            'description': description[:5000],
            'status': 'collected',
            'source': 'manual',
            'url': '',
            'control_ids': parsed_control_ids,
            'collected_date': now()[:10],
            'expires_date': expires_date,
            'filename': safe_filename,
            'file_size': total_bytes,
            'sha256': hasher.hexdigest(),
            'owner': '',
            'due_date': None,
            'tags': ['uploaded'],
            'created_at': now(),
            'updated_at': now()
        }

        with store.transaction() as db:
            validate_links(db, 'evidence', evidence_record)
            save(db, 'evidence', evidence_record)
            sync_links(db, 'evidence', evidence_record)
            log(db, 'upload', 'evidence', evidence_record, {'file_size': total_bytes, 'sha256': evidence_record['sha256']})

        return evidence_record

    @router.get('/{evidence_id}/file')
    def download_evidence_file(evidence_id: str):
        with store.transaction() as db:
            record = get_record(db, 'evidence', evidence_id)
            if not record.get('filename'):
                raise HTTPException(404, "Evidence has no attached file")

            safe_filename = re.sub(r'[^a-zA-Z0-9_.\-]+', '_', record['filename']).strip('_')
            internal_name = f"{evidence_id}_{safe_filename}"
            file_path = (store.uploads / internal_name).resolve()

            # Path traversal prevention
            uploads_dir = store.uploads.resolve()
            if not str(file_path).startswith(str(uploads_dir)) or not file_path.is_file():
                raise HTTPException(404, "Attachment file not found on disk")

            return FileResponse(
                path=file_path,
                media_type='application/octet-stream',
                filename=safe_filename,
                headers={
                    'Content-Disposition': f'attachment; filename="{safe_filename}"',
                    'X-Content-Type-Options': 'nosniff'
                }
            )

    return router
