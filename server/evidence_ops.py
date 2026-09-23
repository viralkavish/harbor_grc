"""Evidence file upload, integrity hashing, versioning, and observation window coverage."""
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import re
from uuid import uuid4
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from .storage import Store, now
from .records import get_record, save, log
from .relations import validate_links, sync_links

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MiB


def date_from_str(s: str) -> date:
    return date.fromisoformat(s[:10])


def compute_interval_gaps(ranges: list[tuple[date, date]], win_start: date, win_end: date) -> list[dict]:
    """Calculates coverage intervals and identifies explicit gap intervals."""
    if not ranges:
        days = (win_end - win_start).days + 1
        return [{"start": win_start.isoformat(), "end": win_end.isoformat(), "days": max(0, days)}]

    sorted_r = sorted(ranges, key=lambda x: (x[0], x[1]))
    merged = []
    for r in sorted_r:
        if not merged:
            merged.append(r)
        else:
            prev_start, prev_end = merged[-1]
            if r[0] <= prev_end + timedelta(days=1):
                merged[-1] = (prev_start, max(prev_end, r[1]))
            else:
                merged.append(r)

    gaps = []
    # Check gap before first covered range
    if win_start < merged[0][0]:
        gap_end = min(win_end, merged[0][0] - timedelta(days=1))
        days = (gap_end - win_start).days + 1
        if days > 0:
            gaps.append({"start": win_start.isoformat(), "end": gap_end.isoformat(), "days": days})

    # Check gaps between ranges
    for i in range(len(merged) - 1):
        gap_start = merged[i][1] + timedelta(days=1)
        gap_end = merged[i + 1][0] - timedelta(days=1)
        if gap_start <= win_end and gap_end >= win_start and gap_start <= gap_end:
            actual_start = max(win_start, gap_start)
            actual_end = min(win_end, gap_end)
            days = (actual_end - actual_start).days + 1
            if days > 0:
                gaps.append({"start": actual_start.isoformat(), "end": actual_end.isoformat(), "days": days})

    # Check gap after last covered range
    if win_end > merged[-1][1]:
        gap_start = max(win_start, merged[-1][1] + timedelta(days=1))
        days = (win_end - gap_start).days + 1
        if days > 0:
            gaps.append({"start": gap_start.isoformat(), "end": win_end.isoformat(), "days": days})

    return gaps


def evidence_router(store: Store):
    router = APIRouter(prefix='/api/evidence')

    @router.get('/coverage')
    def evidence_coverage(
        control_id: str | None = None,
        window_start: str = "2027-01-01",
        window_end: str = "2027-12-31"
    ):
        """Calculates observation-window coverage intervals and explicit gaps for controls."""
        try:
            w_start = date_from_str(window_start)
            w_end = date_from_str(window_end)
        except Exception:
            raise HTTPException(400, "Invalid window_start or window_end date format (expected YYYY-MM-DD)")

        with store.transaction() as db:
            all_evidence = Store.records(db, 'evidence')

        # Filter by control_id if specified
        if control_id:
            matched_evidence = [
                e for e in all_evidence
                if control_id in e.get('control_ids', [])
            ]
        else:
            matched_evidence = all_evidence

        ranges: list[tuple[date, date]] = []
        for ev in matched_evidence:
            pc = ev.get('period_covered')
            if isinstance(pc, dict) and pc.get('start') and pc.get('end'):
                try:
                    s = date_from_str(pc['start'])
                    e = date_from_str(pc['end'])
                    if s <= e:
                        ranges.append((s, e))
                except Exception:
                    continue

        # Sort and merge ranges
        sorted_ranges = sorted(ranges, key=lambda x: (x[0], x[1]))
        merged_ranges: list[tuple[date, date]] = []
        for r in sorted_ranges:
            if not merged_ranges:
                merged_ranges.append(r)
            else:
                prev_s, prev_e = merged_ranges[-1]
                if r[0] <= prev_e + timedelta(days=1):
                    merged_ranges[-1] = (prev_s, max(prev_e, r[1]))
                else:
                    merged_ranges.append(r)

        gaps = compute_interval_gaps(ranges, w_start, w_end)
        total_days = max(1, (w_end - w_start).days + 1)
        uncovered_days = sum(g['days'] for g in gaps)
        covered_days = max(0, total_days - uncovered_days)
        coverage_pct = round((covered_days / total_days) * 100, 1)

        return {
            "control_id": control_id or "all",
            "window_start": window_start,
            "window_end": window_end,
            "is_fully_covered": len(gaps) == 0,
            "coverage_percentage": coverage_pct,
            "covered_ranges": [{"start": r[0].isoformat(), "end": r[1].isoformat()} for r in merged_ranges],
            "gaps": gaps,
            "evidence_count": len(matched_evidence),
            "uncovered_days": uncovered_days
        }

    @router.get('/expiring')
    def get_expiring_evidence(days: int = 30):
        """Returns evidence artifacts that are expired or expiring within N days."""
        today = date_from_str(now()[:10])
        limit_date = today + timedelta(days=days)
        with store.transaction() as db:
            items = Store.records(db, 'evidence')

        expired = []
        expiring_soon = []
        for ev in items:
            exp_str = ev.get('expires_date')
            if not exp_str:
                continue
            try:
                exp = date_from_str(exp_str)
                if exp < today:
                    expired.append(ev)
                elif exp <= limit_date:
                    expiring_soon.append(ev)
            except Exception:
                continue

        return {
            "expired_count": len(expired),
            "expiring_soon_count": len(expiring_soon),
            "expired": expired,
            "expiring_soon": expiring_soon
        }

    @router.post('/verify_all')
    def verify_all_evidence():
        """Batch integrity verification across all evidence artifacts on disk."""
        with store.transaction() as db:
            items = Store.records(db, 'evidence')
            verified = 0
            failed = 0
            failed_ids = []

            for record in items:
                if not record.get('filename'):
                    continue
                safe_filename = re.sub(r'[^a-zA-Z0-9_.\-]+', '_', record['filename']).strip('_')
                internal_name = f"{record['id']}_{safe_filename}"
                file_path = (store.uploads / internal_name).resolve()
                if not file_path.is_file():
                    record['integrity_status'] = 'failed'
                    failed += 1
                    failed_ids.append(record['id'])
                    save(db, 'evidence', record)
                    continue

                disk_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()
                if disk_hash == record.get('sha256'):
                    record['integrity_status'] = 'verified'
                    verified += 1
                else:
                    record['integrity_status'] = 'failed'
                    failed += 1
                    failed_ids.append(record['id'])
                save(db, 'evidence', record)

            return {
                "total": len(items),
                "verified": verified,
                "failed": failed,
                "failed_ids": failed_ids
            }

    @router.post('/upload', status_code=201)
    async def upload_evidence(
        file: UploadFile = File(...),
        title: str | None = Form(None),
        description: str = Form(""),
        control_ids: str = Form("[]"),
        period_covered: str | None = Form(None),
        period_start: str | None = Form(None),
        period_end: str | None = Form(None),
        source_system: str = Form("manual-upload"),
        collection_method: str = Form("manual"),
        retention_rule: str = Form("soc2-7yr"),
        legal_hold: str = Form("false"),
        supersedes_id: str | None = Form(None),
        expires_date: str | None = Form(None)
    ):
        raw_filename = Path(file.filename or "evidence.bin").name
        safe_filename = re.sub(r'[^a-zA-Z0-9_.\-]+', '_', raw_filename).strip('_') or "evidence.bin"
        evidence_id = str(uuid4())
        internal_name = f"{evidence_id}_{safe_filename}"
        target_path = store.uploads / internal_name

        # E6: Enforce period_covered for collected Type II evidence
        parsed_period = None
        if period_covered:
            try:
                parsed = json.loads(period_covered) if isinstance(period_covered, str) and (period_covered.strip().startswith('{') or period_covered.strip().startswith('[')) else period_covered
                if isinstance(parsed, dict) and parsed.get('start') and parsed.get('end'):
                    parsed_period = {"start": str(parsed['start'])[:10], "end": str(parsed['end'])[:10]}
            except Exception:
                pass
        if not parsed_period and period_start and period_end:
            parsed_period = {"start": str(period_start)[:10], "end": str(period_end)[:10]}

        if not parsed_period or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', parsed_period.get('start', '')) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', parsed_period.get('end', '')):
            raise HTTPException(422, "period_covered with valid start and end dates (YYYY-MM-DD) is required for collected SOC 2 Type II evidence.")

        # Window warning check
        window_warning = None
        if parsed_period['start'] < "2027-01-01" or parsed_period['end'] < "2027-01-01":
            window_warning = "Evidence period covers dates outside the target observation window (starts 2027-01-01). The auditor will evaluate relevance during fieldwork."

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

        is_legal_hold = str(legal_hold).lower() in ('true', '1', 'yes')

        with store.transaction() as db:
            ws = store.workspace(db)
            captured_by = ws.get('owner') or 'Security Lead'

            new_version = 1
            if supersedes_id:
                superseded = Store.get(db, 'evidence', supersedes_id)
                if not superseded:
                    raise HTTPException(404, f"Superseded evidence record {supersedes_id} not found")
                new_version = superseded.get('version', 1) + 1
                if not parsed_control_ids:
                    parsed_control_ids = superseded.get('control_ids', [])

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
                'captured_at': now(),
                'captured_by': captured_by,
                'source_system': source_system or 'manual-upload',
                'collection_method': collection_method or 'manual',
                'period_covered': parsed_period,
                'retention_rule': retention_rule or 'soc2-7yr',
                'legal_hold': is_legal_hold,
                'version': new_version,
                'supersedes_id': supersedes_id,
                'integrity_status': 'unchecked',
                'owner': '',
                'due_date': None,
                'tags': ['uploaded'],
                'created_at': now(),
                'updated_at': now()
            }
            if window_warning:
                evidence_record['window_warning'] = window_warning

            validate_links(db, 'evidence', evidence_record)
            save(db, 'evidence', evidence_record)
            sync_links(db, 'evidence', evidence_record)
            log(db, 'upload', 'evidence', evidence_record, {
                'file_size': total_bytes,
                'sha256': evidence_record['sha256'],
                'version': new_version,
                'supersedes_id': supersedes_id
            })

        return evidence_record

    @router.get('/{evidence_id}/versions')
    def get_evidence_versions(evidence_id: str):
        """Returns the full version chain for an evidence artifact, oldest to newest."""
        with store.transaction() as db:
            current = get_record(db, 'evidence', evidence_id)
            all_evidence = Store.records(db, 'evidence')

            # Map all records by id
            ev_map = {r['id']: r for r in all_evidence}

            # Trace backwards to find root version
            root = current
            visited = set()
            while root.get('supersedes_id') and root['supersedes_id'] in ev_map and root['id'] not in visited:
                visited.add(root['id'])
                root = ev_map[root['supersedes_id']]

            # Trace forward from root to build full ordered chain
            chain = [root]
            curr = root
            while True:
                child = next((r for r in all_evidence if r.get('supersedes_id') == curr['id']), None)
                if not child or child['id'] in [c['id'] for c in chain]:
                    break
                chain.append(child)
                curr = child

            chain.sort(key=lambda x: x.get('version', 1))
            return {"evidence_id": evidence_id, "versions": chain}

    @router.post('/{evidence_id}/verify')
    def verify_evidence_integrity(evidence_id: str):
        """Recomputes SHA-256 hash of file on disk, validates against stored hash, and logs result."""
        with store.transaction() as db:
            record = get_record(db, 'evidence', evidence_id)
            if not record.get('filename'):
                raise HTTPException(400, "Evidence has no attached file to verify")

            safe_filename = re.sub(r'[^a-zA-Z0-9_.\-]+', '_', record['filename']).strip('_')
            internal_name = f"{evidence_id}_{safe_filename}"
            file_path = (store.uploads / internal_name).resolve()

            if not file_path.is_file():
                record['integrity_status'] = 'failed'
                save(db, 'evidence', record)
                return {
                    "id": evidence_id,
                    "integrity_status": "failed",
                    "error": "File missing on disk"
                }

            disk_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()
            stored_hash = record.get('sha256', '')

            status = "verified" if disk_hash == stored_hash else "failed"
            record['integrity_status'] = status
            record['updated_at'] = now()
            save(db, 'evidence', record)

            log(db, 'verify_integrity', 'evidence', record, {
                'status': status,
                'disk_sha256': disk_hash,
                'expected_sha256': stored_hash
            })

            return {
                "id": evidence_id,
                "integrity_status": status,
                "sha256": stored_hash,
                "disk_sha256": disk_hash
            }

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

            # Integrity verification before download
            disk_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()
            if disk_hash != record.get('sha256'):
                record['integrity_status'] = 'failed'
                save(db, 'evidence', record)
                log(db, 'integrity_failure', 'evidence', record, {
                    'event': 'download_tamper_detected',
                    'expected': record.get('sha256'),
                    'actual': disk_hash
                })
                raise HTTPException(
                    500,
                    "Evidence file integrity check failed: stored hash does not match disk hash. File may be corrupted or tampered with."
                )

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
