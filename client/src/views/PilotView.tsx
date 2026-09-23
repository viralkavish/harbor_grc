import { useState, useEffect } from 'react';
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, MinusCircle, Sparkles,
  ArrowRight, ArrowLeft, RefreshCw, Eye, Target, Check, DollarSign,
  Play, History, Layers
} from 'lucide-react';
import { api } from '../lib/api';
import { Loading, ErrorState, Badge } from '../components/ui';
import type { Notify, Navigate } from '../lib/types';

interface PilotViewProps {
  notify: Notify;
  onNavigate: Navigate;
}

export function PilotView({ notify, onNavigate }: PilotViewProps) {
  const [pilots, setPilots] = useState<any[]>([]);
  const [activePilotId, setActivePilotId] = useState<string | null>(null);
  const [pilot, setPilot] = useState<any | null>(null);
  const [results, setResults] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [gradingIndex, setGradingIndex] = useState(0);

  // Setup state
  const [sampleSize, setSampleSize] = useState(36);
  const [pilotName, setPilotName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadPilots = async () => {
    try {
      const res = await api.get('/pilot/list');
      setPilots(res.items || []);
      if (res.items && res.items.length > 0 && !activePilotId) {
        loadPilotDetails(res.items[0].id);
      } else {
        setLoading(false);
      }
    } catch (e: any) {
      notify(e.message, 'error');
      setLoading(false);
    }
  };

  const loadPilotDetails = async (id: string) => {
    setLoading(true);
    setActivePilotId(id);
    try {
      const p = await api.get(`/pilot/${id}`);
      setPilot(p);
      if (p.is_revealed) {
        const res = await api.get(`/pilot/${id}/results?reveal=false`);
        setResults(res.metrics);
      } else {
        setResults(null);
        // Find first ungraded index
        const firstUngraded = p.pairs.findIndex((pair: any) => !pair.human_verdict);
        setGradingIndex(firstUngraded >= 0 ? firstUngraded : 0);
      }
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPilots();
  }, []);

  const handleCreatePilot = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post('/pilot/create', {
        sample_size: sampleSize,
        name: pilotName || `TwoFrom Blind Pilot (${sampleSize} pairs)`
      });
      notify(`Created blind pilot with ${res.sample_size} stratified pairs`);
      setPilotName('');
      await loadPilots();
      await loadPilotDetails(res.id);
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRunJev = async () => {
    if (!activePilotId) return;
    setEvaluating(true);
    try {
      const res = await api.post(`/pilot/${activePilotId}/run`);
      notify(`Jev evaluated ${res.evaluated_pairs} pairs. Ready for blind grading.`);
      await loadPilotDetails(activePilotId);
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setEvaluating(false);
    }
  };

  const handleGrade = async (verdict: string) => {
    if (!pilot || !pilot.pairs[gradingIndex]) return;
    const currentPair = pilot.pairs[gradingIndex];
    try {
      await api.post(`/pilot/${pilot.id}/grade`, {
        pair_id: currentPair.id,
        human_verdict: verdict
      });

      // Update local state smoothly
      const updatedPairs = [...pilot.pairs];
      updatedPairs[gradingIndex] = { ...currentPair, human_verdict: verdict };
      setPilot({ ...pilot, pairs: updatedPairs, graded_count: pilot.graded_count + (currentPair.human_verdict ? 0 : 1) });

      if (gradingIndex < pilot.pairs.length - 1) {
        setGradingIndex(gradingIndex + 1);
      }
    } catch (e: any) {
      notify(e.message, 'error');
    }
  };

  const handleRevealResults = async () => {
    if (!activePilotId) return;
    setLoading(true);
    try {
      const res = await api.get(`/pilot/${activePilotId}/results`);
      setResults(res.metrics);
      await loadPilotDetails(activePilotId);
      notify('Blind pilot revealed! Calculated agreement and gate decision.');
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !pilot) return <Loading label="Loading TwoFrom Blind Validation Pilots…" />;

  const currentPair = pilot?.pairs?.[gradingIndex];
  const isRevealed = pilot?.is_revealed;
  const gradedCount = pilot?.pairs?.filter((p: any) => p.human_verdict).length || 0;
  const totalPairs = pilot?.pairs?.length || 0;
  const progressPct = totalPairs ? Math.round((gradedCount / totalPairs) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header View Row */}
      <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 className="view-title" style={{ margin: 0 }}>Blind Pilot Validation</h1>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
              TypeSafe JEV Ground Truth Gate
            </span>
          </div>
          <p className="view-subtitle" style={{ margin: 0 }}>
            Empirically validate TypeSafe JEV System One judgment on TwoFrom policies before trusting automated control mappings.
          </p>
        </div>

        <div className="view-inline" style={{ display: 'flex', gap: '8px' }}>
          {pilots.length > 0 && (
            <select
              value={activePilotId || ''}
              onChange={e => loadPilotDetails(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: '13px' }}
            >
              {pilots.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.status})
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="button button-sm"
            onClick={() => { setPilot(null); setActivePilotId(null); }}
          >
            + New Pilot
          </button>
        </div>
      </div>

      {/* Setup View if no active pilot chosen or creating new */}
      {!pilot && (
        <div className="card" style={{ maxWidth: '650px', margin: '0 auto' }}>
          <div className="card-header">
            <h3 className="card-title">Initiate New Blind Pilot</h3>
            <p className="card-description">
              Generate a stratified sample of policy and control pairings across all compliance categories.
            </p>
          </div>
          <form onSubmit={handleCreatePilot} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="field">
              <span>Pilot Name</span>
              <input
                type="text"
                placeholder="e.g. Q3 SOC 2 Policy Validation Pilot"
                value={pilotName}
                onChange={e => setPilotName(e.target.value)}
              />
            </div>
            <div className="field">
              <span>Stratified Sample Size</span>
              <select
                value={sampleSize}
                onChange={e => setSampleSize(Number(e.target.value))}
              >
                <option value={12}>12 pairs (Quick sanity check · ~2 min grading)</option>
                <option value={24}>24 pairs (Standard audit sample · ~5 min grading)</option>
                <option value={36}>36 pairs (Recommended AICPA benchmark sample · ~8 min grading)</option>
                <option value={48}>48 pairs (High-rigor comprehensive evaluation)</option>
              </select>
              <small style={{ color: 'var(--muted)', marginTop: '4px' }}>
                Samples are stratified evenly across Logical Access, Systems Operations, Change Management, Risk, and HR.
              </small>
            </div>
            <div className="view-inline" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="submit" className="button button-primary" disabled={creating}>
                {creating ? 'Generating Sample…' : 'Generate Stratified Pilot'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Pilot Container */}
      {pilot && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Status & Progress Ribbon */}
          <div className="card" style={{ padding: '14px 18px', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <strong>{pilot.name}</strong>
              <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>({pilot.sample_size} sample pairs)</span>
              {isRevealed ? (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'var(--success-light)', color: 'var(--success)' }}>
                  ✓ Revealed & Evaluated
                </span>
              ) : pilot.pairs.some((p: any) => p.jev_evaluated) ? (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'var(--warning-light)', color: 'var(--warning)' }}>
                  Blind Grading in Progress ({progressPct}% complete)
                </span>
              ) : (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-raised)', color: 'var(--muted)' }}>
                  Pending Jev Evaluation
                </span>
              )}
            </div>

            <div className="view-inline" style={{ display: 'flex', gap: '8px' }}>
              {!pilot.pairs.some((p: any) => p.jev_evaluated) && (
                <button
                  type="button"
                  className="button button-sm button-primary"
                  onClick={handleRunJev}
                  disabled={evaluating}
                >
                  <Play size={13} /> {evaluating ? 'Running Jev System One…' : 'Run Jev Evaluations'}
                </button>
              )}

              {!isRevealed && (
                <button
                  type="button"
                  className="button button-sm"
                  onClick={handleRevealResults}
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  <Eye size={13} /> Reveal Results & Gate
                </button>
              )}
            </div>
          </div>

          {/* STAGE 1: Blind Grading View (when not revealed) */}
          {!isRevealed && currentPair && (
            <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
              {/* Grading Top Progress */}
              <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                    Blind Grading Queue · Pair {gradingIndex + 1} of {totalPairs}
                  </span>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    {gradedCount} of {totalPairs} graded ({totalPairs - gradedCount} remaining)
                  </div>
                </div>

                <div className="view-inline" style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="button button-sm"
                    disabled={gradingIndex === 0}
                    onClick={() => setGradingIndex(gradingIndex - 1)}
                  >
                    <ArrowLeft size={13} /> Prev
                  </button>
                  <button
                    type="button"
                    className="button button-sm"
                    disabled={gradingIndex === totalPairs - 1}
                    onClick={() => setGradingIndex(gradingIndex + 1)}
                  >
                    Next <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {/* Progress track */}
              <div style={{ height: '4px', background: 'var(--surface-raised)', borderRadius: '2px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--accent)' }} />
              </div>

              {/* Pair Content Display */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '18px', marginBottom: '20px' }}>
                {/* Control Details */}
                <div style={{ background: 'var(--surface-raised)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Target Compliance Control</span>
                  <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', marginBottom: '6px' }}>
                    <span className="mono" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>{currentPair.control_code}</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', background: 'var(--card-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                      {currentPair.control_category}
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: 'var(--ink)' }}>{currentPair.control_title}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                    Does the policy snippet to the right satisfy, partially cover, or contradict this control objective?
                  </p>
                </div>

                {/* Policy Snippet */}
                <div style={{ background: 'var(--surface-raised)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10.5px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Policy Source Document</span>
                    <strong style={{ fontSize: '12px', color: 'var(--accent)' }}>{currentPair.policy_title}</strong>
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'var(--card-bg)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px', lineHeight: '1.5', color: 'var(--ink)', fontFamily: 'inherit' }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{currentPair.policy_snippet}</pre>
                  </div>
                </div>
              </div>

              {/* Blind Rubric Action Bar */}
              <div style={{ background: 'var(--surface-raised)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                    Your Independent Judgment:
                  </span>
                  {currentPair.human_verdict && (
                    <span style={{ fontSize: '12px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={14} /> Graded as <strong>{currentPair.human_verdict}</strong>
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
                  <button
                    type="button"
                    className={`button ${currentPair.human_verdict === 'compatible' ? 'button-primary' : ''}`}
                    style={{ borderColor: 'var(--success)', color: currentPair.human_verdict === 'compatible' ? '#fff' : 'var(--success)', padding: '10px' }}
                    onClick={() => handleGrade('compatible')}
                  >
                    <CheckCircle2 size={15} /> Compatible
                  </button>
                  <button
                    type="button"
                    className={`button ${currentPair.human_verdict === 'gap' ? 'button-primary' : ''}`}
                    style={{ borderColor: 'var(--warning)', color: currentPair.human_verdict === 'gap' ? '#fff' : 'var(--warning)', padding: '10px' }}
                    onClick={() => handleGrade('gap')}
                  >
                    <AlertTriangle size={15} /> Partial Gap
                  </button>
                  <button
                    type="button"
                    className={`button ${currentPair.human_verdict === 'conflict' ? 'button-primary' : ''}`}
                    style={{ borderColor: 'var(--danger)', color: currentPair.human_verdict === 'conflict' ? '#fff' : 'var(--danger)', padding: '10px' }}
                    onClick={() => handleGrade('conflict')}
                  >
                    <XCircle size={15} /> Conflict
                  </button>
                  <button
                    type="button"
                    className={`button ${currentPair.human_verdict === 'not_applicable' ? 'button-primary' : ''}`}
                    style={{ borderColor: 'var(--muted)', color: 'var(--muted)', padding: '10px' }}
                    onClick={() => handleGrade('not_applicable')}
                  >
                    <MinusCircle size={15} /> Not Applicable
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2: Results & Gate Dashboard (when revealed) */}
          {isRevealed && results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* GO / NO-GO Gate Banner */}
              <div
                className="card"
                style={{
                  padding: '20px 24px',
                  margin: 0,
                  borderLeft: `6px solid ${results.gate.verdict === 'GO' ? 'var(--success)' : 'var(--danger)'}`,
                  background: 'linear-gradient(135deg, var(--card-bg) 0%, var(--surface-raised) 100%)'
                }}
              >
                <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
                  <div>
                    <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span
                        style={{
                          fontSize: '18px',
                          fontWeight: 800,
                          padding: '4px 14px',
                          borderRadius: '6px',
                          background: results.gate.verdict === 'GO' ? 'var(--success)' : 'var(--danger)',
                          color: '#000',
                          letterSpacing: '0.05em'
                        }}
                      >
                        GATE VERDICT: {results.gate.verdict}
                      </span>
                      <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                        {results.gate.verdict === 'GO' ? 'JEV Qualified for Production Autopilot' : 'JEV Failed Validation Thresholds'}
                      </strong>
                    </div>

                    <div style={{ marginTop: '8px' }}>
                      {results.gate.reasons.map((r: string, i: number) => (
                        <div key={i} style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: '3px' }}>
                          • {r}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Token & Cost Meter */}
                  <div style={{ background: 'var(--surface-raised)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Pilot Inference Cost</span>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)', marginTop: '2px' }}>
                      ${results.cost_usd.toFixed(6)}
                    </div>
                    <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                      {results.estimated_input_tokens.toLocaleString()} tokens ($0.042 / 1M)
                    </small>
                  </div>
                </div>
              </div>

              {/* Metric Counters Strip */}
              <div className="view-grid-four" style={{ display: 'grid', gap: '14px' }}>
                <div className="card" style={{ padding: '16px', margin: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Overall Agreement</span>
                  <div className="view-inline" style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                    <strong style={{ fontSize: '26px', color: results.overall_agreement_pct >= 90 ? 'var(--success)' : 'var(--danger)' }}>
                      {results.overall_agreement_pct}%
                    </strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>(Threshold: ≥ 90%)</span>
                  </div>
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                    {results.agreed_count} of {results.total_graded} pairs agreed
                  </small>
                </div>

                <div className="card" style={{ padding: '16px', margin: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>High-Conf Agreement</span>
                  <div className="view-inline" style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                    <strong style={{ fontSize: '26px', color: results.high_conf_agreement_pct >= 95 ? 'var(--success)' : 'var(--danger)' }}>
                      {results.high_conf_agreement_pct}%
                    </strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>(Threshold: ≥ 95%)</span>
                  </div>
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                    {results.high_conf_agreed} of {results.high_conf_total} calls (≥ 0.80 conf)
                  </small>
                </div>

                <div className="card" style={{ padding: '16px', margin: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Sample Evaluated</span>
                  <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink)', marginTop: '4px' }}>
                    {results.total_graded} / {results.total_pairs}
                  </div>
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Across 5 compliance domains</small>
                </div>

                <div className="card" style={{ padding: '16px', margin: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Deciding Engine</span>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent)', marginTop: '8px' }}>
                    TypeSafe JEV (jev-1.13.0)
                  </div>
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Choice judgment primitives</small>
                </div>
              </div>

              {/* 4x4 Confusion Matrix */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">4x4 Confusion Matrix (Human vs JEV System One)</h3>
                  <p className="card-description">
                    Rows represent independent human reviewer grades; columns represent JEV model decisions. Green diagonal indicates perfect agreement.
                  </p>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', fontSize: '12.5px' }}>
                    <thead>
                      <tr>
                        <th style={{ background: 'var(--surface-raised)' }}>Human \ JEV</th>
                        <th style={{ textAlign: 'center' }}>Compatible</th>
                        <th style={{ textAlign: 'center' }}>Gap</th>
                        <th style={{ textAlign: 'center' }}>Conflict</th>
                        <th style={{ textAlign: 'center' }}>Not Applicable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['compatible', 'gap', 'conflict', 'not_applicable'].map(h => (
                        <tr key={h}>
                          <td style={{ fontWeight: 600, textTransform: 'capitalize', background: 'var(--surface-raised)' }}>
                            {h.replace('_', ' ')}
                          </td>
                          {['compatible', 'gap', 'conflict', 'not_applicable'].map(j => {
                            const count = results.confusion_matrix?.[h]?.[j] || 0;
                            const isDiagonal = (h === j);
                            return (
                              <td
                                key={j}
                                style={{
                                  textAlign: 'center',
                                  fontWeight: count > 0 ? 700 : 400,
                                  background: isDiagonal && count > 0 ? 'var(--success-light)' : count > 0 ? 'var(--danger-light)' : 'transparent',
                                  color: isDiagonal && count > 0 ? 'var(--success)' : count > 0 ? 'var(--danger)' : 'var(--muted)'
                                }}
                              >
                                {count}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Itemized Comparison Table */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Itemized Pair-by-Pair Comparison</h3>
                  <p className="card-description">Detailed audit log of every evaluated pair with individual agreement status.</p>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: '450px' }}>
                  <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Control</th>
                        <th>Policy</th>
                        <th>Snippet</th>
                        <th>Human Grade</th>
                        <th>Jev Verdict</th>
                        <th>Confidence</th>
                        <th>Agreement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pilot.pairs.map((p: any) => {
                        const agreed = (p.human_verdict?.toLowerCase() === p.jev_verdict?.toLowerCase());
                        return (
                          <tr key={p.id}>
                            <td className="mono" style={{ fontWeight: 600 }}>{p.control_code}</td>
                            <td>{p.policy_title}</td>
                            <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                              {p.policy_snippet}
                            </td>
                            <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{p.human_verdict || 'Ungraded'}</td>
                            <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{p.jev_verdict || '—'}</td>
                            <td className="mono">{p.jev_confidence ? `${Math.round(p.jev_confidence * 100)}%` : p.jev_score ? `${Math.round(p.jev_score * 100)}% (heur)` : '—'}</td>
                            <td>
                              {agreed ? (
                                <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ Match</span>
                              ) : (
                                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>✗ Mismatch</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
