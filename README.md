# TwoFrom GRC

Internal SOC 2 Type II readiness platform for **TwoFrom**. Target audit observation window begins on **2027-01-01**.

Integrates live TypeSafe JEV System One semantic policy-to-control compatibility checking (`jev-1.13.0`), empirical blind pilot validation gates, continuous control drift monitoring, and auditor PBC package exports.

---

## Cold-Start Setup

```bash
cd /home/viral/projects/twofrom-grc

# 1. Setup Python 3.11 virtual environment
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -r requirements.txt

# 2. Build React client bundle
npm --prefix client ci
npm --prefix client run build

# 3. Boot application
.venv/bin/python -m server
```
Access the application at **http://127.0.0.1:8765**.

---

## Core Operations Workflow

1. **First-Run Onboarding Wizard**:
   - Step 1: Validate TypeSafe JEV API key against model `jev-1.13.0`.
   - Step 2: Establish TwoFrom SOC 2 Type II scope and 2027-01-01 observation window.
   - Step 3: Upload governance policies and catalog production infrastructure.
   - Step 4: Confirm written authorization for DNI-sourced policies.
2. **Blind Pilot Validation Gate (`#pilot`)**:
   - Run empirical validation on TwoFrom policies before trusting automated AI mapping.
   - Grade sample pairs blindly; check 4x4 confusion matrix and verify GO/NO-GO gate (requires $\ge 90\%$ overall and $\ge 95\%$ high-confidence agreement).
3. **Observation Window Tracking (`#soc2_readiness`)**:
   - Monitor real-time countdown to 2027-01-01.
   - Track per-control evidence currency (`current`, `expired`, `missing`).
   - Stage deliverables across AICPA requests PBC-01 through PBC-21.
   - Export auditor ZIP package (`TwoFrom_SOC2_PBC_Package.zip`).
4. **Control Drift Monitoring (`#overview`)**:
   - Real-time alerts for stale policies ($>12$ months), overdue quarterly access reviews, and expiring evidence attachments.

---

## Deployment & Systemd Service

For persistent background operation:

```bash
mkdir -p ~/.config/systemd/user ~/.config/twofrom-grc
cp deployment/twofrom-grc.service ~/.config/systemd/user/
echo "TYPESAFE_API_KEY=apikey_..." > ~/.config/twofrom-grc/twofrom.env
chmod 600 ~/.config/twofrom-grc/twofrom.env

systemctl --user daemon-reload
systemctl --user enable --now twofrom-grc
systemctl --user status twofrom-grc
```

Docker deployment:
```bash
docker compose up -d --build
```

---

## Testing & Quality Gates

Run full test suites:
```bash
# Backend pytest suite (65 tests)
.venv/bin/python -m pytest tests/

# Frontend vitest suite (12 tests)
npm --prefix client test -- --run

# Client build validation
npm --prefix client run build
```

---

## Backup & Disaster Recovery

Create a snapshot backup:
```bash
curl -X GET http://127.0.0.1:8765/api/backup -o backup.zip
```

Restore into a clean directory:
```bash
python scripts/restore.py backup.zip /path/to/new_data_dir
```
The utility runs full SQLite PRAGMA integrity verification before activation.
