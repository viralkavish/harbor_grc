import {it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {Dialog} from './Dialog';
it('opens an accessible dialog, contains keyboard focus and dismisses with Escape', () => {
 const close=vi.fn();
 render(<Dialog title="New control" onClose={close}><input aria-label="Control title"/><button>Save</button></Dialog>);
 const dialog=screen.getByRole('dialog', {name:'New control'});
 expect(dialog).toHaveAttribute('aria-modal','true');
 const last=screen.getByRole('button',{name:'Save'});
 last.focus();
 fireEvent.keyDown(last,{key:'Tab'});
 expect(screen.getByRole('button',{name:'Close dialog'})).toHaveFocus();
 fireEvent.keyDown(dialog,{key:'Escape'});
 expect(close).toHaveBeenCalledOnce();
});
