import {useEffect, useId, useRef, useState} from 'react';
import type {KeyboardEvent} from 'react';
import {Search, FileText, X} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {api} from '../lib/api';
import {NAV_ITEMS} from '../lib/navigation';
import type {Navigate} from '../lib/types';
import './command-palette.css';

interface SearchRecord {
  resource: string;
  id: string;
  title: string;
  snippet?: string;
  status?: string;
}

interface PaletteOption {
  key: string;
  resource: string;
  recordId?: string;
  title: string;
  description: string;
  icon: LucideIcon;
  kind: 'page' | 'record';
  badge: string;
  status?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: Navigate;
}

const RECOMMENDED_PAGES = ['overview', 'roadmap', 'tasks', 'soc2_readiness', 'controls', 'evidence'];

export function CommandPalette({isOpen, onClose, onNavigate}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const term = query.trim();
  const pages: PaletteOption[] = NAV_ITEMS.filter(item => term
    ? `${item.label} ${item.id} ${item.id.replaceAll('_', ' ')} ${item.description}`.toLowerCase().includes(term.toLowerCase())
    : RECOMMENDED_PAGES.includes(item.id)).map(item => ({
    key: `page:${item.id}`, resource: item.id, title: item.label, description: item.description,
    icon: item.icon, kind: 'page', badge: 'Page',
  }));
  const records: PaletteOption[] = results.map(item => ({
    key: `record:${item.resource}:${item.id}`, resource: item.resource, recordId: item.id,
    title: item.title, description: item.snippet || '', kind: 'record',
    icon: NAV_ITEMS.find(page => page.id === item.resource)?.icon || FileText,
    badge: NAV_ITEMS.find(page => page.id === item.resource)?.label || item.resource.replaceAll('_', ' '),
    status: item.status,
  }));
  const options = [...pages, ...records];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!term) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      api.get<{results: SearchRecord[]}>(`/search?q=${encodeURIComponent(term)}`)
        .then(res => {
          setResults(res.results || []);
          setSelectedIndex(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(timer);
  }, [term]);

  const select = (option: PaletteOption) => {
    if (option.kind === 'page') onNavigate(option.resource);
    else onNavigate(option.resource, option.recordId);
    onClose();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
    else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex(index => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (options[selectedIndex]) select(options[selectedIndex]);
    }
  };

  const renderOption = (option: PaletteOption, index: number) => {
    const Icon = option.icon;
    return (
      <div key={option.key} id={`${id}-opt-${index}`} role="option" aria-selected={index === selectedIndex}
        className={`command-item ${index === selectedIndex ? 'command-item-selected' : ''}`}
        onClick={() => select(option)}>
        <Icon className="command-item-icon" size={18} aria-hidden="true" />
        <div className="command-item-copy">
          <div className="command-item-title">{option.title}</div>
          {option.description && <div className="command-item-description">{option.description}</div>}
        </div>
        <span className="command-item-badge">{option.badge}</span>
        {option.status && <span className="command-item-badge command-item-status">{option.status}</span>}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
        onClick={event => event.stopPropagation()} onKeyDown={handleKeyDown}>
        <h2 id={`${id}-title`} className="command-sr-only">Search workspace</h2>
        <div className="command-search-row">
          <Search className="command-search-icon" size={20} aria-hidden="true" />
          <input ref={inputRef} className="command-search-input" role="combobox" aria-label="Search pages and records"
            aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-results`}
            aria-activedescendant={options[selectedIndex] ? `${id}-opt-${selectedIndex}` : undefined}
            autoComplete="off" spellCheck={false} placeholder="Jump to a page or find a record…"
            value={query} onChange={event => { setQuery(event.target.value); setSelectedIndex(0); }} />
          <button type="button" className="command-close" onClick={onClose} aria-label="Close search">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="command-results" id={`${id}-results`} role="listbox" aria-label="Search results">
          {pages.length > 0 && <div role="group" aria-labelledby={`${id}-pages`}>
            <div className="command-section-label" id={`${id}-pages`}>{term ? 'Pages' : 'Jump to a page'}</div>
            {pages.map(renderOption)}
          </div>}
          {records.length > 0 && <div role="group" aria-labelledby={`${id}-records`}>
            <div className="command-section-label" id={`${id}-records`}>Records</div>
            {records.map((option, index) => renderOption(option, pages.length + index))}
          </div>}
        </div>
        {loading && <div className="command-message" role="status">Searching records…</div>}
        {!loading && term && options.length === 0 && <div className="command-message">No records found for “{term}”. Try another search.</div>}
        {!term && <p className="command-hint">Jump to a page, or type to search pages and workspace records.</p>}
        <div className="command-footer" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
