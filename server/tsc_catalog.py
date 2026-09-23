"""Authoritative AICPA Trust Services Criteria (TSC 2017, as amended 2022) Control Catalog.

Catalog Vintage: TSC-2017-2022
Covers all 61 criteria across the Trust Services Criteria:
- Common Criteria: CC1.1–CC9.2 (33 criteria)
- Availability: A1.1–A1.3 (3 criteria)
- Confidentiality: C1.1–C1.2 (2 criteria)
- Processing Integrity: PI1.1–PI1.5 (5 criteria)
- Privacy: P1.1–P8.1 (18 criteria)
Total: 61 Criteria.

Each control includes stable ID, title, description, criterion mapping, 2022 points of focus,
designated owner role, auditor test procedure (steps), evidence requirement, control type,
nature, and operating frequency.
"""

CATALOG_VINTAGE = "TSC-2017-2022"

TSC_CATALOG: list[dict] = [
    # ==========================================
    # CC1: Control Environment (COSO Principles 1–5) - 5 Criteria
    # ==========================================
    {
        "id": "TF-CC1.1-01",
        "code": "CC1.1",
        "title": "Code of Conduct & Ethical Commitments",
        "description": "tofrom defines and communicates organizational core values, code of business conduct, and ethical commitments to all workforce members upon hire and annually.",
        "criterion_mapping": "CC1.1: Demonstrates Commitment to Integrity and Ethical Values",
        "points_of_focus": [
            "Sets the tone at the top regarding integrity and ethical behavior.",
            "Establishes standards of conduct across the organization.",
            "Evaluates adherence to standards of conduct and addresses deviations promptly."
        ],
        "owner": "People Ops & Legal",
        "test_procedure": "1. Inspect the approved Code of Conduct document.\n2. Sample workforce members and verify signed acknowledgment within 30 days of hire.\n3. Verify executive management annual communication affirming ethical standards.",
        "evidence_requirement": "Approved Code of Conduct policy document; new hire policy acceptance audit log with timestamps; disciplinary policy documentation.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Control Environment",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC1.2-01",
        "code": "CC1.2",
        "title": "Board & Executive Security Oversight",
        "description": "The leadership committee exercises oversight of the development and performance of internal control, cybersecurity strategy, and enterprise risk management.",
        "criterion_mapping": "CC1.2: Board of Directors Exercises Oversight Responsibility",
        "points_of_focus": [
            "Establishes oversight responsibilities and independence from management.",
            "Applies relevant cybersecurity and compliance expertise.",
            "Reviews security metrics, incident logs, and audit reports quarterly."
        ],
        "owner": "Executive Management",
        "test_procedure": "1. Obtain and inspect meeting minutes of executive security reviews.\n2. Verify quarterly presentation of security posture, audit readiness, and risk register updates.\n3. Confirm independent review of security exceptions.",
        "evidence_requirement": "Quarterly executive security review presentations; meeting minutes with attendee timestamps; security budget and oversight charter.",
        "type": "detective",
        "nature": "manual",
        "frequency": "quarterly",
        "status": "implemented",
        "category": "Control Environment",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC1.3-01",
        "code": "CC1.3",
        "title": "Organizational Structure & Security Responsibilities",
        "description": "Management establishes organizational hierarchy, reporting lines, and designated authorities across engineering, operations, and compliance functions.",
        "criterion_mapping": "CC1.3: Management Establishes Structure, Reporting Lines, and Authority",
        "points_of_focus": [
            "Defines organizational structures across operational boundaries.",
            "Establishes direct reporting lines for security accountability.",
            "Defines, assigns, and limits authorities and responsibilities."
        ],
        "owner": "CISO / Head of Security",
        "test_procedure": "1. Inspect the official organizational chart.\n2. Confirm security reporting line to executive management.\n3. Inspect job descriptions for security-relevant roles to verify delineated segregation of duties.",
        "evidence_requirement": "Current organizational chart; security leadership job descriptions; RACI matrix for production access and system changes.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Control Environment",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC1.4-01",
        "code": "CC1.4",
        "title": "Workforce Competence & Background Screening",
        "description": "tofrom maintains policies and procedures to attract, develop, screen, and retain competent workforce personnel aligned with security responsibilities.",
        "criterion_mapping": "CC1.4: Demonstrates Commitment to Attract, Develop, and Retain Competent Individuals",
        "points_of_focus": [
            "Establishes policies and practices for hiring, screening, and onboarding.",
            "Evaluates technical and operational competence before employment offers.",
            "Plans for succession and ongoing technical professional development."
        ],
        "owner": "People Ops",
        "test_procedure": "1. Obtain the background check screening policy.\n2. Extract a random sample of new hires onboarded during the observation period.\n3. Inspect completed third-party background screening reports prior to start date.",
        "evidence_requirement": "Third-party background check verification reports; employee onboarding checklist; signed job offer letters with role specifications.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Control Environment",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC1.5-01",
        "code": "CC1.5",
        "title": "Workforce Accountability & Performance Evaluations",
        "description": "Management holds individuals accountable for internal control responsibilities through annual performance appraisals and documented disciplinary procedures.",
        "criterion_mapping": "CC1.5: Holds Individuals Accountable for Internal Control Responsibilities",
        "points_of_focus": [
            "Enforces accountability through performance metrics and appraisals.",
            "Evaluates performance against internal control objectives.",
            "Maintains documented disciplinary actions for security policy violations."
        ],
        "owner": "People Ops",
        "test_procedure": "1. Inspect annual performance review template including security adherence criteria.\n2. Confirm existence of an escalated disciplinary policy for security non-compliance.\n3. Sample performance reviews to verify security goals evaluation.",
        "evidence_requirement": "Performance evaluation framework; disciplinary policy; sample completed annual reviews with redacted confidential data.",
        "type": "detective",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Control Environment",
        "framework_ids": ["fw-soc2"]
    },

    # ==========================================
    # CC2: Communication and Information (COSO 13–15) - 3 Criteria
    # ==========================================
    {
        "id": "TF-CC2.1-01",
        "code": "CC2.1",
        "title": "System Description & Information Quality",
        "description": "tofrom generates and maintains a comprehensive AICPA Section 3 Description of the System documenting boundaries, data flows, components, and service commitments.",
        "criterion_mapping": "CC2.1: Obtains or Generates Relevant, Quality Information",
        "points_of_focus": [
            "Identifies information requirements to support internal control operations.",
            "Captures internal and external data sources for system boundaries.",
            "Processes relevant data into actionable compliance records."
        ],
        "owner": "CISO / Compliance Lead",
        "test_procedure": "1. Inspect the approved Section 3 Management Description of the System.\n2. Verify coverage across all 10 AICPA required sections including data classifications and CUECs.\n3. Confirm annual executive sign-off on system narrative.",
        "evidence_requirement": "AICPA SOC 2 Section 3 System Description PDF/Markdown; architectural diagrams; data flow specifications.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Communication and Information",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC2.2-01",
        "code": "CC2.2",
        "title": "Internal Security Communication & Whistleblower Channel",
        "description": "Security objectives, operational policies, and confidential reporting channels (whistleblower/incident hotlines) are communicated internally to all personnel.",
        "criterion_mapping": "CC2.2: Communicates Internally Regarding Internal Control",
        "points_of_focus": [
            "Communicates internal control information across operational teams.",
            "Provides separate reporting lines (such as whistleblower hotlines).",
            "Disseminates policy revisions and security alerts promptly."
        ],
        "owner": "People Ops & Legal",
        "test_procedure": "1. Inspect internal documentation announcing security policy updates.\n2. Verify the existence of an anonymous or confidential whistleblower reporting channel.\n3. Test the whistleblower intake mechanism to confirm alert delivery to compliance leadership.",
        "evidence_requirement": "Whistleblower policy; anonymous intake form configuration; internal Slack/email broadcast logs announcing policy adoptions.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Communication and Information",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC2.3-01",
        "code": "CC2.3",
        "title": "External Stakeholder & Customer Communication",
        "description": "tofrom communicates system availability, security commitments, privacy notices, and incident notifications to customers and external partners.",
        "criterion_mapping": "CC2.3: Communicates With External Parties",
        "points_of_focus": [
            "Communicates service commitments and requirements to customers.",
            "Maintains channels for receiving external inquiries and vulnerability disclosures.",
            "Communicates security incidents and status updates to affected customers."
        ],
        "owner": "Product & Support",
        "test_procedure": "1. Inspect publicly accessible Terms of Service, Privacy Notice, and Security whitepaper.\n2. Inspect the customer incident notification procedure with documented SLA commitments.\n3. Verify existence of a security contact / security.txt disclosure mechanism.",
        "evidence_requirement": "Public privacy policy URL; security.txt file; Master Services Agreement (MSA) security terms; status page uptime reporting.",
        "type": "detective",
        "nature": "manual",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Communication and Information",
        "framework_ids": ["fw-soc2"]
    },

    # ==========================================
    # CC3: Risk Assessment (COSO 6–9) - 4 Criteria
    # ==========================================
    {
        "id": "TF-CC3.1-01",
        "code": "CC3.1",
        "title": "Risk Assessment Objectives & Tolerance",
        "description": "Management establishes clear operational, reporting, and compliance risk objectives aligned with organizational risk tolerance thresholds.",
        "criterion_mapping": "CC3.1: Specifies Objectives to Enable Risk Identification and Assessment",
        "points_of_focus": [
            "Aligns risk assessment objectives with entity commitments and legal mandates.",
            "Defines risk tolerance thresholds across critical infrastructure and customer data.",
            "Reviews risk assessment scope annually."
        ],
        "owner": "Security Lead",
        "test_procedure": "1. Inspect the approved Risk Assessment Policy.\n2. Verify defined 5x5 Likelihood and Impact scoring matrix with explicit tolerance thresholds.\n3. Confirm annual approval by executive management.",
        "evidence_requirement": "Approved Risk Assessment Policy; Risk Tolerance Matrix document; risk classification rubrics.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Risk Assessment",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC3.2-01",
        "code": "CC3.2",
        "title": "Enterprise Risk Register & Threat Identification",
        "description": "tofrom performs annual formal risk assessments identifying vulnerabilities, threat vectors, likelihood, impact, and designated mitigating controls.",
        "criterion_mapping": "CC3.2: Identifies and Analyzes Risks Across the Entity",
        "points_of_focus": [
            "Identifies threats from internal and external sources.",
            "Evaluates inherent and residual risk scores.",
            "Determines risk response strategies (mitigate, accept, transfer, avoid)."
        ],
        "owner": "Security Lead",
        "test_procedure": "1. Inspect the active Enterprise Risk Register.\n2. Verify calculated inherent and residual risk scores across recorded risks.\n3. Confirm linking of critical risks to mitigating technical controls.",
        "evidence_requirement": "Enterprise Risk Register export with likelihood/impact scores; risk treatment plans; annual risk assessment meeting minutes.",
        "type": "detective",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Risk Assessment",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC3.3-01",
        "code": "CC3.3",
        "title": "Fraud Risk Assessment & Insider Threat Modeling",
        "description": "The risk assessment explicitly analyzes potential fraud vectors, incentive pressures, unauthorized asset misappropriation, and insider threats.",
        "criterion_mapping": "CC3.3: Considers the Potential for Fraud in Assessing Risks",
        "points_of_focus": [
            "Considers incentives, pressures, and opportunities for fraudulent acts.",
            "Evaluates potential for unauthorized management override of controls.",
            "Assesses fraud risks associated with proprietary code and customer data access."
        ],
        "owner": "CISO & Legal",
        "test_procedure": "1. Inspect the fraud risk assessment section within the annual risk assessment report.\n2. Verify analysis of insider access to production customer databases.\n3. Confirm segregation of duties preventing unilateral transaction execution.",
        "evidence_requirement": "Documented fraud risk assessment analysis; multi-party approval requirements for sensitive production operations.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Risk Assessment",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC3.4-01",
        "code": "CC3.4",
        "title": "Significant Change & Emerging Threat Assessment",
        "description": "Management identifies and assesses internal and external changes that could significantly affect the system of internal control (e.g. cloud migrations, AI integrations).",
        "criterion_mapping": "CC3.4: Identifies and Assesses Changes Affecting Internal Control",
        "points_of_focus": [
            "Assesses changes in the operating environment, business model, and technology.",
            "Evaluates new technologies (e.g. AI inference models, cloud providers) prior to deployment.",
            "Updates control activities following major architectural changes."
        ],
        "owner": "Head of Engineering",
        "test_procedure": "1. Inspect architectural review records for major platform releases.\n2. Verify threat modeling documentation for new external integrations and AI providers.\n3. Confirm security team sign-off prior to production deployment of major architectural changes.",
        "evidence_requirement": "Architecture review records; vendor security reviews for new technologies; change advisory minutes.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Risk Assessment",
        "framework_ids": ["fw-soc2"]
    },

    # ==========================================
    # CC4: Monitoring Activities (COSO 16–17) - 2 Criteria
    # ==========================================
    {
        "id": "TF-CC4.1-01",
        "code": "CC4.1",
        "title": "Continuous Controls Monitoring & Posture Tests",
        "description": "tofrom conducts ongoing evaluations and automated continuous control tests to ascertain whether internal control components are present and functioning.",
        "criterion_mapping": "CC4.1: Performs Ongoing and/or Separate Evaluations",
        "points_of_focus": [
            "Integrates continuous monitoring of system configurations and control operating health.",
            "Conducts separate point-in-time internal audits and readiness checks.",
            "Validates baseline configurations across workstations, cloud tenants, and repositories."
        ],
        "owner": "Security Engineering",
        "test_procedure": "1. Inspect automated continuous control test suite runs.\n2. Confirm hourly or daily automated evaluation of full-disk encryption, firewall status, and MFA.\n3. Verify test run logs are retained with tamper-resistant audit metadata.",
        "evidence_requirement": "Continuous control test run execution history; host inspection telemetry outputs; internal audit review logs.",
        "type": "detective",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Monitoring Activities",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC4.2-01",
        "code": "CC4.2",
        "title": "Deficiency Evaluation & Corrective Action Tracking",
        "description": "Internal control deficiencies, test failures, and audit findings are tracked, evaluated for severity, communicated to responsible owners, and remediated under SLAs.",
        "criterion_mapping": "CC4.2: Evaluates and Communicates Deficiencies",
        "points_of_focus": [
            "Identifies and records internal control deficiencies in a centralized register.",
            "Communicates deficiencies to parties responsible for corrective actions.",
            "Monitors remediation progress through executive dashboards."
        ],
        "owner": "Security Lead",
        "test_procedure": "1. Inspect the remediation task management queue.\n2. Verify that automated test failures generate tracked tasks with assigned owners and due dates.\n3. Sample closed remediation tickets to verify evidence of validation.",
        "evidence_requirement": "Remediation tasks register; overdue task alerts; ticket resolution logs with re-test proof.",
        "type": "detective",
        "nature": "manual",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Monitoring Activities",
        "framework_ids": ["fw-soc2"]
    },

    # ==========================================
    # CC5: Control Activities (COSO 10–12) - 3 Criteria
    # ==========================================
    {
        "id": "TF-CC5.1-01",
        "code": "CC5.1",
        "title": "Control Activity Selection & Mitigation Alignment",
        "description": "Control activities are selected and developed to contribute to the mitigation of identified compliance and security risks to acceptable levels.",
        "criterion_mapping": "CC5.1: Selects and Develops Control Activities",
        "points_of_focus": [
            "Integrates control activities directly with risk treatment decisions.",
            "Considers business process environment and entity-specific technology architecture.",
            "Establishes a mix of manual, automated, preventive, and detective controls."
        ],
        "owner": "Security Lead",
        "test_procedure": "1. Inspect the authoritative control catalog mapping against risk register entries.\n2. Confirm that each critical risk is mapped to at least one operational control.\n3. Verify operational status of mapped controls.",
        "evidence_requirement": "Control-to-risk crosswalk matrix; control catalog register; risk treatment plans.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Control Activities",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC5.2-01",
        "code": "CC5.2",
        "title": "Information Technology General Controls (ITGC)",
        "description": "Management develops general control activities over computing technology to support the continued, secure operation of applications and infrastructure.",
        "criterion_mapping": "CC5.2: Selects and Develops General Controls Over Technology",
        "points_of_focus": [
            "Establishes technology infrastructure control activities.",
            "Establishes security management process controls.",
            "Establishes technology acquisition, development, and maintenance controls."
        ],
        "owner": "Head of Engineering",
        "test_procedure": "1. Inspect baseline ITGC policies covering cloud configuration, server provisioning, and maintenance.\n2. Verify infrastructure-as-code peer review approval mandates.\n3. Confirm automated dependency scanning in CI pipelines.",
        "evidence_requirement": "ITGC baseline standards; GitHub branch protection rules; Terraform pull request reviews.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Control Activities",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC5.3-01",
        "code": "CC5.3",
        "title": "Policy Deployment & Operating Procedures",
        "description": "Control activities are deployed through documented corporate governance policies that establish expectations and operational procedures that put policies into action.",
        "criterion_mapping": "CC5.3: Deploys Control Activities Through Policies and Procedures",
        "points_of_focus": [
            "Establishes policies and procedures to govern day-to-day operations.",
            "Assigns responsibility and accountability for executing policies.",
            "Performs periodic policy reviews to maintain operational currency."
        ],
        "owner": "CISO / Compliance Lead",
        "test_procedure": "1. Inspect all 8 core governance policies in the repository.\n2. Verify that all policies have an approved status, executive approver, and current review date.\n3. Confirm semantic policy-to-control compatibility using JEV System One.",
        "evidence_requirement": "Published policy Markdown documents; policy version snapshots; executive approval timestamps.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Control Activities",
        "framework_ids": ["fw-soc2"]
    },

    # ==========================================
    # CC6: Logical and Physical Access Controls - 8 Criteria
    # ==========================================
    {
        "id": "TF-CC6.1-01",
        "code": "CC6.1",
        "title": "Multi-Factor Authentication (MFA) & Identification",
        "description": "Multi-Factor Authentication (MFA) via authenticator app (TOTP) or FIDO2/WebAuthn hardware tokens is strictly mandatory for all workforce logins, administrative consoles, and remote infrastructure.",
        "criterion_mapping": "CC6.1: Logical Access Security Software, Infrastructure, and Architectures",
        "points_of_focus": [
            "Identifies and authenticates internal and external users.",
            "Enforces multi-factor authentication across cloud consoles and identity providers.",
            "Restricts credentials from being shared or transmitted in cleartext."
        ],
        "owner": "IT & Security Ops",
        "test_procedure": "1. Inspect Google Workspace / Okta identity provider security configuration.\n2. Verify 2-step verification is enforced for 100% of active accounts with 0 exceptions.\n3. Sample administrative logins and verify requirement of secondary hardware/TOTP factor.",
        "evidence_requirement": "IdP MFA enforcement policy configuration screenshot; user directory export showing MFA status = Active; AWS IAM root MFA verification.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Logical Access",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC6.2-01",
        "code": "CC6.2",
        "title": "User Provisioning & Role-Based Access Control (RBAC)",
        "description": "User account provisioning follows the principle of least privilege, requiring formal manager access approval and role-based permissions prior to credential issuance.",
        "criterion_mapping": "CC6.2: User Registration, Modification, and Role-Based Permissions",
        "points_of_focus": [
            "Authorizes access based on least privilege and job role requirements.",
            "Requires documented manager approval for elevated or non-standard access.",
            "Segregates conflicting duties to prevent unauthorized actions."
        ],
        "owner": "IT & Security Ops",
        "test_procedure": "1. Extract a sample of user access requests submitted during the observation window.\n2. Verify documented manager approval in ticket history prior to provisioning.\n3. Inspect role definitions in cloud tenants to confirm least-privilege scoping.",
        "evidence_requirement": "Access request tickets with approval timestamps; AWS IAM role policy documents; role-based permission matrix.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Logical Access",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC6.3-01",
        "code": "CC6.3",
        "title": "Timely Deprovisioning & Offboarding Revocation",
        "description": "Upon workforce termination or separation, all logical access credentials, corporate tokens, and cloud permissions are revoked and deactivated within 24 hours of notification.",
        "criterion_mapping": "CC6.3: Revocation of Access Upon Termination or Transfer",
        "points_of_focus": [
            "Revokes access immediately upon employee or contractor separation.",
            "Removes access credentials when roles change or transfers occur.",
            "Recovers all company-owned physical tokens and computing assets."
        ],
        "owner": "People Ops & IT",
        "test_procedure": "1. Obtain list of all employees and contractors separated during the observation period.\n2. Cross-reference termination timestamp with IdP and cloud console account deactivation timestamps.\n3. Assert that access revocation occurred within 24 hours of separation notice.",
        "evidence_requirement": "Offboarding ticket records; IdP user deactivation audit log; asset return acknowledgment forms.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Logical Access",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC6.4-01",
        "code": "CC6.4",
        "title": "Quarterly User Access Review & Recertification",
        "description": "Management conducts quarterly user access reviews across all production environments, code repositories, databases, and critical SaaS systems, recording keep/revoke determinations.",
        "criterion_mapping": "CC6.4: Periodic Review and Recertification of User Access",
        "points_of_focus": [
            "Reviews logical access rights on a periodic recurring cadence.",
            "Verifies that access permissions align with current job responsibilities.",
            "Promptly removes inappropriate, orphaned, or excessive privileges."
        ],
        "owner": "Security Lead",
        "test_procedure": "1. Inspect documented quarterly access review worksheets for each quarter in the observation window.\n2. Verify reviewer digital signature and timestamp on each campaign.\n3. Trace all 'Revoke' determinations to corresponding ticket deprovisioning proof.",
        "evidence_requirement": "Quarterly access review certification reports; signed keep/revoke logs; ticket proof of revoked entitlements.",
        "type": "detective",
        "nature": "manual",
        "frequency": "quarterly",
        "status": "implemented",
        "category": "Logical Access",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC6.5-01",
        "code": "CC6.5",
        "title": "Physical Data Center & Device Protection",
        "description": "Physical access to production data centers is restricted to authorized hosting provider personnel (via AWS CSOC). Company facilities and mobile devices enforce physical security safeguards.",
        "criterion_mapping": "CC6.5: Physical Access Restrictions",
        "points_of_focus": [
            "Restricts physical access to facilities housing production servers and media.",
            "Relies on verified subservice organization controls (AWS SOC 2 Type II).",
            "Enforces physical clean-desk policies and unattended workstation screen locks."
        ],
        "owner": "Facilities & Security",
        "test_procedure": "1. Inspect AWS SOC 2 Type II report for physical data center security controls.\n2. Verify MDM profile enforcing 5-minute screen lock across all company workstations.\n3. Inspect office visitor logs and electronic badge access records.",
        "evidence_requirement": "AWS SOC 2 Type II audit report; MDM screen lock configuration policy; office visitor logs.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "annual",
        "status": "implemented",
        "category": "Physical Access",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC6.6-01",
        "code": "CC6.6",
        "title": "Network Boundary Protection & Firewall Ingress Rules",
        "description": "Production network boundaries are segmented and protected by automated firewall rules, security groups, and DDoS shields. Ingress is restricted to authorized secure protocols.",
        "criterion_mapping": "CC6.6: Boundary Protection, Network Segmentation, and Firewalls",
        "points_of_focus": [
            "Restricts inbound and outbound traffic through firewalls and virtual network boundaries.",
            "Blocks insecure cleartext protocols (e.g. Telnet, unencrypted HTTP/FTP).",
            "Implements edge DDoS mitigation and web application firewall (WAF) filtering."
        ],
        "owner": "Infrastructure Engineering",
        "test_procedure": "1. Inspect cloud security group rules and VPC network access control lists.\n2. Confirm that port 22/SSH and database ports are not open to 0.0.0.0/0.\n3. Execute port scan telemetry to verify no cleartext listening services.",
        "evidence_requirement": "Cloud security group configuration exports; VPC routing tables; Cloudflare WAF rule configuration screenshot.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Network Security",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC6.7-01",
        "code": "CC6.7",
        "title": "Cryptographic Protection at Rest & In Transit",
        "description": "All customer data and sensitive credentials are encrypted in transit using TLS 1.3/1.2 and encrypted at rest across all storage volumes, databases, and backups using AES-256.",
        "criterion_mapping": "CC6.7: Transmission and Data-at-Rest Cryptographic Protections",
        "points_of_focus": [
            "Protects data in transit across public and untrusted networks using modern cipher suites.",
            "Encrypts data at rest across block storage, object storage, and relational databases.",
            "Protects cryptographic keys against unauthorized disclosure and rotation."
        ],
        "owner": "Infrastructure Engineering",
        "test_procedure": "1. Inspect SSL/TLS cipher suite configuration on public domains (e.g. via Qualys SSL Labs A+ rating).\n2. Inspect AWS RDS, EBS, and S3 encryption settings verifying AES-256 / KMS.\n3. Inspect workstation full-disk encryption telemetry (LUKS / FileVault).",
        "evidence_requirement": "TLS certificate configuration; AWS KMS key management policies; database encryption configuration screenshots; workstation FDE report.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Cryptography",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC6.8-01",
        "code": "CC6.8",
        "title": "Malware Protection & Endpoint Detection (EDR)",
        "description": "tofrom deploys automated endpoint protection, anti-malware software, and continuous vulnerability scanning to detect and prevent unauthorized code execution.",
        "criterion_mapping": "CC6.8: Prevention, Detection, and Remediation of Malicious Software",
        "points_of_focus": [
            "Installs anti-malware and detection software on endpoints and servers.",
            "Updates detection signatures and threat intelligence feeds automatically.",
            "Quarantines detected malicious files and alerts security personnel."
        ],
        "owner": "IT & Security Ops",
        "test_procedure": "1. Obtain fleet inventory report showing anti-malware / EDR software installed on 100% of endpoints.\n2. Verify automated signature update cadence.\n3. Inspect EDR alert console for active infection alerts.",
        "evidence_requirement": "EDR fleet deployment dashboard screenshot; automated signature update logs; endpoint security policy.",
        "type": "detective",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Endpoint Security",
        "framework_ids": ["fw-soc2"]
    },

    # ==========================================
    # CC7: System Operations - 5 Criteria
    # ==========================================
    {
        "id": "TF-CC7.1-01",
        "code": "CC7.1",
        "title": "Vulnerability Scanning & Patch Management SLAs",
        "description": "Automated vulnerability scanning is performed across container images, dependencies, and cloud infrastructure, enforcing patch remediation SLAs based on CVSS severity.",
        "criterion_mapping": "CC7.1: Vulnerability Management and Patching",
        "points_of_focus": [
            "Performs recurring vulnerability assessments across systems and code.",
            "Classifies vulnerabilities by CVSS severity and business impact.",
            "Remediates identified vulnerabilities within defined SLA timeframes."
        ],
        "owner": "Security Engineering",
        "test_procedure": "1. Inspect automated vulnerability scanning configurations (e.g. GitHub Dependabot, AWS Inspector).\n2. Verify vulnerability patch SLA adherence: Critical <= 7 days, High <= 30 days.\n3. Sample identified vulnerabilities to confirm closure within policy SLAs.",
        "evidence_requirement": "Vulnerability assessment scan reports; patch remediation commit logs; Dependabot security advisory dashboard.",
        "type": "detective",
        "nature": "automated",
        "frequency": "weekly",
        "status": "implemented",
        "category": "System Operations",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC7.2-01",
        "code": "CC7.2",
        "title": "Annual Penetration Testing & Independent Security Audit",
        "description": "An independent third-party cybersecurity firm conducts annual application and infrastructure penetration tests to identify potential security weaknesses.",
        "criterion_mapping": "CC7.2: Security Anomaly and Penetration Testing",
        "points_of_focus": [
            "Engages independent qualified security assessors for annual testing.",
            "Tests external perimeter and authenticated application workflows.",
            "Remediates critical and high-severity findings prior to audit closeout."
        ],
        "owner": "CISO / Head of Security",
        "test_procedure": "1. Obtain the penetration test report from an accredited third-party assessor dated within the last 12 months.\n2. Review identified findings and severity ratings.\n3. Verify documented management response and tickets confirming remediation of findings.",
        "evidence_requirement": "Third-party penetration testing report; executive letter of attestation; remediation pull requests and ticket proof.",
        "type": "detective",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "System Operations",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC7.3-01",
        "code": "CC7.3",
        "title": "Centralized Audit Logging & SIEM Monitoring",
        "description": "System, authentication, and database audit logs are aggregated into centralized, write-protected log repositories with retention policies adhering to minimum 365-day standards.",
        "criterion_mapping": "CC7.3: Incident Evaluation, Log Monitoring, and SIEM",
        "points_of_focus": [
            "Collects and monitors security logs across infrastructure components.",
            "Protects audit logs against unauthorized modification or deletion.",
            "Configures automated alerts for anomalous activities and access failures."
        ],
        "owner": "Site Reliability Engineering",
        "test_procedure": "1. Inspect centralized logging configuration (e.g. AWS CloudTrail, Datadog).\n2. Verify log retention period is configured for at least 365 days.\n3. Test log immutability and confirm access to modify or delete logs is restricted.",
        "evidence_requirement": "AWS CloudTrail configuration screenshot; SIEM log retention settings; automated alert configuration exports.",
        "type": "detective",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "System Operations",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC7.4-01",
        "code": "CC7.4",
        "title": "Incident Response Plan & Tabletop Testing",
        "description": "tofrom maintains an Incident Response Plan defining roles, severity classifications, containment protocols, customer notification SLAs, and conducts annual simulation testing.",
        "criterion_mapping": "CC7.4: Incident Response Execution and Communication",
        "points_of_focus": [
            "Maintains documented incident response procedures with clear responsibilities.",
            "Tests incident response procedures through annual simulation exercises.",
            "Defines customer and regulatory breach notification procedures."
        ],
        "owner": "Security Lead",
        "test_procedure": "1. Inspect the approved Incident Response Plan.\n2. Obtain minutes and documentation from the annual incident response tabletop simulation drill.\n3. Verify post-incident review template and notification procedures.",
        "evidence_requirement": "Approved Incident Response Plan; tabletop simulation exercise report with attendee list; incident ticket logs.",
        "type": "detective",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "System Operations",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC7.5-01",
        "code": "CC7.5",
        "title": "Post-Incident Remediation & Root Cause Analysis",
        "description": "Following security incidents, management conducts root cause analyses (RCA) and implements corrective actions to prevent recurrence.",
        "criterion_mapping": "CC7.5: Post-Incident Analysis and Corrective Actions",
        "points_of_focus": [
            "Performs root cause analysis on identified security incidents.",
            "Tracks corrective action items to completion.",
            "Updates policies and technical controls based on post-incident lessons learned."
        ],
        "owner": "Security Lead",
        "test_procedure": "1. Inspect the post-incident review procedure.\n2. Review sample post-mortem reports generated during the period (if incidents occurred).\n3. Confirm that corrective actions resulted in tracked remediation tasks.",
        "evidence_requirement": "Post-mortem / RCA templates; completed incident post-mortem reports; corrective action tracking tickets.",
        "type": "corrective",
        "nature": "manual",
        "frequency": "continuous",
        "status": "implemented",
        "category": "System Operations",
        "framework_ids": ["fw-soc2"]
    },

    # ==========================================
    # CC8: Change Management - 1 Criterion
    # ==========================================
    {
        "id": "TF-CC8.1-01",
        "code": "CC8.1",
        "title": "Software Development Lifecycle & Peer Code Review",
        "description": "Production changes follow a documented SDLC process requiring automated testing in CI, documented peer review approval on pull requests, and restricted deployment permissions.",
        "criterion_mapping": "CC8.1: Authorization, Testing, Approval, and Segregation of Duties",
        "points_of_focus": [
            "Authorizes, designs, tests, and approves system changes prior to implementation.",
            "Enforces branch protection preventing direct commits to production branches.",
            "Segregates development and production environments."
        ],
        "owner": "Engineering Leadership",
        "test_procedure": "1. Inspect GitHub repository branch protection rules for production branches.\n2. Verify that pull requests require at least 1 independent peer approval and passing CI checks.\n3. Sample 10-25 merged pull requests to confirm approval and testing compliance.",
        "evidence_requirement": "GitHub branch protection settings screenshot; CI/CD pipeline definitions; sample merged pull requests with review comments.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Change Management",
        "framework_ids": ["fw-soc2"]
    },

    # ==========================================
    # CC9: Risk Mitigation & Vendor Management - 2 Criteria
    # ==========================================
    {
        "id": "TF-CC9.1-01",
        "code": "CC9.1",
        "title": "Third-Party Vendor Risk Assessment",
        "description": "tofrom evaluates third-party vendors and sub-processors prior to onboarding and annually thereafter, tiering vendors by data sensitivity and reviewing SOC 2/ISO certifications.",
        "criterion_mapping": "CC9.1: Identification and Evaluation of Vendor Risks",
        "points_of_focus": [
            "Maintains an inventory of all third-party vendors and service organizations.",
            "Tiers vendors based on access to customer data and operational criticality.",
            "Performs annual reviews of vendor security postures and SOC 2 Type II reports."
        ],
        "owner": "Security & Procurement",
        "test_procedure": "1. Inspect the active Vendor Inventory Register.\n2. Sample critical and high-tier vendors.\n3. Verify current SOC 2 Type II reports or completed security assessment questionnaires on file.",
        "evidence_requirement": "Vendor inventory register; third-party SOC 2 Type II reports; vendor risk assessment notes.",
        "type": "detective",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Vendor Management",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-CC9.2-01",
        "code": "CC9.2",
        "title": "Sub-Processor Agreements & Data Processing Terms (DPA)",
        "description": "tofrom executes binding Data Processing Agreements (DPAs) with all sub-processors handling customer confidential or personal data, defining confidentiality and security obligations.",
        "criterion_mapping": "CC9.2: Vendor Contracts and Subservice Organization Controls",
        "points_of_focus": [
            "Establishes written agreements with third-party vendors processing data.",
            "Incorporates confidentiality, security standards, and breach notification terms.",
            "Evaluates Complementary Subservice Organization Controls (CSOCs)."
        ],
        "owner": "Legal & Security",
        "test_procedure": "1. Inspect list of sub-processors handling customer data.\n2. Obtain and inspect executed DPAs or standard contractual clauses for each vendor.\n3. Verify presence of security commitments and breach notification provisions.",
        "evidence_requirement": "Executed Data Processing Agreements (DPAs); sub-processor disclosures; CSOC evaluation review.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Vendor Management",
        "framework_ids": ["fw-soc2"]
    },

    # ==========================================
    # A1: Availability Criteria - 3 Criteria
    # ==========================================
    {
        "id": "TF-A1.1-01",
        "code": "A1.1",
        "title": "System Capacity Management & Availability Monitoring",
        "description": "Management monitors system capacity, processing performance, and infrastructure resource utilization to maintain system availability commitments.",
        "criterion_mapping": "A1.1: System Capacity Management and Availability Monitoring",
        "points_of_focus": [
            "Monitors system operational capacity and resource utilization.",
            "Implements automated auto-scaling and resource thresholds.",
            "Alerts on performance degradation before user impact occurs."
        ],
        "owner": "Site Reliability Engineering",
        "test_procedure": "1. Inspect monitoring dashboards for CPU, memory, and database connection utilization.\n2. Verify automated alert triggers for capacity thresholds (e.g. > 80% usage).\n3. Review historical capacity planning analysis.",
        "evidence_requirement": "Infrastructure monitoring dashboards; auto-scaling policy configuration; capacity alert history.",
        "type": "detective",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Availability",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-A1.2-01",
        "code": "A1.2",
        "title": "Automated Database Backups & Redundant Storage",
        "description": "Database backups are executed automatically on a scheduled daily cadence, encrypted with AES-256, and replicated across distinct geographic availability zones.",
        "criterion_mapping": "A1.2: Environmental Safeguards, Data Backup Execution, and Redundancy",
        "points_of_focus": [
            "Performs recurring automated data backups according to defined RPO schedules.",
            "Replicates backup archives to geographically diverse secondary locations.",
            "Protects backups against unauthorized modification and ransomware."
        ],
        "owner": "Infrastructure Engineering",
        "test_procedure": "1. Inspect automated backup schedules in cloud database consoles.\n2. Verify that backups execute daily and are retained according to policy (minimum 30 days).\n3. Confirm cross-region or multi-AZ replication of backup volumes.",
        "evidence_requirement": "Cloud backup snapshot configuration screenshot; backup completion log for observation period; cross-region replication proof.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "daily",
        "status": "implemented",
        "category": "Availability",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-A1.3-01",
        "code": "A1.3",
        "title": "Disaster Recovery Testing & Business Continuity Drill",
        "description": "tofrom maintains a Business Continuity and Disaster Recovery Plan (BC/DR) and conducts annual restoration drill testing to validate Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO).",
        "criterion_mapping": "A1.3: Disaster Recovery, Business Continuity, and Restoration Testing",
        "points_of_focus": [
            "Maintains documented disaster recovery and business continuity plans.",
            "Conducts annual data restoration drills from backup snapshots.",
            "Validates recovery time (RTO) and recovery point (RPO) metrics against commitments."
        ],
        "owner": "Site Reliability Engineering",
        "test_procedure": "1. Inspect the approved BC/DR Plan.\n2. Obtain documentation of the annual backup restoration drill conducted during the period.\n3. Verify achieved RTO and RPO metrics met contractual commitments.",
        "evidence_requirement": "Business Continuity and Disaster Recovery Plan; annual database restoration drill report; RTO/RPO verification results.",
        "type": "detective",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Availability",
        "framework_ids": ["fw-soc2"]
    },

    # ==========================================
    # C1: Confidentiality Criteria - 2 Criteria
    # ==========================================
    {
        "id": "TF-C1.1-01",
        "code": "C1.1",
        "title": "Data Classification & Confidential Information Identification",
        "description": "tofrom maintains a Data Classification Policy categorizing data (Public, Internal, Confidential, Restricted) and establishes handling rules for confidential customer records.",
        "criterion_mapping": "C1.1: Identification and Classification of Confidential Information",
        "points_of_focus": [
            "Identifies and categorizes confidential information upon creation or receipt.",
            "Establishes handling, access, and transmission guidelines by data tier.",
            "Communicates classification obligations to all workforce members."
        ],
        "owner": "Security Lead",
        "test_procedure": "1. Inspect the approved Data Classification and Retention Policy.\n2. Verify defined categories: Confidential, Internal, Public, and Restricted.\n3. Confirm workforce completed training on confidential data handling.",
        "evidence_requirement": "Approved Data Classification Policy; data classification handling guidelines; training curriculum slides.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Confidentiality",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-C1.2-01",
        "code": "C1.2",
        "title": "Secure Disposal of Confidential Data & Media Sanitization",
        "description": "Confidential customer data is purged upon request or contract termination, and storage media are sanitized in accordance with NIST SP 800-88 cryptographic erasure standards.",
        "criterion_mapping": "C1.2: Disposal and Cryptographic Destruction of Confidential Information",
        "points_of_focus": [
            "Disposes of confidential information in accordance with retention schedules.",
            "Sanitizes physical and virtual media prior to retirement or reassignment.",
            "Executes customer contractual data deletion requests upon contract termination."
        ],
        "owner": "Infrastructure Engineering",
        "test_procedure": "1. Inspect the media sanitization and data deletion procedure.\n2. Verify AWS subservice organization reliance for physical hardware decommissioning.\n3. Sample customer offboarding tickets to confirm database purge execution.",
        "evidence_requirement": "Media sanitization policy; AWS SOC 2 media destruction report; customer data deletion verification tickets.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Confidentiality",
        "framework_ids": ["fw-soc2"]
    },

    # ==========================================
    # PI1: Processing Integrity Criteria - 5 Criteria
    # ==========================================
    {
        "id": "TF-PI1.1-01",
        "code": "PI1.1",
        "title": "Processing Integrity Commitments & System Specifications",
        "description": "tofrom specifies processing integrity commitments, defining accurate, complete, and timely processing requirements across all platform services.",
        "criterion_mapping": "PI1.1: Specification of Processing Integrity Objectives",
        "points_of_focus": [
            "Defines system processing specifications and accuracy requirements.",
            "Identifies expected data inputs, processing logic, and expected system outputs.",
            "Communicates processing commitments in service level agreements."
        ],
        "owner": "Product Management",
        "test_procedure": "1. Inspect product documentation defining processing accuracy requirements.\n2. Verify system architecture documentation specifying data transformation logic.\n3. Confirm customer SLA terms regarding processing timeliness.",
        "evidence_requirement": "Product specification documentation; API data schema contracts; SLA terms in Customer MSA.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Processing Integrity",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-PI1.2-01",
        "code": "PI1.2",
        "title": "System Input Validation & Boundary Sanitation",
        "description": "All system inputs, API requests, and user submissions are validated for format, schema correctness, and sanitized against injection vulnerabilities prior to processing.",
        "criterion_mapping": "PI1.2: System Input Validation and Accuracy Verification",
        "points_of_focus": [
            "Validates data inputs against defined schemas and allowable boundaries.",
            "Rejects malformed or out-of-range transactions with actionable error codes.",
            "Prevents formula and code injection attacks on submitted data."
        ],
        "owner": "Engineering Leadership",
        "test_procedure": "1. Inspect API request validation middleware (e.g. Pydantic / TypeScript schemas).\n2. Test input validation endpoints with malformed payloads to verify HTTP 422 rejections.\n3. Inspect automated tests verifying input sanitation and anti-injection defenses.",
        "evidence_requirement": "Pydantic schema definitions; automated API input validation unit tests; WAF input filtering rule configurations.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Processing Integrity",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-PI1.3-01",
        "code": "PI1.3",
        "title": "Atomic Processing & Transaction Integrity",
        "description": "Data processing and state mutations execute within atomic transactions (ACID), ensuring that partially completed operations roll back automatically on failure.",
        "criterion_mapping": "PI1.3: Processing Completeness and Error Handling",
        "points_of_focus": [
            "Executes data mutations within atomic database transactions.",
            "Captures and alerts on processing exceptions and failed transactions.",
            "Maintains transaction consistency during concurrent operations."
        ],
        "owner": "Engineering Leadership",
        "test_procedure": "1. Inspect database transaction management code confirming BEGIN/COMMIT/ROLLBACK blocks.\n2. Review automated unit tests asserting atomic rollback on simulated database exceptions.\n3. Inspect application error monitoring for uncaught processing exceptions.",
        "evidence_requirement": "Database transaction management source code; automated rollback unit tests; Sentry / exception monitoring logs.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Processing Integrity",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-PI1.4-01",
        "code": "PI1.4",
        "title": "Output Reconciliation & Data Distribution Controls",
        "description": "Processed system outputs, exports, and generated compliance dossiers are reconciled against source records to verify completeness and authorized distribution.",
        "criterion_mapping": "PI1.4: System Output Validation and Distribution",
        "points_of_focus": [
            "Validates generated outputs against source database records.",
            "Restricts output distribution to authenticated and authorized recipients.",
            "Logs output generation events and export activity."
        ],
        "owner": "Engineering Leadership",
        "test_procedure": "1. Inspect audit package and CSV export routines confirming output validation logic.\n2. Verify access control checks preventing unauthorized users from accessing export endpoints.\n3. Inspect activity logs capturing output generation events.",
        "evidence_requirement": "Export generation source code; authorization checks; export event audit logs.",
        "type": "detective",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Processing Integrity",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-PI1.5-01",
        "code": "PI1.5",
        "title": "Data Storage Integrity & Change Audit Logs",
        "description": "Stored records and persistent databases enforce integrity constraints, foreign key validation, and record state change history for audit defensibility.",
        "criterion_mapping": "PI1.5: Data Storage Integrity and Transaction Logging",
        "points_of_focus": [
            "Enforces relational integrity constraints and foreign keys.",
            "Maintains audit trails recording user and system state modifications.",
            "Validates database storage integrity through automated PRAGMA checks."
        ],
        "owner": "Infrastructure Engineering",
        "test_procedure": "1. Inspect database schema definitions confirming PRAGMA foreign_keys = ON.\n2. Verify automated backup restoration tests running PRAGMA integrity_check.\n3. Review activity log recording state changes across compliance resources.",
        "evidence_requirement": "SQLite schema DDL with foreign key constraints; automated restore integrity check logs; immutable activity log records.",
        "type": "detective",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Processing Integrity",
        "framework_ids": ["fw-soc2"]
    },

    # ==========================================
    # P1–P8: Privacy Criteria - 18 Criteria
    # ==========================================
    {
        "id": "TF-P1.1-01",
        "code": "P1.1",
        "title": "Privacy Notice & Purpose Specification",
        "description": "tofrom publishes and maintains a comprehensive Privacy Notice detailing personal information collected, purpose of use, third-party disclosures, and subject rights.",
        "criterion_mapping": "P1.1: Notice of Privacy Practices",
        "points_of_focus": [
            "Provides clear and prominent notice of privacy practices to data subjects.",
            "Specifies the categories and purposes of personal information collected.",
            "Updates the notice when material changes occur in privacy practices."
        ],
        "owner": "Legal & Privacy Lead",
        "test_procedure": "1. Inspect the public Privacy Notice on the company website.\n2. Verify disclosure of personal data categories, processing purposes, and cookies.\n3. Confirm annual legal review of privacy notice.",
        "evidence_requirement": "Public Privacy Notice URL and timestamped PDF copy; annual legal review sign-off.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P2.1-01",
        "code": "P2.1",
        "title": "Consent Management & User Opt-In/Opt-Out",
        "description": "tofrom obtains explicit consent from data subjects for the collection and processing of personal information, providing accessible opt-out mechanisms.",
        "criterion_mapping": "P2.1: Choice and Consent Mechanisms",
        "points_of_focus": [
            "Obtains consent prior to collecting personal or sensitive information.",
            "Provides clear mechanisms for users to modify or withdraw consent.",
            "Respects opt-out preferences across automated communications."
        ],
        "owner": "Product & Legal",
        "test_procedure": "1. Inspect user sign-up and onboarding flows for explicit consent checkboxes.\n2. Verify marketing unsubscribe mechanisms in email headers.\n3. Test user consent preference update workflows.",
        "evidence_requirement": "User onboarding consent capture screenshot; email unsubscribe header configuration; consent audit logs.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P3.1-01",
        "code": "P3.1",
        "title": "Collection Limitation to Stated Purposes",
        "description": "Personal information collection is strictly limited to the specific, legitimate business purposes disclosed in the corporate Privacy Notice.",
        "criterion_mapping": "P3.1: Collection Limited to Identified Purposes",
        "points_of_focus": [
            "Limits personal information collection to defined business requirements.",
            "Avoids collecting unnecessary or excessive personal data.",
            "Reviews data intake forms to eliminate redundant fields."
        ],
        "owner": "Product & Engineering",
        "test_procedure": "1. Inspect user registration forms and API endpoints collecting personal data.\n2. Confirm that all collected fields correspond to specified operational purposes in the Privacy Notice.\n3. Verify absence of unnecessary sensitive personal data collection.",
        "evidence_requirement": "Data inventory register mapping collected fields to legal basis; registration form schema.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P3.2-01",
        "code": "P3.2",
        "title": "Lawful and Fair Collection Methods",
        "description": "Personal information is collected solely by lawful and fair means, without deception or unauthorized third-party scraping.",
        "criterion_mapping": "P3.2: Collection by Lawful and Fair Means",
        "points_of_focus": [
            "Collects personal information directly from the data subject where feasible.",
            "Verifies lawful basis for any data received from third-party partners.",
            "Ensures no covert or unauthorized tracking occurs."
        ],
        "owner": "Legal & Privacy Lead",
        "test_procedure": "1. Inspect data collection agreements and integrations.\n2. Verify lawful basis documented for all third-party data feeds.\n3. Confirm compliance with applicable privacy regulations (GDPR, CCPA).",
        "evidence_requirement": "Data sourcing agreements; privacy impact assessments (PIA); cookie consent banner configuration.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P4.1-01",
        "code": "P4.1",
        "title": "Use of Personal Data Limited to Authorized Scope",
        "description": "tofrom restricts internal use and processing of personal information to the purposes for which it was originally collected, prohibiting secondary use without consent.",
        "criterion_mapping": "P4.1: Use of Personal Information Limited to Specified Purposes",
        "points_of_focus": [
            "Enforces access controls restricting access to personal information to authorized roles.",
            "Prohibits unauthorized secondary use or sharing of customer personal data.",
            "Applies anonymization or pseudonymization where full identification is not required."
        ],
        "owner": "Engineering Leadership",
        "test_procedure": "1. Inspect database access control policies restricting access to PII tables.\n2. Confirm that production customer PII is not replicated into non-production environments.\n3. Review data masking rules for development and testing environments.",
        "evidence_requirement": "Database access policies; non-production data masking verification logs; privacy training records.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P4.2-01",
        "code": "P4.2",
        "title": "Data Retention Schedules & Automated Aging",
        "description": "Personal data is retained only as long as necessary to fulfill the stated business purpose or comply with statutory retention mandates, under documented retention schedules.",
        "criterion_mapping": "P4.2: Retention Policies and Schedules",
        "points_of_focus": [
            "Establishes retention schedules by personal data classification tier.",
            "Deletes or anonymizes personal data once retention periods expire.",
            "Suspends deletion routines for records subject to legal hold."
        ],
        "owner": "Legal & Engineering",
        "test_procedure": "1. Inspect the approved Data Retention Schedule.\n2. Verify automated database lifecycle rules or scheduled purge jobs.\n3. Test legal hold flag preventing deletion of scoped records.",
        "evidence_requirement": "Data Retention Schedule; automated purge cron/job configuration; legal hold policy document.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "monthly",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P4.3-01",
        "code": "P4.3",
        "title": "Secure Disposal of Personal Information",
        "description": "Expired personal information is permanently erased, cryptographically overwritten, or shredded to prevent unauthorized reconstruction.",
        "criterion_mapping": "P4.3: Secure Disposal and Destruction of Personal Information",
        "points_of_focus": [
            "Applies secure deletion algorithms ensuring data is unrecoverable.",
            "Maintains audit logs of data purge executions.",
            "Ensures backup archives age out according to retention windows."
        ],
        "owner": "Infrastructure Engineering",
        "test_procedure": "1. Inspect database hard-delete or cryptographic erasure procedures.\n2. Verify that deleted user records are removed from primary storage.\n3. Confirm that backup archives cycle and expire according to backup lifecycle rules.",
        "evidence_requirement": "Data purge script source code; execution logs showing deleted record IDs; AWS S3/RDS lifecycle rules.",
        "type": "corrective",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P5.1-01",
        "code": "P5.1",
        "title": "Data Subject Access Requests (DSAR)",
        "description": "tofrom provides accessible procedures for data subjects to request access to their personal information and verify the accuracy of stored records.",
        "criterion_mapping": "P5.1: Access Rights for Data Subjects",
        "points_of_focus": [
            "Provides accessible intake mechanisms for Data Subject Access Requests (DSAR).",
            "Authenticates the identity of requesting individuals before disclosing records.",
            "Fulfills access requests within statutory timeframes (30 days under GDPR/CCPA)."
        ],
        "owner": "Legal & Privacy Lead",
        "test_procedure": "1. Inspect DSAR intake workflow and privacy email contact.\n2. Review sample DSAR request tickets to verify identity authentication before data export.\n3. Confirm fulfillment within policy SLA (<= 30 days).",
        "evidence_requirement": "DSAR standard operating procedure; sample completed DSAR fulfillment tickets; identity verification logs.",
        "type": "detective",
        "nature": "manual",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P5.2-01",
        "code": "P5.2",
        "title": "Rectification and Inaccurate Data Correction",
        "description": "Data subjects are provided with self-service or assisted capabilities to rectify, update, or correct inaccurate personal information.",
        "criterion_mapping": "P5.2: Rectification and Update of Inaccurate Information",
        "points_of_focus": [
            "Allows users to correct inaccurate personal data through application profile settings.",
            "Processes manual rectification requests submitted via support.",
            "Propagates data corrections to downstream sub-processors where applicable."
        ],
        "owner": "Product Support & Engineering",
        "test_procedure": "1. Inspect user account profile editing functionality in the application.\n2. Verify that changes to personal details persist immediately across database records.\n3. Review support queue for manual correction requests.",
        "evidence_requirement": "Application profile edit interface screenshot; support tickets for data correction; database audit trail of profile updates.",
        "type": "corrective",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P6.1-01",
        "code": "P6.1",
        "title": "Authorized Third-Party Disclosures",
        "description": "Personal information is disclosed to third parties only with explicit authorization from data subjects or as required by law.",
        "criterion_mapping": "P6.1: Disclosure to Third Parties Authorized and Documented",
        "points_of_focus": [
            "Restricts third-party disclosures to authorized sub-processors.",
            "Ensures disclosures align with the public Privacy Notice.",
            "Maintains legal review for non-standard disclosure requests (e.g. subpoenas)."
        ],
        "owner": "Legal & Compliance",
        "test_procedure": "1. Inspect the approved Sub-processor List published to customers.\n2. Verify that all third parties receiving personal data are documented.\n3. Confirm legal team review process for external disclosure requests.",
        "evidence_requirement": "Public Sub-processor List; legal review workflow documentation; third-party data transfer assessments.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P6.2-01",
        "code": "P6.2",
        "title": "Records of Third-Party Disclosures",
        "description": "tofrom maintains an accurate inventory and record of all third-party sub-processors, categories of data shared, and processing locations.",
        "criterion_mapping": "P6.2: Records of Disclosures to Third Parties",
        "points_of_focus": [
            "Maintains an updated record of third-party sub-processors and data flows.",
            "Records categories of personal data transmitted to each vendor.",
            "Tracks international data transfers and transfer mechanisms (SCCs)."
        ],
        "owner": "Privacy Lead",
        "test_procedure": "1. Inspect the internal Record of Processing Activities (ROPA).\n2. Verify documentation of third-party recipients, countries of processing, and safeguards.\n3. Cross-reference vendor register with network egress destinations.",
        "evidence_requirement": "Record of Processing Activities (ROPA); vendor data flow diagrams; standard contractual clauses (SCCs).",
        "type": "detective",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P6.3-01",
        "code": "P6.3",
        "title": "Third-Party Privacy & Security Safeguards",
        "description": "Third parties receiving personal information are contractually bound to provide equivalent privacy protections and security safeguards.",
        "criterion_mapping": "P6.3: Provision of Personal Information With Required Protections",
        "points_of_focus": [
            "Executes DPAs requiring equivalent technical and organizational security measures.",
            "Prohibits third parties from utilizing personal data for unauthorized purposes.",
            "Requires prompt notification of security breaches affecting shared data."
        ],
        "owner": "Legal & Procurement",
        "test_procedure": "1. Sample executed Data Processing Agreements for active vendors.\n2. Confirm presence of clauses requiring encryption, breach notification <= 48 hours, and confidentiality.\n3. Verify vendor security compliance certifications.",
        "evidence_requirement": "Executed vendor DPAs; vendor SOC 2 / ISO 27001 certificates; vendor compliance review records.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P6.4-01",
        "code": "P6.4",
        "title": "Privacy Breach Notification & Incident Response",
        "description": "tofrom maintains procedures to detect, investigate, and notify affected data subjects and regulatory authorities of privacy breaches within statutory deadlines.",
        "criterion_mapping": "P6.4: Unauthorized Disclosure Notification and Breach Management",
        "points_of_focus": [
            "Maintains an incident response plan addressing personal data breaches.",
            "Notifies supervisory authorities within 72 hours where required by law.",
            "Communicates breach details and protective steps to affected data subjects promptly."
        ],
        "owner": "Legal & Security Lead",
        "test_procedure": "1. Inspect the Privacy Incident and Breach Notification Procedure.\n2. Verify defined escalation timelines meeting 72-hour regulatory notification rules.\n3. Review incident communication templates for customer notifications.",
        "evidence_requirement": "Privacy Breach Response Procedure; regulatory notification templates; tabletop breach drill report.",
        "type": "corrective",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P6.5-01",
        "code": "P6.5",
        "title": "Privacy Inquiries & Complaint Resolution",
        "description": "tofrom provides channels for data subjects to submit privacy-related complaints and maintains documented procedures for timely investigation and resolution.",
        "criterion_mapping": "P6.5: Data Subject Inquiry and Complaint Management",
        "points_of_focus": [
            "Designates a privacy contact (privacy@) for inquiries and complaints.",
            "Investigates complaints and takes appropriate corrective actions.",
            "Logs and tracks all privacy inquiries to documented resolution."
        ],
        "owner": "Legal & Privacy Lead",
        "test_procedure": "1. Verify active privacy email intake channel.\n2. Inspect the privacy complaint log and resolution workflow.\n3. Sample resolved complaints to confirm documented resolution within SLA.",
        "evidence_requirement": "Privacy complaint handling procedure; privacy intake inbox configuration; complaint resolution log.",
        "type": "detective",
        "nature": "manual",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P6.6-01",
        "code": "P6.6",
        "title": "Privacy Dispute Escalation & Independent Redress",
        "description": "tofrom provides external dispute resolution mechanisms and independent recourse for unresolved privacy complaints from data subjects.",
        "criterion_mapping": "P6.6: Third-Party Dispute Resolution and Reporting",
        "points_of_focus": [
            "Identifies independent dispute resolution providers (e.g. BBB, DPA oversight).",
            "Cooperates with supervisory authorities in resolving disputes.",
            "Informs data subjects of their right to lodge complaints with regulatory authorities."
        ],
        "owner": "Legal & Privacy Lead",
        "test_procedure": "1. Inspect dispute resolution clauses in published Privacy Notice.\n2. Confirm identification of competent supervisory authorities (e.g. state AG, EU DPA).\n3. Review dispute escalation guidelines.",
        "evidence_requirement": "Published dispute resolution terms; regulatory liaison contact information.",
        "type": "corrective",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P6.7-01",
        "code": "P6.7",
        "title": "Third-Party Data Transfer Assessment & Safeguards",
        "description": "tofrom evaluates and secures cross-border transfers and onward sharing of personal information, implementing Standard Contractual Clauses (SCCs) and data transfer impact assessments.",
        "criterion_mapping": "P6.7: Third-Party Transfer Safeguards and Onward Sharing Protections",
        "points_of_focus": [
            "Assesses legal and regulatory risks associated with cross-border data transfers.",
            "Implements Standard Contractual Clauses (SCCs) or adequacy mechanisms for onward sharing.",
            "Requires third parties to report any foreign government disclosure demands promptly."
        ],
        "owner": "Legal & Privacy Lead",
        "test_procedure": "1. Inspect transfer impact assessments (TIA) for international sub-processors.\n2. Verify executed Standard Contractual Clauses (SCCs) on file for overseas vendors.\n3. Confirm encryption of all personal data in transit during cross-border transfers.",
        "evidence_requirement": "Transfer Impact Assessments (TIA); executed Standard Contractual Clauses (SCCs); international vendor transfer register.",
        "type": "preventive",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P7.1-01",
        "code": "P7.1",
        "title": "Personal Data Quality & Accuracy Controls",
        "description": "Management implements controls to verify that personal information is accurate, complete, relevant, and kept up to date for the purposes for which it is processed.",
        "criterion_mapping": "P7.1: Quality and Accuracy of Personal Information Maintained",
        "points_of_focus": [
            "Implements validation controls to minimize data entry errors.",
            "Reconciles personal data across core platform databases.",
            "Provides self-service data verification for registered users."
        ],
        "owner": "Product & Engineering",
        "test_procedure": "1. Inspect data entry validation rules in user account settings.\n2. Verify automated email confirmation and verification workflows upon account creation.\n3. Review database consistency checks.",
        "evidence_requirement": "User registration email verification logs; input validation schemas; data quality verification tests.",
        "type": "preventive",
        "nature": "automated",
        "frequency": "continuous",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    },
    {
        "id": "TF-P8.1-01",
        "code": "P8.1",
        "title": "Privacy Program Monitoring & Annual Compliance Audit",
        "description": "tofrom monitors ongoing compliance with its privacy commitments, conducting periodic privacy assessments and internal evaluations against regulatory requirements.",
        "criterion_mapping": "P8.1: Ongoing Monitoring of Privacy Compliance",
        "points_of_focus": [
            "Conducts recurring assessments of privacy practices and controls.",
            "Assesses compliance of third-party sub-processors with privacy commitments.",
            "Reports privacy compliance metrics and findings to executive management."
        ],
        "owner": "Privacy Lead & CISO",
        "test_procedure": "1. Inspect the annual Privacy Impact Assessment (PIA) report.\n2. Verify executive review of privacy metrics and open DSAR counts.\n3. Confirm remediation of any privacy findings identified during the review.",
        "evidence_requirement": "Annual Privacy Impact Assessment report; executive compliance briefing slides; privacy audit checklist.",
        "type": "detective",
        "nature": "manual",
        "frequency": "annual",
        "status": "implemented",
        "category": "Privacy",
        "framework_ids": ["fw-soc2"]
    }
]

# Quick lookup by criterion code (e.g. 'CC6.1') or control ID ('TF-CC6.1-01')
TSC_CATALOG_BY_CODE = {c["code"]: c for c in TSC_CATALOG}
TSC_CATALOG_BY_ID = {c["id"]: c for c in TSC_CATALOG}
CRITERIA_COUNT = len(TSC_CATALOG)  # Exactly 61 criteria
