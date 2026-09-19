# Harbor GRC

A local-first governance, risk and compliance workspace for controls, policies, evidence, vendors, risks, audit preparation and everyday security-program work.

**Independent software, not Vanta.** The public product reference and explicit capability gaps are in [docs/PRODUCT_REFERENCE.md](docs/PRODUCT_REFERENCE.md). Starter policies and framework mappings need review for your organization. Nothing in the app constitutes legal advice, certification, or an assurance opinion.

## Run locally

This installation lives at `/home/viral/projects/harbor-grc`. The production address is **http://127.0.0.1:8765**.

```bash
cd /home/viral/projects/harbor-grc
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -r requirements.txt
npm --prefix client ci
npm --prefix client run build
.venv/bin/python -m server
```

The server binds to loopback, not your network interfaces. No root permissions are required. No Google, Vanta or cloud-provider account is required to use the local modules. Runtime assets are local; there are no analytics beacons or remote font requirements.

For an already installed background service:

```bash
systemctl --user status harbor-grc
systemctl --user restart harbor-grc
systemctl --user stop harbor-grc
systemctl --user start harbor-grc
journalctl --user -u harbor-grc -n 50 --no-pager
```

The supplied unit is `deployment/harbor-grc.service`. It uses this installation's absolute paths. Change those paths if moving the project. The service is intended to run as your normal OS user, with private new-file permissions and automatic restart on failure.

## Start your program

1. Open **Settings** and set your workspace name, organization and owner.
2. Review the **Frameworks** and starter **Controls**; tailor scope, ownership and implementation notes. Mark out-of-scope controls not applicable.
3. Edit **Policies**, fill organization-specific placeholders, and publish only after review.
4. Upload real **Evidence**, set expiration dates, and link it to the relevant controls.
5. Add your **Vendors**, record assessment notes and risk scores, and set review dates.
6. Use **Risks** and **Tasks** to assign treatment and remediation work.
7. Create an **Audit** and linked evidence requests; export an audit package when ready.
8. Use **Monitoring** to check the completeness and currency of your local records. It is not connected-cloud monitoring.

Other workspaces include personnel, assets, access reviews, questionnaires, exceptions, local trust-center preparation and an activity log. Personnel acknowledgments and access decisions are owner-recorded; they do not identify/sign on behalf of other people or execute revocation in remote systems.

## Data and privacy

- Database: `data/harbor.db` (SQLite).
- Evidence attachments: `data/uploads/`.
- Override location: `HARBOR_DATA_DIR=/absolute/path`.
- Port override for development: `PORT=8765` (production default).
- Single-user local trust boundary. There is no enterprise multi-user authentication, SSO or role system.
- Host/origin checks and same-site session/CSRF protection reduce browser-origin attacks. They do **not** prevent access by another local process/user with access to this computer.
- The application does not encrypt the database or backup archives itself. Protect your OS account, disk, and backup destinations. Do not expose it through a public reverse proxy or tunnel.
- Original starter guidance is deliberately not recorded as implemented controls, approved evidence, or completed audits.

## Backup and restore

Use **Settings → Download backup** to download a snapshot ZIP containing the SQLite database, uploaded evidence, and a format manifest. Store it privately: the archive can contain sensitive documents and is not encrypted.

Restore only into a **new** directory:

```bash
systemctl --user stop harbor-grc
cd /home/viral/projects/harbor-grc
.venv/bin/python scripts/restore.py /absolute/path/to/backup.zip --target /home/viral/projects/harbor-grc/restored-data
HARBOR_DATA_DIR=/home/viral/projects/harbor-grc/restored-data .venv/bin/python -m server
```

Inspect restored records before switching the service to that directory. Keep the old `data/` directory until you have verified the restored copy. To make the change permanent, set the service's `HARBOR_DATA_DIR` to the restored directory, reload user units, and restart. The restore tool refuses existing targets, unsafe archive paths, symbolic links, duplicate members, unsupported manifests and invalid SQLite databases. Its uncompressed archive limit is 512 MiB; use a reviewed larger-scale backup process if your evidence repository grows past it.

## Development and verification

```bash
.venv/bin/python -m pytest tests/backend tests/ops -q
npm --prefix client test -- --run
npm --prefix client run build
```

Backend integration tests use temporary SQLite databases. Operational restore tests use synthetic archives in temporary directories. Browser acceptance should run against a separate `HARBOR_DATA_DIR`, never your real program data.

The client dev server can proxy `/api` to the production-port backend. Production is a built static client served from the same FastAPI origin. API writes use the CSRF token returned by `/api/bootstrap`.

## Not implemented as Vanta parity

Proprietary agentic AI, full licensed compliance libraries, cloud account connectors, automatic SaaS/device evidence collection, live vendor threat feeds, real-time identity provisioning, email delivery, external auditor accounts, enterprise authentication and a publicly hosted trust center are outside this local build. Unimplemented connector entries are informational, not connected services. Policy-based questionnaire suggestions are deterministic and must be reviewed.
