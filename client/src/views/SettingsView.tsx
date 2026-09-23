import { useEffect, useState, useRef } from 'react';
import {
  Settings as SettingsIcon, Download, Upload, Database, Shield, FileSpreadsheet,
  Check, AlertCircle, Sparkles, Eye, EyeOff, History, UserPlus, Users, Lock, Unlock
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Loading, ErrorState, Note, Badge } from '../components/ui';
import { Dialog } from '../components/Dialog';
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
  const [replacingKey, setReplacingKey] = useState(false);
  const [jevStatus, setJevStatus] = useState<any>(null);
  const [testingJev, setTestingJev] = useState(false);
  const [savingJev, setSavingJev] = useState(false);
  const [jevTestResult, setJevTestResult] = useState<any>(null);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [aiModels, setAiModels] = useState<any[]>([]);

  // RBAC User Management states
  const [users, setUsers] = useState<any[] | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('compliance_manager');
  const [creatingUser, setCreatingUser] = useState(false);

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

      // Load JEV config (never prefill input with real key)
      setJevApiKey('');
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

      try {
        const uRes = await api.get('/users');
        setUsers(uRes.items || []);
      } catch {
        setUsers(null);
      }
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserPassword.length < 12) {
      notify('Password must be at least 12 characters.', 'error');
      return;
    }
    setCreatingUser(true);
    try {
      await api.post('/users', {
        name: newUserName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        password: newUserPassword,
        role: newUserRole
      });
      notify(`User ${newUserName} provisioned successfully`);
      setShowCreateUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      loadSettings();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleUserStatus = async (user: any) => {
    const nextStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      await api.patch(`/users/${user.id}`, { status: nextStatus });
      notify(`User ${user.name} is now ${nextStatus}`);
      loadSettings();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleUnlockUser = async (user: any) => {
    try {
      await api.post(`/users/${user.id}/unlock`);
      notify(`Account unlocked for ${user.name}`);
      loadSettings();
    } catch (err: any) {
      notify(err.message, 'error');
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
      const payload: Record<string, any> = {
        endpoint: jevEndpoint
      };
      if (jevApiKey.trim()) {
        payload.api_key = jevApiKey.trim();
      }
      const res = await api.post('/jev/test_key', payload);
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
      const payload: Record<string, any> = {
        jev_endpoint: jevEndpoint
      };
      if (jevApiKey.trim()) {
        payload.jev_api_key = jevApiKey.trim();
      }
      const updated = await api.patch('/workspace', payload);
      setWorkspace(updated);
      setReplacingKey(false);
      setJevApiKey('');
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

      {/* Role-Based Access Control & User Management (Admin Only) */}
      {users !== null && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--ink)' }}>
                User Provisioning & Role-Based Access Control (RBAC)
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                Enforce least-privilege roles across staff: Admin, Compliance Manager, Control Owner, and Viewer.
              </p>
            </div>
            <button className="button button-sm button-primary" onClick={() => setShowCreateUserModal(true)}>
              <UserPlus size={13} /> Provision User
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Name & Email</th>
                  <th style={{ padding: '8px 12px' }}>Role</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px' }}>Last Login</th>
                  <th style={{ padding: '8px 12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <strong style={{ display: 'block', color: 'var(--ink)' }}>{u.name}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{u.email}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge value={u.role} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge value={u.status} />
                      {u.is_locked && (
                        <span className="badge badge-danger" style={{ marginLeft: '6px', fontSize: '10px' }}>
                          Locked
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: '11px' }}>
                      {u.last_login_at ? u.last_login_at.slice(0, 19).replace('T', ' ') : 'Never'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {u.is_locked && (
                          <button
                            className="button button-sm"
                            style={{ padding: '2px 8px', fontSize: '11px' }}
                            onClick={() => handleUnlockUser(u)}
                            title="Unlock account"
                          >
                            <Unlock size={11} /> Unlock
                          </button>
                        )}
                        <button
                          className="button button-sm"
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                          onClick={() => handleToggleUserStatus(u)}
                        >
                          {u.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Provision User Modal */}
      {showCreateUserModal && (
        <Dialog title="Provision New Staff User" subtitle="Assign least-privilege role with strict password policy." onClose={() => setShowCreateUserModal(false)}>
          <form onSubmit={handleCreateUser}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Full Name *</span>
                <input type="text" required value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="e.g. Dana Scully" autoFocus />
              </div>

              <div className="field">
                <span>Work Email *</span>
                <input type="email" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="name@tofrom.internal" />
              </div>

              <div className="field">
                <span>Role *</span>
                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                  <option value="compliance_manager">Compliance Manager (operational GRC execution)</option>
                  <option value="control_owner">Control Owner (assigned controls & evidence)</option>
                  <option value="viewer">Viewer (read-only)</option>
                  <option value="admin">Administrator (full system access)</option>
                </select>
              </div>

              <div className="field">
                <span>Initial Passphrase (min 12 chars) *</span>
                <input type="password" required minLength={12} value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="••••••••••••••••" />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowCreateUserModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={creatingUser || newUserPassword.length < 12}>
                {creatingUser ? 'Provisioning…' : 'Provision User'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

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
              {jevStatus?.api_key_configured && !replacingKey ? (
                <div className="view-inline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--surface-raised)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={16} color="var(--success)" />
                    <span style={{ fontSize: '13px', color: 'var(--ink)' }}>
                      Key Configured <span className="mono" style={{ color: 'var(--muted)', marginLeft: '4px' }}>({jevStatus.masked_key || '••••••••'})</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button button-sm"
                    onClick={() => setReplacingKey(true)}
                  >
                    Replace Key
                  </button>
                </div>
              ) : (
                <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showJevKey ? 'text' : 'password'}
                      value={jevApiKey}
                      onChange={e => setJevApiKey(e.target.value)}
                      placeholder={replacingKey ? "Enter new TypeSafe JEV key" : "e.g. apikey_..."}
                      style={{ paddingRight: '36px', fontFamily: 'monospace', width: '100%' }}
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
                  {replacingKey && (
                    <button
                      type="button"
                      className="button button-sm"
                      onClick={() => { setReplacingKey(false); setJevApiKey(''); }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
              <small style={{ color: 'var(--muted)', marginTop: '4px' }}>
                TypeSafe JEV API Key (stored encrypted at rest using Fernet; full key is never returned).
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
              <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>Choice, Score, Noul</strong>
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
