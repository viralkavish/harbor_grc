import { useState, useEffect } from 'react';
import {
  Sparkles, CheckCircle2, AlertTriangle, XCircle, Upload, FileText,
  ArrowRight, Shield, Layers, Filter, Check, RefreshCw, Link2, ExternalLink
} from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Loading } from './ui';
import type { DataRecord, Notify, Navigate } from '../lib/types';

interface JevModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy?: DataRecord | null;
  onPolicyUpdated: () => void;
  notify: Notify;
  onNavigate: Navigate;
}

export function JevPolicyModal({
  isOpen,
  onClose,
  policy,
  onPolicyUpdated,
  notify,
  onNavigate
}: JevModalProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'upload' | 'paste'>(policy ? 'current' : 'upload');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'compatible' | 'gap' | 'conflict'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [pastedTitle, setPastedTitle] = useState('Custom Policy Draft');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (policy && policy.content) {
        setActiveTab('current');
        evaluatePolicyContent(policy.content, policy.id, policy.title);
      } else {
        setActiveTab('upload');
        setEvaluation(null);
      }
    }
  }, [isOpen, policy?.id]);

  if (!isOpen) return null;

  const evaluatePolicyContent = async (content: string, policyId?: string, title?: string) => {
    if (!content.trim()) {
      notify('Please provide policy content to evaluate', 'error');
      return;
    }
    setEvaluating(true);
    try {
      const res = await api.post('/jev/evaluate', {
        policy_id: policyId,
        content,
        title: title || 'Policy Evaluation'
      });
      setEvaluation(res);
      notify(`JEV Evaluation complete: ${res.summary.compatible_count} controls compatible`);
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setEvaluating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setEvaluating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.post('/jev/upload_and_evaluate', formData);
      setEvaluation(data);
      notify(`JEV analyzed "${file.name}": ${data.summary?.compatible_count || 0} controls compatible`);
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setEvaluating(false);
    }
  };

  const handleLinkCompatible = async () => {
    if (!policy || !evaluation) return;
    const compatibleIds = evaluation.results
      .filter((r: any) => r.verdict === 'compatible')
      .map((r: any) => r.control_id);

    if (compatibleIds.length === 0) {
      notify('No compatible controls identified to link', 'error');
      return;
    }

    setLinking(true);
    try {
      const res = await api.post(`/jev/policies/${policy.id}/link_compatible`, {
        control_ids: compatibleIds
      });
      notify(`Successfully auto-linked ${res.newly_added_count} new compatible controls to policy!`);
      onPolicyUpdated();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setLinking(false);
    }
  };

  const results = evaluation?.results || [];
  const filteredResults = results.filter((r: any) => {
    if (activeFilter === 'compatible' && r.verdict !== 'compatible') return false;
    if (activeFilter === 'gap' && r.verdict !== 'gap') return false;
    if (activeFilter === 'conflict' && r.verdict !== 'conflict') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const codeMatch = r.control_code?.toLowerCase().includes(q);
      const titleMatch = r.control_title?.toLowerCase().includes(q);
      const summaryMatch = r.summary?.toLowerCase().includes(q);
      return codeMatch || titleMatch || summaryMatch;
    }
    return true;
  });

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content card harbor-view-modal jev-policy-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '920px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}
      >
        {/* Modal Header */}
        <div className="view-row" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-raised)' }}>
          <div className="view-inline view-icon-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="view-inline" style={{ width: '32px', height: '32px', background: 'var(--accent-strong)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
              <Sparkles size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)' }}>JEV Policy Control Matcher</h2>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                Compare policy text with controls and review supporting clauses or gaps.
              </p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose}>✕</button>
        </div>

        {/* Source Tabs */}
        <div className="view-inline" style={{ display: 'flex', gap: '8px', padding: '12px 24px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
          {policy && (
            <button
              className={`button button-sm ${activeTab === 'current' ? 'button-primary' : ''}`}
              onClick={() => {
                setActiveTab('current');
                evaluatePolicyContent(policy.content, policy.id, policy.title);
              }}
            >
              Current Policy ({policy.title.slice(0, 24)}…)
            </button>
          )}
          <button
            className={`button button-sm ${activeTab === 'upload' ? 'button-primary' : ''}`}
            onClick={() => { setActiveTab('upload'); setEvaluation(null); }}
          >
            <Upload size={12} /> Upload Policy File (.md, .txt)
          </button>
          <button
            className={`button button-sm ${activeTab === 'paste' ? 'button-primary' : ''}`}
            onClick={() => { setActiveTab('paste'); setEvaluation(null); }}
          >
            <FileText size={12} /> Paste Policy Text
          </button>
        </div>

        {/* Body content */}
        <div className="jev-policy-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* Upload Input view */}
          {activeTab === 'upload' && !evaluation && (
            <div style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '40px 20px', textAlign: 'center', background: 'var(--surface-raised)' }}>
              <Upload size={32} style={{ margin: '0 auto 12px', color: 'var(--accent)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Upload Policy to Match Controls</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', maxWidth: '420px', margin: '0 auto 20px' }}>
                Select a Markdown (.md) or Text (.txt) policy document to compare with your controls.
              </p>
              <label className="button button-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                <input type="file" accept=".md,.txt,.json" onChange={handleFileUpload} style={{ display: 'none' }} />
                Browse Document
              </label>
            </div>
          )}

          {/* Paste Input view */}
          {activeTab === 'paste' && !evaluation && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Policy Title (e.g. Access Control and Cryptography Policy)"
                value={pastedTitle}
                onChange={e => setPastedTitle(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
              />
              <textarea
                rows={10}
                placeholder="Paste policy markdown or clauses here..."
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}
              />
              <button
                className="button button-primary"
                onClick={() => evaluatePolicyContent(pastedText, undefined, pastedTitle)}
                disabled={evaluating || !pastedText.trim()}
              >
                <Sparkles size={14} /> Run JEV Compatibility Match
              </button>
            </div>
          )}

          {evaluating && <Loading label="Running JEV System One judgment primitives across controls…" />}

          {/* Evaluation Results Dashboard */}
          {evaluation && !evaluating && (
            <div>
              {/* Top Score & Metric Banner */}
              <div className="view-grid-four" style={{ display: 'grid', gap: '14px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '16px', margin: 0, background: 'linear-gradient(135deg, var(--main-bg) 0%, var(--surface-raised) 100%)', color: 'var(--ink)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    JEV Compatibility Score
                  </span>
                  <div className="view-inline" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <strong style={{ fontSize: '32px', color: 'var(--accent)' }}>{evaluation.summary.overall_score}%</strong>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      ({evaluation.summary.compatible_count} of {evaluation.total_relevant} relevant)
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: evaluation.decided_by === 'jev-live' ? 'var(--success)' : 'var(--muted)', marginTop: '4px', fontWeight: 500 }}>
                    {evaluation.decided_by === 'jev-live' ? '● TypeSafe JEV System One (Live)' : '○ Offline Rubric Fallback'}
                  </div>
                  <div style={{ height: '4px', background: 'var(--surface-raised)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${evaluation.summary.overall_score}%`, height: '100%', background: 'var(--accent)' }} />
                  </div>
                </div>

                <div className="card" style={{ padding: '16px', margin: 0, borderLeft: '4px solid var(--success)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Compatible</span>
                  <strong style={{ display: 'block', fontSize: '24px', color: 'var(--success)', marginTop: '4px' }}>
                    {evaluation.summary.compatible_count}
                  </strong>
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Full control coverage</small>
                </div>

                <div className="card" style={{ padding: '16px', margin: 0, borderLeft: '4px solid var(--warning)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Gaps Detected</span>
                  <strong style={{ display: 'block', fontSize: '24px', color: 'var(--warning)', marginTop: '4px' }}>
                    {evaluation.summary.gap_count}
                  </strong>
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Missing requirements</small>
                </div>

                <div className="card" style={{ padding: '16px', margin: 0, borderLeft: '4px solid var(--danger)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Conflicts</span>
                  <strong style={{ display: 'block', fontSize: '24px', color: 'var(--danger)', marginTop: '4px' }}>
                    {evaluation.summary.conflict_count}
                  </strong>
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Violating statements</small>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                <div className="view-inline" style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className={`button button-sm ${activeFilter === 'all' ? 'button-primary' : ''}`}
                    onClick={() => setActiveFilter('all')}
                  >
                    All Evaluated ({results.length})
                  </button>
                  <button
                    className={`button button-sm ${activeFilter === 'compatible' ? 'button-primary' : ''}`}
                    onClick={() => setActiveFilter('compatible')}
                  >
                    <CheckCircle2 size={12} color="var(--success)" /> Compatible ({evaluation.summary.compatible_count})
                  </button>
                  <button
                    className={`button button-sm ${activeFilter === 'gap' ? 'button-primary' : ''}`}
                    onClick={() => setActiveFilter('gap')}
                  >
                    <AlertTriangle size={12} color="var(--warning)" /> Gaps ({evaluation.summary.gap_count})
                  </button>
                  {evaluation.summary.conflict_count > 0 && (
                    <button
                      className={`button button-sm ${activeFilter === 'conflict' ? 'button-primary' : ''}`}
                      onClick={() => setActiveFilter('conflict')}
                    >
                      <XCircle size={12} color="var(--danger)" /> Conflicts ({evaluation.summary.conflict_count})
                    </button>
                  )}
                </div>

                <div className="view-inline" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Filter controls…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px' }}
                  />
                  <button
                    className="button button-sm"
                    onClick={() => setEvaluation(null)}
                    title="Start a new evaluation or re-evaluate"
                  >
                    <RefreshCw size={12} /> New Check
                  </button>
                  {policy && (
                    <button
                      className="button button-sm button-primary"
                      onClick={handleLinkCompatible}
                      disabled={linking || evaluation.summary.compatible_count === 0}
                    >
                      <Link2 size={12} /> {linking ? 'Linking…' : `Auto-Link All Compatible (${evaluation.summary.compatible_count})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Results List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredResults.map((r: any) => {
                  const isComp = r.verdict === 'compatible';
                  const isGap = r.verdict === 'gap';
                  const isConflict = r.verdict === 'conflict';
                  const isNA = r.verdict === 'not_applicable';

                  const badgeColor = isComp ? 'var(--success)' : isGap ? 'var(--warning)' : isConflict ? 'var(--danger)' : 'var(--muted)';
                  const badgeBg = isComp ? 'var(--success-light)' : isGap ? 'var(--warning-light)' : isConflict ? 'var(--danger-light)' : 'var(--surface-raised)';
                  const label = isComp ? `Compatible (${Math.round(r.score * 100)}%)` : isGap ? `Partial Gap (${Math.round(r.score * 100)}%)` : isConflict ? 'Conflicting Policy' : 'Out of Scope';

                  return (
                    <div
                      key={r.control_code}
                      style={{
                        padding: '16px 20px',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        background: 'var(--card-bg)',
                        borderLeft: `4px solid ${badgeColor}`
                      }}
                    >
                      <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>{r.control_code}</span>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{r.control_title}</span>
                            <span style={{ fontSize: '11px', color: 'var(--muted)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: '4px' }}>
                              {r.category}
                            </span>
                            {r.decided_by === 'jev-live' ? (
                              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: 'var(--success-light)', color: 'var(--success)', border: '1px solid var(--success)' }}>
                                ● TypeSafe Live ({Math.round((r.confidence ?? 0.95) * 100)}% conf)
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 7px', borderRadius: '4px', background: 'var(--surface-raised)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                                ○ Rubric Fallback ({Math.round((r.heuristic_score ?? r.score ?? 0.85) * 100)}% heuristic)
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '2px 0 0' }}>{r.summary}</p>
                        </div>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            color: badgeColor,
                            background: badgeBg,
                            border: `1px solid ${badgeColor}`,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {label}
                        </span>
                      </div>

                      {/* Supporting Clauses Quote Box */}
                      {r.matched_excerpts && r.matched_excerpts.length > 0 && (
                        <div style={{ marginTop: '10px', background: 'var(--surface-raised)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                            {isConflict ? 'Contradicting Clause Detected:' : 'Verified Policy Evidence:'}
                          </span>
                          {r.matched_excerpts.map((snip: string, i: number) => (
                            <blockquote key={i} style={{ color: 'var(--muted)', fontStyle: 'italic', borderLeft: `2px solid ${badgeColor}`, paddingLeft: '8px', margin: '4px 0' }}>
                              "{snip}"
                            </blockquote>
                          ))}
                        </div>
                      )}

                      {/* Gaps and Remediation */}
                      {r.recommendations && r.recommendations.length > 0 && (
                        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--warning)', background: 'var(--warning-light)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--warning)' }}>
                          <strong>Recommended Policy Remediation:</strong> {r.recommendations[0]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="view-row" style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-raised)' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            JEV Engine · Deterministic System One policy assurance
          </span>
          <button className="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
