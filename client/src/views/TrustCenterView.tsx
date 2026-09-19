import { useEffect, useState } from 'react';
import { Globe, Download, CheckCircle2, Shield, Lock, FileText, ExternalLink, Settings, KeyRound, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, formatDate, Note } from '../components/ui';
import { Dialog } from '../components/Dialog';
import type { Schema, Notify, Navigate } from '../lib/types';

export function TrustCenterView({ schema, notify, onNavigate }: { schema: Schema; notify: Notify; onNavigate: Navigate }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availablePolicies, setAvailablePolicies] = useState<any[]>([]);
  const [availableEvidence, setAvailableEvidence] = useState<any[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Access Request / NDA Modal
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqCompany, setReqCompany] = useState('');
  const [reqNda, setReqNda] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);

  // Active tab on Trust Center: 'posture' | 'policies' | 'evidence' | 'faqs'
  const [activeTab, setActiveTab] = useState<'posture' | 'policies' | 'evidence' | 'faqs'>('posture');

  const loadTrustCenter = async () => {
    setLoading(true);
    setError('');
    try {
      const [trustRes, polRes, eviRes, bootRes] = await Promise.all([
        api.get('/trust'),
        api.get('/policies?status=published'),
        api.get('/evidence?status=approved'),
        api.get('/bootstrap')
      ]);
      setData(trustRes);
      setAvailablePolicies(polRes.items || []);
      setAvailableEvidence(eviRes.items || []);
      setSelectedPolicies(bootRes.workspace?.trust_policy_ids || []);
      setSelectedEvidence(bootRes.workspace?.trust_evidence_ids || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrustCenter();
  }, []);

  const handleSaveSelection = async () => {
    setSaving(true);
    try {
      await api.patch('/workspace', {
        trust_policy_ids: selectedPolicies,
        trust_evidence_ids: selectedEvidence
      });
      notify('Trust Center disclosures updated');
      setShowConfig(false);
      loadTrustCenter();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/trust/request_access', {
        name: reqName.trim(),
        email: reqEmail.trim(),
        company: reqCompany.trim(),
        nda_signed: reqNda
      });
      notify('Non-Disclosure Agreement signed and full access granted');
      setAccessGranted(true);
      setShowAccessModal(false);
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <Loading label="Loading trust center preview…" />;
  if (error) return <ErrorState message={error} retry={loadTrustCenter} />;

  const { workspace, policies, evidence, faqs, badges } = data || { workspace: {}, policies: [], evidence: [], faqs: [], badges: [] };

  return (
    <div>
      <PageHeader
        eyebrow="PUBLISH"
        title="Public Trust Center & Real-Time Assurance"
        description="Public security disclosures, compliance badges, real-time posture assurance, verified attestations, and NDA-gated document access."
      >
        <button className="button" onClick={() => setShowConfig(!showConfig)}>
          <Settings size={14} /> {showConfig ? 'Hide Disclosures' : 'Configure Disclosures'}
        </button>
        <button className="button" onClick={() => setShowAccessModal(true)}>
          <KeyRound size={14} /> Request Full Access / Sign NDA
        </button>
        <a href="/api/trust/export" className="button button-primary" download>
          <Download size={14} /> Download Trust Package
        </a>
      </PageHeader>

      <Note>
        <strong>Continuous Trust Management:</strong> This portal showcases your live security posture. Visitors can review compliance badges, read approved policies, inspect test evidence, and review security FAQs.
      </Note>

      {/* Disclosures Configuration Drawer */}
      {showConfig && (
        <div className="card" style={{ background: '#fafcfb', border: '1px solid var(--accent)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
            Configure Trust Center Disclosures
          </h3>
          <div className="grid-2">
            <div>
              <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                Select Published Policies ({availablePolicies.length} available)
              </strong>
              {availablePolicies.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--muted)' }}>No policies currently published.</p>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availablePolicies.map(p => (
                    <label key={p.id} className="check-option">
                      <input
                        type="checkbox"
                        checked={selectedPolicies.includes(p.id)}
                        onChange={e => {
                          setSelectedPolicies(e.target.checked ? [...selectedPolicies, p.id] : selectedPolicies.filter(id => id !== p.id));
                        }}
                      />
                      <span>{p.title} (v{p.version})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                Select Approved Evidence ({availableEvidence.length} available)
              </strong>
              {availableEvidence.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--muted)' }}>No evidence currently approved.</p>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availableEvidence.map(e => (
                    <label key={e.id} className="check-option">
                      <input
                        type="checkbox"
                        checked={selectedEvidence.includes(e.id)}
                        onChange={ev => {
                          setSelectedEvidence(ev.target.checked ? [...selectedEvidence, e.id] : selectedEvidence.filter(id => id !== e.id));
                        }}
                      />
                      <span>{e.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="button button-primary" onClick={handleSaveSelection} disabled={saving}>
              {saving ? 'Saving…' : 'Save Disclosures'}
            </button>
          </div>
        </div>
      )}

      {/* Modern Vanta-Style Trust Center Canvas */}
      <div className="card" style={{ maxWidth: '860px', margin: '0 auto', padding: '0', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
        {/* Banner Header */}
        <div style={{ background: 'var(--sidebar-bg)', color: 'white', padding: '36px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8fa39b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            <Globe size={14} color="var(--accent)" /> Real-Time Trust Center
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
            {workspace.trust_title || 'Security Posture & Compliance Report'}
          </h1>
          <h3 style={{ fontSize: '16px', fontWeight: 500, color: '#e1e9e5', marginTop: '4px' }}>
            {workspace.organization || workspace.name || 'Organization Security Baseline'}
          </h3>
          <p style={{ fontSize: '14px', color: '#b2dfdb', marginTop: '12px', lineHeight: 1.6, maxWidth: '640px' }}>
            {workspace.trust_description || 'Demonstrating real-time compliance controls, policy governance, and continuous security monitoring.'}
          </p>
        </div>

        {/* Badges Ribbon */}
        <div style={{ background: '#f8faf9', borderBottom: '1px solid var(--border)', padding: '16px 40px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          {badges?.map((b: any) => (
            <div key={b.code} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 12px' }}>
              <Shield size={16} color="var(--accent)" />
              <div>
                <strong style={{ fontSize: '12px', display: 'block' }}>{b.title}</strong>
                <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>{b.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'white', padding: '0 40px' }}>
          {[
            { id: 'posture', label: 'Security Posture' },
            { id: 'policies', label: `Policies (${policies.length})` },
            { id: 'evidence', label: `Attestations (${evidence.length})` },
            { id: 'faqs', label: 'Security FAQs' }
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

        {/* Tab Content Area */}
        <div style={{ padding: '32px 40px' }}>
          {activeTab === 'posture' && (
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px', color: 'var(--ink)' }}>
                Continuous Controls Monitoring Highlights
              </h3>
              <div className="grid-3" style={{ marginBottom: '24px' }}>
                <div style={{ background: '#f8faf9', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                    <Lock size={16} /> Data Encryption
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    AES-256 enabled on all volumes and databases. TLS 1.2+ mandatory in transit.
                  </p>
                </div>
                <div style={{ background: '#f8faf9', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                    <Shield size={16} /> Access Control
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    MFA enforced across 100% of workforce accounts. Access reviewed quarterly.
                  </p>
                </div>
                <div style={{ background: '#f8faf9', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                    <CheckCircle2 size={16} /> Incident Response
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Documented plan tested annually with designated response team and 1-hour P1 SLA.
                  </p>
                </div>
              </div>

              <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ fontSize: '14px' }}>Need full audit report access or vendor security review?</strong>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    Sign our mutual Non-Disclosure Agreement (NDA) to view unredacted third-party audits and architecture diagrams.
                  </p>
                </div>
                <button className="button button-primary" onClick={() => setShowAccessModal(true)}>
                  Sign NDA & Access
                </button>
              </div>
            </div>
          )}

          {activeTab === 'policies' && (
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px', color: 'var(--ink)' }}>
                Published Governance Policies ({policies.length})
              </h3>
              {policies.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
                  No published policies currently disclosed.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {policies.map((p: any) => (
                    <div key={p.id} style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>{p.title}</strong>
                        <span className="badge badge-green">v{p.version} Approved</span>
                      </div>
                      {p.description && (
                        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>{p.description}</p>
                      )}
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
                        Approved by {p.approver || 'Authorized Officer'} on {formatDate(p.approved_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'evidence' && (
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px', color: 'var(--ink)' }}>
                Verified Attestation Documents ({evidence.length})
              </h3>
              {evidence.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
                  No evidence documents currently disclosed.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {evidence.map((e: any) => (
                    <div key={e.id} style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>{e.title}</strong>
                        {e.description && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{e.description}</p>}
                        <small style={{ fontSize: '11px', color: 'var(--muted)' }}>Collected on {formatDate(e.collected_date)}</small>
                      </div>
                      <Badge value="verified" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'faqs' && (
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px', color: 'var(--ink)' }}>
                Security & Architecture FAQs
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {faqs?.map((f: any, idx: number) => (
                  <div key={idx} style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--ink)', display: 'block', marginBottom: '6px' }}>
                      {f.question}
                    </strong>
                    <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
                      {f.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NDA Request Modal */}
      {showAccessModal && (
        <Dialog title="Request Gated Compliance Access (NDA)" onClose={() => setShowAccessModal(false)}>
          <form onSubmit={handleRequestAccess}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Enter your professional credentials and accept the mutual confidentiality agreement to unlock detailed audit dossiers.
              </p>
              <div className="field">
                <span>Full Name *</span>
                <input type="text" required placeholder="e.g. Sarah Connor" value={reqName} onChange={e => setReqName(e.target.value)} autoFocus />
              </div>
              <div className="field">
                <span>Work Email *</span>
                <input type="email" required placeholder="e.g. sarah@enterprise.com" value={reqEmail} onChange={e => setReqEmail(e.target.value)} />
              </div>
              <div className="field">
                <span>Company / Prospective Customer</span>
                <input type="text" placeholder="e.g. Cyberdyne Systems" value={reqCompany} onChange={e => setReqCompany(e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <input type="checkbox" id="ndaCheck" checked={reqNda} onChange={e => setReqNda(e.target.checked)} />
                <label htmlFor="ndaCheck" style={{ fontSize: '12px', cursor: 'pointer' }}>
                  I accept the mutual Non-Disclosure Agreement (NDA) and agree to treat disclosed compliance reports as confidential.
                </label>
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowAccessModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !reqName.trim() || !reqEmail.trim() || !reqNda}>
                {saving ? 'Verifying…' : 'Sign NDA & View Package'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
