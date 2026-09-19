import {useEffect, useId, useRef} from 'react';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';

export function Dialog({title, children, onClose, wide, subtitle}: {title: string; children: ReactNode; onClose: () => void; wide?: boolean; subtitle?: string}) {
  const heading = useId();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input, textarea, button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')];
      if (dialogs.at(-1) !== ref.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key === 'Tab' && ref.current) {
        const elements = [...ref.current.querySelectorAll<HTMLElement>('*')].filter(el => el.matches('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') && !el.closest('[hidden]'));
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && (document.activeElement === first || !ref.current.contains(document.activeElement))) {event.preventDefault(); last?.focus();}
        else if (!event.shiftKey && (document.activeElement === last || !ref.current.contains(document.activeElement))) {event.preventDefault(); first?.focus();}
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = oldOverflow; previouslyFocused?.focus(); };
  }, []);
  return createPortal(<div className="modal-backdrop"><div className={`dialog ${wide ? 'dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={heading} ref={ref} tabIndex={-1}>
    <header className="dialog-header"><div><h2 id={heading}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19}/></button></header>
    {children}
  </div></div>, document.body);
}
