import { useEffect, useState, useRef } from 'react';
import { Upload, Download, Trash2, Shield, AlertCircle, FileCheck, Check } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, EmptyState, formatDate } from '../components/ui';
import { Dialog } from '../components/Dialog';
import { LinkedSelect } from '../components/Fields';
import type { DataRecord, Schema, Notify, Navigate } from '../lib/types';

export function EvidenceView({ schema, notify, onNavigate }: { schema: Schema; notify: Notify; onNavigate: Navigate }) {
  const [items, setItems] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadControls, setUploadControls] = useState<string[]>([]);
  const [uploadExpiresDate, setUploadExpiresDate] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEvidence = () => {
    setLoading(true);
    setError('');
    api.get('/evidence')
      .then(res => setItems(res.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvidence();
  }, []);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());
      if (uploadDesc.trim()) formData.append('description', uploadDesc.trim());
      if (uploadControls.length > 0) formData.append('control_ids', JSON.stringify(uploadControls));
      if (uploadExpiresDate) formData.append('expires_date', uploadExpiresDate);

      await api.post('/evidence/upload', formData);
      notify('Evidence file uploaded and hashed successfully');
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDesc('');
      setUploadControls([]);
      setUploadExpiresDate('');
      loadEvidence();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/evidence/${id}`, { status: newStatus });
      notify(`Status updated to ${newStatus}`);
      loadEvidence();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete evidence record "${title}"?`)) return;
    try {
      await api.delete(`/evidence/${id}`);
      notify('Evidence record deleted');
      loadEvidence();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="OPERATE"
        title="Compliance Evidence Repository"
        description="Attach audit screenshots, configuration exports, policy attestations, and third-party reports with SHA-256 integrity hashing."
      >
        <button className="button button-primary" onClick={() => setShowUploadModal(true)}>
          <Upload size={14} /> Upload Evidence
        </button>
      </PageHeader>

      <div className="table-container">
        {loading && <Loading label="Loading evidence repository…" />}
        {error && <ErrorState message={error} retry={loadEvidence} />}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            title="No evidence items collected yet"
            description="Upload configuration exports, penetration test reports, or screenshots to link them directly to controls."
            action={
              <button className="button button-primary" onClick={() => setShowUploadModal(true)}>
                <Upload size={14} /> Upload First Evidence
              </button>
            }
          />
        )}

        {!loading && !error && items.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Title / File</th>
                <th>Status</th>
                <th>Integrity (SHA-256)</th>
                <th>Controls Linked</th>
                <th>Collected</th>
                <th>Expires</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.title}</div>
                    {item.filename && (
                      <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="mono">{item.filename}</span>
                        {item.file_size && <span>({(item.file_size / 1024).toFixed(1)} KB)</span>}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Badge value={item.status} />
                      {item.status !== 'approved' && (
                        <button
                          className="button button-sm"
                          style={{ padding: '2px 6px', fontSize: '10px' }}
                          onClick={() => handleUpdateStatus(item.id, 'approved')}
                          title="Approve evidence"
                        >
                          <Check size={10} /> Approve
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    {item.sha256 ? (
                      <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)', background: '#fafcfb', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }} title={item.sha256}>
                        {item.sha256.slice(0, 12)}…
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    {item.control_ids && item.control_ids.length > 0 ? (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {item.control_ids.map((cid: string) => (
                          <button
                            key={cid}
                            className="link-button"
                            style={{ fontSize: '11px' }}
                            onClick={() => onNavigate('controls', cid)}
                          >
                            {cid}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Unlinked</span>
                    )}
                  </td>
                  <td style={{ fontSize: '12px' }}>{formatDate(item.collected_date)}</td>
                  <td style={{ fontSize: '12px' }}>
                    {item.expires_date ? (
                      <span style={{ color: new Date(item.expires_date) < new Date() ? 'var(--danger)' : 'var(--ink)' }}>
                        {formatDate(item.expires_date)}
                      </span>
                    ) : 'Indefinite'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      {item.filename && (
                        <a
                          href={`/api/evidence/${item.id}/file`}
                          className="icon-button"
                          title="Download file"
                          download
                        >
                          <Download size={14} />
                        </a>
                      )}
                      <button
                        className="icon-button"
                        title="Delete evidence"
                        onClick={() => handleDelete(item.id, item.title)}
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Upload Evidence Modal */}
      {showUploadModal && (
        <Dialog title="Upload Compliance Evidence" subtitle="Files are streamed directly to local private storage with SHA-256 hashing." onClose={() => setShowUploadModal(false)} wide>
          <form onSubmit={handleUploadSubmit}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="field">
                <span>Attachment File (Max 25 MiB) *</span>
                <input
                  type="file"
                  required
                  ref={fileInputRef}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      if (!uploadTitle) setUploadTitle(f.name);
                    }
                  }}
                />
              </div>

              <div className="field">
                <span>Title / Descriptive Name</span>
                <input
                  type="text"
                  placeholder="e.g. AWS Production S3 Encryption Settings"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                />
              </div>

              <div className="field">
                <span>Description & Audit Context</span>
                <textarea
                  rows={2}
                  placeholder="Explain how this file demonstrates operating effectiveness of the mapped control(s)..."
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                />
              </div>

              <LinkedSelect
                resource="controls"
                label="Map to Compliance Controls"
                value={uploadControls}
                onChange={setUploadControls}
                multiple
              />

              <div className="field">
                <span>Expiration Date (optional)</span>
                <input
                  type="date"
                  value={uploadExpiresDate}
                  onChange={e => setUploadExpiresDate(e.target.value)}
                />
                <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                  Monitoring will automatically alert when evidence approaches or passes this date.
                </small>
              </div>
            </div>

            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowUploadModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={uploading || !uploadFile}>
                {uploading ? 'Streaming & Hashing…' : 'Upload Evidence'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
