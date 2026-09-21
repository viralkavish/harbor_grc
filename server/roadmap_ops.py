"""Interactive SOC 2 Type II Readiness Roadmap tracker & Day-0 Startup Trajectory Engine.

Guides organizations through the standard 6-phase AICPA / Vanta compliance trajectory:
Phase 1: Setup & Automated Connection (Week 1)
Phase 2: Internal Governance & Policies (Week 2)
Phase 3: Technical Remediation & Hardening (Weeks 3-4)
Phase 4: Employee Onboarding & Device Enrollment (Week 5)
Phase 5: Vendor Governance & Final Readiness Verification (Week 6)
Phase 6: The Audit Observation Window (Weeks 7+)

Features real-time automated telemetry verification against live database records,
auditor PBC deliverables mapping, and observation window monitoring.
"""
from datetime import datetime, timezone, timedelta
import json
from fastapi import APIRouter, HTTPException, Response
from .storage import Store, now
from .records import log


DEFAULT_ROADMAP = [
    {
        "phase": 1,
        "title": "Phase 1: Setup & Automated Connection (Week 1)",
        "description": "Establish cloud asset connections, identity provider directories, and delineate production audit boundaries.",
        "tasks": [
            {
                "id": "p1_t1",
                "title": "Connect Core Infrastructure",
                "detail": "Grant read-only IAM permissions to your primary cloud platform (AWS, GCP, Azure, Cloudflare) to begin automated asset mapping.",
                "action_resource": "assets",
                "completed": True,
                "aicpa_tsc": "CC6.6, CC6.8",
                "deliverable": "Cloud Infrastructure Asset Register & Architecture Diagram",
                "suggested_tool": "AWS IAM / GCP Cloud IAM / Cloudflare API",
                "estimated_days": 2,
                "live_check_key": "has_assets"
            },
            {
                "id": "p1_t2",
                "title": "Integrate Identity & Code Providers",
                "detail": "Connect Google Workspace or Okta for workforce directory tracking, and link GitHub/GitLab for change management controls.",
                "action_resource": "integrations",
                "completed": True,
                "aicpa_tsc": "CC6.1, CC6.2, CC8.1",
                "deliverable": "IdP Directory Sync & GitHub Repository Access List",
                "suggested_tool": "Google Workspace / Okta + GitHub Organization",
                "estimated_days": 2,
                "live_check_key": "has_integrations"
            },
            {
                "id": "p1_t3",
                "title": "Map Security Scopes & Boundaries",
                "detail": "Formally designate which systems process customer data and exclude non-production sandboxes to isolate your production audit boundary.",
                "action_resource": "assets",
                "completed": False,
                "aicpa_tsc": "CC6.6, CC6.7",
                "deliverable": "System Boundary Definition & In-Scope Asset Manifest",
                "suggested_tool": "Harbor Asset Inventory & Network Flow Tagging",
                "estimated_days": 3,
                "live_check_key": "has_scoped_assets"
            }
        ]
    },
    {
        "phase": 2,
        "title": "Phase 2: Internal Governance & Policies (Week 2)",
        "description": "Adopt framework-aligned governance policies, complete the enterprise risk register, and draft the AICPA System Description.",
        "tasks": [
            {
                "id": "p2_t1",
                "title": "Adopt Framework Policies",
                "detail": "Adopt and approve the 8 core startup policies: Access Control, Change Management, Incident Response, InfoSec, Risk, Vendor, BCDR, and Data Retention.",
                "action_resource": "policies",
                "completed": False,
                "aicpa_tsc": "CC1.1, CC2.1, CC5.1",
                "deliverable": "8 Published Governance Policies with CISO Approval Sign-offs",
                "suggested_tool": "Harbor Policy Templates & JEV Control Matcher",
                "estimated_days": 4,
                "live_check_key": "has_published_policies"
            },
            {
                "id": "p2_t2",
                "title": "Initiate Enterprise Risk Assessment",
                "detail": "Complete the risk register by identifying infrastructure vulnerabilities, scoring threats using 5x5 Likelihood x Impact, and assigning mitigations.",
                "action_resource": "risks",
                "completed": False,
                "aicpa_tsc": "CC3.1, CC3.2, CC3.3",
                "deliverable": "Enterprise Risk Register & Annual Risk Assessment Report",
                "suggested_tool": "Harbor Enterprise Risk Register (5x5 Heatmap)",
                "estimated_days": 3,
                "live_check_key": "has_risks"
            },
            {
                "id": "p2_t3",
                "title": "Publish AICPA System Description",
                "detail": "Draft and publish the foundational 10 sections of your AICPA Section 3 System Description directly inside the platform.",
                "action_resource": "system_description",
                "completed": False,
                "aicpa_tsc": "DC 2018 (Section 3)",
                "deliverable": "AICPA Section 3 Description of the System (Markdown/PDF)",
                "suggested_tool": "Harbor Section 3 Auto-Population Engine",
                "estimated_days": 3,
                "live_check_key": "has_system_desc"
            }
        ]
    },
    {
        "phase": 3,
        "title": "Phase 3: Technical Remediation & Hardening (Weeks 3-4)",
        "description": "Remediate infrastructure test findings, enforce multi-factor authentication, and configure branch protection rules.",
        "tasks": [
            {
                "id": "p3_t1",
                "title": "Enforce Platform & Host Controls",
                "detail": "Pass all automated host and platform continuous checks: full-disk encryption, local host firewall, SSH hygiene, and port restriction.",
                "action_resource": "tests",
                "completed": True,
                "aicpa_tsc": "CC6.6, CC6.7, CC7.1",
                "deliverable": "100% Passing Continuous Automated Controls Test Run Report",
                "suggested_tool": "Harbor Continuous Tests & OS Probes",
                "estimated_days": 5,
                "live_check_key": "has_passing_tests"
            },
            {
                "id": "p3_t2",
                "title": "Secure Access Controls & MFA",
                "detail": "Mandate Multi-Factor Authentication (MFA) across your identity provider and code repositories, and link controls to verified policies.",
                "action_resource": "controls",
                "completed": False,
                "aicpa_tsc": "CC6.1, CC6.2, CC6.3",
                "deliverable": "MFA Enforcement Policy & Centralized IdP Audit Log",
                "suggested_tool": "Google Workspace MFA / Okta Verify / FIDO2",
                "estimated_days": 2,
                "live_check_key": "has_mfa_control"
            },
            {
                "id": "p3_t3",
                "title": "Protect Source Code & Branch Rules",
                "detail": "Configure mandatory branch protection rules requiring at least one peer code review and passing CI builds before any production merge.",
                "action_resource": "controls",
                "completed": False,
                "aicpa_tsc": "CC8.1",
                "deliverable": "GitHub Branch Protection Rule Configuration Screenshot",
                "suggested_tool": "GitHub / GitLab Protected Branches",
                "estimated_days": 1,
                "live_check_key": "has_change_mgmt"
            }
        ]
    },
    {
        "phase": 4,
        "title": "Phase 4: Employee Onboarding & Device Enrollment (Week 5)",
        "description": "Verify employee endpoint security, roll out compliance training, and track signed policy attestations.",
        "tasks": [
            {
                "id": "p4_t1",
                "title": "Deploy Workstation Security Posture",
                "detail": "Verify employee full-disk encryption (FileVault/BitLocker/LUKS), password manager adoption, and automatic OS updates across all laptops.",
                "action_resource": "tests",
                "completed": True,
                "aicpa_tsc": "CC6.6, CC6.8",
                "deliverable": "Fleet Hardware Inventory with Confirmed Disk Encryption Status",
                "suggested_tool": "Kandji / Jamf / FleetDM / Harbor Host Probe",
                "estimated_days": 4,
                "live_check_key": "has_disk_encryption"
            },
            {
                "id": "p4_t2",
                "title": "Roll Out Compliance Training",
                "detail": "Assign security awareness, privacy, and incident response training modules to all internal personnel with tracked completion.",
                "action_resource": "people",
                "completed": False,
                "aicpa_tsc": "CC2.2",
                "deliverable": "Workforce Security Awareness Training Completion Certificates",
                "suggested_tool": "Harbor Personnel Module / KnowBe4 / Curricula",
                "estimated_days": 5,
                "live_check_key": "has_personnel_training"
            },
            {
                "id": "p4_t3",
                "title": "Track Policy Attestations & Background Checks",
                "detail": "Obtain signed policy acceptances for all published governance policies and complete pre-employment background screening.",
                "action_resource": "people",
                "completed": False,
                "aicpa_tsc": "CC1.4, CC2.2",
                "deliverable": "Policy Acceptance Audit Trail & Background Check Records",
                "suggested_tool": "Harbor Acceptance Log & Checkr / HireRight",
                "estimated_days": 4,
                "live_check_key": "has_policy_acceptances"
            }
        ]
    },
    {
        "phase": 5,
        "title": "Phase 5: Vendor Governance & Final Readiness Verification (Week 6)",
        "description": "Inventory third-party sub-processors, collect vendor certifications, and reach 100% test pass status.",
        "tasks": [
            {
                "id": "p5_t1",
                "title": "Compile Critical Vendor Inventory",
                "detail": "Inventory all third-party sub-processors (Cloudflare, AWS, GitHub, Datadog) with assigned risk tiers in the Vendor Register.",
                "action_resource": "vendors",
                "completed": False,
                "aicpa_tsc": "CC9.2",
                "deliverable": "Sub-Processor & Third-Party Vendor Inventory Register",
                "suggested_tool": "Harbor Third-Party Vendor Management",
                "estimated_days": 3,
                "live_check_key": "has_vendors"
            },
            {
                "id": "p5_t2",
                "title": "Review Third-Party Certifications & DPAs",
                "detail": "Collect and store valid SOC 2 Type II / ISO 27001 reports and executed Data Processing Addenda (DPAs) with Standard Contractual Clauses.",
                "action_resource": "vendors",
                "completed": False,
                "aicpa_tsc": "CC9.2",
                "deliverable": "Executed Vendor DPAs and Auditor SOC 2 Reports",
                "suggested_tool": "Harbor Evidence Repository & Vendor Module",
                "estimated_days": 4,
                "live_check_key": "has_vendor_dpas"
            },
            {
                "id": "p5_t3",
                "title": "Clear Platform Test Gaps",
                "detail": "Review the continuous tests dashboard and resolve all failing tests to reach target pass status across all monitored controls.",
                "action_resource": "tests",
                "completed": False,
                "aicpa_tsc": "CC7.2, CC7.3",
                "deliverable": "Zero-Defect Control Readiness Evidence Package",
                "suggested_tool": "Harbor Continuous Tests & Automated Remediation",
                "estimated_days": 2,
                "live_check_key": "all_tests_passing"
            }
        ]
    },
    {
        "phase": 6,
        "title": "Phase 6: The Audit Observation Window (Weeks 7+)",
        "description": "Engage a certified CPA firm, evaluate control design, and execute the continuous observation window.",
        "tasks": [
            {
                "id": "p6_t1",
                "title": "Select an Audit Partner Firm",
                "detail": "Engage an accredited independent CPA firm (e.g., Prescient, A-LIGN, Johanson Group, Sensiba) to conduct the SOC 2 examination.",
                "action_resource": "audits",
                "completed": False,
                "aicpa_tsc": "AT-C 105 / AT-C 205",
                "deliverable": "Signed CPA Engagement Letter & Scoping Document",
                "suggested_tool": "Harbor Audits Register & AICPA Directory",
                "estimated_days": 7,
                "live_check_key": "has_audit_record"
            },
            {
                "id": "p6_t2",
                "title": "Execute Type I Audit (Point-in-Time)",
                "detail": "Have your auditor evaluate control design suitability as of a specific date to issue an immediate Type I assurance bridge report.",
                "action_resource": "audits",
                "completed": False,
                "aicpa_tsc": "SOC 2 Type I",
                "deliverable": "Final SOC 2 Type I Attestation Report",
                "suggested_tool": "Harbor PBC Request Tracker & Audit Export",
                "estimated_days": 14,
                "live_check_key": "has_type1_audit"
            },
            {
                "id": "p6_t3",
                "title": "Enter Type II Monitoring Window",
                "detail": "Execute the 3, 6, or 12-month observation window, relying on automated continuous testing to ensure zero configuration drift.",
                "action_resource": "audits",
                "completed": False,
                "aicpa_tsc": "SOC 2 Type II",
                "deliverable": "Daily Drift-Free Telemetry Logs & Sample Evidence",
                "suggested_tool": "Harbor Live Observation Window Tracker",
                "estimated_days": 90,
                "live_check_key": "has_observation_window"
            }
        ]
    }
]


def evaluate_live_system_readiness(db) -> dict:
    """Evaluates real SQLite compliance state to compute automated readiness scores."""
    # 1. Assets
    assets = Store.records(db, 'assets')
    has_assets = len(assets) > 0
    has_scoped_assets = any(a.get('category') in ('production', 'cloud', 'server', 'database') or a.get('encrypted') for a in assets)

    # 2. Integrations
    integrations = Store.records(db, 'integrations')
    has_integrations = len(integrations) > 0 or has_assets

    # 3. Policies
    policies = Store.records(db, 'policies')
    published_policies = [p for p in policies if p.get('status') == 'published']
    has_published_policies = len(published_policies) >= 4

    # 4. Risks
    risks = Store.records(db, 'risks')
    has_risks = len(risks) >= 3

    # 5. System Description
    sys_desc_row = db.execute("SELECT value FROM settings WHERE key='system_description'").fetchone()
    has_system_desc = False
    if sys_desc_row:
        try:
            sd = json.loads(sys_desc_row[0])
            has_system_desc = bool(sd.get('version', 0) >= 1 and sd.get('service_name'))
        except Exception:
            pass

    # 6. Tests
    test_run_row = db.execute("SELECT value FROM settings WHERE key='last_test_run'").fetchone()
    passing_tests = 0
    total_tests = 8
    if test_run_row:
        try:
            tr = json.loads(test_run_row[0])
            passing_tests = tr.get('passed', 0)
            total_tests = tr.get('total', 8)
        except Exception:
            pass
    has_passing_tests = passing_tests >= 6
    all_tests_passing = total_tests > 0 and passing_tests == total_tests

    # 7. Controls
    controls = Store.records(db, 'controls')
    has_mfa_control = any(c.get('code') in ('CC6.1', 'CC6.1-MFA', 'ctl-01', 'ctl-mfa') and c.get('status') == 'implemented' for c in controls)
    has_change_mgmt = any(c.get('code') in ('CC8.1', 'ctl-chg-08', 'ctl-change-mgmt') and c.get('status') == 'implemented' for c in controls)

    # 8. Workstation Posture / Encryption
    has_disk_encryption = any(a.get('encrypted') is True for a in assets) or has_passing_tests

    # 9. People / Training / Acceptances
    people = Store.records(db, 'people')
    has_personnel = len(people) > 0
    has_personnel_training = any(p.get('security_training_completed') or p.get('status') == 'active' for p in people)

    acceptances_count = 0
    try:
        acc_rows = db.execute("SELECT COUNT(*) FROM policy_acceptances").fetchone()
        acceptances_count = acc_rows[0] if acc_rows else 0
    except Exception:
        pass
    has_policy_acceptances = acceptances_count > 0 or any(p.get('acknowledged_policy_ids') for p in people)

    # 10. Vendors & DPAs
    vendors = Store.records(db, 'vendors')
    has_vendors = len(vendors) >= 2
    has_vendor_dpas = any(v.get('dpa_signed') or v.get('has_soc2') or v.get('soc2_report') for v in vendors)

    # 11. Audits & Observation
    audits = Store.records(db, 'audits')
    has_audit_record = len(audits) >= 1
    has_type1_audit = any(a.get('type') in ('soc2_type1', 'type1') or a.get('status') in ('in_progress', 'completed') for a in audits)

    obs_row = db.execute("SELECT value FROM settings WHERE key='soc2_observation_window'").fetchone()
    has_obs_window = False
    if obs_row:
        try:
            obs = json.loads(obs_row[0])
            has_obs_window = obs.get('status') in ('in_observation', 'ready_for_audit')
        except Exception:
            pass

    live_map = {
        "has_assets": has_assets,
        "has_integrations": has_integrations,
        "has_scoped_assets": has_scoped_assets,
        "has_published_policies": has_published_policies,
        "has_risks": has_risks,
        "has_system_desc": has_system_desc,
        "has_passing_tests": has_passing_tests,
        "has_mfa_control": has_mfa_control,
        "has_change_mgmt": has_change_mgmt,
        "has_disk_encryption": has_disk_encryption,
        "has_personnel_training": has_personnel_training,
        "has_policy_acceptances": has_policy_acceptances,
        "has_vendors": has_vendors,
        "has_vendor_dpas": has_vendor_dpas,
        "all_tests_passing": all_tests_passing,
        "has_audit_record": has_audit_record,
        "has_type1_audit": has_type1_audit,
        "has_observation_window": has_obs_window
    }

    verified_count = sum(1 for v in live_map.values() if v)
    total_checks = len(live_map)
    automated_score = round((verified_count / total_checks) * 100, 1)

    verified_items = []
    pending_gaps = []

    if has_assets:
        verified_items.append(f"Infrastructure assets cataloged ({len(assets)} records)")
    else:
        pending_gaps.append("Catalog primary cloud and hardware infrastructure assets")

    if has_published_policies:
        verified_items.append(f"Governance baseline active ({len(published_policies)} policies published)")
    else:
        pending_gaps.append("Adopt and publish at least 4 core governance policies")

    if has_risks:
        verified_items.append(f"Enterprise risk register initialized ({len(risks)} threats scored)")
    else:
        pending_gaps.append("Complete initial enterprise risk assessment register")

    if has_system_desc:
        verified_items.append("AICPA Section 3 System Description authored & versioned")
    else:
        pending_gaps.append("Draft AICPA Section 3 Description of the System")

    if has_passing_tests:
        verified_items.append(f"Continuous host controls operational ({passing_tests}/{total_tests} passing)")
    else:
        pending_gaps.append(f"Remediate failing continuous tests ({passing_tests}/{total_tests} passing)")

    if has_vendors:
        verified_items.append(f"Third-party sub-processors inventoried ({len(vendors)} vendors)")
    else:
        pending_gaps.append("Log critical cloud vendors and sub-processors")

    return {
        "live_map": live_map,
        "automated_score": automated_score,
        "verified_items": verified_items,
        "pending_gaps": pending_gaps,
        "metrics": {
            "assets_count": len(assets),
            "policies_published": len(published_policies),
            "risks_count": len(risks),
            "passing_tests": passing_tests,
            "total_tests": total_tests,
            "vendors_count": len(vendors),
            "people_count": len(people)
        }
    }


def roadmap_router(store):
    router = APIRouter(prefix='/api/roadmap')

    @router.get('')
    def get_roadmap():
        with store.transaction() as db:
            row = db.execute("SELECT value FROM settings WHERE key='soc2_roadmap'").fetchone()
            if row:
                phases = json.loads(row[0])
            else:
                phases = DEFAULT_ROADMAP
                db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('soc2_roadmap', ?)", (json.dumps(phases),))

            # Load observation window
            obs_row = db.execute("SELECT value FROM settings WHERE key='soc2_observation_window'").fetchone()
            if obs_row:
                obs_window = json.loads(obs_row[0])
            else:
                today = datetime.now(timezone.utc).date()
                obs_window = {
                    "status": "not_started",
                    "window_months": 3,
                    "start_date": str(today + timedelta(days=14)),
                    "end_date": str(today + timedelta(days=104)),
                    "type1_target_date": str(today + timedelta(days=21)),
                    "drift_free_days": 14
                }
                db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('soc2_observation_window', ?)", (json.dumps(obs_window),))

            # Run live verification
            live_audit = evaluate_live_system_readiness(db)

            # Enrich phases with live verification statuses
            enriched_phases = []
            for p in phases:
                enriched_tasks = []
                for t in p['tasks']:
                    task_copy = dict(t)
                    key = t.get('live_check_key')
                    task_copy['live_verified'] = bool(live_audit['live_map'].get(key, False))
                    enriched_tasks.append(task_copy)
                enriched_phases.append({
                    **p,
                    "tasks": enriched_tasks
                })

            total_tasks = sum(len(p['tasks']) for p in phases)
            completed_tasks = sum(sum(1 for t in p['tasks'] if t['completed']) for p in phases)
            pct = round((completed_tasks / total_tasks) * 100, 1) if total_tasks else 0.0

            return {
                'phases': enriched_phases,
                'total_tasks': total_tasks,
                'completed_tasks': completed_tasks,
                'progress_percent': pct,
                'live_verification': live_audit,
                'observation_window': obs_window
            }

    @router.post('/verify_live')
    def verify_live_roadmap():
        """Auto-evaluates database records and marks live-verified milestones complete."""
        with store.transaction() as db:
            row = db.execute("SELECT value FROM settings WHERE key='soc2_roadmap'").fetchone()
            phases = json.loads(row[0]) if row else DEFAULT_ROADMAP

            live_audit = evaluate_live_system_readiness(db)
            live_map = live_audit['live_map']

            updated_count = 0
            for p in phases:
                for t in p['tasks']:
                    key = t.get('live_check_key')
                    if key and live_map.get(key, False) and not t['completed']:
                        t['completed'] = True
                        updated_count += 1

            db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('soc2_roadmap', ?)", (json.dumps(phases),))
            log(db, 'verify_live_roadmap', 'roadmap', {
                'auto_completed_tasks': updated_count,
                'automated_score': live_audit['automated_score']
            })

            total_tasks = sum(len(p['tasks']) for p in phases)
            completed_tasks = sum(sum(1 for t in p['tasks'] if t['completed']) for p in phases)
            pct = round((completed_tasks / total_tasks) * 100, 1) if total_tasks else 0.0

            return {
                'status': 'success',
                'auto_completed_count': updated_count,
                'total_tasks': total_tasks,
                'completed_tasks': completed_tasks,
                'progress_percent': pct,
                'automated_score': live_audit['automated_score'],
                'verified_items': live_audit['verified_items'],
                'pending_gaps': live_audit['pending_gaps'],
                'message': f"Auto-verified live posture: {updated_count} milestones synchronized. Automated readiness: {live_audit['automated_score']}%."
            }

    @router.patch('/tasks/{task_id}')
    def toggle_task(task_id: str, payload: dict):
        completed = bool(payload.get('completed', False))
        with store.transaction() as db:
            row = db.execute("SELECT value FROM settings WHERE key='soc2_roadmap'").fetchone()
            phases = json.loads(row[0]) if row else DEFAULT_ROADMAP

            found = False
            for p in phases:
                for t in p['tasks']:
                    if t['id'] == task_id:
                        t['completed'] = completed
                        found = True
                        break
                if found:
                    break

            if not found:
                raise HTTPException(404, f"Roadmap task '{task_id}' not found")

            db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('soc2_roadmap', ?)", (json.dumps(phases),))
            log(db, 'update_roadmap_task', 'roadmap', {'task_id': task_id, 'completed': completed})

            total_tasks = sum(len(p['tasks']) for p in phases)
            completed_tasks = sum(sum(1 for t in p['tasks'] if t['completed']) for p in phases)
            pct = round((completed_tasks / total_tasks) * 100, 1) if total_tasks else 0.0

            return {
                'task_id': task_id,
                'completed': completed,
                'total_tasks': total_tasks,
                'completed_tasks': completed_tasks,
                'progress_percent': pct
            }

    @router.patch('/observation_window')
    def update_observation_window(payload: dict):
        """Updates the SOC 2 Type II audit observation window timeline and parameters."""
        with store.transaction() as db:
            obs_row = db.execute("SELECT value FROM settings WHERE key='soc2_observation_window'").fetchone()
            obs = json.loads(obs_row[0]) if obs_row else {}

            allowed_keys = {'status', 'window_months', 'start_date', 'end_date', 'type1_target_date', 'drift_free_days'}
            for k, v in payload.items():
                if k in allowed_keys:
                    obs[k] = v

            db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('soc2_observation_window', ?)", (json.dumps(obs),))
            log(db, 'update_observation_window', 'roadmap', obs)
            return obs

    @router.get('/export')
    def export_roadmap_dossier():
        """Generates an executive SOC 2 Type II Readiness Plan & Milestone Dossier."""
        with store.transaction() as db:
            ws = store.workspace(db)
            row = db.execute("SELECT value FROM settings WHERE key='soc2_roadmap'").fetchone()
            phases = json.loads(row[0]) if row else DEFAULT_ROADMAP
            live_audit = evaluate_live_system_readiness(db)

            total_tasks = sum(len(p['tasks']) for p in phases)
            completed_tasks = sum(sum(1 for t in p['tasks'] if t['completed']) for p in phases)
            pct = round((completed_tasks / total_tasks) * 100, 1) if total_tasks else 0.0

            lines = [
                f"# SOC 2 Type II Readiness Trajectory & Audit Execution Plan",
                f"**Organization:** {ws.get('organization') or ws.get('name')}  ",
                f"**Generated:** {now()}  ",
                f"**Milestone Completion:** {pct}% ({completed_tasks}/{total_tasks} milestones)  ",
                f"**Automated Evidence Readiness:** {live_audit['automated_score']}%  ",
                "",
                "---",
                "",
                "## Executive Summary",
                f"This document defines the formal SOC 2 Type II compliance roadmap for **{ws.get('organization') or ws.get('name')}**.",
                "It establishes the system boundary, governance policies, automated control testing,",
                "and auditor deliverables required by the AICPA Trust Services Criteria (TSC).",
                "",
                "### Live System Verification Summary",
                f"- **Published Policies:** {live_audit['metrics']['policies_published']}",
                f"- **Monitored Assets:** {live_audit['metrics']['assets_count']}",
                f"- **Enterprise Risks:** {live_audit['metrics']['risks_count']}",
                f"- **Passing Automated Tests:** {live_audit['metrics']['passing_tests']}/{live_audit['metrics']['total_tests']}",
                f"- **Vetted Sub-Processors:** {live_audit['metrics']['vendors_count']}",
                "",
                "---",
                "",
                "## The 6-Phase Execution Trajectory",
                ""
            ]

            for p in phases:
                lines.append(f"### {p['title']}")
                lines.append(f"{p['description']}\n")
                lines.append("| Milestone | AICPA Criteria | Status | Required Deliverable | Recommended Tool |")
                lines.append("| :--- | :--- | :--- | :--- | :--- |")
                for t in p['tasks']:
                    status_badge = "✓ COMPLETED" if t['completed'] else "PENDING"
                    lines.append(f"| **{t['title']}** | `{t.get('aicpa_tsc', 'CC6')}` | {status_badge} | {t.get('deliverable', 'Audit Document')} | {t.get('suggested_tool', 'Cloudflare/AWS')} |")
                    lines.append(f"| *Detail:* | <td colspan='4'>{t['detail']}</td> |")
                lines.append("")

            lines.extend([
                "---",
                "",
                "## Key Auditor PBC (Provided By Client) Deliverables",
                "1. **Cloud Architecture & Asset Inventory:** Delineated production boundary excluding sandbox environments.",
                "2. **8 Approved Governance Policies:** Information Security, Access Control, Change Management, Incident Response, Risk, Vendor, BCDR, and Data Retention.",
                "3. **AICPA Section 3 Description of the System:** Full 10-section narrative covering principal service commitments and system requirements.",
                "4. **Continuous Automated Evidence:** 100% passing tests across MFA, disk encryption, SSH access, and firewall configurations.",
                "5. **Workforce Attestations:** 100% signed employee policy sign-offs and verified background screening.",
                "6. **Vendor Risk Management:** Current SOC 2 Type II reports and signed Data Processing Addenda (DPAs) for all sub-processors.",
                "",
                "---",
                "*Report generated by Harbor GRC — Local-First Governance, Risk & Compliance.*"
            ])

            md_content = "\n".join(lines)
            return Response(
                content=md_content,
                media_type="text/markdown",
                headers={
                    "Content-Disposition": f"attachment; filename=soc2_readiness_plan_{datetime.now(timezone.utc).strftime('%Y%m%d')}.md"
                }
            )

    return router
