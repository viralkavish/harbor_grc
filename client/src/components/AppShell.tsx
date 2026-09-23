import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, History, Menu, Search, Settings, Shield, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Navigate, Workspace } from '../lib/types';
import { APP_VERSION } from '../version';

type Section = { title: string; items: { id: string; label: string; icon: LucideIcon }[] };

type Props = {
  workspace: Workspace;
  sections: Section[];
  activeView: string;
  onNavigate: Navigate;
  onSearch: () => void;
  onChangelog: () => void;
  children: ReactNode;
};

export function AppShell({ workspace, sections, activeView, onNavigate, onSearch, onChangelog, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const main = useRef<HTMLElement>(null);
  const drawerOpen = isMobile && menuOpen;
  const current = sections.flatMap(section => section.items).find(item => item.id === activeView);
  const group = sections.find(section => section.items.some(item => item.id === activeView));
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

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
          <div className="brand-copy">
            <span className="brand-title">TwoFrom<span className="brand-grc">GRC</span></span>
            <span className="brand-subtitle">SOC 2 Type II Workspace</span>
          </div>
          {isMobile && <button type="button" className="icon-button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={20} /></button>}
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
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                    aria-current={activeView === item.id ? 'page' : undefined}
                    onClick={() => { setMenuOpen(false); onNavigate(item.id); }}
                  >
                    <Icon size={16} aria-hidden="true" /><span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <footer className="sidebar-footer">
          <div className="workspace-identity">
            <span className="workspace-avatar" aria-hidden="true">
              {(workspace.organization || workspace.name || 'T').slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{workspace.organization || 'TwoFrom'}</strong>
              <small>{workspace.name}</small>
            </span>
          </div>
          <button type="button" className="release-link" onClick={() => { setMenuOpen(false); onChangelog(); }}>
            <span className="mono">v{APP_VERSION}</span>
            <span>What’s new <History size={13} aria-hidden="true" /></span>
          </button>
        </footer>
      </aside>
      <div className="main-wrapper" inert={drawerOpen}>
        <header className="topbar">
          <div className="topbar-context">
            <button ref={menuButton} type="button" className="icon-button mobile-toggle" aria-label="Open navigation" aria-controls="workspace-navigation" aria-expanded={drawerOpen} onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
            <div className="workspace-breadcrumb" aria-label="Current location">
              <span className="breadcrumb-group">{group?.title || 'TwoFrom'}</span>
              <ChevronRight size={13} aria-hidden="true" />
              <span>{current?.label || 'Overview'}</span>
            </div>
          </div>
          <div className="topbar-actions">
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
