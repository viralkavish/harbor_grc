import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { FileText, Download, Sparkles, Save, Check, RefreshCw, Layers } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Loading, ErrorState, Note, Badge } from '../components/ui';
import type { Notify, Navigate } from '../lib/types';

export function SystemDescriptionView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [doc, setDoc] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string>('sec_overview');
  const [editContent, setEditContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [populating, setPopulating] = useState<boolean>(false);

  const loadDescription = () => {
    setLoading(true);
    setError('');
    api.get('/system_description')
      .then(res => {
        setDoc(res);
        const sec = res.sections?.find((s: any) => s.id === activeSectionId) || res.sections?.[0];
        if (sec) {
          setActiveSectionId(sec.id);
          setEditContent(sec.content);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDescription();
  }, []);

  const handleSelectSection = (sec: any) => {
    setActiveSectionId(sec.id);
    setEditContent(sec.content);
    setIsEditing(false);
  };

  const handleSaveSection = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const updatedSections = doc.sections.map((s: any) =>
        s.id === activeSectionId ? { ...s, content: editContent } : s
      );
      const res = await api.patch('/system_description', { sections: updatedSections });
      setDoc(res);
      setIsEditing(false);
      notify('Section updated and saved');
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoPopulate = async () => {
    setPopulating(true);
    try {
      const res = await api.post('/system_description/auto_populate');
      setDoc(res);
      const active = res.sections.find((s: any) => s.id === activeSectionId);
      if (active) setEditContent(active.content);
      notify('Component inventory and subservice organizations populated into system description');
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setPopulating(false);
    }
  };

  if (loading && !doc) return <Loading label="Loading AICPA System Description…" />;
  if (error) return <ErrorState message={error} retry={loadDescription} />;

  const sections = doc?.sections || [];
  const currentSection = sections.find((s: any) => s.id === activeSectionId) || sections[0];

  return (
    <div className="harbor-view">
      <PageHeader
        eyebrow="GOVERNANCE"
        title="System Description"
        description="Document system components, boundaries, and user responsibilities for SOC 2 Section 3."
      >
        <button className="button" onClick={handleAutoPopulate} disabled={populating}>
          <Sparkles size={14} /> {populating ? 'Populating…' : 'Auto-Populate Inventory'}
        </button>
        <a href="/api/system_description/export" className="button button-primary" download>
          <Download size={14} /> Export Dossier (.md)
        </a>
      </PageHeader>



      <div className="view-split-grid" style={{ display: 'grid', gap: '20px', alignItems: 'start' }}>
        {/* Sections Navigation */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '13px' }}>
            System Description Sections ({sections.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sections.map((s: any) => {
              const isSelected = s.id === activeSectionId;
              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectSection(s)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent-light)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{s.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{s.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section Editor & Markdown View */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{currentSection?.title}</h2>
              <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>{currentSection?.description}</p>
            </div>
            <div>
              {!isEditing ? (
                <button className="button button-sm" onClick={() => setIsEditing(true)}>
                  Edit Section
                </button>
              ) : (
                <div className="view-inline" style={{ display: 'flex', gap: '6px' }}>
                  <button className="button button-sm" onClick={() => { setEditContent(currentSection?.content); setIsEditing(false); }}>
                    Cancel
                  </button>
                  <button className="button button-sm button-primary" onClick={handleSaveSection} disabled={saving}>
                    <Save size={12} /> {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            {isEditing ? (
              <textarea
                rows={18}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}
              />
            ) : (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', lineHeight: 1.7, color: 'var(--ink)' }}>
                <Markdown>{currentSection?.content || '*No content for this section.*'}</Markdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
