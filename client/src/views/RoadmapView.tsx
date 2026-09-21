import { useEffect, useState } from 'react';
import {
  Compass, CheckCircle2, Circle, ArrowRight, Sparkles, ExternalLink, RefreshCw,
  Download, Calendar, ShieldCheck, AlertCircle, Clock, Check, FileText, ChevronRight
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Loading, ErrorState, Badge } from '../components/ui';
import type { Notify, Navigate } from '../lib/types';

export function RoadmapView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePhase, setActivePhase] = useState<number>(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [verifyingLive, setVerifyingLive] = useState(false);
  const [showObsSettings, setShowObsSettings] = useState(false);
  const [savingObs, setSavingObs] = useState(false);

  // Observation window form
  const [obsMonths, setObsMonths] = useState(3);
  const [obsStartDate, setObsStartDate] = useState('');
  const [obsEndDate, setObsEndDate] = useState('');
  const [type1Date, setType1Date] = useState('');
  const [obsStatus, setObsStatus] = useState('not_started');

  const loadRoadmap = () => {
    setLoading(true);
    setError('');
    api.get('/roadmap')
      .then((res: any) => {
        setData(res);
        if (res.observation_window) {
          setObsMonths(res.observation_window.window_months || 3);
          setObsStartDate(res.observation_window.start_date || '');
          setObsEndDate(res.observation_window.end_date || '');
          setType1Date(res.observation_window.type1_target_date || '');
          setObsStatus(res.observation_window.status || 'not_started');
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRoadmap();
  }, []);

  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    setTogglingId(taskId);
    try {
      const res = await api.patch(`/roadmap/tasks/${taskId}`, { completed: !currentCompleted });
      setData((prev: any) => {
        if (!prev) return prev;
        const updatedPhases = prev.phases.map((p: any) => ({
          ...p,
          tasks: p.tasks.map((t: any) => (t.id === taskId ? { ...t, completed: !currentCompleted } : t))
        }));
        return {
          ...prev,
          phases: updatedPhases,
          completed_tasks: res.completed_tasks,
          progress_percent: res.progress_percent
        };
      });
      notify(!currentCompleted ? 'Milestone marked complete' : 'Milestone reopened');
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleAutoVerifyLive = async () => {
    setVerifyingLive(true);
    try {
      const res = await api.post('/roadmap/verify_live');
      notify(res.message || 'Live posture verified');
      loadRoadmap();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setVerifyingLive(false);
    }
  };

  const handleSaveObservationWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingObs(true);
    try {
      const res = await api.patch('/roadmap/observation_window', {
        window_months: Number(obsMonths),
        start_date: obsStartDate,
        end_date: obsEndDate,
        type1_target_date: type1Date,
        status: obsStatus
      });
      setData((prev: any) => ({ ...prev, observation_window: res }));
      setShowObsSettings(false);
      notify('Observation window parameters updated');
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSavingObs(false);
    }
  };

  if (loading && !data) return <Loading label="Loading SOC 2 readiness trajectory…" />;
  if (error) return <ErrorState message={error} retry={loadRoadmap} />;

  const phases = data?.phases || [];
  const liveVerification = data?.live_verification;
  const obsWindow = data?.observation_window;

  return (
    <div>
      <PageHeader
        eyebrow="ROADMAP"
        title="SOC 2 Type II Readiness Trajectory"
        description="Comprehensive 6-phase Vanta execution trajectory guiding startups from day-0 setup to automated technical testing, Type 1 evaluation, and the Type 2 observation window."
      >
        <button
          className="button"
          onClick={handleAutoVerifyLive}
          disabled={verifyingLive}
          title="Inspect live database records and auto-verify completed milestones"
        >
          <Sparkles size={14} color="#2563eb" />
          {verifyingLive ? 'Scanning System…' : 'Auto-Verify Live Posture'}
        </button>
        <a
          href="/api/roadmap/export"
          className="button"
          download
          title="Download executive SOC 2 audit readiness roadmap"
        >
          <Download size={14} /> Export Audit Plan (.md)
        </a>
        <button className="button" onClick={loadRoadmap} title="Refresh roadmap">
          <RefreshCw size={14} /> Refresh
        </button>
      </PageHeader>

      {/* Trajectory Progress Banner */}
      <div className="card" style={{ background: '#090d16', color: 'white', padding: '24px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Compass size={20} color="#3b82f6" />
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0 }}>Milestone Completion</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <strong style={{ fontSize: '28px', color: '#60a5fa', fontWeight: 700 }}>
                {data.progress_percent}%
              </strong>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                {data.completed_tasks} of {data.total_tasks} strategic milestones accomplished
              </span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.12)', borderRadius: '3px', overflow: 'hidden', marginTop: '10px' }}>
              <div style={{ width: `${data.progress_percent}%`, height: '100%', background: '#2563eb', borderRadius: '3px', transition: 'width 0.4s ease' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShieldCheck size={20} color="#10b981" />
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0 }}>Automated Evidence Readiness</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <strong style={{ fontSize: '28px', color: '#34d399', fontWeight: 700 }}>
                {liveVerification?.automated_score || 0}%
              </strong>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                Verified by real platform controls & evidence records
              </span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.12)', borderRadius: '3px', overflow: 'hidden', marginTop: '10px' }}>
              <div style={{ width: `${liveVerification?.automated_score || 0}%`, height: '100%', background: '#10b981', borderRadius: '3px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* Live System Posture Strip */}
        {liveVerification?.verified_items && liveVerification.verified_items.length > 0 && (
          <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {liveVerification.verified_items.map((item: string, i: number) => (
              <span
                key={i}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#6ee7b7',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Check size={11} /> {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Startup Day-0 Blueprint Guidance */}
      <div className="card" style={{ background: '#fafcfb', border: '1px solid var(--border)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Sparkles size={20} color="#2563eb" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
              Starting from Scratch? The Day-0 Startup SOC 2 Playbook
            </strong>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.5 }}>
              For early-stage startups, SOC 2 compliance is achieved in 4 fast-track sprints:
              (1) <strong>Delineate Cloud Scope</strong>: Connect Google Workspace + Cloudflare/AWS.
              (2) <strong>Adopt 8 Core Policies</strong>: Use pre-built templates and verify control compatibility via the JEV Control Matcher.
              (3) <strong>Technical Hardening</strong>: Ensure 100% MFA, GitHub PR peer approvals, and encrypted laptops.
              (4) <strong>Launch Observation</strong>: Target a Type 1 report for immediate customer sales, then maintain the 3-month Type 2 observation window.
            </p>
          </div>
        </div>
      </div>

      {/* Observation Window Status Card */}
      {obsWindow && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Clock size={16} color="#2563eb" />
                <h3 className="card-title" style={{ margin: 0 }}>SOC 2 Type II Observation Window Tracker</h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: obsWindow.status === 'in_observation' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                    color: obsWindow.status === 'in_observation' ? '#16a34a' : '#2563eb',
                    border: '1px solid ' + (obsWindow.status === 'in_observation' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(37, 99, 235, 0.2)')
                  }}
                >
                  {obsWindow.status === 'in_observation' ? '● In Observation Period' : '● Preparation & Pre-Audit'}
                </span>
              </div>
              <p className="card-description">
                Continuous compliance monitoring period required by CPA auditors to evaluate operating effectiveness over time without security drift.
              </p>
            </div>
            <button className="button button-sm" onClick={() => setShowObsSettings(!showObsSettings)}>
              {showObsSettings ? 'Hide Settings' : 'Configure Window'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '12px' }}>
            <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Observation Duration</div>
              <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{obsWindow.window_months} Months</strong>
            </div>
            <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Type 1 Target Date</div>
              <strong style={{ fontSize: '15px', color: '#2563eb' }}>{obsWindow.type1_target_date || 'TBD'}</strong>
            </div>
            <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Observation Window</div>
              <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>
                {obsWindow.start_date || 'Start'} → {obsWindow.end_date || 'End'}
              </strong>
            </div>
            <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Drift-Free Days</div>
              <strong style={{ fontSize: '15px', color: '#16a34a' }}>{obsWindow.drift_free_days || 0} Days</strong>
            </div>
          </div>

          {showObsSettings && (
            <form onSubmit={handleSaveObservationWindow} style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="field-grid">
                <div className="field">
                  <span>Observation Window Duration</span>
                  <select value={obsMonths} onChange={e => setObsMonths(Number(e.target.value))}>
                    <option value={3}>3 Months (Standard for Early-Stage Startups)</option>
                    <option value={6}>6 Months (Enterprise Standard)</option>
                    <option value={12}>12 Months (Annual Recertification)</option>
                  </select>
                </div>
                <div className="field">
                  <span>Current Audit Phase</span>
                  <select value={obsStatus} onChange={e => setObsStatus(e.target.value)}>
                    <option value="not_started">Preparation & Scoping</option>
                    <option value="in_observation">Active Observation Window</option>
                    <option value="ready_for_audit">Audit Fieldwork Closeout</option>
                  </select>
                </div>
              </div>

              <div className="field-grid">
                <div className="field">
                  <span>Type 1 Target Evaluation Date</span>
                  <input type="date" value={type1Date} onChange={e => setType1Date(e.target.value)} />
                </div>
                <div className="field">
                  <span>Observation Start Date</span>
                  <input type="date" value={obsStartDate} onChange={e => setObsStartDate(e.target.value)} />
                </div>
                <div className="field">
                  <span>Observation End Date</span>
                  <input type="date" value={obsEndDate} onChange={e => setObsEndDate(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="button" onClick={() => setShowObsSettings(false)}>Cancel</button>
                <button type="submit" className="button button-primary" disabled={savingObs}>
                  {savingObs ? 'Saving…' : 'Save Parameters'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Phase Selector Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '24px' }}>
        {phases.map((p: any) => {
          const completedCount = p.tasks.filter((t: any) => t.completed).length;
          const isCurrent = activePhase === p.phase;
          const isDone = completedCount === p.tasks.length;
          return (
            <div
              key={p.phase}
              onClick={() => setActivePhase(p.phase)}
              style={{
                padding: '14px 12px',
                borderRadius: '8px',
                background: isCurrent ? 'white' : '#fafcfb',
                border: isCurrent ? '2px solid #2563eb' : '1px solid var(--border)',
                cursor: 'pointer',
                boxShadow: isCurrent ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span className="mono" style={{ fontSize: '11px', fontWeight: 700, color: isCurrent ? '#2563eb' : 'var(--muted)' }}>
                  Phase {p.phase}
                </span>
                {isDone ? (
                  <CheckCircle2 size={14} color="#16a34a" />
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{completedCount}/{p.tasks.length}</span>
                )}
              </div>
              <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.title.split(':')[1]?.split('(')[0] || p.title}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Phase Tasks Detail */}
      {phases.filter((p: any) => p.phase === activePhase).map((phase: any) => (
        <div key={phase.phase} className="card">
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{phase.title}</h2>
                <span style={{ fontSize: '12px', color: 'var(--muted)', background: 'var(--panel-bg)', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  {phase.tasks.filter((t: any) => t.completed).length} of {phase.tasks.length} milestones complete
                </span>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '6px' }}>{phase.description}</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            {phase.tasks.map((task: any) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '18px 20px',
                  background: task.completed ? '#f7faf8' : 'white',
                  border: '1px solid ' + (task.completed ? '#c8e6c9' : 'var(--border)'),
                  borderRadius: '8px',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                    <input
                      type="checkbox"
                      style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', accentColor: '#2563eb' }}
                      checked={task.completed}
                      disabled={togglingId === task.id}
                      onChange={() => handleToggleTask(task.id, task.completed)}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '15px', color: 'var(--ink)', textDecoration: task.completed ? 'line-through' : 'none' }}>
                          {task.title}
                        </strong>
                        {task.aicpa_tsc && (
                          <span className="mono" style={{ fontSize: '11px', background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                            {task.aicpa_tsc}
                          </span>
                        )}
                        {task.live_verified ? (
                          <span style={{ fontSize: '11px', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', padding: '1px 8px', borderRadius: '10px', border: '1px solid rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={11} /> Live Verified by System
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', background: 'var(--panel-bg)', color: 'var(--muted)', padding: '1px 8px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            ○ Verification Pending
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.5 }}>
                        {task.detail}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {task.action_resource && (
                      <button
                        className="button button-sm button-primary"
                        onClick={() => onNavigate(task.action_resource)}
                        title={`Navigate to ${task.action_resource} module`}
                      >
                        Open Module <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Auditor Deliverable & Recommended Tool Box */}
                <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '10px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Auditor PBC Deliverable: </span>
                    <span style={{ color: 'var(--ink)' }}>{task.deliverable || 'Formal compliance evidence document'}</span>
                  </div>
                  {task.suggested_tool && (
                    <div>
                      <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Standard Tool: </span>
                      <span className="mono" style={{ color: '#2563eb' }}>{task.suggested_tool}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
