import './view-layouts.css';
import { useEffect, useState } from 'react';
import { Plus, Download, Trash2, Edit2, Search, ExternalLink } from 'lucide-react';
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

  useEffect(() => {
    if (selectedId && items.length > 0) {
      const found = items.find(i => i.id === selectedId);
      if (found) {
        setEditing(found);
        setFormValues(found);
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
    setIsCreating(true);
  };

  const handleEditOpen = (record: DataRecord) => {
    setEditing(record);
    setFormValues({ ...record });
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
        notify(`${meta.singular} updated successfully`);
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
                {meta.fields.some(f => f.key === 'code') && <th>Code</th>}
                <th>Title</th>
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
                      {item.code || '—'}
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
                      <button className="icon-button" title="Edit" onClick={() => handleEditOpen(item)}>
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

      {/* Edit / Create Dialog */}
      {(isCreating || editing) && (
        <Dialog
          title={isCreating ? `New ${meta.singular}` : `Edit ${meta.singular}`}
          subtitle="All changes persist locally to your SQLite workspace."
          onClose={() => {
            setIsCreating(false);
            setEditing(null);
          }}
          wide
        >
          <form onSubmit={handleSave}>
            <div className="dialog-body">
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
        </Dialog>
      )}
    </div>
  );
}
