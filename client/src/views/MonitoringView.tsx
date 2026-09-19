import { useEffect, useState } from 'react';
import { ShieldCheck, AlertCircle, Play, CheckCircle2, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, formatDate, Note } from '../components/ui';
import type { Notify, Navigate } from '../lib/types';

export function MonitoringView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  const loadMonitoring = () => {
    setLoading(true);
    setError('');
    api.get('/monitoring')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMonitoring();
  }, []);

  const handleRunChecks = async () => {
    setRunning(true);
    try {
      const res = await api.post('/monitoring/run');
      setData(res);
      const total = res.checks.reduce((acc: number, c: any) => acc + c.finding_count, 0);
      notify(`Checks evaluated: ${total} total finding(s) discovered`);
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  if (loading && !data) return <Loading label="Loading local monitoring status…" />;
  if (error) return <ErrorState message={error} retry={loadMonitoring} />;

  const checks = data?.checks || [];
  const passingCount = checks.filter((c: any) => c.status === 'pass').length;
  const failingCount = checks.filter((c: any) => c.status === 'fail').length;

  return (
    <div>
      <PageHeader
        eyebrow="MONITOR"
        title="Automated Record Monitoring"
        description="Continuous evaluation of completeness, currency, and consistency across your local compliance records."
      >
        <button className="button button-primary" onClick={handleRunChecks} disabled={running}>
          <Play size={14} />
          {running ? 'Evaluating Checks…' : 'Run Local Checks Now'}
        </button>
      </PageHeader>

      <Note>
        <strong>Local record checks — no connected cloud telemetry:</strong> All evaluations inspect your private SQLite database for overdue review dates, missing ownership, unencrypted attributes, and expired documents. Missing data is highlighted as unassessed rather than silently passed.
      </Note>

      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <div className="metric">
          <span>Total Checks</span>
          <strong>{checks.length}</strong>
          <small>Automated rules</small>
        </div>
        <div className="metric">
          <span>Passing Checks</span>
          <strong style={{ color: 'var(--accent)' }}>{passingCount}</strong>
          <small>Zero active findings</small>
        </div>
        <div className="metric">
          <span>Failing Checks</span>
          <strong style={{ color: failingCount > 0 ? 'var(--danger)' : 'var(--ink)' }}>{failingCount}</strong>
          <small>Need remediation</small>
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', background: '#fafcfb', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Monitoring Checks ({checks.length})</span>
          {data?.last_run && (
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Last executed: {formatDate(data.last_run)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {checks.map((c: any) => {
            const isExpanded = expandedCheck === c.id;
            const isPassing = c.status === 'pass';
            return (
              <div key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  onClick={() => setExpandedCheck(isExpanded ? null : c.id)}
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isExpanded ? '#fafcfb' : 'white',
                    transition: 'background 0.1s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isPassing ? (
                      <CheckCircle2 size={18} color="var(--accent)" />
                    ) : (
                      <AlertCircle size={18} color="var(--danger)" />
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>
                        {c.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        {c.description}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Badge value={c.status} />
                    {c.finding_count > 0 && (
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 600 }}>
                        {c.finding_count} finding(s)
                      </span>
                    )}
                    {isExpanded ? <ChevronDown size={16} color="var(--muted)" /> : <ChevronRight size={16} color="var(--muted)" />}
                  </div>
                </div>

                {/* Expanded findings drawer */}
                {isExpanded && (
                  <div style={{ padding: '16px 20px 20px 48px', background: '#f8faf9', borderTop: '1px solid var(--border)' }}>
                    {c.findings.length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 500 }}>
                        ✓ No findings. All records meet this check's criteria.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                          Discovered Findings ({c.findings.length})
                        </div>
                        {c.findings.map((f: any, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'white',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              padding: '10px 14px'
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: '13px' }}>{f.title}</strong>
                              <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '2px' }}>
                                {f.reason}
                              </div>
                            </div>
                            <button
                              className="button button-sm"
                              onClick={() => onNavigate(f.resource, f.id)}
                            >
                              Inspect record <ExternalLink size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
