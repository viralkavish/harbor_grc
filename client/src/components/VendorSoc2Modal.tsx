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
      <div className="harbor-view-modal" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Summary */}
        <div className="view-row" style={{ background: 'var(--main-bg)', color: 'var(--ink)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>{vendor.name || vendor.title}</strong>
              <span style={{ fontSize: '11px', background: 'var(--accent-light)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--accent)' }}>
                {vendor.category || 'Sub-Processor'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
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
            <div className="view-auto-grid" style={{ display: 'grid', gap: '12px' }}>
              <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Report Type & Scope</div>
                <strong style={{ fontSize: '13px', color: 'var(--accent)' }}>{analysis.report_type}</strong>
              </div>
              <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Auditor Opinion</div>
                <strong style={{ fontSize: '13px', color: 'var(--success)' }}>{analysis.report_opinion}</strong>
              </div>
              <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Observation Window</div>
                <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{analysis.observation_period}</strong>
              </div>
              <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Supply Chain Risk Tier</div>
                <strong style={{ fontSize: '13px', color: analysis.risk_tier === 'critical' ? 'var(--danger)' : 'var(--accent)', textTransform: 'uppercase' }}>
                  {analysis.risk_tier}
                </strong>
              </div>
            </div>

            {/* Extracted CUECs */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ShieldCheck size={18} color="var(--accent)" />
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
              <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Layers size={18} color="var(--success)" />
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
          <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface-raised)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
            <Sparkles size={32} color="var(--accent)" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
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
