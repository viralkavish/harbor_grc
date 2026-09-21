import {describe, expect, it} from 'vitest';
import {NAV_ITEMS, NAV_SECTIONS} from './navigation';

describe('shared navigation', () => {
  it('preserves every route once in the agreed discoverable groups', () => {
    const groups = [
      {title: 'Workspace', ids: ['overview', 'roadmap', 'tasks']},
      {title: 'Compliance', ids: ['soc2_readiness', 'frameworks', 'controls', 'policies', 'evidence', 'system_description']},
      {title: 'Security', ids: ['tests', 'monitoring', 'risks', 'exceptions']},
      {title: 'Organization', ids: ['people', 'assets', 'vendors', 'access_reviews']},
      {title: 'Share & manage', ids: ['audits', 'questionnaires', 'trust', 'integrations', 'activity', 'settings']},
    ];
    expect(NAV_SECTIONS.map(section => ({title: section.title, ids: section.items.map(item => item.id)}))).toEqual(groups);
    expect(NAV_ITEMS).toEqual(NAV_SECTIONS.flatMap(section => section.items));
    expect(NAV_ITEMS).toHaveLength(23);
    expect(new Set(NAV_ITEMS.map(item => item.id)).size).toBe(23);
    for (const item of NAV_ITEMS) {
      expect(item.label.trim()).not.toBe('');
      expect(item.description.trim()).not.toBe('');
      expect(item.icon).toBeDefined();
    }
    expect(Object.fromEntries(NAV_ITEMS.map(item => [item.id, item.label]))).toMatchObject({
      overview: 'Overview', roadmap: 'SOC 2 roadmap', soc2_readiness: 'Readiness',
      tests: 'Continuous tests', monitoring: 'Monitoring', system_description: 'System description',
    });
  });
});
