# TwoFrom GRC — Product Reference & Architecture

TwoFrom GRC is the internal, local-first SOC 2 Type II readiness platform for **TwoFrom**. Its target audit observation period begins on **2027-01-01**.

The platform is designed to provide an objective, audit-aligned operational workspace to track compliance controls, maintain governance policies, collect auditor-grade evidence, verify personnel security attestations, and run semantic policy-to-control compatibility evaluations via TypeSafe JEV System One.

---

## 1. Target Scope & Core Modules

| Module | Purpose | Operating Boundary |
|---|---|---|
| **Overview** | Executive posture dashboard displaying real-time readiness %, active risk matrix, task queue, evidence freshness, and control drift alerts. | Operational tracking for TwoFrom security team; not an external attestation. |
| **SOC 2 Readiness** | AICPA TSC criteria scorecard (CC1–CC9, Availability, Confidentiality), observation period countdown tracker (to 2027-01-01), per-control evidence status, and auditor PBC package export. | Readiness reflects recorded internal implementations. |
| **Blind Pilot** | Empirical validation gate before trusting automated AI mapping: stratified policy x control sampling, blind human grading queue, confusion matrix, token cost calculation, and 90%/95% GO/NO-GO gate. | Human ground truth validation layer. |
| **Policies & JEV** | Policy lifecycle (draft → review → published → archived), review SLAs, and semantic compatibility mapping using TypeSafe JEV System One (`jev-1.13.0`). | Real-time AI policy-to-control evaluation with rubric fallback; confidential keys encrypted at rest using Fernet. |
| **Evidence** | Secure evidence repository with SHA-256 integrity verification, expiration date tracking, and bidirectional control links. | Locally stored private evidence artifacts; sanitized uploads. |
| **Frameworks & Controls** | Authoritative SOC 2 controls library alongside reference frameworks (ISO 27001, NIST CSF 2.0, HIPAA, GDPR) with cross-framework mapping. | Authoritative mapping for internal scoping. |
| **People** | Personnel register, security awareness training completion, and workforce policy acceptance attestations. | Internal record of TwoFrom workforce compliance. |
| **Settings** | Workspace scoping (company name, criteria selection, observation start, auditor), JEV API configuration, and backup management. | Loopback administrative configuration. |

---

## 2. Removed Surfaces & De-Scoping Rationale

To focus strictly on internal SOC 2 Type II readiness and eliminate unnecessary exposure surfaces:
1. **Public Trust Center (`/api/trust`, `TrustCenterView.tsx`)**: Removed. TwoFrom GRC is an internal operational tool, not a public-facing trust marketing site.
2. **Security Questionnaires (`/api/questionnaires`, `QuestionnairesView.tsx`)**: Removed. Customer vendor assessment auto-fill is out of scope for internal readiness.
3. **Vendor SOC 2 Analyzer Modal (`VendorSoc2Modal.tsx`)**: Removed in favor of direct vendor review records.
4. **WebMCP Server (`server/webmcp_server.py`) & Client Agent Tools**: Removed. Remote agent actuation over compliance endpoints is disabled to minimize external exposure.
5. **Cloudflare Worker (`worker/`, `wrangler.jsonc`)**: Removed. TwoFrom GRC runs as an internal on-premises service without edge routing.
6. **Legacy Deployment Service (`deployment/harbor-grc.service`)**: Replaced by `deployment/twofrom-grc.service` and `docker-compose.yml`.

---

## 3. Decision Layer: TypeSafe JEV System One Integration

- **Model Pinning**: Pinned to frontier model `jev-1.13.0` across request payloads, `/api/jev/status`, and evaluation responses.
- **Judgment Primitives**: Operates on TypeSafe System One judgment primitives: `Choice`, `Score`, and `Noul`.
- **Live Decision Driving**: When TypeSafe System One responds, the live `Choice` answer directly drives the verdict (`compatible`, `gap`, `conflict`, `not_applicable`).
- **Honest Confidence vs. Heuristic**: Live decisions carry the real API confidence score (`confidence: float`). Offline rubric fallback results explicitly populate `heuristic_score: float` with `confidence: None`, clearly distinguishing model confidence from rule heuristics in the UI.
- **Decision Provenance Badging**: All evaluations surface `decided_by: "jev-live" | "rubric-fallback"` badges in the UI.

---

## 4. Key Security & Cryptography

- **At-Rest Symmetric Encryption**: Keys are encrypted at rest using Fernet (`cryptography.fernet.Fernet`), deriving from `JEV_KEY_ENCRYPTION_KEY` or a file-backed secret (`.encryption_key` with `0o600` permissions).
- **Zero Key Leaks**: All public endpoints (`/api/bootstrap`, `GET /api/workspace`, `GET /api/settings`, `PATCH /api/workspace`, `/api/jev/status`) sanitize the workspace and return only `api_key_configured: bool` and a 4-character masked preview (`...XXXX`). The plaintext key never reaches the browser.
- **Settings Replace Flow**: Keys cannot be prefilled in HTML form fields; administrators must initiate an explicit "Replace Key" flow to update credentials.
- **Server-Side Key Resolution**: The `POST /api/jev/evaluate` endpoint resolves stored keys server-side; client-provided keys are strictly ignored.

---

## 5. Blind Pilot Validation Gate

- **Stratified Sampling**: Draws a balanced sample of policy-by-control pairings across compliance domains (Logical Access, Systems Operations, Change Management, Risk, HR).
- **Blind Enforcement**: JEV model verdicts are strictly concealed from the reviewer until all grades are submitted and results are explicitly revealed. Late human grading after reveal is rejected with HTTP 400.
- **4x4 Confusion Matrix**: Computes human vs. JEV classifications across `compatible`, `gap`, `conflict`, and `not_applicable`.
- **Inference Cost Tracking**: Tracks token usage at standard frontier pricing ($0.042 per million input tokens).
- **The Gate Threshold**:
  - Requires overall agreement $\ge 90.0\%$.
  - Requires high-confidence agreement ($\ge 0.80$ calls) $\ge 95.0\%$.
  - Gate verdict: `GO` (qualified for production) or `NO-GO` with itemized failure reasons.

---

## 6. Observation Period Operations & Drift Control

- **Observation Tracker**: Live countdown to the **2027-01-01** observation window start date surfaced prominently on the SOC 2 Readiness view.
- **Per-Control Evidence Status**: Surfaces artifact currency (`current`, `expired`, `missing`) per compliance control.
- **Control Drift Engine**: Continuous monitoring sweeps detect control deviations:
  - Stale governance policies (unreviewed for $> 12$ months).
  - Quarterly user access reviews with pending determinations.
  - Expired evidence attachments and overdue remediation tasks.
  - Generates real-time `drift_alerts` on executive dashboards.
- **Auditor PBC Package Staging & Export**: Pre-stages all 21 AICPA Provided By Client (`PBC-01` to `PBC-21`) requests and generates a one-click auditor export ZIP (`TwoFrom_SOC2_PBC_Package.zip`) containing manifest metadata, status reports, and structured evidence artifacts.

---

## 7. Evidence Vault Hardening & Retention Standards (R2)

- **Mandatory Provenance Fields**:
  - `captured_at`: ISO-8601, tz-aware UTC timestamp of artifact capture.
  - `captured_by`: Named authenticated identity (e.g. workspace security lead), never anonymous.
  - `source_system`: Originating system (e.g. `manual-upload`, `aws-config`, `okta`, `github`).
  - `collection_method`: `manual` | `automated`.
  - `period_covered`: `{start, end}` date interval required for SOC 2 Type II operating effectiveness evidence.
  - `retention_rule`: Baseline retention classification (default `soc2-7yr`).
  - `legal_hold`: Boolean flag. When `true`, blocks deletion attempts with HTTP 409 Conflict.
  - `version`: Integer sequence (starts at 1).
  - `supersedes_id`: Reference linking to the prior version in the lineage.
  - `integrity_status`: `verified` | `failed` | `unchecked`.
- **Immutable Versioning**:
  - Re-uploading evidence for an artifact creates a new record with `version = previous.version + 1` and `supersedes_id = previous.id`.
  - Prior/superseded versions become strictly read-only; attempts to mutate historical metadata return HTTP 409 Conflict.
  - Deletion of non-head versions is rejected with HTTP 409 Conflict to maintain complete audit chain continuity.
  - Full version chain is inspectable via `GET /api/evidence/{id}/versions`.
- **Cryptographic Integrity & Tamper Guards**:
  - Bytes are hashed server-side at stream capture using SHA-256.
  - `POST /api/evidence/{id}/verify` recomputes the SHA-256 hash of on-disk bytes, compares against stored checksum, and logs verification status.
  - Download guard: `GET /api/evidence/{id}/file` recomputes the file hash prior to streaming; if tampered, the service refuses to serve the file and returns HTTP 500.
- **Observation Window Coverage & Gap Surfacing**:
  - `GET /api/evidence/coverage?control_id=<id>&window_start=2027-01-01&window_end=<date>` unions covered date intervals across linked evidence and surfaces explicit uncovered day gaps.
  - Gaps are transparently identified, never concealed.
- **Retention Rules & Open Verification Notice**:
  - Default evidence retention: `soc2-7yr`. Security logs: $\ge 90$ days hot, $\ge 1$ year cold.
  - **Open Verification Notice**: *Pending CPA-firm confirmation (open verification item). The AICPA sets no fixed universal retention duration for SOC 2 Type II audit documentation. Specific retention rules must be confirmed with the engaged CPA firm prior to executing automated purge workflows.*

---

## 8. Tamper-Evident Audit Log (R3)

- **Append-Only Cryptographic Ledger**:
  - Every state mutation records: `seq`, `id`, `actor`, `action`, `resource`, `record_id`, `title`, `before`, `after`, `created_at`, `prev_hash`, `entry_hash`.
  - Canonical serialization: `json.dumps(..., sort_keys=True, separators=(',', ':'))` prevents formatting ambiguities.
  - Linked hash chain: Each entry incorporates the SHA-256 `entry_hash` of the prior sequence number, forming an unbroken chain rooted at `GENESIS`.
- **Dual-Layer Immutability**:
  - **Database Layer**: SQLite triggers `audit_log_no_update` and `audit_log_no_delete` abort any direct SQL `UPDATE` or `DELETE` attempt (`RAISE(ABORT)`).
  - **Application Layer**: All business mutations route strictly through `append_audit_log()`.
- **Integrity Verification**:
  - `GET /api/audit/verify` re-computes the full hash chain from seq 1 to head, immediately isolating any single-byte alteration, record omission, or sequence swap (`broken_at_seq`).
- **Retention & Export Standards**:
  - Audit trail retention: $\ge 1$ year minimum.
  - Formats: Immutable point-in-time export available via `GET /api/audit/export?format=csv` (with formula injection neutralization) and `GET /api/audit/export?format=json`.
  - **Open Verification Notice**: *Pending CPA-firm confirmation (open verification item). Confirm retention schedules with the engagement team before establishing automated purge procedures.*

---

## 9. Deployment & Operations

### Single-Server Systemd Deployment
Install the user-level systemd unit:
```bash
mkdir -p ~/.config/systemd/user ~/.config/twofrom-grc
cp deployment/twofrom-grc.service ~/.config/systemd/user/
echo "TYPESAFE_API_KEY=apikey_..." > ~/.config/twofrom-grc/twofrom.env
chmod 600 ~/.config/twofrom-grc/twofrom.env
systemctl --user daemon-reload
systemctl --user enable --now twofrom-grc
```

### Docker Compose Deployment
```bash
docker compose up -d --build
```

### Backup & Offline Restore
Backups are generated via `GET /api/backup` and restored using `scripts/restore.py`:
```bash
python scripts/restore.py backups/backup.zip /path/to/new_data_dir
```
Target directory must be a clean, nonexistent path; the utility performs full SQLite integrity checks prior to activation.
