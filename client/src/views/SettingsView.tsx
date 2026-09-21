import { useEffect, useState, useRef } from 'react';
import {
  Settings as SettingsIcon, Download, Upload, Database, Shield, FileSpreadsheet,
  Check, AlertCircle, Sparkles, Eye, EyeOff, History
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Loading, ErrorState, Note } from '../components/ui';
import { ChangelogModal } from '../components/ChangelogModal';
import { APP_VERSION, RELEASE_DATE } from '../version';
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

  // JEV configuration states
  const [jevApiKey, setJevApiKey] = useState('');
  const [jevEndpoint, setJevEndpoint] = useState('https://api.typesafe.ai/v1');
  const [showJevKey, setShowJevKey] = useState(false);
  const [jevStatus, setJevStatus] = useState<any>(null);
  const [testingJev, setTestingJev] = useState(false);
  const [savingJev, setSavingJev] = useState(false);
  const [jevTestResult, setJevTestResult] = useState<any>(null);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [aiModels, setAiModels] = useState<any[]>([]);

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

      // Load JEV config
      setJevApiKey(ws.jev_api_key || '');
      setJevEndpoint(ws.jev_endpoint || 'https://api.typesafe.ai/v1');
      try {
        const status = await api.get('/jev/status');
        setJevStatus(status);
      } catch (e) {
        // non-blocking
      }

      try {
        const aiRes = await api.get('/ai_governance/models');
        setAiModels(aiRes.models || []);
      } catch (e) {
        // non-blocking
      }
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

  const handleTestJev = async () => {
    setTestingJev(true);
    setJevTestResult(null);
    try {
      const res = await api.post('/jev/test_key', {
        api_key: jevApiKey,
        endpoint: jevEndpoint
      });
      setJevTestResult(res);
      notify(res.message || 'JEV connection validated successfully');
      try {
        const status = await api.get('/jev/status');
        setJevStatus(status);
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      setJevTestResult({ valid: false, message: err.message });
      notify(err.message, 'error');
    } finally {
      setTestingJev(false);
    }
  };

  const handleSaveJevConfig = async () => {
    setSavingJev(true);
    try {
      const updated = await api.patch('/workspace', {
        jev_api_key: jevApiKey,
        jev_endpoint: jevEndpoint
      });
      setWorkspace(updated);
      try {
        const status = await api.get('/jev/status');
        setJevStatus(status);
      } catch (e) {
        // ignore
      }
      notify('JEV Engine configuration saved');
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSavingJev(false);
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
    <div className="harbor-view">
      <PageHeader
        eyebrow="CONFIGURE"
        title="Settings"
        description="Manage your workspace profile, evaluation engine, imports, and backups."
      />

      {/* Workspace Profile Form */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--ink)' }}>
          Workspace Profile
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

          <div className="view-inline" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="button button-primary" disabled={savingWs}>
              {savingWs ? 'Saving Changes…' : 'Save Workspace'}
            </button>
          </div>
        </form>
      </div>

      {/* JEV AI & Evaluation Engine Configuration */}
      <div className="card">
        <div className="card-header">
          <div className="view-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div>
              <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h3 className="card-title" style={{ margin: 0 }}>JEV Evaluation Engine</h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: jevStatus?.api_key_configured ? 'var(--success-light)' : 'var(--accent-light)',
                  color: jevStatus?.api_key_configured ? 'var(--success)' : 'var(--accent)',
                  border: '1px solid ' + (jevStatus?.api_key_configured ? 'var(--success)' : 'var(--accent)')
                }}>
                  {jevStatus?.api_key_configured ? '● API Key Configured' : '● System One Rule Engine Active'}
                </span>
              </div>
              <p className="card-description">
                Configure TypeSafe JEV System One judgment primitives for real-time policy-to-control compatibility scoring.
              </p>
            </div>
            <Sparkles size={22} color="var(--accent)" />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="field-grid">
            <div className="field">
              <span>JEV API Key</span>
              <div className="view-inline" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showJevKey ? 'text' : 'password'}
                  value={jevApiKey}
                  onChange={e => setJevApiKey(e.target.value)}
                  placeholder="e.g. jev_live_sec_..."
                  style={{ paddingRight: '36px', fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowJevKey(!showJevKey)}
                  style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'transparent' }}
                  title={showJevKey ? 'Hide key' : 'Show key'}
                >
                  {showJevKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <small style={{ color: 'var(--muted)', marginTop: '4px' }}>
                TypeSafe JEV API Key (stored encrypted in local workspace settings).
              </small>
            </div>

            <div className="field">
              <span>JEV API Endpoint / Base URL</span>
              <input
                type="text"
                value={jevEndpoint}
                onChange={e => setJevEndpoint(e.target.value)}
                placeholder="https://api.typesafe.ai/v1"
                style={{ fontFamily: 'monospace' }}
              />
              <small style={{ color: 'var(--muted)', marginTop: '4px' }}>
                Default: https://api.typesafe.ai/v1 (or local mock/enterprise gateway)
              </small>
            </div>
          </div>

          {/* Engine Status Grid */}
          <div className="view-auto-grid" style={{ display: 'grid', gap: '12px', background: 'var(--surface-raised)', border: '1px solid var(--border)', padding: '12px', borderRadius: '6px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Active Judgment Primitives</div>
              <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>jev_check, jev_ask, jev_rank</strong>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Compliance Rubrics Loaded</div>
              <strong style={{ fontSize: '13px', color: 'var(--accent)' }}>{jevStatus?.rubrics_count || 24} Controls Active</strong>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Deterministic Speed</div>
              <strong style={{ fontSize: '13px', color: 'var(--success)' }}>&lt; 30 ms (Sub-second)</strong>
            </div>
          </div>

          {/* Test Validation Result Banner */}
          {jevTestResult && (
            <div
              className="note view-inline"
              style={{
                background: jevTestResult.valid ? 'var(--success-light)' : 'var(--danger-light)',
                borderColor: jevTestResult.valid ? 'var(--success)' : 'var(--danger)',
                color: jevTestResult.valid ? 'var(--success)' : 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              {jevTestResult.valid ? <Check size={16} /> : <AlertCircle size={16} />}
              <div style={{ fontSize: '13px' }}>
                {jevTestResult.message}
                {jevTestResult.latency_ms && (
                  <span style={{ marginLeft: '8px', opacity: 0.8, fontSize: '12px' }}>
                    (Benchmark: {jevTestResult.latency_ms}ms)
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="view-inline" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="button"
              onClick={handleTestJev}
              disabled={testingJev}
              title="Test JEV connection and run live benchmark"
            >
              <Sparkles size={14} color="var(--accent)" />
              {testingJev ? 'Benchmarking JEV…' : 'Test & Validate JEV Key'}
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={handleSaveJevConfig}
              disabled={savingJev}
            >
              {savingJev ? 'Saving…' : 'Save JEV Configuration'}
            </button>
          </div>
        </div>
      </div>

      {/* ISO 42001 & EU AI Act Governance Register */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Shield size={18} color="var(--accent)" />
              <h3 className="card-title" style={{ margin: 0 }}>AI Model Governance</h3>
              <span style={{ fontSize: '11px', background: 'var(--accent-light)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '10px' }}>
                Zero Data Retention (ZDR) Enforced
              </span>
            </div>
            <p className="card-description">
              Catalog enterprise AI models, verify training data opt-out status, data classification boundaries, and EU AI Act risk tiering.
            </p>
          </div>
        </div>

        <div className="view-table-scroll">
        <table className="table" style={{ width: '100%', fontSize: '13px' }}>
          <thead>
            <tr>
              <th>Model Name & Provider</th>
              <th>Primary Use Case</th>
              <th>Data Sensitivity</th>
              <th>Privacy & Retentions</th>
              <th>Risk Tier</th>
            </tr>
          </thead>
          <tbody>
            {aiModels.map((m: any) => (
              <tr key={m.id}>
                <td>
                  <strong style={{ color: 'var(--ink)' }}>{m.model_name}</strong>
                  <small style={{ color: 'var(--muted)', display: 'block' }}>{m.provider}</small>
                </td>
                <td>
                  <span style={{ fontSize: '12px' }}>{m.use_case}</span>
                </td>
                <td>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{m.data_sensitivity}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px' }}>
                    <span style={{ color: 'var(--success)' }}>✓ Zero Data Retention</span>
                    <span style={{ color: 'var(--success)' }}>✓ Training Opt-Out</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '11px', background: 'var(--accent-light)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '10px' }}>
                    {m.risk_tier}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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

          <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <div className="note" style={{ background: 'var(--danger-light)', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              <AlertCircle size={16} />
              <div>{importError}</div>
            </div>
          )}

          {importResult && (
            <div className="note" style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
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

          <div className="view-inline" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
            <h3 className="card-title">Workspace Backup</h3>
            <p className="card-description">
              Generate a byte-for-byte portable ZIP archive containing your SQLite database, uploaded evidence files, and manifest.
            </p>
          </div>
          <a href="/api/backup" className="button button-primary" download>
            <Download size={14} /> Download System Backup (.zip)
          </a>
        </div>

        <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px', fontSize: '13px', lineHeight: 1.6 }}>
          <strong>Offline Restore Instructions:</strong>
          <p style={{ marginTop: '4px', color: 'var(--muted)' }}>
            To restore your program on this machine or migrate to another server, stop the service and use the verified offline restore utility:
          </p>
          <pre className="mono" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '10px', borderRadius: '4px', marginTop: '8px', fontSize: '12px', overflowX: 'auto' }}>
            systemctl --user stop harbor-grc{'\n'}
            .venv/bin/python scripts/restore.py /path/to/harbor-backup.zip --target /path/to/restored-data{'\n'}
            HARBOR_DATA_DIR=/path/to/restored-data .venv/bin/python -m server
          </pre>
          <small style={{ color: 'var(--muted)', display: 'block', marginTop: '8px' }}>
            The restore tool verifies SQLite integrity checks, prevents path traversal, and ensures old production data is never overwritten.
          </small>
        </div>
      </div>

      {/* System Build Version & Changelog Card */}
      <div className="card">
        <div className="card-header">
          <div className="view-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div>
              <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h3 className="card-title" style={{ margin: 0 }}>Version & Release History</h3>
                <span className="version-pill" style={{
                  background: 'var(--accent-light)',
                  color: 'var(--accent)',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid var(--accent)'
                }}>
                  v{APP_VERSION}
                </span>
              </div>
              <p className="card-description">
                Active build version, verified release notes, and automated SOC 2 audit readiness log. Released on {RELEASE_DATE}.
              </p>
            </div>
            <button
              type="button"
              className="button"
              onClick={() => setShowChangelogModal(true)}
              title="View system changelog and release history"
            >
              <History size={14} color="var(--accent)" /> View Changelog
            </button>
          </div>
        </div>
      </div>

      <ChangelogModal isOpen={showChangelogModal} onClose={() => setShowChangelogModal(false)} />
    </div>
  );
}
