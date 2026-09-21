import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock, FileCheck, ArrowRight, Play, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, formatDate } from '../components/ui';
import type { Navigate, Notify } from '../lib/types';
import './overview.css';

const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function OverviewView({ onNavigate, notify }: { onNavigate: Navigate; notify: Notify }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runningChecks, setRunningChecks] = useState(false);

  const loadDashboard = () => {
    setLoading(true);
    setError('');
    api.get('/dashboard')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleRunChecks = async () => {
    setRunningChecks(true);
    try {
      const res = await api.post('/monitoring/run');
      notify(`Local record checks completed: ${res.checks.reduce((acc: number, c: any) => acc + c.finding_count, 0)} findings`);
      loadDashboard();
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setRunningChecks(false);
    }
  };

  if (loading) return <Loading label="Loading compliance overview…" />;
  if (error) return <ErrorState message={error} retry={loadDashboard} />;
  if (!data) return null;

  const { readiness, framework_readiness, open_risks, high_risks, overdue_tasks, expiring_evidence, upcoming_reviews, attention, risk_matrix } = data;

  return (
    <div className="overview-page">
      <PageHeader
        eyebrow="OPERATE"
        title="Overview"
        description="Recorded gaps, implementation progress, and scheduled reviews."
      >
        <button className="button button-primary" onClick={handleRunChecks} disabled={runningChecks}>
          <Play size={14} />
          {runningChecks ? 'Running Checks…' : 'Run Local Checks'}
        </button>
        <button className="button" onClick={loadDashboard} title="Refresh metrics">
          <RefreshCw size={14} />
        </button>
      </PageHeader>

      <div className="overview-metrics" role="group" aria-label="Program metrics">
        <button type="button" className="overview-metric" onClick={() => onNavigate('controls')}>
          <span className="overview-metric-label">Control readiness <ArrowRight size={14} aria-hidden="true" /></span>
          <strong className="overview-metric-value overview-tone-accent">{readiness.percent}%</strong>
          <span className="overview-metric-detail">{readiness.implemented} of {readiness.total} applicable controls implemented</span>
        </button>
        <button type="button" className="overview-metric" onClick={() => onNavigate('risks')}>
          <span className="overview-metric-label">Open risks <ArrowRight size={14} aria-hidden="true" /></span>
          <strong className={`overview-metric-value ${high_risks > 0 ? 'overview-tone-danger' : ''}`}>{open_risks}</strong>
          <span className="overview-metric-detail">{high_risks} with score ≥ 12</span>
        </button>
        <button type="button" className="overview-metric" onClick={() => onNavigate('tasks')}>
          <span className="overview-metric-label">Overdue tasks <ArrowRight size={14} aria-hidden="true" /></span>
          <strong className={`overview-metric-value ${overdue_tasks > 0 ? 'overview-tone-warning' : ''}`}>{overdue_tasks}</strong>
          <span className="overview-metric-detail">Open tasks past their due date</span>
        </button>
        <button type="button" className="overview-metric" onClick={() => onNavigate('evidence')}>
          <span className="overview-metric-label">Evidence due <ArrowRight size={14} aria-hidden="true" /></span>
          <strong className={`overview-metric-value ${expiring_evidence > 0 ? 'overview-tone-warning' : ''}`}>{expiring_evidence}</strong>
          <span className="overview-metric-detail">Within 30 days or past due · not marked expired</span>
        </button>
      </div>

      <section className="overview-card overview-attention" aria-labelledby="overview-attention-title">
        <div className="overview-section-header">
          <div>
            <h2 id="overview-attention-title">Needs attention</h2>
            <p>Prioritize gaps in your recorded work.</p>
          </div>
          <button type="button" className="overview-link" onClick={() => onNavigate('monitoring')}>View checks <ArrowRight size={14} aria-hidden="true" /></button>
        </div>
        {attention.length === 0 ? (
          <div className="overview-empty"><strong>No attention items returned</strong><p>Run local record checks or review your registers for gaps.</p></div>
        ) : (
          <ul className="overview-attention-list">
            {[...attention].sort((a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0)).slice(0, 6).map((item: any) => (
              <li key={`${item.resource}-${item.id}`}>
                <button type="button" className="overview-attention-row" onClick={() => onNavigate(item.resource, item.id)}>
                  <span className="overview-row-copy">
                    <span className="overview-resource">{item.resource}</span>
                    <strong>{item.title}</strong>
                    <span className="overview-row-reason">{item.reason}</span>
                  </span>
                  <Badge value={item.severity || 'unassessed'} />
                  <ArrowRight size={16} className="overview-row-arrow" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <nav className="overview-shortcuts" aria-label="Continue work">
          <span>Continue work</span>
          <button type="button" className="overview-link" onClick={() => onNavigate('roadmap')}>Roadmap</button>
          <button type="button" className="overview-link" onClick={() => onNavigate('policies')}>Policies</button>
          <button type="button" className="overview-link" onClick={() => onNavigate('evidence')}>Evidence</button>
        </nav>
      </section>

      <div className="grid-2">
        {/* Framework Readiness */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Framework Readiness</h3>
              <p className="card-description">Recorded implementation by standard</p>
            </div>
            <button className="link-button" onClick={() => onNavigate('frameworks')}>View all <ArrowRight size={12} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {framework_readiness.map((fw: any) => (
              <div key={fw.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ fontWeight: 600 }}>{fw.title}</span>
                  <span className="mono" style={{ color: 'var(--muted)' }}>{fw.implemented}/{fw.total} ({fw.percent}%)</span>
                </div>
                <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${fw.percent}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.3s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5x5 Risk Heatmap */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Risk Heatmap (5×5)</h3>
              <p className="card-description">Likelihood × Impact matrix of recorded risks</p>
            </div>
            <button className="link-button" onClick={() => onNavigate('risks')}>Risk register <ArrowRight size={12} /></button>
          </div>
          <div className="heatmap-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>
              <span>Low Impact</span>
              <span>High Impact</span>
            </div>
            <div className="heatmap-grid">
              {risk_matrix.map((cell: any) => {
                const score = cell.likelihood * cell.impact;
                const tierClass = score <= 4 ? 'heatmap-cell-1' : score <= 9 ? 'heatmap-cell-2' : score <= 15 ? 'heatmap-cell-3' : score <= 19 ? 'heatmap-cell-4' : 'heatmap-cell-5';
                return (
                  <div
                    key={`${cell.likelihood}-${cell.impact}`}
                    className={`heatmap-cell ${tierClass}`}
                    onClick={() => onNavigate('risks')}
                    title={`Likelihood ${cell.likelihood}, Impact ${cell.impact}: ${cell.count} risk(s)`}
                  >
                    {cell.count > 0 ? cell.count : '·'}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">

        {/* Upcoming Reviews */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Upcoming Reviews & Renewals</h3>
              <p className="card-description">Next 30 days schedule</p>
            </div>
          </div>
          {upcoming_reviews.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No policies or vendor contracts scheduled for review in the next 30 days.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {upcoming_reviews.slice(0, 6).map((rev: any) => (
                <div
                  key={`${rev.resource}-${rev.id}-${rev.date}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}
                  onClick={() => onNavigate(rev.resource, rev.id)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{rev.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'capitalize' }}>{rev.resource}</div>
                  </div>
                  <span className="mono" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
                    {formatDate(rev.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
