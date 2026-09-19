"""Local trust center preview and downloadable trust package export."""
from datetime import date
import io
import json
import re
import zipfile
from uuid import uuid4
from fastapi import APIRouter, Response
from .storage import Store, now


def trust_router(store):
    router = APIRouter(prefix='/api/trust')

    @router.get('')
    def get_trust_preview():
        today = date.today().isoformat()
        with store.transaction() as db:
            ws = Store.workspace(db)
            selected_pol_ids = ws.get('trust_policy_ids', [])
            selected_evi_ids = ws.get('trust_evidence_ids', [])

            policies = []
            for pid in selected_pol_ids:
                p = Store.get(db, 'policies', pid)
                if p and p.get('status') == 'published':
                    policies.append({
                        'id': p['id'],
                        'title': p['title'],
                        'description': p.get('description', ''),
                        'version': p.get('version', 1),
                        'approved_at': p.get('approved_at'),
                        'approver': p.get('approver', '')
                    })

            evidence = []
            for eid in selected_evi_ids:
                e = Store.get(db, 'evidence', eid)
                is_expired = bool(e and e.get('expires_date') and e['expires_date'] < today)
                if e and e.get('status') == 'approved' and not is_expired:
                    evidence.append({
                        'id': e['id'],
                        'title': e['title'],
                        'description': e.get('description', ''),
                        'filename': e.get('filename'),
                        'file_size': e.get('file_size'),
                        'collected_date': e.get('collected_date'),
                        'expires_date': e.get('expires_date')
                    })

            faqs = [
                {
                    "question": "Where is customer and organizational data hosted?",
                    "answer": "All data is hosted in dedicated, air-gapped infrastructure with AES-256 encryption at rest and TLS 1.2+ encryption in transit."
                },
                {
                    "question": "How does the organization enforce access security?",
                    "answer": "Multi-factor authentication (MFA) is strictly mandatory for all workforce accounts. Privileged access is audited quarterly."
                },
                {
                    "question": "What is the vulnerability management and patching SLA?",
                    "answer": "Automated vulnerability scanners inspect all systems daily. Critical vulnerabilities must be remediated within 7 days."
                },
                {
                    "question": "How are business continuity and backups managed?",
                    "answer": "Automated database backups run daily with multi-region redundancy and annual disaster recovery failover simulations."
                }
            ]

            badges = [
                {"code": "SOC 2", "title": "SOC 2 Type II", "status": "In Progress", "icon": "shield"},
                {"code": "ISO 27001", "title": "ISO/IEC 27001:2022", "status": "In Progress", "icon": "lock"},
                {"code": "HIPAA", "title": "HIPAA Security Rule", "status": "Ready", "icon": "activity"},
                {"code": "GDPR", "title": "EU GDPR Compliant", "status": "Ready", "icon": "globe"}
            ]

            return {
                'workspace': {
                    'name': ws.get('name', ''),
                    'organization': ws.get('organization', ''),
                    'trust_title': ws.get('trust_title', 'Security at our organization'),
                    'trust_description': ws.get('trust_description', '')
                },
                'policies': policies,
                'evidence': evidence,
                'faqs': faqs,
                'badges': badges
            }

    @router.post('/request_access')
    def request_trust_access(payload: dict):
        name = payload.get('name', '').strip()
        email = payload.get('email', '').strip()
        company = payload.get('company', '').strip()
        nda_signed = bool(payload.get('nda_signed', True))

        if not name or not email:
            from fastapi import HTTPException
            raise HTTPException(422, "Name and business email are required to request access")

        req_id = str(uuid4())
        ts = now()
        with store.transaction() as db:
            db.execute(
                """INSERT INTO trust_requests (id, name, email, company, nda_signed, status, requested_at)
                   VALUES (?, ?, ?, ?, ?, 'approved', ?)""",
                (req_id, name, email, company, 1 if nda_signed else 0, ts)
            )
            return {
                'id': req_id,
                'status': 'approved',
                'access_token': str(uuid4()),
                'message': f"Access granted to security package for {email}."
            }

    @router.get('/requests')
    def list_trust_requests():
        with store.transaction() as db:
            rows = db.execute(
                "SELECT id, name, email, company, nda_signed, status, requested_at FROM trust_requests ORDER BY requested_at DESC"
            ).fetchall()
            items = [
                {
                    'id': r[0],
                    'name': r[1],
                    'email': r[2],
                    'company': r[3],
                    'nda_signed': bool(r[4]),
                    'status': r[5],
                    'requested_at': r[6]
                }
                for r in rows
            ]
            return {'items': items, 'total': len(items)}

    @router.get('/export')
    def export_trust_package():
        today = date.today().isoformat()
        with store.transaction() as db:
            ws = Store.workspace(db)
            selected_pol_ids = ws.get('trust_policy_ids', [])
            selected_evi_ids = ws.get('trust_evidence_ids', [])

            pub_policies = []
            for pid in selected_pol_ids:
                p = Store.get(db, 'policies', pid)
                if p and p.get('status') == 'published':
                    pub_policies.append(p)

            app_evidence = []
            for eid in selected_evi_ids:
                e = Store.get(db, 'evidence', eid)
                is_expired = bool(e and e.get('expires_date') and e['expires_date'] < today)
                if e and e.get('status') == 'approved' and not is_expired:
                    app_evidence.append(e)

            mem_buffer = io.BytesIO()
            with zipfile.ZipFile(mem_buffer, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
                org = ws.get('organization') or ws.get('name') or 'Our Organization'
                title = ws.get('trust_title') or 'Security Posture & Compliance Dossier'
                desc = ws.get('trust_description') or 'Overview of security policies, governance baseline, and verified compliance attestations.'

                manifest = {
                    'format': 'harbor-grc-trust',
                    'version': 1,
                    'organization': org,
                    'title': title,
                    'generated_at': now(),
                    'policies_count': len(pub_policies),
                    'evidence_count': len(app_evidence)
                }
                zf.writestr('manifest.json', json.dumps(manifest, indent=2))

                # Markdown overview
                md_lines = [
                    f"# {title}",
                    f"### {org}",
                    f"\n{desc}\n",
                    f"*Generated on {now()[:10]} via Harbor GRC local workspace.*",
                    "\n## Published Security Policies"
                ]
                for p in pub_policies:
                    md_lines.append(f"- **{p['title']}** (v{p.get('version', 1)}, Approved {p.get('approved_at', 'N/A')[:10]} by {p.get('approver') or 'Authorized Officer'})")
                    if p.get('description'):
                        md_lines.append(f"  *{p['description']}*")

                md_lines.append("\n## Compliance & Security Attestations")
                for e in app_evidence:
                    md_lines.append(f"- **{e['title']}** (Collected {e.get('collected_date') or 'N/A'}, Valid through {e.get('expires_date') or 'Indefinite'})")

                zf.writestr('TRUST_REPORT.md', '\n'.join(md_lines))

                # Clean HTML document
                html_body = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title} — {org}</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #182824; max-width: 800px; margin: 40px auto; padding: 0 20px; }}
h1 {{ color: #172b27; border-bottom: 2px solid #147d64; padding-bottom: 8px; }}
h2 {{ color: #172b27; margin-top: 32px; }}
.card {{ background: #f6f8f7; border: 1px solid #dfe6e2; border-radius: 6px; padding: 16px; margin-bottom: 12px; }}
.badge {{ display: inline-block; background: #147d64; color: white; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 12px; }}
footer {{ margin-top: 48px; border-top: 1px solid #dfe6e2; padding-top: 16px; font-size: 12px; color: #62736d; }}
</style>
</head>
<body>
<h1>{title}</h1>
<h3>{org}</h3>
<p>{desc}</p>
<h2>Published Policies ({len(pub_policies)})</h2>
"""
                for p in pub_policies:
                    html_body += f"""<div class="card">
<strong>{p['title']}</strong> <span class="badge">v{p.get('version', 1)} Published</span>
<p>{p.get('description', '')}</p>
<small>Approved by {p.get('approver') or 'Officer'} on {p.get('approved_at', 'N/A')[:10]}</small>
</div>"""

                html_body += f"<h2>Verified Attestations ({len(app_evidence)})</h2>"
                for e in app_evidence:
                    html_body += f"""<div class="card">
<strong>{e['title']}</strong> <span class="badge">Approved</span>
<p>{e.get('description', '')}</p>
<small>Valid through: {e.get('expires_date') or 'Ongoing'}</small>
</div>"""

                html_body += f"""<footer>Exported from local Harbor GRC workspace on {now()[:10]}. Local-first privacy guaranteed.</footer>
</body>
</html>"""
                zf.writestr('TRUST_REPORT.html', html_body)

                # Policies folder
                for p in pub_policies:
                    slug = re.sub(r'[^a-zA-Z0-9_\-]+', '_', p['title'].lower()).strip('_')
                    zf.writestr(f"policies/{slug}.md", f"# {p['title']}\n\n{p.get('content', '')}")

                # Evidence folder
                for e in app_evidence:
                    if e.get('filename'):
                        internal_name = f"{e['id']}_{e['filename']}"
                        file_path = store.uploads / internal_name
                        if file_path.is_file():
                            zf.write(file_path, arcname=f"evidence/{e['filename']}")

            mem_buffer.seek(0)
            clean_org = re.sub(r'[^a-zA-Z0-9_\-]+', '_', (ws.get('organization') or 'trust').lower()).strip('_')
            filename = f"trust-package-{clean_org}.zip"

            return Response(
                content=mem_buffer.getvalue(),
                media_type='application/zip',
                headers={
                    'Content-Disposition': f'attachment; filename="{filename}"',
                    'X-Content-Type-Options': 'nosniff'
                }
            )

    return router
