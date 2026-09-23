import { useEffect, useState } from 'react';
import { Shield, CheckCircle2, AlertCircle, AlertTriangle, ArrowRight, Dna, FileCheck, FileSpreadsheet, RefreshCw, Sparkles, Download, Target } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, Note } from '../components/ui';
import type { Notify, Navigate } from '../lib/types';

export function SOC2ReadinessView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [gapData, setGapData] = useState<any | null>(null);
  const [pbcData, setPbcData] = useState<any | null>(null);
  const [cuecData, setCuecData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sampling tool states
  const [samplePopType, setSamplePopType] = useState('workforce');
  const [sampleSize, setSampleSize] = useState(5);
  const [sampleResults, setSampleResults] = useState<any | null>(null);
  const [generatingSample, setGeneratingSample] = useState(false);

  // Active subtab: 'scorecard' | 'pbc' | 'sampling' | 'cuecs'
  const [activeTab, setActiveTab] = useState<'scorecard' | 'pbc' | 'sampling' | 'cuecs'>('scorecard');

  const loadSOC2Data = async () => {
    setLoading(true);
    setError('');
    try {
      const [gap, pbc, cuecs] = await Promise.all([
        api.get('/soc2/gap_analysis'),
        api.get('/soc2/pbc_list'),
        api.get('/soc2/cuecs_and_csocs')
      ]);
      setGapData(gap);
      setPbcData(pbc);
      setCuecData(cuecs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSOC2Data();
  }, []);

  const handleGenerateSample = async () => {
    setGeneratingSample(true);
    try {
      const res = await api.post('/soc2/sample_generator', {
        population_type: samplePopType,
        sample_size: sampleSize
      });
      setSampleResults(res);
      notify(`Generated ${res.sample_size} random audit samples from ${res.population_total} total records`);
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setGeneratingSample(false);
    }
  };

  if (loading && !gapData) return <Loading label="Calculating SOC 2 Type 1 & 2 audit readiness…" />;
  if (error) return <ErrorState message={error} retry={loadSOC2Data} />;

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow="ATTESTATION"
        title="SOC 2 Readiness"
        description="Review Type I and Type II gaps, evidence requests, and audit samples."
      >
        <div className="view-inline" style={{ display: 'flex', gap: '8px' }}>
          <button
            className="button button-primary"
            onClick={() => onNavigate('pilot')}
            title="Validate JEV System One with a blind human pilot"
          >
            <Target size={14} /> Validate with Blind Pilot
          </button>
          <button className="button" onClick={loadSOC2Data} title="Refresh audit scorecard">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </PageHeader>

      {/* Pilot Validation Callout */}
      <div className="card" style={{ padding: '12px 18px', marginBottom: '20px', background: 'var(--surface-raised)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={18} color="var(--accent)" />
          <span style={{ fontSize: '13px', color: 'var(--ink)' }}>
            <strong>JEV Policy-to-Control Assurance:</strong> Validate AI judgment on tofrom internal policies before audit submission.
          </span>
        </div>
        <button
          type="button"
          className="button button-sm"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          onClick={() => onNavigate('pilot')}
        >
          Validate with blind pilot →
        </button>
      </div>

      {/* Type 1 vs Type 2 Comparative Banner */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div className="card" style={{ borderLeft: `4px solid ${gapData.type1_ready ? 'var(--accent)' : 'var(--warning)'}` }}>
          <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="eyebrow" style={{ color: 'var(--muted)' }}>Point-in-Time Design</span>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>SOC 2 Type I Readiness</h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                Evaluates whether compliance controls and policies are suitably designed as of a specific date.
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ fontSize: '28px', color: gapData.type1_ready ? 'var(--accent)' : 'var(--warning)' }}>
                {gapData.type1_score}%
              </strong>
              <div>
                <span className={`badge ${gapData.type1_ready ? 'badge-green' : 'badge-amber'}`}>
                  {gapData.type1_ready ? 'Audit Ready' : 'In Progress'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: `4px solid ${gapData.type2_ready ? 'var(--accent)' : 'var(--warning)'}` }}>
          <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="eyebrow" style={{ color: 'var(--muted)' }}>Period-of-Time Operating Effectiveness</span>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>SOC 2 Type II Readiness</h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                Evaluates operating effectiveness and continuous evidence across the observation window (3–12 months).
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ fontSize: '28px', color: gapData.type2_ready ? 'var(--accent)' : 'var(--warning)' }}>
                {gapData.type2_score}%
              </strong>
              <div>
                <span className={`badge ${gapData.type2_ready ? 'badge-green' : 'badge-amber'}`}>
                  {gapData.type2_ready ? 'Audit Ready' : 'In Progress'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtab Bar */}
      <div className="view-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '20px', background: 'var(--card-bg)', borderRadius: '8px 8px 0 0', padding: '0 16px' }}>
        {[
          { id: 'scorecard', label: 'Readiness & Gaps' },
          { id: 'pbc', label: `PBC Requests (${pbcData?.staged_count || 0}/${pbcData?.total || 0} Staged)` },
          { id: 'sampling', label: 'Audit Sampling' },
          { id: 'cuecs', label: 'CUEC & CSOC Registers' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '14px 18px',
              border: 'none',
              background: 'transparent',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Readiness & Gap Analysis */}
      {activeTab === 'scorecard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Observation Tracker Countdown Strip */}
          <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, var(--card-bg) 0%, var(--surface-raised) 100%)', borderLeft: '4px solid var(--accent)' }}>
            <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Observation Period Countdown</span>
                <h3 style={{ margin: '2px 0 0', fontSize: '18px', color: 'var(--ink)' }}>
                  Target Start: {gapData.observation_tracker?.start_date || '2027-01-01'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  Continuous operating effectiveness window ({gapData.observation_tracker?.target_type || 'Type II'}) · Auditor: {gapData.observation_tracker?.auditor || 'Pending assignment'}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: '32px', color: 'var(--accent)' }}>
                  {gapData.observation_tracker?.days_remaining ?? '—'}
                </strong>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Days Remaining</span>
              </div>
            </div>
          </div>

          <div className="grid-2">
            {/* Type 1 Gaps */}
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--ink)' }}>
                Type I Control Design Criteria
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {gapData.type1_items.map((item: any, idx: number) => {
                  const isPass = item.status === 'pass';
                  return (
                    <div className="view-row" key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                      <div>
                        <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isPass ? <CheckCircle2 size={16} color="var(--accent)" /> : <AlertCircle size={16} color="var(--danger)" />}
                          <strong style={{ fontSize: '13px' }}>{item.title}</strong>
                        </div>
                        <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', marginLeft: '22px' }}>
                          {item.detail}
                        </small>
                      </div>
                      <Badge value={item.status} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Type 2 Gaps */}
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--ink)' }}>
                Type II Operating Effectiveness Criteria
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {gapData.type2_items.map((item: any, idx: number) => {
                  const isPass = item.status === 'pass';
                  return (
                    <div className="view-row" key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                      <div>
                        <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isPass ? <CheckCircle2 size={16} color="var(--accent)" /> : <AlertTriangle size={16} color="var(--warning)" />}
                          <strong style={{ fontSize: '13px' }}>{item.title}</strong>
                        </div>
                        <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', marginLeft: '22px' }}>
                          {item.detail}
                        </small>
                      </div>
                      <Badge value={item.status} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Per-Control Evidence Status Table */}
          {gapData.per_control_evidence && (
            <div className="card" style={{ padding: '16px 20px' }}>
              <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Per-Control Evidence Proof Status</h3>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0' }}>
                    Auditor evidence artifact currency linked to each compliance control.
                  </p>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
                  Coverage: {gapData.evidence_coverage_pct}%
                </span>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Control</th>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Evidence Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gapData.per_control_evidence.map((ce: any) => {
                      const isCurrent = ce.evidence_status === 'current';
                      const isExpired = ce.evidence_status === 'expired';
                      return (
                        <tr key={ce.control_id}>
                          <td className="mono" style={{ fontWeight: 600 }}>{ce.control_code}</td>
                          <td>{ce.control_title}</td>
                          <td><span style={{ fontSize: '11px', color: 'var(--muted)' }}>{ce.category}</span></td>
                          <td>
                            {isCurrent ? (
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--success)' }}>
                                ● Current ({ce.valid_count} proof)
                              </span>
                            ) : isExpired ? (
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--danger)' }}>
                                ▲ Expired ({ce.expired_count} expired)
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                ○ Missing Evidence
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="button button-sm"
                              onClick={() => onNavigate('evidence')}
                            >
                              Add Proof
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Auditor PBC Request List */}
      {activeTab === 'pbc' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="view-row" style={{ padding: '16px 20px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Prepared By Client (PBC) Evidence Deliverables</h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                Standard AICPA auditor evidence requests mapped directly to your local repositories.
              </p>
            </div>
            <div className="view-inline" style={{ display: 'flex', gap: '8px' }}>
              <a
                href="/api/soc2/pbc/export_package"
                download="tofrom_SOC2_PBC_Package.zip"
                className="button button-sm button-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
              >
                <Download size={13} /> Export Auditor PBC Package (ZIP)
              </a>
              <span className="badge badge-green">
                {pbcData?.staged_count} of {pbcData?.total} Deliverables Staged ({pbcData?.readiness_percent}%)
              </span>
            </div>
          </div>

          <div className="view-table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>ID & Category</th>
                <th>Auditor Request Deliverable</th>
                <th>TSC Mapping</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pbcData?.items?.map((item: any) => (
                <tr key={item.id}>
                  <td>
                    <span className="mono" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)' }}>{item.id}</span>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.category}</div>
                  </td>
                  <td>
                    <strong>{item.title}</strong>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{item.description}</p>
                    {item.evidence_items?.length > 0 && (
                      <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--accent)' }}>
                        Linked files: {item.evidence_items.map((e: any) => e.filename || e.title).join(', ')}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: '11px', background: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
                      {item.control_code}
                    </span>
                  </td>
                  <td>
                    <Badge value={item.status === 'staged' ? 'complete' : 'pending'} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="view-inline" style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="button button-sm button-primary"
                        onClick={async () => {
                          try {
                            await api.post(`/soc2/pbc/${item.id}/stage_evidence`, {});
                            notify(`Staged evidence for ${item.id} (${item.control_code})`);
                            loadSOC2Data();
                          } catch (e: any) {
                            notify(e.message, 'error');
                          }
                        }}
                      >
                        {item.status === 'staged' ? 'Re-Stage' : 'Quick Stage'}
                      </button>
                      <button
                        type="button"
                        className="button button-sm"
                        onClick={() => onNavigate('evidence')}
                        title="Open Evidence Repository"
                      >
                        Repository →
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Tab 3: Population Sampling Engine */}
      {activeTab === 'sampling' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Auditor Population Sampling Tool</h3>
              <p className="card-description">
                AICPA auditors test Type 2 operating effectiveness by requesting random population samples across new hires, pull requests, and access changes.
              </p>
            </div>
          </div>

          <div className="view-grid-three" style={{ display: 'grid', gap: '16px', background: 'var(--surface-raised)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '20px' }}>
            <div className="field">
              <span>Select Audit Population</span>
              <select value={samplePopType} onChange={e => setSamplePopType(e.target.value)}>
                <option value="workforce">Workforce New Hires & Personnel</option>
                <option value="vendors">Third-Party Vendors & Sub-processors</option>
                <option value="controls">Applicable Compliance Controls</option>
              </select>
            </div>

            <div className="field">
              <span>Sample Size</span>
              <input
                type="number"
                min="1"
                max="25"
                value={sampleSize}
                onChange={e => setSampleSize(Number(e.target.value))}
              />
            </div>

            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <button className="button button-primary" onClick={handleGenerateSample} disabled={generatingSample}>
                <Sparkles size={14} /> {generatingSample ? 'Sampling…' : 'Generate Random Sample'}
              </button>
            </div>
          </div>

          {/* Sample Results Table */}
          {sampleResults && (
            <div>
              <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <strong style={{ fontSize: '14px' }}>
                  Sampled {sampleResults.sample_size} records from population of {sampleResults.population_total}
                </strong>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Generated at {sampleResults.generated_at}
                </span>
              </div>

              <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                <pre style={{ padding: '16px', fontSize: '12px', fontFamily: 'var(--font-mono)', maxHeight: '300px', overflowY: 'auto' }}>
                  {JSON.stringify(sampleResults.samples, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: CUECs & CSOCs Registers */}
      {activeTab === 'cuecs' && (
        <div className="grid-2">
          {/* CUECs */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: 'var(--ink)' }}>
              Complementary User Entity Controls (CUECs)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px' }}>
              Controls that customers are required to implement on their side to ensure system commitments are met.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cuecData?.cuecs?.map((c: any) => (
                <div key={c.id} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 14px' }}>
                  <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '13px' }}>{c.title}</strong>
                    <span className="mono" style={{ fontSize: '11px', background: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>{c.criterion}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>{c.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CSOCs */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: 'var(--ink)' }}>
              Complementary Subservice Controls (CSOCs)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px' }}>
              Controls that cloud and infrastructure providers (AWS, Google, Okta) are relied upon to operate.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cuecData?.csocs?.map((c: any) => (
                <div key={c.id} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 14px' }}>
                  <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '13px' }}>{c.title}</strong>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>{c.vendor}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>{c.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
