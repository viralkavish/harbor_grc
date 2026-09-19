import { useEffect, useState } from 'react';
import { ShieldCheck, Play, AlertCircle, CheckCircle2, AlertTriangle, Terminal, RefreshCw, Layers } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, Note } from '../components/ui';
import type { Notify, Navigate } from '../lib/types';

export function ContinuousTestsView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadTests = () => {
    setLoading(true);
    setError('');
    api.get('/tests')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTests();
  }, []);

  const handleRunTests = async () => {
    setRunning(true);
    try {
      const res = await api.post('/tests/run');
      setData(res);
      notify(`Continuous tests complete: ${res.passing} passing, ${res.warning} warnings, ${res.failing} failures.`);
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  if (loading && !data) return <Loading label="Executing continuous automated tests…" />;
  if (error) return <ErrorState message={error} retry={loadTests} />;

  const tests = data?.tests || [];
  const categories = ['all', ...Array.from(new Set(tests.map((t: any) => t.category))) as string[]];

  const filteredTests = selectedCategory === 'all'
    ? tests
    : tests.filter((t: any) => t.category === selectedCategory);

  return (
    <div>
      <PageHeader
        eyebrow="AUTOMATE"
        title="Continuous Controls Testing"
        description="Automated hourly compliance tests evaluating real local host telemetry, endpoint encryption, policy acceptance, and governance currency."
      >
        <button className="button button-primary" onClick={handleRunTests} disabled={running}>
          <Play size={14} />
          {running ? 'Running 12 Automated Tests…' : 'Run Tests Now'}
        </button>
        <button className="button" onClick={loadTests} title="Refresh test status">
          <RefreshCw size={14} />
        </button>
      </PageHeader>

      <Note>
        <strong>Automated Control Verification:</strong> Tests combine real local host telemetry (inspecting kernel LUKS full-disk encryption, local host firewall status, and SSH configuration) with continuous compliance database audits.
      </Note>

      {/* Overview Metric Row */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="metric">
          <span>Overall Test Health</span>
          <strong style={{ color: 'var(--accent)' }}>{data.health_percent}%</strong>
          <small>{data.passing} of {data.total} tests passing</small>
        </div>
        <div className="metric">
          <span>Passing Tests</span>
          <strong style={{ color: 'var(--accent)' }}>{data.passing}</strong>
          <small>Verified operational</small>
        </div>
        <div className="metric">
          <span>Warnings</span>
          <strong style={{ color: data.warning > 0 ? 'var(--warning)' : 'var(--ink)' }}>{data.warning}</strong>
          <small>Potential gaps or advisory</small>
        </div>
        <div className="metric">
          <span>Failing Tests</span>
          <strong style={{ color: data.failing > 0 ? 'var(--danger)' : 'var(--ink)' }}>{data.failing}</strong>
          <small>Requires immediate remediation</small>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
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

      {/* Test Results Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredTests.map((test: any) => {
          const isPassing = test.status === 'pass';
          const isWarning = test.status === 'warning';
          const isFailing = test.status === 'fail';

          return (
            <div
              key={test.id}
              className="card"
              style={{
                marginBottom: 0,
                borderLeft: `4px solid ${isPassing ? 'var(--accent)' : isWarning ? 'var(--warning)' : 'var(--danger)'}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ marginTop: '2px' }}>
                    {isPassing && <CheckCircle2 size={20} color="var(--accent)" />}
                    {isWarning && <AlertTriangle size={20} color="var(--warning)" />}
                    {isFailing && <AlertCircle size={20} color="var(--danger)" />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{test.title}</strong>
                      <span className="mono" style={{ fontSize: '11px', background: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
                        {test.control_code}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', background: '#f0f5f3', padding: '2px 6px', borderRadius: '4px' }}>
                        {test.category}
                      </span>
                    </div>

                    <p style={{ fontSize: '13px', color: 'var(--ink)', marginTop: '4px' }}>
                      {test.summary}
                    </p>

                    {test.remediation && (test.status !== 'pass') && (
                      <div style={{ marginTop: '8px', padding: '8px 12px', background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--muted)' }}>Remediation Guidance: </span>
                        <span>{test.remediation}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Badge value={test.status} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
