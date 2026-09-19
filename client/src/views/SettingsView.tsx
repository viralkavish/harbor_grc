import { useEffect, useState, useRef } from 'react';
import { Settings as SettingsIcon, Download, Upload, Database, Shield, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Loading, ErrorState, Note } from '../components/ui';
import type { Workspace, Notify, Navigate } from '../lib/types';

const IMPORTABLE_RESOURCES = [
  { id: 'controls', label: 'Controls' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'risks', label: 'Risks' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'people', label: 'People' },
  { id: 'assets', label: 'Assets' }
];

export function SettingsView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingWs, setSavingWs] = useState(false);

  // Form states for workspace
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [owner, setOwner] = useState('');
  const [description, setDescription] = useState('');
  const [trustTitle, setTrustTitle] = useState('');
  const [trustDesc, setTrustDesc] = useState('');

  // CSV Import states
  const [importResource, setImportResource] = useState('controls');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bootstrap');
      const ws = res.workspace;
      setWorkspace(ws);
      setName(ws.name || '');
      setOrganization(ws.organization || '');
      setOwner(ws.owner || '');
      setDescription(ws.description || '');
      setTrustTitle(ws.trust_title || '');
      setTrustDesc(ws.trust_description || '');
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWs(true);
    try {
      const updated = await api.patch('/workspace', {
        name,
        organization,
        owner,
        description,
        trust_title: trustTitle,
        trust_description: trustDesc
      });
      setWorkspace(updated);
      notify('Workspace settings saved');
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSavingWs(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    setImportError('');
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('dry_run', dryRun ? 'true' : 'false');

      const res = await api.post(`/import/${importResource}`, formData);
      setImportResult(res);
      if (dryRun) {
        notify(`Dry run passed: ${res.preview?.length || 0} valid record(s) verified`);
      } else {
        notify(`Successfully imported ${res.imported} ${importResource} records`);
        setImportFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setImportError(err.message);
      notify('Import validation failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  if (loading && !workspace) return <Loading label="Loading workspace configuration…" />;

  return (
    <div>
      <PageHeader
        eyebrow="CONFIGURE"
        title="Workspace Settings & Portability"
        description="Organization profiles, bulk CSV import/export with formula injection defense, and full SQLite system backups."
      />

      {/* Workspace Profile Form */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--ink)' }}>
          Organization & Workspace Profile
        </h3>
        <form onSubmit={handleSaveWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="field-grid">
            <div className="field">
              <span>Workspace Name *</span>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field">
              <span>Legal Organization Name</span>
              <input type="text" value={organization} onChange={e => setOrganization(e.target.value)} placeholder="e.g. Acme Technologies Inc." />
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <span>Compliance Program Owner</span>
              <input type="text" value={owner} onChange={e => setOwner(e.target.value)} placeholder="e.g. security@acme.com" />
            </div>
            <div className="field">
              <span>Public Trust Center Title</span>
              <input type="text" value={trustTitle} onChange={e => setTrustTitle(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <span>Executive Program Description</span>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="High-level description of your compliance program..." />
          </div>

          <div className="field">
            <span>Trust Center Disclosure Summary</span>
            <textarea rows={2} value={trustDesc} onChange={e => setTrustDesc(e.target.value)} placeholder="Summary shown to prospects and customers reviewing your security portal..." />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="button button-primary" disabled={savingWs}>
              {savingWs ? 'Saving Changes…' : 'Save Workspace'}
            </button>
          </div>
        </form>
      </div>

      {/* CSV Bulk Import & Export */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Bulk CSV Import & Export</h3>
            <p className="card-description">
              Safely import or export compliance registers. All exports include spreadsheet formula-injection defense.
            </p>
          </div>
        </div>

        <form onSubmit={handleImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="field-grid">
            <div className="field">
              <span>Select Target Resource</span>
              <select value={importResource} onChange={e => setImportResource(e.target.value)}>
                {IMPORTABLE_RESOURCES.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="field" style={{ justifyContent: 'center' }}>
              <span>Export Current Data</span>
              <div>
                <a href={`/api/export/${importResource}`} className="button" download>
                  <Download size={14} /> Download {importResource}.csv Template / Export
                </a>
              </div>
            </div>
          </div>

          <div className="field">
            <span>Select CSV File to Import</span>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={e => setImportFile(e.target.files?.[0] || null)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="dryRunToggle"
              checked={dryRun}
              onChange={e => setDryRun(e.target.checked)}
            />
            <label htmlFor="dryRunToggle" style={{ fontSize: '13px', cursor: 'pointer' }}>
              <strong>Dry run verification only</strong> (validates syntax, schema, and reference links without writing to database)
            </label>
          </div>

          {importError && (
            <div className="note" style={{ background: 'var(--danger-light)', borderColor: '#feb2b2', color: 'var(--danger)' }}>
              <AlertCircle size={16} />
              <div>{importError}</div>
            </div>
          )}

          {importResult && (
            <div className="note" style={{ background: 'var(--accent-light)', borderColor: '#b2dfdb', color: 'var(--accent)' }}>
              <Check size={16} />
              <div>
                {dryRun ? (
                  <span>
                    ✓ Dry run successful! Verified {importResult.preview?.length || 0} valid {importResource} rows. Uncheck dry run to commit.
                  </span>
                ) : (
                  <span>
                    ✓ Successfully imported {importResult.imported} {importResource} record(s).
                  </span>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="submit"
              className="button button-primary"
              disabled={importing || !importFile}
            >
              {importing ? 'Processing…' : dryRun ? 'Run Validation Dry Run' : 'Execute Import & Commit'}
            </button>
          </div>
        </form>
      </div>

      {/* System Backup & Offline Recovery */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Full Workspace Snapshot Backup</h3>
            <p className="card-description">
              Generate a byte-for-byte portable ZIP archive containing your SQLite database, uploaded evidence files, and manifest.
            </p>
          </div>
          <a href="/api/backup" className="button button-primary" download>
            <Download size={14} /> Download System Backup (.zip)
          </a>
        </div>

        <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px', fontSize: '13px', lineHeight: 1.6 }}>
          <strong>Offline Restore Instructions:</strong>
          <p style={{ marginTop: '4px', color: 'var(--muted)' }}>
            To restore your program on this machine or migrate to another server, stop the service and use the verified offline restore utility:
          </p>
          <pre className="mono" style={{ background: 'white', border: '1px solid var(--border)', padding: '10px', borderRadius: '4px', marginTop: '8px', fontSize: '12px', overflowX: 'auto' }}>
            systemctl --user stop harbor-grc{'\n'}
            .venv/bin/python scripts/restore.py /path/to/harbor-backup.zip --target /path/to/restored-data{'\n'}
            HARBOR_DATA_DIR=/path/to/restored-data .venv/bin/python -m server
          </pre>
          <small style={{ color: 'var(--muted)', display: 'block', marginTop: '8px' }}>
            The restore tool verifies SQLite integrity checks, prevents path traversal, and ensures old production data is never overwritten.
          </small>
        </div>
      </div>
    </div>
  );
}
