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
