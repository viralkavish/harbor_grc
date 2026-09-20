import { useEffect, useState } from 'react';
import { UserCheck, Plus, Check, X, ShieldAlert, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, EmptyState, formatDate, Note } from '../components/ui';
import { Dialog } from '../components/Dialog';
import type { DataRecord, Schema, Notify, Navigate } from '../lib/types';

export function AccessReviewsView({ schema, notify, onNavigate }: { schema: Schema; notify: Notify; onNavigate: Navigate }) {
  const [reviews, setReviews] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReview, setSelectedReview] = useState<DataRecord | null>(null);

  // New Review Modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [system, setSystem] = useState('');
  const [reviewer, setReviewer] = useState('');

  // New Entry Modal
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryUser, setEntryUser] = useState('');
  const [entryAccess, setEntryAccess] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadReviews = () => {
    setLoading(true);
    setError('');
    api.get('/access_reviews')
      .then(res => {
        const items = res.items || [];
        setReviews(items);
        if (items.length > 0 && !selectedReview) {
          setSelectedReview(items[0]);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/access_reviews', {
        title,
        system,
        reviewer,
        entries: [],
        status: 'draft'
      });
      notify('Access review created');
      setShowModal(false);
      setTitle('');
      setSystem('');
      setReviewer('');
      setSelectedReview(res);
      loadReviews();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReview) return;
    setSaving(true);
    try {
      const updatedEntries = [
        ...(selectedReview.entries || []),
        {
          id: `ent-${Date.now()}`,
          user: entryUser.trim(),
          access: entryAccess.trim(),
          decision: 'pending',
          notes: entryNotes.trim()
        }
      ];
      const res = await api.patch(`/access_reviews/${selectedReview.id}`, { entries: updatedEntries });
      setSelectedReview(res);
      setShowEntryModal(false);
      setEntryUser('');
      setEntryAccess('');
      setEntryNotes('');
      notify('User access entry added');
      loadReviews();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDecision = async (entryIdx: number, decision: 'keep' | 'revoke') => {
    if (!selectedReview) return;
    const updated = [...(selectedReview.entries || [])];
    if (updated[entryIdx]) {
      updated[entryIdx] = { ...updated[entryIdx], decision };
      try {
        const res = await api.patch(`/access_reviews/${selectedReview.id}`, { entries: updated });
        setSelectedReview(res);
        loadReviews();
      } catch (err: any) {
        notify(err.message, 'error');
      }
    }
  };

  const handleCompleteReview = async () => {
    if (!selectedReview) return;
    const entries = selectedReview.entries || [];
    if (entries.length === 0) {
      notify('Add at least one user access entry before completing review', 'error');
      return;
    }
    const hasPending = entries.some((e: any) => e.decision === 'pending');
    if (hasPending) {
      notify('Every account entry must be decided (Keep or Revoke) before completing review', 'error');
      return;
    }
    try {
      const res = await api.patch(`/access_reviews/${selectedReview.id}`, { status: 'completed' });
      setSelectedReview(res);
      notify('Access review marked completed');
      loadReviews();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  if (loading && reviews.length === 0) return <Loading label="Loading access reviews…" />;
  if (error) return <ErrorState message={error} retry={loadReviews} />;

  return (
    <div>
      <PageHeader
        eyebrow="OPERATE"
        title="User Access Reviews"
        description="Conduct periodic entitlement certifications, record keep/revoke determinations, and satisfy quarterly SOC 2 CC6.4 access review controls."
      >
        <button className="button button-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Access Review
        </button>
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Reviews List */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#fafcfb', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '13px' }}>
            Review Campaigns ({reviews.length})
          </div>
          <div>
            {reviews.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                No access reviews created yet.
              </div>
            ) : (
              reviews.map(r => {
                const isSelected = selectedReview?.id === r.id;
                const entriesCount = r.entries?.length || 0;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReview(r)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: isSelected ? '#f0f5f3' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0' }}>System: {r.system || 'General'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <Badge value={r.status} />
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{entriesCount} users</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Review Details & Entitlements Table */}
        <div>
          {selectedReview && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{selectedReview.title}</h2>
                    <Badge value={selectedReview.status} />
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '2px' }}>
                    Target System: <strong>{selectedReview.system || 'Unspecified'}</strong> · Reviewer: <strong>{selectedReview.reviewer || 'Security Team'}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedReview.status !== 'completed' && (
                    <button className="button button-primary" onClick={handleCompleteReview}>
                      <Check size={14} /> Complete Review
                    </button>
                  )}
                  <button className="button" onClick={() => setShowEntryModal(true)}>
                    <Plus size={14} /> Add User
                  </button>
                </div>
              </div>

              {/* Entries Table */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  User Accounts & Entitlements ({selectedReview.entries?.length || 0})
                </h4>

                {(!selectedReview.entries || selectedReview.entries.length === 0) ? (
                  <div style={{ padding: '32px', background: '#fafcfb', border: '1px dashed var(--border)', borderRadius: '6px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                    No users added to this review yet. Click "Add User" to record accounts.
                  </div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>User / Account</th>
                        <th>Role / Access Level</th>
                        <th>Decision</th>
                        <th>Notes</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReview.entries.map((entry: any, idx: number) => (
                        <tr key={entry.id || idx}>
                          <td>
                            <strong>{entry.user}</strong>
                          </td>
                          <td style={{ fontSize: '12px' }}>{entry.access}</td>
                          <td>
                            <Badge value={entry.decision} />
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            {entry.notes || '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                className={`button button-sm ${entry.decision === 'keep' ? 'button-primary' : ''}`}
                                onClick={() => handleSetDecision(idx, 'keep')}
                              >
                                Keep
                              </button>
                              <button
                                className={`button button-sm ${entry.decision === 'revoke' ? 'button-danger' : ''}`}
                                onClick={() => handleSetDecision(idx, 'revoke')}
                              >
                                Revoke
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Review Modal */}
      {showModal && (
        <Dialog title="Create Access Review Campaign" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreateReview}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Review Campaign Title *</span>
                <input type="text" required placeholder="e.g. Q3 Production AWS IAM Access Review" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="field">
                <span>Target System / Application</span>
                <input type="text" placeholder="e.g. AWS Management Console, GitHub Org" value={system} onChange={e => setSystem(e.target.value)} />
              </div>
              <div className="field">
                <span>Designated Reviewer</span>
                <input type="text" placeholder="e.g. VP Engineering, Security Lead" value={reviewer} onChange={e => setReviewer(e.target.value)} />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !title.trim()}>
                {saving ? 'Creating…' : 'Create Campaign'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* New Entry Modal */}
      {showEntryModal && (
        <Dialog title="Add Account to Review" onClose={() => setShowEntryModal(false)}>
          <form onSubmit={handleAddEntry}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>User Name / Email *</span>
                <input type="text" required placeholder="e.g. alex.dev@company.com" value={entryUser} onChange={e => setEntryUser(e.target.value)} />
              </div>
              <div className="field">
                <span>Access Level / Entitlements *</span>
                <input type="text" required placeholder="e.g. AdministratorAccess, Prod-Write" value={entryAccess} onChange={e => setEntryAccess(e.target.value)} />
              </div>
              <div className="field">
                <span>Justification / Notes</span>
                <textarea rows={2} placeholder="Optional notes on business necessity..." value={entryNotes} onChange={e => setEntryNotes(e.target.value)} />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowEntryModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !entryUser.trim()}>
                {saving ? 'Adding…' : 'Add Entry'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
