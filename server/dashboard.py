"""Dashboard calculations and metrics aggregation.

All metrics are derived directly from SQLite state.
Readiness reflects recorded implementation only, not legal certification.
"""
from datetime import date, timedelta
from .schema import RESOURCES
from .storage import Store


def compute_dashboard(store):
    today = date.today().isoformat()
    soon = (date.today() + timedelta(days=30)).isoformat()

    with store.transaction() as db:
        # Resource counts
        counts = {name: len(Store.records(db, name)) for name in RESOURCES}

        controls = Store.records(db, 'controls')
        eligible_controls = [c for c in controls if c.get('status') != 'not_applicable']
        ctl_total = len(eligible_controls)
        ctl_impl = sum(1 for c in eligible_controls if c.get('status') == 'implemented')
        readiness = {
            'implemented': ctl_impl,
            'total': ctl_total,
            'percent': round((ctl_impl / ctl_total) * 100, 1) if ctl_total else 0.0
        }

        frameworks = Store.records(db, 'frameworks')
        framework_readiness = []
        for fw in frameworks:
            fw_ctls = [c for c in eligible_controls if fw['id'] in c.get('framework_ids', [])]
            t = len(fw_ctls)
            impl = sum(1 for c in fw_ctls if c.get('status') == 'implemented')
            pct = round((impl / t) * 100, 1) if t else 0.0
            framework_readiness.append({
                'id': fw['id'],
                'title': fw['title'],
                'code': fw.get('code', ''),
                'implemented': impl,
                'total': t,
                'percent': pct
            })

        risks = Store.records(db, 'risks')
        open_risks = sum(1 for r in risks if r.get('status') != 'closed')
        high_risks = sum(1 for r in risks if r.get('status') != 'closed' and r.get('inherent_score', 0) >= 12)

        tasks = Store.records(db, 'tasks')
        overdue_tasks = sum(1 for t in tasks if t.get('due_date') and t['due_date'] < today and t.get('status') != 'done')

        evidence = Store.records(db, 'evidence')
        expiring_evidence = sum(
            1 for e in evidence
            if e.get('expires_date') and e['expires_date'] <= soon and e.get('status') != 'expired'
        )

        upcoming_reviews = []
        policies = Store.records(db, 'policies')
        for p in policies:
            if p.get('review_date') and today <= p['review_date'] <= soon:
                upcoming_reviews.append({'resource': 'policies', 'id': p['id'], 'title': p['title'], 'date': p['review_date']})

        vendors = Store.records(db, 'vendors')
        for v in vendors:
            rev = v.get('review_date')
            if rev and today <= rev <= soon:
                upcoming_reviews.append({'resource': 'vendors', 'id': v['id'], 'title': v['title'], 'date': rev})
            ren = v.get('renewal_date')
            if ren and today <= ren <= soon:
                upcoming_reviews.append({'resource': 'vendors', 'id': v['id'], 'title': f"{v['title']} (Renewal)", 'date': ren})

        upcoming_reviews.sort(key=lambda x: x['date'])

        # Risk Matrix 5x5
        risk_matrix = []
        for likelihood in range(1, 6):
            for impact in range(1, 6):
                count = sum(1 for r in risks if r.get('likelihood') == likelihood and r.get('impact') == impact)
                risk_matrix.append({'likelihood': likelihood, 'impact': impact, 'count': count})

        # Attention items
        attention = []
        for t in tasks:
            if t.get('due_date') and t['due_date'] < today and t.get('status') != 'done':
                attention.append({
                    'resource': 'tasks',
                    'id': t['id'],
                    'title': t['title'],
                    'reason': f"Task overdue since {t['due_date']}",
                    'severity': 'high' if t.get('priority') in ('high', 'urgent') else 'medium'
                })

        for e in evidence:
            if e.get('expires_date') and e['expires_date'] < today:
                attention.append({
                    'resource': 'evidence',
                    'id': e['id'],
                    'title': e['title'],
                    'reason': f"Evidence expired on {e['expires_date']}",
                    'severity': 'high'
                })
            elif e.get('expires_date') and today <= e['expires_date'] <= soon and e.get('status') != 'expired':
                attention.append({
                    'resource': 'evidence',
                    'id': e['id'],
                    'title': e['title'],
                    'reason': f"Evidence expires on {e['expires_date']}",
                    'severity': 'medium'
                })

        for c in eligible_controls:
            if not c.get('owner'):
                attention.append({
                    'resource': 'controls',
                    'id': c['id'],
                    'title': f"{c.get('code', '')} {c['title']}".strip(),
                    'reason': "Control has no assigned owner",
                    'severity': 'low'
                })

        for r in risks:
            if r.get('status') != 'closed' and r.get('inherent_score', 0) >= 15:
                attention.append({
                    'resource': 'risks',
                    'id': r['id'],
                    'title': r['title'],
                    'reason': f"Critical risk score ({r.get('inherent_score')}) requires treatment",
                    'severity': 'high'
                })

        # Recent activity
        from .records import activity
        recent_activity = activity(db, limit=10)['items']

        return {
            'counts': counts,
            'readiness': readiness,
            'framework_readiness': framework_readiness,
            'open_risks': open_risks,
            'high_risks': high_risks,
            'overdue_tasks': overdue_tasks,
            'expiring_evidence': expiring_evidence,
            'upcoming_reviews': upcoming_reviews[:20],
            'activity': recent_activity,
            'risk_matrix': risk_matrix,
            'attention': attention[:30]
        }
