import { useEffect, useState } from 'react';
import { Briefcase, Download, Plus, Trash2, Edit2, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';
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

  useEffect(() => {
    loadAuditsAndRequests();
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
    <div>
      <PageHeader
        eyebrow="OPERATE"
        title="Audits & Evidence Requests"
        description="Organize third-party audit campaigns, track auditor requests, and export scoped compliance packages."
      >
        <button className="button button-primary" onClick={() => setShowAuditModal(true)}>
          <Plus size={14} /> New Audit
        </button>
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Audits List */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#fafcfb', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '13px' }}>
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
                      background: isSelected ? '#f0f5f3' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>{a.title}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{selectedAudit.title}</h2>
                    <Badge value={selectedAudit.status} />
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '2px' }}>
                    Auditor: <strong>{selectedAudit.auditor || 'Independent Assessor'}</strong> · Period: {formatDate(selectedAudit.period_start)} to {formatDate(selectedAudit.period_end)}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
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
                  <div style={{ padding: '24px', background: '#fafcfb', border: '1px dashed var(--border)', borderRadius: '6px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                    No evidence requests logged under this audit yet.
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
