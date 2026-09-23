import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { NAV_ITEMS } from '../lib/navigation';
import { CommandPalette } from './CommandPalette';

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({ results: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('CommandPalette', () => {
  it('keeps focus in the combobox while arrows announce and Enter opens the selected page', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} onNavigate={onNavigate} />);
    const input = screen.getByRole('combobox');
    const options = screen.getAllByRole('option');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(screen.getAllByRole('option', { selected: true })).toHaveLength(1);
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('soc2_readiness');
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.change(input, { target: { value: 'settings' } });
    const settings = screen.getByRole('option', { name: /Settings/ });
    expect(input).toHaveAttribute('aria-activedescendant', settings.id);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenLastCalledWith('settings');
  });

  it('finds every TwoFrom page immediately by label, route or description without waiting for records', () => {
    vi.useFakeTimers();
    render(<CommandPalette isOpen onClose={vi.fn()} onNavigate={vi.fn()} />);
    const input = screen.getByRole('combobox');
    for (const item of NAV_ITEMS) {
      fireEvent.change(input, { target: { value: item.label.toUpperCase() } });
      expect(within(screen.getByRole('group', { name: 'Pages' })).getByRole('option', { name: new RegExp(item.label) })).toBeVisible();
      fireEvent.change(input, { target: { value: item.id } });
      expect(within(screen.getByRole('group', { name: 'Pages' })).getByRole('option', { name: new RegExp(item.label) })).toBeVisible();
    }
    fireEvent.change(input, { target: { value: ' policies ' } });
    expect(screen.getByRole('option', { name: /Policies/ })).toBeVisible();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('offers recommended page jumps in a labeled dialog before typing', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} onNavigate={onNavigate} />);

    const dialog = screen.getByRole('dialog', { name: 'Search workspace' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const input = within(dialog).getByRole('combobox', { name: 'Search pages and records' });
    const listbox = within(dialog).getByRole('listbox', { name: 'Search results' });
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const pages = within(listbox).getByRole('group', { name: 'Jump to a page' });
    expect(within(pages).getByRole('option', { name: /Overview/ })).toBeVisible();
    fireEvent.click(within(pages).getByRole('option', { name: /SOC 2 Readiness/ }));
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('soc2_readiness');
    expect(onClose).toHaveBeenCalledOnce();
    expect(api.get).not.toHaveBeenCalled();
  });
});
