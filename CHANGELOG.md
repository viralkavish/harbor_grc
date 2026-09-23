# Harbor GRC Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## Versioning Rules & Governance

Every commit and push to `viralkavish/harbor_grc` MUST increment the version and record a changelog entry:
1. **MAJOR (`X.0.0`)**: Incompatible API breaks, database schema restructuring requiring manual migration, or core architectural replacement.
2. **MINOR (`0.X.0`)**: Backwards-compatible new features, new views, external integrations (e.g. JEV Engine), new API routers, or significant UI additions.
3. **PATCH (`0.0.X`)**: Backwards-compatible bug fixes, styling tweaks, minor performance optimizations, or rubric updates.

All version increments must be kept synchronized across:
- `client/src/version.ts` (`APP_VERSION`, `RELEASE_DATE`, `CHANGELOG`)
- `CHANGELOG.md`
- `client/package.json` (`version`)
- `server/app.py` (`FastAPI(version=...)` and `/api/health`)
- `worker/index.ts` (`/api/health`)
- `tests/backend/test_core.py` (health test assertion)

---

## [0.20.0] - 2026-09-23

### Added
- **Policy Version History, Executive PDF View & DNI 2025 Controls Library**
- Added immutable version tracking capturing who made changes and why (change_reason) on every policy revision
- Added executive formatted policy view and print-ready PDF export with formal governance letterhead and signature block
- Built dedicated Controls Library view (ControlsView.tsx) with manual control creation and DNI 2025 vintage support
- Added bulk CSV import for DNI 2025 report controls in Controls Library and Onboarding Step 3

---

## [0.19.1] - 2026-09-23

### Fixed
- **Fix: Onboarding Step 3 Policy Upload & JEV Evaluation**
- Added missing /jev/upload_and_evaluate endpoint to edge worker
- Migrated OnboardingWizard and JevPolicyModal to use ApiClient with automatic CSRF token and session handling
- Fixed 404 API not found error on policy document uploads

---

## [0.19.0] - 2026-09-23

### Added
- **R10: Full RBAC, Argon2 User Authentication & Least Privilege**
- Argon2id password hashing and 5-attempt/15-minute brute-force lockout policy
- Real staff identity lifecycle with Admin, Compliance Manager, Control Owner, and Viewer roles
- Default-deny permission matrix enforcement across all staff endpoints (loopback bypass retired)
- Segregation of duties enforcement bound to real authenticated user identities
- Admin user provisioning and role management UI in SettingsView
- Dedicated LoginView and single-use setup token bootstrap wizard

---

## [0.18.0] - 2026-09-23

### Added
- **R9: Observation-Window Coverage Dashboard & Gap Register**
- SOC 2 Type II observation-window configuration with audit-scoped change confirmation
- Continuous multi-source evidence interval computation engine with interval gap detection
- Multi-source degradation: open R5 monitoring exceptions and stale R6 policy acceptances
- 61-criteria TSC rollup (Security, Availability, Confidentiality, Processing Integrity, Privacy)
- Tamper-evident Gap Register with remediation, segregation of duties acceptance, and explicit closure
- One-click 'What Would the Auditor See' Coverage Dossier export (JSON and CSV) bundled into R4 workpaper ZIP

---

## [0.17.0] - 2026-09-23

### Added
- **R8: Risk Register Hardening, 5x5 Heatmap & Assessment Minutes**
- Created dedicated risks table (/api/risks) with server-side inherent and residual scoring
- Implemented interactive 5x5 likelihood and impact risk matrix heatmap (/api/risks/matrix)
- Enforced R1 control linkage and blocked closure of unmitigated risks (HTTP 422)
- Added Segregation of Duties on risk acceptance with required expiration dates and automated re-opening
- Built review cadence engine with immutable append-only review history and review SLA tracking
- Generated formal Executive Risk Assessment Minutes (PBC GV.1 deliverable) with workpaper exports

---

## [0.16.0] - 2026-09-23

### Added
- **R7: Sampling-Engine Upgrade, Seeded Reproducibility & Zero Fabricated Attributes**
- Built persistent samples table (/api/sampling) with mandatory AU-C 530 completeness statements
- Implemented seeded simple random, systematic interval, and judgmental sampling with per-item rationales
- Guaranteed byte-identical reproducibility on re-runs and added verification endpoint (/api/sampling/:id/verify)
- Eliminated all hardcoded verification claims across sampling and population generators
- Linked sample audit metadata to R4 auditor testing-support view and integrated universal R3 audit logging
- Upgraded SOC 2 Readiness Population Sampling workbench with interactive verification badges and history

---

## [0.15.0] - 2026-09-23

### Added
- **R5: Continuous Monitoring, Scheduler, Transparency & Exceptions Lifecycle**
- Added persisted monitoring_runs table with M3 auditor-grade transparency fields
- Implemented daily scheduled monitoring sweep mechanism with health status reporting
- Built comprehensive exceptions lifecycle (open -> acknowledged -> remediated -> closed) with automatic creation and deduplication
- Remapped all continuous checks to authoritative R1 TSC-2017-2022 catalog control IDs
- Centralized universal R3 append-only hash-chained audit logging across monitoring runs and exception workflows
- Upgraded MonitoringView UI with checks transparency details, exceptions workbench, run history, and scheduler controls

---

## [0.14.0] - 2026-09-23

### Added
- **R6: Policy Management Hardening, Segregation of Duties & Acceptance Currency**
- Enforced Segregation of Duties (SoD) with author vs approver identity validation (HTTP 422 on self-approval)
- Added immutable version restore mechanism creating new draft versions from historical snapshots
- Exposed first-class latest approved versions (GET /policies/:id/approved and version_at) for audit observation accuracy
- Implemented annual review enforcement (GET /api/policies/review_due) resetting review SLA to +365 days on approval
- Built workforce acceptance currency engine tracking current vs stale vs missing signatures per approved version
- Migrated all policy mutations to R3 tamper-evident append_audit_log with actor and before/after captures

---

## [0.13.0] - 2026-09-23

### Added
- **R4: Auditor Portal, Engagement Scoping, RFI & Workpapers**
- Engagement lifecycle management (/api/engagements) with SHA-256 hashed bearer tokens and observation window gating
- Auditor identity model with default-deny write protection (403 on staff mutations, explicit RFI/PBC allowlist)
- Full RFI communication workflow with auditable message threads and evidence attachments
- 21-item Provided By Client (PBC) lifecycle with staff staging and auditor acceptance determinations
- Testing support view enforcing AU-C 500 entity independence, workpaper ZIP exports, and immutable pre-audit snapshots
- Dedicated standalone Auditor Portal UI (AuditorPortalView.tsx) with in-memory token authentication

---

## [0.12.0] - 2026-09-23

### Added
- **R3: Tamper-Evident Hash-Chained Audit Log**
- Append-only cryptographic audit log with SHA-256 hash chaining (prev_hash, entry_hash) rooted at GENESIS
- Database-level immutability enforced via SQLite triggers (audit_log_no_update, audit_log_no_delete)
- Cryptographic chain verification endpoint (/api/audit/verify) detecting single-byte tampering or order discontinuity
- Centralized mutation logging across all operations with actor attribution and before/after state snapshots
- Upgraded Activity Log view with live chain status, before/after diff inspector, and CSV/JSON export

---

## [0.11.0] - 2026-09-23

### Added
- **R2: Evidence Vault Hardening, Provenance & Observation Coverage**
- Mandatory provenance fields on evidence artifacts: captured_at, captured_by, source_system, collection_method, period_covered, retention_rule, legal_hold
- Immutable evidence versioning (supersedes_id, v1 -> v2 chain), prior version mutation lockout (409 Conflict), and lineage traversal (/versions)
- Cryptographic SHA-256 integrity verification: on-demand (/verify), scheduled (/verify_all), and download tamper guard (500 on mismatch)
- Observation-window coverage API (/api/evidence/coverage) with automated interval unions and explicit gap detection
- Strict legal hold protection blocking deletion (409 Conflict), period_covered requirement for collected evidence, and expiring alerts

---

## [0.10.0] - 2026-09-23

### Added
- **R1: Versioned TSC-2017-2022 Control Catalog & Immutable Versioning**
- Authoritative 61-criteria Trust Services Criteria catalog (CC1.1-CC9.2, A1.1-A1.3, C1.1-C1.2, PI1.1-PI1.5, P1.1-P8.1)
- Immutable control definition versioning table (control_versions) with auditor observation window inspection
- Auditor-style test procedures, 2022 revised points of focus, and evidence requirements across all 61 criteria
- Catalog metadata endpoint (/api/controls/catalog_meta) and historical version endpoints (/api/controls/:id/versions)
- Enhanced UI displaying catalog vintage badge, control specifications, and audit observation window version history

---

## [0.9.1] - 2026-09-23

### Fixed
- **Brand identity alignment: tofromGRC**
- Rebrand brand mark and headers to tofromGRC across all interfaces
- Standardize workspace company identity to tofrom

---

## [0.9.0] - 2026-09-23

### Added
- **TwoFrom SOC 2 Type II Core, Blind Pilot & Live Jev Integration**
- Empirical Blind Pilot Module with 4x4 Confusion Matrix and 90/95% Gate
- Live TypeSafe JEV System One (jev-1.13.0) Choice Decisions & Fernet Key Encryption at Rest
- First-Run Onboarding Wizard with DNI Policy Authorization Confirmation
- Observation Period Tracker Countdown to 2027-01-01 & Per-Control Evidence Proof Status
- Control Drift Monitoring Sweeps & One-Click Auditor PBC Package Export ZIP

---

## [0.8.0] - 2026-09-22

### Added
- **Complete 24 WebMCP Agent Tools & Edge Security Isolation**
- Comprehensive 24-Tool WebMCP Suite: Registered full control tools covering navigation, CRUD, continuous checks, roadmap, SOC 2 readiness, sampling, auditor hub, and JEV.
- Strict Edge Security Isolation: Enforced session authentication on all /api/* tool execution endpoints preventing unauthenticated access or mutation.
- Path Traversal & Resource Guard: Restricted collection names to allowlisted resources and blocked path traversal characters.
- Automated Credential Redaction: Integrated recursive secret masking on all agent responses to prevent accidental token or credential exposure.

---

## [0.7.1] - 2026-09-22

### Fixed
- **Visual Agent Tools Symbol, Status Indicator, and Master Toggle**
- Visual Agent Tools Status Symbol: Added dedicated topbar and sidebar badge displaying active/disabled symbol with luminous green/gray indicators.
- Master Control Toggle: Integrated in-page master toggle allowing operators to instantly enable or disable WebMCP agent actuation.
- Real-Time Actuation Signals: Connected pulse indicators that animate when an AI agent is actively executing actions on the page.

---

## [0.7.0] - 2026-09-22

### Added
- **WebMCP Standard Agent Control Suite & In-Page Inspector**
- WebMCP W3C/Chrome Standard Runtime: Integrated document.modelContext and window.modelContext registering 11 full-capability tools for AI agents.
- In-Page Agent Steering: AI agents can directly actuate views, list/create/update records, run continuous tests, and trigger JEV evaluations via WebMCP.
- WebMCP Inspector & Interactive Console: Visual inspector modal with live tool discovery, JSON test execution, and real-time actuation log.
- Dual Protocol Endpoints: Deployed standard discovery manifests (/.well-known/web-mcp, /.well-known/mcp.json) and JSON-RPC 2.0 endpoint (/api/mcp).

---

## [0.6.1] - 2026-09-21

### Fixed
- **Fix Frameworks Route Parity on Edge & Client Resiliency**
- Edge Worker Route Parity: Added /api/frameworks/harmonization and advanced feature routes to Cloudflare Worker, preventing 404 'Record not found' errors.
- Client Network Resiliency: Updated FrameworksView with Promise.allSettled to ensure framework registers remain accessible even under partial network degradation.
- Route Safety Boundary: Restricted generic resource pattern matching to recognized resource collections only.

---

## [0.6.0] - 2026-09-21

### Added
- **Astra Dark Theme UI/UX Redesign & AppShell Architecture**
- Astra Dark Theme System: Unified dark-mode aesthetic across all 23 views with semantic CSS tokens, high-contrast typography, and dark cards.
- AppShell & Accessible Navigation: Built responsive AppShell with sectioned sidebar, mobile drawer with focus trap, and breadcrumb header.
- Command Palette Overhaul: Fast instant page-jump matching combined with debounced backend record search and full ARIA combobox accessibility.
- Action-Oriented Overview: Re-engineered operational dashboard with priority gap queue, interactive metrics, and calibrated risk matrix.
- Deployment Template Hardening: Isolated service environment credentials into private secrets file, verified by automated test gate.

---

## [0.5.0] - 2026-09-21

### Added
- **Live TypeSafe JEV System One Integration & Engine Upgrade**
- Live TypeSafe Cloud Integration: Connected live TypeSafe JEV System One (jev-1.13.0) API key via https://api.typesafe.ai/v1/systemone.
- Frontier Probabilistic Judgments: Augmented policy-to-control compatibility scoring with typed choice and noul primitives with verified confidence scores.
- Live Benchmarking & Token Metrics: Integrated live latency benchmarking, token usage tracking, and persistent workspace key management.
- Telegram Desktop Omarchy Integration: Installed and configured standalone Telegram Desktop with desktop entry and icon integration.

---

## [0.4.0] - 2026-09-21

### Added
- **Top 10 Advanced Vanta & SOC 2 Enterprise Features Suite**
- Automated Test Remediation Engine: Copy-pasteable CLI and Terraform fix snippets for failing continuous controls tests.
- AI Vendor SOC 2 & CUEC Extractor: Automated examination analysis extracting Complementary User Entity Controls (CUECs) and supply chain risk tiering.
- Auditor Autopilot Workspace: Pre-staged 21-item AICPA PBC checklist with in-line review, status toggles, and auditor notes.
- Cross-Framework Harmonization Matrix: Multi-framework overlap engine mapping SOC 2 across ISO 27001, NIST CSF 2.0, HIPAA, and GDPR.
- Policy-Grounded Security Questionnaire AI Auto-Fill: Instant prospect assessment answering with verified policy citations and 95%+ confidence.
- Quarterly User Access Review (UAR) Campaign Engine: Automated certification campaigns with keep/revoke tracking and digital audit hashes.
- Vulnerability Management & CVSS Patch SLA Tracker: Real-time countdown timers for Critical (7d), High (30d), and Medium (60d) CVEs.
- ISO 42001 & EU AI Act Governance Register: Enterprise AI model catalog tracking Zero Data Retention (ZDR) and risk classifications.
- Workforce Compliance Posture: Direct verification of device full-disk encryption and automated training certificate generation.
- Real-Time Trust Center Telemetry: Live continuous testing metrics and verified compliance badges for public customer assurance.

---

## [0.3.0] - 2026-09-21

### Added
- **Production SOC 2 Roadmap & Live Trajectory Verification Engine**
- Automated Live Posture Verification: Evaluates real database evidence against 18 strategic SOC 2 milestones.
- Comprehensive 6-Phase Startup Trajectory: Enriched with AICPA Trust Services Criteria, auditor PBC deliverables, and recommended startup tooling.
- SOC 2 Type II Observation Window Tracker: Monitors active observation windows (3/6/12 months) and drift-free days.
- Audit Roadmap Export: One-click exportable executive audit plan and PBC checklist.

---

## [0.2.0] - 2026-09-21

### Added
- **JEV Policy-to-Control Matcher**: High-speed System One semantic evaluation engine (`server/jev_evaluator.py`) evaluating policy documents against 24 SOC 2, ISO 27001, HIPAA, GDPR, and NIST CSF controls in sub-30ms.
- **TypeSafe JEV Configuration in Settings**: Dedicated Settings panel to configure, test, and validate JEV API keys with live latency benchmarking (`POST /api/jev/test_key`) and SQLite persistence.
- **Interactive In-App Changelog**: In-app modal (`ChangelogModal.tsx`) and persistent build version badge in the sidebar footer and top navigation bar.
- **One-Click Control Linking**: Direct bidirectional linking of JEV-verified compatible controls to policy records.

### Changed
- **Astra Cosmic Dark Interface**: Switched primary styling tokens to deep obsidian palette (`#090d16`), cobalt accent (`#2563eb`), and glassmorphism cards.
- **Information Disclosure Prevention**: Redesigned Cloudflare Worker unauthenticated landing gateway to sanitize admin emails, eliminate brand giveaways, and consolidate Google SSO into a single official GIS container.

### Fixed
- Added missing GET routes for `/api/workspace` and `/api/settings` with unified `/api/settings` PATCH support.
- Added `/api/monitoring/checks` alias to resolve client check polling.
- Added `/api/soc2/pbc_requests` and `/api/soc2/sampling` aliases with normalized payload objects.

---

## [0.1.0] - 2026-09-20

### Added
- **Core GRC Architecture**: Fully local SQLite repository with 13 compliance collections (Frameworks, Controls, Evidence, Policies, Vendors, Risks, Audits, Tasks, People, Assets, Access Reviews, Questionnaires, Exceptions).
- **SOC 2 Type 1 & 2 Readiness Engine**: Automated gap analysis, AICPA criteria scoring, and auditor PBC list generator.
- **Section 3 System Description Generator**: AICPA DC 2018 aligned automated system description builder.
- **Continuous Controls Testing**: 8 automated test routines verifying MFA, encryption, review cadences, and evidence freshness.
- **Public Trust Center**: Shareable trust portal with NDA-gated access requests and compliance badges.
- **Backup & Restore Engine**: Byte-for-byte portable ZIP snapshot export and verified offline restore tool with formula injection defense.
