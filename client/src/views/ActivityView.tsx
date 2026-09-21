import { useEffect, useState } from 'react';
import { History, Search, RefreshCw, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, EmptyState, formatDate } from '../components/ui';
import type { Notify, Navigate } from '../lib/types';

export function ActivityView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const loadActivity = () => {
    setLoading(true);
    setError('');
    api.get('/activity')
      .then(res => setItems(res.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadActivity();
  }, []);

  const filtered = items.filter(it =>
    !filter ||
    it.title?.toLowerCase().includes(filter.toLowerCase()) ||
    it.action?.toLowerCase().includes(filter.toLowerCase()) ||
    it.resource?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow="AUDIT"
        title="Activity"
        description="Append-only immutable record of all creations, updates, deletions, policy publications, and local checks."
      >
        <button className="button" onClick={loadActivity} title="Refresh activity stream">
          <RefreshCw size={14} /> Refresh
        </button>
      </PageHeader>

      <div className="table-container">
        <div className="table-toolbar">
          <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={14} color="var(--muted)" />
            <input
              type="text"
              className="table-search"
              placeholder="Filter activity log…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Showing {filtered.length} of {items.length} events
          </span>
        </div>

        {loading && <Loading label="Loading activity stream…" />}
        {error && <ErrorState message={error} retry={loadActivity} />}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            title="No activity recorded yet"
            description="Actions taken across policies, controls, evidence, and monitoring will appear here."
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Resource</th>
                <th>Record / Event</th>
                <th>Details</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.id}>
                  <td>
                    <Badge value={entry.action} />
                  </td>
                  <td style={{ textTransform: 'capitalize', fontSize: '13px', fontWeight: 600 }}>
                    {entry.resource}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{entry.title || entry.record_id}</div>
                    {entry.record_id && (
                      <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {entry.record_id}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {entry.details ? JSON.stringify(entry.details) : '—'}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(entry.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
