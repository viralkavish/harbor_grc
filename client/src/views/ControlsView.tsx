import { useEffect, useState, useRef } from 'react';
import {
  Shield, Plus, Upload, Download, Search, Filter, CheckCircle2,
  AlertCircle, RefreshCw, Layers, Edit, Eye, Trash2, FileText, Check
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, formatDate } from '../components/ui';
import { Dialog } from '../components/Dialog';
import type { Notify, Navigate } from '../lib/types';

const CATEGORIES = [
  'All',
  'Control Environment',
  'Communication and Information',
  'Risk Assessment',
  'Monitoring Activities',
  'Control Activities',
  'Logical Access',
  'Physical Access',
  'System Operations',
  'Change Management',
  'Vendor Management',
  'Availability',
  'Confidentiality',
  'Processing Integrity',
  'Privacy',
  'DNI 2025 Governance'
];

export function ControlsView({ notify, onNavigate, selectedId }: { notify: Notify; onNavigate: Navigate; selectedId?: string }) {
  const [controls, setControls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [vintageFilter, setVintageFilter] = useState('all');

  // Modals & Drawers
  const [selectedControl, setSelectedControl] = useState<any | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create / Edit Form States
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('Logical Access');
  const [formOwner, setFormOwner] = useState('SecOps Lead');
  const [formStatus, setFormStatus] = useState('implemented');
  const [formFrequency, setFormFrequency] = useState('continuous');
  const [formType, setFormType] = useState('preventive');
  const [formNature, setFormNature] = useState('automated');
  const [formVintage, setFormVintage] = useState('DNI 2025 Report');
  const [formCriterion, setFormCriterion] = useState('CC6.1');
  const [formTestProcedure, setFormTestProcedure] = useState('');
  const [formEvidenceReq, setFormEvidenceReq] = useState('');

  // CSV Import States
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadControls = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/controls');
      const items = res.items || [];
      setControls(items);
      if (selectedId) {
        const found = items.find((c: any) => c.id === selectedId || c.code === selectedId);
        if (found) setSelectedControl(found);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadControls();
  }, [selectedId]);

  const handleStartCreate = (vintage = 'DNI 2025 Report') => {
    setFormCode(`DNI-${Date.now().toString().slice(-4)}`);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('Logical Access');
    setFormOwner('SecOps Lead');
    setFormStatus('implemented');
    setFormFrequency('continuous');
    setFormType('preventive');
    setFormNature('automated');
    setFormVintage(vintage);
    setFormCriterion('CC6.1');
    setFormTestProcedure('Verify control implementation through automated configuration audits and access log examination.');
    setFormEvidenceReq('Configuration screenshots, access export reports, and continuous test logs.');
    setShowCreateModal(true);
  };

  const handleStartEdit = (ctrl: any) => {
    setSelectedControl(ctrl);
    setFormCode(ctrl.code || ctrl.id);
    setFormTitle(ctrl.title || '');
    setFormDescription(ctrl.description || '');
    setFormCategory(ctrl.category || 'Logical Access');
    setFormOwner(ctrl.owner || 'SecOps Lead');
    setFormStatus(ctrl.status || 'implemented');
    setFormFrequency(ctrl.frequency || 'continuous');
    setFormType(ctrl.type || 'preventive');
    setFormNature(ctrl.nature || 'automated');
    setFormVintage(ctrl.catalog_vintage || 'TSC-2017-2022');
    setFormCriterion(ctrl.criterion_mapping || 'CC6.1');
    setFormTestProcedure(ctrl.test_procedure || '');
    setFormEvidenceReq(ctrl.evidence_requirement || '');
    setShowEditModal(true);
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const newCtrlId = `TF-${formCode}`;
      await api.post('/controls', {
        id: newCtrlId,
        code: formCode.trim(),
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory,
        owner: formOwner.trim(),
        status: formStatus,
        frequency: formFrequency,
        type: formType,
        nature: formNature,
        catalog_vintage: formVintage,
        criterion_mapping: formCriterion,
        test_procedure: formTestProcedure.trim(),
        evidence_requirement: formEvidenceReq.trim()
      });
      notify(`Control ${formCode} created successfully`);
      setShowCreateModal(false);
      loadControls();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedControl) return;
    setSaving(true);
    try {
      await api.patch(`/controls/${selectedControl.id}`, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory,
        owner: formOwner.trim(),
        status: formStatus,
        frequency: formFrequency,
        type: formType,
        nature: formNature,
        catalog_vintage: formVintage,
        criterion_mapping: formCriterion,
        test_procedure: formTestProcedure.trim(),
        evidence_requirement: formEvidenceReq.trim()
      });
      notify(`Control ${selectedControl.code || selectedControl.id} updated`);
      setShowEditModal(false);
      loadControls();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('dry_run', 'false');

      const res = await api.post('/import/controls', formData);
      notify(`Successfully imported ${res.imported} controls into library!`);
      setShowImportModal(false);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadControls();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const filtered = controls.filter((c: any) => {
    const q = search.toLowerCase();
    const matchesQ = !q || c.code?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.id?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesCat = categoryFilter === 'All' || c.category === categoryFilter;
    const matchesVintage = vintageFilter === 'all' || (c.catalog_vintage || 'TSC-2017-2022').toLowerCase().includes(vintageFilter.toLowerCase());
    return matchesQ && matchesStatus && matchesCat && matchesVintage;
  });

  if (loading && controls.length === 0) return <Loading label="Loading compliance controls library…" />;
  if (error) return <ErrorState message={error} retry={loadControls} />;

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow="GOVERNANCE & CONTROLS"
        title="Controls Library"
        description="Comprehensive inventory of authoritative controls across SOC 2, DNI 2025 report, and custom compliance frameworks."
      >
        <div className="view-inline" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="button" onClick={() => setShowImportModal(true)}>
            <Upload size={13} /> Import Controls (DNI 2025 / CSV)
          </button>
          <a href="/api/export/controls" className="button" download>
            <Download size={13} /> Export CSV
          </a>
          <button className="button button-primary" onClick={() => handleStartCreate('DNI 2025 Report')}>
            <Plus size={13} /> Add DNI Control
          </button>
          <button className="button" onClick={loadControls} title="Refresh library">
            <RefreshCw size={13} />
          </button>
        </div>
      </PageHeader>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: '18px' }}>
        <div className="view-inline" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="Search by code, title, keyword..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', width: '100%' }}
            />
          </div>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '160px' }}>
            <option value="all">All Statuses</option>
            <option value="implemented">Implemented</option>
            <option value="in_progress">In Progress</option>
            <option value="not_started">Not Started</option>
            <option value="not_applicable">Not Applicable</option>
          </select>

          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: '200px' }}>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
            ))}
          </select>

          <select value={vintageFilter} onChange={e => setVintageFilter(e.target.value)} style={{ width: '180px' }}>
            <option value="all">All Sources / Vintages</option>
            <option value="DNI">DNI 2025 Report</option>
            <option value="TSC-2017">TSC 2017-2022</option>
          </select>

          <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--muted)' }}>
            Showing <strong>{filtered.length}</strong> of {controls.length} controls
          </div>
        </div>
      </div>

      {/* Controls Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)', color: 'var(--muted)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>Control Code & Title</th>
                <th style={{ padding: '10px 14px' }}>Category</th>
                <th style={{ padding: '10px 14px' }}>Source Vintage</th>
                <th style={{ padding: '10px 14px' }}>Frequency & Owner</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', maxWidth: '340px' }}>
                    <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span className="mono" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--accent)' }}>
                        {c.code || c.id}
                      </span>
                      {c.criterion_mapping && (
                        <span style={{ fontSize: '10px', background: 'var(--surface-raised)', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                          {c.criterion_mapping}
                        </span>
                      )}
                    </div>
                    <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{c.title}</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {c.description}
                    </p>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ color: 'var(--ink)' }}>{c.category || 'General'}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className="badge badge-neutral" style={{ fontSize: '10.5px' }}>
                      {c.catalog_vintage || 'TSC-2017-2022'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 600, display: 'block', color: 'var(--ink)' }}>
                      {c.frequency || 'Annual'}
                    </span>
                    <small style={{ color: 'var(--muted)' }}>{c.owner || 'Unassigned'}</small>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Badge value={c.status} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="button button-sm"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        onClick={() => setSelectedControl(c)}
                        title="Inspect control details"
                      >
                        <Eye size={12} /> Inspect
                      </button>
                      <button
                        className="button button-sm"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        onClick={() => handleStartEdit(c)}
                        title="Edit control"
                      >
                        <Edit size={12} /> Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE CONTROL MODAL */}
      {showCreateModal && (
        <Dialog title="Add New Control" subtitle="Manually add a control from DNI 2025 report or custom framework." onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleSaveCreate}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="view-grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div className="field">
                  <span>Control Code *</span>
                  <input type="text" required value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="e.g. DNI-AC-01" autoFocus />
                </div>
                <div className="field">
                  <span>Control Title *</span>
                  <input type="text" required value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Multi-Factor Authentication Enforcement" />
                </div>
              </div>

              <div className="field">
                <span>Description & Specification *</span>
                <textarea rows={3} required value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Detailed statement of what this control requires and enforces..." />
              </div>

              <div className="view-grid-three" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="field">
                  <span>Category</span>
                  <select value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span>Source / Vintage</span>
                  <input type="text" value={formVintage} onChange={e => setFormVintage(e.target.value)} placeholder="DNI 2025 Report" />
                </div>
                <div className="field">
                  <span>Criterion Mapping</span>
                  <input type="text" value={formCriterion} onChange={e => setFormCriterion(e.target.value)} placeholder="e.g. CC6.1" />
                </div>
              </div>

              <div className="view-grid-three" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="field">
                  <span>Owner</span>
                  <input type="text" value={formOwner} onChange={e => setFormOwner(e.target.value)} />
                </div>
                <div className="field">
                  <span>Operating Frequency</span>
                  <select value={formFrequency} onChange={e => setFormFrequency(e.target.value)}>
                    <option value="continuous">Continuous (Automated)</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div className="field">
                  <span>Status</span>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                    <option value="implemented">Implemented</option>
                    <option value="in_progress">In Progress</option>
                    <option value="not_started">Not Started</option>
                    <option value="not_applicable">Not Applicable</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <span>Auditor Test Procedure</span>
                <textarea rows={2} value={formTestProcedure} onChange={e => setFormTestProcedure(e.target.value)} placeholder="Steps the independent auditor takes to inspect and verify this control..." />
              </div>

              <div className="field">
                <span>Evidence Requirement</span>
                <textarea rows={2} value={formEvidenceReq} onChange={e => setFormEvidenceReq(e.target.value)} placeholder="Artifacts, screenshots, and logs required as proof of effectiveness..." />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !formCode.trim() || !formTitle.trim()}>
                {saving ? 'Creating…' : 'Add Control'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* EDIT CONTROL MODAL */}
      {showEditModal && selectedControl && (
        <Dialog title={`Edit Control: ${selectedControl.code || selectedControl.id}`} subtitle="Updates increment control version and keep historical snapshots." onClose={() => setShowEditModal(false)}>
          <form onSubmit={handleSaveEdit}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Control Title *</span>
                <input type="text" required value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              </div>

              <div className="field">
                <span>Description *</span>
                <textarea rows={3} required value={formDescription} onChange={e => setFormDescription(e.target.value)} />
              </div>

              <div className="view-grid-three" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="field">
                  <span>Category</span>
                  <select value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span>Source / Vintage</span>
                  <input type="text" value={formVintage} onChange={e => setFormVintage(e.target.value)} />
                </div>
                <div className="field">
                  <span>Status</span>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                    <option value="implemented">Implemented</option>
                    <option value="in_progress">In Progress</option>
                    <option value="not_started">Not Started</option>
                    <option value="not_applicable">Not Applicable</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <span>Auditor Test Procedure</span>
                <textarea rows={2} value={formTestProcedure} onChange={e => setFormTestProcedure(e.target.value)} />
              </div>

              <div className="field">
                <span>Evidence Requirement</span>
                <textarea rows={2} value={formEvidenceReq} onChange={e => setFormEvidenceReq(e.target.value)} />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? 'Updating…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* BULK IMPORT MODAL (DNI 2025 / CSV) */}
      {showImportModal && (
        <Dialog title="Import Controls (DNI 2025 / CSV)" subtitle="Upload your DNI 2025 report controls in CSV format." onClose={() => setShowImportModal(false)}>
          <form onSubmit={handleImportCSV}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'var(--surface-raised)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px' }}>
                <span style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>CSV Column Format</span>
                <p style={{ margin: '0 0 8px 0', color: 'var(--muted)' }}>
                  CSV headers supported: <code>title, description, code, category, owner, status, frequency, criterion_mapping, test_procedure, evidence_requirement</code>
                </p>
                <a href="/api/export/controls" download className="link-button">
                  Download Sample CSV Template
                </a>
              </div>

              <div className="field">
                <span>Select DNI 2025 CSV File *</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  required
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowImportModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={importing || !importFile}>
                {importing ? 'Importing…' : 'Import Controls'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* INSPECT CONTROL DRAWER */}
      {selectedControl && !showEditModal && (
        <Dialog title={`Control: ${selectedControl.code || selectedControl.id}`} subtitle={selectedControl.criterion_mapping || selectedControl.category} onClose={() => setSelectedControl(null)} wide>
          <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--ink)' }}>{selectedControl.title}</h3>
              <p style={{ color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>{selectedControl.description}</p>
            </div>

            <div className="view-grid-four" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', background: 'var(--surface-raised)', padding: '12px', borderRadius: '6px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Category</span>
                <strong style={{ display: 'block' }}>{selectedControl.category || 'General'}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Status</span>
                <Badge value={selectedControl.status} />
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Frequency</span>
                <strong style={{ display: 'block', textTransform: 'capitalize' }}>{selectedControl.frequency || 'Annual'}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Source Vintage</span>
                <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{selectedControl.catalog_vintage || 'TSC-2017-2022'}</span>
              </div>
            </div>

            {selectedControl.test_procedure && (
              <div>
                <strong style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                  Auditor Test Procedure
                </strong>
                <p style={{ background: 'var(--card-bg)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)', margin: 0, lineHeight: 1.5 }}>
                  {selectedControl.test_procedure}
                </p>
              </div>
            )}

            {selectedControl.evidence_requirement && (
              <div>
                <strong style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                  Evidence Requirement
                </strong>
                <p style={{ background: 'var(--card-bg)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)', margin: 0, lineHeight: 1.5 }}>
                  {selectedControl.evidence_requirement}
                </p>
              </div>
            )}
          </div>
          <div className="dialog-footer">
            <button type="button" className="button" onClick={() => setSelectedControl(null)}>Close</button>
            <button type="button" className="button button-primary" onClick={() => { const c = selectedControl; setSelectedControl(null); handleStartEdit(c); }}>
              <Edit size={13} /> Edit Control
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
