import { useEffect, useState } from 'react';
import { Shield, Key, Download, CheckCircle2, AlertCircle, FileText, Camera, Plus, RefreshCw, Send, Check, X, Lock, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, EmptyState, formatDate } from '../components/ui';
import { Dialog } from '../components/Dialog';
import type { Notify } from '../lib/types';

export function AuditorPortalView({ notify }: { notify: Notify }) {
  // Stored strictly in component memory; NEVER persisted to localStorage/sessionStorage
  const [token, setToken] = useState<string>('');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [identity, setIdentity] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'pbc' | 'rfis' | 'testing' | 'workpapers'>('overview');

  // PBC requests state
  const [pbcItems, setPbcItems] = useState<any[]>([]);
  const [pbcFilter, setPbcFilter] = useState<string>('all');
  const [selectedPbc, setSelectedPbc] = useState<any | null>(null);
  const [pbcNote, setPbcNote] = useState('');

  // RFI state
  const [rfis, setRfis] = useState<any[]>([]);
  const [showRfiModal, setShowRfiModal] = useState(false);
  const [rfiTitle, setRfiTitle] = useState('');
  const [rfiBody, setRfiBody] = useState('');
  const [rfiCriterion, setRfiCriterion] = useState('CC6.1');
  const [replyText, setReplyText] = useState('');
  const [activeRfi, setActiveRfi] = useState<any | null>(null);

  // Testing support state
  const [testingData, setTestingData] = useState<any | null>(null);

  // Snapshots & Workpapers
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [capturingSnap, setCapturingSnap] = useState(false);

  // Read token from URL query param if present and auto-authenticate
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const qToken = urlParams.get('token');
    if (qToken) {
      authenticateAuditor(qToken);
    }
  }, []);

  const authenticateAuditor = async (authToken: string) => {
    setLoading(true);
    setError('');
    try {
      // Query auditor profile using bearer token
      const res = await fetch('/api/auditor/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ detail: 'Authentication failed' }));
        throw new Error(errJson.detail || 'Access denied');
      }
      const data = await res.json();
      setIdentity(data);
      setToken(authToken);
      notify(`Welcome, ${data.auditor_name}. Engagement portal active.`);
      loadAuditorData(authToken);
    } catch (err: any) {
      setError(err.message);
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditorData = async (authToken: string) => {
    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const [pbcRes, rfiRes, testRes] = await Promise.all([
        fetch('/api/auditor/pbc', { headers }).then(r => r.json()),
        fetch('/api/auditor/rfis', { headers }).then(r => r.json()),
        fetch('/api/auditor/testing_support', { headers }).then(r => r.json())
      ]);
      setPbcItems(pbcRes.items || []);
      setRfis(rfiRes.items || []);
      setTestingData(testRes);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handlePbcAction = async (id: string, action: 'accept' | 'mark_incomplete') => {
    try {
      const res = await fetch(`/api/auditor/pbc/${id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notes: pbcNote || (action === 'accept' ? 'Accepted by auditor' : 'Marked incomplete') })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail);
      }
      notify(`PBC item ${id} marked ${action === 'accept' ? 'accepted' : 'incomplete'}`);
      setSelectedPbc(null);
      setPbcNote('');
      loadAuditorData(token);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleCreateRfi = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auditor/rfis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: rfiTitle,
          body: rfiBody,
          criterion_refs: [rfiCriterion]
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail);
      }
      notify('Information Request (RFI) submitted successfully');
      setShowRfiModal(false);
      setRfiTitle('');
      setRfiBody('');
      loadAuditorData(token);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleReplyRfi = async (rfiId: string) => {
    if (!replyText.trim()) return;
    try {
      const res = await fetch(`/api/auditor/rfis/${rfiId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: replyText.trim() })
      });
      if (!res.ok) throw new Error('Failed to post reply');
      notify('Reply posted');
      setReplyText('');
      loadAuditorData(token);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleCaptureSnapshot = async () => {
    setCapturingSnap(true);
    try {
      const res = await fetch('/api/auditor/snapshot', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Snapshot generation failed');
      const data = await res.json();
      notify(`Point-in-time snapshot created: ${data.id.slice(0, 8)}`);
      setSnapshots(prev => [data, ...prev]);
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setCapturingSnap(false);
    }
  };

  if (!identity) {
    return (
      <div className="harbor-view" style={{ maxWidth: '520px', margin: '60px auto', padding: '0 16px' }}>
        <div className="card" style={{ padding: '32px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--surface-raised)', borderRadius: '50%', marginBottom: '16px' }}>
            <Key size={32} color="var(--accent)" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>External Auditor Portal</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '8px 0 24px', lineHeight: 1.5 }}>
            Access is restricted to authorized CPA auditors under engagement. Enter your issued engagement bearer token to proceed.
          </p>

          {error && <div className="card" style={{ padding: '10px 14px', marginBottom: '16px', background: 'rgba(255,100,100,0.1)', color: 'var(--danger)', fontSize: '13px' }}>{error}</div>}

          <form onSubmit={e => { e.preventDefault(); authenticateAuditor(tokenInput.trim()); }}>
            <div className="field" style={{ textAlign: 'left', marginBottom: '16px' }}>
              <span>Engagement Token (tf_audit_…)</span>
              <input
                type="password"
                required
                placeholder="tf_audit_..."
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                style={{ fontFamily: 'monospace' }}
              />
              <small style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                Tokens are held strictly in browser memory and never stored to disk or localStorage.
              </small>
            </div>
            <button type="submit" className="button button-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Authenticating…' : 'Enter Auditor Workspace'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredPbc = pbcItems.filter(p => pbcFilter === 'all' || p.status === pbcFilter);

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow="EXTERNAL AUDIT"
        title="Auditor Testing & Fieldwork Portal"
        description={`Active Engagement: ${identity.framework} • Auditor: ${identity.auditor_name} (${identity.auditor_email})`}
      >
        <button className="button" onClick={() => loadAuditorData(token)}>
          <RefreshCw size={14} /> Refresh Fieldwork
        </button>
        <button className="button" onClick={() => setIdentity(null)}>
          <Lock size={14} /> Lock Portal
        </button>
      </PageHeader>

      {/* AU-C 500 Independence Principle Banner */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: '20px', background: 'var(--surface-raised)', border: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Shield size={22} color="var(--accent)" style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--ink)' }}>Independence Principle (AICPA AU-C 500):</strong> tofromGRC serves strictly as the entity's system of record, not the auditor. Automated test outputs represent Information Produced by the Entity (IPE). The external auditor performs independent testing procedures and forms their own audit conclusions.
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px' }}>
        <button className={`button ${activeTab === 'overview' ? 'button-primary' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview & Scope
        </button>
        <button className={`button ${activeTab === 'pbc' ? 'button-primary' : ''}`} onClick={() => setActiveTab('pbc')}>
          PBC Requests ({pbcItems.length})
        </button>
        <button className={`button ${activeTab === 'rfis' ? 'button-primary' : ''}`} onClick={() => setActiveTab('rfis')}>
          RFIs ({rfis.length})
        </button>
        <button className={`button ${activeTab === 'testing' ? 'button-primary' : ''}`} onClick={() => setActiveTab('testing')}>
          Control Testing & IPE
        </button>
        <button className={`button ${activeTab === 'workpapers' ? 'button-primary' : ''}`} onClick={() => setActiveTab('workpapers')}>
          Workpapers & Snapshots
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div className="card" style={{ padding: '20px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px', color: 'var(--ink)' }}>Audit Scope & Timeline</h3>
            <div style={{ fontSize: '13px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>Framework: <strong style={{ color: 'var(--ink)' }}>{identity.framework}</strong></div>
              <div>Observation Period: <strong className="mono" style={{ color: 'var(--ink)' }}>{identity.audit_period_start} → {identity.audit_period_end}</strong></div>
              <div>In-Scope Criteria: <strong style={{ color: 'var(--ink)' }}>{identity.criteria_in_scope?.join(', ') || 'Security'}</strong></div>
              <div>Downloads Status: <span className="badge badge-success">{identity.downloads_enabled ? 'Enabled' : 'Restricted'}</span></div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px', color: 'var(--ink)' }}>Fieldwork Progress</h3>
            <div style={{ fontSize: '13px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>Total PBC Deliverables: <strong style={{ color: 'var(--ink)' }}>{pbcItems.length}</strong></div>
              <div>Accepted by Auditor: <strong style={{ color: 'var(--success)' }}>{pbcItems.filter(p => p.status === 'accepted').length}</strong></div>
              <div>Pending Staging / Review: <strong style={{ color: 'var(--warning)' }}>{pbcItems.filter(p => p.status !== 'accepted').length}</strong></div>
              <div>Open Information Requests: <strong style={{ color: 'var(--ink)' }}>{rfis.filter(r => r.status === 'open').length}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: PBC Requests */}
      {activeTab === 'pbc' && (
        <div className="table-container">
          <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['all', 'requested', 'staged', 'accepted', 'incomplete'].map(st => (
                <button
                  key={st}
                  className={`button button-sm ${pbcFilter === st ? 'button-primary' : ''}`}
                  onClick={() => setPbcFilter(st)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {st}
                </button>
              ))}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Showing {filteredPbc.length} of {pbcItems.length} requests
            </span>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Item ID</th>
                <th>Request Title & Description</th>
                <th>Criterion</th>
                <th>Staged Evidence</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Auditor Determination</th>
              </tr>
            </thead>
            <tbody>
              {filteredPbc.map(item => (
                <tr key={item.id}>
                  <td className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>{item.id}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{item.description}</div>
                    {item.notes && (
                      <div style={{ fontSize: '11px', color: 'var(--warning)', marginTop: '4px' }}>
                        Note: {item.notes}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: '11px', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: '4px' }}>
                      {item.criterion_refs?.join(', ') || '—'}
                    </span>
                  </td>
                  <td>
                    {item.staged_evidence_ids?.length > 0 ? (
                      <span className="badge badge-success">{item.staged_evidence_ids.length} Staged</span>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Awaiting Staging</span>
                    )}
                  </td>
                  <td><Badge value={item.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="button button-sm button-primary"
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                      onClick={() => setSelectedPbc(item)}
                    >
                      Evaluate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: RFIs */}
      {activeTab === 'rfis' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Requests for Information (RFIs)</h3>
            <button className="button button-primary" onClick={() => setShowRfiModal(true)}>
              <Plus size={14} /> Submit New RFI
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {rfis.length === 0 && (
              <EmptyState title="No RFIs submitted" description="Submit an RFI to request additional clarification or evidence from the security team." />
            )}
            {rfis.map(r => (
              <div key={r.id} className="card" style={{ padding: '18px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{r.title}</strong>
                    <Badge value={r.status} />
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{formatDate(r.created_at)}</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>{r.body}</p>

                {r.messages?.length > 0 && (
                  <div style={{ background: 'var(--surface-raised)', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Responses</div>
                    {r.messages.map((m: any) => (
                      <div key={m.id} style={{ marginBottom: '8px', fontSize: '12px' }}>
                        <strong>{m.author} ({m.author_role}):</strong> {m.message}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Add auditor note or follow-up..."
                    value={activeRfi?.id === r.id ? replyText : ''}
                    onFocus={() => setActiveRfi(r)}
                    onChange={e => setReplyText(e.target.value)}
                    style={{ flex: 1, fontSize: '12px', padding: '6px 10px' }}
                  />
                  <button className="button button-sm" onClick={() => handleReplyRfi(r.id)}>
                    <Send size={12} /> Reply
                  </button>
                  {r.status !== 'closed' && (
                    <button className="button button-sm" onClick={async () => {
                      await fetch(`/api/auditor/rfis/${r.id}/resolve`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      notify('RFI resolved');
                      loadAuditorData(token);
                    }}>
                      <Check size={12} /> Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Testing & IPE */}
      {activeTab === 'testing' && testingData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {testingData.items?.map((item: any) => (
            <div key={item.control.id} className="card" style={{ padding: '18px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)', marginRight: '8px' }}>{item.control.id}</span>
                  <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>{item.control.title}</strong>
                </div>
                <span className="badge badge-success">v{item.control.version}</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 12px' }}>{item.control.description}</p>

              <div style={{ background: 'var(--surface-raised)', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Auditor-Style Test Procedure</div>
                <pre style={{ margin: 0, fontSize: '12px', color: 'var(--ink)', fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>{item.control.test_procedure}</pre>
              </div>

              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Linked Evidence Artifacts ({item.linked_evidence?.length || 0})</div>
                {item.linked_evidence?.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>No evidence linked yet.</span>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {item.linked_evidence.map((ev: any) => (
                      <div key={ev.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '6px 10px', borderRadius: '4px', fontSize: '11px' }}>
                        <div><strong>{ev.filename || ev.title}</strong></div>
                        <div className="mono" style={{ color: 'var(--muted)' }}>SHA: {ev.sha256?.slice(0, 10)}…</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Workpapers & Snapshots */}
      {activeTab === 'workpapers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '20px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px', color: 'var(--ink)' }}>Auditor Workpaper Export</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Generates an AICPA-compliant workpaper package containing control definitions in effect, test procedures, IPE test results, and verified evidence artifacts with full SHA-256 manifests.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="button button-primary"
                onClick={() => {
                  window.location.href = `/api/auditor/export/workpapers?criterion=all&token=${token}`;
                }}
              >
                <Download size={14} /> Export All Workpapers (ZIP)
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: '20px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Pre-Audit Point-in-Time Snapshots</h3>
              <button className="button button-primary" onClick={handleCaptureSnapshot} disabled={capturingSnap}>
                <Camera size={14} /> {capturingSnap ? 'Capturing Snapshot…' : 'Capture New Snapshot'}
              </button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Creates an immutable point-in-time snapshot archive anchored to the R3 tamper-evident audit log head hash. Once created, snapshots can never be altered or deleted.
            </p>

            {snapshots.map(s => (
              <div key={s.id} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: '6px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Snapshot {s.id.slice(0, 8)}</div>
                  <div className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>Audit Log Head: {s.audit_log_head_hash?.slice(0, 16)}…</div>
                </div>
                <a
                  href={`/api/auditor/snapshot/${s.id}/download?token=${token}`}
                  className="button button-sm"
                  download
                >
                  <Download size={12} /> Download ZIP
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluate PBC Modal */}
      {selectedPbc && (
        <Dialog title={`Evaluate PBC: ${selectedPbc.id} (${selectedPbc.title})`} subtitle="Record your auditor testing determination." onClose={() => setSelectedPbc(null)}>
          <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{selectedPbc.description}</div>
            <div className="field">
              <span>Auditor Notes / Findings</span>
              <textarea
                rows={3}
                placeholder="Document your testing verification, sample review notes, or reason for incomplete marking..."
                value={pbcNote}
                onChange={e => setPbcNote(e.target.value)}
              />
            </div>
          </div>
          <div className="dialog-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="button" onClick={() => setSelectedPbc(null)}>Cancel</button>
            <button className="button" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => handlePbcAction(selectedPbc.id, 'mark_incomplete')}>
              <X size={14} /> Mark Incomplete
            </button>
            <button className="button button-primary" onClick={() => handlePbcAction(selectedPbc.id, 'accept')}>
              <Check size={14} /> Accept Deliverable
            </button>
          </div>
        </Dialog>
      )}

      {/* Submit RFI Modal */}
      {showRfiModal && (
        <Dialog title="Submit Information Request (RFI)" subtitle="Requests are assigned to control owners with auditable threads." onClose={() => setShowRfiModal(false)}>
          <form onSubmit={handleCreateRfi}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>RFI Title *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clarification on Q2 Access Review Sample"
                  value={rfiTitle}
                  onChange={e => setRfiTitle(e.target.value)}
                />
              </div>

              <div className="field">
                <span>Related Trust Services Criterion</span>
                <select value={rfiCriterion} onChange={e => setRfiCriterion(e.target.value)}>
                  <option value="CC6.1">CC6.1 Logical Access Security & MFA</option>
                  <option value="CC6.4">CC6.4 Quarterly Access Reviews</option>
                  <option value="CC7.1">CC7.1 Vulnerability Management</option>
                  <option value="CC8.1">CC8.1 Change Management</option>
                  <option value="CC9.1">CC9.1 Vendor Risk Management</option>
                  <option value="A1.2">A1.2 Disaster Recovery & Backups</option>
                </select>
              </div>

              <div className="field">
                <span>Information Request Details *</span>
                <textarea
                  rows={4}
                  required
                  placeholder="Specify the exact documentation, sample population, or system explanation requested..."
                  value={rfiBody}
                  onChange={e => setRfiBody(e.target.value)}
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowRfiModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary">Submit RFI</button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
