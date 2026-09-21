"""Local automated record checks and findings generator.

Clearly labeled: Local record checks — no connected cloud telemetry.
Evaluates completeness, currency, and consistency across local records.
"""
from datetime import date
import json
from uuid import uuid4
from fastapi import APIRouter
from .storage import Store, now
from .records import log


CHECK_DEFINITIONS = [
    {
        "id": "unassigned_controls",
        "title": "Controls without assigned owners",
        "description": "Ensures every applicable compliance control has a designated owner accountable for its operating effectiveness."
    },
    {
        "id": "expired_evidence",
        "title": "Expired compliance evidence",
        "description": "Verifies that all collected evidence attachments and attestations remain within their valid period."
    },
    {
        "id": "overdue_policy_reviews",
        "title": "Overdue policy reviews",
        "description": "Flags policies that have exceeded their scheduled annual or periodic review date."
    },
    {
        "id": "overdue_vendor_reviews",
        "title": "Overdue vendor security reviews",
        "description": "Identifies third-party vendors whose risk assessment or contract renewal date has passed."
    },
    {
        "id": "overdue_tasks",
        "title": "Overdue remediation tasks",
        "description": "Monitors open action items and compliance remediation tasks that have missed their due date."
    },
    {
        "id": "unencrypted_assets",
        "title": "Unencrypted company assets",
        "description": "Surfaces hardware and data stores explicitly recorded as unencrypted. Unassessed records remain neutral."
    },
    {
        "id": "open_access_reviews",
        "title": "Incomplete user access reviews",
        "description": "Checks access review campaigns for accounts or entitlements still pending an explicit keep or revoke decision."
    }
]


def evaluate_checks(db):
    today = date.today().isoformat()
    checks = []

    # 1. Unassigned controls
    controls = Store.records(db, 'controls')
    findings_1 = []
    for c in controls:
        if c.get('status') != 'not_applicable' and not c.get('owner', '').strip():
            findings_1.append({
                'resource': 'controls',
                'id': c['id'],
                'title': f"{c.get('code', '')} {c['title']}".strip(),
                'reason': 'No owner assigned to control'
            })
    checks.append({
        **CHECK_DEFINITIONS[0],
        'status': 'fail' if findings_1 else 'pass',
        'finding_count': len(findings_1),
        'findings': findings_1
    })

    # 2. Expired evidence
    evidence = Store.records(db, 'evidence')
    findings_2 = []
    for e in evidence:
        if e.get('status') == 'expired' or (e.get('expires_date') and e['expires_date'] < today):
            findings_2.append({
                'resource': 'evidence',
                'id': e['id'],
                'title': e['title'],
                'reason': f"Evidence expired on {e.get('expires_date') or 'prior date'}"
            })
    checks.append({
        **CHECK_DEFINITIONS[1],
        'status': 'fail' if findings_2 else 'pass',
        'finding_count': len(findings_2),
        'findings': findings_2
    })

    # 3. Overdue policy reviews
    policies = Store.records(db, 'policies')
    findings_3 = []
    for p in policies:
        if p.get('review_date') and p['review_date'] < today:
            findings_3.append({
                'resource': 'policies',
                'id': p['id'],
                'title': p['title'],
                'reason': f"Review was due on {p['review_date']}"
            })
    checks.append({
        **CHECK_DEFINITIONS[2],
        'status': 'fail' if findings_3 else 'pass',
        'finding_count': len(findings_3),
        'findings': findings_3
    })

    # 4. Overdue vendor reviews
    vendors = Store.records(db, 'vendors')
    findings_4 = []
    for v in vendors:
        reasons = []
        if v.get('review_date') and v['review_date'] < today:
            reasons.append(f"Security review overdue ({v['review_date']})")
        if v.get('renewal_date') and v['renewal_date'] < today:
            reasons.append(f"Contract renewal overdue ({v['renewal_date']})")
        if reasons:
            findings_4.append({
                'resource': 'vendors',
                'id': v['id'],
                'title': v['title'],
                'reason': '; '.join(reasons)
            })
    checks.append({
        **CHECK_DEFINITIONS[3],
        'status': 'fail' if findings_4 else 'pass',
        'finding_count': len(findings_4),
        'findings': findings_4
    })

    # 5. Overdue tasks
    tasks = Store.records(db, 'tasks')
    findings_5 = []
    for t in tasks:
        if t.get('due_date') and t['due_date'] < today and t.get('status') != 'done':
            findings_5.append({
                'resource': 'tasks',
                'id': t['id'],
                'title': t['title'],
                'reason': f"Task was due on {t['due_date']}"
            })
    checks.append({
        **CHECK_DEFINITIONS[4],
        'status': 'fail' if findings_5 else 'pass',
        'finding_count': len(findings_5),
        'findings': findings_5
    })

    # 6. Unencrypted assets
    assets = Store.records(db, 'assets')
    findings_6 = []
    for a in assets:
        if a.get('encrypted') is False:
            findings_6.append({
                'resource': 'assets',
                'id': a['id'],
                'title': a['title'],
                'reason': 'Asset explicitly recorded as unencrypted'
            })
    checks.append({
        **CHECK_DEFINITIONS[5],
        'status': 'fail' if findings_6 else 'pass',
        'finding_count': len(findings_6),
        'findings': findings_6
    })

    # 7. Open access review decisions
    reviews = Store.records(db, 'access_reviews')
    findings_7 = []
    for ar in reviews:
        if ar.get('status') != 'completed':
            pending_count = sum(1 for e in ar.get('entries', []) if e.get('decision') == 'pending')
            if pending_count > 0:
                findings_7.append({
                    'resource': 'access_reviews',
                    'id': ar['id'],
                    'title': ar['title'],
                    'reason': f"{pending_count} access decision(s) still pending"
                })
    checks.append({
        **CHECK_DEFINITIONS[6],
        'status': 'fail' if findings_7 else 'pass',
        'finding_count': len(findings_7),
        'findings': findings_7
    })

    return checks


def monitoring_router(store):
    router = APIRouter(prefix='/api/monitoring')

    @router.get('')
    @router.get('/checks')
    def get_monitoring():
        with store.transaction() as db:
            last_run_row = db.execute(
                "SELECT value FROM settings WHERE key='last_monitoring_run'"
            ).fetchone()
            if last_run_row:
                data = json.loads(last_run_row[0])
                return data

            # First run: evaluate fresh
            checks = evaluate_checks(db)
            res = {
                'checks': checks,
                'last_run': None,
                'disclaimer': 'Local record checks — no connected cloud telemetry'
            }
            return res

    @router.post('/run')
    def run_monitoring():
        run_time = now()
        with store.transaction() as db:
            checks = evaluate_checks(db)
            for c in checks:
                c['last_run'] = run_time

            result = {
                'checks': checks,
                'last_run': run_time,
                'disclaimer': 'Local record checks — no connected cloud telemetry'
            }
            db.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_monitoring_run', ?)",
                (json.dumps(result),)
            )
            total_findings = sum(c['finding_count'] for c in checks)
            log(db, 'monitoring_run', 'monitoring', {'title': 'Executed local record checks'}, {'total_findings': total_findings})
            return result

    return router
