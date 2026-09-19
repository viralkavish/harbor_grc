"""AICPA SOC 2 Section 3 System Description builder.

Pre-structured according to AICPA Trust Services Criteria guidelines for SOC 2 Type I and Type II examinations.
Enables drafting, reviewing, auto-populating components from the local GRC workspace, and exporting auditor dossiers.
"""
from datetime import date
import io
import json
import re
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Response
from .storage import Store, now
from .records import log


DEFAULT_SECTIONS = [
    {
        "id": "sec_overview",
        "title": "1. Overview of Organization and Services",
        "description": "General description of the company, service offerings, and target customer base.",
        "content": """## 1. Overview of Organization and Services

**Organization Name**: {{organization_name}}

### 1.1 Company Background
{{organization_name}} provides modern, reliable software solutions designed to meet customer business requirements with high standards of security, confidentiality, and availability.

### 1.2 Description of Services
The principal service provided is a secure, scalable software platform accessible to authorized client personnel. The architecture is engineered to ensure data isolation, authenticated access, and continuous service resilience."""
    },
    {
        "id": "sec_commitments",
        "title": "2. Principal Service Commitments and System Requirements",
        "description": "Customer contractual commitments and security requirements (Security, Availability, Confidentiality).",
        "content": """## 2. Principal Service Commitments and System Requirements

{{organization_name}} designs its service commitments and system requirements in accordance with the AICPA Trust Services Criteria for Security, Availability, and Confidentiality.

### 2.1 Commitments to Customers
- **Confidentiality**: Customer data is protected from unauthorized access or disclosure through encryption at rest and in transit.
- **Availability**: Infrastructure is engineered with redundant cloud services to maintain target uptime SLAs.
- **Security**: Access to systems is restricted through multi-factor authentication, least-privilege role boundaries, and continuous monitoring.

### 2.2 System Requirements
System operational requirements are codified in organizational policies, security baselines, and standard operating procedures."""
    },
    {
        "id": "sec_infrastructure",
        "title": "3. System Infrastructure and Hosting",
        "description": "Cloud hosting environments, network boundaries, and physical security reliance.",
        "content": """## 3. System Infrastructure and Hosting

### 3.1 Cloud Environment
The system is hosted in Tier 3/4 commercial cloud infrastructure (e.g., Amazon Web Services / Google Cloud Platform). Cloud environments are logically segregated into production, staging, and development environments.

### 3.2 Network Architecture
- Production networks utilize private Virtual Private Clouds (VPCs) with strict Security Group ingress/egress filtering.
- Public internet traffic is terminated at load balancers with TLS 1.2+ encryption enforced.
- Direct database access is blocked from public subnets."""
    },
    {
        "id": "sec_software",
        "title": "4. Software Architecture and Application Services",
        "description": "Application software stack, APIs, deployment pipelines, and configuration management.",
        "content": """## 4. Software Architecture and Application Services

### 4.1 Application Stack
The application services comprise modular microservices and modern web frontends running containerized workloads with automated health probes and horizontal autoscaling.

### 4.2 Change Management and Deployment Pipeline
- Source code is managed in private Git repositories with mandatory branch protection.
- All code changes require at least one approving peer code review and passing automated CI test suites prior to merge.
- Deployments follow automated staging-to-production deployment pipelines with rollback capabilities."""
    },
    {
        "id": "sec_people",
        "title": "5. People and Organizational Roles",
        "description": "Organizational governance hierarchy, security oversight, and workforce responsibilities.",
        "content": """## 5. People and Organizational Roles

### 5.1 Organizational Structure
Executive management sets the tone at the top, delegating day-to-day security operations to {{ciso_title}}.

### 5.2 Workforce Governance
- All candidates undergo pre-employment background screening prior to hire.
- Employees must review and sign acceptable use policies upon onboarding and annually.
- Mandatory annual security awareness and privacy training is enforced for 100% of staff."""
    },
    {
        "id": "sec_data",
        "title": "6. Data Classification and Data Flows",
        "description": "Data classification tiers, encryption standards, transmission pathways, and retention rules.",
        "content": """## 6. Data Classification and Data Flows

### 6.1 Data Classification
Information is categorized into four tiers: Public, Internal, Confidential, and Restricted (PII/ePHI).

### 6.2 Encryption Baselines
- **In Transit**: Encrypted using modern TLS 1.2 or TLS 1.3 with strong cipher suites.
- **At Rest**: Encrypted using AES-256 via managed KMS encryption keys."""
    },
    {
        "id": "sec_procedures",
        "title": "7. Operational Procedures and Control Activities",
        "description": "Incident response, vulnerability management, access reviews, and backups.",
        "content": """## 7. Operational Procedures and Control Activities

### 7.1 Access Reviews
Quarterly access reviews are conducted across all production systems and administrative accounts.

### 7.2 Vulnerability Management
Continuous vulnerability scans inspect container images and dependencies. Critical vulnerabilities are remediated within 7 calendar days.

### 7.3 Backups and Disaster Recovery
Automated daily snapshots are taken across production databases and stored across multiple geographic availability zones. Annual disaster recovery simulations verify restoration integrity."""
    },
    {
        "id": "sec_subservice",
        "title": "8. Subservice Organizations (Third-Party Vendors)",
        "description": "Reliance on cloud infrastructure providers and third-party SaaS vendors.",
        "content": """## 8. Subservice Organizations (Third-Party Vendors)

{{organization_name}} utilizes subservice organizations for specific operational functions:
- **Cloud Infrastructure (e.g. AWS / GCP)**: Physical security, data center environmental controls, and underlying hardware virtualization.
- **Identity Provider (e.g. Google Workspace / Okta)**: Directory synchronization and multi-factor authentication services.

Management reviews the SOC 2 Type II or ISO 27001 reports of all critical subservice organizations annually."""
    },
    {
        "id": "sec_cuecs",
        "title": "9. Complementary User Entity Controls (CUECs)",
        "description": "Controls that customer organizations are expected to implement on their side.",
        "content": """## 9. Complementary User Entity Controls (CUECs)

The system is designed with the assumption that customer user entities implement specific internal controls:
1. Customers are responsible for managing and deprovisioning their authorized user accounts.
2. Customers are responsible for configuring strong passwords and enforcing MFA for their own administrative users.
3. Customers must immediately notify {{organization_name}} of any suspected account compromise or credential leakage."""
    },
    {
        "id": "sec_incidents",
        "title": "10. Incident History and Material Changes",
        "description": "Disclosure of significant security incidents or architectural changes during the period.",
        "content": """## 10. Incident History and Material Changes

During the audit observation period:
- No material security breaches or unauthorized customer data exposures occurred.
- Any minor operational events were addressed in compliance with documented Incident Response SLAs."""
    }
]


def system_description_router(store):
    router = APIRouter(prefix='/api/system_description')

    @router.get('')
    def get_system_description():
        with store.transaction() as db:
            row = db.execute("SELECT value FROM settings WHERE key='system_description'").fetchone()
            if row:
                return json.loads(row[0])

            # Initialize with default AICPA sections and workspace substitutions
            ws = Store.workspace(db)
            subs = {
                "organization_name": ws.get('organization') or ws.get('name') or "Our Organization",
                "ciso_title": ws.get('owner') or "Chief Information Security Officer (CISO)"
            }
            sections = []
            for s in DEFAULT_SECTIONS:
                c = s["content"]
                for k, v in subs.items():
                    c = c.replace(f"{{{{{k}}}}}", v)
                sections.append({**s, "content": c})

            doc = {
                "title": f"AICPA SOC 2 System Description — {ws.get('organization') or ws.get('name')}",
                "version": 1,
                "status": "draft",
                "updated_at": now(),
                "sections": sections
            }
            db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('system_description', ?)", (json.dumps(doc),))
            return doc

    @router.patch('')
    def update_system_description(payload: dict):
        with store.transaction() as db:
            current_row = db.execute("SELECT value FROM settings WHERE key='system_description'").fetchone()
            doc = json.loads(current_row[0]) if current_row else {"title": "AICPA System Description", "version": 1, "sections": DEFAULT_SECTIONS}

            if 'title' in payload:
                doc['title'] = str(payload['title'])[:240]
            if 'status' in payload:
                doc['status'] = str(payload['status'])
            if 'sections' in payload and isinstance(payload['sections'], list):
                doc['sections'] = payload['sections']

            doc['updated_at'] = now()
            doc['version'] = doc.get('version', 1) + 1
            db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('system_description', ?)", (json.dumps(doc),))
            log(db, 'update_system_description', 'system_description', {'title': doc['title']}, {'version': doc['version']})
            return doc

    @router.post('/auto_populate')
    def auto_populate_components():
        """Auto-populates System Infrastructure and Subservice Organizations from current Assets & Vendors."""
        with store.transaction() as db:
            ws = Store.workspace(db)
            assets = Store.records(db, 'assets')
            vendors = Store.records(db, 'vendors')

            doc_row = db.execute("SELECT value FROM settings WHERE key='system_description'").fetchone()
            doc = json.loads(doc_row[0]) if doc_row else get_system_description()

            # Build hardware/software asset list
            asset_lines = [f"- **{a['title']}** ({a.get('category', 'Asset')}): {a.get('system', 'System')} · Encryption: {'Yes' if a.get('encrypted') else 'N/A'}" for a in assets]
            vendor_lines = [f"- **{v['title']}** (Tier: {v.get('tier', 'Medium')}): {v.get('category', 'Vendor')} · Data Access: {v.get('data_access', 'None')}" for v in vendors]

            for s in doc.get('sections', []):
                if s['id'] == 'sec_infrastructure' and asset_lines:
                    s['content'] += "\n\n### Current System Components (Inventory)\n" + "\n".join(asset_lines)
                elif s['id'] == 'sec_subservice' and vendor_lines:
                    s['content'] += "\n\n### Evaluated Subservice Organizations\n" + "\n".join(vendor_lines)

            doc['updated_at'] = now()
            doc['version'] = doc.get('version', 1) + 1
            db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('system_description', ?)", (json.dumps(doc),))
            log(db, 'auto_populate_system_description', 'system_description', {'title': doc['title']})
            return doc

    @router.get('/export')
    def export_system_description():
        with store.transaction() as db:
            doc_row = db.execute("SELECT value FROM settings WHERE key='system_description'").fetchone()
            doc = json.loads(doc_row[0]) if doc_row else get_system_description()

            full_md = [
                f"# {doc.get('title', 'AICPA SOC 2 System Description')}",
                f"**Version**: {doc.get('version', 1)} | **Status**: {doc.get('status', 'draft').capitalize()} | **Generated**: {now()[:10]}\n",
                "---\n"
            ]
            for s in doc.get('sections', []):
                full_md.append(s.get('content', ''))
                full_md.append("\n---\n")

            content = "\n".join(full_md)
            return Response(
                content=content,
                media_type='text/markdown',
                headers={
                    'Content-Disposition': 'attachment; filename="AICPA_SOC2_SYSTEM_DESCRIPTION.md"',
                    'X-Content-Type-Options': 'nosniff'
                }
            )

    return router
