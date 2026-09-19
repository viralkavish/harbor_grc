"""Auditor-approved policy templates library with variable placeholders.

Inspired by standard framework requirements across SOC 2, ISO 27001, HIPAA, GDPR, and NIST CSF.
Includes dynamic variable substitution for rapid organizational tailoring.
"""

POLICY_TEMPLATES = [
    {
        "id": "tpl-sec-01",
        "title": "Information Security Policy",
        "category": "Governance",
        "description": "Foundational security directives, governance hierarchy, and organizational security commitments.",
        "frameworks": ["SOC 2", "ISO 27001", "NIST CSF 2.0", "HIPAA"],
        "content": """# Information Security Policy

**Scope:** Organization-wide baseline for {{organization_name}}.

## 1. Objectives & Executive Mandate
{{organization_name}} is committed to safeguarding the confidentiality, integrity, and availability of all data, customer information, and technology systems.

## 2. Governance Hierarchy
- **Executive Leadership** retains ultimate accountability for risk posture.
- **{{ciso_title}}** oversees policy enforcement, audit readiness, and continuous control monitoring.
- **Workforce Members** must complete annual training and report anomalies within {{incident_response_sla}}.

## 3. Acceptable Use & Asset Protection
Corporate computing assets are provided exclusively for authorized business operations. Unapproved software, unauthorized credential sharing, and tampering with security agents are strictly prohibited.

## 4. Exceptions & Escalations
Deviations from security baselines must be documented in the Security Exceptions Register, approved by {{ciso_title}}, and renewed at least annually.

## 5. Review Cadence
This policy is reviewed and re-approved {{review_cadence}} by executive leadership.
"""
    },
    {
        "id": "tpl-acc-02",
        "title": "Access Control Policy",
        "category": "Access",
        "description": "Rules governing user authentication, least-privilege authorization, MFA enforcement, and access reviews.",
        "frameworks": ["SOC 2", "ISO 27001", "HIPAA", "NIST CSF 2.0"],
        "content": """# Access Control Policy

**Scope:** All workforce accounts, cloud environments, and internal services at {{organization_name}}.

## 1. Principles of Least Privilege & Need-to-Know
Access is provisioned based strictly on job role requirements and revoked upon role change or termination.

## 2. Authentication Standards
- **Multi-Factor Authentication (MFA)**: Mandatory for all workforce members across identity providers, cloud consoles, code repositories, and VPNs.
- Passwords must meet modern length baselines (minimum 14 characters) and avoid common or breached sequences.

## 3. Account Lifecycle Management
- **Provisioning**: Requires documented manager authorization prior to account creation.
- **Deprovisioning**: Access rights must be disabled within 24 hours of employee departure or immediate termination.

## 4. Periodic Entitlement Reviews
Privileged and administrative access to production systems must be formally reviewed and certified {{review_cadence}}.
"""
    },
    {
        "id": "tpl-inc-03",
        "title": "Incident Response Policy",
        "category": "Operations",
        "description": "Procedures for identifying, triaging, containing, eradicating, and reporting security incidents.",
        "frameworks": ["SOC 2", "ISO 27001", "GDPR", "HIPAA", "NIST CSF 2.0"],
        "content": """# Incident Response Policy

**Scope:** Operational cybersecurity events impacting {{organization_name}}.

## 1. Incident Classification
- **Critical (P1)**: Verified customer data exposure, ransomware, or core service outage.
- **High (P2)**: Compromise of privileged credentials or targeted spear-phishing attack.
- **Medium (P3)**: Contained malware or localized policy breach.
- **Low (P4)**: Routine suspicious email report or minor anomaly.

## 2. Response & Escalation SLA
The Incident Response Team must triage critical incidents within {{incident_response_sla}}.

## 3. Regulatory & Customer Disclosures
Customer and regulatory notifications (including GDPR 72-hour notifications where applicable) are coordinated exclusively through legal counsel and {{ciso_title}}.

## 4. Post-Mortem Review
A root-cause analysis and remediation action plan must be completed within 5 business days of incident resolution.
"""
    },
    {
        "id": "tpl-rsk-04",
        "title": "Risk Management Policy",
        "category": "Governance",
        "description": "Methodology for identifying, assessing, scoring, treating, and monitoring risks.",
        "frameworks": ["SOC 2", "ISO 27001", "NIST CSF 2.0"],
        "content": """# Risk Management Policy

**Scope:** Enterprise cybersecurity and operational risk evaluation at {{organization_name}}.

## 1. Assessment Methodology
Risks are evaluated using standard 5×5 scoring:
- **Inherent Risk** = Likelihood (1-5) × Impact (1-5)
- **Residual Risk** = Inherent Risk after implementation of compensatory control treatments.

## 2. Treatment Options
Every identified risk is assigned one of four treatment determinations:
1. **Mitigate**: Apply technical or organizational controls to reduce risk exposure.
2. **Transfer**: Purchase cyber liability insurance or contractually shift liability.
3. **Avoid**: Cease the risky activity or decommission the system.
4. **Accept**: Executive sign-off for residual risks within risk tolerance thresholds.

## 3. Risk Register Maintenance
The corporate Risk Register is updated continuously and formally reviewed {{review_cadence}}.
"""
    },
    {
        "id": "tpl-vnd-05",
        "title": "Vendor Risk Management Policy",
        "category": "Third-Party",
        "description": "Due diligence, security evaluations, ongoing monitoring, and offboarding for vendors.",
        "frameworks": ["SOC 2", "ISO 27001", "GDPR", "HIPAA"],
        "content": """# Vendor Risk Management Policy

**Scope:** All third-party software, service providers, and contractors engaged by {{organization_name}}.

## 1. Vendor Tiering
- **Tier 1 (Critical)**: Vendors with direct access to production infrastructure or sensitive customer data.
- **Tier 2 (High)**: Core operational infrastructure without direct production data access.
- **Tier 3 (Medium/Low)**: Ancillary business productivity tools.

## 2. Due Diligence Requirements
Tier 1 and Tier 2 vendors must provide an annual SOC 2 Type II or ISO 27001 certificate, or complete a comprehensive security questionnaire.

## 3. Data Processing Agreements (DPAs)
Standard DPAs and appropriate cross-border data transfer safeguards must be executed before transferring any personal or sensitive information.

## 4. Renewal & Offboarding
Vendor risk scores and contract terms are reviewed {{review_cadence}}. Terminated vendors must provide confirmation of data deletion within 30 days.
"""
    },
    {
        "id": "tpl-dta-06",
        "title": "Data Handling & Retention Policy",
        "category": "Data",
        "description": "Data classification guidelines, encryption baselines, retention schedules, and secure disposal.",
        "frameworks": ["SOC 2", "ISO 27001", "GDPR", "HIPAA"],
        "content": """# Data Handling & Retention Policy

**Scope:** Information assets processed or stored by {{organization_name}}.

## 1. Classification Levels
- **Restricted / Sensitive**: Customer PII, health information (ePHI), authentication credentials, encryption keys.
- **Confidential**: Proprietary source code, financial audits, strategic roadmaps.
- **Internal**: Standard employee operational communication.
- **Public**: Published marketing collateral.

## 2. Encryption Standards
Restricted and Confidential data must be encrypted in transit using modern TLS (1.2+) and at rest using industry-standard AES-256.

## 3. Retention Cadence
Customer records are retained for the duration of the commercial relationship plus {{retention_period}} to satisfy statutory and audit obligations, after which data is cryptographically shredded.
"""
    },
    {
        "id": "tpl-bcp-07",
        "title": "Business Continuity & Disaster Recovery Policy",
        "category": "Operations",
        "description": "Operational continuity planning, data backup cadences, and annual disaster recovery testing.",
        "frameworks": ["SOC 2", "ISO 27001", "HIPAA", "NIST CSF 2.0"],
        "content": """# Business Continuity & Disaster Recovery Policy

**Scope:** Business resilience and disaster recovery across {{organization_name}}.

## 1. Recovery Objectives
- **Recovery Time Objective (RTO)**: Maximum acceptable system downtime for critical services.
- **Recovery Point Objective (RPO)**: Maximum acceptable data loss window.

## 2. Automated Backups
Production databases and persistent volumes are snapshotted daily with point-in-time recovery enabled and stored across separate geographic availability zones.

## 3. Annual Disaster Recovery Drill
A disaster recovery restoration simulation must be conducted at least {{review_cadence}} with findings documented for auditor inspection.
"""
    },
    {
        "id": "tpl-chg-08",
        "title": "Change Management Policy",
        "category": "Engineering",
        "description": "Change authorization, peer review, automated testing, and rollback requirements for production.",
        "frameworks": ["SOC 2", "ISO 27001"],
        "content": """# Change Management Policy

**Scope:** Software engineering and infrastructure deployment at {{organization_name}}.

## 1. Peer Review Mandate
All code committed to production branches requires at least one documented approving pull request review from an authorized engineer.

## 2. CI/CD Automated Testing Gates
Automated test suites, static code analysis, and dependency security scanners must pass prior to merge approval.

## 3. Rollback Procedures
Every deployment must include a validated automated rollback or feature flag deactivation plan.
"""
    },
    {
        "id": "tpl-use-09",
        "title": "Acceptable Use Policy",
        "category": "Human Resources",
        "description": "Workforce computing rules, device security, password hygiene, and communications guidelines.",
        "frameworks": ["SOC 2", "ISO 27001", "NIST CSF 2.0"],
        "content": """# Acceptable Use Policy

**Scope:** All employees, contractors, and temporary personnel at {{organization_name}}.

## 1. Authorized Use
Company-issued laptops, email accounts, and communication channels are intended primarily for official business activities.

## 2. Prohibited Activities
Workforce members may not:
- Disable endpoint security agents, antivirus, or disk encryption.
- Install unvetted third-party software or browser extensions with excessive permissions.
- Share credentials or bypass multi-factor authentication.
- Transmit confidential customer information over unauthorized consumer platforms.

## 3. Employee Attestation
All workforce members must sign an annual acknowledgment confirming adherence to this policy.
"""
    },
    {
        "id": "tpl-cry-10",
        "title": "Cryptography & Key Management Policy",
        "category": "Data",
        "description": "Approved cryptographic algorithms, key lifecycle management, and rotation requirements.",
        "frameworks": ["SOC 2", "ISO 27001", "NIST CSF 2.0", "PCI-DSS"],
        "content": """# Cryptography & Key Management Policy

**Scope:** Cryptographic controls, certificate authority management, and encryption keys at {{organization_name}}.

## 1. Approved Algorithms
Only NIST-approved cryptographic primitives may be used:
- Symmetric Encryption: AES-256 (GCM or CBC mode).
- Asymmetric Encryption / Signatures: RSA-2048+ or ECC (secp256r1 / Ed25519).
- Hashing: SHA-256 or SHA-3. Deprecated algorithms (MD5, SHA-1, DES) are banned.

## 2. Key Generation & Storage
Master encryption keys must be generated inside Hardware Security Modules (HSMs) or managed cloud KMS providers. Keys may never be hardcoded in source code or stored in plaintext config files.

## 3. Key Rotation
Encryption keys and TLS certificates must be rotated at least {{review_cadence}}.
"""
    },
    {
        "id": "tpl-rem-11",
        "title": "Remote Work & Mobile Device Security Policy",
        "category": "Endpoint",
        "description": "Security configurations for remote employees, MDM enforcement, and lost-device protocols.",
        "frameworks": ["SOC 2", "ISO 27001", "HIPAA"],
        "content": """# Remote Work & Mobile Device Security Policy

**Scope:** Remote employees and portable computing devices accessing {{organization_name}} systems.

## 1. Mobile Device Management (MDM)
All laptops and mobile devices accessing corporate data must be enrolled in corporate MDM with:
- Full-disk encryption (FileVault / BitLocker / LUKS) enabled.
- Automatic screen lock after 15 minutes of inactivity.
- Remote wipe capability enabled.

## 2. Network Security
Workforce members working remotely must connect through secure Wi-Fi networks (WPA2/WPA3) and avoid public unsecured hotspots without VPN encryption.

## 3. Lost or Stolen Devices
Loss or theft of any corporate device must be reported to {{ciso_title}} within 2 hours to initiate remote lock and wipe procedures.
"""
    },
    {
        "id": "tpl-vul-12",
        "title": "Vulnerability Management & Patching Policy",
        "category": "Operations",
        "description": "Vulnerability scanning cadences, severity ratings, and mandatory remediation SLAs.",
        "frameworks": ["SOC 2", "ISO 27001", "NIST CSF 2.0"],
        "content": """# Vulnerability Management & Patching Policy

**Scope:** Operating systems, container images, third-party libraries, and web applications at {{organization_name}}.

## 1. Scanning Cadence
Automated dependency and container vulnerability scans run on every deployment. Cloud infrastructure is scanned continuously for configuration drift.

## 2. Remediation SLAs
- **Critical (CVSS 9.0 - 10.0)**: Remediate within 7 calendar days.
- **High (CVSS 7.0 - 8.9)**: Remediate within 30 calendar days.
- **Medium (CVSS 4.0 - 6.9)**: Remediate within 90 calendar days.

## 3. Annual Penetration Testing
An independent third-party penetration test is conducted at least {{review_cadence}} with all critical findings tracked to remediation.
"""
    },
    {
        "id": "tpl-phy-13",
        "title": "Physical Security Policy",
        "category": "Facilities",
        "description": "Physical facility access controls, badge requirements, clean desk policy, and visitor tracking.",
        "frameworks": ["SOC 2", "ISO 27001", "HIPAA"],
        "content": """# Physical Security Policy

**Scope:** Physical offices, co-working spaces, and facility access for {{organization_name}}.

## 1. Physical Access Controls
Access to corporate office spaces requires badge access or authorized keycards. Access logs are maintained for at least 90 days.

## 2. Clean Desk & Clean Screen
Workstations must be locked whenever unattended. Sensitive printed documents and credentials must be shredded or stored in locked storage.

## 3. Data Center Provider Verification
Because production workloads are hosted with certified cloud providers (e.g. AWS/GCP), physical data center controls are audited through provider SOC 2 Type II reports annually.
"""
    },
    {
        "id": "tpl-eth-14",
        "title": "Code of Conduct & Security Ethics Policy",
        "category": "Human Resources",
        "description": "Ethical guidelines, conflict of interest rules, whistleblower protections, and compliance attestations.",
        "frameworks": ["SOC 2", "ISO 27001"],
        "content": """# Code of Conduct & Security Ethics Policy

**Scope:** All personnel representing {{organization_name}}.

## 1. Ethical Standards
Personnel must maintain high standards of integrity, honesty, and transparency in all business dealings, customer interactions, and regulatory reporting.

## 2. Conflict of Interest & Confidentiality
Personnel must protect confidential company and customer information and disclose any secondary business interests that may conflict with their responsibilities.

## 3. Whistleblower Protection
{{organization_name}} maintains an anonymous reporting channel for ethical or security concerns with strict non-retaliation protections.
"""
    }
]


def render_policy_template(template: dict, substitutions: dict[str, str] | None = None) -> str:
    defaults = {
        "organization_name": "Our Organization",
        "ciso_title": "Security Lead / CISO",
        "review_cadence": "annually",
        "retention_period": "7 years",
        "incident_response_sla": "1 hour",
        "mfa_requirement": "Mandatory across all corporate systems"
    }
    subs = {**defaults, **(substitutions or {})}
    content = template["content"]
    for key, val in subs.items():
        content = content.replace(f"{{{{{key}}}}}", val)
    return content
