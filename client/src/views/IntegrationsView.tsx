import { useEffect, useState } from 'react';
import { Layers, CheckCircle2, CloudOff, FileSpreadsheet, HardDrive, Shield } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, Note } from '../components/ui';
import type { Notify, Navigate } from '../lib/types';

export function IntegrationsView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/integrations')
      .then(res => setItems(res.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Loading integrations directory…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow="CONNECT"
        title="Integrations & Data Connectors"
        description="Local data sources, file upload capabilities, and planned cloud connector interfaces."
      />

      <Note>
        <strong>Architectural transparency:</strong> Harbor GRC operates on a local-first single-user boundary. Local CSV import/export and direct evidence uploads are active. Cloud connectors (AWS, Google Workspace, GitHub, Slack) are listed with their planned scope but remain inactive in this local build without deceptive telemetry or mock data.
      </Note>

      <div className="grid-2">
        {items.map(int => {
          const isAvailable = int.status === 'available';
          return (
            <div key={int.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isAvailable ? <HardDrive size={18} color="var(--accent)" /> : <CloudOff size={18} color="var(--muted)" />}
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>{int.title}</h3>
                  </div>
                  <Badge value={int.status} />
                </div>

                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px', lineHeight: 1.5 }}>
                  {int.description}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {int.capabilities?.map((cap: string, idx: number) => (
                    <span
                      key={idx}
                      className="mono"
                      style={{
                        fontSize: '11px',
                        background: isAvailable ? 'var(--accent-light)' : '#edf2ef',
                        color: isAvailable ? 'var(--accent)' : 'var(--muted)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                {isAvailable ? (
                  <button className="button button-sm button-primary" onClick={() => onNavigate('settings')}>
                    Manage in Settings
                  </button>
                ) : (
                  <button className="button button-sm" disabled>
                    Offline in local build
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
