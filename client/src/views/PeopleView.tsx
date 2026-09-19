import { useEffect, useState } from 'react';
import { Users, CheckCircle2, AlertCircle, Plus, Trash2, Edit2, GraduationCap, FileCheck, Check } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, EmptyState, formatDate, Note } from '../components/ui';
import { Dialog } from '../components/Dialog';
import { LinkedSelect } from '../components/Fields';
import type { Schema, Notify, Navigate } from '../lib/types';

export function PeopleView({ schema, notify, onNavigate }: { schema: Schema; notify: Notify; onNavigate: Navigate }) {
  const [compliance, setCompliance] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState('');
  const [trainingDue, setTrainingDue] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPersonnel = () => {
    setLoading(true);
    setError('');
    api.get('/personnel/compliance')
      .then(setCompliance)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPersonnel();
  }, []);

  const handleOpenCreate = () => {
    setEditingPerson(null);
    setTitle('');
    setEmail('');
    setDepartment('Engineering');
    setRole('Software Engineer');
    setStatus('active');
    setStartDate(new Date().toISOString().slice(0, 10));
    setTrainingDue('');
    setShowModal(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditingPerson(p);
    setTitle(p.title);
    setEmail(p.email || '');
    setDepartment(p.department || '');
    setRole(p.role || '');
    setStatus(p.status || 'active');
    setStartDate(p.start_date || '');
    setTrainingDue(p.training_due || '');
    setShowModal(true);
  };

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title,
        email,
        department,
        role,
        status,
        start_date: startDate || null,
        training_due: trainingDue || null
      };
      if (editingPerson) {
        await api.patch(`/people/${editingPerson.id}`, payload);
        notify('Personnel record updated');
      } else {
        await api.post('/people', payload);
        notify('Personnel record added');
      }
      setShowModal(false);
      loadPersonnel();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTraining = async (personId: string, name: string) => {
    try {
      await api.post(`/personnel/${personId}/complete_training`);
      notify(`Security training marked complete for ${name}`);
      loadPersonnel();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleAcceptAllPolicies = async (personId: string, name: string) => {
    try {
      await api.post(`/personnel/${personId}/accept_all_policies`);
      notify(`Policy acceptance signed and recorded for ${name}`);
      loadPersonnel();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDelete = async (personId: string, name: string) => {
    if (!confirm(`Delete personnel record for "${name}"?`)) return;
    try {
      await api.delete(`/people/${personId}`);
      notify('Personnel record deleted');
      loadPersonnel();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  if (loading && !compliance) return <Loading label="Loading personnel compliance status…" />;
  if (error) return <ErrorState message={error} retry={loadPersonnel} />;

  const employees = compliance?.employees || [];

  return (
    <div>
      <PageHeader
        eyebrow="OPERATE"
        title="Personnel & Workforce Compliance"
        description="Track employee onboarding security tasks, annual security awareness training completion, and signed policy acceptances."
      >
        <button className="button button-primary" onClick={handleOpenCreate}>
          <Plus size={14} /> Add Personnel
        </button>
      </PageHeader>

      <Note>
        <strong>Auditor Verification:</strong> SOC 2 and ISO 27001 require verified annual security awareness training and signed acceptable use attestations for 100% of in-scope personnel.
      </Note>

      {/* Compliance Scorecard */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <div className="metric">
          <span>Overall Workforce Compliance</span>
          <strong style={{ color: 'var(--accent)' }}>{compliance.compliance_percent}%</strong>
          <small>{compliance.compliant_count} of {compliance.total_active} compliant</small>
        </div>
        <div className="metric">
          <span>Security Training Rate</span>
          <strong style={{ color: compliance.trained_percent >= 90 ? 'var(--accent)' : 'var(--warning)' }}>
            {compliance.trained_percent}%
          </strong>
          <small>Annual curriculum completed</small>
        </div>
        <div className="metric">
          <span>Total Active Personnel</span>
          <strong>{compliance.total_active}</strong>
          <small>In-scope workforce records</small>
        </div>
      </div>

      <div className="table-container">
        {employees.length === 0 ? (
          <EmptyState
            title="No personnel records yet"
            description="Add employees or contractors to track their security training and policy acceptance."
            action={
              <button className="button button-primary" onClick={handleOpenCreate}>
                <Plus size={14} /> Add First Employee
              </button>
            }
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role & Department</th>
                <th>Status</th>
                <th>Security Training</th>
                <th>Policy Acceptances</th>
                <th>Overall</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{p.email || 'No email registered'}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px' }}>{p.role}</span>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{p.department}</div>
                  </td>
                  <td><Badge value={p.status} /></td>
                  <td>
                    {p.training_completed ? (
                      <span className="badge badge-green"><Check size={12} /> Completed</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-amber">Pending</span>
                        <button
                          className="button button-sm"
                          style={{ padding: '2px 6px', fontSize: '10px' }}
                          onClick={() => handleCompleteTraining(p.id, p.title)}
                        >
                          Mark Done
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="mono" style={{ fontSize: '12px', fontWeight: 600 }}>
                        {p.policies_accepted}/{p.total_policies}
                      </span>
                      {p.policies_accepted < p.total_policies && (
                        <button
                          className="button button-sm"
                          style={{ padding: '2px 6px', fontSize: '10px' }}
                          onClick={() => handleAcceptAllPolicies(p.id, p.title)}
                          title="Simulate self-service acceptance of all published policies"
                        >
                          Sign All
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <Badge value={p.is_compliant ? 'complete' : 'pending'} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      <button className="icon-button" onClick={() => handleOpenEdit(p)}><Edit2 size={14} /></button>
                      <button className="icon-button" onClick={() => handleDelete(p.id, p.title)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <Dialog title={editingPerson ? 'Edit Personnel' : 'Add Personnel'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSavePerson}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Full Name *</span>
                <input type="text" required placeholder="e.g. Jordan Lee" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="field">
                <span>Corporate Email *</span>
                <input type="email" required placeholder="e.g. jordan@company.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="field-grid">
                <div className="field">
                  <span>Department</span>
                  <input type="text" placeholder="e.g. Engineering, Product" value={department} onChange={e => setDepartment(e.target.value)} />
                </div>
                <div className="field">
                  <span>Job Role / Title</span>
                  <input type="text" placeholder="e.g. Senior DevOps Lead" value={role} onChange={e => setRole(e.target.value)} />
                </div>
                <div className="field">
                  <span>Status</span>
                  <select value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="active">Active</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="offboarding">Offboarding</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="field">
                  <span>Start Date</span>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !title.trim() || !email.trim()}>
                {saving ? 'Saving…' : editingPerson ? 'Update Person' : 'Add Person'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
