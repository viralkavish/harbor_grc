import React from 'react';
import { Sparkles, Calendar, Tag, CheckCircle2, History, X } from 'lucide-react';
import { Dialog } from './Dialog';
import { APP_VERSION, RELEASE_DATE, CHANGELOG } from '../version';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog onClose={onClose} title="System Version & Changelog" wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Summary */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(15, 23, 42, 0.05) 100%)',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            borderRadius: '8px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
                Harbor GRC v{APP_VERSION}
              </span>
              <span
                style={{
                  background: '#2563eb',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}
              >
                Production Active
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
              Released on {RELEASE_DATE} • Build verified against SOC 2, ISO 27001 & AICPA standards
            </p>
          </div>
          <Sparkles size={28} color="#2563eb" style={{ opacity: 0.8 }} />
        </div>

        {/* Changelog Entries Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {CHANGELOG.map((entry, idx) => (
            <div
              key={entry.version}
              style={{
                position: 'relative',
                paddingLeft: '24px',
                borderLeft: idx === 0 ? '2px solid #2563eb' : '2px solid var(--border)'
              }}
            >
              {/* Timeline Bullet */}
              <div
                style={{
                  position: 'absolute',
                  left: '-7px',
                  top: '0px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: idx === 0 ? '#2563eb' : 'var(--muted)',
                  border: '2px solid white'
                }}
              />

              {/* Version & Date Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>
                  v{entry.version}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: idx === 0 ? 'rgba(37, 99, 235, 0.1)' : 'var(--panel-bg)',
                    color: idx === 0 ? '#2563eb' : 'var(--muted)',
                    border: '1px solid ' + (idx === 0 ? 'rgba(37, 99, 235, 0.2)' : 'var(--border)')
                  }}
                >
                  {entry.badge}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> {entry.date}
                </span>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginBottom: '10px' }}>
                {entry.title}
              </div>

              {/* Highlights List */}
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                {entry.highlights.map((item, hIdx) => (
                  <li key={hIdx} style={{ color: 'var(--ink)' }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="dialog-footer">
          <button type="button" className="button button-primary" onClick={onClose}>
            Close Changelog
          </button>
        </div>
      </div>
    </Dialog>
  );
}
