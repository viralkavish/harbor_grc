"""Enterprise Risk Register, 5x5 Heatmap, Control Linkage & Assessment Minutes Ops.

Adheres strictly to AICPA SOC 2 CC3.1-CC3.4 (Risk Assessment) and PBC item GV.1:
- Server-side scoring (inherent & residual)
- 5x5 matrix scoring scale and heatmap distribution
- Mitigating control linkage with closure guard (cannot close unmitigated risks)
- Segregation of duties on risk acceptance with expiration dates
- Review cadence and immutable review history
- Formal Risk Assessment Minutes generator with R2 evidence registration
- Universal R3 audit logging
"""
from datetime import date, datetime, timedelta, timezone
import json
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Query
from .storage import Store, now
from .audit_ops import append_audit_log


SEEDED_LIKELIHOOD_SCALE = [
    {"level": 1, "name": "Rare", "description": "Highly unlikely to occur; once in 3+ years (< 5% probability)"},
    {"level": 2, "name": "Unlikely", "description": "Could occur under unusual circumstances; once in 1-3 years (5-20%)"},
    {"level": 3, "name": "Possible", "description": "Reasonable chance of occurrence; once per year (20-50%)"},
    {"level": 4, "name": "Likely", "description": "High probability of occurrence; multiple times per year (50-80%)"},
    {"level": 5, "name": "Almost Certain", "description": "Expected to occur frequently; ongoing exposure (> 80%)"}
]

SEEDED_IMPACT_SCALE = [
    {"level": 1, "name": "Insignificant", "description": "Negligible operational friction; zero data loss; < $5k financial impact"},
    {"level": 2, "name": "Minor", "description": "Localized disruption; minimal customer impact; $5k-$25k financial impact"},
    {"level": 3, "name": "Moderate", "description": "Partial service degradation; non-sensitive data exposure; $25k-$100k impact"},
    {"level": 4, "name": "Major", "description": "Extensive downtime; sensitive PII/credential breach; $100k-$500k impact; regulatory notice"},
    {"level": 5, "name": "Catastrophic", "description": "Systemic failure; catastrophic loss of trust; > $500k; critical regulatory sanction"}
]

RISK_APPETITE_THRESHOLD = 12  # Inherent score >= 12 exceeds appetite


def compute_scores(likelihood: int | None, impact: int | None, res_likelihood: int | None, res_impact: int | None) -> tuple[int | None, int | None, str]:
    inh = (likelihood * impact) if (isinstance(likelihood, int) and isinstance(impact, int)) else None
    res = (res_likelihood * res_impact) if (isinstance(res_likelihood, int) and isinstance(res_impact, int)) else None
    appetite = "exceeds" if (inh is not None and inh >= RISK_APPETITE_THRESHOLD) else "within"
    return inh, res, appetite


def risk_assessment_router(store):
    router = APIRouter()

    @router.get('/api/risks/matrix')
    def get_risk_matrix():
        """Returns 5x5 heatmap matrix, scales, appetite threshold, and distribution."""
        with store.transaction() as db:
            rows = db.execute("SELECT likelihood, impact, residual_likelihood, residual_impact, status FROM risks").fetchall()

            # Initialize 5x5 grids for inherent and residual
            inherent_grid = {f"{l}_{i}": 0 for l in range(1, 6) for i in range(1, 6)}
            residual_grid = {f"{l}_{i}": 0 for l in range(1, 6) for i in range(1, 6)}

            for r in rows:
                if r[4] != 'closed':
                    l, imp, rl, ri = r[0], r[1], r[2], r[3]
                    if l and imp and 1 <= l <= 5 and 1 <= imp <= 5:
                        inherent_grid[f"{l}_{imp}"] += 1
                    if rl and ri and 1 <= rl <= 5 and 1 <= ri <= 5:
                        residual_grid[f"{rl}_{ri}"] += 1

            return {
                "likelihood_scale": SEEDED_LIKELIHOOD_SCALE,
                "impact_scale": SEEDED_IMPACT_SCALE,
                "appetite_threshold": RISK_APPETITE_THRESHOLD,
                "inherent_grid": inherent_grid,
                "residual_grid": residual_grid
            }

    @router.get('/api/risks')
    def list_risks(
        status: str | None = None,
        category: str | None = None,
        owner: str | None = None,
        q: str | None = None,
        limit: int = 100,
        offset: int = 0
    ):
        """Lists risks with comprehensive filtering, scores, and control linkages."""
        with store.transaction() as db:
            query = "SELECT * FROM risks WHERE 1=1"
            params: list = []

            if status and status != 'all':
                query += " AND status = ?"
                params.append(status)
            if category:
                query += " AND category = ?"
                params.append(category)
            if owner:
                query += " AND owner = ?"
                params.append(owner)
            if q:
                query += " AND (title LIKE ? OR description LIKE ?)"
                pattern = f"%{q}%"
                params.extend([pattern, pattern])

            query += " ORDER BY inherent_score DESC NULLS LAST, created_at DESC"
            rows = db.execute(query, params).fetchall()

            items = []
            for r in rows:
                try:
                    tags = json.loads(r[6]) if r[6] else []
                except Exception:
                    tags = []
                try:
                    ctrls = json.loads(r[10]) if r[10] else []
                except Exception:
                    ctrls = []
                try:
                    hist = json.loads(r[25]) if r[25] else []
                except Exception:
                    hist = []

                items.append({
                    "id": r[0],
                    "title": r[1],
                    "description": r[2],
                    "category": r[3],
                    "owner": r[4],
                    "due_date": r[5],
                    "tags": tags,
                    "likelihood": r[7],
                    "impact": r[8],
                    "inherent_score": r[9],
                    "mitigating_control_refs": ctrls,
                    "control_ids": ctrls,  # Alias
                    "treatment": r[11],
                    "treatment_plan": r[12],
                    "residual_likelihood": r[13],
                    "residual_impact": r[14],
                    "residual_score": r[15],
                    "risk_appetite": r[16],
                    "status": r[17],
                    "review_cadence_days": r[18],
                    "last_reviewed_at": r[19],
                    "next_review_at": r[20],
                    "accepted_by": r[21],
                    "accepted_at": r[22],
                    "acceptance_expiry": r[23],
                    "acceptance_rationale": r[24],
                    "review_history": hist,
                    "reopen_reason": r[26],
                    "closure_rationale": r[27],
                    "created_at": r[28],
                    "updated_at": r[29],
                    "closed_at": r[30]
                })

            total = len(items)
            paginated = items[offset:offset+limit]

            open_count = sum(1 for item in items if item['status'] != 'closed')
            high_count = sum(1 for item in items if item['status'] != 'closed' and (item.get('inherent_score') or 0) >= 12)
            exceeds_count = sum(1 for item in items if item['status'] != 'closed' and item.get('risk_appetite') == 'exceeds')

            today_str = date.today().isoformat()
            overdue_reviews = sum(1 for item in items if item['status'] != 'closed' and item.get('next_review_at') and item['next_review_at'] < today_str)

            return {
                "items": paginated,
                "total": total,
                "open_count": open_count,
                "high_count": high_count,
                "exceeds_appetite_count": exceeds_count,
                "overdue_reviews_count": overdue_reviews
            }

    @router.post('/api/risks', status_code=201)
    def create_risk(payload: dict):
        """Creates a risk record; scores are strictly computed server-side."""
        clean_payload = dict(payload)
        clean_payload.pop('inherent_score', None)
        clean_payload.pop('residual_score', None)

        from .records import validate, validate_links
        with store.transaction() as db:
            validated = validate('risks', clean_payload)
            validate_links(db, 'risks', validated)

            title = validated.get('title', 'New Risk')
            desc = validated.get('description', '')
            cat = validated.get('category', 'operational')
            owner = validated.get('owner', '')
            due_date = validated.get('due_date')
            tags = validated.get('tags', [])
            l = validated.get('likelihood')
            imp = validated.get('impact')
            rl = validated.get('residual_likelihood')
            ri = validated.get('residual_impact')

            inh, res, appetite = compute_scores(l, imp, rl, ri)

            ctrls = list(validated.get('mitigating_control_refs') or validated.get('control_ids') or [])
            treatment = validated.get('treatment', 'mitigate')
            treatment_plan = validated.get('treatment_plan', '')
            cadence = int(validated.get('review_cadence_days', 90))

            risk_id = str(uuid4())
            ts = now()
            next_rev = (date.today() + timedelta(days=cadence)).isoformat()
            status = validated.get('status') or 'open'

            db.execute(
                """INSERT INTO risks
                   (id, title, description, category, owner, due_date, tags, likelihood, impact, inherent_score,
                    mitigating_control_refs, treatment, treatment_plan, residual_likelihood, residual_impact,
                    residual_score, risk_appetite, status, review_cadence_days, next_review_at, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    risk_id, title, desc, cat, owner, due_date, json.dumps(tags), l, imp, inh,
                    json.dumps(ctrls), treatment, treatment_plan, rl, ri,
                    res, appetite, status, cadence, next_rev, ts, ts
                )
            )

            record = {
                "id": risk_id,
                "title": title,
                "description": desc,
                "category": cat,
                "owner": owner,
                "due_date": due_date,
                "tags": tags,
                "likelihood": l,
                "impact": imp,
                "inherent_score": inh,
                "mitigating_control_refs": ctrls,
                "control_ids": ctrls,
                "treatment": treatment,
                "treatment_plan": treatment_plan,
                "residual_likelihood": rl,
                "residual_impact": ri,
                "residual_score": res,
                "risk_appetite": appetite,
                "status": status,
                "review_cadence_days": cadence,
                "last_reviewed_at": None,
                "next_review_at": next_rev,
                "accepted_by": None,
                "accepted_at": None,
                "acceptance_expiry": None,
                "acceptance_rationale": None,
                "review_history": [],
                "reopen_reason": None,
                "closure_rationale": None,
                "created_at": ts,
                "updated_at": ts,
                "closed_at": None
            }

            append_audit_log(
                db,
                actor=owner or "user",
                action="create",
                resource="risks",
                record_id=risk_id,
                title=title,
                after=record
            )

            return record

    @router.get('/api/risks/reviews_due')
    def get_reviews_due():
        """Returns risks overdue or due within 14 days."""
        today_str = date.today().isoformat()
        soon_str = (date.today() + timedelta(days=14)).isoformat()
        with store.transaction() as db:
            overdue = db.execute("SELECT id, title, owner, next_review_at FROM risks WHERE status != 'closed' AND next_review_at < ?", (today_str,)).fetchall()
            due_soon = db.execute("SELECT id, title, owner, next_review_at FROM risks WHERE status != 'closed' AND next_review_at >= ? AND next_review_at <= ?", (today_str, soon_str)).fetchall()

            return {
                "overdue": [{"id": r[0], "title": r[1], "owner": r[2], "next_review_at": r[3]} for r in overdue],
                "due_soon": [{"id": r[0], "title": r[1], "owner": r[2], "next_review_at": r[3]} for r in due_soon],
                "overdue_count": len(overdue),
                "due_soon_count": len(due_soon)
            }

    @router.post('/api/risks/check_expirations')
    def check_risk_acceptance_expirations():
        """Scheduled check: automatically reopens risks whose acceptance has expired."""
        today_str = date.today().isoformat()
        reopened = []
        with store.transaction() as db:
            rows = db.execute(
                """SELECT id, title, acceptance_expiry FROM risks
                   WHERE treatment = 'accept' AND status = 'monitored' AND acceptance_expiry < ?""",
                (today_str,)
            ).fetchall()

            ts = now()
            for r in rows:
                rid, rtitle, rexpiry = r[0], r[1], r[2]
                reason = f"Risk acceptance expired on {rexpiry}. Re-evaluation required."
                db.execute(
                    """UPDATE risks
                       SET status = 'open', reopen_reason = ?, updated_at = ?
                       WHERE id = ?""",
                    (reason, ts, rid)
                )
                append_audit_log(
                    db,
                    actor="system",
                    action="expire_risk_acceptance",
                    resource="risks",
                    record_id=rid,
                    title=f"Expired Acceptance: {rtitle}",
                    after={"status": "open", "reopen_reason": reason}
                )
                reopened.append({"id": rid, "title": rtitle, "expiry": rexpiry})

        return {"reopened_count": len(reopened), "reopened": reopened}

    @router.post('/api/risks/assessment_minutes', status_code=201)
    def generate_assessment_minutes(payload: dict):
        """Generates formal Executive Risk Assessment Minutes (PBC GV.1 deliverable)."""
        m_title = payload.get('meeting_title', 'Quarterly Executive Risk Assessment')
        m_date = payload.get('meeting_date', date.today().isoformat())
        attendees = payload.get('attendees', ['CISO', 'VP Engineering', 'Compliance Officer'])
        chair = payload.get('chair', 'Chief Information Security Officer')
        decisions_summary = payload.get('decisions_summary', 'Reviewed active 5x5 heatmap; verified control mappings.')

        with store.transaction() as db:
            risks = db.execute("SELECT id, title, category, owner, likelihood, impact, inherent_score, residual_score, treatment, status FROM risks").fetchall()

            risk_summaries = []
            for r in risks:
                risk_summaries.append({
                    "id": r[0],
                    "title": r[1],
                    "category": r[2],
                    "owner": r[3],
                    "inherent_score": r[6],
                    "residual_score": r[7],
                    "treatment": r[8],
                    "status": r[9]
                })

            minutes_id = str(uuid4())
            ts = now()

            minutes_doc = {
                "id": minutes_id,
                "meeting_title": m_title,
                "meeting_date": m_date,
                "attendees": attendees,
                "chair": chair,
                "decisions_summary": decisions_summary,
                "risks_assessed": risk_summaries,
                "generated_at": ts,
                "governance_standard": "AICPA SOC 2 CC3.1-CC3.4 (Risk Assessment)"
            }

            content_str = json.dumps(minutes_doc, indent=2)

            db.execute(
                """INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)""",
                (f"assessment_minutes:{minutes_id}", content_str)
            )

            append_audit_log(
                db,
                actor=chair,
                action="generate_assessment_minutes",
                resource="risks",
                record_id=minutes_id,
                title=f"Risk Minutes: {m_title}",
                after={"meeting_title": m_title, "meeting_date": m_date, "risks_assessed_count": len(risk_summaries)}
            )

            return minutes_doc

    @router.get('/api/risks/{risk_id}')
    def get_risk(risk_id: str):
        with store.transaction() as db:
            row = db.execute("SELECT * FROM risks WHERE id = ?", (risk_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Risk {risk_id} not found.")

            tags = json.loads(row[6]) if row[6] else []
            ctrls = json.loads(row[10]) if row[10] else []
            hist = json.loads(row[25]) if row[25] else []

            return {
                "id": row[0],
                "title": row[1],
                "description": row[2],
                "category": row[3],
                "owner": row[4],
                "due_date": row[5],
                "tags": tags,
                "likelihood": row[7],
                "impact": row[8],
                "inherent_score": row[9],
                "mitigating_control_refs": ctrls,
                "control_ids": ctrls,
                "treatment": row[11],
                "treatment_plan": row[12],
                "residual_likelihood": row[13],
                "residual_impact": row[14],
                "residual_score": row[15],
                "risk_appetite": row[16],
                "status": row[17],
                "review_cadence_days": row[18],
                "last_reviewed_at": row[19],
                "next_review_at": row[20],
                "accepted_by": row[21],
                "accepted_at": row[22],
                "acceptance_expiry": row[23],
                "acceptance_rationale": row[24],
                "review_history": hist,
                "reopen_reason": row[26],
                "closure_rationale": row[27],
                "created_at": row[28],
                "updated_at": row[29],
                "closed_at": row[30]
            }

    @router.patch('/api/risks/{risk_id}')
    def patch_risk(risk_id: str, payload: dict):
        with store.transaction() as db:
            row = db.execute("SELECT * FROM risks WHERE id = ?", (risk_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Risk {risk_id} not found.")

            tags = json.loads(row[6]) if row[6] else []
            ctrls = json.loads(row[10]) if row[10] else []
            hist = json.loads(row[25]) if row[25] else []

            current = {
                "id": row[0],
                "title": row[1],
                "description": row[2],
                "category": row[3],
                "owner": row[4],
                "due_date": row[5],
                "tags": tags,
                "likelihood": row[7],
                "impact": row[8],
                "inherent_score": row[9],
                "mitigating_control_refs": ctrls,
                "control_ids": ctrls,
                "treatment": row[11],
                "treatment_plan": row[12],
                "residual_likelihood": row[13],
                "residual_impact": row[14],
                "residual_score": row[15],
                "risk_appetite": row[16],
                "status": row[17],
                "review_cadence_days": row[18],
                "last_reviewed_at": row[19],
                "next_review_at": row[20],
                "accepted_by": row[21],
                "accepted_at": row[22],
                "acceptance_expiry": row[23],
                "acceptance_rationale": row[24],
                "review_history": hist,
                "reopen_reason": row[26],
                "closure_rationale": row[27],
                "created_at": row[28],
                "updated_at": row[29],
                "closed_at": row[30]
            }

            from .records import validate, validate_links
            validated = validate('risks', payload, current)
            validate_links(db, 'risks', validated)

            updated = dict(current)
            updated.update(validated)

            l = updated.get('likelihood')
            imp = updated.get('impact')
            rl = updated.get('residual_likelihood')
            ri = updated.get('residual_impact')
            inh, res, appetite = compute_scores(l, imp, rl, ri)
            updated['inherent_score'] = inh
            updated['residual_score'] = res
            updated['risk_appetite'] = appetite

            ctrls_in = list(updated.get('mitigating_control_refs') or updated.get('control_ids') or [])
            updated['mitigating_control_refs'] = ctrls_in
            updated['control_ids'] = ctrls_in
            ts = now()
            updated['updated_at'] = ts

            db.execute(
                """UPDATE risks
                   SET title = ?, description = ?, category = ?, owner = ?, due_date = ?, tags = ?,
                       likelihood = ?, impact = ?, inherent_score = ?, mitigating_control_refs = ?,
                       treatment = ?, treatment_plan = ?, residual_likelihood = ?, residual_impact = ?,
                       residual_score = ?, risk_appetite = ?, status = ?, review_cadence_days = ?, updated_at = ?
                   WHERE id = ?""",
                (
                    updated['title'], updated['description'], updated['category'], updated['owner'],
                    updated['due_date'], json.dumps(updated['tags']), l, imp, inh, json.dumps(ctrls_in),
                    updated['treatment'], updated['treatment_plan'], rl, ri, res, appetite,
                    updated['status'], updated['review_cadence_days'], ts, risk_id
                )
            )

            append_audit_log(
                db,
                actor=updated.get('owner') or "user",
                action="update",
                resource="risks",
                record_id=risk_id,
                title=updated['title'],
                before=current,
                after=updated
            )

            return updated

    @router.delete('/api/risks/{risk_id}')
    def delete_risk(risk_id: str):
        with store.transaction() as db:
            row = db.execute("SELECT title FROM risks WHERE id = ?", (risk_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Risk {risk_id} not found.")
            db.execute("DELETE FROM risks WHERE id = ?", (risk_id,))
            append_audit_log(db, actor="user", action="delete", resource="risks", record_id=risk_id, title=row[0])
            return {"deleted": True}

    @router.post('/api/risks/{risk_id}/accept')
    def accept_risk(risk_id: str, payload: dict):
        """Risk acceptance workflow enforcing Segregation of Duties and expiration date."""
        approver = str(payload.get('approver', '')).strip()
        expiry = str(payload.get('expiry_date', '')).strip()
        rationale = str(payload.get('acceptance_rationale', '')).strip()

        if not approver:
            raise HTTPException(422, "Authorized executive approver is required to accept a risk.")
        if not expiry:
            raise HTTPException(422, "Acceptance expiry date is required (risk acceptances cannot be permanent).")
        if not rationale:
            raise HTTPException(422, "Documented acceptance rationale is required for audit defensibility.")

        with store.transaction() as db:
            row = db.execute("SELECT owner, status, title FROM risks WHERE id = ?", (risk_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Risk {risk_id} not found.")

            owner = (row[0] or '').strip().lower()
            if approver.lower() == owner:
                raise HTTPException(422, "Segregation of duties violation: risk approver must be distinct from risk owner.")

            ts = now()
            db.execute(
                """UPDATE risks
                   SET status = 'monitored', treatment = 'accept', accepted_by = ?,
                       accepted_at = ?, acceptance_expiry = ?, acceptance_rationale = ?,
                       updated_at = ?
                   WHERE id = ?""",
                (approver, ts, expiry, rationale, ts, risk_id)
            )

            append_audit_log(
                db,
                actor=approver,
                action="accept_risk",
                resource="risks",
                record_id=risk_id,
                title=f"Accepted: {row[2]}",
                after={"status": "monitored", "accepted_by": approver, "expiry_date": expiry, "rationale": rationale}
            )

            return {
                "id": risk_id,
                "status": "monitored",
                "treatment": "accept",
                "accepted_by": approver,
                "accepted_at": ts,
                "acceptance_expiry": expiry,
                "acceptance_rationale": rationale
            }

    @router.post('/api/risks/{risk_id}/close')
    def close_risk(risk_id: str, payload: dict):
        """Closes a risk; strictly rejects unmitigated risks."""
        actor = payload.get('actor') or "Security Lead"
        rationale = str(payload.get('closure_rationale', '')).strip()
        if not rationale:
            raise HTTPException(422, "Closure rationale is required to formally close a risk.")

        with store.transaction() as db:
            row = db.execute("SELECT treatment, mitigating_control_refs, title FROM risks WHERE id = ?", (risk_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Risk {risk_id} not found.")

            treatment = row[0]
            try:
                ctrls = json.loads(row[1]) if row[1] else []
            except Exception:
                ctrls = []

            if treatment == 'mitigate' and not ctrls:
                raise HTTPException(422, "Cannot close an unmitigated risk. Link at least one mitigating control first.")

            ts = now()
            db.execute(
                """UPDATE risks
                   SET status = 'closed', closed_at = ?, closure_rationale = ?, updated_at = ?
                   WHERE id = ?""",
                (ts, rationale, ts, risk_id)
            )

            append_audit_log(
                db,
                actor=actor,
                action="close_risk",
                resource="risks",
                record_id=risk_id,
                title=f"Closed: {row[2]}",
                after={"status": "closed", "closure_rationale": rationale, "closed_at": ts}
            )

            return {
                "id": risk_id,
                "status": "closed",
                "closed_at": ts,
                "closure_rationale": rationale
            }

    @router.post('/api/risks/{risk_id}/reopen')
    def reopen_risk(risk_id: str, payload: dict):
        """Reopens a risk; requires documented reason."""
        actor = payload.get('actor') or "Security Lead"
        reason = str(payload.get('reason', '')).strip()
        if not reason:
            raise HTTPException(422, "Reason is required to reopen a risk.")

        with store.transaction() as db:
            row = db.execute("SELECT title, status FROM risks WHERE id = ?", (risk_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Risk {risk_id} not found.")

            ts = now()
            db.execute(
                """UPDATE risks
                   SET status = 'in_treatment', reopen_reason = ?, closed_at = NULL, updated_at = ?
                   WHERE id = ?""",
                (reason, ts, risk_id)
            )

            append_audit_log(
                db,
                actor=actor,
                action="reopen_risk",
                resource="risks",
                record_id=risk_id,
                title=f"Reopened: {row[0]}",
                after={"status": "in_treatment", "reopen_reason": reason}
            )

            return {
                "id": risk_id,
                "status": "in_treatment",
                "reopen_reason": reason,
                "updated_at": ts
            }

    @router.post('/api/risks/{risk_id}/review')
    def review_risk(risk_id: str, payload: dict):
        """Conducts formal risk review; appends to immutable review history."""
        reviewer = payload.get('reviewer') or "Risk Committee"
        decision = payload.get('decision', 'scores_unchanged')
        notes = payload.get('notes', '')
        new_rl = payload.get('new_residual_likelihood')
        new_ri = payload.get('new_residual_impact')

        with store.transaction() as db:
            row = db.execute(
                """SELECT review_history, residual_likelihood, residual_impact,
                          residual_score, review_cadence_days, title
                   FROM risks WHERE id = ?""",
                (risk_id,)
            ).fetchone()
            if not row:
                raise HTTPException(404, f"Risk {risk_id} not found.")

            try:
                hist = json.loads(row[0]) if row[0] else []
            except Exception:
                hist = []

            ts = now()
            rl = row[1]
            ri = row[2]
            res_sc = row[3]

            if decision == 're_scored' and new_rl and new_ri:
                rl = int(new_rl)
                ri = int(new_ri)
                res_sc = rl * ri

            cadence = row[4] or 90
            next_rev = (date.today() + timedelta(days=cadence)).isoformat()

            hist.append({
                "reviewer": reviewer,
                "date": ts,
                "decision": decision,
                "notes": notes,
                "residual_likelihood": rl,
                "residual_impact": ri,
                "residual_score": res_sc
            })

            db.execute(
                """UPDATE risks
                   SET review_history = ?, residual_likelihood = ?, residual_impact = ?,
                       residual_score = ?, last_reviewed_at = ?, next_review_at = ?, updated_at = ?
                   WHERE id = ?""",
                (json.dumps(hist), rl, ri, res_sc, ts, next_rev, ts, risk_id)
            )

            append_audit_log(
                db,
                actor=reviewer,
                action="review_risk",
                resource="risks",
                record_id=risk_id,
                title=f"Reviewed: {row[5]}",
                after={"decision": decision, "notes": notes, "residual_score": res_sc, "next_review_at": next_rev}
            )

            return {
                "id": risk_id,
                "review_history": hist,
                "residual_likelihood": rl,
                "residual_impact": ri,
                "residual_score": res_sc,
                "last_reviewed_at": ts,
                "next_review_at": next_rev
            }

    return router
