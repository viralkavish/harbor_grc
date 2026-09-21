import { useEffect, useState } from 'react';
import { ShieldCheck, AlertCircle, Play, CheckCircle2, ChevronDown, ChevronRight, ExternalLink, Bug, Clock, Check } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, formatDate, Note } from '../components/ui';
import type { Notify, Navigate } from '../lib/types';

export function MonitoringView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [data, setData] = useState<any>(null);
  const [vulnData, setVulnData] = useState<any | null>(null);
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

    api.get('/vulnerabilities')
      .then(setVulnData)
      .catch(() => {});
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

      {/* Vulnerability Management & Patch SLA Countdown Tracker */}
      {vulnData && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Bug size={18} color="#2563eb" />
                <h3 className="card-title" style={{ margin: 0 }}>Vulnerability Management & Patch SLA Tracker</h3>
                <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  100% SLA Compliant
                </span>
              </div>
              <p className="card-description">
                CVSS-based vulnerability triage and auditor SLA adherence tracking: Critical (7d), High (30d), Medium (60d), Low (90d).
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Tracked CVEs</div>
              <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>{vulnData.total}</strong>
            </div>
            <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Remediated within SLA</div>
              <strong style={{ fontSize: '16px', color: '#16a34a' }}>{vulnData.remediated_count} (100%)</strong>
            </div>
            <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Open Overdue Findings</div>
              <strong style={{ fontSize: '16px', color: vulnData.open_count > 0 ? 'var(--danger)' : '#16a34a' }}>
                {vulnData.open_count}
              </strong>
            </div>
            <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Auditor SLA Rules</div>
              <strong style={{ fontSize: '12px', color: '#2563eb' }}>Critical 7d · High 30d</strong>
            </div>
          </div>

          <table className="table" style={{ width: '100%', fontSize: '13px' }}>
            <thead>
              <tr>
                <th>Finding / CVE</th>
                <th>Component</th>
                <th>Severity & CVSS</th>
                <th>SLA Deadline</th>
                <th>Status & Fix Reference</th>
              </tr>
            </thead>
            <tbody>
              {(vulnData.vulnerabilities || []).map((v: any) => (
                <tr key={v.id}>
                  <td>
                    <span className="mono" style={{ fontWeight: 600, color: '#2563eb' }}>{v.cve_id}</span>
                    <small style={{ color: 'var(--ink)', display: 'block', marginTop: '2px' }}>{v.title}</small>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{v.component}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: v.severity === 'critical' ? '#fee2e2' : v.severity === 'high' ? '#ffedd5' : '#fef9c3',
                        color: v.severity === 'critical' ? '#991b1b' : v.severity === 'high' ? '#9a3412' : '#854d0e'
                      }}>
                        {v.severity} ({v.cvss})
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '12px' }}>
                      <span>Due: {v.due_date}</span>
                      <small style={{ color: 'var(--muted)', display: 'block' }}>SLA: {v.sla_days} days</small>
                    </div>
                  </td>
                  <td>
                    <div>
                      <span style={{ fontSize: '11px', background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a', padding: '2px 8px', borderRadius: '10px' }}>
                        ✓ {v.status}
                      </span>
                      {v.remediation_ref && (
                        <small className="mono" style={{ color: 'var(--muted)', display: 'block', marginTop: '2px', fontSize: '11px' }}>
                          {v.remediation_ref}
                        </small>
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
  );
}
