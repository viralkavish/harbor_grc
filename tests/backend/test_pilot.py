import pytest
from starlette.testclient import TestClient
from server.pilot import compute_pilot_metrics, sample_stratified_pairs, normalize_verdict


def test_verdict_normalization():
    assert normalize_verdict("compatible") == "compatible"
    assert normalize_verdict("SUPPORTED") == "compatible"
    assert normalize_verdict("partial_gap") == "gap"
    assert normalize_verdict("insufficient") == "gap"
    assert normalize_verdict("contradicted") == "conflict"
    assert normalize_verdict("not_applicable") == "not_applicable"
    assert normalize_verdict(None) == "not_applicable"


def test_stratified_sampling():
    policies = [
        {"id": "pol-1", "title": "Access Policy", "content": "MFA is required."},
        {"id": "pol-2", "title": "Data Policy", "content": "Encryption at rest."}
    ]
    controls = [
        {"id": "c1", "code": "CC6.1", "title": "MFA", "category": "Logical Access"},
        {"id": "c2", "code": "CC6.2", "title": "RBAC", "category": "Logical Access"},
        {"id": "c3", "code": "CC6.6", "title": "Boundary", "category": "Network Security"},
        {"id": "c4", "code": "CC7.1", "title": "Vulnerability", "category": "Operations"}
    ]
    pairs = sample_stratified_pairs(policies, controls, sample_size=4, seed=42)
    assert len(pairs) == 4
    categories = {p['control_category'] for p in pairs}
    assert len(categories) >= 2  # Stratified across multiple categories


def test_agreement_math_and_confusion_matrix():
    pairs = [
        {"id": "1", "policy_snippet": "A" * 400, "jev_verdict": "compatible", "jev_confidence": 0.95, "human_verdict": "compatible"},
        {"id": "2", "policy_snippet": "B" * 400, "jev_verdict": "gap", "jev_confidence": 0.85, "human_verdict": "gap"},
        {"id": "3", "policy_snippet": "C" * 400, "jev_verdict": "conflict", "jev_confidence": 0.92, "human_verdict": "conflict"},
        {"id": "4", "policy_snippet": "D" * 400, "jev_verdict": "compatible", "jev_confidence": 0.91, "human_verdict": "gap"},  # Disagree
    ]
    metrics = compute_pilot_metrics(pairs)
    assert metrics["total_pairs"] == 4
    assert metrics["total_graded"] == 4
    assert metrics["agreed_count"] == 3
    assert metrics["overall_agreement_pct"] == 75.0

    # High confidence (all 4 are >= 0.80): 3 of 4 agreed -> 75.0%
    assert metrics["high_conf_total"] == 4
    assert metrics["high_conf_agreed"] == 3
    assert metrics["high_conf_agreement_pct"] == 75.0

    # Confusion matrix checks: [human][jev]
    # Pair 4: human='gap', jev='compatible'
    assert metrics["confusion_matrix"]["gap"]["compatible"] == 1
    assert metrics["confusion_matrix"]["compatible"]["compatible"] == 1
    assert metrics["confusion_matrix"]["conflict"]["conflict"] == 1

    # Token cost check: 1600 chars // 4 = 400 tokens -> (400 / 1_000_000) * 0.042
    assert metrics["estimated_input_tokens"] == 400
    assert metrics["cost_usd"] > 0

    # Gate: 75% is below 90% -> NO-GO
    assert metrics["gate"]["verdict"] == "NO-GO"


def test_gate_decision_thresholds():
    # Case 1: 10 pairs, 10 match, high conf >= 0.80 -> GO (100% >= 90%, 100% >= 95%)
    perfect_pairs = [
        {"id": str(i), "policy_snippet": "X" * 100, "jev_verdict": "compatible", "jev_confidence": 0.95, "human_verdict": "compatible"}
        for i in range(10)
    ]
    res1 = compute_pilot_metrics(perfect_pairs)
    assert res1["gate"]["verdict"] == "GO"
    assert res1["gate"]["overall_pass"] is True
    assert res1["gate"]["high_conf_pass"] is True

    # Case 2: Incomplete
    incomplete_pairs = [
        {"id": "1", "policy_snippet": "X" * 100, "jev_verdict": "compatible", "jev_confidence": 0.95, "human_verdict": None}
    ]
    res2 = compute_pilot_metrics(incomplete_pairs)
    assert res2["gate"]["verdict"] == "INCOMPLETE"

    # Case 3: High overall, but failing high-confidence threshold
    # 20 pairs total:
    # 18 match overall -> 90% (passes overall >= 90%)
    # Among 10 high-conf: 9 match -> 90% (< 95% threshold)
    tricky_pairs = []
    # 9 high conf agreed
    for i in range(9):
        tricky_pairs.append({"id": f"hc_a_{i}", "policy_snippet": "x", "jev_verdict": "compatible", "jev_confidence": 0.95, "human_verdict": "compatible"})
    # 1 high conf disagreed
    tricky_pairs.append({"id": "hc_d", "policy_snippet": "x", "jev_verdict": "compatible", "jev_confidence": 0.95, "human_verdict": "conflict"})
    # 9 low conf agreed (conf=0.70)
    for i in range(9):
        tricky_pairs.append({"id": f"lc_a_{i}", "policy_snippet": "x", "jev_verdict": "gap", "jev_confidence": 0.70, "human_verdict": "gap"})
    # 1 low conf disagreed (conf=0.70)
    tricky_pairs.append({"id": "lc_d", "policy_snippet": "x", "jev_verdict": "gap", "jev_confidence": 0.70, "human_verdict": "compatible"})

    res3 = compute_pilot_metrics(tricky_pairs)
    assert res3["overall_agreement_pct"] == 90.0  # 18/20 = 90%
    assert res3["high_conf_agreement_pct"] == 90.0  # 9/10 = 90% (< 95%)
    assert res3["gate"]["verdict"] == "NO-GO"
    assert any("High-confidence agreement" in r for r in res3["gate"]["reasons"])


def test_full_pilot_api_lifecycle(client: TestClient):
    """End-to-end API lifecycle: create -> run -> blind grade -> reveal -> results & gate -> reject late grade."""
    # 1. Create pilot
    create_res = client.post('/api/pilot/create', json={'sample_size': 6, 'seed': 123})
    assert create_res.status_code == 200
    pilot = create_res.json()
    pilot_id = pilot['id']
    assert pilot['status'] == 'pending'
    assert pilot['sample_size'] == 6

    # 2. Check blind details before run
    get_res = client.get(f'/api/pilot/{pilot_id}')
    assert get_res.status_code == 200
    pairs = get_res.json()['pairs']
    assert len(pairs) == 6
    # Jev verdict must NOT be visible to client
    assert 'jev_verdict' not in pairs[0]

    # 3. Run pilot evaluations
    run_res = client.post(f'/api/pilot/{pilot_id}/run')
    assert run_res.status_code == 200
    assert run_res.json()['status'] == 'awaiting_grades'

    # Check that Jev verdicts are STILL hidden while awaiting grades
    get_after_run = client.get(f'/api/pilot/{pilot_id}')
    assert 'jev_verdict' not in get_after_run.json()['pairs'][0]
    assert get_after_run.json()['pairs'][0]['jev_evaluated'] is True

    # 4. Grade pairs blindly
    for p in pairs:
        grade_res = client.post(f'/api/pilot/{pilot_id}/grade', json={
            'pair_id': p['id'],
            'human_verdict': 'compatible'
        })
        assert grade_res.status_code == 200

    # 5. Check gate before reveal
    gate_res = client.get(f'/api/pilot/{pilot_id}/gate')
    assert gate_res.status_code == 200
    assert 'verdict' in gate_res.json()

    # 6. Reveal results
    results_res = client.get(f'/api/pilot/{pilot_id}/results')
    assert results_res.status_code == 200
    results_data = results_res.json()
    assert results_data['status'] == 'revealed'
    assert 'metrics' in results_data
    assert 'confusion_matrix' in results_data['metrics']
    assert 'jev_verdict' in results_data['pairs'][0]  # Now revealed!

    # 7. Blind enforcement: further grading MUST be rejected after reveal
    late_grade = client.post(f'/api/pilot/{pilot_id}/grade', json={
        'pair_id': pairs[0]['id'],
        'human_verdict': 'gap'
    })
    assert late_grade.status_code == 400
    assert "already been revealed" in late_grade.json()['detail']
