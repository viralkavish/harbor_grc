"""Scoped audit export package generator.

Bundles only the controls, policies, evidence, and requests scoped to the specified audit.
No unrelated confidential records are included.
"""
import io
import json
from pathlib import Path
import re
import zipfile
from fastapi import APIRouter, HTTPException, Response
from .storage import Store, now
from .records import get_record


def audit_router(store):
    router = APIRouter(prefix='/api/audits')

    @router.get('/{audit_id}/export')
    def export_audit_package(audit_id: str):
        with store.transaction() as db:
            audit = get_record(db, 'audits', audit_id)

            # 1. Linked framework
            framework = Store.get(db, 'frameworks', audit['framework_id']) if audit.get('framework_id') else None

            # 2. Scoped audit requests
            all_requests = Store.records(db, 'audit_requests')
            scoped_requests = [r for r in all_requests if r.get('audit_id') == audit_id]

            # 3. Scoped control IDs
            control_ids = set()
            for req in scoped_requests:
                if req.get('control_id'):
                    control_ids.add(req['control_id'])

            if framework:
                for c in Store.records(db, 'controls'):
                    if framework['id'] in c.get('framework_ids', []):
                        control_ids.add(c['id'])

            controls = [c for cid in control_ids if (c := Store.get(db, 'controls', cid)) is not None]

            # 4. Scoped policies and evidence
            policy_ids: set[str] = set()
            evidence_ids: set[str] = set()

            for c in controls:
                policy_ids.update(c.get('policy_ids', []))
                evidence_ids.update(c.get('evidence_ids', []))

            for req in scoped_requests:
                evidence_ids.update(req.get('evidence_ids', []))

            policies = [p for pid in policy_ids if (p := Store.get(db, 'policies', pid)) is not None]
            evidence_records = [e for eid in evidence_ids if (e := Store.get(db, 'evidence', eid)) is not None]

            # Create ZIP archive
            mem_buffer = io.BytesIO()
            with zipfile.ZipFile(mem_buffer, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
                manifest = {
                    'format': 'harbor-grc-audit',
                    'version': 1,
                    'audit_id': audit_id,
                    'title': audit['title'],
                    'framework': framework.get('title') if framework else None,
                    'auditor': audit.get('auditor', ''),
                    'period_start': audit.get('period_start'),
                    'period_end': audit.get('period_end'),
                    'generated_at': now(),
                    'counts': {
                        'requests': len(scoped_requests),
                        'controls': len(controls),
                        'policies': len(policies),
                        'evidence': len(evidence_records)
                    }
                }
                zf.writestr('manifest.json', json.dumps(manifest, indent=2))

                # Comprehensive markdown audit summary
                md_summary = [
                    f"# Audit Dossier: {audit['title']}",
                    f"**Auditor**: {audit.get('auditor') or 'Unassigned'}",
                    f"**Framework**: {framework.get('title') if framework else 'Custom Scope'}",
                    f"**Period**: {audit.get('period_start') or 'N/A'} to {audit.get('period_end') or 'N/A'}",
                    f"**Generated**: {now()}\n",
                    "## Audit Requests",
                ]
                for r in scoped_requests:
                    md_summary.append(f"- [{r.get('status')}] {r['title']} (Control: {r.get('control_id') or 'General'})")

                md_summary.append("\n## In-Scope Controls")
                for c in controls:
                    md_summary.append(f"- **{c.get('code', '')} {c['title']}**: Status `{c.get('status')}`, Owner `{c.get('owner') or 'Unassigned'}`")

                zf.writestr('AUDIT_DOSSIER.md', '\n'.join(md_summary))

                # Raw data files
                zf.writestr('requests.json', json.dumps(scoped_requests, indent=2))
                zf.writestr('controls.json', json.dumps(controls, indent=2))

                # Policies
                for p in policies:
                    slug = re.sub(r'[^a-zA-Z0-9_\-]+', '_', p['title'].lower()).strip('_')
                    zf.writestr(f"policies/{slug}.md", f"# {p['title']}\n\n{p.get('content', '')}")

                # Evidence attachments
                for e in evidence_records:
                    if e.get('filename'):
                        internal_name = f"{e['id']}_{e['filename']}"
                        file_path = store.uploads / internal_name
                        if file_path.is_file():
                            zf.write(file_path, arcname=f"evidence/{e['filename']}")

            mem_buffer.seek(0)
            clean_title = re.sub(r'[^a-zA-Z0-9_\-]+', '_', audit['title'].lower()).strip('_')
            filename = f"audit-{clean_title}.zip"

            return Response(
                content=mem_buffer.getvalue(),
                media_type='application/zip',
                headers={
                    'Content-Disposition': f'attachment; filename="{filename}"',
                    'X-Content-Type-Options': 'nosniff'
                }
            )

    return router
