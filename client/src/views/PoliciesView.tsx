import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import {
  FileText, CheckCircle2, History, Download, Plus, Trash2, Edit,
  Send, UserCheck, BookOpen, AlertTriangle, Clock, Layers, Sparkles, X,
  Printer, Eye, Code, FileCheck
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
  const [editChangeReason, setEditChangeReason] = useState('');
  const [viewMode, setViewMode] = useState<'document' | 'markdown'>('document');
  const [viewingVersion, setViewingVersion] = useState<any | null>(null);

  // Modals
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitAuthor, setSubmitAuthor] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

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
  const [currencyStats, setCurrencyStats] = useState<any | null>(null);
  const [reviewDue, setReviewDue] = useState<any | null>(null);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

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

    api.get('/policies/review_due')
      .then(setReviewDue)
      .catch(() => setReviewDue(null));
  };

  useEffect(() => {
    loadPolicies();
  }, [selectedId]);

  // Load acceptances & currency stats when selected policy changes
  useEffect(() => {
    if (selectedPolicy) {
      api.get(`/policies/${selectedPolicy.id}/acceptances`)
        .then(setAcceptStats)
        .catch(() => setAcceptStats(null));
      api.get(`/policies/${selectedPolicy.id}/acceptance_status`)
        .then(setCurrencyStats)
        .catch(() => setCurrencyStats(null));
    }
  }, [selectedPolicy?.id, selectedPolicy?.version, selectedPolicy?.approved_version]);

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
    setEditChangeReason('Initial policy authoring');
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
    setEditChangeReason('');
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCreating && !editChangeReason.trim()) {
      notify('Please document the reason for this revision / what changed', 'error');
      return;
    }
    setSaving(true);
    try {
      if (isCreating) {
        const res = await api.post('/policies', {
          title: editTitle.trim(),
          description: editDescription.trim(),
          owner: editOwner.trim(),
          control_ids: editControls,
          review_date: editReviewDate,
          content: editContent,
          status: 'draft',
          change_reason: editChangeReason.trim() || 'Initial policy authoring'
        });
        notify('Policy created in draft (v1 snapshot recorded)');
        setIsCreating(false);
        setSelectedPolicy(res);
      } else if (selectedPolicy) {
        const res = await api.patch(`/policies/${selectedPolicy.id}`, {
          title: editTitle.trim(),
          description: editDescription.trim(),
          owner: editOwner.trim(),
          control_ids: editControls,
          review_date: editReviewDate,
          content: editContent,
          change_reason: editChangeReason.trim()
        });
        notify(`Policy updated (v${res.version} snapshot recorded with reason)`);
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
      const res = await api.post(`/policies/${selectedPolicy.id}/approve`, {
        approver: approverName.trim()
      });
      notify(`Policy approved & published by ${approverName}`);
      setShowPublishModal(false);
      setSelectedPolicy(res);
      loadPolicies();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy || !submitAuthor.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(`/policies/${selectedPolicy.id}/submit`, {
        author: submitAuthor.trim()
      });
      notify(`Policy submitted for review by ${submitAuthor}`);
      setShowSubmitModal(false);
      setSelectedPolicy(res);
      loadPolicies();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy || !rejectionReason.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(`/policies/${selectedPolicy.id}/reject`, {
        reason: rejectionReason.trim(),
        rejector: approverName.trim() || 'Reviewer'
      });
      notify('Policy rejected and returned to draft');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedPolicy(res);
      loadPolicies();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = async (v: number) => {
    if (!selectedPolicy) return;
    if (!confirm(`Restore Version ${v}? This will create a new draft version copying Version ${v}'s content.`)) return;
    try {
      const res = await api.post(`/policies/${selectedPolicy.id}/restore/${v}`, {});
      notify(`Restored Version ${v} as Version ${res.version} (draft)`);
      setShowVersions(false);
      setSelectedPolicy(res);
      loadPolicies();
    } catch (err: any) {
      notify(err.message, 'error');
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
    <div className="harbor-view">
      <PageHeader
        eyebrow="OPERATE"
        title="Policies"
        description="Manage policy drafts, published versions, control mappings, and employee acceptance."
      >
        <a href="/api/policies/packet" className="button" download title="Download consolidated policy packet">
          <Download size={14} /> Download Policy Packet (.zip)
        </a>
        <button className="button" onClick={() => setShowJevModal(true)} title="Upload or evaluate policy compatibility against controls using JEV">
          <Sparkles size={14} color="var(--accent)" /> JEV Control Matcher
        </button>
        <button className="button" onClick={handleOpenTemplates}>
          <BookOpen size={14} /> Policy Library
        </button>
        <button className="button button-primary" onClick={handleStartCreate}>
          <Plus size={14} /> New Policy
        </button>
      </PageHeader>

      {/* Annual Policy Review SLA Alerts */}
      {reviewDue?.overdue_count > 0 && (
        <div style={{
          background: 'rgba(255, 107, 107, 0.12)',
          border: '1px solid var(--danger)',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '13px',
          color: 'var(--ink)'
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div>
            <strong>Annual Policy Review SLA Alert: </strong>
            <span>{reviewDue.overdue_count} {reviewDue.overdue_count === 1 ? 'policy is' : 'policies are'} overdue for mandatory annual executive review ({reviewDue.overdue.map((p: any) => p.title).join(', ')}). In-scope SOC 2 governance requires annual re-approval.</span>
          </div>
        </div>
      )}

      {reviewDue?.due_soon_count > 0 && (!reviewDue?.overdue_count || reviewDue.overdue_count === 0) && (
        <div style={{
          background: 'rgba(243, 194, 120, 0.12)',
          border: '1px solid var(--warning)',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '13px',
          color: 'var(--ink)'
        }}>
          <Clock size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <div>
            <strong>Upcoming Policy Reviews: </strong>
            <span>{reviewDue.due_soon_count} {reviewDue.due_soon_count === 1 ? 'policy requires' : 'policies require'} review within the next 30 days.</span>
          </div>
        </div>
      )}

      <div className="view-split-grid" style={{ display: 'grid', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Policies List */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="view-row" style={{ padding: '12px 16px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                    background: isSelected ? 'var(--accent-light)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent'
                  }}
                >
                  <div className="view-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{p.title}</span>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>v{p.version || 1}</span>
                  </div>
                  <div className="view-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                  <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>{selectedPolicy.title}</h2>
                    <Badge value={selectedPolicy.status} />
                    <span className="mono" style={{ fontSize: '12px', background: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
                      Version {selectedPolicy.version || 1}
                    </span>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '13px' }}>{selectedPolicy.description}</p>
                </div>

                <div className="view-inline" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div className="view-inline" style={{ display: 'flex', gap: '2px', background: 'var(--surface-raised)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)', marginRight: '6px' }}>
                    <button
                      type="button"
                      className={`button button-sm ${viewMode === 'document' ? 'button-primary' : ''}`}
                      style={{ padding: '3px 10px', fontSize: '11px' }}
                      onClick={() => setViewMode('document')}
                    >
                      <FileText size={12} /> Executive Document
                    </button>
                    <button
                      type="button"
                      className={`button button-sm ${viewMode === 'markdown' ? 'button-primary' : ''}`}
                      style={{ padding: '3px 10px', fontSize: '11px' }}
                      onClick={() => setViewMode('markdown')}
                    >
                      <Code size={12} /> Markdown
                    </button>
                  </div>

                  <a
                    href={`/api/policies/${selectedPolicy.id}/print?autoprint=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-sm button-primary"
                    title="Print executive document or save as PDF"
                  >
                    <Printer size={13} /> Print / Save PDF
                  </a>
                  <button className="button button-sm" onClick={() => setShowJevModal(true)} title="Check policy compatibility against controls with JEV">
                    <Sparkles size={13} color="var(--accent)" /> JEV Match
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
                  {selectedPolicy.status === 'draft' && (
                    <button className="button button-sm button-primary" onClick={() => setShowSubmitModal(true)}>
                      <Send size={13} /> Submit for Review
                    </button>
                  )}
                  {selectedPolicy.status === 'in_review' && (
                    <>
                      <button className="button button-sm" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => setShowRejectModal(true)}>
                        <X size={13} /> Reject
                      </button>
                      <button className="button button-sm button-primary" onClick={() => setShowPublishModal(true)}>
                        <CheckCircle2 size={13} /> Approve & Publish
                      </button>
                    </>
                  )}
                  {selectedPolicy.status === 'published' && (
                    <button className="button button-sm" onClick={() => setShowPublishModal(true)} title="Re-approve to reset annual review SLA">
                      <CheckCircle2 size={13} /> Re-approve
                    </button>
                  )}
                  <button className="icon-button" onClick={handleDelete} title="Delete policy" style={{ color: 'var(--danger)' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Review SLA / Status Banners */}
              {selectedPolicy.status === 'in_review' && (
                <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #38bdf8', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={15} style={{ color: '#38bdf8' }} />
                  <span>
                    <strong>In Review:</strong> Submitted by {selectedPolicy.submitted_by || 'Author'} on {formatDate(selectedPolicy.submitted_at)}. Independent executive review and approval required before publishing.
                  </span>
                </div>
              )}

              {selectedPolicy.status === 'draft' && selectedPolicy.rejection_reason && (
                <div style={{ background: 'rgba(255, 107, 107, 0.12)', border: '1px solid var(--danger)', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={15} style={{ color: 'var(--danger)' }} />
                  <span>
                    <strong>Revision Rejected:</strong> {selectedPolicy.rejection_reason}. Please address feedback and re-submit for review.
                  </span>
                </div>
              )}

              {selectedPolicy.review_date && new Date(selectedPolicy.review_date) < new Date() && (
                <div style={{ background: 'rgba(255, 107, 107, 0.12)', border: '1px solid var(--danger)', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={15} style={{ color: 'var(--danger)' }} />
                  <span>
                    <strong>Annual Executive Review Overdue:</strong> Review deadline was {formatDate(selectedPolicy.review_date)}. Executive re-approval resets the 365-day SLA.
                  </span>
                </div>
              )}

              {/* Policy Metadata & Acceptance Progress Bar */}
              <div className="view-grid-four" style={{ display: 'grid', gap: '12px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px' }}>
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
                <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px 18px', marginBottom: '20px' }}>
                  <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                        Workforce Attestation & Currency
                      </span>
                      {selectedPolicy.approved_version && (
                        <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '8px' }}>
                          (Latest Approved: v{selectedPolicy.approved_version})
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--accent)' }}>
                        {currencyStats ? `${currencyStats.currency_percentage}% Current` : `${acceptStats.compliance_percent}% Compliant`}
                      </strong>
                      {currencyStats?.personnel?.length > 0 && (
                        <button
                          className="button button-sm"
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                          onClick={() => setShowCurrencyModal(true)}
                        >
                          View Roster
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ width: `${currencyStats ? currencyStats.currency_percentage : acceptStats.compliance_percent}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--muted)' }}>
                    <span>Active Personnel: {currencyStats?.total_active_personnel ?? acceptStats.total_employees}</span>
                    <span style={{ color: 'var(--success)' }}>Current: {currencyStats?.current_count ?? acceptStats.compliant_employees}</span>
                    {currencyStats?.stale_count > 0 && (
                      <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Stale (prior versions): {currencyStats.stale_count}</span>
                    )}
                    {currencyStats?.missing_count > 0 && (
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Missing: {currencyStats.missing_count}</span>
                    )}
                  </div>
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

              {/* Content View Surface */}
              {viewMode === 'document' ? (
                <div style={{ borderTop: '1px solid var(--border)', marginTop: '16px', paddingTop: '20px' }}>
                  {/* Executive Document Layout */}
                  <div style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '20px 24px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--accent)', paddingBottom: '12px', marginBottom: '16px' }}>
                      <div>
                        <span style={{ fontSize: '11px', letterSpacing: '1px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)' }}>
                          tofromGRC • Information Security & Governance Program
                        </span>
                        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '4px 0 0 0', color: 'var(--ink)' }}>
                          {selectedPolicy.title}
                        </h2>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Badge value={selectedPolicy.status} />
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                          Version {selectedPolicy.version || 1}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--muted)', display: 'block' }}>Document ID</span>
                        <strong className="mono">{selectedPolicy.id}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)', display: 'block' }}>Executive Owner</span>
                        <strong>{selectedPolicy.owner || 'Unassigned'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)', display: 'block' }}>Approved By</span>
                        <strong>{selectedPolicy.approved_by || selectedPolicy.approver || 'Pending Review'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)', display: 'block' }}>Annual Review SLA</span>
                        <strong>{selectedPolicy.review_date ? formatDate(selectedPolicy.review_date) : 'Annual Review Required'}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '28px 32px',
                    lineHeight: 1.8,
                    fontSize: '14px',
                    color: 'var(--ink)'
                  }}>
                    <Markdown>{selectedPolicy.content || '*No content provided for this policy.*'}</Markdown>
                  </div>
                </div>
              ) : (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                  <pre style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '16px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: 1.6,
                    maxHeight: '500px',
                    overflowY: 'auto'
                  }}>
                    {selectedPolicy.content || '*No content provided for this policy.*'}
                  </pre>
                </div>
              )}
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

                <div className="field">
                  <span>Reason for Revision / What Changed *</span>
                  <textarea
                    rows={2}
                    required
                    placeholder="Document what changed in this version and why (e.g. Updated password requirements per DNI 2025 report recommendations)..."
                    value={editChangeReason}
                    onChange={e => setEditChangeReason(e.target.value)}
                  />
                  <small style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '2px' }}>
                    Every revision is permanently tracked with author, timestamp, and this change reason in immutable history.
                  </small>
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

                <div className="view-inline" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
        <Dialog title="Policy Templates" wide onClose={() => setShowTemplateModal(false)}>
          <div className="dialog-body">
            <div className="view-grid-two" style={{ marginBottom: '16px', display: 'grid', gap: '12px', background: 'var(--surface-raised)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
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
                  <div className="view-row" key={tpl.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <div>
                      <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px' }}>{tpl.title}</strong>
                        <span style={{ fontSize: '11px', background: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>{tpl.category}</span>
                        {alreadyAdopted && <span className="badge badge-green">In Library</span>}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{tpl.description}</p>
                      <div className="view-inline" style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
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

      {/* Submit for Review Modal */}
      {showSubmitModal && selectedPolicy && (
        <Dialog title="Submit Policy for Executive Review" subtitle="Transitions draft policy to In Review for independent approval." onClose={() => setShowSubmitModal(false)}>
          <form onSubmit={handleSubmitReview}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Author / Submitter Identity *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. security-lead@tofrom.com"
                  value={submitAuthor}
                  onChange={e => setSubmitAuthor(e.target.value)}
                  autoFocus
                />
                <small style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px' }}>
                  Segregation of Duties: The designated approver must be an independent identity different from this submitter.
                </small>
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowSubmitModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !submitAuthor.trim()}>
                {saving ? 'Submitting…' : 'Submit for Review'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedPolicy && (
        <Dialog title="Reject Policy Revision" subtitle="Returns policy to Draft with recorded audit feedback." onClose={() => setShowRejectModal(false)}>
          <form onSubmit={handleReject}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Rejection Reason & Required Remediation *</span>
                <textarea
                  rows={4}
                  required
                  placeholder="Explain why this revision cannot be approved and what changes the author must make..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button type="submit" className="button" style={{ background: 'var(--danger)', color: '#fff' }} disabled={saving || !rejectionReason.trim()}>
                {saving ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Publish / Approve Modal */}
      {showPublishModal && (
        <Dialog title="Approve & Publish Policy" subtitle="Approving creates an immutable baseline and sets review date to +365 days." onClose={() => setShowPublishModal(false)}>
          <form onSubmit={handlePublish}>
            <div className="dialog-body">
              <div className="field">
                <span>Authorized Executive Approver *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. ciso@tofrom.com"
                  value={approverName}
                  onChange={e => setApproverName(e.target.value)}
                  autoFocus
                />
                <small style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px' }}>
                  Segregation of Duties: The approver cannot be the author/submitter ({selectedPolicy?.submitted_by || selectedPolicy?.owner || 'Author'}).
                </small>
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowPublishModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !approverName.trim()}>
                {saving ? 'Approving…' : 'Approve & Publish'}
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
                  <div key={v.version} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '14px 18px', background: 'var(--surface-raised)' }}>
                    <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>Version {v.version}</strong>
                          {v.approved_by ? (
                            <span className="badge badge-success" style={{ fontSize: '10px' }}>
                              Approved by {v.approved_by}
                            </span>
                          ) : (
                            <span className="badge badge-neutral" style={{ fontSize: '10px' }}>Draft / Revision</span>
                          )}
                          <span className="mono" style={{ fontSize: '12px', color: 'var(--muted)' }}>{formatDate(v.created_at)}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          <span>Author / Editor: <strong style={{ color: 'var(--ink)' }}>{v.updated_by || 'Author'}</strong></span>
                        </div>
                        {v.change_reason && (
                          <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--accent)', background: 'rgba(56, 189, 248, 0.08)', padding: '4px 8px', borderRadius: '4px', borderLeft: '3px solid var(--accent)' }}>
                            <strong>Why:</strong> {v.change_reason}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="button button-sm"
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                          onClick={() => setViewingVersion(viewingVersion === v ? null : v)}
                        >
                          <Eye size={12} /> {viewingVersion === v ? 'Hide Content' : 'View Content'}
                        </button>
                        <button
                          className="button button-sm button-primary"
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                          onClick={() => handleRestoreVersion(v.version)}
                        >
                          Restore as Draft
                        </button>
                      </div>
                    </div>
                    {viewingVersion === v && (
                      <pre style={{ maxHeight: '200px', overflowY: 'auto', background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '12px', fontSize: '11px', fontFamily: 'var(--font-mono)', lineHeight: 1.5, marginTop: '10px', borderRadius: '4px' }}>
                        {v.content}
                      </pre>
                    )}
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

      {/* Workforce Attestation Roster Modal */}
      {showCurrencyModal && currencyStats && (
        <Dialog title={`Workforce Attestation Currency: ${selectedPolicy?.title}`} wide onClose={() => setShowCurrencyModal(false)}>
          <div className="dialog-body">
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px' }}>
              Tracking workforce signature currency for approved Version {currencyStats.approved_version || selectedPolicy?.version}. Prior version signatures are flagged stale.
            </p>
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                    <th style={{ padding: '6px 8px' }}>Name</th>
                    <th style={{ padding: '6px 8px' }}>Email</th>
                    <th style={{ padding: '6px 8px' }}>Status</th>
                    <th style={{ padding: '6px 8px' }}>Signed Version</th>
                    <th style={{ padding: '6px 8px' }}>Attested At</th>
                  </tr>
                </thead>
                <tbody>
                  {currencyStats.personnel?.map((p: any) => (
                    <tr key={p.person_id || p.email} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px', fontWeight: 500 }}>{p.name}</td>
                      <td style={{ padding: '8px', color: 'var(--muted)' }}>{p.email}</td>
                      <td style={{ padding: '8px' }}>
                        <span className={`badge badge-${p.status === 'current' ? 'success' : p.status === 'stale' ? 'warning' : 'danger'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>
                        {p.accepted_version ? `v${p.accepted_version}` : '—'}
                      </td>
                      <td style={{ padding: '8px', color: 'var(--muted)' }}>
                        {p.accepted_at ? formatDate(p.accepted_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" className="button" onClick={() => setShowCurrencyModal(false)}>Close</button>
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
