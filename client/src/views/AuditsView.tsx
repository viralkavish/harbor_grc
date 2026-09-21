import { useEffect, useState } from 'react';
import {
  Briefcase, Download, Plus, Trash2, Edit2, CheckCircle2, ChevronRight,
  ChevronDown, Sparkles, Check, AlertCircle, Clock, FileText, Filter
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, EmptyState, formatDate } from '../components/ui';
import { Dialog } from '../components/Dialog';
import { LinkedSelect } from '../components/Fields';
import type { DataRecord, Schema, Notify, Navigate } from '../lib/types';

export function AuditsView({ schema, notify, onNavigate }: { schema: Schema; notify: Notify; onNavigate: Navigate }) {
  const [audits, setAudits] = useState<DataRecord[]>([]);
  const [requests, setRequests] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAudit, setSelectedAudit] = useState<DataRecord | null>(null);

  // Auditor Autopilot Workspace State
  const [activeViewTab, setActiveViewTab] = useState<'engagements' | 'auditor_hub'>('engagements');
  const [pbcData, setPbcData] = useState<any | null>(null);
  const [pbcFilter, setPbcFilter] = useState<'all' | 'accepted' | 'in_review' | 'needs_clarification'>('all');

  // New Audit Modal
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditTitle, setAuditTitle] = useState('');
  const [auditFramework, setAuditFramework] = useState<string | null>(null);
  const [auditAuditor, setAuditAuditor] = useState('');
  const [auditStart, setAuditStart] = useState('');
  const [auditEnd, setAuditEnd] = useState('');

  // New Audit Request Modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqControlId, setReqControlId] = useState<string | null>(null);
  const [reqEvidenceIds, setReqEvidenceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadAuditsAndRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const [aRes, rRes] = await Promise.all([
        api.get('/audits'),
        api.get('/audit_requests')
      ]);
      setAudits(aRes.items || []);
      setRequests(rRes.items || []);
      if (aRes.items?.length > 0 && !selectedAudit) {
        setSelectedAudit(aRes.items[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPbcHub = async () => {
    try {
      const res = await api.get('/auditor_hub');
      setPbcData(res);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleUpdatePbcStatus = async (pbcId: string, status: string, notes?: string) => {
    try {
      const res = await api.patch(`/auditor_hub/items/${pbcId}`, { status, ...(notes ? { notes } : {}) });
      setPbcData((prev: any) => {
        if (!prev) return prev;
        const updatedItems = prev.items.map((i: any) => i.id === pbcId ? res : i);
        const accepted = updatedItems.filter((i: any) => i.status === 'accepted').length;
        return {
          ...prev,
          items: updatedItems,
          accepted_count: accepted,
          readiness_percent: Math.round((accepted / updatedItems.length) * 100)
        };
      });
      notify(`PBC deliverable set to ${status}`);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  useEffect(() => {
    loadAuditsAndRequests();
    loadPbcHub();
  }, []);

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/audits', {
        title: auditTitle,
        framework_id: auditFramework,
        auditor: auditAuditor,
        period_start: auditStart || null,
        period_end: auditEnd || null,
        status: 'planning'
      });
      notify('Audit campaign created');
      setShowAuditModal(false);
      setAuditTitle('');
      setAuditAuditor('');
      setSelectedAudit(res);
      loadAuditsAndRequests();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAudit) return;
    setSaving(true);
    try {
      await api.post('/audit_requests', {
        title: reqTitle,
        audit_id: selectedAudit.id,
        control_id: reqControlId,
        evidence_ids: reqEvidenceIds,
        status: 'open'
      });
      notify('Audit request logged');
      setShowRequestModal(false);
      setReqTitle('');
      setReqControlId(null);
      setReqEvidenceIds([]);
      loadAuditsAndRequests();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRequestStatus = async (reqId: string, status: string) => {
    try {
      await api.patch(`/audit_requests/${reqId}`, { status });
      notify(`Request status set to ${status}`);
      loadAuditsAndRequests();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteRequest = async (reqId: string) => {
    if (!confirm('Delete this audit request?')) return;
    try {
      await api.delete(`/audit_requests/${reqId}`);
      notify('Request deleted');
      loadAuditsAndRequests();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteAudit = async (auditId: string) => {
    if (!confirm('Delete this audit? All dependent requests must be cleared first.')) return;
    try {
      await api.delete(`/audits/${auditId}`);
      notify('Audit deleted');
      setSelectedAudit(null);
      loadAuditsAndRequests();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  if (loading && audits.length === 0) return <Loading label="Loading audit dossiers…" />;
  if (error) return <ErrorState message={error} retry={loadAuditsAndRequests} />;

  const auditRequests = selectedAudit ? requests.filter(r => r.audit_id === selectedAudit.id) : [];

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow="AUDIT"
        title="Audits"
        description="Manage audit engagements, evidence requests, and auditor reviews."
      >
        <div className="view-inline" style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`button ${activeViewTab === 'auditor_hub' ? 'button-primary' : ''}`}
            onClick={() => setActiveViewTab('auditor_hub')}
          >
            <Sparkles size={14} /> Auditor Hub (21 PBCs)
          </button>
          <button
            className={`button ${activeViewTab === 'engagements' ? 'button-primary' : ''}`}
            onClick={() => setActiveViewTab('engagements')}
          >
            <Briefcase size={14} /> Audit Engagements ({audits.length})
          </button>
          {activeViewTab === 'engagements' && (
            <button className="button button-primary" onClick={() => setShowAuditModal(true)}>
              <Plus size={14} /> New Audit
            </button>
          )}
        </div>
      </PageHeader>

      {activeViewTab === 'auditor_hub' ? (
        /* Auditor Autopilot Hub Workspace */
        <div>
          {/* Progress Banner */}
          <div className="card" style={{ background: 'var(--main-bg)', color: 'var(--ink)', padding: '24px', marginBottom: '24px', border: '1px solid var(--border)' }}>
            <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={20} color="var(--accent)" />
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                    Auditor Evidence Requests
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                  Pre-staged evidence checklist required for SOC 2 Type 1 and Type 2 auditor fieldwork.
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: '26px', color: 'var(--success)' }}>
                  {pbcData?.readiness_percent || 0}%
                </strong>
                <span style={{ fontSize: '12px', display: 'block', color: 'var(--muted)' }}>
                  Auditor Accepted ({pbcData?.accepted_count || 0}/{pbcData?.total_items || 21})
                </span>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="view-inline" style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <button
                className={`button button-sm ${pbcFilter === 'all' ? 'button-primary' : ''}`}
                onClick={() => setPbcFilter('all')}
                style={{ fontSize: '11px' }}
              >
                All Deliverables ({pbcData?.total_items || 21})
              </button>
              <button
                className={`button button-sm ${pbcFilter === 'accepted' ? 'button-primary' : ''}`}
                onClick={() => setPbcFilter('accepted')}
                style={{ fontSize: '11px' }}
              >
                Accepted ({pbcData?.accepted_count || 0})
              </button>
              <button
                className={`button button-sm ${pbcFilter === 'in_review' ? 'button-primary' : ''}`}
                onClick={() => setPbcFilter('in_review')}
                style={{ fontSize: '11px' }}
              >
                In Review ({pbcData?.in_review_count || 0})
              </button>
              <button
                className={`button button-sm ${pbcFilter === 'needs_clarification' ? 'button-primary' : ''}`}
                onClick={() => setPbcFilter('needs_clarification')}
                style={{ fontSize: '11px' }}
              >
                Needs Clarification ({pbcData?.clarification_count || 0})
              </button>
            </div>
          </div>

          {/* PBC Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(pbcData?.items || [])
              .filter((item: any) => pbcFilter === 'all' || item.status === pbcFilter)
              .map((item: any) => {
                const isAccepted = item.status === 'accepted';
                const isReview = item.status === 'in_review';
                const isClarify = item.status === 'needs_clarification';

                return (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      marginBottom: 0,
                      borderLeft: `4px solid ${isAccepted ? 'var(--success)' : isReview ? 'var(--accent)' : 'var(--warning)'}`,
                      padding: '16px 20px'
                    }}
                  >
                    <div className="view-row view-stack-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="mono" style={{ fontSize: '12px', fontWeight: 700, background: 'var(--accent-light)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '4px' }}>
                            {item.code}
                          </span>
                          <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{item.title}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--muted)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            {item.category}
                          </span>
                          <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            Control: {item.control_code}
                          </span>
                        </div>

                        {item.notes && (
                          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Auditor Review Note: </span>
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Auditor Status Actions */}
                      <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            background: isAccepted ? 'var(--success-light)' : isReview ? 'var(--accent-light)' : 'var(--warning-light)',
                            color: isAccepted ? 'var(--success)' : isReview ? 'var(--accent)' : 'var(--warning)',
                            border: `1px solid ${isAccepted ? 'var(--success)' : isReview ? 'var(--accent)' : 'var(--warning)'}`,
                            textTransform: 'capitalize'
                          }}
                        >
                          {item.status?.replace('_', ' ')}
                        </span>

                        <button
                          type="button"
                          className="button button-sm"
                          onClick={() => handleUpdatePbcStatus(item.id, isAccepted ? 'in_review' : 'accepted')}
                          title="Toggle auditor acceptance status"
                        >
                          {isAccepted ? 'Mark In Review' : 'Accept Deliverable'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
      <div className="view-split-grid" style={{ display: 'grid', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Audits List */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '13px' }}>
            Audit Engagements ({audits.length})
          </div>
          <div>
            {audits.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                No active audits. Create one to begin evidence preparation.
              </div>
            ) : (
              audits.map(a => {
                const isSelected = selectedAudit?.id === a.id;
                const reqCount = requests.filter(r => r.audit_id === a.id).length;
                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAudit(a)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--accent-light)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>{a.title}</div>
                    <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <Badge value={a.status} />
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{reqCount} request(s)</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Audit Detail & Requests */}
        <div>
          {selectedAudit && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{selectedAudit.title}</h2>
                    <Badge value={selectedAudit.status} />
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '2px' }}>
                    Auditor: <strong>{selectedAudit.auditor || 'Independent Assessor'}</strong> · Period: {formatDate(selectedAudit.period_start)} to {formatDate(selectedAudit.period_end)}
                  </p>
                </div>

                <div className="view-inline" style={{ display: 'flex', gap: '8px' }}>
                  <a href={`/api/audits/${selectedAudit.id}/export`} className="button button-primary" download title="Export scoped audit package">
                    <Download size={14} /> Export Audit Package
                  </a>
                  <button className="button" onClick={() => setShowRequestModal(true)}>
                    <Plus size={14} /> Add Request
                  </button>
                  <button className="icon-button" onClick={() => handleDeleteAudit(selectedAudit.id)} title="Delete audit" style={{ color: 'var(--danger)' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Requests Sub-table */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--ink)' }}>
                  Auditor Requests ({auditRequests.length})
                </h4>

                {auditRequests.length === 0 ? (
                  <div style={{ padding: '24px', background: 'var(--surface-raised)', border: '1px dashed var(--border)', borderRadius: '6px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                    No evidence requests logged under this audit yet.
                  </div>
                ) : (
                  <div className="view-table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Request Title</th>
                        <th>Status</th>
                        <th>Mapped Control</th>
                        <th>Evidence Attached</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRequests.map(r => (
                        <tr key={r.id}>
                          <td>
                            <strong style={{ color: 'var(--ink)' }}>{r.title}</strong>
                          </td>
                          <td>
                            <select
                              value={r.status}
                              onChange={e => handleUpdateRequestStatus(r.id, e.target.value)}
                              style={{ padding: '2px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)' }}
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="submitted">Submitted</option>
                              <option value="accepted">Accepted</option>
                            </select>
                          </td>
                          <td>
                            {r.control_id ? (
                              <button className="link-button" onClick={() => onNavigate('controls', r.control_id)}>
                                {r.control_id}
                              </button>
                            ) : (
                              <span style={{ color: 'var(--muted)', fontSize: '12px' }}>General Scope</span>
                            )}
                          </td>
                          <td>
                            {r.evidence_ids?.length > 0 ? (
                              <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
                                {r.evidence_ids.length} item(s)
                              </span>
                            ) : (
                              <span style={{ color: 'var(--muted)', fontSize: '12px' }}>None</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="icon-button" onClick={() => handleDeleteRequest(r.id)} style={{ color: 'var(--danger)' }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* New Audit Modal */}
      {showAuditModal && (
        <Dialog title="Create Audit Engagement" onClose={() => setShowAuditModal(false)}>
          <form onSubmit={handleCreateAudit}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Audit Title *</span>
                <input type="text" required placeholder="e.g. 2026 SOC 2 Type II Examination" value={auditTitle} onChange={e => setAuditTitle(e.target.value)} />
              </div>
              <LinkedSelect resource="frameworks" label="Target Compliance Framework" value={auditFramework} onChange={setAuditFramework} multiple={false} />
              <div className="field">
                <span>Auditing Firm / Lead Auditor</span>
                <input type="text" placeholder="e.g. Schellman, A-LIGN, Coalfire" value={auditAuditor} onChange={e => setAuditAuditor(e.target.value)} />
              </div>
              <div className="field-grid">
                <div className="field">
                  <span>Period Start Date</span>
                  <input type="date" value={auditStart} onChange={e => setAuditStart(e.target.value)} />
                </div>
                <div className="field">
                  <span>Period End Date</span>
                  <input type="date" value={auditEnd} onChange={e => setAuditEnd(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowAuditModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !auditTitle.trim()}>
                {saving ? 'Creating…' : 'Create Audit'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* New Request Modal */}
      {showRequestModal && selectedAudit && (
        <Dialog title={`Add Evidence Request: ${selectedAudit.title}`} onClose={() => setShowRequestModal(false)} wide>
          <form onSubmit={handleCreateRequest}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Request Title / Deliverable Description *</span>
                <input type="text" required placeholder="e.g. Screenshot of production DB encryption key rotation settings" value={reqTitle} onChange={e => setReqTitle(e.target.value)} />
              </div>
              <LinkedSelect resource="controls" label="Mapped Control" value={reqControlId} onChange={setReqControlId} multiple={false} />
              <LinkedSelect resource="evidence" label="Link Collected Evidence Attachments" value={reqEvidenceIds} onChange={setReqEvidenceIds} multiple />
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowRequestModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !reqTitle.trim()}>
                {saving ? 'Adding…' : 'Add Request'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
