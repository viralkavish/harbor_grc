import { useEffect, useState } from 'react';
import { Layers, ShieldCheck, CheckCircle2, ArrowRight, RefreshCw, ExternalLink, Sparkles, Check } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Loading, ErrorState, Badge } from '../components/ui';
import type { Schema, Notify, Navigate } from '../lib/types';

export function FrameworksView({ schema, notify, onNavigate }: { schema: Schema | null; notify: Notify; onNavigate: Navigate }) {
  const [frameworks, setFrameworks] = useState<any[]>([]);
  const [harmonization, setHarmonization] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'matrix' | 'frameworks'>('matrix');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [fRes, hRes] = await Promise.all([
        api.get('/frameworks'),
        api.get('/frameworks/harmonization')
      ]);
      setFrameworks(fRes.items || []);
      setHarmonization(hRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !harmonization) return <Loading label="Loading compliance frameworks & harmonization matrix…" />;
  if (error) return <ErrorState message={error} retry={loadData} />;

  const coverage = harmonization?.framework_coverage || {};

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow="STANDARDS"
        title="Frameworks"
        description="Control mappings across SOC 2, ISO 27001, NIST CSF, HIPAA, and GDPR."
      >
        <div className="view-inline" style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`button ${activeTab === 'matrix' ? 'button-primary' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            <Sparkles size={14} /> Harmonization Matrix
          </button>
          <button
            className={`button ${activeTab === 'frameworks' ? 'button-primary' : ''}`}
            onClick={() => setActiveTab('frameworks')}
          >
            <Layers size={14} /> Framework Registers ({frameworks.length})
          </button>
          <button className="button" onClick={loadData} title="Refresh frameworks">
            <RefreshCw size={14} />
          </button>
        </div>
      </PageHeader>

      {/* Multi-Framework Overlap Summary Bar */}
      <div className="card" style={{ background: 'var(--main-bg)', color: 'var(--ink)', padding: '24px', marginBottom: '24px', border: '1px solid var(--border)' }}>
        <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="view-inline view-icon-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={22} color="var(--accent)" />
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                Cross-Framework Coverage
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '4px 0 0' }}>
                Compare implemented SOC 2 controls with related requirements across ISO 27001, NIST CSF, HIPAA, and GDPR.
              </p>
            </div>
          </div>
        </div>

        {/* Coverage Percentage Grid */}
        <div className="view-auto-grid" style={{ display: 'grid', gap: '14px' }}>
          {Object.entries(coverage).map(([key, val]: [string, any]) => (
            <div
              key={key}
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '14px'
              }}
            >
              <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="mono" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>{key}</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--success)' }}>{val.coverage_pct}%</span>
              </div>
              <div style={{ height: '4px', background: 'var(--surface-raised)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${val.coverage_pct}%`, height: '100%', background: 'var(--success)', borderRadius: '2px' }} />
              </div>
              <small style={{ color: 'var(--muted)', display: 'block', marginTop: '6px', fontSize: '11px' }}>
                {val.covered} of {val.total_mapped} controls harmonized
              </small>
            </div>
          ))}
        </div>
      </div>

      {activeTab === 'matrix' ? (
        /* Cross-Framework Harmonization Table */
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Cross-Framework Requirement Mapping</h3>
              <p className="card-description">
                Direct cross-walk mapping showing equivalent criteria across major global security standards.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '160px' }}>SOC 2 Control</th>
                  <th style={{ minWidth: '180px' }}>ISO/IEC 27001:2022</th>
                  <th style={{ minWidth: '180px' }}>NIST CSF 2.0</th>
                  <th style={{ minWidth: '180px' }}>HIPAA Security Rule</th>
                  <th style={{ minWidth: '180px' }}>EU GDPR</th>
                </tr>
              </thead>
              <tbody>
                {harmonization?.harmonized_controls?.map((item: any) => (
                  <tr key={item.code}>
                    <td>
                      <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.code}</span>
                        {item.implemented && (
                          <span style={{ fontSize: '10px', background: 'var(--success-light)', color: 'var(--success)', padding: '1px 6px', borderRadius: '8px' }}>
                            ✓ Active
                          </span>
                        )}
                      </div>
                      <small style={{ color: 'var(--muted)', display: 'block', marginTop: '2px' }}>{item.title}</small>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--accent)' }}>
                        {item.mappings.ISO27001}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--success)' }}>
                        {item.mappings['NIST-CSF']}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--warning)' }}>
                        {item.mappings.HIPAA}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--accent)' }}>
                        {item.mappings.GDPR}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Frameworks List */
        <div className="view-card-grid" style={{ display: 'grid', gap: '16px' }}>
          {frameworks.map((fw: any) => (
            <div key={fw.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--ink)' }}>{fw.title}</h3>
                  <span className="mono" style={{ fontSize: '11px', background: 'var(--surface-raised)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    {fw.code || fw.version || 'v2.0'}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                  {fw.description || fw.guidance}
                </p>
              </div>

              <div className="view-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <Badge value={fw.status || 'in_progress'} />
                <button
                  className="button button-sm button-primary"
                  onClick={() => onNavigate('controls')}
                >
                  View Controls <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
