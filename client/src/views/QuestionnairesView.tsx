import { useEffect, useState } from 'react';
import { HelpCircle, Sparkles, Plus, Check, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Badge, Loading, ErrorState, EmptyState, formatDate, Note } from '../components/ui';
import { Dialog } from '../components/Dialog';
import type { DataRecord, Schema, Notify, Navigate } from '../lib/types';

export function QuestionnairesView({ schema, notify, onNavigate }: { schema: Schema; notify: Notify; onNavigate: Navigate }) {
  const [questionnaires, setQuestionnaires] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedQ, setSelectedQ] = useState<DataRecord | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  // New Questionnaire Modal
  const [showQModal, setShowQModal] = useState(false);
  const [qTitle, setQTitle] = useState('');
  const [qCustomer, setQCustomer] = useState('');

  // New Question Modal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [saving, setSaving] = useState(false);

  const loadQuestionnaires = () => {
    setLoading(true);
    setError('');
    api.get('/questionnaires')
      .then(res => {
        const items = res.items || [];
        setQuestionnaires(items);
        if (items.length > 0 && !selectedQ) {
          setSelectedQ(items[0]);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQuestionnaires();
  }, []);

  const handleSuggest = async () => {
    if (!selectedQ) return;
    setSuggesting(true);
    try {
      const res = await api.post(`/questionnaires/${selectedQ.id}/suggest`);
      setSelectedQ(res);
      notify('Answers suggested from published policies');
      loadQuestionnaires();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSuggesting(false);
    }
  };

  const handleCreateQuestionnaire = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/questionnaires', {
        title: qTitle,
        customer: qCustomer,
        questions: [],
        status: 'draft'
      });
      notify('Questionnaire created');
      setShowQModal(false);
      setQTitle('');
      setQCustomer('');
      setSelectedQ(res);
      loadQuestionnaires();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQ || !questionText.trim()) return;
    setSaving(true);
    try {
      const updatedQuestions = [
        ...(selectedQ.questions || []),
        {
          id: `q-${Date.now()}`,
          question: questionText.trim(),
          answer: '',
          status: 'unanswered',
          source_ids: []
        }
      ];
      const res = await api.patch(`/questionnaires/${selectedQ.id}`, { questions: updatedQuestions });
      setSelectedQ(res);
      setShowQuestionModal(false);
      setQuestionText('');
      notify('Question added');
      loadQuestionnaires();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAnswer = async (qIndex: number, newAnswer: string, newStatus: string) => {
    if (!selectedQ) return;
    const updated = [...(selectedQ.questions || [])];
    if (updated[qIndex]) {
      updated[qIndex] = { ...updated[qIndex], answer: newAnswer, status: newStatus };
      try {
        const res = await api.patch(`/questionnaires/${selectedQ.id}`, { questions: updated });
        setSelectedQ(res);
        loadQuestionnaires();
      } catch (err: any) {
        notify(err.message, 'error');
      }
    }
  };

  if (loading && questionnaires.length === 0) return <Loading label="Loading security questionnaires…" />;
  if (error) return <ErrorState message={error} retry={loadQuestionnaires} />;

  return (
    <div>
      <PageHeader
        eyebrow="OPERATE"
        title="Security Questionnaires"
        description="Accelerate customer security assessments by retrieving authoritative answers directly from published organizational policies."
      >
        <button className="button button-primary" onClick={() => setShowQModal(true)}>
          <Plus size={14} /> New Questionnaire
        </button>
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Questionnaires List */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#fafcfb', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '13px' }}>
            Questionnaires ({questionnaires.length})
          </div>
          <div>
            {questionnaires.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                No questionnaires yet. Create one to begin.
              </div>
            ) : (
              questionnaires.map(q => {
                const isSelected = selectedQ?.id === q.id;
                const count = q.questions?.length || 0;
                return (
                  <div
                    key={q.id}
                    onClick={() => setSelectedQ(q)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: isSelected ? '#f0f5f3' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{q.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0' }}>Customer: {q.customer || 'General'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <Badge value={q.status} />
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{count} questions</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Q&A Workspace */}
        <div>
          {selectedQ && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{selectedQ.title}</h2>
                    <Badge value={selectedQ.status} />
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '2px' }}>
                    Target Customer: <strong>{selectedQ.customer || 'Internal Evaluation'}</strong> · Total Questions: {selectedQ.questions?.length || 0}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="button button-primary" onClick={handleSuggest} disabled={suggesting}>
                    <Sparkles size={14} />
                    {suggesting ? 'Scanning Policies…' : 'Suggest from Policies'}
                  </button>
                  <button className="button" onClick={() => setShowQuestionModal(true)}>
                    <Plus size={14} /> Add Question
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                {(!selectedQ.questions || selectedQ.questions.length === 0) ? (
                  <div style={{ padding: '32px', background: '#fafcfb', border: '1px dashed var(--border)', borderRadius: '6px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                    No questions in this assessment yet. Click "Add Question" to paste an incoming audit prompt.
                  </div>
                ) : (
                  selectedQ.questions.map((q: any, idx: number) => (
                    <div key={q.id || idx} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', background: '#fafcfb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                          {idx + 1}. {q.question}
                        </strong>
                        <Badge value={q.status || 'unanswered'} />
                      </div>

                      <div style={{ marginTop: '8px' }}>
                        <textarea
                          rows={3}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'inherit' }}
                          placeholder="Draft response..."
                          value={q.answer || ''}
                          onChange={e => {
                            const updated = [...selectedQ.questions];
                            updated[idx].answer = e.target.value;
                            setSelectedQ({ ...selectedQ, questions: updated });
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px' }}>
                        <div>
                          {q.source_ids?.length > 0 && (
                            <span style={{ color: 'var(--muted)' }}>
                              Source policy: {q.source_ids.map((sid: string) => (
                                <button key={sid} className="link-button" onClick={() => onNavigate('policies', sid)} style={{ marginLeft: '4px' }}>
                                  {sid}
                                </button>
                              ))}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="button button-sm"
                            onClick={() => handleUpdateAnswer(idx, q.answer, 'approved')}
                          >
                            <Check size={12} /> Approve Answer
                          </button>
                          <button
                            type="button"
                            className="button button-sm button-primary"
                            onClick={() => handleUpdateAnswer(idx, q.answer, q.status || 'draft')}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Questionnaire Modal */}
      {showQModal && (
        <Dialog title="Create Security Questionnaire" onClose={() => setShowQModal(false)}>
          <form onSubmit={handleCreateQuestionnaire}>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="field">
                <span>Questionnaire Title *</span>
                <input type="text" required placeholder="e.g. Enterprise Client Vendor Assessment" value={qTitle} onChange={e => setQTitle(e.target.value)} />
              </div>
              <div className="field">
                <span>Customer / Counterparty Name</span>
                <input type="text" placeholder="e.g. Acme Corp" value={qCustomer} onChange={e => setQCustomer(e.target.value)} />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowQModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !qTitle.trim()}>
                {saving ? 'Creating…' : 'Create Questionnaire'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* New Question Modal */}
      {showQuestionModal && (
        <Dialog title="Add Question" onClose={() => setShowQuestionModal(false)}>
          <form onSubmit={handleAddQuestion}>
            <div className="dialog-body">
              <div className="field">
                <span>Question Text *</span>
                <textarea rows={4} required placeholder="e.g. Do you maintain a documented incident response plan that is tested at least annually?" value={questionText} onChange={e => setQuestionText(e.target.value)} />
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="button" onClick={() => setShowQuestionModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving || !questionText.trim()}>
                {saving ? 'Adding…' : 'Add Question'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
