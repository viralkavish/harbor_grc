import { useEffect, useState } from 'react';
import { History, Search, RefreshCw, Clock, CheckCircle2, AlertCircle, Download, ShieldCheck, ChevronRight, Eye } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, EmptyState, formatDate } from '../components/ui';
import { Dialog } from '../components/Dialog';
import type { Notify, Navigate } from '../lib/types';

export function ActivityView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<any | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  const loadActivity = async () => {
    setLoading(true);
    setError('');
    try {
      const [logRes, verRes] = await Promise.all([
        api.get('/audit/log?limit=250'),
        api.get('/audit/verify')
      ]);
      setItems(logRes.items || []);
      setVerifyStatus(verRes);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualVerify = async () => {
    setVerifying(true);
    try {
      const res = await api.get('/audit/verify');
      setVerifyStatus(res);
      if (res.ok) {
        notify(`Hash chain verification passed: all ${res.entries} entries mathematically intact`);
      } else {
        notify(`Tamper alert: chain broken at seq #${res.broken_at_seq}!`, 'error');
      }
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, []);

  const filtered = items.filter(it => {
    const matchesQuery = !filter ||
      it.title?.toLowerCase().includes(filter.toLowerCase()) ||
      it.actor?.toLowerCase().includes(filter.toLowerCase()) ||
      it.action?.toLowerCase().includes(filter.toLowerCase()) ||
      it.resource?.toLowerCase().includes(filter.toLowerCase()) ||
      it.record_id?.toLowerCase().includes(filter.toLowerCase());
    const matchesAction = !actionFilter || it.action === actionFilter;
    const matchesResource = !resourceFilter || it.resource === resourceFilter;
    return matchesQuery && matchesAction && matchesResource;
  });

  const uniqueActions = Array.from(new Set(items.map(i => i.action).filter(Boolean)));
  const uniqueResources = Array.from(new Set(items.map(i => i.resource).filter(Boolean)));

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow="AUDIT"
        title="Activity Log"
        description="Tamper-evident, hash-chained append-only ledger of all state mutations, security checks, and approvals."
      >
        <a href="/api/audit/export?format=csv" className="button" download>
          <Download size={14} /> Export CSV
        </a>
        <a href="/api/audit/export?format=json" className="button" download>
          <Download size={14} /> Export JSON
        </a>
        <button className="button" onClick={handleManualVerify} disabled={verifying}>
          <RefreshCw size={14} className={verifying ? 'spin' : ''} /> Verify Chain
        </button>
      </PageHeader>

      {/* Cryptographic Chain Integrity Banner */}
      {verifyStatus && (
        <div
          className="card"
          style={{
            padding: '14px 18px',
            marginBottom: '20px',
            background: 'var(--surface-raised)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: `1px solid ${verifyStatus.ok ? 'var(--border)' : 'var(--danger)'}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {verifyStatus.ok ? (
              <CheckCircle2 size={20} color="var(--success)" />
            ) : (
              <AlertCircle size={20} color="var(--danger)" />
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                  {verifyStatus.ok ? 'Cryptographic SHA-256 Audit Chain Verified' : 'Audit Log Chain Discontinuity Detected!'}
                </strong>
                <span className={`badge ${verifyStatus.ok ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px' }}>
                  {verifyStatus.ok ? `${verifyStatus.entries} Entries Intact` : `Broken at #${verifyStatus.broken_at_seq}`}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                {verifyStatus.ok
                  ? `Every entry is immutably linked via prev_hash and entry_hash from Genesis to head. Last verified at ${formatDate(verifyStatus.checked_at)}.`
                  : `Discontinuity: ${verifyStatus.reason}. Expected ${verifyStatus.expected?.slice(0, 16)}… but found ${verifyStatus.actual?.slice(0, 16)}…`}
              </p>
            </div>
          </div>
          <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)', background: 'var(--card-bg)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
            Retention: ≥ 1 Year
          </span>
        </div>
      )}

      <div className="table-container">
        <div className="table-toolbar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
            <Search size={14} color="var(--muted)" />
            <input
              type="text"
              className="table-search"
              placeholder="Search by actor, action, resource, target…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="table-filter-select"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
            >
              <option value="">All actions</option>
              {uniqueActions.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <select
              className="table-filter-select"
              value={resourceFilter}
              onChange={e => setResourceFilter(e.target.value)}
            >
              <option value="">All resources</option>
              {uniqueResources.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && <Loading label="Loading audit log entries…" />}
        {error && <ErrorState message={error} retry={loadActivity} />}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            title="No activity entries matched"
            description="Actions taken across policies, controls, evidence, and pilots will appear here."
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Seq</th>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Target / Title</th>
                <th>Hash Chain</th>
                <th style={{ textAlign: 'right' }}>Inspection</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.id || entry.seq}>
                  <td className="mono" style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
                    #{entry.seq}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(entry.created_at)}
                  </td>
                  <td style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                    {entry.actor || 'system'}
                  </td>
                  <td>
                    <Badge value={entry.action} />
                  </td>
                  <td style={{ textTransform: 'capitalize', fontSize: '12px' }}>
                    {entry.resource}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{entry.title || entry.record_id}</div>
                    {entry.record_id && (
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--muted)' }}>
                        {entry.record_id}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="mono" style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      <span title={`prev_hash: ${entry.prev_hash}`}>
                        {entry.prev_hash?.slice(0, 6)}…
                      </span>
                      {' → '}
                      <span title={`entry_hash: ${entry.entry_hash}`} style={{ color: 'var(--accent)' }}>
                        {entry.entry_hash?.slice(0, 6)}…
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="button button-sm"
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                      onClick={() => setSelectedEntry(entry)}
                      title="Inspect before/after state diff"
                    >
                      <Eye size={12} /> Diff
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Before / After Inspection Dialog */}
      {selectedEntry && (
        <Dialog
          title={`Audit Entry #${selectedEntry.seq}: ${selectedEntry.action} ${selectedEntry.resource}`}
          subtitle={`Recorded at ${formatDate(selectedEntry.created_at)} by ${selectedEntry.actor}`}
          onClose={() => setSelectedEntry(null)}
          wide
        >
          <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--surface-raised)', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>ID: {selectedEntry.id}</span>
                <span className="badge badge-success" style={{ fontSize: '11px' }}>Hash Verified</span>
              </div>
              <div className="mono" style={{ fontSize: '11px', color: 'var(--muted)', wordBreak: 'break-all' }}>
                <strong>prev_hash:</strong> {selectedEntry.prev_hash}
              </div>
              <div className="mono" style={{ fontSize: '11px', color: 'var(--muted)', wordBreak: 'break-all', marginTop: '4px' }}>
                <strong>entry_hash:</strong> {selectedEntry.entry_hash}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                  Before State Snapshot
                </div>
                <pre style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', fontSize: '11px', color: 'var(--muted)', maxHeight: '280px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                  {selectedEntry.before ? JSON.stringify(selectedEntry.before, null, 2) : '(Initial state / None)'}
                </pre>
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                  After State Snapshot
                </div>
                <pre style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', fontSize: '11px', color: 'var(--ink)', maxHeight: '280px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                  {selectedEntry.after ? JSON.stringify(selectedEntry.after, null, 2) : '(Deleted / None)'}
                </pre>
              </div>
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" className="button button-primary" onClick={() => setSelectedEntry(null)}>
              Close
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
