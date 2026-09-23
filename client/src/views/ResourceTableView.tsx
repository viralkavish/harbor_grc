import './view-layouts.css';
import { useEffect, useState } from 'react';
import { Plus, Download, Trash2, Edit2, Search, ExternalLink, History, Shield, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, EmptyState, formatDate } from '../components/ui';
import { Dialog } from '../components/Dialog';
import { Fields } from '../components/Fields';
import { writablePayload } from '../lib/model';
import type { DataRecord, ResourceSchema, Schema, Notify, Navigate } from '../lib/types';

export function ResourceTableView({
  resource,
  schema,
  eyebrow = 'OPERATE',
  title,
  description,
  customColumns,
  notify,
  onNavigate,
  selectedId,
  children
}: {
  resource: string;
  schema: Schema;
  eyebrow?: string;
  title?: string;
  description?: string;
  customColumns?: (r: DataRecord) => React.ReactNode;
  notify: Notify;
  onNavigate: Navigate;
  selectedId?: string;
  children?: React.ReactNode;
}) {
  const meta: ResourceSchema = schema.resources[resource];
  const [items, setItems] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<DataRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [controlTab, setControlTab] = useState<'details' | 'versions' | 'edit'>('details');
  const [controlVersions, setControlVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const loadData = () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (statusFilter) params.set('status', statusFilter);

    api.get(`/${resource}?${params.toString()}`)
      .then(res => setItems(res.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [resource, query, statusFilter]);

  const loadControlVersions = async (controlId: string) => {
    setLoadingVersions(true);
    try {
      const res = await api.get(`/controls/${controlId}/versions`);
      setControlVersions(res.versions || []);
    } catch {
      setControlVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleEditOpen = (record: DataRecord) => {
    setEditing(record);
    setFormValues({ ...record });
    setControlTab(resource === 'controls' ? 'details' : 'edit');
    if (resource === 'controls') {
      loadControlVersions(record.id);
    }
  };

  useEffect(() => {
    if (selectedId && items.length > 0) {
      const found = items.find(i => i.id === selectedId);
      if (found) {
        handleEditOpen(found);
      }
    }
  }, [selectedId, items]);

  const handleCreateOpen = () => {
    const defaults: Record<string, any> = {
      title: '',
      status: meta.statuses[0],
      description: '',
      owner: '',
      tags: []
    };
    for (const f of meta.fields) {
      if (!f.readonly && !(f.key in defaults)) {
        defaults[f.key] = f.default !== undefined ? f.default : (f.type === 'number' ? 0 : f.type === 'multiselect' ? [] : '');
      }
    }
    setFormValues(defaults);
    setControlTab('edit');
    setIsCreating(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = writablePayload(meta, formValues);
      if (isCreating) {
        await api.post(`/${resource}`, payload);
        notify(`${meta.singular} created successfully`);
        setIsCreating(false);
      } else if (editing) {
        await api.patch(`/${resource}/${editing.id}`, payload);
        notify(`${meta.singular} updated successfully (new version recorded)`);
        setEditing(null);
      }
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Are you sure you want to delete this ${meta.singular.toLowerCase()}?`)) return;
    setDeletingId(id);
    try {
      await api.delete(`/${resource}/${id}`);
      notify(`${meta.singular} deleted`);
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow={eyebrow}
        title={title || meta.label}
        description={description || `Manage and audit ${meta.label.toLowerCase()} across your compliance framework.`}
      >
        {children}
        <a href={`/api/export/${resource}`} className="button" download>
          <Download size={14} /> Export CSV
        </a>
        <button className="button button-primary" onClick={handleCreateOpen}>
          <Plus size={14} /> New {meta.singular}
        </button>
      </PageHeader>

      {resource === 'controls' && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: '20px', background: 'var(--surface-raised)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>AICPA Trust Services Criteria Catalog</span>
              <span className="badge badge-success" style={{ fontSize: '11px', fontWeight: 600 }}>TSC-2017-2022</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              61 Authoritative Criteria (33 Common Criteria CC1.1–CC9.2, 3 Availability A1.1–A1.3, 2 Confidentiality C1.1–C1.2, 5 Processing Integrity PI1.1–PI1.5, 18 Privacy P1.1–P8.1).
            </p>
          </div>
          <span className="mono" style={{ fontSize: '12px', color: 'var(--muted)', background: 'var(--card-bg)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border)' }}>
            {items.length} Controls Cataloged
          </span>
        </div>
      )}

      <div className="table-container">
        <div className="table-toolbar">
          <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={14} color="var(--muted)" />
            <input
              type="text"
              className="table-search"
              placeholder={`Search ${meta.label.toLowerCase()}…`}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div className="table-filters">
            <select
              className="table-filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {meta.statuses.map(st => (
                <option key={st} value={st}>{st.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && <Loading label={`Loading ${meta.label.toLowerCase()}…`} />}
        {error && <ErrorState message={error} retry={loadData} />}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            title={`No ${meta.label.toLowerCase()} found`}
            description={query || statusFilter ? 'Try clearing your search or status filter.' : `Create your first ${meta.singular.toLowerCase()} to get started.`}
            action={
              <button className="button button-primary" onClick={handleCreateOpen}>
                <Plus size={14} /> Create {meta.singular}
              </button>
            }
          />
        )}

        {!loading && !error && items.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                {meta.fields.some(f => f.key === 'code') && <th>Criterion</th>}
                <th>Title</th>
                {resource === 'controls' && <th>Nature & Frequency</th>}
                {resource === 'controls' && <th>Version</th>}
                <th>Status</th>
                <th>Owner</th>
                {customColumns && <th>Details</th>}
                <th>Updated</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  {meta.fields.some(f => f.key === 'code') && (
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      <div>{item.code || '—'}</div>
                      {item.id && item.id.startsWith('TF-') && (
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{item.id}</div>
                      )}
                    </td>
                  )}
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.title}</div>
                    {item.description && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', maxWidth: '420px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.description}
                      </div>
                    )}
                  </td>
                  {resource === 'controls' && (
                    <td style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      <div>{item.nature || 'manual'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.frequency || 'annual'}</div>
                    </td>
                  )}
                  {resource === 'controls' && (
                    <td>
                      <span className="mono" style={{ fontSize: '11px', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        v{item.version || 1}
                      </span>
                    </td>
                  )}
                  <td>
                    <Badge value={item.status} />
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    {item.owner || 'Unassigned'}
                  </td>
                  {customColumns && <td>{customColumns(item)}</td>}
                  <td style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    {formatDate(item.updated_at || item.created_at)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      <button className="icon-button" title="View & Edit" onClick={() => handleEditOpen(item)}>
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="icon-button"
                        title="Delete"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
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

      {/* Edit / Inspect Dialog */}
      {(isCreating || editing) && (
        <Dialog
          title={isCreating ? `New ${meta.singular}` : `${editing?.code || meta.singular}: ${editing?.title || ''}`}
          subtitle={resource === 'controls' ? `AICPA TSC-2017-2022 Control Specification (Version ${editing?.version || 1})` : "All changes persist locally to your SQLite workspace."}
          onClose={() => {
            setIsCreating(false);
            setEditing(null);
          }}
          wide
        >
          {resource === 'controls' && !isCreating && (
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', padding: '0 24px 12px', marginBottom: '16px' }}>
              <button
                type="button"
                className={`button button-sm ${controlTab === 'details' ? 'button-primary' : ''}`}
                onClick={() => setControlTab('details')}
              >
                <Shield size={13} /> Procedure & Criteria
              </button>
              <button
                type="button"
                className={`button button-sm ${controlTab === 'versions' ? 'button-primary' : ''}`}
                onClick={() => setControlTab('versions')}
              >
                <History size={13} /> Version History ({controlVersions.length})
              </button>
              <button
                type="button"
                className={`button button-sm ${controlTab === 'edit' ? 'button-primary' : ''}`}
                onClick={() => setControlTab('edit')}
              >
                <Edit2 size={13} /> Edit Definition
              </button>
            </div>
          )}

          {resource === 'controls' && !isCreating && controlTab === 'details' && editing && (
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--surface-raised)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>{editing.id}</span>
                  <span className="badge badge-success" style={{ fontSize: '11px' }}>{editing.catalog_vintage || 'TSC-2017-2022'}</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{editing.criterion_mapping || editing.title}</div>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
                  {editing.description}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                <div style={{ background: 'var(--card-bg)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Owner Role</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: 'var(--ink)' }}>{editing.owner || 'Unassigned'}</div>
                </div>
                <div style={{ background: 'var(--card-bg)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Control Type</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: 'var(--ink)' }}>{editing.type || 'preventive'}</div>
                </div>
                <div style={{ background: 'var(--card-bg)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Nature</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: 'var(--ink)' }}>{editing.nature || 'manual'}</div>
                </div>
                <div style={{ background: 'var(--card-bg)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Frequency</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: 'var(--ink)' }}>{editing.frequency || 'annual'}</div>
                </div>
              </div>

              {Array.isArray(editing.points_of_focus) && editing.points_of_focus.length > 0 && (
                <div style={{ background: 'var(--card-bg)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>
                    2022 Revised AICPA Points of Focus
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                    {editing.points_of_focus.map((pof: string, idx: number) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{pof}</li>
                    ))}
                  </ul>
                </div>
              )}

              {editing.test_procedure && (
                <div style={{ background: 'var(--card-bg)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                    Auditor-Style Test Procedure
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
                    {editing.test_procedure}
                  </pre>
                </div>
              )}

              {editing.evidence_requirement && (
                <div style={{ background: 'var(--card-bg)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                    Required Audit Evidence
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                    {editing.evidence_requirement}
                  </p>
                </div>
              )}
            </div>
          )}

          {resource === 'controls' && !isCreating && controlTab === 'versions' && (
            <div className="dialog-body">
              <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                  <strong>Auditor Observation Window History:</strong> Editing a control definition creates a new immutable version. All historical wording in effect during your SOC 2 observation period remains permanently preserved for CPA inspection.
                </p>
              </div>

              {loadingVersions && <Loading label="Loading version history…" />}
              {!loadingVersions && controlVersions.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
                  No previous versions recorded. This control is currently at initial baseline (Version {editing?.version || 1}).
                </p>
              )}
              {!loadingVersions && controlVersions.map(v => (
                <div key={v.id} style={{ background: 'var(--card-bg)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Version {v.version}</span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Archived on {formatDate(v.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>{v.body.title}</div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>{v.body.description}</p>
                </div>
              ))}
            </div>
          )}

          {(controlTab === 'edit' || isCreating || resource !== 'controls') && (
            <form onSubmit={handleSave}>
              <div className="dialog-body">
                {resource === 'controls' && !isCreating && (
                  <div className="card" style={{ padding: '10px 14px', marginBottom: '16px', background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Saving changes will create <strong>Version {(editing?.version || 1) + 1}</strong> and archive Version {editing?.version || 1} to the audit trail.
                    </span>
                  </div>
                )}
                <Fields
                  schema={meta}
                  value={formValues}
                  onChange={(k, v) => setFormValues(prev => ({ ...prev, [k]: v }))}
                />
              </div>
              <div className="dialog-footer">
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditing(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={saving}>
                  {saving ? 'Saving…' : isCreating ? `Create ${meta.singular}` : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {resource === 'controls' && !isCreating && controlTab !== 'edit' && (
            <div className="dialog-footer">
              <button
                type="button"
                className="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditing(null);
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => setControlTab('edit')}
              >
                <Edit2 size={13} /> Edit Definition
              </button>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
