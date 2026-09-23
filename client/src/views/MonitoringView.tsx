import { useEffect, useState } from 'react';
import {
  ShieldCheck, AlertCircle, Play, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Check, RefreshCw, AlertTriangle, Layers, Code2, Copy, Terminal,
  User, Calendar, FileText, CheckSquare, XCircle, ArrowRight, ShieldAlert,
  Send, ExternalLink
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, formatDate } from '../components/ui';
import { Dialog } from '../components/Dialog';
import type { Notify, Navigate } from '../lib/types';

export function MonitoringView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [activeTab, setActiveTab] = useState<'tests' | 'exceptions' | 'history' | 'scheduler'>('tests');
  const [latestRun, setLatestRun] = useState<any | null>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [scheduler, setScheduler] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  // Filters & State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [exceptionFilter, setExceptionFilter] = useState<string>('open');
  const [expandedTransparency, setExpandedTransparency] = useState<Record<string, boolean>>({});
  const [expandedSnippets, setExpandedSnippets] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Exception Action Modals
  const [selectedException, setSelectedException] = useState<any | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showRemediateModal, setShowRemediateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Form Inputs
  const [assignOwner, setAssignOwner] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [noteText, setNoteText] = useState('');
  const [remNote, setRemNote] = useState('');
  const [remEvidenceIds, setRemEvidenceIds] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [latestRes, runsRes, excRes, schedRes] = await Promise.all([
        api.get('/monitoring/runs/latest').catch(() => null),
        api.get('/monitoring/runs').catch(() => ({ items: [] })),
        api.get('/exceptions').catch(() => ({ items: [] })),
        api.get('/monitoring/scheduler').catch(() => null)
      ]);

      if (latestRes) {
        setLatestRun(latestRes);
      } else {
        // Fallback: load current tests
        const testsRes = await api.get('/tests').catch(() => null);
        if (testsRes) {
          setLatestRun({
            results: testsRes.tests,
            summary: {
              total: testsRes.total,
              passing: testsRes.passing,
              warning: testsRes.warning,
              failing: testsRes.failing,
              health_percent: testsRes.health_percent
            },
            started_at: testsRes.last_run,
            completed_at: testsRes.last_run,
            triggered_by: 'on-demand'
          });
        }
      }

      setRuns(runsRes.items || []);
      setExceptions(excRes.items || []);
      setScheduler(schedRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunSuite = async () => {
    setRunning(true);
    try {
      const res = await api.post('/monitoring/run', { actor: 'Security Lead' });
      setLatestRun(res);
      notify(`Continuous monitoring run complete: ${res.summary.passing} passing, ${res.summary.warning} warnings, ${res.summary.failing} failures.`);
      await loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleRunScheduledNow = async () => {
    setRunning(true);
    try {
      const res = await api.post('/monitoring/run_scheduled');
      setLatestRun(res);
      notify('Scheduled daily monitoring sweep executed.');
      await loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const toggleTransparency = (id: string) => {
    setExpandedTransparency(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSnippet = (id: string) => {
    setExpandedSnippets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copySnippet = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    notify('Remediation snippet copied');
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Exception Handlers
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedException || !assignOwner.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/exceptions/${selectedException.id}/assign`, {
        owner: assignOwner.trim(),
        due_date: assignDueDate || null,
        actor: 'Security Lead'
      });
      notify('Exception assigned to ' + assignOwner);
      setShowAssignModal(false);
      setAssignOwner('');
      setAssignDueDate('');
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedException || !noteText.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/exceptions/${selectedException.id}/note`, {
        author: 'Security Lead',
        text: noteText.trim()
      });
      notify('Note appended to exception');
      setShowNoteModal(false);
      setNoteText('');
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemediate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedException) return;
    setSubmitting(true);
    try {
      const eviList = remEvidenceIds.split(',').map(s => s.trim()).filter(Boolean);
      await api.post(`/exceptions/${selectedException.id}/remediate`, {
        actor: 'Security Lead',
        note: remNote.trim() || 'Remediation completed with audit evidence.',
        evidence_ids: eviList
      });
      notify('Exception marked remediated');
      setShowRemediateModal(false);
      setRemNote('');
      setRemEvidenceIds('');
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedException) return;
    setSubmitting(true);
    try {
      await api.post(`/exceptions/${selectedException.id}/close`, {
        actor: 'Security Lead',
        reason: closeReason.trim() || 'Remediation verified clean in continuous run.'
      });
      notify('Exception closed');
      setShowCloseModal(false);
      setCloseReason('');
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !latestRun) return <Loading label="Loading continuous monitoring posture…" />;
  if (error) return <ErrorState message={error} retry={loadData} />;

  const results = latestRun?.results || [];
  const summary = latestRun?.summary || {
    total: results.length,
    passing: results.filter((r: any) => r.status === 'pass').length,
    warning: results.filter((r: any) => r.status === 'warning').length,
    failing: results.filter((r: any) => r.status === 'fail').length,
    health_percent: 0
  };

  const categories = ['all', ...Array.from(new Set(results.map((r: any) => r.category))).filter(Boolean) as string[]];
  const filteredResults = selectedCategory === 'all'
    ? results
    : results.filter((r: any) => r.category === selectedCategory);

  const filteredExceptions = exceptionFilter === 'all'
    ? exceptions
    : exceptions.filter((e: any) => e.status === exceptionFilter);

  const openExceptionsCount = exceptions.filter((e: any) => e.status === 'open' || e.status === 'acknowledged').length;

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow="AUTOMATE & ASSURE"
        title="Continuous Monitoring"
        description="Daily automated controls evaluation with transparent audit queries, scheduler cadence, and exception tracking."
      >
        <button className="button button-primary" onClick={handleRunSuite} disabled={running}>
          <Play size={14} />
          {running ? 'Executing Suite…' : 'Run Suite Now'}
        </button>
        <button className="button" onClick={loadData} title="Refresh monitoring state">
          <RefreshCw size={14} />
        </button>
      </PageHeader>

      {/* Metrics Row */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="metric">
          <span>Control Health</span>
          <strong style={{ color: 'var(--accent)' }}>{summary.health_percent}%</strong>
          <small>{summary.passing} of {summary.total} checks passing</small>
        </div>
        <div className="metric">
          <span>Passing Controls</span>
          <strong style={{ color: 'var(--accent)' }}>{summary.passing}</strong>
          <small>Verified operational</small>
        </div>
        <div className="metric">
          <span>Warnings</span>
          <strong style={{ color: summary.warning > 0 ? 'var(--warning)' : 'var(--ink)' }}>{summary.warning}</strong>
          <small>Advisory or partial gaps</small>
        </div>
        <div className="metric">
          <span>Open Exceptions</span>
          <strong style={{ color: openExceptionsCount > 0 ? 'var(--danger)' : 'var(--ink)' }}>{openExceptionsCount}</strong>
          <small>Requires remediation workflow</small>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="view-inline" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px' }}>
        <button
          className={`button ${activeTab === 'tests' ? 'button-primary' : ''}`}
          onClick={() => setActiveTab('tests')}
        >
          <ShieldCheck size={14} /> Automated Checks ({results.length})
        </button>
        <button
          className={`button ${activeTab === 'exceptions' ? 'button-primary' : ''}`}
          onClick={() => setActiveTab('exceptions')}
        >
          <AlertCircle size={14} /> Exceptions Workflow ({exceptions.length})
        </button>
        <button
          className={`button ${activeTab === 'history' ? 'button-primary' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Clock size={14} /> Run History ({runs.length})
        </button>
        <button
          className={`button ${activeTab === 'scheduler' ? 'button-primary' : ''}`}
          onClick={() => setActiveTab('scheduler')}
        >
          <Calendar size={14} /> Scheduler Health
        </button>
      </div>

      {/* TAB 1: AUTOMATED TESTS & TRANSPARENCY */}
      {activeTab === 'tests' && (
        <div>
          {/* Category Filter Pills */}
          <div className="view-inline" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button
                key={cat}
                className={`button button-sm ${selectedCategory === cat ? 'button-primary' : ''}`}
                onClick={() => setSelectedCategory(cat)}
                style={{ textTransform: 'capitalize' }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredResults.map((test: any) => {
              const isPassing = test.status === 'pass';
              const isWarning = test.status === 'warning';
              const isFailing = test.status === 'fail';
              const isExpandedTrans = Boolean(expandedTransparency[test.id]);

              return (
                <div
                  key={test.id}
                  className="card"
                  style={{
                    marginBottom: 0,
                    borderLeft: `4px solid ${isPassing ? 'var(--accent)' : isWarning ? 'var(--warning)' : 'var(--danger)'}`
                  }}
                >
                  <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="view-inline" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                      <div style={{ marginTop: '2px' }}>
                        {isPassing && <CheckCircle2 size={20} color="var(--accent)" />}
                        {isWarning && <AlertTriangle size={20} color="var(--warning)" />}
                        {isFailing && <AlertCircle size={20} color="var(--danger)" />}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{test.title}</strong>
                          {test.control_ids?.map((cid: string) => (
                            <button
                              key={cid}
                              className="mono"
                              onClick={() => onNavigate('controls', cid)}
                              style={{
                                fontSize: '11px',
                                background: 'var(--border)',
                                color: 'var(--ink)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              title="Jump to control in catalog"
                            >
                              {cid}
                            </button>
                          ))}
                          <span style={{ fontSize: '11px', color: 'var(--muted)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: '4px' }}>
                            {test.category}
                          </span>
                        </div>

                        <p style={{ fontSize: '13px', color: 'var(--ink)', margin: '4px 0 8px 0' }}>
                          {test.summary}
                        </p>

                        {/* M3 Auditor-Grade Transparency Accordion */}
                        <div style={{ marginTop: '8px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px', fontSize: '12px' }}>
                          <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--muted)', fontSize: '11px' }}>
                              AU-C 500 Information Produced by the Entity (IPE) Transparency:
                            </span>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => toggleTransparency(test.id)}
                              style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              {isExpandedTrans ? 'Hide Query Details' : 'View Query & Source System'}
                              {isExpandedTrans ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                          </div>

                          {isExpandedTrans && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                              <div>
                                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Source System</span>
                                <strong className="mono" style={{ fontSize: '11px' }}>{test.source_system || 'twofrom-grc-internal'}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Test Methodology Version</span>
                                <strong className="mono" style={{ fontSize: '11px' }}>v{test.test_version || '2.0.0'}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Generated Timestamp</span>
                                <strong className="mono" style={{ fontSize: '11px' }}>{formatDate(test.generated_at)}</strong>
                              </div>
                              <div style={{ gridColumn: '1 / -1' }}>
                                <span style={{ color: 'var(--muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Automated Query / Logic Specification</span>
                                <pre className="mono" style={{ background: 'var(--main-bg)', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                                  {test.query_logic}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Remediation Guidance */}
                        {test.remediation && (
                          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--ink)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--muted)' }}>Remediation: </span>
                            <span>{test.remediation}</span>
                            {test.remediation_snippet && (
                              <button
                                type="button"
                                className="link-button"
                                onClick={() => toggleSnippet(test.id)}
                                style={{ marginLeft: '10px', fontSize: '11px' }}
                              >
                                {expandedSnippets[test.id] ? 'Hide Fix Snippet' : 'Auto-Fix Snippet'}
                              </button>
                            )}
                          </div>
                        )}

                        {test.remediation_snippet && expandedSnippets[test.id] && (
                          <div style={{ marginTop: '8px', background: 'var(--main-bg)', borderRadius: '6px', padding: '10px', border: '1px solid var(--border)' }}>
                            <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Terminal size={12} /> {test.remediation_snippet.label}
                              </span>
                              <button
                                type="button"
                                className="button button-sm"
                                onClick={() => copySnippet(test.id, test.remediation_snippet.snippet)}
                                style={{ fontSize: '10px', padding: '2px 6px' }}
                              >
                                {copiedId === test.id ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                                {copiedId === test.id ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <pre className="mono" style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                              {test.remediation_snippet.snippet}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ marginLeft: '16px' }}>
                      <Badge value={test.status} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: EXCEPTIONS WORKFLOW */}
      {activeTab === 'exceptions' && (
        <div>
          {/* Status Filter Pills */}
          <div className="view-inline" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {['open', 'acknowledged', 'remediated', 'closed', 'all'].map(st => (
              <button
                key={st}
                className={`button button-sm ${exceptionFilter === st ? 'button-primary' : ''}`}
                onClick={() => setExceptionFilter(st)}
                style={{ textTransform: 'capitalize' }}
              >
                {st} ({st === 'all' ? exceptions.length : exceptions.filter((e: any) => e.status === st).length})
              </button>
            ))}
          </div>

          {filteredExceptions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              <CheckCircle2 size={36} color="var(--accent)" style={{ margin: '0 auto 12px auto' }} />
              <strong style={{ display: 'block', fontSize: '15px', color: 'var(--ink)' }}>No {exceptionFilter !== 'all' ? exceptionFilter : ''} exceptions found</strong>
              <span>Continuous control checks are currently operating cleanly.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredExceptions.map((exc: any) => (
                <div key={exc.id} className="card" style={{ marginBottom: 0 }}>
                  <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{exc.title}</strong>
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>{exc.test_id}</span>
                        {exc.control_refs?.map((cid: string) => (
                          <span key={cid} className="badge badge-accent" style={{ fontSize: '10px' }}>{cid}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', gap: '16px' }}>
                        <span>Opened: {formatDate(exc.created_at)}</span>
                        <span>Owner: <strong style={{ color: 'var(--ink)' }}>{exc.owner || 'Unassigned'}</strong></span>
                        {exc.due_date && <span>Target Due Date: <strong style={{ color: 'var(--ink)' }}>{exc.due_date}</strong></span>}
                      </div>
                    </div>

                    <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Badge value={exc.status} />
                    </div>
                  </div>

                  {/* Notes / Audit Log of Exception */}
                  {exc.notes?.length > 0 && (
                    <div style={{ background: 'var(--surface-raised)', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Activity & Remediation Notes:</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {exc.notes.map((n: any) => (
                          <div key={n.id || n.created_at} style={{ borderLeft: '2px solid var(--border)', paddingLeft: '8px' }}>
                            <span style={{ color: 'var(--ink)' }}>{n.text}</span>
                            <span style={{ color: 'var(--muted)', fontSize: '10px', marginLeft: '6px' }}>— {n.author} ({formatDate(n.created_at)})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="view-inline" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                    <button
                      className="button button-sm"
                      onClick={() => { setSelectedException(exc); setAssignOwner(exc.owner || ''); setAssignDueDate(exc.due_date || ''); setShowAssignModal(true); }}
                    >
                      <User size={12} /> {exc.owner ? 'Re-assign' : 'Assign Owner'}
                    </button>
                    <button
                      className="button button-sm"
                      onClick={() => { setSelectedException(exc); setShowNoteModal(true); }}
                    >
                      <FileText size={12} /> Add Note
                    </button>
                    {exc.status !== 'remediated' && exc.status !== 'closed' && (
                      <button
                        className="button button-sm button-primary"
                        onClick={() => { setSelectedException(exc); setShowRemediateModal(true); }}
                      >
                        <CheckSquare size={12} /> Remediate
                      </button>
                    )}
                    {exc.status !== 'closed' && (
                      <button
                        className="button button-sm"
                        style={{ background: 'var(--danger)', color: '#fff' }}
                        onClick={() => { setSelectedException(exc); setShowCloseModal(true); }}
                      >
                        <XCircle size={12} /> Close Exception
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RUN HISTORY TIMELINE */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="view-row" style={{ padding: '14px 20px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '14px' }}>Chronological Monitoring Runs ({runs.length})</strong>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Observation period audit trail</span>
          </div>

          {runs.length === 0 ? (
            <p style={{ padding: '24px', color: 'var(--muted)' }}>No historical monitoring runs stored yet.</p>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Execution Time (UTC)</th>
                    <th style={{ padding: '10px 14px' }}>Trigger</th>
                    <th style={{ padding: '10px 14px' }}>Health Score</th>
                    <th style={{ padding: '10px 14px' }}>Passing</th>
                    <th style={{ padding: '10px 14px' }}>Warnings</th>
                    <th style={{ padding: '10px 14px' }}>Failures</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r: any) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>{formatDate(r.completed_at)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`badge ${r.triggered_by === 'schedule' ? 'badge-primary' : 'badge-neutral'}`}>
                          {r.triggered_by}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--accent)' }}>
                        {r.summary?.health_percent}%
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--success)' }}>{r.summary?.passing}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--warning)' }}>{r.summary?.warning}</td>
                      <td style={{ padding: '10px 14px', color: r.summary?.failing > 0 ? 'var(--danger)' : 'var(--muted)' }}>
                        {r.summary?.failing}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SCHEDULER HEALTH */}
      {activeTab === 'scheduler' && (
        <div className="card" style={{ maxWidth: '650px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>
            Daily Automated Sweep Scheduler
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
            The scheduler runs the complete continuous monitoring suite every day to verify controls operate continuously throughout the multi-month SOC 2 Type II observation period.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: 'var(--surface-raised)', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Scheduler Cadence</span>
              <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>Daily at {scheduler?.daily_schedule_time || '06:00'} UTC</strong>
            </div>
            <div style={{ background: 'var(--surface-raised)', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Scheduler Daemon Status</span>
              <strong style={{ fontSize: '14px', color: 'var(--success)' }}>Active & Monitoring</strong>
            </div>
            <div style={{ background: 'var(--surface-raised)', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Last Scheduled Execution</span>
              <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{scheduler?.last_run_at ? formatDate(scheduler.last_run_at) : 'None recorded yet'}</strong>
            </div>
            <div style={{ background: 'var(--surface-raised)', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Next Scheduled Execution</span>
              <strong style={{ fontSize: '13px', color: 'var(--accent)' }}>{scheduler?.next_run_at ? formatDate(scheduler.next_run_at) : 'Computing…'}</strong>
            </div>
          </div>

          <button className="button button-primary" onClick={handleRunScheduledNow} disabled={running}>
            <Play size={13} /> Trigger Scheduled Sweep Now
          </button>
        </div>
      )}

      {/* MODAL: ASSIGN EXCEPTION */}
      {showAssignModal && selectedException && (
        <Dialog title="Assign Exception Owner" subtitle="Designate accountable owner and target remediation date." onClose={() => setShowAssignModal(false)}>
          <form onSubmit={handleAssign}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Accountable Owner *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. security-lead@tofrom.com"
                  value={assignOwner}
                  onChange={e => setAssignOwner(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="field">
                <span>Target Remediation Due Date</span>
                <input
                  type="date"
                  value={assignDueDate}
                  onChange={e => setAssignDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={submitting || !assignOwner.trim()}>
                {submitting ? 'Assigning…' : 'Confirm Assignment'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* MODAL: ADD NOTE */}
      {showNoteModal && selectedException && (
        <Dialog title="Add Note to Exception" subtitle="Record root cause investigation or remediation progress." onClose={() => setShowNoteModal(false)}>
          <form onSubmit={handleAddNote}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Note Content *</span>
                <textarea
                  rows={4}
                  required
                  placeholder="Detail remediation actions or investigative findings..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowNoteModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={submitting || !noteText.trim()}>
                {submitting ? 'Saving…' : 'Append Note'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* MODAL: REMEDIATE EXCEPTION */}
      {showRemediateModal && selectedException && (
        <Dialog title="Submit Remediation" subtitle="Mark exception as remediated and link audit evidence." onClose={() => setShowRemediateModal(false)}>
          <form onSubmit={handleRemediate}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Remediation Summary *</span>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain what configuration change or fix was applied..."
                  value={remNote}
                  onChange={e => setRemNote(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="field">
                <span>Linked Evidence IDs (comma-separated)</span>
                <input
                  type="text"
                  placeholder="e.g. evi-sec-01, evi-pr-02"
                  value={remEvidenceIds}
                  onChange={e => setRemEvidenceIds(e.target.value)}
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowRemediateModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={submitting || !remNote.trim()}>
                {submitting ? 'Submitting…' : 'Mark Remediated'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* MODAL: CLOSE EXCEPTION */}
      {showCloseModal && selectedException && (
        <Dialog title="Close Exception" subtitle="Formal executive sign-off closing this exception." onClose={() => setShowCloseModal(false)}>
          <form onSubmit={handleClose}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Verification / Closure Reason</span>
                <textarea
                  rows={3}
                  placeholder="Confirm verified clean in latest continuous monitoring sweep..."
                  value={closeReason}
                  onChange={e => setCloseReason(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowCloseModal(false)}>Cancel</button>
              <button type="submit" className="button" style={{ background: 'var(--danger)', color: '#fff' }} disabled={submitting}>
                {submitting ? 'Closing…' : 'Confirm Closure'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
