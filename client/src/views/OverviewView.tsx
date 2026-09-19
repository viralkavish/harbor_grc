import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock, FileCheck, ArrowRight, Play, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, formatDate } from '../components/ui';
import type { Navigate, Notify } from '../lib/types';

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
    <div>
      <PageHeader
        eyebrow="MONITOR"
        title="Compliance & Governance Overview"
        description="Local program posture, recorded control implementation, open remediation work, and scheduled reviews."
      >
        <button className="button button-primary" onClick={handleRunChecks} disabled={runningChecks}>
          <Play size={14} />
          {runningChecks ? 'Running Checks…' : 'Run Local Checks'}
        </button>
        <button className="button" onClick={loadDashboard} title="Refresh metrics">
          <RefreshCw size={14} />
        </button>
      </PageHeader>

      {/* Top 4 Metrics */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="metric">
          <span>Control Readiness</span>
          <strong style={{ color: 'var(--accent)' }}>{readiness.percent}%</strong>
          <small>{readiness.implemented} of {readiness.total} controls implemented</small>
        </div>
        <div className="metric">
          <span>Active Risks</span>
          <strong style={{ color: high_risks > 0 ? 'var(--danger)' : 'var(--ink)' }}>{open_risks}</strong>
          <small>{high_risks} high / critical priority</small>
        </div>
        <div className="metric">
          <span>Overdue Tasks</span>
          <strong style={{ color: overdue_tasks > 0 ? 'var(--warning)' : 'var(--ink)' }}>{overdue_tasks}</strong>
          <small>Remediation action items</small>
        </div>
        <div className="metric">
          <span>Expiring Evidence</span>
          <strong style={{ color: expiring_evidence > 0 ? 'var(--warning)' : 'var(--ink)' }}>{expiring_evidence}</strong>
          <small>Next 30 days</small>
        </div>
      </div>

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
        {/* Needs Attention Items */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Needs Attention</h3>
              <p className="card-description">Discovered gaps, overdue dates & unassigned controls</p>
            </div>
            <button className="link-button" onClick={() => onNavigate('monitoring')}>Full checks <ArrowRight size={12} /></button>
          </div>
          {attention.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No critical items requiring immediate attention.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {attention.slice(0, 6).map((item: any) => (
                <div
                  key={`${item.resource}-${item.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}
                  onClick={() => onNavigate(item.resource, item.id)}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.reason}</div>
                  </div>
                  <Badge value={item.severity === 'high' ? 'critical' : 'medium'} />
                </div>
              ))}
            </div>
          )}
        </div>

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
