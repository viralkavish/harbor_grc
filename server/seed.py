"""Idempotent starter library seeding for frameworks, controls, and policies.

Original illustrative content clearly marked 'Starter guidance — review for your scope'.
No invented employees, vendors, evidence files, or passed tests.
Readiness starts at zero (all controls 'not_started', policies 'draft').
"""
import json
from uuid import uuid4
try:
    from .storage import now, Store
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from server.storage import now, Store

FRAMEWORKS_SEED = [
    {
        "id": "fw-soc2",
        "title": "SOC 2 Type II (Trust Services Criteria)",
        "code": "SOC2",
        "version": "2017 TSC (with 2022 revisions)",
        "source_url": "https://www.aicpa-cima.com",
        "description": "AICPA Trust Services Criteria for Security, Availability, Processing Integrity, Confidentiality, and Privacy.",
        "guidance": "Starter guidance — review for your scope. Tailor criteria categories to your customer commitments and system architecture.",
        "status": "not_started",
        "owner": "",
        "tags": ["cloud", "compliance", "saas"]
    },
    {
        "id": "fw-iso27001",
        "title": "ISO/IEC 27001:2022",
        "code": "ISO27001",
        "version": "2022 Edition",
        "source_url": "https://www.iso.org/standard/27001",
        "description": "International standard for information security management systems (ISMS).",
        "guidance": "Starter guidance — review for your scope. Focus on Clause 4-10 organizational context and Annex A control themes.",
        "status": "not_started",
        "owner": "",
        "tags": ["international", "isms"]
    },
    {
        "id": "fw-nist-csf",
        "title": "NIST Cybersecurity Framework 2.0",
        "code": "NIST-CSF-2.0",
        "version": "2.0",
        "source_url": "https://www.nist.gov/cyberframework",
        "description": "Framework for improving critical infrastructure cybersecurity across Govern, Identify, Protect, Detect, Respond, and Recover functions.",
        "guidance": "Starter guidance — review for your scope. Align governance activities with organizational risk tolerance.",
        "status": "not_started",
        "owner": "",
        "tags": ["governance", "nist"]
    },
    {
        "id": "fw-gdpr",
        "title": "EU General Data Protection Regulation",
        "code": "GDPR",
        "version": "Regulation (EU) 2016/679",
        "source_url": "https://gdpr.eu",
        "description": "European Union regulation on data protection and privacy for individuals within the EU and the EEA.",
        "guidance": "Starter guidance — review for your scope. Validate lawful basis for processing, subject rights mechanisms, and data transfer safeguards.",
        "status": "not_started",
        "owner": "",
        "tags": ["privacy", "eu", "data-protection"]
    },
    {
        "id": "fw-hipaa",
        "title": "HIPAA Security Rule",
        "code": "HIPAA",
        "version": "45 CFR Part 160 & Part 164 Subparts A and C",
        "source_url": "https://www.hhs.gov/hipaa",
        "description": "Standards for the protection of electronic protected health information (ePHI).",
        "guidance": "Starter guidance — review for your scope. Address required and addressable specifications across administrative, physical, and technical safeguards.",
        "status": "not_started",
        "owner": "",
        "tags": ["healthcare", "ephi", "us-federal"]
    }
]

POLICIES_SEED = [
    {
        "id": "pol-sec-01",
        "title": "Information Security Policy",
        "description": "Foundational security directives, governance hierarchy, and organizational security commitments.",
        "status": "draft",
        "owner": "",
        "review_date": None,
        "tags": ["governance", "foundation"],
        "content": """# Information Security Policy

**Notice: Starter guidance — review and tailor for your organization's specific scope and requirements.**

## 1. Objective and Scope
This policy establishes mandatory baseline information security principles for TwoFrom across all employees, contractors, systems, and data repositories.

## 2. Governance and Responsibilities
- **Executive Management** maintains ultimate accountability for the information security program.
- **Security Lead / CISO** oversees implementation, control monitoring, and annual policy reviews.
- **All Workforce Members** are required to complete security awareness training and report security anomalies immediately.

## 3. Acceptable Use
All organizational computing resources must be used exclusively for authorized business purposes in accordance with legal and regulatory mandates.

## 4. Compliance and Exceptions
Any deviation from this policy requires a formally approved Security Exception Record documenting compensatory controls and an expiration date.

## 5. Review Cadence
This policy must be reviewed at least annually or following major architectural changes.
"""
    },
    {
        "id": "pol-acc-02",
        "title": "Access Control Policy",
        "description": "Rules governing user authentication, role-based authorization, multi-factor authentication, and quarterly access reviews.",
        "status": "draft",
        "owner": "",
        "review_date": None,
        "tags": ["access", "authentication"],
        "content": """# Access Control Policy

**Notice: Starter guidance — review and tailor for your organization's specific scope and requirements.**

## 1. Principles of Least Privilege
Access to organizational systems and confidential data is granted strictly based on minimum business necessity and the principle of least privilege.

## 2. Authentication Requirements
- **Multi-Factor Authentication (MFA)** is mandatory for all workforce accounts accessing email, cloud infrastructure, source code, and administrative portals.
- Passwords must adhere to modern NIST SP 800-63B standards (minimum 14 characters, breach-screening).

## 3. Provisioning and De-provisioning
- User access must be approved by the designated department manager prior to provisioning.
- System access for terminated personnel must be revoked within 24 hours of separation.

## 4. Periodic Access Reviews
Access rights to critical systems, production databases, and administrative roles must be formally reviewed at least quarterly by system owners.
"""
    },
    {
        "id": "pol-inc-03",
        "title": "Incident Response Policy",
        "description": "Procedures for identifying, triaging, containing, eradicating, and reporting security incidents.",
        "status": "draft",
        "owner": "",
        "review_date": None,
        "tags": ["incident", "response"],
        "content": """# Incident Response Policy

**Notice: Starter guidance — review and tailor for your organization's specific scope and requirements.**

## 1. Purpose
To ensure a structured, rapid, and effective organizational response to actual or suspected cybersecurity incidents.

## 2. Severity Classification
- **P1 - Critical**: Confirmed compromise of production data, customer records, or widespread outage.
- **P2 - High**: Significant operational disruption or localized breach of sensitive credentials.
- **P3 - Medium**: Malicious software contained on an isolated endpoint; isolated policy violation.
- **P4 - Low**: Phishing report or minor security warning with no compromise.

## 3. Escalation and Communication
The Incident Response Team (IRT) must be mobilized within 30 minutes of a P1 incident. External regulatory and customer notifications must comply with applicable data protection laws (e.g. 72 hours for GDPR where required).

## 4. Post-Incident Review
A formal root-cause analysis (RCA) and post-mortem report must be completed within 5 business days following resolution.
"""
    },
    {
        "id": "pol-rsk-04",
        "title": "Risk Management Policy",
        "description": "Methodology for identifying, assessing, scoring, treating, and monitoring organizational cybersecurity risks.",
        "status": "draft",
        "owner": "",
        "review_date": None,
        "tags": ["risk", "assessment"],
        "content": """# Risk Management Policy

**Notice: Starter guidance — review and tailor for your organization's specific scope and requirements.**

## 1. Scope and Framework
This policy defines the standard risk assessment methodology for evaluating threats to confidentiality, integrity, and availability.

## 2. Scoring Methodology
Risks are evaluated using a 5x5 Likelihood and Impact matrix:
- **Inherent Risk Score** = Likelihood (1-5) × Impact (1-5)
- **Residual Risk Score** = Residual Likelihood (1-5) × Residual Impact (1-5) after applied control treatments.

## 3. Treatment Options
- **Mitigate**: Apply controls to reduce likelihood or impact.
- **Transfer**: Contractual safeguards or cyber insurance.
- **Avoid**: Discontinue the risky activity or decommission the system.
- **Accept**: Formal executive sign-off for residual risk within risk tolerance.

## 4. Register Maintenance
The organizational Risk Register must be reviewed and updated at least quarterly.
"""
    },
    {
        "id": "pol-vnd-05",
        "title": "Vendor Risk Management Policy",
        "description": "Due diligence, security evaluation, ongoing monitoring, and offboarding requirements for third-party providers.",
        "status": "draft",
        "owner": "",
        "review_date": None,
        "tags": ["vendor", "third-party"],
        "content": """# Vendor Risk Management Policy

**Notice: Starter guidance — review and tailor for your organization's specific scope and requirements.**

## 1. Purpose
To govern the selection, assessment, contracting, and monitoring of third-party vendors and sub-processors.

## 2. Vendor Tiering
- **Tier 1 (Critical)**: Vendors with direct access to production infrastructure or sensitive customer data.
- **Tier 2 (High)**: Core operational services without direct customer data access.
- **Tier 3 (Medium/Low)**: Ancillary business software with public or low-sensitivity data.

## 3. Assessment Requirements
Critical and High tier vendors must provide current SOC 2 Type II or ISO 27001 certifications annually, or complete an approved security assessment questionnaire.

## 4. Offboarding
Upon vendor contract termination, ensure all data deletion attestations and account revocations are verified within 30 days.
"""
    },
    {
        "id": "pol-dta-06",
        "title": "Data Handling and Retention Policy",
        "description": "Data classification guidelines, encryption baselines, retention schedules, and secure disposal requirements.",
        "status": "draft",
        "owner": "",
        "review_date": None,
        "tags": ["data", "privacy", "retention"],
        "content": """# Data Handling and Retention Policy

**Notice: Starter guidance — review and tailor for your organization's specific scope and requirements.**

## 1. Data Classification
- **Public**: Freely disclosable marketing and published materials.
- **Internal**: General business operational correspondence.
- **Confidential**: Proprietary source code, financial records, strategic roadmaps.
- **Restricted / Sensitive**: Customer personal data (PII/ePHI), credentials, encryption keys.

## 2. Encryption Baselines
All Restricted and Confidential data must be encrypted in transit (TLS 1.2+ minimum, TLS 1.3 preferred) and at rest (AES-256).

## 3. Retention and Disposal
Customer data is retained only for the duration of the commercial agreement plus statutory limitation periods, followed by cryptographically verified destruction.
"""
    },
    {
        "id": "pol-bcp-07",
        "title": "Business Continuity and Disaster Recovery Policy",
        "description": "Operational continuity planning, data backup schedules, and annual disaster recovery testing.",
        "status": "draft",
        "owner": "",
        "review_date": None,
        "tags": ["bcp", "disaster-recovery"],
        "content": """# Business Continuity and Disaster Recovery Policy

**Notice: Starter guidance — review and tailor for your organization's specific scope and requirements.**

## 1. Objectives
Ensure continuity of mission-critical operations and rapid restoration of services following catastrophic disruptions.

## 2. Recovery Objectives
- **Recovery Time Objective (RTO)**: Target maximum tolerable downtime for critical services.
- **Recovery Point Objective (RPO)**: Target maximum allowable data loss window.

## 3. Backup Cadence
Production databases must have automated daily backups stored in geographically separate regions with point-in-time recovery enabled.

## 4. Annual Testing
The Disaster Recovery plan must be simulated and tested at least annually, with results documented and audited.
"""
    },
    {
        "id": "pol-chg-08",
        "title": "Change Management Policy",
        "description": "Change authorization, peer review, automated testing, and rollback requirements for production software.",
        "status": "draft",
        "owner": "",
        "review_date": None,
        "tags": ["change", "engineering", "devops"],
        "content": """# Change Management Policy

**Notice: Starter guidance — review and tailor for your organization's specific scope and requirements.**

## 1. Purpose
Minimize production disruption and security vulnerabilities by ensuring all software and infrastructure changes are reviewed and tested.

## 2. Peer Review Requirements
All code changes intended for production branches must undergo at least one documented peer review by a qualified engineer.

## 3. Automated CI/CD Gates
Automated test suites, static analysis, and dependency security checks must pass prior to merge approval.

## 4. Rollback Readiness
Every production deployment plan must include a defined, tested rollback procedure.
"""
    }
]

CONTROLS_SEED = [
    {
        "id": "ctl-01",
        "code": "CC6.1-MFA",
        "title": "Enforce Multi-Factor Authentication",
        "category": "Access Control",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf", "fw-hipaa"],
        "frequency": "continuous",
        "implementation": "Starter guidance: Require hardware or TOTP MFA for all identity provider logins, cloud consoles, and code repositories.",
        "status": "not_started",
        "policy_ids": ["pol-acc-02"],
        "evidence_ids": []
    },
    {
        "id": "ctl-02",
        "code": "CC6.2-PROV",
        "title": "User Registration and Access Provisioning",
        "category": "Access Control",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf"],
        "frequency": "continuous",
        "implementation": "Starter guidance: Maintain documented manager approvals for all new account provisioning and role modifications.",
        "status": "not_started",
        "policy_ids": ["pol-acc-02"],
        "evidence_ids": []
    },
    {
        "id": "ctl-03",
        "code": "CC6.3-REVOKE",
        "title": "Timely Deprovisioning on Termination",
        "category": "Access Control",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf", "fw-hipaa"],
        "frequency": "continuous",
        "implementation": "Starter guidance: Automated HR termination webhook or SLA requiring account revocation within 24 hours.",
        "status": "not_started",
        "policy_ids": ["pol-acc-02"],
        "evidence_ids": []
    },
    {
        "id": "ctl-04",
        "code": "CC6.4-RECERT",
        "title": "Quarterly User Access Reviews",
        "category": "Access Control",
        "framework_ids": ["fw-soc2", "fw-iso27001"],
        "frequency": "quarterly",
        "implementation": "Starter guidance: Conduct documented quarterly reviews of administrative permissions and production access.",
        "status": "not_started",
        "policy_ids": ["pol-acc-02"],
        "evidence_ids": []
    },
    {
        "id": "ctl-05",
        "code": "CC6.6-ENC-TRANSIT",
        "title": "Encryption in Transit",
        "category": "Data Protection",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf", "fw-gdpr", "fw-hipaa"],
        "frequency": "continuous",
        "implementation": "Starter guidance: Terminate TLS 1.2+ on all public endpoints and enforce HSTS headers across web applications.",
        "status": "not_started",
        "policy_ids": ["pol-dta-06"],
        "evidence_ids": []
    },
    {
        "id": "ctl-06",
        "code": "CC6.7-ENC-REST",
        "title": "Encryption at Rest",
        "category": "Data Protection",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf", "fw-gdpr", "fw-hipaa"],
        "frequency": "continuous",
        "implementation": "Starter guidance: Enable KMS managed AES-256 encryption on all database volumes, object stores, and disks.",
        "status": "not_started",
        "policy_ids": ["pol-dta-06"],
        "evidence_ids": []
    },
    {
        "id": "ctl-07",
        "code": "CC6.8-KEY-MGT",
        "title": "Cryptographic Key Management",
        "category": "Data Protection",
        "framework_ids": ["fw-soc2", "fw-iso27001"],
        "frequency": "annual",
        "implementation": "Starter guidance: Rotate master encryption keys annually and enforce separation of duties for key custodians.",
        "status": "not_started",
        "policy_ids": ["pol-dta-06"],
        "evidence_ids": []
    },
    {
        "id": "ctl-08",
        "code": "CC7.1-VULN-SCAN",
        "title": "Vulnerability Scanning and Patching",
        "category": "Vulnerability Management",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf"],
        "frequency": "monthly",
        "implementation": "Starter guidance: Run weekly container and host vulnerability scans; patch critical CVEs within 14 days.",
        "status": "not_started",
        "policy_ids": ["pol-sec-01"],
        "evidence_ids": []
    },
    {
        "id": "ctl-09",
        "code": "CC7.2-PEN-TEST",
        "title": "Annual Third-Party Penetration Testing",
        "category": "Security Assessment",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf"],
        "frequency": "annual",
        "implementation": "Starter guidance: Contract an independent CREST/OSCP accredited firm to perform annual grey-box penetration testing.",
        "status": "not_started",
        "policy_ids": ["pol-sec-01"],
        "evidence_ids": []
    },
    {
        "id": "ctl-10",
        "code": "CC7.3-LOGGING",
        "title": "Centralized Audit Logging and Retention",
        "category": "Operations",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf", "fw-hipaa"],
        "frequency": "continuous",
        "implementation": "Starter guidance: Aggregate system, authentication, and API logs in tamper-resistant storage for at least 365 days.",
        "status": "not_started",
        "policy_ids": ["pol-sec-01"],
        "evidence_ids": []
    },
    {
        "id": "ctl-11",
        "code": "CC7.4-INCIDENT-PLAN",
        "title": "Incident Response Plan and Tabletop Exercise",
        "category": "Incident Management",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf", "fw-gdpr", "fw-hipaa"],
        "frequency": "annual",
        "implementation": "Starter guidance: Conduct an annual tabletop simulation of a ransomware or credential exposure incident.",
        "status": "not_started",
        "policy_ids": ["pol-inc-03"],
        "evidence_ids": []
    },
    {
        "id": "ctl-12",
        "code": "CC8.1-CHANGE-PR",
        "title": "Mandatory Peer Code Review",
        "category": "Change Management",
        "framework_ids": ["fw-soc2", "fw-iso27001"],
        "frequency": "continuous",
        "implementation": "Starter guidance: Configure branch protection rules requiring at least 1 approving review from a peer.",
        "status": "not_started",
        "policy_ids": ["pol-chg-08"],
        "evidence_ids": []
    },
    {
        "id": "ctl-13",
        "code": "CC8.2-CI-TESTS",
        "title": "Automated Testing in Deployment Pipeline",
        "category": "Change Management",
        "framework_ids": ["fw-soc2", "fw-iso27001"],
        "frequency": "continuous",
        "implementation": "Starter guidance: Ensure integration test suites and security linters pass before automated deployment to staging/production.",
        "status": "not_started",
        "policy_ids": ["pol-chg-08"],
        "evidence_ids": []
    },
    {
        "id": "ctl-14",
        "code": "CC9.1-VENDOR-ASSESS",
        "title": "Third-Party Vendor Risk Assessments",
        "category": "Vendor Management",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf", "fw-gdpr", "fw-hipaa"],
        "frequency": "annual",
        "implementation": "Starter guidance: Review SOC 2 reports or standard security questionnaires for all critical vendors annually.",
        "status": "not_started",
        "policy_ids": ["pol-vnd-05"],
        "evidence_ids": []
    },
    {
        "id": "ctl-15",
        "code": "CC9.2-DPA",
        "title": "Data Processing Agreements (DPAs)",
        "category": "Vendor Management",
        "framework_ids": ["fw-gdpr", "fw-soc2", "fw-hipaa"],
        "frequency": "annual",
        "implementation": "Starter guidance: Execute DPAs and standard contractual clauses with all vendors handling personal data.",
        "status": "not_started",
        "policy_ids": ["pol-vnd-05", "pol-dta-06"],
        "evidence_ids": []
    },
    {
        "id": "ctl-16",
        "code": "A.1-BACKUP",
        "title": "Automated Database Backups and Testing",
        "category": "Business Continuity",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-hipaa"],
        "frequency": "continuous",
        "implementation": "Starter guidance: Perform daily automated database snapshots with quarterly documented restoration drills.",
        "status": "not_started",
        "policy_ids": ["pol-bcp-07"],
        "evidence_ids": []
    },
    {
        "id": "ctl-17",
        "code": "A.2-BCP-TEST",
        "title": "Annual Disaster Recovery Test",
        "category": "Business Continuity",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf"],
        "frequency": "annual",
        "implementation": "Starter guidance: Execute and document failover procedures to an alternate availability zone or region.",
        "status": "not_started",
        "policy_ids": ["pol-bcp-07"],
        "evidence_ids": []
    },
    {
        "id": "ctl-18",
        "code": "GV.1-RISK-REG",
        "title": "Annual Risk Assessment",
        "category": "Risk Management",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf", "fw-hipaa"],
        "frequency": "annual",
        "implementation": "Starter guidance: Facilitate cross-functional risk assessment meetings and maintain treatment plans for top risks.",
        "status": "not_started",
        "policy_ids": ["pol-rsk-04"],
        "evidence_ids": []
    },
    {
        "id": "ctl-19",
        "code": "HR.1-BACKGROUND",
        "title": "Pre-Employment Background Checks",
        "category": "Human Resources",
        "framework_ids": ["fw-soc2", "fw-iso27001"],
        "frequency": "continuous",
        "implementation": "Starter guidance: Verify identity, employment history, and criminal background for all candidates prior to hire.",
        "status": "not_started",
        "policy_ids": ["pol-sec-01"],
        "evidence_ids": []
    },
    {
        "id": "ctl-20",
        "code": "HR.2-TRAINING",
        "title": "Annual Security Awareness Training",
        "category": "Human Resources",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf", "fw-hipaa"],
        "frequency": "annual",
        "implementation": "Starter guidance: Ensure 100% completion of baseline security training within 30 days of hire and annually thereafter.",
        "status": "not_started",
        "policy_ids": ["pol-sec-01"],
        "evidence_ids": []
    },
    {
        "id": "ctl-21",
        "code": "HR.3-ACKNOWLEDGE",
        "title": "Security Policy Acknowledgments",
        "category": "Human Resources",
        "framework_ids": ["fw-soc2", "fw-iso27001"],
        "frequency": "annual",
        "implementation": "Starter guidance: Collect signed acknowledgments of acceptable use and security policies upon onboarding and after revisions.",
        "status": "not_started",
        "policy_ids": ["pol-sec-01"],
        "evidence_ids": []
    },
    {
        "id": "ctl-22",
        "code": "AS.1-INVENTORY",
        "title": "Hardware and Software Asset Inventory",
        "category": "Asset Management",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-nist-csf"],
        "frequency": "quarterly",
        "implementation": "Starter guidance: Maintain a complete inventory of company-owned laptops, cloud VMs, and third-party SaaS services.",
        "status": "not_started",
        "policy_ids": ["pol-sec-01"],
        "evidence_ids": []
    },
    {
        "id": "ctl-23",
        "code": "AS.2-MDM-DISK",
        "title": "Endpoint Disk Encryption and Screen Lock",
        "category": "Asset Management",
        "framework_ids": ["fw-soc2", "fw-iso27001", "fw-hipaa"],
        "frequency": "continuous",
        "implementation": "Starter guidance: Enforce FileVault/BitLocker encryption and 15-minute automatic screen lock via MDM.",
        "status": "not_started",
        "policy_ids": ["pol-sec-01"],
        "evidence_ids": []
    },
    {
        "id": "ctl-24",
        "code": "PR.1-DSR",
        "title": "Data Subject Rights (DSR) Request Procedure",
        "category": "Privacy",
        "framework_ids": ["fw-gdpr"],
        "frequency": "continuous",
        "implementation": "Starter guidance: Documented process to respond to access, rectification, and erasure requests within 30 days.",
        "status": "not_started",
        "policy_ids": ["pol-dta-06"],
        "evidence_ids": []
    }
]


def seed_starter_data(store: Store) -> None:
    """Idempotently seed frameworks, controls, and policies if not already present."""
    with store.transaction() as db:
        seeded = db.execute("SELECT value FROM settings WHERE key='starter_seeded'").fetchone()
        if seeded and seeded[0] == 'true':
            return

        # Seed frameworks
        for fw in FRAMEWORKS_SEED:
            existing = Store.get(db, 'frameworks', fw['id'])
            if not existing:
                record = {**fw, "created_at": now(), "updated_at": now()}
                db.execute(
                    "INSERT INTO records (resource, id, body) VALUES ('frameworks', ?, ?)",
                    (fw['id'], json.dumps(record))
                )

        # Seed policies
        for pol in POLICIES_SEED:
            existing = Store.get(db, 'policies', pol['id'])
            if not existing:
                record = {
                    **pol,
                    "version": 1,
                    "control_ids": [],
                    "approved_at": None,
                    "approver": "",
                    "created_at": now(),
                    "updated_at": now()
                }
                db.execute(
                    "INSERT INTO records (resource, id, body) VALUES ('policies', ?, ?)",
                    (pol['id'], json.dumps(record))
                )

        # Seed controls & link to policies
        for ctl in CONTROLS_SEED:
            existing = Store.get(db, 'controls', ctl['id'])
            if not existing:
                record = {
                    **ctl,
                    "description": ctl.get("implementation", ""),
                    "owner": "",
                    "due_date": None,
                    "tags": ["starter-control"],
                    "created_at": now(),
                    "updated_at": now()
                }
                db.execute(
                    "INSERT INTO records (resource, id, body) VALUES ('controls', ?, ?)",
                    (ctl['id'], json.dumps(record))
                )

        # Now link controls to policies on policies records
        for pol in POLICIES_SEED:
            policy_row = Store.get(db, 'policies', pol['id'])
            if policy_row:
                linked_controls = [c['id'] for c in CONTROLS_SEED if pol['id'] in c['policy_ids']]
                policy_row['control_ids'] = list(dict.fromkeys(policy_row.get('control_ids', []) + linked_controls))
                db.execute(
                    "UPDATE records SET body=? WHERE resource='policies' AND id=?",
                    (json.dumps(policy_row), pol['id'])
                )

        db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('starter_seeded', 'true')")


if __name__ == "__main__":
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        s = Store(td)
        seed_starter_data(s)
        print("✓ seed_starter_data completed successfully.")
