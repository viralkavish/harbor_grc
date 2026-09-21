import { useState } from 'react';
import { ShieldCheck, Sparkles, Check, AlertCircle, ExternalLink, FileText, Layers, X } from 'lucide-react';
import { Dialog } from './Dialog';
import { api } from '../lib/api';
import type { Notify } from '../lib/types';

interface VendorSoc2ModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: any;
  notify: Notify;
  onVendorUpdated?: () => void;
}

export function VendorSoc2Modal({ isOpen, onClose, vendor, notify, onVendorUpdated }: VendorSoc2ModalProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any | null>(null);

  if (!isOpen || !vendor) return null;

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await api.post('/vendors/analyze_soc2', {
        vendor_id: vendor.id,
        name: vendor.name || vendor.title,
        category: vendor.category || 'Cloud Infrastructure',
        has_soc2: true,
        data_sensitivity: vendor.data_access || 'customer_data'
      });
      setAnalysis(res);
      notify('SOC 2 examination analyzed & CUECs extracted');
      if (onVendorUpdated) onVendorUpdated();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Dialog onClose={onClose} title={`Vendor SOC 2 & CUEC Security Review: ${vendor.name || vendor.title}`} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Summary */}
        <div style={{ background: '#090d16', color: 'white', padding: '16px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '16px', color: 'white' }}>{vendor.name || vendor.title}</strong>
              <span style={{ fontSize: '11px', background: 'rgba(37, 99, 235, 0.2)', color: '#60a5fa', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(37, 99, 235, 0.3)' }}>
                {vendor.category || 'Sub-Processor'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
              Automated SOC 2 Type II report verification, CUEC extraction, and supply chain tiering.
            </p>
          </div>

          <button
            type="button"
            className="button button-primary"
            onClick={handleRunAnalysis}
            disabled={analyzing}
          >
            <Sparkles size={14} />
            {analyzing ? 'Analyzing SOC 2…' : 'Run AI SOC 2 Analysis'}
          </button>
        </div>

        {analysis ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Audit Opinion & Tiering Card */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Report Type & Scope</div>
                <strong style={{ fontSize: '13px', color: '#2563eb' }}>{analysis.report_type}</strong>
              </div>
              <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Auditor Opinion</div>
                <strong style={{ fontSize: '13px', color: '#16a34a' }}>{analysis.report_opinion}</strong>
              </div>
              <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Observation Window</div>
                <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{analysis.observation_period}</strong>
              </div>
              <div style={{ background: '#fafcfb', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Supply Chain Risk Tier</div>
                <strong style={{ fontSize: '13px', color: analysis.risk_tier === 'critical' ? 'var(--danger)' : '#2563eb', textTransform: 'uppercase' }}>
                  {analysis.risk_tier}
                </strong>
              </div>
            </div>

            {/* Extracted CUECs */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ShieldCheck size={18} color="#2563eb" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                  Extracted Complementary User Entity Controls (CUECs)
                </h4>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 10px' }}>
                Mandatory operational controls your organization must enforce when utilizing this vendor:
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.5 }}>
                {analysis.cuecs.map((cuec: string, idx: number) => (
                  <li key={idx}>{cuec}</li>
                ))}
              </ul>
            </div>

            {/* Extracted CSOCs */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Layers size={18} color="#059669" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                  Subservice Organization Controls (CSOCs) Relied Upon
                </h4>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.5 }}>
                {analysis.csocs.map((csoc: string, idx: number) => (
                  <li key={idx}>{csoc}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fafcfb', border: '1px dashed var(--border)', borderRadius: '8px' }}>
            <Sparkles size={32} color="#2563eb" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
            <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>
              Analyze Vendor SOC 2 Report & Extract CUECs
            </strong>
            <p style={{ fontSize: '13px', color: 'var(--muted)', maxWidth: '460px', margin: '6px auto 16px' }}>
              Click above to extract auditor opinions, test periods, Complementary User Entity Controls (CUECs), and supply chain risk tiering.
            </p>
          </div>
        )}

        <div className="dialog-footer">
          <button type="button" className="button button-primary" onClick={onClose}>
            Close Review
          </button>
        </div>
      </div>
    </Dialog>
  );
}
