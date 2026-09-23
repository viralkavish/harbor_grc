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
      <div className="harbor-view-modal" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Summary */}
        <div className="view-row"
          style={{
            background: 'linear-gradient(135deg, var(--accent-light) 0%, var(--surface-raised) 100%)',
            border: '1px solid var(--accent)',
            borderRadius: '8px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
                TwoFrom GRC v{APP_VERSION}
              </span>
              <span
                style={{
                  background: 'var(--accent-light)',
                  color: 'var(--accent)',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}
              >
                Current Build
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
              Released on {RELEASE_DATE}
            </p>
          </div>
          <Sparkles size={28} color="var(--accent)" style={{ opacity: 0.8 }} />
        </div>

        {/* Changelog Entries Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {CHANGELOG.map((entry, idx) => (
            <div
              key={entry.version}
              style={{
                position: 'relative',
                paddingLeft: '24px',
                borderLeft: idx === 0 ? '2px solid var(--accent)' : '2px solid var(--border)'
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
                  background: idx === 0 ? 'var(--accent)' : 'var(--muted)',
                  border: '2px solid var(--card-bg)'
                }}
              />

              {/* Version & Date Bar */}
              <div className="view-inline" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>
                  v{entry.version}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: idx === 0 ? 'var(--accent-light)' : 'var(--surface-raised)',
                    color: idx === 0 ? 'var(--accent)' : 'var(--muted)',
                    border: '1px solid ' + (idx === 0 ? 'var(--accent)' : 'var(--border)')
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
