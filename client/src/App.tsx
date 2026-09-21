import { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  LayoutDashboard,
  Compass,
  ScrollText,
  Layers,
  FileText,
  Building2,
  AlertTriangle,
  FileCheck,
  Briefcase,
  CheckSquare,
  Users,
  HardDrive,
  UserCheck,
  HelpCircle,
  ShieldAlert,
  Globe,
  Radio,
  Award,
  History,
  Settings as SettingsIcon,
  Search,
  CheckCircle2,
  Menu,
  X,
  Sparkles
} from 'lucide-react';
import { api } from './lib/api';
import { Loading, ErrorState, Toast, Badge } from './components/ui';
import { CommandPalette } from './components/CommandPalette';
import { OverviewView } from './views/OverviewView';
import { RoadmapView } from './views/RoadmapView';
import { SOC2ReadinessView } from './views/SOC2ReadinessView';
import { SystemDescriptionView } from './views/SystemDescriptionView';
import { ContinuousTestsView } from './views/ContinuousTestsView';
import { ResourceTableView } from './views/ResourceTableView';
import { PoliciesView } from './views/PoliciesView';
import { EvidenceView } from './views/EvidenceView';
import { MonitoringView } from './views/MonitoringView';
import { AuditsView } from './views/AuditsView';
import { TasksView } from './views/TasksView';
import { PeopleView } from './views/PeopleView';
import { QuestionnairesView } from './views/QuestionnairesView';
import { AccessReviewsView } from './views/AccessReviewsView';
import { TrustCenterView } from './views/TrustCenterView';
import { IntegrationsView } from './views/IntegrationsView';
import { ActivityView } from './views/ActivityView';
import { SettingsView } from './views/SettingsView';
import { FrameworksView } from './views/FrameworksView';
import { ChangelogModal } from './components/ChangelogModal';
import { VendorSoc2Modal } from './components/VendorSoc2Modal';
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
  const [analyzingVendor, setAnalyzingVendor] = useState<any | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    setMobileMenuOpen(false);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApp();
  }, []);

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loading label="Starting Harbor GRC workspace…" /></div>;
  if (error) return <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}><ErrorState message={error} retry={loadApp} /></div>;
  if (!bootstrap || !schema) return null;

  const counts = bootstrap.counts || {};

  const NAV_SECTIONS = [
    {
      title: 'Monitor & Roadmap',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'roadmap', label: 'SOC 2 Roadmap', icon: Compass, countKey: null },
        { id: 'soc2_readiness', label: 'SOC 2 Readiness', icon: Award, countKey: null },
        { id: 'tests', label: 'Continuous Tests', icon: ShieldCheck, countKey: null },
        { id: 'monitoring', label: 'Monitoring Checks', icon: Radio, countKey: null }
      ]
    },
    {
      title: 'Operate',
      items: [
        { id: 'frameworks', label: 'Frameworks', icon: Layers, countKey: 'frameworks' },
        { id: 'controls', label: 'Controls', icon: Shield, countKey: 'controls' },
        { id: 'evidence', label: 'Evidence', icon: FileCheck, countKey: 'evidence' },
        { id: 'policies', label: 'Policies', icon: FileText, countKey: 'policies' },
        { id: 'system_description', label: 'System Description', icon: ScrollText, countKey: null },
        { id: 'vendors', label: 'Vendors', icon: Building2, countKey: 'vendors' },
        { id: 'risks', label: 'Risks', icon: AlertTriangle, countKey: 'risks' },
        { id: 'audits', label: 'Audits', icon: Briefcase, countKey: 'audits' },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare, countKey: 'tasks' },
        { id: 'people', label: 'People', icon: Users, countKey: 'people' },
        { id: 'assets', label: 'Assets', icon: HardDrive, countKey: 'assets' },
        { id: 'access_reviews', label: 'Access Reviews', icon: UserCheck, countKey: 'access_reviews' },
        { id: 'questionnaires', label: 'Questionnaires', icon: HelpCircle, countKey: 'questionnaires' },
        { id: 'exceptions', label: 'Exceptions', icon: ShieldAlert, countKey: 'exceptions' }
      ]
    },
    {
      title: 'Publish & Configure',
      items: [
        { id: 'trust', label: 'Trust Center', icon: Globe },
        { id: 'integrations', label: 'Integrations', icon: Layers },
        { id: 'activity', label: 'Activity Log', icon: History },
        { id: 'settings', label: 'Settings', icon: SettingsIcon }
      ]
    }
  ];

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Shield size={16} />
          </div>
          <div>
            <div className="brand-title">Harbor GRC</div>
          </div>
          <span className="brand-badge">Local</span>
        </div>

        <div style={{ padding: '8px' }}>
          <button className="search-trigger" onClick={() => setCommandPaletteOpen(true)}>
            <Search size={14} />
            <span>Search workspace…</span>
            <span className="kbd-shortcut">⌘K</span>
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((sec, sIdx) => (
            <div key={sIdx}>
              <div className="nav-section-title">{sec.title}</div>
              {sec.items.map(it => {
                const Icon = it.icon;
                const isActive = activeView === it.id;
                const count = it.countKey ? counts[it.countKey] : undefined;
                return (
                  <button
                    key={it.id}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => navigate(it.id)}
                  >
                    <Icon size={16} />
                    <span>{it.label}</span>
                    {count !== undefined && count > 0 && (
                      <span className="nav-count">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>Workspace: <strong>{bootstrap.workspace.name}</strong></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
            <span
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--sidebar-fg)',
                padding: '2px 8px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.12)',
                fontFamily: 'monospace'
              }}
            >
              v{APP_VERSION}
            </span>
            <button
              onClick={() => setShowChangelogModal(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#60a5fa',
                cursor: 'pointer',
                padding: 0,
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <History size={11} /> Changelog
            </button>
          </div>
        </div>
      </aside>

      {/* Main Surface Area */}
      <div className="main-wrapper">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ display: 'none' }}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="workspace-label">
              <span style={{ color: 'var(--muted)' }}>Organization:</span>
              <span>{bootstrap.workspace.organization || bootstrap.workspace.name}</span>
            </div>
          </div>

          <div className="topbar-actions">
            <button className="button button-sm" onClick={() => setShowChangelogModal(true)} title="View system changelog">
              <History size={12} color="#2563eb" /> v{APP_VERSION}
            </button>
            <button className="button button-sm" onClick={() => setCommandPaletteOpen(true)}>
              <Search size={12} /> Search
            </button>
            <button className="button button-sm" onClick={() => navigate('settings')}>
              <SettingsIcon size={12} /> Settings
            </button>
          </div>
        </header>

        <main className="content-area">
          {activeView === 'overview' && (
            <OverviewView onNavigate={navigate} notify={notify} />
          )}

          {activeView === 'roadmap' && (
            <RoadmapView notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'soc2_readiness' && (
            <SOC2ReadinessView notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'tests' && (
            <ContinuousTestsView notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'policies' && (
            <PoliciesView schema={schema} notify={notify} onNavigate={navigate} selectedId={selectedId} />
          )}

          {activeView === 'system_description' && (
            <SystemDescriptionView notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'evidence' && (
            <EvidenceView schema={schema} notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'monitoring' && (
            <MonitoringView notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'audits' && (
            <AuditsView schema={schema} notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'tasks' && (
            <TasksView schema={schema} notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'people' && (
            <PeopleView schema={schema} notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'questionnaires' && (
            <QuestionnairesView schema={schema} notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'access_reviews' && (
            <AccessReviewsView schema={schema} notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'trust' && (
            <TrustCenterView schema={schema} notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'integrations' && (
            <IntegrationsView notify={notify} onNavigate={navigate} />
          )}

          {activeView === 'activity' && (
            <ActivityView notify={notify} onNavigate={navigate} />
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

          {activeView === 'vendors' && (
            <ResourceTableView
              resource="vendors"
              schema={schema}
              title="Third-Party Vendor Management"
              description="Sub-processors, software vendors, data access level, renewal schedule, and inherent/residual risk assessments."
              notify={notify}
              onNavigate={navigate}
              selectedId={selectedId}
              customColumns={(r) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Badge value={r.tier || 'medium'} />
                  <button
                    type="button"
                    className="button button-sm"
                    onClick={(e) => { e.stopPropagation(); setAnalyzingVendor(r); }}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    title="Run AI SOC 2 Examination Review and Extract CUECs"
                  >
                    <Sparkles size={11} color="#2563eb" /> AI SOC 2
                  </button>
                  {r.website && (
                    <a href={r.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px' }}>
                      Web
                    </a>
                  )}
                </div>
              )}
            />
          )}

          {activeView === 'risks' && (
            <ResourceTableView
              resource="risks"
              schema={schema}
              title="Enterprise Risk Register"
              description="Threat identification, 5×5 inherent and residual risk calculations, treatment assignments, and control mitigations."
              notify={notify}
              onNavigate={navigate}
              selectedId={selectedId}
              customColumns={(r) => (
                <div className="mono" style={{ fontSize: '12px' }}>
                  <span>Inherent: <strong>{r.inherent_score || (r.likelihood * r.impact)}</strong></span>
                  <span style={{ marginLeft: '8px', color: 'var(--accent)' }}>Residual: <strong>{r.residual_score || (r.residual_likelihood * r.residual_impact)}</strong></span>
                </div>
              )}
            />
          )}

          {activeView === 'assets' && (
            <ResourceTableView
              resource="assets"
              schema={schema}
              title="Hardware & Cloud Asset Inventory"
              description="Company laptops, cloud virtual machines, and data repositories with recorded encryption and MFA baselines."
              notify={notify}
              onNavigate={navigate}
              selectedId={selectedId}
              customColumns={(r) => (
                <div style={{ fontSize: '11px', display: 'flex', gap: '6px' }}>
                  <span style={{ textTransform: 'capitalize' }}>{r.category}</span>
                  {r.encrypted !== null && (
                    <span style={{ color: r.encrypted ? 'var(--accent)' : 'var(--danger)', fontWeight: 600 }}>
                      {r.encrypted ? 'Encrypted' : 'Unencrypted'}
                    </span>
                  )}
                </div>
              )}
            />
          )}

          {activeView === 'exceptions' && (
            <ResourceTableView
              resource="exceptions"
              schema={schema}
              title="Security Exceptions Register"
              description="Documented deviations from standard security baselines, business justifications, expiration dates, and executive approvals."
              notify={notify}
              onNavigate={navigate}
              selectedId={selectedId}
              customColumns={(r) => (
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  <span>Approver: {r.approver || 'Pending'}</span>
                </div>
              )}
            />
          )}
        </main>
      </div>

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

      {/* Vendor AI SOC 2 Review Modal */}
      <VendorSoc2Modal
        isOpen={!!analyzingVendor}
        onClose={() => setAnalyzingVendor(null)}
        vendor={analyzingVendor}
        notify={notify}
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
    </div>
  );
}
