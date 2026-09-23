import { useEffect, useState } from 'react';
import {
  Calendar, Shield, AlertTriangle, CheckCircle2, XCircle, ArrowRight,
  RefreshCw, Download, FileText, Filter, Check, Clock, Layers,
  ExternalLink, Sparkles, AlertCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, formatDate } from '../components/ui';
import { Dialog } from '../components/Dialog';
import type { Notify, Navigate } from '../lib/types';

export function CoverageDashboardView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [data, setData] = useState<any | null>(null);
  const [windowCfg, setWindowCfg] = useState<any | null>(null);
  const [gaps, setGaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'controls' | 'criteria' | 'gaps'>('controls');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals
  const [showWindowModal, setShowWindowModal] = useState(false);
  const [showRemediateModal, setShowRemediateModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedGap, setSelectedGap] = useState<any | null>(null);

  // Window Form
  const [winStart, setWinStart] = useState('2027-01-01');
  const [winEnd, setWinEnd] = useState('2027-12-31');
  const [confirmWinChange, setConfirmWinChange] = useState(false);

  // Gap Action Forms
  const [remEvidenceRef, setRemEvidenceRef] = useState('');
  const [remNotes, setRemNotes] = useState('');
  const [acceptApprover, setAcceptApprover] = useState('');
  const [acceptExpiry, setAcceptExpiry] = useState('');
  const [acceptRationale, setAcceptRationale] = useState('');
  const [closureNote, setClosureNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCoverage = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, winRes, gapsRes] = await Promise.all([
        api.get('/coverage/summary'),
        api.get('/coverage/window'),
        api.get('/coverage/gaps').catch(() => ({ items: [] }))
      ]);
      setData(summaryRes);
      setWindowCfg(winRes);
      setGaps(gapsRes.items || []);
      setWinStart(winRes.observation_window_start || '2027-01-01');
      setWinEnd(winRes.observation_window_end || '2027-12-31');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoverage();
  }, []);

  const handleUpdateWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/coverage/window', {
        observation_window_start: winStart,
        observation_window_end: winEnd,
        confirm_change: confirmWinChange,
        actor: 'CISO'
      });
      notify('Observation window updated and logged to audit trail');
      setShowWindowModal(false);
      setConfirmWinChange(false);
      loadCoverage();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleScanGaps = async () => {
    setScanning(true);
    try {
      const res = await api.post('/coverage/scan_gaps');
      notify(`Gap scan complete: ${res.new_gaps_registered} new gaps registered (${res.total_open_gaps} total open)`);
      loadCoverage();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleRemediateGap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGap) return;
    setSaving(true);
    try {
      await api.post(`/coverage/gaps/${selectedGap.id}/remediate`, {
        actor: 'Security Lead',
        remediation_evidence_ref: remEvidenceRef.trim(),
        remediation_notes: remNotes.trim()
      });
      notify('Gap marked as remediated');
      setShowRemediateModal(false);
      setRemEvidenceRef('');
      setRemNotes('');
      loadCoverage();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptGap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGap || !acceptApprover.trim() || !acceptExpiry) return;
    setSaving(true);
    try {
      await api.post(`/coverage/gaps/${selectedGap.id}/accept`, {
        approver: acceptApprover.trim(),
        expiry_date: acceptExpiry,
        rationale: acceptRationale.trim()
      });
      notify(`Gap accepted by ${acceptApprover} until ${acceptExpiry}`);
      setShowAcceptModal(false);
      setAcceptApprover('');
      setAcceptExpiry('');
      setAcceptRationale('');
      loadCoverage();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseGap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGap) return;
    setSaving(true);
    try {
      await api.post(`/coverage/gaps/${selectedGap.id}/close`, {
        actor: 'CISO',
        closure_note: closureNote.trim() || 'Verified closed.'
      });
      notify('Coverage gap formally closed');
      setShowCloseModal(false);
      setClosureNote('');
      loadCoverage();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    window.open(`/api/coverage/export?format=${format}`, '_blank');
  };

  if (loading && !data) return <Loading label="Evaluating observation-window evidence intervals…" />;
  if (error) return <ErrorState message={error} retry={loadCoverage} />;

  const controlsList = data?.controls || [];
  const filteredControls = controlsList.filter((c: any) => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesQ = !searchQuery || c.control_code?.toLowerCase().includes(searchQuery.toLowerCase()) || c.control_title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQ;
  });

  const categories = data?.categories || {};
  const criteria = data?.criteria || [];

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow="AUDIT PREPARATION"
        title="Coverage Dashboard"
        description="Verify continuous evidence across every day of the SOC 2 Type II observation window and track remediation gaps."
      >
        <button className="button" onClick={() => handleExport('json')}>
          <Download size={13} /> Export Dossier (JSON)
        </button>
        <button className="button" onClick={() => handleExport('csv')}>
          <Download size={13} /> Export CSV
        </button>
        <button className="button button-primary" onClick={handleScanGaps} disabled={scanning}>
          <Sparkles size={13} /> {scanning ? 'Scanning…' : 'Scan for Gaps'}
        </button>
        <button className="button" onClick={loadCoverage} title="Refresh coverage">
          <RefreshCw size={13} />
        </button>
      </PageHeader>

      {/* Observation Window Configuration Banner */}
      {windowCfg && (
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                SOC 2 Type II Observation Window
              </span>
              <span className={`badge ${windowCfg.is_active_window ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
                {windowCfg.current_phase === 'pre_observation' ? 'Pre-Observation' : windowCfg.current_phase === 'active_observation' ? 'Active Window' : 'Completed'}
              </span>
            </div>
            <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>
              {windowCfg.observation_window_start} → {windowCfg.observation_window_end} ({windowCfg.total_days} days)
            </strong>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'flex', gap: '16px' }}>
              <span>Elapsed: <strong style={{ color: 'var(--ink)' }}>{windowCfg.elapsed_days} days</strong></span>
              <span>Remaining: <strong style={{ color: 'var(--ink)' }}>{windowCfg.remaining_days} days</strong></span>
              <span>Point-in-Time Validity: <strong style={{ color: 'var(--ink)' }}>{windowCfg.point_in_time_validity_days || 365} days</strong></span>
            </div>
          </div>

          <button className="button button-sm" onClick={() => setShowWindowModal(true)}>
            <Calendar size={13} /> Configure Window
          </button>
        </div>
      )}

      {/* Overview Metric Row */}
      <div className="grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div className="metric">
          <span>Overall Coverage</span>
          <strong style={{ color: 'var(--accent)' }}>{data?.overall_coverage_percentage}%</strong>
          <small>{data?.covered_controls_count} of {data?.total_controls_count} fully evidenced</small>
        </div>
        <div className="metric">
          <span>Fully Covered</span>
          <strong style={{ color: 'var(--success)' }}>{data?.covered_controls_count}</strong>
          <small>Zero gaps across window</small>
        </div>
        <div className="metric">
          <span>Partial Coverage</span>
          <strong style={{ color: (data?.partial_controls_count || 0) > 0 ? 'var(--warning)' : 'var(--ink)' }}>
            {data?.partial_controls_count}
          </strong>
          <small>Contains interval holes</small>
        </div>
        <div className="metric">
          <span>Missing Evidence</span>
          <strong style={{ color: (data?.missing_controls_count || 0) > 0 ? 'var(--danger)' : 'var(--ink)' }}>
            {data?.missing_controls_count}
          </strong>
          <small>Zero valid proof collected</small>
        </div>
        <div className="metric">
          <span>Registered Gaps</span>
          <strong style={{ color: gaps.filter(g => g.status === 'open').length > 0 ? 'var(--danger)' : 'var(--ink)' }}>
            {gaps.filter(g => g.status === 'open').length}
          </strong>
          <small>Open in gap register</small>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="view-inline" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px' }}>
        <button
          className={`button ${activeTab === 'controls' ? 'button-primary' : ''}`}
          onClick={() => setActiveTab('controls')}
        >
          <Shield size={14} /> Control Coverage & Timelines ({controlsList.length})
        </button>
        <button
          className={`button ${activeTab === 'criteria' ? 'button-primary' : ''}`}
          onClick={() => setActiveTab('criteria')}
        >
          <Layers size={14} /> TSC Criteria Rollups (61 Criteria)
        </button>
        <button
          className={`button ${activeTab === 'gaps' ? 'button-primary' : ''}`}
          onClick={() => setActiveTab('gaps')}
        >
          <AlertTriangle size={14} /> Gap Register ({gaps.length})
        </button>
      </div>

      {/* TAB 1: CONTROLS & TIMELINES */}
      {activeTab === 'controls' && (
        <div>
          <div className="view-inline" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by control code or title…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '260px' }}
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Coverage Statuses</option>
              <option value="covered">Fully Covered</option>
              <option value="partial">Partial Coverage</option>
              <option value="missing">Missing Evidence</option>
            </select>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)', color: 'var(--muted)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Control</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Coverage</th>
                    <th style={{ padding: '10px 14px' }}>Timeline & Covered Days</th>
                    <th style={{ padding: '10px 14px' }}>Gaps & Degradations</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredControls.map((c: any) => {
                    const isCovered = c.status === 'covered';
                    const isPartial = c.status === 'partial';
                    const isMissing = c.status === 'missing';

                    return (
                      <tr key={c.control_id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 14px', maxWidth: '300px' }}>
                          <button
                            className="link-button mono"
                            style={{ fontWeight: 700, fontSize: '12px', display: 'block', marginBottom: '2px' }}
                            onClick={() => onNavigate('controls', c.control_id)}
                          >
                            {c.control_code || c.control_id}
                          </button>
                          <span style={{ fontSize: '12px', color: 'var(--ink)' }}>{c.control_title}</span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <Badge value={c.status} />
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <strong style={{ color: isCovered ? 'var(--success)' : isPartial ? 'var(--warning)' : 'var(--danger)' }}>
                            {c.coverage_percentage}%
                          </strong>
                          <small style={{ display: 'block', color: 'var(--muted)' }}>
                            {c.covered_days} / {c.total_days} days
                          </small>
                        </td>
                        <td style={{ padding: '12px 14px', minWidth: '180px' }}>
                          {/* Visual timeline bar */}
                          <div style={{ height: '8px', background: 'rgba(255, 107, 107, 0.25)', borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' }}>
                            <div style={{
                              width: `${c.coverage_percentage}%`,
                              height: '100%',
                              background: isCovered ? 'var(--success)' : 'var(--warning)',
                              borderRadius: '4px'
                            }} />
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                            {c.evidence_count} evidence artifact(s)
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '11px' }}>
                          {c.gaps?.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
                              {c.gaps.map((g: any, idx: number) => (
                                <span key={idx} style={{ color: 'var(--danger)' }}>
                                  ⚠️ {g.start} → {g.end} ({g.days} days)
                                </span>
                              ))}
                            </div>
                          )}
                          {c.degradation_reasons?.map((r: string, idx: number) => (
                            <span key={idx} style={{ color: 'var(--warning)', display: 'block' }}>
                              ⚡ {r}
                            </span>
                          ))}
                          {c.gaps?.length === 0 && (!c.degradation_reasons || c.degradation_reasons.length === 0) && (
                            <span style={{ color: 'var(--success)' }}>✓ Complete observation coverage</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CRITERIA ROLLUPS */}
      {activeTab === 'criteria' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            {Object.entries(categories).map(([catName, stats]: [string, any]) => (
              <div key={catName} className="card" style={{ marginBottom: 0 }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  {catName}
                </span>
                <strong style={{ fontSize: '20px', display: 'block', margin: '4px 0', color: stats.covered_criteria === stats.total_criteria ? 'var(--success)' : 'var(--warning)' }}>
                  {stats.covered_criteria} / {stats.total_criteria} Covered
                </strong>
                <small style={{ color: 'var(--muted)' }}>
                  {stats.covered_controls} of {stats.controls_count} mapped controls verified
                </small>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div className="view-row" style={{ padding: '12px 16px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
              <strong style={{ fontSize: '13px' }}>61 Trust Services Criteria Coverage Status</strong>
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                    <th style={{ padding: '8px 12px' }}>Criterion</th>
                    <th style={{ padding: '8px 12px' }}>Category</th>
                    <th style={{ padding: '8px 12px' }}>Controls</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((crit: any) => (
                    <tr key={crit.criterion_code} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span className="mono" style={{ fontWeight: 700, color: 'var(--ink)', marginRight: '8px' }}>
                          {crit.criterion_code}
                        </span>
                        <span>{crit.criterion_title}</span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{crit.category}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {crit.covered_controls_count} / {crit.controls_count}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <Badge value={crit.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GAP REGISTER */}
      {activeTab === 'gaps' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="view-row" style={{ padding: '12px 18px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ fontSize: '13px' }}>Coverage Gap Register ({gaps.length})</strong>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
                Gaps cannot auto-close without explicit remediation or formal risk acceptance.
              </p>
            </div>
            <button className="button button-sm button-primary" onClick={handleScanGaps} disabled={scanning}>
              <Sparkles size={12} /> Scan Gaps
            </button>
          </div>

          {gaps.length === 0 ? (
            <p style={{ padding: '24px', color: 'var(--muted)', fontSize: '12px' }}>No gaps currently registered.</p>
          ) : (
            <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                    <th style={{ padding: '8px 12px' }}>Control ID</th>
                    <th style={{ padding: '8px 12px' }}>Gap Interval</th>
                    <th style={{ padding: '8px 12px' }}>Days</th>
                    <th style={{ padding: '8px 12px' }}>Reason</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th style={{ padding: '8px 12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g: any) => (
                    <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {g.control_id}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--danger)' }}>
                        {g.gap_start} → {g.gap_end}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{g.days}</td>
                      <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>
                        {g.reason?.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <Badge value={g.status} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {g.status === 'open' && (
                            <>
                              <button
                                className="button button-sm button-primary"
                                style={{ padding: '2px 8px', fontSize: '11px' }}
                                onClick={() => { setSelectedGap(g); setShowRemediateModal(true); }}
                              >
                                Remediate
                              </button>
                              <button
                                className="button button-sm"
                                style={{ padding: '2px 8px', fontSize: '11px' }}
                                onClick={() => { setSelectedGap(g); setShowAcceptModal(true); }}
                              >
                                Accept
                              </button>
                            </>
                          )}
                          {g.status !== 'closed' && (
                            <button
                              className="button button-sm"
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                              onClick={() => { setSelectedGap(g); setShowCloseModal(true); }}
                            >
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONFIGURE WINDOW MODAL */}
      {showWindowModal && (
        <Dialog title="Configure Audit Observation Window" subtitle="Audit scoping: Modifying the window after evidence exists requires formal confirmation." onClose={() => setShowWindowModal(false)}>
          <form onSubmit={handleUpdateWindow}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="view-grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="field">
                  <span>Window Start Date *</span>
                  <input type="date" required value={winStart} onChange={e => setWinStart(e.target.value)} />
                </div>
                <div className="field">
                  <span>Window End Date *</span>
                  <input type="date" required value={winEnd} onChange={e => setWinEnd(e.target.value)} />
                </div>
              </div>

              <div style={{ background: 'rgba(243, 194, 120, 0.15)', border: '1px solid var(--warning)', borderRadius: '6px', padding: '10px 14px', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={confirmWinChange}
                    onChange={e => setConfirmWinChange(e.target.checked)}
                  />
                  <span>I confirm this audit observation window adjustment and understand it recalculates all evidence intervals.</span>
                </label>
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowWindowModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? 'Updating…' : 'Update Window'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* REMEDIATE GAP MODAL */}
      {showRemediateModal && selectedGap && (
        <Dialog title="Remediate Coverage Gap" subtitle={`Link retroactive or updated evidence for ${selectedGap.control_id}.`} onClose={() => setShowRemediateModal(false)}>
          <form onSubmit={handleRemediateGap}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Remediation Evidence Ref / ID</span>
                <input type="text" placeholder="e.g. evi-sec-01" value={remEvidenceRef} onChange={e => setRemEvidenceRef(e.target.value)} autoFocus />
              </div>
              <div className="field">
                <span>Remediation Notes</span>
                <textarea rows={3} placeholder="Explain how this gap was addressed..." value={remNotes} onChange={e => setRemNotes(e.target.value)} />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowRemediateModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? 'Submitting…' : 'Mark Remediated'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ACCEPT GAP MODAL */}
      {showAcceptModal && selectedGap && (
        <Dialog title="Accept Coverage Gap" subtitle="Formal executive sign-off with Segregation of Duties." onClose={() => setShowAcceptModal(false)}>
          <form onSubmit={handleAcceptGap}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Executive Approver *</span>
                <input type="text" required placeholder="e.g. ciso@tofrom.com" value={acceptApprover} onChange={e => setAcceptApprover(e.target.value)} autoFocus />
              </div>
              <div className="field">
                <span>Acceptance Expiry Date *</span>
                <input type="date" required value={acceptExpiry} onChange={e => setAcceptExpiry(e.target.value)} />
              </div>
              <div className="field">
                <span>Acceptance Rationale *</span>
                <textarea rows={3} required placeholder="Document why this gap is tolerated..." value={acceptRationale} onChange={e => setAcceptRationale(e.target.value)} />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowAcceptModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !acceptApprover.trim() || !acceptExpiry}>
                {saving ? 'Approving…' : 'Confirm Acceptance'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* CLOSE GAP MODAL */}
      {showCloseModal && selectedGap && (
        <Dialog title="Close Coverage Gap" subtitle="Formally mark gap as resolved." onClose={() => setShowCloseModal(false)}>
          <form onSubmit={handleCloseGap}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Closure Note *</span>
                <textarea rows={3} required placeholder="Confirm verification details..." value={closureNote} onChange={e => setClosureNote(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowCloseModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !closureNote.trim()}>
                {saving ? 'Closing…' : 'Confirm Closure'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
