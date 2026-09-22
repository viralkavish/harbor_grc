import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, History, Menu, Search, Settings, Shield, X, Bot } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Navigate, Workspace } from '../lib/types';
import { isWebMcpEnabled } from '../lib/webmcp/polyfill';
import { APP_VERSION } from '../version';

type Section = { title: string; items: { id: string; label: string; icon: LucideIcon }[] };

type Props = {
  workspace: Workspace;
  sections: Section[];
  activeView: string;
  onNavigate: Navigate;
  onSearch: () => void;
  onChangelog: () => void;
  onOpenWebMcp?: () => void;
  children: ReactNode;
};

export function AppShell({ workspace, sections, activeView, onNavigate, onSearch, onChangelog, onOpenWebMcp, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [isAgentActuating, setIsAgentActuating] = useState(false);
  const [isAgentToolsActive, setIsAgentToolsActive] = useState(() => isWebMcpEnabled());
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const main = useRef<HTMLElement>(null);
  const drawerOpen = isMobile && menuOpen;
  const current = sections.flatMap(section => section.items).find(item => item.id === activeView);
  const group = sections.find(section => section.items.some(item => item.id === activeView));
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

  useEffect(() => {
    const handleStart = () => setIsAgentActuating(true);
    const handleEnd = () => setTimeout(() => setIsAgentActuating(false), 1200);
    const handleStatus = (ev: any) => setIsAgentToolsActive(Boolean(ev.detail?.enabled));

    if (typeof window !== 'undefined') {
      window.addEventListener('webmcp:tool-calling', handleStart);
      window.addEventListener('webmcp:tool-executed', handleEnd);
      window.addEventListener('webmcp:status-changed', handleStatus);
      return () => {
        window.removeEventListener('webmcp:tool-calling', handleStart);
        window.removeEventListener('webmcp:tool-executed', handleEnd);
        window.removeEventListener('webmcp:status-changed', handleStatus);
      };
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const update = () => { setIsMobile(media.matches); setMenuOpen(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector<HTMLButtonElement>('[aria-label="Close navigation"]')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
      }
      if (event.key === 'Tab') {
        const controls = Array.from(sidebar.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') || []);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !sidebar.current?.contains(document.activeElement))) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !sidebar.current?.contains(document.activeElement))) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      menuButton.current?.focus();
    };
  }, [drawerOpen]);

  return (
    <div className="app-container">
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); main.current?.focus(); }}>Skip to content</a>
      {drawerOpen && <div className="navigation-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <aside
        id="workspace-navigation"
        ref={sidebar}
        className={`sidebar ${drawerOpen ? 'mobile-open' : ''}`}
        role={drawerOpen ? 'dialog' : undefined}
        aria-label="Workspace navigation"
        aria-modal={drawerOpen || undefined}
        inert={isMobile && !drawerOpen}
      >
        <div className="sidebar-brand">
          <span className="brand-icon"><Shield size={20} aria-hidden="true" /></span>
          <div className="brand-copy"><span className="brand-title">Harbor<span className="brand-grc">GRC</span></span><span className="brand-subtitle">Your compliance workspace</span></div>
          {isMobile && <button ref={undefined} type="button" className="icon-button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={20} /></button>}
        </div>
        <div className="sidebar-search">
          <button type="button" className="search-trigger" onClick={() => { setMenuOpen(false); onSearch(); }}>
            <Search size={16} aria-hidden="true" /><span>Find or jump to…</span><kbd>{shortcut}</kbd>
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {sections.map(section => (
            <div className="nav-section" key={section.title}>
              <div className="nav-section-title">{section.title}</div>
              {section.items.map(item => {
                const Icon = item.icon;
                return <button key={item.id} type="button" className={`nav-item ${activeView === item.id ? 'active' : ''}`} aria-current={activeView === item.id ? 'page' : undefined} onClick={() => { setMenuOpen(false); onNavigate(item.id); }}>
                  <Icon size={16} aria-hidden="true" /><span>{item.label}</span>
                </button>;
              })}
            </div>
          ))}
        </nav>
        <footer className="sidebar-footer">
          <div className="workspace-identity"><span className="workspace-avatar" aria-hidden="true">{(workspace.organization || workspace.name || 'H').slice(0, 1).toUpperCase()}</span><span><strong>{workspace.organization || workspace.name}</strong><small>{workspace.name}</small></span></div>
          <button type="button" className="release-link" onClick={() => { setMenuOpen(false); onChangelog(); }}><span className="mono">v{APP_VERSION}</span><span>What’s new <History size={13} aria-hidden="true" /></span></button>
          <button type="button" className="release-link" onClick={() => { setMenuOpen(false); onOpenWebMcp?.(); }}>
            <span className="mono" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={12} color={isAgentToolsActive ? 'var(--accent)' : 'var(--muted)'} />
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: isAgentToolsActive ? 'var(--success)' : '#718096',
                  display: 'inline-block'
                }}
              />
              <span>Agent tools</span>
            </span>
            <span style={{ color: isAgentToolsActive ? 'var(--success)' : 'var(--muted)', fontSize: '10px', textTransform: 'capitalize' }}>
              {isAgentToolsActive ? 'Active' : 'Disabled'}
            </span>
          </button>
        </footer>
      </aside>
      <div className="main-wrapper" inert={drawerOpen}>
        <header className="topbar">
          <div className="topbar-context">
            <button ref={menuButton} type="button" className="icon-button mobile-toggle" aria-label="Open navigation" aria-controls="workspace-navigation" aria-expanded={drawerOpen} onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
            <div className="workspace-breadcrumb" aria-label="Current location"><span className="breadcrumb-group">{group?.title || 'Workspace'}</span><ChevronRight size={13} aria-hidden="true" /><span>{current?.label || 'Page not found'}</span></div>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="topbar-release"
              onClick={onOpenWebMcp}
              aria-label={`Agent tools: ${isAgentToolsActive ? 'Active' : 'Disabled'}`}
              title={`Agent tools are ${isAgentToolsActive ? 'Active' : 'Disabled'} (Click to inspect or toggle)`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: isAgentToolsActive ? 'var(--border)' : 'rgba(255, 255, 255, 0.12)',
                background: isAgentToolsActive ? 'var(--surface-raised)' : 'transparent',
                color: isAgentToolsActive ? 'var(--ink)' : 'var(--muted)'
              }}
            >
              <Bot size={13} color={isAgentToolsActive ? 'var(--accent)' : 'var(--muted)'} />
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 550 }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: isAgentActuating ? 'var(--accent)' : (isAgentToolsActive ? 'var(--success)' : '#718096'),
                    boxShadow: isAgentToolsActive ? '0 0 6px var(--success)' : 'none',
                    display: 'inline-block'
                  }}
                />
                <span>{isAgentActuating ? 'Actuating…' : `Agent tools: ${isAgentToolsActive ? 'Active' : 'Disabled'}`}</span>
              </span>
            </button>
            <button type="button" className="topbar-release" onClick={onChangelog} aria-label={`Version ${APP_VERSION}, view changelog`}>v{APP_VERSION}</button>
            <span className="topbar-divider" aria-hidden="true" />
            <button type="button" className="icon-button" aria-label="Search workspace" title={`Search workspace (${shortcut})`} onClick={onSearch}><Search size={18} /></button>
            <button type="button" className="icon-button" aria-label="Workspace settings" title="Workspace settings" onClick={() => onNavigate('settings')}><Settings size={18} /></button>
          </div>
        </header>
        <main id="main-content" className="content-area" ref={main} tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
