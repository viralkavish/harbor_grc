"""Interactive SOC 2 Type II Readiness Roadmap tracker.

Guides organizations through the standard 6-phase Vanta compliance trajectory:
Phase 1: Setup & Automated Connection (Week 1)
Phase 2: Internal Governance & Policies (Week 2)
Phase 3: Technical Remediation & Hardening (Weeks 3-4)
Phase 4: Employee Onboarding & Device Enrollment (Week 5)
Phase 5: Vendor Governance & Final Readiness Verification (Week 6)
Phase 6: The Audit Observation Window (Weeks 7+)
"""
import json
from fastapi import APIRouter, HTTPException
from .storage import Store, now
from .records import log


DEFAULT_ROADMAP = [
    {
        "phase": 1,
        "title": "Phase 1: Setup & Automated Connection (Week 1)",
        "description": "Establish cloud asset connections, identity provider directories, and define production audit boundaries.",
        "tasks": [
            {
                "id": "p1_t1",
                "title": "Connect Core Infrastructure",
                "detail": "Grant read-only IAM permissions to your primary cloud platform (AWS, GCP, Azure) to begin automated asset mapping.",
                "action_resource": "assets",
                "completed": True
            },
            {
                "id": "p1_t2",
                "title": "Integrate Identity & Code Providers",
                "detail": "Connect Google Workspace or Okta for employee directory tracking, and link GitHub/GitLab for change management controls.",
                "action_resource": "integrations",
                "completed": True
            },
            {
                "id": "p1_t3",
                "title": "Map Security Scopes & Boundaries",
                "detail": "Exclude any non-production environments or internal sandboxes from monitoring to isolate your production audit boundary.",
                "action_resource": "assets",
                "completed": False
            }
        ]
    },
    {
        "phase": 2,
        "title": "Phase 2: Internal Governance & Policies (Week 2)",
        "description": "Adopt framework-aligned governance policies, complete the risk register, and draft the AICPA System Description.",
        "tasks": [
            {
                "id": "p2_t1",
                "title": "Adopt Framework Policies",
                "detail": "Customize and approve pre-built template policies covering Access Control, Change Management, Incident Response, and Information Security.",
                "action_resource": "policies",
                "completed": False
            },
            {
                "id": "p2_t2",
                "title": "Initiate Enterprise Risk Assessment",
                "detail": "Complete the risk register by identifying infrastructure vulnerabilities, scoring threats, and assigning internal owners.",
                "action_resource": "risks",
                "completed": False
            },
            {
                "id": "p2_t3",
                "title": "Publish AICPA System Description",
                "detail": "Draft the foundational sections of your AICPA Section 3 System Description directly inside the platform.",
                "action_resource": "system_description",
                "completed": False
            }
        ]
    },
    {
        "phase": 3,
        "title": "Phase 3: Technical Remediation & Hardening (Weeks 3-4)",
        "description": "Address infrastructure test findings, mandate multi-factor authentication, and enforce peer code review.",
        "tasks": [
            {
                "id": "p3_t1",
                "title": "Enforce Platform & Host Controls",
                "detail": "Address failing automated tests by encrypting data storage buckets, turning on full logging, and restricting public network ports.",
                "action_resource": "tests",
                "completed": True
            },
            {
                "id": "p3_t2",
                "title": "Secure Access Controls & MFA",
                "detail": "Mandate Multi-Factor Authentication (MFA) across your identity provider and code repositories while deprovisioning inactive accounts.",
                "action_resource": "controls",
                "completed": False
            },
            {
                "id": "p3_t3",
                "title": "Protect Source Code & Branch Rules",
                "detail": "Configure mandatory branch protection rules requiring at least one peer code review before any production pull request merge.",
                "action_resource": "controls",
                "completed": False
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
                "detail": "Verify employee full-disk encryption, password manager installation, and operating system updates across workforce laptops.",
                "action_resource": "tests",
                "completed": True
            },
            {
                "id": "p4_t2",
                "title": "Roll Out Compliance Training",
                "detail": "Assign native security awareness, privacy, and HIPAA training modules to all internal staff.",
                "action_resource": "people",
                "completed": False
            },
            {
                "id": "p4_t3",
                "title": "Complete Workforce Onboarding Tasks",
                "detail": "Track team compliance as employees complete training, sign off on published policies, and submit background check verifications.",
                "action_resource": "people",
                "completed": False
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
                "detail": "Log all critical third-party sub-processors (e.g., Cloudflare, AWS, Datadog) inside the Vendor Risk Management module.",
                "action_resource": "vendors",
                "completed": False
            },
            {
                "id": "p5_t2",
                "title": "Review Third-Party Certifications & DPAs",
                "detail": "Upload and verify valid SOC 2 or ISO certificates for your core vendors to prove secure supply chain alignment.",
                "action_resource": "vendors",
                "completed": False
            },
            {
                "id": "p5_t3",
                "title": "Clear Platform Test Gaps",
                "detail": "Review the continuous tests dashboard to ensure your tracking meter sits at target pass status across all monitored controls.",
                "action_resource": "tests",
                "completed": False
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
                "detail": "Engage an accredited independent CPA firm to review your infrastructure, policies, and system description.",
                "action_resource": "audits",
                "completed": False
            },
            {
                "id": "p6_t2",
                "title": "Execute Type I Audit (Point-in-Time)",
                "detail": "Have your auditor evaluate your system's control design on a single, specific date to secure an immediate Type I report.",
                "action_resource": "audits",
                "completed": False
            },
            {
                "id": "p6_t3",
                "title": "Enter Type II Monitoring Window",
                "detail": "Launch your observation period (typically 3, 6, or 12 months), relying on continuous automated tests to prevent security drift.",
                "action_resource": "audits",
                "completed": False
            }
        ]
    }
]


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

            total_tasks = sum(len(p['tasks']) for p in phases)
            completed_tasks = sum(sum(1 for t in p['tasks'] if t['completed']) for p in phases)
            pct = round((completed_tasks / total_tasks) * 100, 1) if total_tasks else 0.0

            return {
                'phases': phases,
                'total_tasks': total_tasks,
                'completed_tasks': completed_tasks,
                'progress_percent': pct
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

    return router
