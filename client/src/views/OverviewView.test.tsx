import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../lib/api';
import { OverviewView } from './OverviewView';

function makeDashboard() {
  return {
    counts: { controls: 4, risks: 3, tasks: 2, evidence: 2, policies: 1, vendors: 1 },
    readiness: { implemented: 3, total: 4, percent: 75 },
    framework_readiness: [
      { id: 'fw-soc2', title: 'SOC 2', code: 'SOC2', implemented: 3, total: 4, percent: 75 },
      { id: 'fw-iso', title: 'ISO 27001', code: 'ISO', implemented: 0, total: 0, percent: 0 },
    ],
    open_risks: 2,
    high_risks: 1,
    overdue_tasks: 2,
    expiring_evidence: 1,
    attention: [
      { resource: 'controls', id: 'ctl-owner', title: 'Assign an access owner', reason: 'Control has no assigned owner', severity: 'low' },
      { resource: 'tasks', id: 'task-mfa', title: 'Require administrator MFA', reason: 'Task overdue since 2026-09-01', severity: 'high' },
      { resource: 'evidence', id: 'ev-report', title: 'Refresh penetration test report', reason: 'Evidence expires on 2026-09-30', severity: 'medium' },
    ],
    upcoming_reviews: [
      { resource: 'policies', id: 'policy-access', title: 'Access policy', date: '2026-09-28' },
      { resource: 'vendors', id: 'vendor-host', title: 'Hosting provider (Renewal)', date: '2026-10-02' },
    ],
    risk_matrix: Array.from({ length: 25 }, (_, index) => ({
      likelihood: Math.floor(index / 5) + 1,
      impact: index % 5 + 1,
      count: index === 22 ? 2 : index === 11 ? 1 : 0,
    })),
    activity: [],
  };
}

function renderOverview() {
  const onNavigate = vi.fn();
  const notify = vi.fn();
  render(<OverviewView onNavigate={onNavigate} notify={notify} />);
  return { onNavigate, notify, user: userEvent.setup() };
}

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue(makeDashboard());
  vi.spyOn(api, 'post').mockResolvedValue({ checks: [{ finding_count: 2 }, { finding_count: 1 }] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OverviewView', () => {
  it('provides four metric drilldowns and direct destinations for ongoing work', async () => {
    const { onNavigate, user } = renderOverview();
    const metrics = await screen.findByRole('group', { name: 'Program metrics' });
    expect(within(metrics).getAllByRole('button')).toHaveLength(4);
    for (const [name, resource] of [
      [/Control readiness.*75%.*3 of 4 applicable controls/i, 'controls'],
      [/Open risks.*2.*1 with score ≥ 12/i, 'risks'],
      [/Overdue tasks.*2/i, 'tasks'],
      [/Evidence due.*1.*Within 30 days or past due/i, 'evidence'],
    ] as const) {
      await user.click(within(metrics).getByRole('button', { name }));
      expect(onNavigate).toHaveBeenLastCalledWith(resource);
    }
    const shortcuts = screen.getByRole('navigation', { name: 'Continue work' });
    for (const [name, resource] of [['Roadmap', 'roadmap'], ['Policies', 'policies'], ['Evidence', 'evidence']]) {
      await user.click(within(shortcuts).getByRole('button', { name }));
      expect(onNavigate).toHaveBeenLastCalledWith(resource);
    }
    await user.click(screen.getByRole('button', { name: 'View checks' }));
    expect(onNavigate).toHaveBeenLastCalledWith('monitoring');
  });

  it('puts actionable attention first without inflating the recorded severity', async () => {
    const { onNavigate, user } = renderOverview();
    const queue = await screen.findByRole('region', { name: 'Needs attention' });
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('Needs attention');
    const rows = within(queue).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Require administrator MFA');
    expect(within(rows[0]).getByText('High')).toBeInTheDocument();
    expect(within(queue).queryByText('Critical')).not.toBeInTheDocument();
    expect(within(rows[2]).getByText('Low')).toBeInTheDocument();
    await user.click(within(rows[0]).getByRole('button'));
    expect(onNavigate).toHaveBeenLastCalledWith('tasks', 'task-mfa');
    const ownerAction = within(rows[2]).getByRole('button');
    ownerAction.focus();
    await user.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenLastCalledWith('controls', 'ctl-owner');
    expect(api.get).toHaveBeenCalledWith('/dashboard');
  });
});
