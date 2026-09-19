import { useEffect, useState } from 'react';
import { Compass, CheckCircle2, Circle, ArrowRight, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Loading, ErrorState, Note, Badge } from '../components/ui';
import type { Notify, Navigate } from '../lib/types';

export function RoadmapView({ notify, onNavigate }: { notify: Notify; onNavigate: Navigate }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePhase, setActivePhase] = useState<number>(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadRoadmap = () => {
    setLoading(true);
    setError('');
    api.get('/roadmap')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRoadmap();
  }, []);

  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    setTogglingId(taskId);
    try {
      const res = await api.patch(`/roadmap/tasks/${taskId}`, { completed: !currentCompleted });
      setData((prev: any) => {
        if (!prev) return prev;
        const updatedPhases = prev.phases.map((p: any) => ({
          ...p,
          tasks: p.tasks.map((t: any) => (t.id === taskId ? { ...t, completed: !currentCompleted } : t))
        }));
        return {
          ...prev,
          phases: updatedPhases,
          completed_tasks: res.completed_tasks,
          progress_percent: res.progress_percent
        };
      });
      notify(!currentCompleted ? 'Milestone marked complete' : 'Milestone reopened');
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading && !data) return <Loading label="Loading SOC 2 readiness trajectory…" />;
  if (error) return <ErrorState message={error} retry={loadRoadmap} />;

  const phases = data?.phases || [];

  return (
    <div>
      <PageHeader
        eyebrow="ROADMAP"
        title="SOC 2 Type II Readiness Trajectory"
        description="Standard 6-phase Vanta execution trajectory guiding you from setup and policy adoption to automated technical testing and the audit observation window."
      >
        <button className="button" onClick={loadRoadmap} title="Refresh roadmap">
          <RefreshCw size={14} /> Refresh
        </button>
      </PageHeader>

      {/* Trajectory Progress Banner */}
      <div className="card" style={{ background: 'var(--sidebar-bg)', color: 'white', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={20} color="var(--accent)" />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>Audit Readiness Progress</h3>
          </div>
          <strong style={{ fontSize: '20px', color: 'var(--accent)' }}>
            {data.progress_percent}% Complete
          </strong>
        </div>
        <p style={{ fontSize: '13px', color: '#b2dfdb', marginBottom: '16px' }}>
          {data.completed_tasks} of {data.total_tasks} strategic milestones accomplished across all 6 phases.
        </p>
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${data.progress_percent}%`, height: '100%', background: 'var(--accent)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Phase Selector Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '24px' }}>
        {phases.map((p: any) => {
          const completedCount = p.tasks.filter((t: any) => t.completed).length;
          const isCurrent = activePhase === p.phase;
          const isDone = completedCount === p.tasks.length;
          return (
            <div
              key={p.phase}
              onClick={() => setActivePhase(p.phase)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: isCurrent ? 'white' : '#fafcfb',
                border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)',
                cursor: 'pointer',
                boxShadow: isCurrent ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span className="mono" style={{ fontSize: '11px', fontWeight: 700, color: isCurrent ? 'var(--accent)' : 'var(--muted)' }}>
                  Phase {p.phase}
                </span>
                {isDone ? <CheckCircle2 size={14} color="var(--accent)" /> : <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{completedCount}/{p.tasks.length}</span>}
              </div>
              <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.title.split(':')[1]?.split('(')[0] || p.title}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Phase Tasks Detail */}
      {phases.filter((p: any) => p.phase === activePhase).map((phase: any) => (
        <div key={phase.phase} className="card">
          <div className="card-header">
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>{phase.title}</h2>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '2px' }}>{phase.description}</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
            {phase.tasks.map((task: any) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: task.completed ? '#f7faf8' : 'white',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                  <input
                    type="checkbox"
                    style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                    checked={task.completed}
                    disabled={togglingId === task.id}
                    onChange={() => handleToggleTask(task.id, task.completed)}
                  />
                  <div>
                    <strong style={{ fontSize: '15px', color: 'var(--ink)', textDecoration: task.completed ? 'line-through' : 'none' }}>
                      {task.title}
                    </strong>
                    <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.5 }}>
                      {task.detail}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {task.action_resource && (
                    <button
                      className="button button-sm button-primary"
                      onClick={() => onNavigate(task.action_resource)}
                    >
                      Open Module <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
