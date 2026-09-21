import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from './App';
import { api } from './lib/api';

vi.mock('./lib/api', () => ({ api: { bootstrap: vi.fn(), get: vi.fn() } }));
vi.mock('./views/OverviewView', () => ({ OverviewView: () => <h1>Overview content</h1> }));
vi.mock('./views/PoliciesView', () => ({ PoliciesView: () => <h1>Policies content</h1> }));

beforeEach(() => {
  window.location.hash = '#overview';
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockImplementation(() => ({
    matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) });
  vi.mocked(api.bootstrap).mockResolvedValue({
    workspace: { name: 'Harbor workspace', organization: 'Test Organization' }, counts: {},
  } as any);
  vi.mocked(api.get).mockResolvedValue({ resources: {} });
});

it('opens a labeled mobile navigation drawer and closes it with Escape, restoring focus', async () => {
  render(<App />);
  const open = await screen.findByRole('button', { name: 'Open navigation' });
  expect(open).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(open);
  const drawer = screen.getByRole('dialog', { name: 'Workspace navigation' });
  expect(open).toHaveAttribute('aria-expanded', 'true');
  const close = within(drawer).getByRole('button', { name: 'Close navigation' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Workspace navigation' })).not.toBeInTheDocument();
  expect(open).toHaveFocus();
});
