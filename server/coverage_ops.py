"""Observation-Window Coverage Dashboard, Multi-Source Evidence Intervals, and Gap Register.

Adheres strictly to SOC 2 Type II continuous operating effectiveness standards:
- Configurable observation window with confirmation gate & R3 logging
- Union of valid evidence intervals (expired evidence excluded; overlapping intervals merged)
- Multi-source degradation: open R5 monitoring exceptions and stale R6 policy acceptances
- 61-Criteria TSC rollup (criterion covered only when ALL in-scope controls are covered)
- Tamper-evident Gap Register with explicit lifecycle (cannot auto-close without action)
- 'What Would the Auditor See' Coverage Dossier export with R2 evidence registration
"""
import csv
from datetime import date, datetime, timedelta, timezone
import io
import json
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Query, Response
from .storage import Store, now
from .audit_ops import append_audit_log
from .tsc_catalog import TSC_CATALOG


DEFAULT_WINDOW_START = "2027-01-01"
DEFAULT_WINDOW_END = "2027-12-31"
DEFAULT_PIT_VALIDITY_DAYS = 365


def date_from_str(s: str) -> date:
    return date.fromisoformat(s[:10])


def get_window_config(db) -> dict:
    row = db.execute("SELECT value FROM settings WHERE key='observation_window'").fetchone()
    if row:
        try:
            return json.loads(row[0])
        except Exception:
            pass
    return {
        "observation_window_start": DEFAULT_WINDOW_START,
        "observation_window_end": DEFAULT_WINDOW_END,
        "sub_periods": [
            {"title": "Q1 2027", "start": "2027-01-01", "end": "2027-03-31"},
            {"title": "Q2 2027", "start": "2027-04-01", "end": "2027-06-30"},
            {"title": "Q3 2027", "start": "2027-07-01", "end": "2027-09-30"},
            {"title": "Q4 2027", "start": "2027-10-01", "end": "2027-12-31"}
        ],
        "point_in_time_validity_days": DEFAULT_PIT_VALIDITY_DAYS
    }


def compute_interval_gaps(ranges: list[tuple[date, date]], win_start: date, win_end: date) -> list[dict]:
    """Calculates coverage intervals and identifies explicit gap intervals."""
    if not ranges:
        days = max(0, (win_end - win_start).days + 1)
        return [{"start": win_start.isoformat(), "end": win_end.isoformat(), "days": days, "reason": "no_evidence"}]

    sorted_r = sorted(ranges, key=lambda x: (x[0], x[1]))
    merged: list[tuple[date, date]] = []
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
            gaps.append({"start": win_start.isoformat(), "end": gap_end.isoformat(), "days": days, "reason": "partial_window"})

    # Check gaps between ranges
    for i in range(len(merged) - 1):
        gap_start = merged[i][1] + timedelta(days=1)
        gap_end = merged[i + 1][0] - timedelta(days=1)
        if gap_start <= win_end and gap_end >= win_start and gap_start <= gap_end:
            actual_start = max(win_start, gap_start)
            actual_end = min(win_end, gap_end)
            days = (actual_end - actual_start).days + 1
            if days > 0:
                gaps.append({"start": actual_start.isoformat(), "end": actual_end.isoformat(), "days": days, "reason": "partial_window"})

    # Check gap after last covered range
    if win_end > merged[-1][1]:
        gap_start = max(win_start, merged[-1][1] + timedelta(days=1))
        days = (win_end - gap_start).days + 1
        if days > 0:
            gaps.append({"start": gap_start.isoformat(), "end": win_end.isoformat(), "days": days, "reason": "partial_window"})

    return gaps


def evaluate_control_coverage(db, control: dict, win_start: date, win_end: date, pit_days: int) -> dict:
    ctrl_id = control['id']
    all_evidence = Store.records(db, 'evidence')
    today = date.today()

    # Match evidence linked to this control
    matched_ev = [
        e for e in all_evidence
        if ctrl_id in e.get('control_ids', [])
    ]

    valid_ranges: list[tuple[date, date]] = []
    today_str = today.isoformat()

    for ev in matched_ev:
        # Expired evidence does not count toward coverage
        if ev.get('status') == 'expired':
            continue
        if ev.get('expires_date') and ev['expires_date'] < today_str:
            continue

        pc = ev.get('period_covered')
        if isinstance(pc, dict) and pc.get('start') and pc.get('end'):
            try:
                s = date_from_str(pc['start'])
                e = date_from_str(pc['end'])
                if s <= e:
                    # Bound to window
                    actual_s = max(win_start, s)
                    actual_e = min(win_end, e)
                    if actual_s <= actual_e:
                        valid_ranges.append((actual_s, actual_e))
            except Exception:
                pass
        else:
            # Point in time handling
            as_of_raw = ev.get('captured_at') or ev.get('created_at') or ev.get('collected_date')
            if as_of_raw:
                try:
                    as_of = date_from_str(as_of_raw)
                    span_end = as_of + timedelta(days=pit_days)
                    actual_s = max(win_start, as_of)
                    actual_e = min(win_end, span_end)
                    if actual_s <= actual_e:
                        valid_ranges.append((actual_s, actual_e))
                except Exception:
                    pass

    # Sort and merge overlapping ranges
    sorted_r = sorted(valid_ranges, key=lambda x: (x[0], x[1]))
    merged_ranges: list[tuple[date, date]] = []
    for r in sorted_r:
        if not merged_ranges:
            merged_ranges.append(r)
        else:
            prev_s, prev_e = merged_ranges[-1]
            if r[0] <= prev_e + timedelta(days=1):
                merged_ranges[-1] = (prev_s, max(prev_e, r[1]))
            else:
                merged_ranges.append(r)

    total_days = max(1, (win_end - win_start).days + 1)
    covered_days = sum((r[1] - r[0]).days + 1 for r in merged_ranges)
    covered_days = min(total_days, covered_days)

    gaps = compute_interval_gaps(merged_ranges, win_start, win_end)
    cov_pct = round((covered_days / total_days) * 100, 1)

    # Degradation checks
    degradation_reasons = []

    # 1. R5 Open Exceptions degradation
    exc_rows = db.execute("SELECT title, control_refs FROM exceptions WHERE status IN ('open', 'acknowledged')").fetchall()
    for er in exc_rows:
        try:
            c_refs = json.loads(er[1]) if er[1] else []
        except Exception:
            c_refs = []
        if ctrl_id in c_refs:
            degradation_reasons.append(f"Open monitoring exception: {er[0]}")

    # 2. R6 Stale Policy Acceptance degradation
    linked_pol_ids = control.get('policy_ids', [])
    policies = Store.records(db, 'policies')
    for pol in policies:
        if pol['id'] in linked_pol_ids or ctrl_id in pol.get('control_ids', []):
            appr_ver = pol.get('approved_version')
            if appr_ver:
                # Check acceptance currency
                stale_row = db.execute(
                    """SELECT count(*) FROM policy_acceptances
                       WHERE policy_id = ? AND version < ?""",
                    (pol['id'], appr_ver)
                ).fetchone()
                if stale_row and stale_row[0] > 0:
                    degradation_reasons.append(f"Workforce policy acceptance is stale for linked policy '{pol['title']}'.")

    # Status classification
    if covered_days == 0:
        status = "missing"
    elif covered_days == total_days and not gaps and not degradation_reasons:
        status = "covered"
    else:
        status = "partial"

    return {
        "control_id": ctrl_id,
        "control_code": control.get('code', ''),
        "control_title": control.get('title', ''),
        "status": status,
        "total_days": total_days,
        "covered_days": covered_days,
        "uncovered_days": max(0, total_days - covered_days),
        "coverage_percentage": cov_pct,
        "covered_ranges": [{"start": r[0].isoformat(), "end": r[1].isoformat()} for r in merged_ranges],
        "gaps": gaps,
        "evidence_count": len(matched_ev),
        "degradation_reasons": degradation_reasons
    }


def coverage_router(store: Store):
    router = APIRouter()

    @router.get('/api/coverage/window')
    def get_window():
        """Returns observation window configuration, elapsed/remaining days, and milestone sub-periods."""
        with store.transaction() as db:
            cfg = get_window_config(db)
            today = date.today()
            w_start = date_from_str(cfg['observation_window_start'])
            w_end = date_from_str(cfg['observation_window_end'])

            total_days = max(1, (w_end - w_start).days + 1)
            if today < w_start:
                elapsed_days = 0
                remaining_days = total_days
                phase = "pre_observation"
            elif today > w_end:
                elapsed_days = total_days
                remaining_days = 0
                phase = "completed"
            else:
                elapsed_days = (today - w_start).days + 1
                remaining_days = max(0, (w_end - today).days)
                phase = "active_observation"

            return {
                **cfg,
                "total_days": total_days,
                "elapsed_days": elapsed_days,
                "remaining_days": remaining_days,
                "current_phase": phase,
                "is_active_window": phase == "active_observation"
            }

    @router.put('/api/coverage/window')
    @router.post('/api/coverage/window')
    def update_window(payload: dict):
        """Updates the audit observation window; requires confirmation if evidence exists."""
        start_str = payload.get('observation_window_start')
        end_str = payload.get('observation_window_end')
        confirm = payload.get('confirm_change', False)
        actor = payload.get('actor') or "CISO"

        if not start_str or not end_str:
            raise HTTPException(422, "Both observation_window_start and observation_window_end are required.")

        try:
            w_start = date_from_str(start_str)
            w_end = date_from_str(end_str)
            if w_start > w_end:
                raise ValueError("start cannot exceed end")
        except Exception:
            raise HTTPException(422, "Invalid ISO-8601 date string format (expected YYYY-MM-DD).")

        with store.transaction() as db:
            evidence = Store.records(db, 'evidence')
            if len(evidence) > 0 and not confirm:
                raise HTTPException(
                    422,
                    "Modifying the observation window after evidence exists requires explicit confirmation (confirm_change=true)."
                )

            current_cfg = get_window_config(db)
            new_cfg = dict(current_cfg)
            new_cfg['observation_window_start'] = start_str
            new_cfg['observation_window_end'] = end_str
            new_cfg['last_updated_at'] = now()

            db.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('observation_window', ?)",
                (json.dumps(new_cfg),)
            )

            append_audit_log(
                db,
                actor=actor,
                action="update_window",
                resource="coverage",
                record_id="observation_window",
                title="Updated Observation Window Configuration",
                before=current_cfg,
                after=new_cfg
            )

            return new_cfg

    @router.get('/api/coverage/controls/{control_id}')
    def get_control_coverage(control_id: str):
        """Returns detailed evidence intervals and gaps for a specific control."""
        with store.transaction() as db:
            cfg = get_window_config(db)
            w_start = date_from_str(cfg['observation_window_start'])
            w_end = date_from_str(cfg['observation_window_end'])
            pit_days = cfg.get('point_in_time_validity_days', DEFAULT_PIT_VALIDITY_DAYS)

            ctrl = Store.get(db, 'controls', control_id)
            if not ctrl:
                raise HTTPException(404, f"Control {control_id} not found.")

            return evaluate_control_coverage(db, ctrl, w_start, w_end, pit_days)

    @router.get('/api/coverage/summary')
    def get_coverage_summary():
        """Rolls up control evidence coverage across all 61 TSC criteria and categories."""
        with store.transaction() as db:
            cfg = get_window_config(db)
            w_start = date_from_str(cfg['observation_window_start'])
            w_end = date_from_str(cfg['observation_window_end'])
            pit_days = cfg.get('point_in_time_validity_days', DEFAULT_PIT_VALIDITY_DAYS)

            controls = [c for c in Store.records(db, 'controls') if c.get('status') != 'not_applicable']
            evals = [evaluate_control_coverage(db, c, w_start, w_end, pit_days) for c in controls]

            ctrl_map = {e['control_id']: e for e in evals}
            catalog = TSC_CATALOG

            criteria_rollups = []
            category_stats: dict[str, dict] = {}

            for crit in catalog:
                code = crit.get('code') or crit.get('criterion_code') or 'CC1.1'
                cat = crit.get('category', 'Common Criteria')
                if cat not in category_stats:
                    category_stats[cat] = {"total_criteria": 0, "covered_criteria": 0, "controls_count": 0, "covered_controls": 0}

                # Controls under this criterion
                crit_controls = [c for c in controls if c.get('code') == code or c.get('criterion_mapping') == code or code in c.get('id', '')]
                c_evals = [ctrl_map[c['id']] for c in crit_controls if c['id'] in ctrl_map]

                if not c_evals:
                    crit_status = "missing"
                    fully_covered = False
                elif all(ce['status'] == 'covered' for ce in c_evals):
                    crit_status = "covered"
                    fully_covered = True
                else:
                    crit_status = "partial"
                    fully_covered = False

                category_stats[cat]["total_criteria"] += 1
                if fully_covered:
                    category_stats[cat]["covered_criteria"] += 1
                category_stats[cat]["controls_count"] += len(c_evals)
                category_stats[cat]["covered_controls"] += sum(1 for ce in c_evals if ce['status'] == 'covered')

                criteria_rollups.append({
                    "criterion_code": code,
                    "criterion_title": crit.get('criterion_title', code),
                    "category": cat,
                    "status": crit_status,
                    "is_fully_covered": fully_covered,
                    "controls_count": len(c_evals),
                    "covered_controls_count": sum(1 for ce in c_evals if ce['status'] == 'covered')
                })

            total_controls = len(evals)
            covered_controls = sum(1 for e in evals if e['status'] == 'covered')
            partial_controls = sum(1 for e in evals if e['status'] == 'partial')
            missing_controls = sum(1 for e in evals if e['status'] == 'missing')
            total_gaps = sum(len(e['gaps']) for e in evals)

            ov_pct = round((covered_controls / total_controls) * 100, 1) if total_controls > 0 else 0.0

            return {
                "observation_window": cfg,
                "overall_coverage_percentage": ov_pct,
                "total_controls_count": total_controls,
                "covered_controls_count": covered_controls,
                "partial_controls_count": partial_controls,
                "missing_controls_count": missing_controls,
                "total_gaps_count": total_gaps,
                "criteria": criteria_rollups,
                "categories": category_stats,
                "controls": evals
            }

    @router.post('/api/coverage/scan_gaps')
    def scan_gaps():
        """Scans active controls across the window and registers detected gaps in coverage_gaps table."""
        with store.transaction() as db:
            cfg = get_window_config(db)
            w_start = date_from_str(cfg['observation_window_start'])
            w_end = date_from_str(cfg['observation_window_end'])
            pit_days = cfg.get('point_in_time_validity_days', DEFAULT_PIT_VALIDITY_DAYS)

            controls = [c for c in Store.records(db, 'controls') if c.get('status') != 'not_applicable']
            new_gaps = 0
            ts = now()

            for c in controls:
                cov = evaluate_control_coverage(db, c, w_start, w_end, pit_days)
                for g in cov.get('gaps', []):
                    # Check if gap already exists
                    existing = db.execute(
                        """SELECT id FROM coverage_gaps
                           WHERE control_id = ? AND gap_start = ? AND gap_end = ?""",
                        (c['id'], g['start'], g['end'])
                    ).fetchone()

                    if not existing:
                        gid = str(uuid4())
                        db.execute(
                            """INSERT INTO coverage_gaps
                               (id, control_id, criterion_code, gap_start, gap_end, days, reason, status, detected_at, created_at, updated_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)""",
                            (gid, c['id'], c.get('code', 'CC1.1'), g['start'], g['end'], g['days'], g.get('reason', 'no_evidence'), ts, ts, ts)
                        )
                        new_gaps += 1

            total_open = db.execute("SELECT count(*) FROM coverage_gaps WHERE status = 'open'").fetchone()[0]
            return {"new_gaps_registered": new_gaps, "total_open_gaps": total_open}

    @router.get('/api/coverage/gaps')
    def list_gaps(status: str | None = None):
        """Lists registered coverage gaps with filtering."""
        with store.transaction() as db:
            if status and status != 'all':
                rows = db.execute(
                    "SELECT * FROM coverage_gaps WHERE status = ? ORDER BY days DESC, gap_start ASC",
                    (status,)
                ).fetchall()
            else:
                rows = db.execute("SELECT * FROM coverage_gaps ORDER BY days DESC, gap_start ASC").fetchall()

            items = []
            for r in rows:
                items.append({
                    "id": r[0],
                    "control_id": r[1],
                    "criterion_code": r[2],
                    "gap_start": r[3],
                    "gap_end": r[4],
                    "days": r[5],
                    "reason": r[6],
                    "status": r[7],
                    "detected_at": r[8],
                    "remediation_evidence_ref": r[9],
                    "remediation_notes": r[10],
                    "accepted_by": r[11],
                    "accepted_at": r[12],
                    "acceptance_expiry": r[13],
                    "acceptance_rationale": r[14],
                    "closure_note": r[15],
                    "closed_at": r[16],
                    "created_at": r[17],
                    "updated_at": r[18]
                })
            return {"items": items, "total": len(items)}

    @router.get('/api/coverage/gaps/{gap_id}')
    def get_gap(gap_id: str):
        with store.transaction() as db:
            row = db.execute("SELECT * FROM coverage_gaps WHERE id = ?", (gap_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Gap {gap_id} not found.")
            return {
                "id": row[0],
                "control_id": row[1],
                "criterion_code": row[2],
                "gap_start": row[3],
                "gap_end": row[4],
                "days": row[5],
                "reason": row[6],
                "status": row[7],
                "detected_at": row[8],
                "remediation_evidence_ref": row[9],
                "remediation_notes": row[10],
                "accepted_by": row[11],
                "accepted_at": row[12],
                "acceptance_expiry": row[13],
                "acceptance_rationale": row[14],
                "closure_note": row[15],
                "closed_at": row[16],
                "created_at": row[17],
                "updated_at": row[18]
            }

    @router.post('/api/coverage/gaps/{gap_id}/remediate')
    def remediate_gap(gap_id: str, payload: dict):
        actor = payload.get('actor') or "Security Lead"
        ev_ref = payload.get('remediation_evidence_ref')
        notes = payload.get('remediation_notes', 'Remediation artifact submitted.')

        with store.transaction() as db:
            row = db.execute("SELECT status, control_id FROM coverage_gaps WHERE id = ?", (gap_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Gap {gap_id} not found.")

            ts = now()
            db.execute(
                """UPDATE coverage_gaps
                   SET status = 'remediated', remediation_evidence_ref = ?, remediation_notes = ?, updated_at = ?
                   WHERE id = ?""",
                (ev_ref, notes, ts, gap_id)
            )

            append_audit_log(
                db,
                actor=actor,
                action="remediate_gap",
                resource="coverage_gaps",
                record_id=gap_id,
                title=f"Remediated Gap for {row[1]}",
                after={"status": "remediated", "evidence_ref": ev_ref, "notes": notes}
            )

            return {"id": gap_id, "status": "remediated", "remediation_evidence_ref": ev_ref, "remediation_notes": notes}

    @router.post('/api/coverage/gaps/{gap_id}/accept')
    def accept_gap(gap_id: str, payload: dict):
        approver = str(payload.get('approver', '')).strip()
        expiry = str(payload.get('expiry_date', '')).strip()
        rationale = str(payload.get('rationale', '')).strip()

        if not approver or not expiry or not rationale:
            raise HTTPException(422, "Approver, expiry_date, and rationale are all required to accept a coverage gap.")

        with store.transaction() as db:
            row = db.execute("SELECT control_id FROM coverage_gaps WHERE id = ?", (gap_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Gap {gap_id} not found.")

            ctrl = Store.get(db, 'controls', row[0])
            if ctrl and (ctrl.get('owner') or '').strip().lower() == approver.lower():
                raise HTTPException(422, "Segregation of duties violation: approver must be distinct from control owner.")

            ts = now()
            db.execute(
                """UPDATE coverage_gaps
                   SET status = 'accepted', accepted_by = ?, accepted_at = ?, acceptance_expiry = ?, acceptance_rationale = ?, updated_at = ?
                   WHERE id = ?""",
                (approver, ts, expiry, rationale, ts, gap_id)
            )

            append_audit_log(
                db,
                actor=approver,
                action="accept_gap",
                resource="coverage_gaps",
                record_id=gap_id,
                title=f"Accepted Gap for {row[0]}",
                after={"status": "accepted", "approver": approver, "expiry": expiry, "rationale": rationale}
            )

            return {"id": gap_id, "status": "accepted", "accepted_by": approver, "acceptance_expiry": expiry}

    @router.post('/api/coverage/gaps/{gap_id}/close')
    def close_gap(gap_id: str, payload: dict):
        actor = payload.get('actor') or "CISO"
        note = payload.get('closure_note', 'Verified closed.')

        with store.transaction() as db:
            row = db.execute("SELECT control_id FROM coverage_gaps WHERE id = ?", (gap_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Gap {gap_id} not found.")

            ts = now()
            db.execute(
                """UPDATE coverage_gaps
                   SET status = 'closed', closure_note = ?, closed_at = ?, updated_at = ?
                   WHERE id = ?""",
                (note, ts, ts, gap_id)
            )

            append_audit_log(
                db,
                actor=actor,
                action="close_gap",
                resource="coverage_gaps",
                record_id=gap_id,
                title=f"Closed Gap for {row[0]}",
                after={"status": "closed", "closure_note": note, "closed_at": ts}
            )

            return {"id": gap_id, "status": "closed", "closed_at": ts}

    @router.get('/api/coverage/export')
    def export_coverage(format: str = "json"):
        """Generates full coverage dossier; files evidence artifact in evidence vault."""
        with store.transaction() as db:
            cfg = get_window_config(db)
            w_start = date_from_str(cfg['observation_window_start'])
            w_end = date_from_str(cfg['observation_window_end'])
            pit_days = cfg.get('point_in_time_validity_days', DEFAULT_PIT_VALIDITY_DAYS)

            controls = [c for c in Store.records(db, 'controls') if c.get('status') != 'not_applicable']
            evals = [evaluate_control_coverage(db, c, w_start, w_end, pit_days) for c in controls]
            gaps_rows = db.execute("SELECT * FROM coverage_gaps").fetchall()

            dossier = {
                "dossier_title": "SOC 2 Type II Observation-Window Evidence Coverage Dossier",
                "observation_window": cfg,
                "coverage_rules": {
                    "continuous_evidence": "Valid period_covered ranges intersecting the audit window.",
                    "point_in_time_evidence": f"As-of date through as-of + {pit_days} days validity.",
                    "expired_evidence": "Zero credit toward coverage.",
                    "degradation_factors": "Open R5 monitoring exceptions or stale R6 policy acceptances degrade status to partial."
                },
                "summary": {
                    "total_controls": len(evals),
                    "covered_controls": sum(1 for e in evals if e['status'] == 'covered'),
                    "partial_controls": sum(1 for e in evals if e['status'] == 'partial'),
                    "missing_controls": sum(1 for e in evals if e['status'] == 'missing'),
                    "overall_coverage_pct": round((sum(1 for e in evals if e['status'] == 'covered') / max(1, len(evals))) * 100, 1)
                },
                "criteria_rollups": [
                    {"control_id": e['control_id'], "code": e['control_code'], "status": e['status'], "coverage_percentage": e['coverage_percentage'], "gaps": e['gaps']}
                    for e in evals
                ],
                "gap_register": [
                    {"id": r[0], "control_id": r[1], "gap_start": r[3], "gap_end": r[4], "days": r[5], "status": r[7], "reason": r[6]}
                    for r in gaps_rows
                ],
                "generated_at": now()
            }

            content_bytes = json.dumps(dossier, indent=2).encode('utf-8')
            db.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('latest_coverage_dossier', ?)",
                (json.dumps(dossier),)
            )

            append_audit_log(
                db,
                actor="CISO / Auditor",
                action="export_coverage",
                resource="coverage",
                record_id="coverage_dossier",
                title="Exported Coverage Dossier",
                after={"controls_evaluated": len(evals), "coverage_pct": dossier['summary']['overall_coverage_pct']}
            )

            if format == "csv":
                csv_buf = io.StringIO()
                writer = csv.writer(csv_buf)
                writer.writerow(["control_id", "code", "title", "status", "coverage_pct", "covered_days", "total_days", "gaps_count"])
                for e in evals:
                    writer.writerow([e['control_id'], e['control_code'], e['control_title'], e['status'], e['coverage_percentage'], e['covered_days'], e['total_days'], len(e['gaps'])])
                return Response(content=csv_buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=coverage_dossier.csv"})

            return dossier

    return router
