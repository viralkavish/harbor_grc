"""Policy publication, immutable versioning, acceptance tracking, and template library."""
from datetime import date, datetime, timedelta
import io
import json
from pathlib import Path
import re
from uuid import uuid4
import zipfile
from fastapi import APIRouter, HTTPException, Response
from .storage import Store, now
from .records import get_record, log, save
from .policy_templates import POLICY_TEMPLATES, render_policy_template


def get_policy_sla_status(policy: dict) -> str:
    """Calculate Vanta-style policy status based on review SLA."""
    status = policy.get('status', 'draft')
    if status != 'published':
        return status

    review_date_str = policy.get('review_date')
    if not review_date_str:
        return 'published'

    try:
        rev_date = date.fromisoformat(review_date_str)
        today = date.today()
        if rev_date < today:
            return 'expired'
        elif rev_date <= today + timedelta(days=45):
            return 'renew_soon'
        return 'published'
    except Exception:
        return 'published'


def policy_router(store):
    router = APIRouter(prefix='/api/policies')

    @router.get('/templates')
    def list_policy_templates():
        return {'items': POLICY_TEMPLATES, 'total': len(POLICY_TEMPLATES)}

    @router.post('/from_template', status_code=201)
    def create_from_template(payload: dict):
        tpl_id = payload.get('template_id')
        tpl = next((t for t in POLICY_TEMPLATES if t['id'] == tpl_id), None)
        if not tpl:
            raise HTTPException(404, f"Template '{tpl_id}' not found")

        with store.transaction() as db:
            ws = Store.workspace(db)
            substitutions = {
                "organization_name": ws.get('organization') or ws.get('name') or "Our Organization",
                "ciso_title": ws.get('owner') or "Chief Information Security Officer (CISO)",
                **(payload.get('substitutions') or {})
            }
            content = render_policy_template(tpl, substitutions)
            policy_record = {
                'id': str(uuid4()),
                'title': payload.get('title') or tpl['title'],
                'description': tpl['description'],
                'status': 'draft',
                'owner': ws.get('owner', ''),
                'review_date': (date.today() + timedelta(days=365)).isoformat(),
                'tags': ['policy-template', tpl['category'].lower()],
                'control_ids': [],
                'content': content,
                'version': 1,
                'approved_at': None,
                'approver': '',
                'created_at': now(),
                'updated_at': now()
            }
            save(db, 'policies', policy_record)
            log(db, 'create_from_template', 'policies', policy_record, {'template_id': tpl_id})
            return policy_record

    @router.post('/{policy_id}/publish')
    def publish_policy(policy_id: str, payload: dict):
        approver = payload.get('approver', '')
        if not approver or not isinstance(approver, str) or not approver.strip():
            raise HTTPException(422, 'Approver name is required to publish a policy')

        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            if not policy.get('content', '').strip():
                raise HTTPException(422, 'Cannot publish an empty policy; provide content first')

            policy['status'] = 'published'
            policy['approver'] = approver.strip()
            policy['approved_at'] = now()
            if not policy.get('review_date'):
                policy['review_date'] = (date.today() + timedelta(days=365)).isoformat()
            policy['updated_at'] = now()
            save(db, 'policies', policy)

            # Record version snapshot
            db.execute(
                "INSERT INTO policy_versions (id, policy_id, version, content, created_at) VALUES (?, ?, ?, ?, ?)",
                (str(uuid4()), policy_id, policy['version'], policy['content'], policy['approved_at'])
            )

            log(db, 'publish', 'policies', policy, {'version': policy['version'], 'approver': policy['approver']})
            policy['sla_status'] = get_policy_sla_status(policy)
            return policy

    @router.post('/{policy_id}/accept')
    def record_employee_acceptance(policy_id: str, payload: dict):
        name = payload.get('person_name', '').strip()
        email = payload.get('person_email', '').strip()
        sig = payload.get('signature_text', '').strip() or name
        person_id = payload.get('person_id')

        if not name or not email:
            raise HTTPException(422, 'Employee name and email are required to record policy acceptance')

        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            acceptance_id = str(uuid4())
            ts = now()

            # Insert acceptance row
            db.execute(
                """INSERT INTO policy_acceptances (id, policy_id, person_id, person_name, person_email, version, accepted_at, signature_text)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (acceptance_id, policy_id, person_id, name, email, policy.get('version', 1), ts, sig)
            )

            # Also update acknowledged_policy_ids on the person record if person_id or email matches
            people = Store.records(db, 'people')
            matched_person = next((p for p in people if p['id'] == person_id or p.get('email') == email), None)
            if matched_person:
                ack_ids = list(dict.fromkeys(matched_person.get('acknowledged_policy_ids', []) + [policy_id]))
                matched_person['acknowledged_policy_ids'] = ack_ids
                matched_person['updated_at'] = ts
                save(db, 'people', matched_person)

            log(db, 'policy_accepted', 'policies', policy, {'employee': name, 'email': email, 'version': policy.get('version', 1)})

            return {
                'accepted': True,
                'acceptance_id': acceptance_id,
                'policy_id': policy_id,
                'version': policy.get('version', 1),
                'accepted_at': ts
            }

    @router.get('/{policy_id}/acceptances')
    def get_policy_acceptances(policy_id: str):
        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            rows = db.execute(
                """SELECT id, person_name, person_email, version, accepted_at, signature_text
                   FROM policy_acceptances WHERE policy_id=? ORDER BY accepted_at DESC""",
                (policy_id,)
            ).fetchall()

            items = [
                {
                    'id': r[0],
                    'person_name': r[1],
                    'person_email': r[2],
                    'version': r[3],
                    'accepted_at': r[4],
                    'signature_text': r[5]
                }
                for r in rows
            ]

            # Calculate workforce acceptance percentage
            people = Store.records(db, 'people')
            active_people = [p for p in people if p.get('status') in ('active', 'onboarding')]
            total_active = len(active_people)

            accepted_emails = {r[2].lower() for r in rows if r[3] == policy.get('version', 1)}
            compliant_count = sum(1 for p in active_people if p.get('email', '').lower() in accepted_emails or policy_id in p.get('acknowledged_policy_ids', []))
            pct = round((compliant_count / total_active) * 100, 1) if total_active > 0 else 100.0

            return {
                'policy_id': policy_id,
                'version': policy.get('version', 1),
                'items': items,
                'total': len(items),
                'compliant_employees': compliant_count,
                'total_employees': total_active,
                'compliance_percent': pct
            }

    @router.get('/packet')
    def download_policy_packet():
        """Export auditor-ready policy packet containing all published policies and acceptance audit trail."""
        mem_buffer = io.BytesIO()
        with store.transaction() as db:
            ws = Store.workspace(db)
            policies = [p for p in Store.records(db, 'policies') if p.get('status') == 'published']
            people = Store.records(db, 'people')

            with zipfile.ZipFile(mem_buffer, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
                manifest = {
                    'organization': ws.get('organization') or ws.get('name'),
                    'generated_at': now(),
                    'published_policies_count': len(policies),
                    'total_workforce_count': len(people)
                }
                zf.writestr('manifest.json', json.dumps(manifest, indent=2))

                # Comprehensive consolidated policy packet markdown
                packet_md = [
                    f"# Consolidated Policy Packet: {ws.get('organization') or ws.get('name')}",
                    f"**Generated:** {now()[:10]}",
                    f"**Approved Policies:** {len(policies)}\n",
                    "---\n"
                ]

                for p in policies:
                    slug = re.sub(r'[^a-zA-Z0-9_\-]+', '_', p['title'].lower()).strip('_')
                    header = (
                        f"## {p['title']} (Version {p.get('version', 1)})\n\n"
                        f"- **Status**: Published / Approved\n"
                        f"- **Approver**: {p.get('approver') or 'Authorized Security Officer'}\n"
                        f"- **Approved Date**: {p.get('approved_at') or 'N/A'}\n"
                        f"- **Scheduled Review**: {p.get('review_date') or 'Annual'}\n\n"
                    )
                    content = p.get('content', '')
                    zf.writestr(f"policies/{slug}.md", header + content)
                    packet_md.append(header + content + "\n\n---\n")

                zf.writestr('POLICY_PACKET.md', '\n'.join(packet_md))

                # Acceptance audit log
                all_acceptances = db.execute(
                    "SELECT policy_id, person_name, person_email, version, accepted_at FROM policy_acceptances ORDER BY accepted_at DESC"
                ).fetchall()

                acc_rows = []
                for r in all_acceptances:
                    pol = Store.get(db, 'policies', r[0])
                    acc_rows.append({
                        "policy_id": r[0],
                        "policy_title": pol.get('title') if pol else r[0],
                        "name": r[1],
                        "email": r[2],
                        "version": r[3],
                        "accepted_at": r[4]
                    })
                zf.writestr('acceptance_audit_log.json', json.dumps(acc_rows, indent=2))

        mem_buffer.seek(0)
        return Response(
            content=mem_buffer.getvalue(),
            media_type='application/zip',
            headers={
                'Content-Disposition': 'attachment; filename="policy-packet.zip"',
                'X-Content-Type-Options': 'nosniff'
            }
        )

    @router.get('/{policy_id}/versions')
    def get_policy_versions(policy_id: str):
        with store.transaction() as db:
            get_record(db, 'policies', policy_id)  # verify existence
            rows = db.execute(
                "SELECT version, content, created_at FROM policy_versions WHERE policy_id=? ORDER BY version DESC",
                (policy_id,)
            ).fetchall()
            items = [{'version': r[0], 'content': r[1], 'created_at': r[2]} for r in rows]
            return {'items': items, 'total': len(items)}

    @router.get('/{policy_id}/export')
    def export_policy(policy_id: str):
        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            filename = re.sub(r'[^a-zA-Z0-9_\-]+', '_', policy['title'].lower()).strip('_') + '.md'
            content = (
                f"# {policy['title']}\n\n"
                f"- **Status**: {policy['status']}\n"
                f"- **Version**: {policy.get('version', 1)}\n"
                f"- **Approver**: {policy.get('approver') or 'Unapproved'}\n"
                f"- **Approved At**: {policy.get('approved_at') or 'N/A'}\n"
                f"- **Review SLA**: {policy.get('review_date') or 'Annual'}\n"
                f"- **Last Updated**: {policy.get('updated_at', '')}\n\n"
                f"---\n\n"
                f"{policy.get('content', '')}\n"
            )
            return Response(
                content=content,
                media_type='text/markdown',
                headers={
                    'Content-Disposition': f'attachment; filename="{filename}"',
                    'X-Content-Type-Options': 'nosniff'
                }
            )

    return router
