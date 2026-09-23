import { useEffect, useState, useRef } from 'react';
import { Upload, Download, Trash2, Shield, AlertCircle, FileCheck, Check, History, CheckCircle2, RefreshCw, Lock, Calendar, Layers } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, EmptyState, formatDate } from '../components/ui';
import { Dialog } from '../components/Dialog';
import { LinkedSelect } from '../components/Fields';
import type { DataRecord, Schema, Notify, Navigate } from '../lib/types';

export function EvidenceView({ schema, notify, onNavigate }: { schema: Schema; notify: Notify; onNavigate: Navigate }) {
  const [items, setItems] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadControls, setUploadControls] = useState<string[]>([]);
  const [uploadExpiresDate, setUploadExpiresDate] = useState<string>('');
  const [periodStart, setPeriodStart] = useState<string>('2027-01-01');
  const [periodEnd, setPeriodEnd] = useState<string>('2027-12-31');
  const [sourceSystem, setSourceSystem] = useState<string>('manual-upload');
  const [collectionMethod, setCollectionMethod] = useState<'manual' | 'automated'>('manual');
  const [retentionRule, setRetentionRule] = useState<string>('soc2-7yr');
  const [legalHold, setLegalHold] = useState<boolean>(false);
  const [supersedesId, setSupersedesId] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  // Version chain dialog state
  const [versionChain, setVersionChain] = useState<any[] | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);

  // Coverage preview state
  const [coverage, setCoverage] = useState<any | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);
  const [verifyingAll, setVerifyingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEvidence = () => {
    setLoading(true);
    setError('');
    api.get('/evidence')
      .then(res => setItems(res.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadCoverage = async () => {
    try {
      const res = await api.get('/evidence/coverage?window_start=2027-01-01&window_end=2027-12-31');
      setCoverage(res);
      setShowCoverage(true);
    } catch (e: any) {
      notify(e.message, 'error');
    }
  };

  useEffect(() => {
    loadEvidence();
  }, []);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());
      if (uploadDesc.trim()) formData.append('description', uploadDesc.trim());
      if (uploadControls.length > 0) formData.append('control_ids', JSON.stringify(uploadControls));
      if (uploadExpiresDate) formData.append('expires_date', uploadExpiresDate);
      formData.append('period_covered', JSON.stringify({ start: periodStart, end: periodEnd }));
      formData.append('source_system', sourceSystem);
      formData.append('collection_method', collectionMethod);
      formData.append('retention_rule', retentionRule);
      formData.append('legal_hold', legalHold ? 'true' : 'false');
      if (supersedesId) formData.append('supersedes_id', supersedesId);

      const res = await api.post('/evidence/upload', formData);
      if (res.window_warning) {
        notify(res.window_warning);
      } else {
        notify('Evidence artifact uploaded, hashed with SHA-256, and indexed');
      }
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDesc('');
      setUploadControls([]);
      setUploadExpiresDate('');
      setLegalHold(false);
      setSupersedesId('');
      loadEvidence();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async (id: string) => {
    try {
      const res = await api.post(`/evidence/${id}/verify`, {});
      if (res.integrity_status === 'verified') {
        notify('Cryptographic integrity confirmed: disk hash matches SHA-256');
      } else {
        notify('Integrity verification FAILED: disk hash does not match stored hash!', 'error');
      }
      loadEvidence();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleVerifyAll = async () => {
    setVerifyingAll(true);
    try {
      const res = await api.post('/evidence/verify_all', {});
      if (res.failed === 0) {
        notify(`All ${res.total} artifacts verified successfully against SHA-256 checksums`);
      } else {
        notify(`Integrity alert: ${res.failed} of ${res.total} artifacts failed checksum verification!`, 'error');
      }
      loadEvidence();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setVerifyingAll(false);
    }
  };

  const handleViewVersions = async (id: string) => {
    setLoadingChain(true);
    try {
      const res = await api.get(`/evidence/${id}/versions`);
      setVersionChain(res.versions || []);
    } catch (e: any) {
      notify(e.message, 'error');
      setVersionChain(null);
    } finally {
      setLoadingChain(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/evidence/${id}`, { status: newStatus });
      notify(`Status updated to ${newStatus}`);
      loadEvidence();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete evidence record "${title}"?`)) return;
    try {
      await api.delete(`/evidence/${id}`);
      notify('Evidence record deleted');
      loadEvidence();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow="OPERATE"
        title="Evidence Vault"
        description="Immutable, timestamped, attributed SOC 2 Type II audit evidence with cryptographic SHA-256 verification and observation window coverage."
      >
        <button className="button" onClick={handleVerifyAll} disabled={verifyingAll}>
          <RefreshCw size={14} className={verifyingAll ? 'spin' : ''} /> Verify All Hashes
        </button>
        <button className="button" onClick={loadCoverage}>
          <Calendar size={14} /> Observation Coverage
        </button>
        <button className="button button-primary" onClick={() => setShowUploadModal(true)}>
          <Upload size={14} /> Upload Evidence
        </button>
      </PageHeader>

      {/* Observation Window Coverage Banner */}
      {showCoverage && coverage && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="var(--accent)" />
              <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>Observation Window Coverage: {coverage.window_start} → {coverage.window_end}</strong>
              <span className={`badge ${coverage.is_fully_covered ? 'badge-success' : 'badge-warning'}`}>
                {coverage.is_fully_covered ? '100% Fully Covered' : `${coverage.coverage_percentage}% Covered (${coverage.uncovered_days} days uncovered)`}
              </span>
            </div>
            <button className="button button-sm" onClick={() => setShowCoverage(false)}>Dismiss</button>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--muted)' }}>
            <div>
              <strong>Covered Intervals:</strong>{' '}
              {coverage.covered_ranges?.length > 0 ? (
                coverage.covered_ranges.map((r: any, i: number) => (
                  <span key={i} className="mono" style={{ background: 'var(--card-bg)', padding: '2px 6px', borderRadius: '4px', margin: '0 4px', border: '1px solid var(--border)' }}>
                    {r.start} → {r.end}
                  </span>
                ))
              ) : 'None'}
            </div>
            <div>
              <strong>Uncovered Gaps:</strong>{' '}
              {coverage.gaps?.length > 0 ? (
                coverage.gaps.map((g: any, i: number) => (
                  <span key={i} className="mono" style={{ background: 'rgba(255,100,100,0.15)', color: 'var(--danger)', padding: '2px 6px', borderRadius: '4px', margin: '0 4px', border: '1px solid var(--danger)' }}>
                    {g.start} → {g.end} ({g.days}d)
                  </span>
                ))
              ) : <span style={{ color: 'var(--success)' }}>Zero Gaps</span>}
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
        {loading && <Loading label="Loading evidence repository…" />}
        {error && <ErrorState message={error} retry={loadEvidence} />}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            title="No evidence items collected yet"
            description="Upload configuration exports, penetration test reports, or screenshots to link them directly to controls."
            action={
              <button className="button button-primary" onClick={() => setShowUploadModal(true)}>
                <Upload size={14} /> Upload First Evidence
              </button>
            }
          />
        )}

        {!loading && !error && items.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Artifact / File</th>
                <th>Period Covered</th>
                <th>Provenance & System</th>
                <th>Integrity (SHA-256)</th>
                <th>Controls Linked</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const pc = item.period_covered;
                const isVerified = item.integrity_status === 'verified';
                const isFailed = item.integrity_status === 'failed';

                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.title}</span>
                        <span className="mono" style={{ fontSize: '10px', background: 'var(--surface-raised)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                          v{item.version || 1}
                        </span>
                        {item.legal_hold && (
                          <span className="badge badge-warning" style={{ fontSize: '10px', padding: '1px 5px' }} title="Active legal hold: deletion blocked">
                            <Lock size={10} /> Hold
                          </span>
                        )}
                      </div>
                      {item.filename && (
                        <div className="view-inline" style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <span className="mono">{item.filename}</span>
                          {item.file_size && <span>({(item.file_size / 1024).toFixed(1)} KB)</span>}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {pc && pc.start && pc.end ? (
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--ink)' }}>
                          {pc.start} → {pc.end}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>Undated</span>
                      )}
                      {item.expires_date && (
                        <div style={{ fontSize: '10px', color: new Date(item.expires_date) < new Date() ? 'var(--danger)' : 'var(--muted)' }}>
                          Expires: {item.expires_date}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      <div>{item.source_system || 'manual-upload'}</div>
                      <div style={{ fontSize: '11px' }}>{item.captured_by || 'Security Lead'}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {item.sha256 ? (
                          <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }} title={item.sha256}>
                            {item.sha256.slice(0, 8)}…{item.sha256.slice(-4)}
                          </span>
                        ) : '—'}
                        {isVerified && <span title="SHA-256 verified on disk"><CheckCircle2 size={13} color="var(--success)" /></span>}
                        {isFailed && <span title="Tamper detected! Checksum mismatch"><AlertCircle size={13} color="var(--danger)" /></span>}
                        <button
                          className="button button-sm"
                          style={{ padding: '1px 5px', fontSize: '10px' }}
                          onClick={() => handleVerify(item.id)}
                          title="Recompute and verify SHA-256 hash"
                        >
                          Verify
                        </button>
                      </div>
                    </td>
                    <td>
                      {item.control_ids && item.control_ids.length > 0 ? (
                        <div className="view-inline" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {item.control_ids.map((cid: string) => (
                            <button
                              key={cid}
                              className="link-button"
                              style={{ fontSize: '11px' }}
                              onClick={() => onNavigate('controls', cid)}
                            >
                              {cid}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Unlinked</span>
                      )}
                    </td>
                    <td>
                      <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Badge value={item.status} />
                        {item.status !== 'approved' && (
                          <button
                            className="button button-sm"
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                            onClick={() => handleUpdateStatus(item.id, 'approved')}
                            title="Approve evidence"
                          >
                            <Check size={10} /> Approve
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button
                          className="icon-button"
                          title="Version History"
                          onClick={() => handleViewVersions(item.id)}
                        >
                          <History size={14} />
                        </button>
                        {item.filename && (
                          <a
                            href={`/api/evidence/${item.id}/file`}
                            className="icon-button"
                            title="Download file (verified against SHA-256)"
                            download
                          >
                            <Download size={14} />
                          </a>
                        )}
                        <button
                          className="icon-button"
                          title={item.legal_hold ? "Cannot delete: Legal hold active" : "Delete evidence"}
                          onClick={() => handleDelete(item.id, item.title)}
                          disabled={item.legal_hold}
                          style={{ color: item.legal_hold ? 'var(--muted)' : 'var(--danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Version History Modal */}
      {versionChain && (
        <Dialog
          title="Evidence Artifact Lineage & Version History"
          subtitle="SOC 2 Type II audit trail: prior versions are immutable and permanently preserved."
          onClose={() => setVersionChain(null)}
          wide
        >
          <div className="dialog-body">
            {versionChain.map((v: any, index: number) => (
              <div
                key={v.id}
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '14px',
                  marginBottom: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Version {v.version}</span>
                    {index === versionChain.length - 1 && (
                      <span className="badge badge-success" style={{ fontSize: '10px' }}>Active Head</span>
                    )}
                    {v.legal_hold && (
                      <span className="badge badge-warning" style={{ fontSize: '10px' }}>Legal Hold</span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Captured on {formatDate(v.captured_at || v.created_at)}</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{v.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                  Source: <strong>{v.source_system}</strong> ({v.collection_method}) • Period: <strong>{v.period_covered?.start} → {v.period_covered?.end}</strong>
                </div>
                <div className="mono" style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px', background: 'var(--card-bg)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  SHA-256: {v.sha256}
                </div>
              </div>
            ))}
          </div>
          <div className="dialog-footer">
            <button type="button" className="button button-primary" onClick={() => setVersionChain(null)}>
              Close
            </button>
          </div>
        </Dialog>
      )}

      {/* Upload Evidence Modal */}
      {showUploadModal && (
        <Dialog title="Upload Compliance Evidence Artifact" subtitle="Artifacts are hashed with SHA-256 at capture and registered into your immutable audit vault." onClose={() => setShowUploadModal(false)} wide>
          <form onSubmit={handleUploadSubmit}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="field">
                <span>Attachment File (Max 25 MiB) *</span>
                <input
                  type="file"
                  required
                  ref={fileInputRef}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      if (!uploadTitle) setUploadTitle(f.name);
                    }
                  }}
                />
              </div>

              <div className="field">
                <span>Title / Descriptive Name</span>
                <input
                  type="text"
                  placeholder="e.g. Okta Multi-Factor Authentication Enforcement Report Q1"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="field">
                  <span>Period Covered: Start Date (Required) *</span>
                  <input
                    type="date"
                    required
                    value={periodStart}
                    onChange={e => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="field">
                  <span>Period Covered: End Date (Required) *</span>
                  <input
                    type="date"
                    required
                    value={periodEnd}
                    onChange={e => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="field">
                  <span>Source System</span>
                  <input
                    type="text"
                    placeholder="e.g. aws-config, okta, github, manual-upload"
                    value={sourceSystem}
                    onChange={e => setSourceSystem(e.target.value)}
                  />
                </div>
                <div className="field">
                  <span>Collection Method</span>
                  <select
                    value={collectionMethod}
                    onChange={e => setCollectionMethod(e.target.value as any)}
                  >
                    <option value="manual">Manual (Staff Upload)</option>
                    <option value="automated">Automated (System Export)</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <span>Description & Audit Context</span>
                <textarea
                  rows={2}
                  placeholder="Explain how this file demonstrates operating effectiveness of the mapped control(s)..."
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                />
              </div>

              <LinkedSelect
                resource="controls"
                label="Map to Compliance Controls"
                value={uploadControls}
                onChange={setUploadControls}
                multiple
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="field">
                  <span>Supersedes Prior Version (Optional Re-upload)</span>
                  <select
                    value={supersedesId}
                    onChange={e => setSupersedesId(e.target.value)}
                  >
                    <option value="">None (Initial Baseline Version)</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>
                        {it.title} (v{it.version || 1})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span>Expiration Date (optional)</span>
                  <input
                    type="date"
                    value={uploadExpiresDate}
                    onChange={e => setUploadExpiresDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface-raised)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  id="legalHoldCheck"
                  checked={legalHold}
                  onChange={e => setLegalHold(e.target.checked)}
                />
                <label htmlFor="legalHoldCheck" style={{ fontSize: '13px', color: 'var(--ink)', cursor: 'pointer' }}>
                  <strong>Place on Legal Hold</strong> — strictly blocks deletion across all users and API callers.
                </label>
              </div>
            </div>

            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowUploadModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={uploading || !uploadFile}>
                {uploading ? 'Streaming & Hashing…' : 'Upload Evidence Artifact'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
