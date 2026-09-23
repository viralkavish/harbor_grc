import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, NAV_SECTIONS } from './navigation';

describe('tofromGRC navigation', () => {
  it('exposes only the core SOC 2 readiness navigation items', () => {
    const expectedIds = ['overview', 'soc2_readiness', 'pilot', 'policies', 'evidence', 'frameworks', 'people', 'activity', 'settings'];
    const actualIds = NAV_ITEMS.map(item => item.id);
    expect(actualIds).toEqual(expectedIds);
    expect(NAV_ITEMS).toHaveLength(9);
    expect(new Set(actualIds).size).toBe(9);

    for (const item of NAV_ITEMS) {
      expect(item.label.trim()).not.toBe('');
      expect(item.description.trim()).not.toBe('');
      expect(item.icon).toBeDefined();
    }
  });
});
