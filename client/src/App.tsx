import { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  LayoutDashboard,
  FileText,
  FileCheck,
  Users,
  Award,
  Settings as SettingsIcon,
  Target,
} from 'lucide-react';
import { api } from './lib/api';
import { Loading, ErrorState, Toast, Badge } from './components/ui';
import { CommandPalette } from './components/CommandPalette';
import { AppShell } from './components/AppShell';
import { OverviewView } from './views/OverviewView';
import { SOC2ReadinessView } from './views/SOC2ReadinessView';
import { PilotView } from './views/PilotView';
import { OnboardingWizard } from './views/OnboardingWizard';
import { ResourceTableView } from './views/ResourceTableView';
import { PoliciesView } from './views/PoliciesView';
import { EvidenceView } from './views/EvidenceView';
import { PeopleView } from './views/PeopleView';
import { SettingsView } from './views/SettingsView';
import { FrameworksView } from './views/FrameworksView';
import { ChangelogModal } from './components/ChangelogModal';
import { APP_VERSION } from './version';
import type { Schema, Bootstrap } from './lib/types';

interface ToastItem {
  id: string;
  message: string;
  kind: 'success' | 'error';
}

export function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('overview');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const navigate = useCallback((view: string, id?: string) => {
    setActiveView(view);
    setSelectedId(id);
    window.location.hash = id ? `${view}/${id}` : view;
    window.scrollTo(0, 0);
  }, []);

  // Sync hash routing
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash) {
        const parts = hash.split('/');
        setActiveView(parts[0]);
        setSelectedId(parts[1]);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Global Keyboard shortcuts: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadApp = async () => {
    setLoading(true);
    setError('');
    try {
      const [b, s] = await Promise.all([
        api.bootstrap(),
        api.get('/schema')
      ]);
      setBootstrap(b);
      setSchema(s);
      const isConfigured = Boolean(b.workspace?.onboarding_completed);
      const isSkipped = sessionStorage.getItem('wizard_skipped') === 'true';
      const currentHash = window.location.hash.replace(/^#\/?/, '').split('/')[0];
      if (!isConfigured && !isSkipped && !currentHash) {
        setActiveView('onboarding');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApp();
  }, []);

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loading label="Starting TwoFrom GRC workspace…" /></div>;
  if (error) return <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}><ErrorState message={error} retry={loadApp} /></div>;
  if (!bootstrap || !schema) return null;

  const counts = bootstrap.counts || {};

  const NAV_SECTIONS = [
    {
      title: 'TwoFrom GRC',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'soc2_readiness', label: 'SOC 2 Readiness', icon: Award },
        { id: 'pilot', label: 'Blind Pilot', icon: Target },
        { id: 'policies', label: 'Policies', icon: FileText, countKey: 'policies' },
        { id: 'evidence', label: 'Evidence', icon: FileCheck, countKey: 'evidence' },
        { id: 'frameworks', label: 'Frameworks & Controls', icon: Shield, countKey: 'controls' },
        { id: 'people', label: 'People', icon: Users, countKey: 'people' },
        { id: 'settings', label: 'Settings', icon: SettingsIcon }
      ]
    }
  ];

  return (
    <>
      <AppShell
        workspace={bootstrap.workspace}
        sections={NAV_SECTIONS}
        activeView={activeView}
        onNavigate={navigate}
        onSearch={() => setCommandPaletteOpen(true)}
        onChangelog={() => setShowChangelogModal(true)}
      >
          {activeView === 'overview' && (
            <OverviewView onNavigate={navigate} notify={notify} />
          )}

          {activeView === 'soc2_readiness' && (
            <SOC2ReadinessView notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'pilot' && (
            <PilotView notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'onboarding' && (
            <OnboardingWizard
              onComplete={async () => {
                await loadApp();
                navigate('overview');
              }}
              onSkip={() => {
                sessionStorage.setItem('wizard_skipped', 'true');
                navigate('overview');
              }}
              notify={notify}
            />
          )}

          {activeView === 'policies' && (
            <PoliciesView schema={schema} notify={notify} onNavigate={navigate} selectedId={selectedId} />
          )}

          {activeView === 'evidence' && (
            <EvidenceView schema={schema} notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'people' && (
            <PeopleView schema={schema} notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'settings' && (
            <SettingsView notify={notify} onNavigate={navigate} />
          )}

          {/* Compliance Frameworks & Harmonization */}
          {activeView === 'frameworks' && (
            <FrameworksView
              schema={schema}
              notify={notify}
              onNavigate={navigate}
            />
          )}

          {activeView === 'controls' && (
            <ResourceTableView
              resource="controls"
              schema={schema}
              title="Compliance Controls Library"
              description="Authoritative controls, frequency cadences, ownership, policy references, and audit evidence mappings."
              notify={notify}
              onNavigate={navigate}
              selectedId={selectedId}
              customColumns={(r) => (
                <div style={{ fontSize: '11px' }}>
                  <span style={{ color: 'var(--muted)' }}>{r.category || 'General'}</span>
                  {r.frequency && <span style={{ marginLeft: '6px', color: 'var(--accent)', textTransform: 'capitalize' }}>· {r.frequency}</span>}
                </div>
              )}
            />
          )}
      </AppShell>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={navigate}
      />

      {/* Changelog Modal */}
      <ChangelogModal
        isOpen={showChangelogModal}
        onClose={() => setShowChangelogModal(false)}
      />

      {/* Floating Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <Toast
            key={t.id}
            message={t.message}
            kind={t.kind}
            onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
          />
        ))}
      </div>
    </>
  );
}
