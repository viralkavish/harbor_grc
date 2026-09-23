import { useState } from 'react';
import {
  Shield, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft,
  Sparkles, Key, FileText, Server, AlertCircle, Check, Upload, Calendar
} from 'lucide-react';
import { api } from '../lib/api';
import { Loading } from '../components/ui';
import type { Notify } from '../lib/types';

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
  notify: Notify;
}

const TSC_CRITERIA_OPTIONS = [
  { id: 'Security', label: 'Security (Common Criteria)', defaultChecked: true, required: true },
  { id: 'Availability', label: 'Availability', defaultChecked: true, required: false },
  { id: 'Confidentiality', label: 'Confidentiality', defaultChecked: true, required: false },
  { id: 'Processing Integrity', label: 'Processing Integrity', defaultChecked: false, required: false },
  { id: 'Privacy', label: 'Privacy', defaultChecked: false, required: false },
];

export function OnboardingWizard({ onComplete, onSkip, notify }: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Key State
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('https://api.typesafe.ai/v1');
  const [validatingKey, setValidatingKey] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Step 2: Scope State
  const [company, setCompany] = useState('tofrom');
  const [criteria, setCriteria] = useState<string[]>(['Security', 'Availability', 'Confidentiality']);
  const [auditType, setAuditType] = useState('Type II');
  const [observationStart, setObservationStart] = useState('2027-01-01');
  const [auditor, setAuditor] = useState('');

  // Step 3: Documents & Assets
  const [uploadedPolicies, setUploadedPolicies] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [assets, setAssets] = useState([
    { name: 'AWS Cloud Infrastructure', type: 'cloud', env: 'Production' },
    { name: 'Google Workspace IdP', type: 'identity', env: 'Enterprise' },
    { name: 'GitHub Organizations', type: 'code', env: 'Production' }
  ]);
  const [newAssetName, setNewAssetName] = useState('');

  // Step 4: Confirmations
  const [dniConfirmed, setDniConfirmed] = useState(false);
  const [observationConfirmed, setObservationConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- Step 1 Handlers ---
  const handleValidateKey = async () => {
    if (!apiKey.trim()) {
      notify('Please enter a TypeSafe JEV API Key to validate', 'error');
      return;
    }
    setValidatingKey(true);
    setTestResult(null);
    try {
      const res = await api.post('/jev/test_key', {
        api_key: apiKey.trim(),
        endpoint: endpoint.trim()
      });
      setTestResult(res);
      notify(res.message || 'TypeSafe JEV System One verified successfully!');
      // Also save to workspace settings so server retains it
      await api.patch('/workspace', {
        jev_api_key: apiKey.trim(),
        jev_endpoint: endpoint.trim()
      });
    } catch (e: any) {
      setTestResult({ valid: false, message: e.message || 'Key validation failed.' });
      notify(e.message, 'error');
    } finally {
      setValidatingKey(false);
    }
  };

  // --- Step 2 Handlers ---
  const toggleCriterion = (cId: string) => {
    if (cId === 'Security') return; // Security is strictly required by AICPA
    if (criteria.includes(cId)) {
      setCriteria(criteria.filter(c => c !== cId));
    } else {
      setCriteria([...criteria, cId]);
    }
  };

  // --- Step 3 Handlers ---
  const handleUploadPolicy = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/jev/upload_and_evaluate', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload evaluation failed');
      }
      const data = await res.json();
      setUploadedPolicies([...uploadedPolicies, {
        name: file.name,
        title: data.policy_title,
        compatibleCount: data.summary?.compatible_count || 0
      }]);
      notify(`Uploaded "${file.name}" (${data.summary?.compatible_count || 0} controls satisfied)`);
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleAddAsset = () => {
    if (!newAssetName.trim()) return;
    setAssets([...assets, { name: newAssetName.trim(), type: 'infrastructure', env: 'Production' }]);
    setNewAssetName('');
  };

  // --- Step 4 Completion ---
  const handleCompleteWizard = async () => {
    if (!dniConfirmed) {
      notify('You must confirm written permission for DNI-sourced policies before proceeding.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch('/workspace/scope', {
        company,
        criteria,
        audit_type: auditType,
        observation_start: observationStart,
        auditor,
        dni_permission_confirmed: true,
        onboarding_completed: true
      });
      notify('tofromGRC setup complete! Welcome to your SOC 2 workspace.');
      onComplete();
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '780px', margin: '30px auto', padding: '0 16px' }}>
      {/* Wizard Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div className="view-inline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ display: 'inline-flex', padding: '8px', borderRadius: '10px', background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
            <Shield size={26} color="var(--accent)" />
          </span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ink)' }}>tofrom<span style={{ color: 'var(--accent)' }}>GRC</span></span>
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: '18px', color: 'var(--ink)' }}>
          SOC 2 Type II Readiness Setup
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
          4-step initialization for tofrom internal compliance operations.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '24px' }}>
        {[
          { num: 1, label: 'JEV Key' },
          { num: 2, label: 'Audit Scope' },
          { num: 3, label: 'Documents & Assets' },
          { num: 4, label: 'Confirmations' }
        ].map(s => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <div
              key={s.num}
              style={{
                padding: '10px',
                borderRadius: '8px',
                background: isActive ? 'var(--surface-raised)' : 'var(--card-bg)',
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '11px', color: isActive ? 'var(--accent)' : 'var(--muted)', fontWeight: 700 }}>
                {isDone ? '✓ STEP ' + s.num : 'STEP ' + s.num}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: isActive ? 'var(--ink)' : 'var(--muted)', marginTop: '2px' }}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Wizard Content Card */}
      <div className="card" style={{ padding: '24px' }}>
        {/* STEP 1: KEY ENTRY */}
        {step === 1 && (
          <div>
            <div className="card-header" style={{ marginBottom: '18px' }}>
              <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Key size={18} color="var(--accent)" />
                <h3 className="card-title" style={{ margin: 0 }}>Step 1: TypeSafe JEV System One Activation</h3>
              </div>
              <p className="card-description">
                Connect the Jev decision engine for deterministic semantic policy-to-control compatibility scoring.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="field">
                <span>TypeSafe JEV API Key</span>
                <input
                  type="password"
                  placeholder="apikey_..."
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setTestResult(null); }}
                  style={{ fontFamily: 'monospace' }}
                />
                <small style={{ color: 'var(--muted)', marginTop: '4px' }}>
                  The key is validated against <code>jev-1.13.0</code> and stored securely encrypted at rest.
                </small>
              </div>

              <div className="field">
                <span>Endpoint / Base URL</span>
                <input
                  type="text"
                  value={endpoint}
                  onChange={e => setEndpoint(e.target.value)}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div className="view-inline" style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="button"
                  onClick={handleValidateKey}
                  disabled={validatingKey || !apiKey.trim()}
                >
                  <Sparkles size={14} /> {validatingKey ? 'Validating Connection…' : 'Test & Verify Key'}
                </button>
              </div>

              {/* Live Test Feedback State */}
              {testResult && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${testResult.valid ? 'var(--success)' : 'var(--danger)'}`,
                    background: testResult.valid ? 'var(--success-light)' : 'var(--danger-light)',
                    color: testResult.valid ? 'var(--success)' : 'var(--danger)'
                  }}
                >
                  <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {testResult.valid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <strong>{testResult.valid ? 'Connection Verified' : 'Validation Failed'}</strong>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'inherit' }}>
                    {testResult.message}
                  </p>
                </div>
              )}

              <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" className="button" onClick={onSkip}>
                  Configure later
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={!testResult || !testResult.valid}
                  onClick={() => setStep(2)}
                >
                  Continue to Audit Scope <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: SCOPE */}
        {step === 2 && (
          <div>
            <div className="card-header" style={{ marginBottom: '18px' }}>
              <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Shield size={18} color="var(--accent)" />
                <h3 className="card-title" style={{ margin: 0 }}>Step 2: Scoping tofrom's Examination</h3>
              </div>
              <p className="card-description">
                Define organizational boundary, selected Trust Services Criteria, and observation period milestones.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="field-grid">
                <div className="field">
                  <span>Organization Name</span>
                  <input
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                  />
                </div>
                <div className="field">
                  <span>Audit Examination Type</span>
                  <select value={auditType} onChange={e => setAuditType(e.target.value)}>
                    <option value="Type II">SOC 2 Type II (Operating Effectiveness Over Time)</option>
                    <option value="Type I">SOC 2 Type I (Point-in-Time Design Suitability)</option>
                  </select>
                </div>
              </div>

              <div className="field-grid">
                <div className="field">
                  <span>Observation Period Start Date</span>
                  <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} color="var(--accent)" />
                    <input
                      type="date"
                      value={observationStart}
                      onChange={e => setObservationStart(e.target.value)}
                    />
                  </div>
                  <small style={{ color: 'var(--muted)', marginTop: '4px' }}>
                    Target observation window begins 2027-01-01.
                  </small>
                </div>
                <div className="field">
                  <span>CPA Audit Firm / Assessor</span>
                  <input
                    type="text"
                    placeholder="e.g. A-LIGN / Schellman / Presidio"
                    value={auditor}
                    onChange={e => setAuditor(e.target.value)}
                  />
                </div>
              </div>

              {/* TSC Criteria Selection */}
              <div className="field">
                <span>In-Scope Trust Services Criteria (TSC)</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '6px' }}>
                  {TSC_CRITERIA_OPTIONS.map(c => {
                    const checked = criteria.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          background: 'var(--surface-raised)',
                          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                          cursor: c.required ? 'default' : 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={c.required}
                          onChange={() => toggleCriterion(c.id)}
                        />
                        <span style={{ fontSize: '13px', color: 'var(--ink)' }}>{c.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" className="button" onClick={() => setStep(1)}>
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setStep(3)}
                >
                  Continue to Documents <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DOCUMENTS & ASSETS */}
        {step === 3 && (
          <div>
            <div className="card-header" style={{ marginBottom: '18px' }}>
              <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <FileText size={18} color="var(--accent)" />
                <h3 className="card-title" style={{ margin: 0 }}>Step 3: Governance Policies & Infrastructure</h3>
              </div>
              <p className="card-description">
                Upload initial policy documents and register production infrastructure boundaries.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Policy Upload Section */}
              <div style={{ background: 'var(--surface-raised)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>Upload Policy Document (.md, .txt)</span>
                  <label className="button button-sm button-primary" style={{ cursor: 'pointer' }}>
                    <Upload size={13} /> {uploading ? 'Analyzing…' : 'Select Policy File'}
                    <input type="file" accept=".md,.txt,.json" onChange={handleUploadPolicy} style={{ display: 'none' }} />
                  </label>
                </div>
                <small style={{ color: 'var(--muted)', display: 'block', marginBottom: '10px' }}>
                  Policies are parsed and evaluated immediately against compliance controls.
                </small>

                {uploadedPolicies.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {uploadedPolicies.map((p, i) => (
                      <div key={i} className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--card-bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--ink)' }}>{p.title}</span>
                        <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>
                          ✓ {p.compatibleCount} controls satisfied
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Infrastructure Inventory Table */}
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '6px' }}>
                  In-Scope Infrastructure Assets
                </span>
                <table className="data-table" style={{ width: '100%', fontSize: '12px', marginBottom: '8px' }}>
                  <thead>
                    <tr>
                      <th>System / Component</th>
                      <th>Type</th>
                      <th>Environment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{a.name}</td>
                        <td style={{ textTransform: 'capitalize' }}>{a.type}</td>
                        <td>{a.env}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="view-inline" style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Add infrastructure component (e.g. AWS ECS, Supabase, Cloudflare)"
                    value={newAssetName}
                    onChange={e => setNewAssetName(e.target.value)}
                    style={{ flex: 1, fontSize: '12px' }}
                  />
                  <button type="button" className="button button-sm" onClick={handleAddAsset}>
                    + Add Component
                  </button>
                </div>
              </div>

              <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" className="button" onClick={() => setStep(2)}>
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setStep(4)}
                >
                  Continue to Confirmations <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: CONFIRMATIONS & DNI REUSE ATTESTATION */}
        {step === 4 && (
          <div>
            <div className="card-header" style={{ marginBottom: '18px' }}>
              <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <CheckCircle2 size={18} color="var(--accent)" />
                <h3 className="card-title" style={{ margin: 0 }}>Step 4: Audit Attestation & DNI Permissions</h3>
              </div>
              <p className="card-description">
                Mandatory operational declarations required for audit trial defensibility.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Mandatory DNI Warning Callout */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '8px',
                  border: '1px solid var(--warning)',
                  background: 'var(--warning-light)',
                  color: 'var(--warning)'
                }}
              >
                <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <AlertTriangle size={18} />
                  <strong style={{ fontSize: '13.5px' }}>Mandatory Intellectual Property & Policy Sourcing Rule</strong>
                </div>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.5', color: 'var(--ink)' }}>
                  If any security, privacy, or engineering policies in this repository were adapted or sourced from DNI (or prior corporate entities), tofrom must possess documented written authorization permitting adaptation and reuse. Auditors independently review policy authorship provenance.
                </p>
              </div>

              {/* Checkboxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '6px',
                    background: 'var(--surface-raised)',
                    border: `1px solid ${dniConfirmed ? 'var(--success)' : 'var(--border)'}`,
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={dniConfirmed}
                    onChange={e => setDniConfirmed(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <strong style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>
                      DNI Policy Reuse Authorization
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      I confirm that for any governance policies or security standards sourced from DNI, tofrom has obtained written permission to reuse and adapt them for tofrom's SOC 2 Type II examination.
                    </span>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '6px',
                    background: 'var(--surface-raised)',
                    border: `1px solid ${observationConfirmed ? 'var(--success)' : 'var(--border)'}`,
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={observationConfirmed}
                    onChange={e => setObservationConfirmed(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <strong style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>
                      Observation Period Commitment (Starts {observationStart})
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      I confirm tofrom's commitment to operating compliance controls continuously throughout the observation period without unmitigated drift.
                    </span>
                  </div>
                </label>
              </div>

              {/* Final Actions */}
              <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" className="button" onClick={() => setStep(3)}>
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={!dniConfirmed || submitting}
                  onClick={handleCompleteWizard}
                >
                  {submitting ? 'Applying Scope…' : 'Launch tofromGRC Workspace'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
