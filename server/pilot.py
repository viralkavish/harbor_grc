"""tofromGRC — Blind Pilot Module.

Validates TypeSafe JEV System One judgment primitives on tofrom's own documents before
trusting it in production. Generates stratified policy x control sample pairs, runs Jev
evaluations in single-pair mode, collects blind human grades (with Jev verdicts strictly hidden),
and computes overall agreement, high-confidence agreement, confusion matrix, token costs, and
formal GO/NO-GO gate threshold validation.
"""
from datetime import datetime
import json
import random
from typing import Any
from uuid import uuid4
from fastapi import APIRouter, HTTPException
from .storage import Store, now
from .records import log
from .jev_evaluator import evaluate_policy_against_controls

COST_PER_MILLION_INPUT_TOKENS = 0.042
HIGH_CONFIDENCE_THRESHOLD = 0.80
GATE_MIN_OVERALL_AGREEMENT = 90.0
GATE_MIN_HIGH_CONF_AGREEMENT = 95.0

LABELS = ["compatible", "gap", "conflict", "not_applicable"]


def normalize_verdict(v: str | None) -> str:
    if not v:
        return "not_applicable"
    norm = v.lower().strip()
    if norm in ("partial_gap", "insufficient"):
        return "gap"
    if norm in ("supported",):
        return "compatible"
    if norm in ("contradicted",):
        return "conflict"
    if norm in LABELS:
        return norm
    return "not_applicable"


def sample_stratified_pairs(
    policies: list[dict],
    controls: list[dict],
    sample_size: int = 36,
    seed: int | None = None
) -> list[dict]:
    """Generates a stratified, balanced sample of policy x control pairs across compliance categories."""
    if not policies or not controls:
        return []

    rng = random.Random(seed)

    # Group controls by category for stratified sampling
    controls_by_cat: dict[str, list[dict]] = {}
    for c in controls:
        cat = c.get('category') or 'General Controls'
        controls_by_cat.setdefault(cat, []).append(c)

    categories = list(controls_by_cat.keys())
    per_cat = max(1, sample_size // len(categories)) if categories else sample_size

    sampled_pairs = []
    seen = set()

    # Stratified selection
    for cat in categories:
        cat_controls = list(controls_by_cat[cat])
        rng.shuffle(cat_controls)
        for ctrl in cat_controls:
            if len([p for p in sampled_pairs if p['control_category'] == cat]) >= per_cat:
                break
            # Pair with a random policy from the pool
            pol = rng.choice(policies)
            pair_key = (pol['id'], ctrl['id'])
            if pair_key in seen:
                continue
            seen.add(pair_key)

            # Extract snippet
            content = pol.get('content', '')
            snippet = content[:2000].strip() or "No content recorded."

            sampled_pairs.append({
                "id": f"pair-{uuid4().hex[:10]}",
                "policy_id": pol['id'],
                "policy_title": pol.get('title', 'Untitled Policy'),
                "policy_snippet": snippet,
                "control_id": ctrl.get('id', ''),
                "control_code": ctrl.get('code', 'CTL'),
                "control_title": ctrl.get('title', ''),
                "control_category": cat,
                "jev_verdict": None,
                "jev_confidence": None,
                "jev_score": None,
                "jev_decided_by": None,
                "jev_summary": None,
                "human_verdict": None,
                "graded_at": None
            })

            if len(sampled_pairs) >= sample_size:
                break
        if len(sampled_pairs) >= sample_size:
            break

    # If still under target sample size, fill from remaining candidate combinations
    if len(sampled_pairs) < sample_size:
        all_candidates = []
        for pol in policies:
            for ctrl in controls:
                if (pol['id'], ctrl['id']) not in seen:
                    all_candidates.append((pol, ctrl))
        rng.shuffle(all_candidates)
        for pol, ctrl in all_candidates:
            if len(sampled_pairs) >= sample_size:
                break
            seen.add((pol['id'], ctrl['id']))
            cat = ctrl.get('category') or 'General Controls'
            sampled_pairs.append({
                "id": f"pair-{uuid4().hex[:10]}",
                "policy_id": pol['id'],
                "policy_title": pol.get('title', 'Untitled Policy'),
                "policy_snippet": (pol.get('content', '')[:2000]).strip() or "No content recorded.",
                "control_id": ctrl.get('id', ''),
                "control_code": ctrl.get('code', 'CTL'),
                "control_title": ctrl.get('title', ''),
                "control_category": cat,
                "jev_verdict": None,
                "jev_confidence": None,
                "jev_score": None,
                "jev_decided_by": None,
                "jev_summary": None,
                "human_verdict": None,
                "graded_at": None
            })

    return sampled_pairs


def compute_pilot_metrics(pairs: list[dict]) -> dict:
    """Computes overall agreement, high-confidence agreement, confusion matrix, token costs, and gate decision."""
    total_pairs = len(pairs)
    graded_pairs = [p for p in pairs if p.get('human_verdict')]
    total_graded = len(graded_pairs)

    agreed_count = 0
    high_conf_pairs = []
    high_conf_agreed = 0

    # Initialize 4x4 confusion matrix: [human][jev]
    confusion_matrix: dict[str, dict[str, int]] = {h: {j: 0 for j in LABELS} for h in LABELS}

    total_input_chars = 0

    for p in pairs:
        snippet = p.get('policy_snippet') or ''
        total_input_chars += len(snippet)

    for p in graded_pairs:
        h_norm = normalize_verdict(p.get('human_verdict'))
        j_norm = normalize_verdict(p.get('jev_verdict'))

        confusion_matrix[h_norm][j_norm] += 1

        is_agreed = (h_norm == j_norm)
        if is_agreed:
            agreed_count += 1

        # Check confidence (use jev_confidence or jev_score)
        conf = p.get('jev_confidence')
        if conf is None:
            conf = p.get('jev_score') or 0.0

        if conf >= HIGH_CONFIDENCE_THRESHOLD:
            high_conf_pairs.append(p)
            if is_agreed:
                high_conf_agreed += 1

    overall_agreement_pct = round((agreed_count / total_graded * 100), 1) if total_graded > 0 else 0.0
    high_conf_total = len(high_conf_pairs)
    high_conf_agreement_pct = round((high_conf_agreed / high_conf_total * 100), 1) if high_conf_total > 0 else 0.0

    # Token cost calculation: ~4 chars per token
    estimated_input_tokens = total_input_chars // 4
    cost_usd = round((estimated_input_tokens / 1_000_000) * COST_PER_MILLION_INPUT_TOKENS, 6)

    # Gate Decision Logic
    is_complete = (total_graded == total_pairs and total_pairs > 0)
    passed_overall = (overall_agreement_pct >= GATE_MIN_OVERALL_AGREEMENT)
    passed_high_conf = (high_conf_agreement_pct >= GATE_MIN_HIGH_CONF_AGREEMENT)

    reasons = []
    if not is_complete:
        gate_verdict = "INCOMPLETE"
        reasons.append(f"{total_pairs - total_graded} of {total_pairs} pairs remain ungraded.")
    elif passed_overall and passed_high_conf:
        gate_verdict = "GO"
        reasons.append(f"Passed overall agreement threshold ({overall_agreement_pct}% >= {GATE_MIN_OVERALL_AGREEMENT}%).")
        reasons.append(f"Passed high-confidence agreement threshold ({high_conf_agreement_pct}% >= {GATE_MIN_HIGH_CONF_AGREEMENT}%).")
    else:
        gate_verdict = "NO-GO"
        if not passed_overall:
            reasons.append(f"Overall agreement ({overall_agreement_pct}%) is below required {GATE_MIN_OVERALL_AGREEMENT}% threshold.")
        if not passed_high_conf:
            reasons.append(f"High-confidence agreement ({high_conf_agreement_pct}%) is below required {GATE_MIN_HIGH_CONF_AGREEMENT}% threshold.")

    return {
        "total_pairs": total_pairs,
        "total_graded": total_graded,
        "agreed_count": agreed_count,
        "overall_agreement_pct": overall_agreement_pct,
        "high_conf_total": high_conf_total,
        "high_conf_agreed": high_conf_agreed,
        "high_conf_agreement_pct": high_conf_agreement_pct,
        "confusion_matrix": confusion_matrix,
        "estimated_input_tokens": estimated_input_tokens,
        "cost_usd": cost_usd,
        "gate": {
            "verdict": gate_verdict,
            "overall_pass": passed_overall,
            "high_conf_pass": passed_high_conf,
            "reasons": reasons
        }
    }


def pilot_router(store: Store) -> APIRouter:
    router = APIRouter(prefix='/api/pilot', tags=['pilot'])

    @router.get('/list')
    def list_pilots():
        """Lists all existing validation pilots."""
        with store.transaction() as db:
            rows = db.execute('SELECT id, name, status, created_at, sample_size, revealed_at FROM pilots ORDER BY created_at DESC').fetchall()
            return {
                "items": [
                    {
                        "id": r[0],
                        "name": r[1],
                        "status": r[2],
                        "created_at": r[3],
                        "sample_size": r[4],
                        "revealed_at": r[5]
                    } for r in rows
                ]
            }

    @router.post('/create')
    def create_pilot(payload: dict):
        """Creates a new blind pilot with stratified policy x control sample pairs."""
        policy_ids = payload.get('policy_ids') or []
        sample_size = int(payload.get('sample_size') or 36)
        seed = payload.get('seed')
        name = payload.get('name') or f"tofrom Blind Pilot {datetime.now().strftime('%Y-%m-%d %H:%M')}"

        with store.transaction() as db:
            all_policies = Store.records(db, 'policies')
            all_controls = Store.records(db, 'controls')

            if policy_ids:
                selected_policies = [p for p in all_policies if p.get('id') in policy_ids]
            else:
                selected_policies = all_policies

            if not selected_policies:
                raise HTTPException(400, "No policies found in workspace to generate pilot sample.")
            if not all_controls:
                raise HTTPException(400, "No controls found in workspace to generate pilot sample.")

            pairs = sample_stratified_pairs(selected_policies, all_controls, sample_size=sample_size, seed=seed)
            if not pairs:
                raise HTTPException(400, "Unable to generate stratified pairs from selected scope.")

            pilot_id = f"pilot-{uuid4().hex[:8]}"
            created_at = now()

            db.execute(
                'INSERT INTO pilots (id, name, status, created_at, policy_ids, sample_size, seed, revealed_at, results) VALUES (?,?,?,?,?,?,?,?,?)',
                (pilot_id, name, 'pending', created_at, json.dumps(policy_ids), len(pairs), seed, None, None)
            )

            for p in pairs:
                db.execute(
                    '''INSERT INTO pilot_pairs (
                        id, pilot_id, policy_id, policy_title, policy_snippet,
                        control_id, control_code, control_title, control_category,
                        jev_verdict, jev_confidence, jev_score, jev_decided_by, jev_summary,
                        human_verdict, graded_at
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                    (
                        p['id'], pilot_id, p['policy_id'], p['policy_title'], p['policy_snippet'],
                        p['control_id'], p['control_code'], p['control_title'], p['control_category'],
                        None, None, None, None, None, None, None
                    )
                )

            log(db, 'pilot_created', 'pilots', {'pilot_id': pilot_id, 'sample_size': len(pairs)})

            return {
                "id": pilot_id,
                "name": name,
                "status": "pending",
                "sample_size": len(pairs),
                "created_at": created_at
            }

    @router.post('/{pilot_id}/run')
    def run_pilot_evaluations(pilot_id: str):
        """Runs Jev evaluation on all pairs in the pilot. Sets status to awaiting_grades."""
        with store.transaction() as db:
            pilot_row = db.execute('SELECT id, status FROM pilots WHERE id=?', (pilot_id,)).fetchone()
            if not pilot_row:
                raise HTTPException(404, f"Pilot {pilot_id} not found.")

            status = pilot_row[1]
            if status == 'revealed':
                raise HTTPException(400, "Cannot re-evaluate a pilot that has already been revealed.")

            ws = store.workspace(db)
            api_key = str(ws.get('jev_api_key') or '')
            raw_endpoint = ws.get('jev_endpoint')
            endpoint = str(raw_endpoint) if raw_endpoint else None

            pair_rows = db.execute(
                '''SELECT id, policy_snippet, control_id, control_code, control_title, control_category
                   FROM pilot_pairs WHERE pilot_id=?''',
                (pilot_id,)
            ).fetchall()

            for pr in pair_rows:
                pair_id = pr[0]
                snippet = pr[1]
                ctrl = {
                    "id": pr[2],
                    "code": pr[3],
                    "title": pr[4],
                    "category": pr[5]
                }

                # Evaluate single pair
                eval_res = evaluate_policy_against_controls(snippet, [ctrl], api_key=api_key, endpoint=endpoint)
                res_item = eval_res['results'][0] if eval_res.get('results') else {}

                verdict = res_item.get('verdict', 'not_applicable')
                confidence = res_item.get('confidence')
                score = res_item.get('score', 0.0)
                decided_by = res_item.get('decided_by', 'rubric-fallback')
                summary = res_item.get('summary', '')

                db.execute(
                    '''UPDATE pilot_pairs SET
                        jev_verdict=?, jev_confidence=?, jev_score=?, jev_decided_by=?, jev_summary=?
                        WHERE id=?''',
                    (verdict, confidence, score, decided_by, summary, pair_id)
                )

            db.execute("UPDATE pilots SET status='awaiting_grades' WHERE id=?", (pilot_id,))
            log(db, 'pilot_run', 'pilots', {'pilot_id': pilot_id, 'pairs_evaluated': len(pair_rows)})

            return {
                "id": pilot_id,
                "status": "awaiting_grades",
                "evaluated_pairs": len(pair_rows)
            }

    @router.get('/{pilot_id}')
    def get_pilot(pilot_id: str):
        """Returns pilot details. Jev verdicts are strictly HIDDEN unless revealed."""
        with store.transaction() as db:
            pilot_row = db.execute('SELECT id, name, status, created_at, sample_size, seed, revealed_at FROM pilots WHERE id=?', (pilot_id,)).fetchone()
            if not pilot_row:
                raise HTTPException(404, f"Pilot {pilot_id} not found.")

            status = pilot_row[2]
            is_revealed = (status == 'revealed')

            pair_rows = db.execute(
                '''SELECT id, policy_id, policy_title, policy_snippet,
                          control_id, control_code, control_title, control_category,
                          jev_verdict, jev_confidence, jev_score, jev_decided_by, jev_summary,
                          human_verdict, graded_at
                   FROM pilot_pairs WHERE pilot_id=? ORDER BY rowid''',
                (pilot_id,)
            ).fetchall()

            pairs = []
            for r in pair_rows:
                pair_dict = {
                    "id": r[0],
                    "policy_id": r[1],
                    "policy_title": r[2],
                    "policy_snippet": r[3],
                    "control_id": r[4],
                    "control_code": r[5],
                    "control_title": r[6],
                    "control_category": r[7],
                    "human_verdict": r[13],
                    "graded_at": r[14]
                }
                # Blind enforcement: hide Jev answers until revealed!
                if is_revealed:
                    pair_dict["jev_verdict"] = r[8]
                    pair_dict["jev_confidence"] = r[9]
                    pair_dict["jev_score"] = r[10]
                    pair_dict["jev_decided_by"] = r[11]
                    pair_dict["jev_summary"] = r[12]
                else:
                    pair_dict["jev_evaluated"] = bool(r[8])

                pairs.append(pair_dict)

            graded_count = sum(1 for p in pairs if p.get('human_verdict'))

            return {
                "id": pilot_row[0],
                "name": pilot_row[1],
                "status": status,
                "created_at": pilot_row[3],
                "sample_size": pilot_row[4],
                "seed": pilot_row[5],
                "revealed_at": pilot_row[6],
                "is_revealed": is_revealed,
                "graded_count": graded_count,
                "pairs": pairs
            }

    @router.post('/{pilot_id}/grade')
    def grade_pair(pilot_id: str, payload: dict):
        """Records a human grade. Rejects grading if results have already been revealed."""
        pair_id = payload.get('pair_id')
        raw_verdict = payload.get('human_verdict')

        if not pair_id:
            raise HTTPException(422, "Missing pair_id in grade payload.")
        if not raw_verdict:
            raise HTTPException(422, "Missing human_verdict in grade payload.")

        verdict = normalize_verdict(raw_verdict)

        with store.transaction() as db:
            pilot_row = db.execute('SELECT status FROM pilots WHERE id=?', (pilot_id,)).fetchone()
            if not pilot_row:
                raise HTTPException(404, f"Pilot {pilot_id} not found.")

            if pilot_row[0] == 'revealed':
                raise HTTPException(400, "Blind pilot has already been revealed. Further human grading is rejected.")

            pair_row = db.execute('SELECT id FROM pilot_pairs WHERE id=? AND pilot_id=?', (pair_id, pilot_id)).fetchone()
            if not pair_row:
                raise HTTPException(404, f"Pair {pair_id} not found in pilot {pilot_id}.")

            graded_timestamp = now()
            db.execute(
                'UPDATE pilot_pairs SET human_verdict=?, graded_at=? WHERE id=?',
                (verdict, graded_timestamp, pair_id)
            )

            # Check if all pairs are now graded
            ungraded = db.execute('SELECT COUNT(*) FROM pilot_pairs WHERE pilot_id=? AND human_verdict IS NULL', (pilot_id,)).fetchone()[0]
            if ungraded == 0:
                db.execute("UPDATE pilots SET status='ready_for_reveal' WHERE id=? AND status='awaiting_grades'", (pilot_id,))

            return {
                "status": "ok",
                "pair_id": pair_id,
                "human_verdict": verdict,
                "graded_at": graded_timestamp,
                "remaining_ungraded": ungraded
            }

    @router.get('/{pilot_id}/results')
    def get_pilot_results(pilot_id: str, reveal: bool = True):
        """Reveals both sides, computes overall agreement %, high-confidence agreement %, confusion matrix, and cost."""
        with store.transaction() as db:
            pilot_row = db.execute('SELECT id, name, status, created_at, sample_size, revealed_at FROM pilots WHERE id=?', (pilot_id,)).fetchone()
            if not pilot_row:
                raise HTTPException(404, f"Pilot {pilot_id} not found.")

            if reveal and pilot_row[2] != 'revealed':
                revealed_time = now()
                db.execute("UPDATE pilots SET status='revealed', revealed_at=? WHERE id=?", (revealed_time, pilot_id))
                log(db, 'pilot_revealed', 'pilots', {'pilot_id': pilot_id})

            pair_rows = db.execute(
                '''SELECT id, policy_title, policy_snippet,
                          control_code, control_title, control_category,
                          jev_verdict, jev_confidence, jev_score, jev_decided_by, jev_summary,
                          human_verdict, graded_at
                   FROM pilot_pairs WHERE pilot_id=? ORDER BY rowid''',
                (pilot_id,)
            ).fetchall()

            pairs = []
            for r in pair_rows:
                pairs.append({
                    "id": r[0],
                    "policy_title": r[1],
                    "policy_snippet": r[2],
                    "control_code": r[3],
                    "control_title": r[4],
                    "control_category": r[5],
                    "jev_verdict": r[6],
                    "jev_confidence": r[7],
                    "jev_score": r[8],
                    "jev_decided_by": r[9],
                    "jev_summary": r[10],
                    "human_verdict": r[11],
                    "graded_at": r[12]
                })

            metrics = compute_pilot_metrics(pairs)

            db.execute("UPDATE pilots SET results=? WHERE id=?", (json.dumps(metrics), pilot_id))

            return {
                "pilot_id": pilot_id,
                "name": pilot_row[1],
                "status": "revealed" if reveal else pilot_row[2],
                "metrics": metrics,
                "pairs": pairs
            }

    @router.get('/{pilot_id}/gate')
    def get_pilot_gate(pilot_id: str):
        """Returns the formal GO/NO-GO gate decision."""
        with store.transaction() as db:
            pilot_row = db.execute('SELECT id, status FROM pilots WHERE id=?', (pilot_id,)).fetchone()
            if not pilot_row:
                raise HTTPException(404, f"Pilot {pilot_id} not found.")

            pair_rows = db.execute(
                '''SELECT id, policy_snippet, jev_verdict, jev_confidence, jev_score, human_verdict
                   FROM pilot_pairs WHERE pilot_id=?''',
                (pilot_id,)
            ).fetchall()

            pairs = []
            for r in pair_rows:
                pairs.append({
                    "id": r[0],
                    "policy_snippet": r[1],
                    "jev_verdict": r[2],
                    "jev_confidence": r[3],
                    "jev_score": r[4],
                    "human_verdict": r[5]
                })

            metrics = compute_pilot_metrics(pairs)
            gate = metrics["gate"]

            return {
                "pilot_id": pilot_id,
                "verdict": gate["verdict"],
                "overall_agreement_pct": metrics["overall_agreement_pct"],
                "high_conf_agreement_pct": metrics["high_conf_agreement_pct"],
                "total_graded": metrics["total_graded"],
                "total_pairs": metrics["total_pairs"],
                "reasons": gate["reasons"]
            }

    return router
