"""Policy publication, approval workflow with segregation of duties, version restore, and acceptance currency."""
from datetime import date, datetime, timedelta
import io
import json
from pathlib import Path
import re
from uuid import uuid4
import zipfile
from fastapi import APIRouter, HTTPException, Query, Request, Response
from .storage import Store, now
from .records import get_record, save
from .audit_ops import append_audit_log
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
        rev_date = date.fromisoformat(review_date_str[:10])
        today = date.today()
        if rev_date < today:
            return 'expired'
        elif rev_date <= today + timedelta(days=30):
            return 'renew_soon'
        return 'published'
    except Exception:
        return 'published'


def policy_router(store: Store):
    router = APIRouter(prefix='/api/policies')

    @router.get('/templates')
    def list_policy_templates():
        return {'items': POLICY_TEMPLATES, 'total': len(POLICY_TEMPLATES)}

    @router.get('/review_due')
    def get_review_due():
        """Lists policies that are overdue for annual review or due within 30 days."""
        today = date.today()
        threshold = today + timedelta(days=30)
        with store.transaction() as db:
            policies = Store.records(db, 'policies')

        overdue = []
        due_soon = []
        for p in policies:
            r_str = p.get('review_date')
            if not r_str:
                continue
            try:
                r_date = date.fromisoformat(r_str[:10])
                if r_date < today:
                    overdue.append(p)
                elif r_date <= threshold:
                    due_soon.append(p)
            except Exception:
                continue

        return {
            "overdue_count": len(overdue),
            "due_soon_count": len(due_soon),
            "overdue": overdue,
            "due_soon": due_soon
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
                        f"- **Approved By**: {p.get('approved_by') or p.get('approver') or 'Authorized Officer'}\n"
                        f"- **Approved Date**: {p.get('approved_at') or 'N/A'}\n"
                        f"- **Scheduled Review**: {p.get('review_date') or 'Annual'}\n\n"
                    )
                    content = p.get('content', '')
                    zf.writestr(f"policies/{slug}.md", header + content)
                    packet_md.append(header + content + "\n\n---\n")

                zf.writestr('POLICY_PACKET.md', '\n'.join(packet_md))

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

    @router.post('/from_template', status_code=201)
    def create_from_template(payload: dict):
        tpl_id = payload.get('template_id')
        tpl = next((t for t in POLICY_TEMPLATES if t['id'] == tpl_id), None)
        if not tpl:
            raise HTTPException(404, f"Template '{tpl_id}' not found")

        with store.transaction() as db:
            ws = Store.workspace(db)
            substitutions = {
                "organization_name": ws.get('organization') or ws.get('name') or "tofrom",
                "ciso_title": ws.get('owner') or "Chief Information Security Officer (CISO)",
                **(payload.get('substitutions') or {})
            }
            content = render_policy_template(tpl, substitutions)
            policy_id = str(uuid4())
            ts = now()
            policy_record = {
                'id': policy_id,
                'title': payload.get('title') or tpl['title'],
                'description': tpl['description'],
                'status': 'draft',
                'owner': ws.get('owner', 'Security Lead'),
                'review_date': (date.today() + timedelta(days=365)).isoformat(),
                'tags': ['policy-template', tpl['category'].lower()],
                'control_ids': [],
                'content': content,
                'version': 1,
                'approved_version': None,
                'approved_at': None,
                'approved_by': '',
                'approver': '',
                'submitted_by': '',
                'submitted_at': None,
                'rejection_reason': '',
                'created_at': ts,
                'updated_at': ts
            }
            save(db, 'policies', policy_record)
            append_audit_log(
                db,
                actor=str(ws.get('owner') or "Security Lead"),
                action="create_from_template",
                resource="policies",
                record_id=policy_id,
                title=policy_record['title'],
                after=policy_record
            )
            return policy_record

    # =========================================================================
    # Approval Workflow & Segregation of Duties (P1)
    # =========================================================================

    @router.post('/{policy_id}/submit')
    def submit_policy_for_review(policy_id: str, request: Request, payload: dict | None = None):
        payload = payload or {}
        user = getattr(request.state, 'user', None)

        if payload.get('author'):
            author = str(payload['author']).strip()
            if user and (user.get('email', '').lower() == author.lower() or user.get('name', '').lower() == author.lower()):
                submitted_id = user.get('id')
            else:
                submitted_id = None
        elif user:
            author = user.get('email') or user.get('name')
            submitted_id = user.get('id')
        else:
            author = ''
            submitted_id = None

        if not author:
            raise HTTPException(422, "Author identity is required to submit a policy for review.")

        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            if not policy.get('content', '').strip():
                raise HTTPException(422, "Cannot submit an empty policy for review.")

            old_state = dict(policy)
            policy['status'] = 'in_review'
            policy['submitted_by'] = author
            policy['submitted_by_id'] = submitted_id
            policy['submitted_at'] = now()
            policy['rejection_reason'] = ''
            policy['updated_at'] = now()
            save(db, 'policies', policy)

            append_audit_log(
                db,
                actor=author,
                action="submit_policy",
                resource="policies",
                record_id=policy_id,
                title=f"Submitted Policy for Review: {policy['title']}",
                before=old_state,
                after=policy
            )
            return policy

    @router.post('/{policy_id}/approve')
    def approve_policy(policy_id: str, request: Request, payload: dict | None = None):
        payload = payload or {}
        user = getattr(request.state, 'user', None)

        if payload.get('approver'):
            approver = str(payload['approver']).strip()
            if user and (user.get('email', '').lower() == approver.lower() or user.get('name', '').lower() == approver.lower()):
                approver_id = user.get('id')
            else:
                approver_id = None
        elif user:
            approver = user.get('email') or user.get('name')
            approver_id = user.get('id')
        else:
            approver = ''
            approver_id = None

        if not approver:
            raise HTTPException(422, "Approver identity is required to approve a policy.")

        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            if not policy.get('content', '').strip():
                raise HTTPException(422, "Cannot approve an empty policy.")

            # Segregation of duties (SoD) enforcement
            author = (policy.get('submitted_by') or policy.get('owner') or '').strip()
            author_id = policy.get('submitted_by_id')

            is_same_person = (
                (author and approver.lower() == author.lower()) or
                (author_id and approver_id and author_id == approver_id)
            )
            if is_same_person:
                raise HTTPException(
                    422,
                    f"Segregation of duties violation: policy approver ({approver}) must be different from the author/submitter ({author})."
                )

            old_state = dict(policy)
            ts = now()
            current_ver = policy.get('version', 1)

            policy['status'] = 'published'
            policy['approved_by'] = approver
            policy['approver'] = approver
            policy['approved_at'] = ts
            policy['approved_version'] = current_ver
            policy['review_date'] = (date.today() + timedelta(days=365)).isoformat()
            policy['rejection_reason'] = ''
            policy['updated_at'] = ts
            save(db, 'policies', policy)

            # Store immutable version snapshot
            snap_id = str(uuid4())
            db.execute(
                """INSERT INTO policy_versions (id, policy_id, version, content, created_at, approved_by, approved_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (snap_id, policy_id, current_ver, policy['content'], ts, approver, ts)
            )

            append_audit_log(
                db,
                actor=approver,
                action="approve_policy",
                resource="policies",
                record_id=policy_id,
                title=f"Approved & Published Policy: {policy['title']} (v{current_ver})",
                before=old_state,
                after=policy
            )
            policy['sla_status'] = get_policy_sla_status(policy)
            return policy

    @router.post('/{policy_id}/publish')
    def publish_policy(policy_id: str, payload: dict, request: Request):
        """Backward-compatible publish endpoint."""
        approver = str(payload.get('approver', '')).strip() or "Chief Security Officer"
        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            if not policy.get('submitted_by'):
                policy['submitted_by'] = 'system'
                save(db, 'policies', policy)
        return approve_policy(policy_id, request, {'approver': approver})

    @router.post('/{policy_id}/reject')
    def reject_policy(policy_id: str, payload: dict):
        reason = str(payload.get('reason', '')).strip()
        rejector = str(payload.get('rejector', '')).strip() or "Security Reviewer"
        if not reason:
            raise HTTPException(422, "Rejection reason is required.")

        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            old_state = dict(policy)

            policy['status'] = 'draft'
            policy['rejection_reason'] = reason
            policy['updated_at'] = now()
            save(db, 'policies', policy)

            append_audit_log(
                db,
                actor=rejector,
                action="reject_policy",
                resource="policies",
                record_id=policy_id,
                title=f"Rejected Policy: {policy['title']}",
                before=old_state,
                after=policy
            )
            return policy

    # =========================================================================
    # Version Restore (P2)
    # =========================================================================

    @router.post('/{policy_id}/restore/{target_version}')
    def restore_policy_version(policy_id: str, target_version: int, payload: dict | None = None):
        actor = (payload.get('actor') if payload else None) or "Security Lead"
        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            hist = db.execute(
                "SELECT content FROM policy_versions WHERE policy_id = ? AND version = ?",
                (policy_id, target_version)
            ).fetchone()
            if not hist:
                raise HTTPException(404, f"Version {target_version} not found for policy {policy_id}")

            old_state = dict(policy)
            current_ver = policy.get('version', 1)
            # Archive current active version before restore
            db.execute(
                """INSERT INTO policy_versions (id, policy_id, version, content, created_at, approved_by, approved_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (str(uuid4()), policy_id, current_ver, policy.get('content', ''), now(), policy.get('approved_by', ''), policy.get('approved_at'))
            )

            new_version = current_ver + 1
            restored_content = hist[0]

            policy['version'] = new_version
            policy['content'] = restored_content
            policy['status'] = 'draft'
            policy['approved_at'] = None
            policy['approved_by'] = ''
            policy['approver'] = ''
            policy['rejection_reason'] = f"Restored from Version {target_version}"
            policy['updated_at'] = now()
            save(db, 'policies', policy)

            append_audit_log(
                db,
                actor=actor,
                action="restore_policy_version",
                resource="policies",
                record_id=policy_id,
                title=f"Restored Version {target_version} as Version {new_version} for {policy['title']}",
                before=old_state,
                after=policy
            )
            return policy

    # =========================================================================
    # Latest Approved Version & Point-in-Time Resolution (P3)
    # =========================================================================

    @router.get('/{policy_id}/approved')
    def get_latest_approved_policy(policy_id: str):
        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            appr_ver = policy.get('approved_version')
            if not appr_ver:
                raise HTTPException(404, f"No approved version exists for policy '{policy_id}'.")

            row = db.execute(
                "SELECT content, approved_by, approved_at FROM policy_versions WHERE policy_id = ? AND version = ?",
                (policy_id, appr_ver)
            ).fetchone()
            content = row[0] if row else policy.get('content', '')
            approved_by = row[1] if row and row[1] else policy.get('approved_by', '')
            approved_at = row[2] if row and row[2] else policy.get('approved_at')

            return {
                "policy_id": policy_id,
                "title": policy['title'],
                "version": appr_ver,
                "content": content,
                "approved_by": approved_by,
                "approved_at": approved_at,
                "status": "published"
            }

    @router.get('/{policy_id}/version_at')
    def get_policy_version_at_date(policy_id: str, date: str = Query(...)):
        """Finds the approved policy version in effect on a specific calendar date (UTC)."""
        target_timestamp = f"{date[:10]}T23:59:59Z"
        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            row = db.execute(
                """SELECT version, content, created_at, approved_by, approved_at
                   FROM policy_versions WHERE policy_id = ? AND created_at <= ?
                   ORDER BY created_at DESC LIMIT 1""",
                (policy_id, target_timestamp)
            ).fetchone()

            if not row:
                raise HTTPException(404, f"No approved policy version was in effect for '{policy_id}' on {date}.")

            return {
                "policy_id": policy_id,
                "title": policy['title'],
                "version": row[0],
                "content": row[1],
                "created_at": row[2],
                "approved_by": row[3],
                "approved_at": row[4],
                "in_effect_date": date
            }

    # =========================================================================
    # Acknowledgment Currency & Acceptance Status (P5)
    # =========================================================================

    @router.get('/{policy_id}/acceptance_status')
    def get_policy_acceptance_currency(policy_id: str):
        """Calculates workforce acknowledgment currency (current vs stale vs missing) against latest approved version."""
        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            appr_ver = policy.get('approved_version') or policy.get('version', 1)

            people = Store.records(db, 'people')
            active_people = [p for p in people if p.get('status') in ('active', 'onboarding')]

            acceptances = db.execute(
                """SELECT person_email, max(version), max(accepted_at)
                   FROM policy_acceptances WHERE policy_id = ? GROUP BY person_email""",
                (policy_id,)
            ).fetchall()

            acc_map = {r[0].lower(): (r[1], r[2]) for r in acceptances}

            current_count = 0
            stale_count = 0
            missing_count = 0
            personnel = []

            for p in active_people:
                email = p.get('email', '').lower()
                acc_info = acc_map.get(email)

                if acc_info:
                    acc_v, acc_at = acc_info
                    if acc_v >= appr_ver:
                        p_status = "current"
                        current_count += 1
                    else:
                        p_status = "stale"
                        stale_count += 1
                else:
                    acc_v = None
                    acc_at = None
                    p_status = "missing"
                    missing_count += 1

                personnel.append({
                    "person_id": p.get('id'),
                    "name": p.get('title') or p.get('name'),
                    "email": p.get('email'),
                    "status": p_status,
                    "accepted_version": acc_v,
                    "accepted_at": acc_at
                })

            total = len(active_people)
            seen_emails = {p.get('email', '').lower() for p in active_people if p.get('email')}
            extra_acceptances = db.execute(
                """SELECT person_name, person_email, max(version), max(accepted_at)
                   FROM policy_acceptances WHERE policy_id = ? GROUP BY person_email, person_name""",
                (policy_id,)
            ).fetchall()
            for r in extra_acceptances:
                email = (r[1] or '').lower()
                if email and email not in seen_emails:
                    seen_emails.add(email)
                    acc_v = r[2]
                    acc_at = r[3]
                    if acc_v >= appr_ver:
                        p_status = "current"
                        current_count += 1
                    else:
                        p_status = "stale"
                        stale_count += 1
                    personnel.append({
                        "person_id": None,
                        "name": r[0] or email,
                        "email": r[1],
                        "status": p_status,
                        "accepted_version": acc_v,
                        "accepted_at": acc_at
                    })

            total = len(personnel)
            currency_pct = round((current_count / total) * 100, 1) if total > 0 else 100.0

            return {
                "policy_id": policy_id,
                "approved_version": appr_ver,
                "total_active_personnel": total,
                "current_count": current_count,
                "stale_count": stale_count,
                "missing_count": missing_count,
                "currency_percentage": currency_pct,
                "personnel": personnel
            }

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
            current_ver = policy.get('approved_version') or policy.get('version', 1)
            acceptance_id = str(uuid4())
            ts = now()

            db.execute(
                """INSERT INTO policy_acceptances (id, policy_id, person_id, person_name, person_email, version, accepted_at, signature_text)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (acceptance_id, policy_id, person_id, name, email, current_ver, ts, sig)
            )

            people = Store.records(db, 'people')
            matched_person = next((p for p in people if p['id'] == person_id or p.get('email') == email), None)
            if matched_person:
                ack_ids = list(dict.fromkeys(matched_person.get('acknowledged_policy_ids', []) + [policy_id]))
                matched_person['acknowledged_policy_ids'] = ack_ids
                matched_person['updated_at'] = ts
                save(db, 'people', matched_person)

            append_audit_log(
                db,
                actor=email,
                action="accept_policy",
                resource="policies",
                record_id=policy_id,
                title=f"Employee {name} Signed Policy Acceptance (v{current_ver})",
                after={"email": email, "version": current_ver, "signature": sig}
            )

            return {
                'accepted': True,
                'acceptance_id': acceptance_id,
                'policy_id': policy_id,
                'version': current_ver,
                'accepted_at': ts
            }

    @router.get('/{policy_id}/acceptances')
    def get_policy_acceptances_report(policy_id: str):
        """Returns acceptance log and statistics."""
        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            current_ver = policy.get('approved_version') or policy.get('version', 1)
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
            people = Store.records(db, 'people')
            active_people = [p for p in people if p.get('status') in ('active', 'onboarding')]
            total = len(active_people)
            accepted_emails = {r[2].lower() for r in rows if r[3] == current_ver}
            compliant = sum(1 for p in active_people if p.get('email', '').lower() in accepted_emails or policy_id in p.get('acknowledged_policy_ids', []))
            pct = round((compliant / total) * 100, 1) if total > 0 else 100.0

            return {
                'policy_id': policy_id,
                'version': current_ver,
                'items': items,
                'total': len(items),
                'compliant_employees': compliant,
                'total_employees': total,
                'compliance_percent': pct
            }

    @router.get('/{policy_id}/versions')
    def get_policy_versions(policy_id: str):
        with store.transaction() as db:
            get_record(db, 'policies', policy_id)
            rows = db.execute(
                """SELECT version, content, created_at, approved_by, approved_at, updated_by, change_reason, title
                   FROM policy_versions WHERE policy_id=? ORDER BY version DESC""",
                (policy_id,)
            ).fetchall()
            items = [
                {
                    'version': r[0],
                    'content': r[1],
                    'created_at': r[2],
                    'approved_by': r[3],
                    'approved_at': r[4],
                    'updated_by': r[5] or 'Author',
                    'change_reason': r[6] or ('Approved release' if r[3] else 'Revision'),
                    'title': r[7] or ''
                }
                for r in rows
            ]
            return {'items': items, 'total': len(items)}

    @router.get('/{policy_id}/print')
    def print_policy(policy_id: str, autoprint: bool = False):
        """Generates executive, print-ready document layout with revision table and signature block."""
        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            rows = db.execute(
                """SELECT version, created_at, updated_by, change_reason, approved_by
                   FROM policy_versions WHERE policy_id=? ORDER BY version ASC""",
                (policy_id,)
            ).fetchall()

        revision_rows = "".join(
            f"<tr><td style='padding:6px 10px;border:1px solid #ddd;'>v{r[0]}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd;'>{r[1][:10]}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd;'>{r[2] or 'Author'}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd;'>{r[3] or 'Revision'}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd;'>{r[4] or '—'}</td></tr>"
            for r in rows
        ) if rows else f"<tr><td style='padding:6px 10px;border:1px solid #ddd;'>v{policy.get('version', 1)}</td><td style='padding:6px 10px;border:1px solid #ddd;'>{policy.get('created_at', '')[:10]}</td><td style='padding:6px 10px;border:1px solid #ddd;'>{policy.get('owner', 'Author')}</td><td style='padding:6px 10px;border:1px solid #ddd;'>Current policy</td><td style='padding:6px 10px;border:1px solid #ddd;'>{policy.get('approved_by') or '—'}</td></tr>"

        # Format markdown body into clean HTML paragraphs/headings
        raw_content = policy.get('content', '')
        formatted_body = []
        for line in raw_content.split('\n'):
            line_str = line.strip()
            if line_str.startswith('### '):
                formatted_body.append(f"<h3 style='margin-top:20px;margin-bottom:8px;font-size:16px;color:#111827;'>{line_str[4:]}</h3>")
            elif line_str.startswith('## '):
                formatted_body.append(f"<h2 style='margin-top:24px;margin-bottom:10px;font-size:18px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;color:#111827;'>{line_str[3:]}</h2>")
            elif line_str.startswith('# '):
                formatted_body.append(f"<h1 style='margin-top:28px;margin-bottom:12px;font-size:22px;color:#111827;'>{line_str[2:]}</h1>")
            elif line_str.startswith('- ') or line_str.startswith('* '):
                formatted_body.append(f"<li style='margin-bottom:4px;margin-left:20px;color:#374151;'>{line_str[2:]}</li>")
            elif line_str:
                formatted_body.append(f"<p style='margin-bottom:12px;line-height:1.6;color:#374151;'>{line_str}</p>")

        content_html = "\n".join(formatted_body)
        print_script = "<script>window.onload = function() { window.print(); };</script>" if autoprint else ""

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{policy['title']} - tofromGRC Compliance Policy</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px auto; max-width: 850px; color: #1f2937; line-height: 1.5; }}
  .header {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }}
  .org-title {{ font-size: 12px; letter-spacing: 1px; font-weight: 700; text-transform: uppercase; color: #2563eb; }}
  .doc-title {{ font-size: 24px; font-weight: 800; margin: 4px 0 0 0; color: #111827; }}
  .meta-box {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }}
  .meta-box th, .meta-box td {{ border: 1px solid #e5e7eb; padding: 6px 10px; }}
  .meta-box th {{ background-color: #f9fafb; color: #6b7280; text-align: left; font-weight: 600; width: 25%; }}
  .badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; text-transform: uppercase; background: #e5e7eb; color: #374151; }}
  .badge-published {{ background: #dcfce7; color: #166534; }}
  .badge-in_review {{ background: #e0f2fe; color: #075985; }}
  .badge-draft {{ background: #fef9c3; color: #854d0e; }}
  .section-title {{ font-size: 15px; font-weight: 700; margin-top: 32px; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; color: #4b5563; }}
  .rev-table {{ width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; }}
  .rev-table th {{ background: #f9fafb; border: 1px solid #ddd; padding: 6px 10px; text-align: left; }}
  .signature-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; page-break-inside: avoid; }}
  .sig-line {{ border-top: 1px solid #111827; padding-top: 8px; margin-top: 50px; font-size: 12px; }}
  @media print {{
    body {{ margin: 20mm 15mm; max-width: 100%; }}
    .no-print {{ display: none !important; }}
    @page {{ margin: 20mm 15mm; }}
  }}
</style>
</head>
<body>
<div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; background: #f3f4f6; padding: 12px 18px; border-radius: 6px;">
  <span><strong>Executive Policy Document:</strong> Ready for PDF export or physical archive.</span>
  <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:4px;font-weight:600;cursor:pointer;">
    Print / Save as PDF
  </button>
</div>

<div class="header">
  <div>
    <span class="org-title">tofromGRC • Information Security & Compliance</span>
    <h1 class="doc-title">{policy['title']}</h1>
  </div>
  <div style="text-align: right;">
    <span class="badge badge-{policy['status']}">{policy['status']}</span>
    <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">Version {policy.get('version', 1)}</div>
  </div>
</div>

<table class="meta-box">
  <tr>
    <th>Document ID</th><td>{policy['id']}</td>
    <th>Executive Owner</th><td>{policy.get('owner') or 'Unassigned'}</td>
  </tr>
  <tr>
    <th>Approval Status</th><td>{policy['status'].upper()}</td>
    <th>Approved By</th><td>{policy.get('approved_by') or policy.get('approver') or 'Pending Independent Review'}</td>
  </tr>
  <tr>
    <th>Approved Version</th><td>v{policy.get('approved_version') or '1.0'}</td>
    <th>Approval Date</th><td>{policy.get('approved_at') or 'Pending Review'}</td>
  </tr>
  <tr>
    <th>Annual Review SLA</th><td>{policy.get('review_date') or 'Annual Review Required'}</td>
    <th>Classification</th><td>Confidential — Internal Governance Document</td>
  </tr>
</table>

<div class="policy-body">
{content_html}
</div>

<div class="section-title">Document Revision History</div>
<table class="rev-table">
  <thead>
    <tr>
      <th>Version</th><th>Date</th><th>Author / Editor</th><th>Change Reason</th><th>Executive Approver</th>
    </tr>
  </thead>
  <tbody>
    {revision_rows}
  </tbody>
</table>

<div class="signature-grid">
  <div>
    <div style="font-size: 12px; font-weight: 700; color: #374151;">Policy Author / Program Lead</div>
    <div class="sig-line">
      <strong>Signature:</strong> ____________________________<br>
      <strong>Name:</strong> {policy.get('submitted_by') or policy.get('owner') or 'Author'}<br>
      <strong>Date:</strong> {policy.get('updated_at', '')[:10]}
    </div>
  </div>
  <div>
    <div style="font-size: 12px; font-weight: 700; color: #374151;">Executive Approval (Segregation of Duties)</div>
    <div class="sig-line">
      <strong>Signature:</strong> ____________________________<br>
      <strong>Name:</strong> {policy.get('approved_by') or policy.get('approver') or 'Chief Information Security Officer'}<br>
      <strong>Date:</strong> {policy.get('approved_at', '')[:10] if policy.get('approved_at') else 'Pending Approval'}
    </div>
  </div>
</div>

{print_script}
</body>
</html>
"""
        return Response(content=html, media_type="text/html")

    @router.get('/{policy_id}/export')
    def export_policy(policy_id: str):
        with store.transaction() as db:
            policy = get_record(db, 'policies', policy_id)
            filename = re.sub(r'[^a-zA-Z0-9_\-]+', '_', policy['title'].lower()).strip('_') + '.md'
            content = (
                f"# {policy['title']}\n\n"
                f"- **Status**: {policy['status']}\n"
                f"- **Version**: {policy.get('version', 1)}\n"
                f"- **Approved Version**: {policy.get('approved_version') or 'Unapproved'}\n"
                f"- **Approved By**: {policy.get('approved_by') or policy.get('approver') or 'Unapproved'}\n"
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
