import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import {
  FileText, CheckCircle2, History, Download, Plus, Trash2, Edit,
  Send, UserCheck, BookOpen, AlertTriangle, Clock, Layers, Sparkles
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, EmptyState, formatDate, Note } from '../components/ui';
import { Dialog } from '../components/Dialog';
import { LinkedSelect } from '../components/Fields';
import { JevPolicyModal } from '../components/JevPolicyModal';
import type { DataRecord, Schema, Notify, Navigate } from '../lib/types';

export function PoliciesView({ schema, notify, onNavigate, selectedId }: { schema: Schema; notify: Notify; onNavigate: Navigate; selectedId?: string }) {
  const [policies, setPolicies] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<DataRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editControls, setEditControls] = useState<string[]>([]);
  const [editReviewDate, setEditReviewDate] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Modals
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [approverName, setApproverName] = useState('');

  // Template Library Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [subOrgName, setSubOrgName] = useState('');
  const [subCisoTitle, setSubCisoTitle] = useState('');

  // Policy Acceptance Modal & Stats
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptName, setAcceptName] = useState('');
  const [acceptEmail, setAcceptEmail] = useState('');
  const [acceptStats, setAcceptStats] = useState<any | null>(null);

  // JEV Policy-to-Control Modal
  const [showJevModal, setShowJevModal] = useState(false);

  const [saving, setSaving] = useState(false);

  const loadPolicies = () => {
    setLoading(true);
    setError('');
    api.get('/policies')
      .then(res => {
        const items = res.items || [];
        setPolicies(items);
        if (selectedId) {
          const found = items.find((p: any) => p.id === selectedId);
          if (found) setSelectedPolicy(found);
        } else if (items.length > 0 && !selectedPolicy) {
          setSelectedPolicy(items[0]);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPolicies();
  }, [selectedId]);

  // Load acceptances stats when selected policy changes
  useEffect(() => {
    if (selectedPolicy) {
      api.get(`/policies/${selectedPolicy.id}/acceptances`)
        .then(setAcceptStats)
        .catch(() => setAcceptStats(null));
    }
  }, [selectedPolicy?.id]);

  const handleSelect = (policy: DataRecord) => {
    setSelectedPolicy(policy);
    setIsEditing(false);
    setShowVersions(false);
  };

  const handleOpenTemplates = async () => {
    try {
      const res = await api.get('/policies/templates');
      setTemplates(res.items || []);
      const boot = await api.get('/bootstrap');
      setSubOrgName(boot.workspace?.organization || boot.workspace?.name || 'Our Organization');
      setSubCisoTitle(boot.workspace?.owner || 'Chief Information Security Officer');
      setShowTemplateModal(true);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleAdoptTemplate = async (template: any) => {
    setSaving(true);
    try {
      const res = await api.post('/policies/from_template', {
        template_id: template.id,
        title: template.title,
        substitutions: {
          organization_name: subOrgName,
          ciso_title: subCisoTitle
        }
      });
      notify(`Policy "${template.title}" created from template`);
      setShowTemplateModal(false);
      setSelectedPolicy(res);
      loadPolicies();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStartCreate = () => {
    setEditTitle('New Security Policy');
    setEditDescription('');
    setEditOwner('');
    setEditControls([]);
    setEditReviewDate(null);
    setEditContent('# Policy Title\n\n## 1. Scope and Purpose\nDescribe the scope and purpose of this policy.\n\n## 2. Policy Statements\n- Baseline requirement 1\n- Baseline requirement 2');
    setIsCreating(true);
  };

  const handleStartEdit = () => {
    if (!selectedPolicy) return;
    setEditTitle(selectedPolicy.title);
    setEditDescription(selectedPolicy.description || '');
    setEditOwner(selectedPolicy.owner || '');
    setEditControls(selectedPolicy.control_ids || []);
    setEditReviewDate(selectedPolicy.review_date || null);
    setEditContent(selectedPolicy.content || '');
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isCreating) {
        const res = await api.post('/policies', {
          title: editTitle,
          description: editDescription,
          owner: editOwner,
          control_ids: editControls,
          review_date: editReviewDate,
          content: editContent,
          status: 'draft'
        });
        notify('Policy created in draft');
        setIsCreating(false);
        setSelectedPolicy(res);
      } else if (selectedPolicy) {
        const res = await api.patch(`/policies/${selectedPolicy.id}`, {
          title: editTitle,
          description: editDescription,
          owner: editOwner,
          control_ids: editControls,
          review_date: editReviewDate,
          content: editContent
        });
        notify('Policy updated (new draft version saved)');
        setIsEditing(false);
        setSelectedPolicy(res);
      }
      loadPolicies();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy || !approverName.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(`/policies/${selectedPolicy.id}/publish`, {
        approver: approverName.trim()
      });
      notify(`Policy published by ${approverName}`);
      setShowPublishModal(false);
      setSelectedPolicy(res);
      loadPolicies();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordAcceptance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy || !acceptName.trim() || !acceptEmail.trim()) return;
    setSaving(true);
    try {
      await api.post(`/policies/${selectedPolicy.id}/accept`, {
        person_name: acceptName.trim(),
        person_email: acceptEmail.trim(),
        signature_text: acceptName.trim()
      });
      notify(`Policy acceptance recorded for ${acceptName}`);
      setShowAcceptModal(false);
      setAcceptName('');
      setAcceptEmail('');
      // Refresh stats
      const stats = await api.get(`/policies/${selectedPolicy.id}/acceptances`);
      setAcceptStats(stats);
      loadPolicies();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadVersions = async () => {
    if (!selectedPolicy) return;
    try {
      const res = await api.get(`/policies/${selectedPolicy.id}/versions`);
      setVersions(res.items || []);
      setShowVersions(true);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedPolicy) return;
    if (!confirm(`Are you sure you want to delete "${selectedPolicy.title}"?`)) return;
    try {
      await api.delete(`/policies/${selectedPolicy.id}`);
      notify('Policy deleted');
      setSelectedPolicy(null);
      loadPolicies();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  if (loading && policies.length === 0) return <Loading label="Loading policies repository…" />;
  if (error) return <ErrorState message={error} retry={loadPolicies} />;

  return (
    <div>
      <PageHeader
        eyebrow="OPERATE"
        title="Security & Compliance Policies"
        description="Formal organizational governance policies, Vanta-aligned template library, immutable version tracking, and employee acceptance attestation."
      >
        <a href="/api/policies/packet" className="button" download title="Download consolidated policy packet">
          <Download size={14} /> Download Policy Packet (.zip)
        </a>
        <button className="button" onClick={() => setShowJevModal(true)} title="Upload or evaluate policy compatibility against controls using JEV">
          <Sparkles size={14} color="#2563eb" /> JEV Control Matcher
        </button>
        <button className="button" onClick={handleOpenTemplates}>
          <BookOpen size={14} /> Policy Library
        </button>
        <button className="button button-primary" onClick={handleStartCreate}>
          <Plus size={14} /> New Policy
        </button>
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Policies List */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#fafcfb', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Policies Library ({policies.length})</span>
            <button className="link-button" onClick={handleOpenTemplates} style={{ fontSize: '12px' }}>
              + Templates
            </button>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
            {policies.map(p => {
              const isSelected = selectedPolicy?.id === p.id;
              const isExpired = p.review_date && new Date(p.review_date) < new Date();
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: isSelected ? '#f0f5f3' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{p.title}</span>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>v{p.version || 1}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Badge value={isExpired ? 'expired' : p.status} />
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {p.control_ids?.length || 0} controls
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Policy Document / Editor */}
        <div>
          {selectedPolicy && !isEditing && (
            <div className="card">
              <div className="card-header" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>{selectedPolicy.title}</h2>
                    <Badge value={selectedPolicy.status} />
                    <span className="mono" style={{ fontSize: '12px', background: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
                      Version {selectedPolicy.version || 1}
                    </span>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '13px' }}>{selectedPolicy.description}</p>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button className="button button-sm" onClick={() => setShowJevModal(true)} title="Check policy compatibility against controls with JEV">
                    <Sparkles size={13} color="#2563eb" /> JEV Match
                  </button>
                  <a href={`/api/policies/${selectedPolicy.id}/export`} className="button button-sm" download title="Export markdown">
                    <Download size={13} /> Export MD
                  </a>
                  <button className="button button-sm" onClick={handleLoadVersions} title="View version history">
                    <History size={13} /> History
                  </button>
                  <button className="button button-sm" onClick={handleStartEdit}>
                    <Edit size={13} /> Edit
                  </button>
                  <button className="button button-sm" onClick={() => setShowAcceptModal(true)}>
                    <UserCheck size={13} /> Record Acceptance
                  </button>
                  {selectedPolicy.status !== 'published' && (
                    <button className="button button-sm button-primary" onClick={() => setShowPublishModal(true)}>
                      <CheckCircle2 size={13} /> Publish
                    </button>
                  )}
                  <button className="icon-button" onClick={handleDelete} title="Delete policy" style={{ color: 'var(--danger)' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Policy Metadata & Acceptance Progress Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block' }}>Policy Owner</span>
                  <strong>{selectedPolicy.owner || 'Unassigned'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block' }}>Review SLA</span>
                  <strong style={{ color: (selectedPolicy.review_date && new Date(selectedPolicy.review_date) < new Date()) ? 'var(--danger)' : 'inherit' }}>
                    {formatDate(selectedPolicy.review_date)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block' }}>Approver</span>
                  <strong>{selectedPolicy.approver || 'Unapproved'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block' }}>Approved Date</span>
                  <strong>{formatDate(selectedPolicy.approved_at)}</strong>
                </div>
              </div>

              {/* Workforce Policy Acceptance Scorecard */}
              {acceptStats && (
                <div style={{ background: '#f8faf9', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                      Workforce Acceptance Compliance ({acceptStats.compliant_employees} / {acceptStats.total_employees} Personnel)
                    </span>
                    <strong style={{ fontSize: '13px', color: 'var(--accent)' }}>
                      {acceptStats.compliance_percent}%
                    </strong>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${acceptStats.compliance_percent}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px' }} />
                  </div>
                  {acceptStats.items?.length > 0 && (
                    <small style={{ display: 'block', marginTop: '6px', color: 'var(--muted)', fontSize: '11px' }}>
                      Latest acceptance: {acceptStats.items[0].person_name} ({acceptStats.items[0].person_email}) on {formatDate(acceptStats.items[0].accepted_at)}
                    </small>
                  )}
                </div>
              )}

              {/* Linked Controls */}
              {selectedPolicy.control_ids && selectedPolicy.control_ids.length > 0 && (
                <div style={{ marginBottom: '16px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--muted)', marginRight: '8px' }}>Mapped Controls ({selectedPolicy.control_ids.length}):</span>
                  {selectedPolicy.control_ids.map((cid: string) => (
                    <button
                      key={cid}
                      className="link-button"
                      style={{ marginRight: '8px', fontSize: '12px' }}
                      onClick={() => onNavigate('controls', cid)}
                    >
                      {cid}
                    </button>
                  ))}
                </div>
              )}

              {/* Markdown Content Surface */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', lineHeight: 1.7, color: 'var(--ink)' }}>
                <Markdown>{selectedPolicy.content || '*No content provided for this policy.*'}</Markdown>
              </div>
            </div>
          )}

          {/* Edit / Create Policy Form */}
          {(isEditing || isCreating) && (
            <div className="card">
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
                {isCreating ? 'Author New Policy' : `Edit ${selectedPolicy?.title}`}
              </h3>
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="field">
                  <span>Policy Title *</span>
                  <input type="text" required value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                </div>

                <div className="field">
                  <span>Executive Description</span>
                  <textarea rows={2} value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                </div>

                <div className="field-grid">
                  <div className="field">
                    <span>Policy Owner</span>
                    <input type="text" value={editOwner} onChange={e => setEditOwner(e.target.value)} placeholder="e.g. CISO, VP Security" />
                  </div>
                  <div className="field">
                    <span>Scheduled Review Date</span>
                    <input type="date" value={editReviewDate || ''} onChange={e => setEditReviewDate(e.target.value || null)} />
                  </div>
                </div>

                <LinkedSelect
                  resource="controls"
                  label="Linked Controls"
                  value={editControls}
                  onChange={setEditControls}
                  multiple
                />

                <div className="field">
                  <span>Policy Markdown Content *</span>
                  <textarea
                    rows={16}
                    required
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="button" onClick={() => { setIsEditing(false); setIsCreating(false); }}>
                    Cancel
                  </button>
                  <button type="submit" className="button button-primary" disabled={saving}>
                    {saving ? 'Saving…' : isCreating ? 'Create Draft Policy' : 'Save as New Version'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Policy Library / Templates Modal */}
      {showTemplateModal && (
        <Dialog title="Vanta-Aligned Policy Templates Library" wide onClose={() => setShowTemplateModal(false)}>
          <div className="dialog-body">
            <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', background: '#fafcfb', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div className="field">
                <span>Organization Name (Substituted)</span>
                <input type="text" value={subOrgName} onChange={e => setSubOrgName(e.target.value)} />
              </div>
              <div className="field">
                <span>CISO / Security Lead Title</span>
                <input type="text" value={subCisoTitle} onChange={e => setSubCisoTitle(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '50vh', overflowY: 'auto' }}>
              {templates.map(tpl => {
                const alreadyAdopted = policies.some(p => p.title.toLowerCase() === tpl.title.toLowerCase());
                return (
                  <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px' }}>{tpl.title}</strong>
                        <span style={{ fontSize: '11px', background: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>{tpl.category}</span>
                        {alreadyAdopted && <span className="badge badge-green">In Library</span>}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{tpl.description}</p>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        {tpl.frameworks?.map((fw: string) => (
                          <span key={fw} className="mono" style={{ fontSize: '10px', color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 5px', borderRadius: '3px' }}>
                            {fw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      className="button button-sm button-primary"
                      onClick={() => handleAdoptTemplate(tpl)}
                      disabled={saving}
                    >
                      Adopt Template
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" className="button" onClick={() => setShowTemplateModal(false)}>Close</button>
          </div>
        </Dialog>
      )}

      {/* Record Employee Acceptance Modal */}
      {showAcceptModal && selectedPolicy && (
        <Dialog title={`Record Policy Acceptance: ${selectedPolicy.title}`} onClose={() => setShowAcceptModal(false)}>
          <form onSubmit={handleRecordAcceptance}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Record an employee's formal review and signed attestation for version {selectedPolicy.version || 1}.
              </p>
              <div className="field">
                <span>Employee Full Name *</span>
                <input type="text" required placeholder="e.g. Alex Morgan" value={acceptName} onChange={e => setAcceptName(e.target.value)} autoFocus />
              </div>
              <div className="field">
                <span>Employee Work Email *</span>
                <input type="email" required placeholder="e.g. alex@company.com" value={acceptEmail} onChange={e => setAcceptEmail(e.target.value)} />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowAcceptModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !acceptName.trim() || !acceptEmail.trim()}>
                {saving ? 'Recording…' : 'Record Signed Attestation'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Publish Modal */}
      {showPublishModal && (
        <Dialog title="Publish Policy" subtitle="Publishing creates an approved baseline and sets status to Published." onClose={() => setShowPublishModal(false)}>
          <form onSubmit={handlePublish}>
            <div className="dialog-body">
              <div className="field">
                <span>Authorized Approver Name *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Doe, Chief Information Security Officer"
                  value={approverName}
                  onChange={e => setApproverName(e.target.value)}
                  autoFocus
                />
              </div>
              <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--muted)' }}>
                By publishing, this policy version becomes available for questionnaire suggestion matching and Trust Center disclosure.
              </p>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowPublishModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !approverName.trim()}>
                {saving ? 'Publishing…' : 'Confirm Publication'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Version History Modal */}
      {showVersions && selectedPolicy && (
        <Dialog title={`Version History: ${selectedPolicy.title}`} wide onClose={() => setShowVersions(false)}>
          <div className="dialog-body">
            {versions.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No prior saved versions.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {versions.map((v: any) => (
                  <div key={v.version} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong>Version {v.version}</strong>
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--muted)' }}>{formatDate(v.created_at)}</span>
                    </div>
                    <pre style={{ maxHeight: '140px', overflowY: 'auto', background: '#fafcfb', padding: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                      {v.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="dialog-footer">
            <button type="button" className="button" onClick={() => setShowVersions(false)}>Close</button>
          </div>
        </Dialog>
      )}

      {/* JEV Policy-to-Control Compatibility Matcher */}
      <JevPolicyModal
        isOpen={showJevModal}
        onClose={() => setShowJevModal(false)}
        policy={selectedPolicy}
        onPolicyUpdated={loadPolicies}
        notify={notify}
        onNavigate={onNavigate}
      />
    </div>
  );
}
