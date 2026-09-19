"""Workforce compliance, employee onboarding workflows, and policy acceptance tracking."""
from datetime import date
from uuid import uuid4
from fastapi import APIRouter, HTTPException
from .storage import Store, now
from .records import get_record, save, log


def personnel_router(store):
    router = APIRouter(prefix='/api/personnel')

    @router.get('/compliance')
    def get_personnel_compliance():
        with store.transaction() as db:
            people = Store.records(db, 'people')
            pub_policies = [p for p in Store.records(db, 'policies') if p.get('status') == 'published']
            total_policies = len(pub_policies)

            # Get acceptances
            acc_rows = db.execute("SELECT person_id, person_email, policy_id FROM policy_acceptances").fetchall()
            acc_by_person: dict[str, set[str]] = {}
            for pid, pemail, pol_id in acc_rows:
                if pid:
                    acc_by_person.setdefault(pid, set()).add(pol_id)
                if pemail:
                    acc_by_person.setdefault(pemail.lower(), set()).add(pol_id)

            today_str = date.today().isoformat()
            employee_records = []
            compliant_count = 0
            trained_count = 0

            for p in people:
                if p.get('status') not in ('active', 'onboarding'):
                    continue

                p_id = p['id']
                p_email = p.get('email', '').lower()

                # Accepted policies
                accepted_ids = set(p.get('acknowledged_policy_ids', []))
                if p_id in acc_by_person:
                    accepted_ids.update(acc_by_person[p_id])
                if p_email in acc_by_person:
                    accepted_ids.update(acc_by_person[p_email])

                # Check training
                is_trained = bool(p.get('training_completed'))
                if is_trained:
                    trained_count += 1

                # Check overall compliance
                policies_done = (len(accepted_ids) >= total_policies) if total_policies > 0 else True
                is_fully_compliant = is_trained and policies_done
                if is_fully_compliant:
                    compliant_count += 1

                employee_records.append({
                    'id': p_id,
                    'title': p['title'],
                    'email': p.get('email', ''),
                    'department': p.get('department', 'General'),
                    'role': p.get('role', 'Member'),
                    'status': p.get('status', 'active'),
                    'training_completed': is_trained,
                    'training_due': p.get('training_due'),
                    'policies_accepted': len(accepted_ids),
                    'total_policies': total_policies,
                    'is_compliant': is_fully_compliant
                })

            total_active = len(employee_records)
            return {
                'total_active': total_active,
                'compliant_count': compliant_count,
                'compliance_percent': round((compliant_count / total_active) * 100, 1) if total_active else 100.0,
                'trained_percent': round((trained_count / total_active) * 100, 1) if total_active else 100.0,
                'employees': employee_records
            }

    @router.post('/{person_id}/complete_training')
    def complete_training(person_id: str):
        with store.transaction() as db:
            person = get_record(db, 'people', person_id)
            person['training_completed'] = True
            person['updated_at'] = now()
            save(db, 'people', person)
            log(db, 'training_completed', 'people', person, {'person': person['title']})
            return person

    @router.post('/{person_id}/accept_all_policies')
    def accept_all_policies(person_id: str):
        with store.transaction() as db:
            person = get_record(db, 'people', person_id)
            pub_policies = [p for p in Store.records(db, 'policies') if p.get('status') == 'published']

            all_pub_ids = [p['id'] for p in pub_policies]
            person['acknowledged_policy_ids'] = list(dict.fromkeys(person.get('acknowledged_policy_ids', []) + all_pub_ids))
            person['updated_at'] = now()
            save(db, 'people', person)

            # Insert formal acceptance entries
            ts = now()
            for pol in pub_policies:
                db.execute(
                    """INSERT INTO policy_acceptances (id, policy_id, person_id, person_name, person_email, version, accepted_at, signature_text)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (str(uuid4()), pol['id'], person['id'], person['title'], person.get('email', ''), pol.get('version', 1), ts, person['title'])
                )

            log(db, 'policies_bulk_accepted', 'people', person, {'policies_count': len(all_pub_ids)})
            return person

    return router
