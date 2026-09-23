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

  // Active subtab: 'scorecard' | 'pbc' | 'sampling' | 'cuecs'
  const [activeTab, setActiveTab] = useState<'scorecard' | 'pbc' | 'sampling' | 'cuecs'>('scorecard');

  // Sampling states
  const [samplePopType, setSamplePopType] = useState('workforce');
  const [sampleSize, setSampleSize] = useState(5);
  const [sampleMethod, setSampleMethod] = useState<'random' | 'systematic' | 'judgmental'>('random');
  const [sampleSeed, setSampleSeed] = useState<number>(() => Math.floor(Math.random() * 900000) + 100000);
  const [completenessStmt, setCompletenessStmt] = useState(
    'Reconciled against active workforce directory as of current date; all active and onboarding personnel in scope.'
  );
  const [sampleResults, setSampleResults] = useState<any | null>(null);
  const [generatingSample, setGeneratingSample] = useState(false);
  const [savedSamples, setSavedSamples] = useState<any[]>([]);
  const [verifyStatus, setVerifyStatus] = useState<Record<string, any>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const loadSavedSamples = async () => {
    try {
      const res = await api.get('/sampling');
      setSavedSamples(res.items || []);
    } catch {
      // ignore
    }
  };

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
    loadSavedSamples();
  }, []);

  const handleGenerateSample = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!completenessStmt.trim()) {
      notify('Completeness statement is required (AU-C 530)', 'error');
      return;
    }
    setGeneratingSample(true);
    try {
      const res = await api.post('/sampling/generate', {
        name: `${samplePopType.toUpperCase()} Audit Sample (${sampleMethod})`,
        population_type: samplePopType,
        completeness_statement: completenessStmt.trim(),
        method: sampleMethod,
        sample_size: sampleSize,
        seed: sampleMethod !== 'judgmental' ? sampleSeed : undefined
      });
      setSampleResults(res);
      notify(`Sample generated: ${res.sample_size} records from population of ${res.population_size}`);
      loadSavedSamples();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setGeneratingSample(false);
    }
  };

  const handleVerifySample = async (id: string) => {
    setVerifyingId(id);
    try {
      const res = await api.post(`/sampling/${id}/verify`);
      setVerifyStatus(prev => ({ ...prev, [id]: res }));
      if (res.match) {
        notify('Sample verified: 100% reproducible with stored seed.');
      } else {
        notify('Verification mismatch detected!', 'error');
      }
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setVerifyingId(null);
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Generation & Definition Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Auditor Population Sampling Tool (AU-C 530)</h3>
                <p className="card-description">
                  Defensible, reproducible population sampling with mandatory completeness reconciliation, stored seeds, and zero fabricated attributes.
                </p>
              </div>
            </div>

            <form onSubmit={handleGenerateSample}>
              <div className="view-grid-four" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                <div className="field">
                  <span>Audit Population Type *</span>
                  <select value={samplePopType} onChange={e => setSamplePopType(e.target.value)}>
                    <option value="workforce">Workforce New Hires & Personnel</option>
                    <option value="vendors">Third-Party Vendors & Sub-processors</option>
                    <option value="controls">Applicable Compliance Controls</option>
                    <option value="evidence">Collected Compliance Evidence</option>
                    <option value="access_reviews">User Access Review Campaigns</option>
                  </select>
                </div>

                <div className="field">
                  <span>Sampling Method *</span>
                  <select value={sampleMethod} onChange={e => setSampleMethod(e.target.value as any)}>
                    <option value="random">Seeded Simple Random (AU-C 530)</option>
                    <option value="systematic">Systematic Interval (Every kth item)</option>
                    <option value="judgmental">Judgmental / Risk-Based (Manual)</option>
                  </select>
                </div>

                <div className="field">
                  <span>Sample Size *</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={sampleSize}
                    onChange={e => setSampleSize(Number(e.target.value))}
                  />
                  <small style={{ fontSize: '10px', color: 'var(--muted)' }}>
                    AICPA Norms: Annual: 1, Qtr: 2, Mth: 2, Wk: 5, Day: 20, Cont: 25
                  </small>
                </div>

                {sampleMethod !== 'judgmental' && (
                  <div className="field">
                    <span>Reproducible Seed *</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="number"
                        required
                        value={sampleSeed}
                        onChange={e => setSampleSeed(Number(e.target.value))}
                      />
                      <button
                        type="button"
                        className="button button-sm"
                        onClick={() => setSampleSeed(Math.floor(Math.random() * 900000) + 100000)}
                        title="Generate random seed"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="field" style={{ marginBottom: '16px' }}>
                <span style={{ fontWeight: 600 }}>Completeness Statement (Required for AU-C 530 Defensibility) *</span>
                <textarea
                  rows={2}
                  required
                  placeholder="Document population reconciliation, cutoff dates, and inclusion/exclusion criteria..."
                  value={completenessStmt}
                  onChange={e => setCompletenessStmt(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="button button-primary" disabled={generatingSample || !completenessStmt.trim()}>
                  <Sparkles size={14} /> {generatingSample ? 'Sampling…' : 'Generate & Persist Sample'}
                </button>
              </div>
            </form>
          </div>

          {/* Active Sample Results Table */}
          {sampleResults && (
            <div className="card">
              <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <div>
                  <strong style={{ fontSize: '15px' }}>{sampleResults.name}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '10px' }}>
                    Sampled {sampleResults.sample_size} of {sampleResults.population_size} records ({sampleResults.method} method, seed: {sampleResults.seed || 'none'})
                  </span>
                </div>
                <button
                  type="button"
                  className="button button-sm button-primary"
                  onClick={() => handleVerifySample(sampleResults.id)}
                  disabled={verifyingId === sampleResults.id}
                >
                  <CheckCircle2 size={12} />
                  {verifyingId === sampleResults.id ? 'Verifying…' : 'Re-verify Reproducibility'}
                </button>
              </div>

              {verifyStatus[sampleResults.id] && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  marginBottom: '14px',
                  fontSize: '12px',
                  background: verifyStatus[sampleResults.id].match ? 'rgba(115, 217, 177, 0.15)' : 'rgba(255, 107, 107, 0.15)',
                  border: `1px solid ${verifyStatus[sampleResults.id].match ? 'var(--success)' : 'var(--danger)'}`,
                  color: 'var(--ink)'
                }}>
                  {verifyStatus[sampleResults.id].match ? (
                    <span>✓ Reproducibility Verified: Exact byte-identical sample re-generated from seed {sampleResults.seed}.</span>
                  ) : (
                    <span>✗ Mismatch: Sample reproduction deviated from stored IDs.</span>
                  )}
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                      <th style={{ padding: '8px' }}>Identifier / Title</th>
                      <th style={{ padding: '8px' }}>Record ID</th>
                      <th style={{ padding: '8px' }}>Attributes (Verified Only)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleResults.sample_items?.map((item: any) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{item.title}</td>
                        <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>{item.id}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {item.email && <span className="badge badge-neutral">{item.email}</span>}
                            {item.role && <span className="badge badge-neutral">{item.role}</span>}
                            {item.background_check_status && (
                              <span className={`badge badge-${item.background_check_status === 'verified' ? 'success' : 'warning'}`}>
                                Background Check: {item.background_check_status}
                              </span>
                            )}
                            {item.soc2_cert_status && (
                              <span className={`badge badge-${item.soc2_cert_status === 'verified' ? 'success' : 'warning'}`}>
                                SOC 2: {item.soc2_cert_status}
                              </span>
                            )}
                            {item.status && <span className="badge badge-neutral">{item.status}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Saved Samples History */}
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div className="view-row" style={{ padding: '12px 18px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
              <strong style={{ fontSize: '13px' }}>Persisted Audit Samples ({savedSamples.length})</strong>
            </div>

            {savedSamples.length === 0 ? (
              <p style={{ padding: '20px', color: 'var(--muted)', fontSize: '12px' }}>No saved audit samples yet.</p>
            ) : (
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                      <th style={{ padding: '8px 12px' }}>Sample Name</th>
                      <th style={{ padding: '8px 12px' }}>Population</th>
                      <th style={{ padding: '8px 12px' }}>Method & Seed</th>
                      <th style={{ padding: '8px 12px' }}>Size</th>
                      <th style={{ padding: '8px 12px' }}>Completeness Statement</th>
                      <th style={{ padding: '8px 12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedSamples.map((s: any) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.name}</td>
                        <td style={{ padding: '10px 12px' }}>{s.population_type} (N={s.population_size})</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>
                          {s.method} {s.seed ? `(seed: ${s.seed})` : ''}
                        </td>
                        <td style={{ padding: '10px 12px' }}>{s.sample_size}</td>
                        <td style={{ padding: '10px 12px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.completeness_statement}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button
                            type="button"
                            className="button button-sm"
                            style={{ padding: '2px 8px', fontSize: '11px' }}
                            onClick={() => handleVerifySample(s.id)}
                            disabled={verifyingId === s.id}
                          >
                            {verifyingId === s.id ? 'Verifying…' : 'Verify'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
