import { useEffect, useState } from 'react';
import { CheckSquare, List, LayoutGrid, Plus, Trash2, Edit2, Calendar, Check } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, EmptyState, formatDate } from '../components/ui';
import { Dialog } from '../components/Dialog';
import type { DataRecord, Schema, Notify, Navigate } from '../lib/types';

const STATUS_COLS = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Completed' }
];

export function TasksView({ schema, notify, onNavigate }: { schema: Schema; notify: Notify; onNavigate: Navigate }) {
  const [tasks, setTasks] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'board'>('board');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<DataRecord | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [checklist, setChecklist] = useState<{ text: string; done: boolean }[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTasks = () => {
    setLoading(true);
    setError('');
    api.get('/tasks')
      .then(res => setTasks(res.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleOpenCreate = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority('medium');
    setOwner('');
    setDueDate('');
    setChecklist([]);
    setShowModal(true);
  };

  const handleOpenEdit = (t: DataRecord) => {
    setEditingTask(t);
    setTitle(t.title);
    setDescription(t.description || '');
    setStatus(t.status || 'todo');
    setPriority(t.priority || 'medium');
    setOwner(t.owner || '');
    setDueDate(t.due_date || '');
    setChecklist(t.checklist || []);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        status,
        priority,
        owner,
        due_date: dueDate || null,
        checklist
      };
      if (editingTask) {
        await api.patch(`/tasks/${editingTask.id}`, payload);
        notify('Task updated');
      } else {
        await api.post('/tasks', payload);
        notify('Task created');
      }
      setShowModal(false);
      loadTasks();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleChecklist = async (task: DataRecord, itemIndex: number) => {
    const updated = [...(task.checklist || [])];
    if (updated[itemIndex]) {
      updated[itemIndex] = { ...updated[itemIndex], done: !updated[itemIndex].done };
      try {
        await api.patch(`/tasks/${task.id}`, { checklist: updated });
        loadTasks();
      } catch (err: any) {
        notify(err.message, 'error');
      }
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
      loadTasks();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      notify('Task deleted');
      loadTasks();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  if (loading && tasks.length === 0) return <Loading label="Loading compliance tasks…" />;
  if (error) return <ErrorState message={error} retry={loadTasks} />;

  return (
    <div>
      <PageHeader
        eyebrow="OPERATE"
        title="Remediation Tasks & Work Queues"
        description="Track action items, control remediation, policy reviews, and audit deliverables across your team."
      >
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            className="button"
            style={{ borderRadius: 0, border: 'none', background: viewMode === 'board' ? '#fafcfb' : 'white', fontWeight: viewMode === 'board' ? 600 : 400 }}
            onClick={() => setViewMode('board')}
          >
            <LayoutGrid size={14} /> Board
          </button>
          <button
            className="button"
            style={{ borderRadius: 0, border: 'none', background: viewMode === 'list' ? '#fafcfb' : 'white', fontWeight: viewMode === 'list' ? 600 : 400 }}
            onClick={() => setViewMode('list')}
          >
            <List size={14} /> List
          </button>
        </div>
        <button className="button button-primary" onClick={handleOpenCreate}>
          <Plus size={14} /> New Task
        </button>
      </PageHeader>

      {/* Kanban Board Mode */}
      {viewMode === 'board' && (
        <div className="kanban-board">
          {STATUS_COLS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="kanban-col">
                <div className="kanban-col-header">
                  <span>{col.label}</span>
                  <span className="nav-count">{colTasks.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {colTasks.map(t => {
                    const checkTotal = t.checklist?.length || 0;
                    const checkDone = t.checklist?.filter((c: any) => c.done).length || 0;
                    return (
                      <div key={t.id} className="kanban-card" onClick={() => handleOpenEdit(t)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{t.title}</span>
                          <Badge value={t.priority || 'medium'} />
                        </div>

                        {t.description && (
                          <p style={{ fontSize: '12px', color: 'var(--muted)', maxHeight: '36px', overflow: 'hidden' }}>
                            {t.description}
                          </p>
                        )}

                        {checkTotal > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} /> {checkDone}/{checkTotal} subtasks
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11px', color: 'var(--muted)' }}>
                          <span>{t.owner || 'Unassigned'}</span>
                          {t.due_date && (
                            <span style={{ color: new Date(t.due_date) < new Date() && t.status !== 'done' ? 'var(--danger)' : 'var(--muted)' }}>
                              {formatDate(t.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List Table Mode */}
      {viewMode === 'list' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Owner</th>
                <th>Checklist</th>
                <th>Due Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => {
                const checkTotal = t.checklist?.length || 0;
                const checkDone = t.checklist?.filter((c: any) => c.done).length || 0;
                return (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.title}</div>
                      {t.description && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{t.description}</div>}
                    </td>
                    <td>
                      <select
                        value={t.status}
                        onChange={e => handleStatusChange(t.id, e.target.value)}
                        style={{ padding: '2px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)' }}
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="done">Completed</option>
                      </select>
                    </td>
                    <td><Badge value={t.priority || 'medium'} /></td>
                    <td style={{ fontSize: '12px' }}>{t.owner || 'Unassigned'}</td>
                    <td style={{ fontSize: '12px' }}>
                      {checkTotal > 0 ? `${checkDone}/${checkTotal}` : '—'}
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {t.due_date ? (
                        <span style={{ color: new Date(t.due_date) < new Date() && t.status !== 'done' ? 'var(--danger)' : 'var(--ink)' }}>
                          {formatDate(t.due_date)}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="icon-button" onClick={() => handleOpenEdit(t)}><Edit2 size={14} /></button>
                      <button className="icon-button" onClick={() => handleDelete(t.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Task Edit/Create Dialog */}
      {showModal && (
        <Dialog title={editingTask ? 'Edit Task' : 'New Task'} onClose={() => setShowModal(false)} wide>
          <form onSubmit={handleSave}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Task Title *</span>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Rotate AWS root credentials" />
              </div>
              <div className="field">
                <span>Description</span>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="field-grid">
                <div className="field">
                  <span>Status</span>
                  <select value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Completed</option>
                  </select>
                </div>
                <div className="field">
                  <span>Priority</span>
                  <select value={priority} onChange={e => setPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="field">
                  <span>Owner</span>
                  <input type="text" value={owner} onChange={e => setOwner(e.target.value)} placeholder="e.g. Lead Engineer" />
                </div>
                <div className="field">
                  <span>Due Date</span>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>

              {/* Interactive Checklist Items */}
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontWeight: 500, fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  Subtasks / Checklist ({checklist.length})
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                  {checklist.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => {
                          const updated = [...checklist];
                          updated[idx].done = !updated[idx].done;
                          setChecklist(updated);
                        }}
                      />
                      <span style={{ fontSize: '13px', textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--muted)' : 'var(--ink)', flex: 1 }}>
                        {item.text}
                      </span>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => setChecklist(checklist.filter((_, i) => i !== idx))}
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Add checklist item…"
                    value={newCheckItem}
                    onChange={e => setNewCheckItem(e.target.value)}
                    style={{ flex: 1, padding: '6px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newCheckItem.trim()) {
                          setChecklist([...checklist, { text: newCheckItem.trim(), done: false }]);
                          setNewCheckItem('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      if (newCheckItem.trim()) {
                        setChecklist([...checklist, { text: newCheckItem.trim(), done: false }]);
                        setNewCheckItem('');
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !title.trim()}>
                {saving ? 'Saving…' : editingTask ? 'Save Task' : 'Create Task'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
