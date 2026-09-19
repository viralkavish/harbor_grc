"""Honest integrations catalog reflecting local architecture.

Manual CSV and local file uploads are marked 'available'.
Cloud and third-party SaaS connectors (Google Workspace, AWS, GitHub, Slack) are
truthfully listed as 'not_configured' or 'not_implemented'.
No fake live connectors or deceptive status indicators.
"""
from fastapi import APIRouter


INTEGRATIONS_CATALOG = [
    {
        "id": "int-local-csv",
        "title": "Local CSV Import & Export",
        "status": "available",
        "description": "Standard comma-separated value import and export for controls, vendors, risks, tasks, people, and assets with formula-injection defense.",
        "capabilities": ["Bulk record import", "Transactional rollbacks", "Spreadsheet export"]
    },
    {
        "id": "int-file-uploads",
        "title": "Evidence Attachment Storage",
        "status": "available",
        "description": "Direct local filesystem storage for audit evidence, audit packages, policy exports, and signed attestations with SHA-256 integrity verification.",
        "capabilities": ["SHA-256 verification", "Streamed 25MB uploads", "Air-gapped local storage"]
    },
    {
        "id": "int-google-workspace",
        "title": "Google Workspace",
        "status": "not_implemented",
        "description": "Enterprise directory sync, automated user onboarding/offboarding tracking, and Google Drive policy distribution. (Planned connector; not active in local runtime).",
        "capabilities": ["Personnel directory sync", "Google Drive export", "Account lifecycle tracking"]
    },
    {
        "id": "int-aws",
        "title": "Amazon Web Services (AWS)",
        "status": "not_implemented",
        "description": "Cloud security posture monitoring, automated S3 bucket encryption auditing, and IAM credential hygiene verification. (No cloud telemetry in local build).",
        "capabilities": ["S3 encryption checks", "IAM MFA auditing", "KMS key rotation checks"]
    },
    {
        "id": "int-github",
        "title": "GitHub",
        "status": "not_implemented",
        "description": "Source code repository branch protection auditing, mandatory pull request review verification, and Dependabot vulnerability alerts. (Not connected).",
        "capabilities": ["Branch protection auditing", "PR review verification", "Dependency alerting"]
    },
    {
        "id": "int-slack",
        "title": "Slack",
        "status": "not_implemented",
        "description": "Periodic compliance review alerts, employee policy acknowledgment notifications, and incident response notifications. (No external webhook dispatch).",
        "capabilities": ["Review reminders", "Policy acknowledgment bots", "Task alerts"]
    },
    {
        "id": "int-okta",
        "title": "Okta Identity Cloud",
        "status": "not_implemented",
        "description": "Identity provider user synchronization, group membership auditing, and automated access review campaign feeds. (Not connected).",
        "capabilities": ["SSO provisioning", "MFA enforcement checks", "Group membership audit"]
    },
    {
        "id": "int-jira",
        "title": "Atlassian Jira",
        "status": "not_implemented",
        "description": "Bi-directional task synchronization for security remediation tickets, risk treatments, and vulnerability triage. (Not connected).",
        "capabilities": ["Task sync", "Issue tracker linking", "Remediation workflows"]
    }
]


def integrations_router():
    router = APIRouter(prefix='/api/integrations')

    @router.get('')
    def list_integrations():
        return {'items': INTEGRATIONS_CATALOG, 'total': len(INTEGRATIONS_CATALOG)}

    return router
