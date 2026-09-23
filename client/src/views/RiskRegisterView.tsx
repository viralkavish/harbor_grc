import { useEffect, useState } from 'react';
import {
  AlertTriangle, Shield, CheckCircle2, XCircle, Clock, Play, Plus,
  FileText, ArrowRight, UserCheck, RefreshCw, Layers, CheckSquare,
  Sparkles, ExternalLink, Calendar, HelpCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, formatDate } from '../components/ui';
import { Dialog } from '../components/Dialog';
import type { Notify, Navigate } from '../lib/types';

export function RiskRegisterView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [data, setData] = useState<any | null>(null);
  const [matrixData, setMatrixData] = useState<any | null>(null);
  const [reviewsDue, setReviewsDue] = useState<any | null>(null);
  const [controls, setControls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tab & Filters
  const [activeTab, setActiveTab] = useState<'register' | 'matrix' | 'minutes'>('register');
  const [matrixMode, setMatrixMode] = useState<'inherent' | 'residual'>('inherent');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Risk & Detail Drawer
  const [selectedRisk, setSelectedRisk] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showMinutesModal, setShowMinutesModal] = useState(false);

  // Form States - Create/Edit
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('security');
  const [formOwner, setFormOwner] = useState('');
  const [formLikelihood, setFormLikelihood] = useState(3);
  const [formImpact, setFormImpact] = useState(3);
  const [formResLikelihood, setFormResLikelihood] = useState(2);
  const [formResImpact, setFormResImpact] = useState(2);
  const [formTreatment, setFormTreatment] = useState('mitigate');
  const [formTreatmentPlan, setFormTreatmentPlan] = useState('');
  const [formControls, setFormControls] = useState<string[]>([]);
  const [formCadence, setFormCadence] = useState(90);

  // Form States - Workflows
  const [acceptApprover, setAcceptApprover] = useState('');
  const [acceptExpiry, setAcceptExpiry] = useState('');
  const [acceptRationale, setAcceptRationale] = useState('');
  const [reviewDecision, setReviewDecision] = useState('scores_unchanged');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewNewRL, setReviewNewRL] = useState(2);
  const [reviewNewRI, setReviewNewRI] = useState(2);
  const [closureRationale, setClosureRationale] = useState('');
  const [reopenReason, setReopenReason] = useState('');

  // Minutes Form
  const [minutesTitle, setMinutesTitle] = useState('Q1 2027 Executive Risk Committee Assessment');
  const [minutesDate, setMinutesDate] = useState(new Date().toISOString().split('T')[0]);
  const [minutesAttendees, setMinutesAttendees] = useState('Chief Information Security Officer, VP Engineering, Legal Counsel');
  const [minutesChair, setMinutesChair] = useState('Chief Information Security Officer');
  const [minutesDecisions, setMinutesDecisions] = useState('Reviewed 5x5 heatmap distribution, approved 2 risk treatments, verified zero unmitigated critical risks.');
  const [minutesResult, setMinutesResult] = useState<any | null>(null);

  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [risksRes, matrixRes, dueRes, ctrlRes] = await Promise.all([
        api.get('/risks'),
        api.get('/risks/matrix'),
        api.get('/risks/reviews_due').catch(() => null),
        api.get('/controls').catch(() => ({ items: [] }))
      ]);
      setData(risksRes);
      setMatrixData(matrixRes);
      setReviewsDue(dueRes);
      setControls(ctrlRes.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      await api.post('/risks', {
        title: formTitle.trim(),
        description: formDesc.trim(),
        category: formCategory,
        owner: formOwner.trim(),
        likelihood: Number(formLikelihood),
        impact: Number(formImpact),
        residual_likelihood: Number(formResLikelihood),
        residual_impact: Number(formResImpact),
        treatment: formTreatment,
        treatment_plan: formTreatmentPlan.trim(),
        mitigating_control_refs: formControls,
        review_cadence_days: Number(formCadence)
      });
      notify('Risk registered and scored successfully');
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRisk || !acceptApprover.trim() || !acceptExpiry) return;
    setSaving(true);
    try {
      await api.post(`/risks/${selectedRisk.id}/accept`, {
        approver: acceptApprover.trim(),
        expiry_date: acceptExpiry,
        acceptance_rationale: acceptRationale.trim()
      });
      notify(`Risk accepted by ${acceptApprover} until ${acceptExpiry}`);
      setShowAcceptModal(false);
      setAcceptApprover('');
      setAcceptExpiry('');
      setAcceptRationale('');
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReviewRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRisk) return;
    setSaving(true);
    try {
      await api.post(`/risks/${selectedRisk.id}/review`, {
        reviewer: 'Risk Committee',
        decision: reviewDecision,
        notes: reviewNotes.trim(),
        new_residual_likelihood: reviewDecision === 're_scored' ? Number(reviewNewRL) : undefined,
        new_residual_impact: reviewDecision === 're_scored' ? Number(reviewNewRI) : undefined
      });
      notify('Formal risk review recorded in immutable history');
      setShowReviewModal(false);
      setReviewNotes('');
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRisk || !closureRationale.trim()) return;
    setSaving(true);
    try {
      await api.post(`/risks/${selectedRisk.id}/close`, {
        actor: 'Security Lead',
        closure_rationale: closureRationale.trim()
      });
      notify('Risk formally closed');
      setShowCloseModal(false);
      setClosureRationale('');
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReopenRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRisk || !reopenReason.trim()) return;
    setSaving(true);
    try {
      await api.post(`/risks/${selectedRisk.id}/reopen`, {
        actor: 'Security Lead',
        reason: reopenReason.trim()
      });
      notify('Risk re-opened for treatment');
      setShowReopenModal(false);
      setReopenReason('');
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateMinutes = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const attList = minutesAttendees.split(',').map(s => s.trim()).filter(Boolean);
      const res = await api.post('/risks/assessment_minutes', {
        meeting_title: minutesTitle.trim(),
        meeting_date: minutesDate,
        attendees: attList,
        chair: minutesChair.trim(),
        decisions_summary: minutesDecisions.trim()
      });
      setMinutesResult(res);
      notify('Executive Risk Assessment Minutes generated and filed to audit records.');
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormCategory('security');
    setFormOwner('');
    setFormLikelihood(3);
    setFormImpact(3);
    setFormResLikelihood(2);
    setFormResImpact(2);
    setFormTreatment('mitigate');
    setFormTreatmentPlan('');
    setFormControls([]);
    setFormCadence(90);
  };

  if (loading && !data) return <Loading label="Loading Enterprise Risk Register…" />;
  if (error) return <ErrorState message={error} retry={loadData} />;

  const risks = data?.items || [];
  const filteredRisks = risks.filter((r: any) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesCat = categoryFilter === 'all' || r.category === categoryFilter;
    const matchesQ = !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCat && matchesQ;
  });

  const getScoreColor = (score: number) => {
    if (!score) return 'var(--muted)';
    if (score >= 20) return 'var(--danger)';
    if (score >= 12) return 'var(--warning)';
    if (score >= 6) return '#eab308';
    return 'var(--success)';
  };

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow="GOVERN & ASSESS"
        title="Enterprise Risk Register"
        description="Comprehensive 5×5 Likelihood & Impact scoring, R1 mitigating controls linkage, treatment plans, and assessment minutes."
      >
        <button className="button" onClick={() => setShowMinutesModal(true)}>
          <FileText size={14} /> Assessment Minutes (GV.1)
        </button>
        <button className="button button-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={14} /> New Risk
        </button>
        <button className="button" onClick={loadData} title="Refresh risk register">
          <RefreshCw size={14} />
        </button>
      </PageHeader>

      {/* Metrics Header Cards */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="metric">
          <span>Active Risks</span>
          <strong style={{ color: 'var(--ink)' }}>{data?.open_count ?? 0}</strong>
          <small>{risks.length} recorded total</small>
        </div>
        <div className="metric">
          <span>Critical / High Risks (≥ 12)</span>
          <strong style={{ color: (data?.high_count ?? 0) > 0 ? 'var(--danger)' : 'var(--ink)' }}>
            {data?.high_count ?? 0}
          </strong>
          <small>Inherent score ≥ 12</small>
        </div>
        <div className="metric">
          <span>Exceeds Risk Appetite</span>
          <strong style={{ color: (data?.exceeds_appetite_count ?? 0) > 0 ? 'var(--warning)' : 'var(--ink)' }}>
            {data?.exceeds_appetite_count ?? 0}
          </strong>
          <small>Threshold: score ≥ 12</small>
        </div>
        <div className="metric">
          <span>Overdue Reviews</span>
          <strong style={{ color: (data?.overdue_reviews_count ?? 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {data?.overdue_reviews_count ?? 0}
          </strong>
          <small>Review SLA cadence</small>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="view-inline" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px' }}>
        <button
          className={`button ${activeTab === 'register' ? 'button-primary' : ''}`}
          onClick={() => setActiveTab('register')}
        >
          <AlertTriangle size={14} /> Risk Register ({risks.length})
        </button>
        <button
          className={`button ${activeTab === 'matrix' ? 'button-primary' : ''}`}
          onClick={() => setActiveTab('matrix')}
        >
          <Layers size={14} /> 5×5 Risk Matrix Heatmap
        </button>
        <button
          className={`button ${activeTab === 'minutes' ? 'button-primary' : ''}`}
          onClick={() => setActiveTab('minutes')}
        >
          <FileText size={14} /> Assessment Minutes (PBC GV.1)
        </button>
      </div>

      {/* TAB 1: RISK REGISTER TABLE */}
      {activeTab === 'register' && (
        <div>
          {/* Filter Bar */}
          <div className="view-inline" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search risks by title or description…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '260px' }}
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_treatment">In Treatment</option>
              <option value="monitored">Monitored</option>
              <option value="closed">Closed</option>
            </select>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              <option value="security">Security</option>
              <option value="operational">Operational</option>
              <option value="compliance">Compliance</option>
              <option value="privacy">Privacy</option>
              <option value="third-party">Third-Party</option>
              <option value="strategic">Strategic</option>
              <option value="financial">Financial</option>
            </select>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)', color: 'var(--muted)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Risk Title</th>
                    <th style={{ padding: '10px 14px' }}>Category</th>
                    <th style={{ padding: '10px 14px' }}>Owner</th>
                    <th style={{ padding: '10px 14px' }}>Inherent</th>
                    <th style={{ padding: '10px 14px' }}>Residual</th>
                    <th style={{ padding: '10px 14px' }}>Treatment</th>
                    <th style={{ padding: '10px 14px' }}>Mitigating Controls</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRisks.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                        No risks matching selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRisks.map((r: any) => {
                      const isOverdue = r.next_review_at && new Date(r.next_review_at) < new Date() && r.status !== 'closed';
                      const isUnmitigated = r.treatment === 'mitigate' && (!r.mitigating_control_refs || r.mitigating_control_refs.length === 0);

                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <strong style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>{r.title}</strong>
                            {isUnmitigated && (
                              <span style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 600 }}>
                                ⚠️ Unmitigated (No controls linked)
                              </span>
                            )}
                            {isOverdue && (
                              <span style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: 600, display: 'block' }}>
                                ⏱️ Review Overdue ({r.next_review_at})
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{r.category}</span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>{r.owner || 'Unassigned'}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span className="mono" style={{ fontWeight: 700, color: getScoreColor(r.inherent_score) }}>
                              {r.inherent_score ? `${r.inherent_score} (${r.likelihood}×${r.impact})` : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span className="mono" style={{ fontWeight: 700, color: getScoreColor(r.residual_score) }}>
                              {r.residual_score ? `${r.residual_score} (${r.residual_likelihood}×${r.residual_impact})` : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{r.treatment}</span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {r.mitigating_control_refs?.map((cid: string) => (
                                <button
                                  key={cid}
                                  className="link-button mono"
                                  style={{ fontSize: '11px' }}
                                  onClick={() => onNavigate('controls', cid)}
                                >
                                  {cid}
                                </button>
                              ))}
                              {(!r.mitigating_control_refs || r.mitigating_control_refs.length === 0) && (
                                <span style={{ color: 'var(--muted)', fontSize: '11px' }}>None</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <Badge value={r.status} />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                className="button button-sm"
                                style={{ padding: '2px 8px', fontSize: '11px' }}
                                onClick={() => { setSelectedRisk(r); setShowDetailModal(true); }}
                              >
                                Details
                              </button>
                              {r.status === 'open' && r.treatment === 'accept' && (
                                <button
                                  className="button button-sm button-primary"
                                  style={{ padding: '2px 8px', fontSize: '11px' }}
                                  onClick={() => { setSelectedRisk(r); setShowAcceptModal(true); }}
                                >
                                  Accept
                                </button>
                              )}
                              {r.status !== 'closed' && (
                                <button
                                  className="button button-sm"
                                  style={{ padding: '2px 8px', fontSize: '11px' }}
                                  onClick={() => { setSelectedRisk(r); setShowReviewModal(true); }}
                                >
                                  Review
                                </button>
                              )}
                              {r.status !== 'closed' && (
                                <button
                                  className="button button-sm"
                                  style={{ padding: '2px 8px', fontSize: '11px' }}
                                  onClick={() => { setSelectedRisk(r); setShowCloseModal(true); }}
                                >
                                  Close
                                </button>
                              )}
                              {r.status === 'closed' && (
                                <button
                                  className="button button-sm"
                                  style={{ padding: '2px 8px', fontSize: '11px' }}
                                  onClick={() => { setSelectedRisk(r); setShowReopenModal(true); }}
                                >
                                  Reopen
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 5x5 HEATMAP */}
      {activeTab === 'matrix' && matrixData && (
        <div className="card" style={{ maxWidth: '800px' }}>
          <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>5×5 Likelihood & Impact Risk Matrix</h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Scores ≥ 12 exceed organizational risk appetite threshold and require formal executive mitigation.
              </p>
            </div>
            <div className="view-inline" style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`button button-sm ${matrixMode === 'inherent' ? 'button-primary' : ''}`}
                onClick={() => setMatrixMode('inherent')}
              >
                Inherent Risks
              </button>
              <button
                className={`button button-sm ${matrixMode === 'residual' ? 'button-primary' : ''}`}
                onClick={() => setMatrixMode('residual')}
              >
                Residual Risks
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(5, 1fr)', gap: '6px', textAlign: 'center', fontSize: '12px' }}>
            <div style={{ gridColumn: '2 / -1', padding: '6px', fontWeight: 600, color: 'var(--muted)' }}>
              Impact (1: Insignificant → 5: Catastrophic)
            </div>

            {/* Matrix Rows (Likelihood 5 down to 1) */}
            {[5, 4, 3, 2, 1].map(l => (
              <>
                <div key={`label_${l}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--muted)' }}>
                  L-{l}
                </div>
                {[1, 2, 3, 4, 5].map(imp => {
                  const score = l * imp;
                  const count = matrixMode === 'inherent' ? matrixData.inherent_grid[`${l}_${imp}`] : matrixData.residual_grid[`${l}_${imp}`];
                  const bg = score >= 20 ? 'rgba(255, 107, 107, 0.3)' : score >= 12 ? 'rgba(243, 194, 120, 0.3)' : score >= 6 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(115, 217, 177, 0.2)';
                  const border = score >= 12 ? '1px solid var(--danger)' : '1px solid var(--border)';

                  return (
                    <div
                      key={`${l}_${imp}`}
                      style={{
                        background: bg,
                        border: border,
                        borderRadius: '6px',
                        padding: '14px 6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>{count}</strong>
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--muted)' }}>Score {score}</span>
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RISK ASSESSMENT MINUTES */}
      {activeTab === 'minutes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Executive Risk Assessment Minutes Generator (PBC GV.1)</h3>
                <p className="card-description">
                  Generate formal, signed-off risk assessment minutes summarizing registered risks, heatmap scores, treatments, and committee decisions.
                </p>
              </div>
            </div>

            <form onSubmit={handleGenerateMinutes}>
              <div className="view-grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="field">
                  <span>Meeting Title *</span>
                  <input type="text" required value={minutesTitle} onChange={e => setMinutesTitle(e.target.value)} />
                </div>
                <div className="field">
                  <span>Assessment Date *</span>
                  <input type="date" required value={minutesDate} onChange={e => setMinutesDate(e.target.value)} />
                </div>
                <div className="field">
                  <span>Committee Chair *</span>
                  <input type="text" required value={minutesChair} onChange={e => setMinutesChair(e.target.value)} />
                </div>
                <div className="field">
                  <span>Attendees (comma-separated) *</span>
                  <input type="text" required value={minutesAttendees} onChange={e => setMinutesAttendees(e.target.value)} />
                </div>
              </div>

              <div className="field" style={{ marginBottom: '16px' }}>
                <span>Executive Decisions & Governance Summary *</span>
                <textarea rows={3} required value={minutesDecisions} onChange={e => setMinutesDecisions(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="button button-primary" disabled={saving}>
                  <Sparkles size={14} /> {saving ? 'Generating Minutes…' : 'Generate & File Assessment Minutes'}
                </button>
              </div>
            </form>
          </div>

          {minutesResult && (
            <div className="card">
              <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <strong style={{ fontSize: '15px' }}>{minutesResult.meeting_title}</strong>
                <span className="mono" style={{ fontSize: '12px', color: 'var(--muted)' }}>{minutesResult.meeting_date}</span>
              </div>
              <pre style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px', fontSize: '11px', fontFamily: 'var(--font-mono)', maxHeight: '350px', overflowY: 'auto' }}>
                {JSON.stringify(minutesResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* CREATE RISK MODAL */}
      {showCreateModal && (
        <Dialog title="Register New Operational / Security Risk" subtitle="Inherent and residual scores are strictly calculated server-side." onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreateRisk}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="field">
                <span>Risk Title *</span>
                <input type="text" required placeholder="e.g. Inadequate Database Egress Controls" value={formTitle} onChange={e => setFormTitle(e.target.value)} autoFocus />
              </div>
              <div className="view-grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="field">
                  <span>Category *</span>
                  <select value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                    <option value="security">Security</option>
                    <option value="operational">Operational</option>
                    <option value="compliance">Compliance</option>
                    <option value="privacy">Privacy</option>
                    <option value="third-party">Third-Party</option>
                    <option value="strategic">Strategic</option>
                    <option value="financial">Financial</option>
                  </select>
                </div>
                <div className="field">
                  <span>Owner Email / Role</span>
                  <input type="text" placeholder="e.g. ciso@tofrom.com" value={formOwner} onChange={e => setFormOwner(e.target.value)} />
                </div>
              </div>

              <div className="view-grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--surface-raised)', padding: '10px', borderRadius: '6px' }}>
                <div className="field">
                  <span>Inherent Likelihood (1-5) *</span>
                  <select value={formLikelihood} onChange={e => setFormLikelihood(Number(e.target.value))}>
                    <option value={1}>1 - Rare (&lt; 5%)</option>
                    <option value={2}>2 - Unlikely (5-20%)</option>
                    <option value={3}>3 - Possible (20-50%)</option>
                    <option value={4}>4 - Likely (50-80%)</option>
                    <option value={5}>5 - Almost Certain (&gt; 80%)</option>
                  </select>
                </div>
                <div className="field">
                  <span>Inherent Impact (1-5) *</span>
                  <select value={formImpact} onChange={e => setFormImpact(Number(e.target.value))}>
                    <option value={1}>1 - Insignificant</option>
                    <option value={2}>2 - Minor</option>
                    <option value={3}>3 - Moderate</option>
                    <option value={4}>4 - Major</option>
                    <option value={5}>5 - Catastrophic</option>
                  </select>
                </div>
              </div>

              <div className="view-grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--surface-raised)', padding: '10px', borderRadius: '6px' }}>
                <div className="field">
                  <span>Residual Likelihood (1-5)</span>
                  <select value={formResLikelihood} onChange={e => setFormResLikelihood(Number(e.target.value))}>
                    <option value={1}>1 - Rare</option>
                    <option value={2}>2 - Unlikely</option>
                    <option value={3}>3 - Possible</option>
                    <option value={4}>4 - Likely</option>
                    <option value={5}>5 - Almost Certain</option>
                  </select>
                </div>
                <div className="field">
                  <span>Residual Impact (1-5)</span>
                  <select value={formResImpact} onChange={e => setFormResImpact(Number(e.target.value))}>
                    <option value={1}>1 - Insignificant</option>
                    <option value={2}>2 - Minor</option>
                    <option value={3}>3 - Moderate</option>
                    <option value={4}>4 - Major</option>
                    <option value={5}>5 - Catastrophic</option>
                  </select>
                </div>
              </div>

              <div className="view-grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="field">
                  <span>Treatment Strategy *</span>
                  <select value={formTreatment} onChange={e => setFormTreatment(e.target.value)}>
                    <option value="mitigate">Mitigate</option>
                    <option value="accept">Accept</option>
                    <option value="transfer">Transfer</option>
                    <option value="avoid">Avoid</option>
                  </select>
                </div>
                <div className="field">
                  <span>Review Cadence (Days)</span>
                  <input type="number" value={formCadence} onChange={e => setFormCadence(Number(e.target.value))} />
                </div>
              </div>

              <div className="field">
                <span>Treatment Plan</span>
                <textarea rows={2} placeholder="Explain remediation actions..." value={formTreatmentPlan} onChange={e => setFormTreatmentPlan(e.target.value)} />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !formTitle.trim()}>
                {saving ? 'Creating…' : 'Register Risk'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* DETAIL MODAL */}
      {showDetailModal && selectedRisk && (
        <Dialog title={`Risk Detail: ${selectedRisk.title}`} wide onClose={() => setShowDetailModal(false)}>
          <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="grid-3">
              <div style={{ background: 'var(--surface-raised)', padding: '10px 14px', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Inherent Score</span>
                <strong style={{ fontSize: '16px', color: getScoreColor(selectedRisk.inherent_score) }}>
                  {selectedRisk.inherent_score} ({selectedRisk.likelihood}×{selectedRisk.impact})
                </strong>
              </div>
              <div style={{ background: 'var(--surface-raised)', padding: '10px 14px', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Residual Score</span>
                <strong style={{ fontSize: '16px', color: getScoreColor(selectedRisk.residual_score) }}>
                  {selectedRisk.residual_score} ({selectedRisk.residual_likelihood}×{selectedRisk.residual_impact})
                </strong>
              </div>
              <div style={{ background: 'var(--surface-raised)', padding: '10px 14px', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Risk Appetite</span>
                <span className={`badge ${selectedRisk.risk_appetite === 'exceeds' ? 'badge-danger' : 'badge-success'}`}>
                  {selectedRisk.risk_appetite === 'exceeds' ? 'Exceeds Threshold' : 'Within Appetite'}
                </span>
              </div>
            </div>

            <div>
              <strong style={{ fontSize: '13px' }}>Treatment Plan:</strong>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                {selectedRisk.treatment_plan || 'No treatment plan documented.'}
              </p>
            </div>

            <div>
              <strong style={{ fontSize: '13px' }}>Mitigating Controls:</strong>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                {selectedRisk.mitigating_control_refs?.map((cid: string) => (
                  <span key={cid} className="badge badge-accent mono">{cid}</span>
                ))}
                {(!selectedRisk.mitigating_control_refs || selectedRisk.mitigating_control_refs.length === 0) && (
                  <span style={{ fontSize: '12px', color: 'var(--danger)' }}>No controls mapped.</span>
                )}
              </div>
            </div>

            {/* Review History */}
            {selectedRisk.review_history?.length > 0 && (
              <div>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>Review History:</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedRisk.review_history.map((h: any, idx: number) => (
                    <div key={idx} style={{ background: 'var(--surface-raised)', padding: '8px 12px', borderRadius: '4px', fontSize: '11px' }}>
                      <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <strong>{h.reviewer} ({h.decision})</strong>
                        <span className="mono" style={{ color: 'var(--muted)' }}>{formatDate(h.date)}</span>
                      </div>
                      <span style={{ color: 'var(--muted)' }}>{h.notes}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="dialog-footer">
            <button type="button" className="button" onClick={() => setShowDetailModal(false)}>Close</button>
          </div>
        </Dialog>
      )}

      {/* ACCEPT MODAL */}
      {showAcceptModal && selectedRisk && (
        <Dialog title="Formal Executive Risk Acceptance" subtitle="Segregation of Duties: Approver must be distinct from risk owner." onClose={() => setShowAcceptModal(false)}>
          <form onSubmit={handleAcceptRisk}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Executive Approver *</span>
                <input type="text" required placeholder="e.g. ciso@tofrom.com" value={acceptApprover} onChange={e => setAcceptApprover(e.target.value)} autoFocus />
                <small style={{ color: 'var(--muted)', fontSize: '10px' }}>Cannot match risk owner ({selectedRisk.owner || 'Owner'}).</small>
              </div>
              <div className="field">
                <span>Acceptance Expiry Date *</span>
                <input type="date" required value={acceptExpiry} onChange={e => setAcceptExpiry(e.target.value)} />
                <small style={{ color: 'var(--muted)', fontSize: '10px' }}>Risk acceptances automatically re-open upon expiration.</small>
              </div>
              <div className="field">
                <span>Acceptance Rationale *</span>
                <textarea rows={3} required placeholder="Detail the business justification for accepting this risk..." value={acceptRationale} onChange={e => setAcceptRationale(e.target.value)} />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowAcceptModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !acceptApprover.trim() || !acceptExpiry}>
                {saving ? 'Approving…' : 'Confirm Risk Acceptance'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* REVIEW MODAL */}
      {showReviewModal && selectedRisk && (
        <Dialog title="Record Risk Review" subtitle="Reviews are immutable and update next scheduled review SLA." onClose={() => setShowReviewModal(false)}>
          <form onSubmit={handleReviewRisk}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Review Decision *</span>
                <select value={reviewDecision} onChange={e => setReviewDecision(e.target.value)}>
                  <option value="scores_unchanged">Scores Unchanged</option>
                  <option value="re_scored">Re-score Residual Risk</option>
                  <option value="treatment_updated">Treatment Plan Updated</option>
                </select>
              </div>

              {reviewDecision === 're_scored' && (
                <div className="view-grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="field">
                    <span>New Residual Likelihood (1-5)</span>
                    <input type="number" min="1" max="5" value={reviewNewRL} onChange={e => setReviewNewRL(Number(e.target.value))} />
                  </div>
                  <div className="field">
                    <span>New Residual Impact (1-5)</span>
                    <input type="number" min="1" max="5" value={reviewNewRI} onChange={e => setReviewNewRI(Number(e.target.value))} />
                  </div>
                </div>
              )}

              <div className="field">
                <span>Review Notes & Commentary</span>
                <textarea rows={3} placeholder="Document discussion and findings from the risk committee..." value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowReviewModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Record Review'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* CLOSE MODAL */}
      {showCloseModal && selectedRisk && (
        <Dialog title="Close Risk" subtitle="Closed risks require a documented closure rationale." onClose={() => setShowCloseModal(false)}>
          <form onSubmit={handleCloseRisk}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Closure Rationale *</span>
                <textarea rows={3} required placeholder="Confirm mitigating controls are operating effectively..." value={closureRationale} onChange={e => setClosureRationale(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowCloseModal(false)}>Cancel</button>
              <button type="submit" className="button" style={{ background: 'var(--danger)', color: '#fff' }} disabled={saving || !closureRationale.trim()}>
                {saving ? 'Closing…' : 'Confirm Closure'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* REOPEN MODAL */}
      {showReopenModal && selectedRisk && (
        <Dialog title="Reopen Risk" subtitle="Reopening transitions risk to In Treatment." onClose={() => setShowReopenModal(false)}>
          <form onSubmit={handleReopenRisk}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Reopening Reason *</span>
                <textarea rows={3} required placeholder="Explain why this risk has re-emerged..." value={reopenReason} onChange={e => setReopenReason(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowReopenModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !reopenReason.trim()}>
                {saving ? 'Reopening…' : 'Reopen Risk'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
