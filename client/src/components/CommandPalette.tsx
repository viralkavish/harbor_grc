import { useEffect, useState, useRef } from 'react';
import { Search, FileText, Shield, AlertTriangle, Users, Database, CheckSquare, Layers, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Navigate } from '../lib/types';

const RESOURCE_ICONS: Record<string, any> = {
  frameworks: Layers,
  controls: Shield,
  policies: FileText,
  risks: AlertTriangle,
  people: Users,
  vendors: Database,
  tasks: CheckSquare
};

export function CommandPalette({ isOpen, onClose, onNavigate }: { isOpen: boolean; onClose: () => void; onNavigate: Navigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      api.get(`/search?q=${encodeURIComponent(query)}`)
        .then(res => {
          setResults(res.results || []);
          setSelectedIndex(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1 < results.length ? i + 1 : i));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i > 0 ? i - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        const item = results[selectedIndex];
        onNavigate(item.resource, item.id);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={18} color="var(--muted)" />
          <input
            ref={inputRef}
            className="command-search-input"
            style={{ border: 'none' }}
            placeholder="Search all controls, policies, vendors, risks (or jump to record)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="icon-button" onClick={onClose} aria-label="Close search">
            <X size={18} />
          </button>
        </div>

        <div className="command-results">
          {loading && <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)' }}>Searching workspace…</div>}
          {!loading && query && results.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
              No records found matching "{query}"
            </div>
          )}
          {!query && (
            <div style={{ padding: '16px 20px', fontSize: '12px', color: 'var(--muted)' }}>
              Type to search across all frameworks, controls, policies, vendors, risks, evidence, and personnel records.
            </div>
          )}
          {results.map((item, idx) => {
            const Icon = RESOURCE_ICONS[item.resource] || Shield;
            return (
              <div
                key={`${item.resource}-${item.id}`}
                className={`command-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onNavigate(item.resource, item.id);
                  onClose();
                }}
              >
                <Icon size={16} color="var(--accent)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </div>
                  {item.snippet && (
                    <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.snippet}
                    </div>
                  )}
                </div>
                <span className="command-item-badge">{item.resource}</span>
                {item.status && <span className="command-item-badge">{item.status}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
