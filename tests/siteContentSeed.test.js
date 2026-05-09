// cf-atze (cfw-66o.6) — verify the SiteContent seeder is idempotent and
// touches only missing keys, so a re-run never clobbers Brenda's edits.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __seed,
  __reset as resetData,
  __onInsert,
} from './__mocks__/wix-data.js';

import {
  SITE_CONTENT_SEED,
  _internal,
} from '../src/backend/siteContentSeed.web.js';

beforeEach(() => {
  resetData();
});

describe('SITE_CONTENT_SEED static shape', () => {
  it('has at least 20 rows (cfw-66o.6 acceptance: ~20 entries)', () => {
    expect(SITE_CONTENT_SEED.length).toBeGreaterThanOrEqual(20);
  });

  it('every row has key, value, and description fields', () => {
    for (const row of SITE_CONTENT_SEED) {
      expect(typeof row.key).toBe('string');
      expect(row.key.length).toBeGreaterThan(0);
      expect(typeof row.value).toBe('string');
      expect(typeof row.description).toBe('string');
      expect(row.description.length).toBeGreaterThan(0);
    }
  });

  it('keys are unique', () => {
    const keys = SITE_CONTENT_SEED.map((r) => r.key);
    const uniq = new Set(keys);
    expect(uniq.size).toBe(keys.length);
  });

  it('covers the cfw call sites the reader is wired against', () => {
    const keys = new Set(SITE_CONTENT_SEED.map((r) => r.key));
    expect(keys.has('footer.tagline')).toBe(true);
    expect(keys.has('hero.headline')).toBe(true);
    expect(keys.has('visit.hours.sun-tue')).toBe(true);
    expect(keys.has('visit.hours.wed-sat')).toBe(true);
    expect(keys.has('announcement.rotation.1.message')).toBe(true);
  });
});

describe('_seedSiteContent idempotency', () => {
  it('inserts every row when the collection is empty', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('SiteContent', []);

    const result = await _internal._seedSiteContent();

    expect(result.inserted).toBe(SITE_CONTENT_SEED.length);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
    expect(inserted).toHaveLength(SITE_CONTENT_SEED.length);
    expect(inserted.every((r) => r.col === 'SiteContent')).toBe(true);
  });

  it('skips keys that already exist (preserves Brenda edits)', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('SiteContent', [
      {
        _id: 'existing-1',
        key: 'footer.tagline',
        value: 'Brenda hand-edited this',
        description: 'edited',
      },
      {
        _id: 'existing-2',
        key: 'hero.headline',
        value: 'Custom headline',
        description: 'edited',
      },
    ]);

    const result = await _internal._seedSiteContent();

    expect(result.skipped).toBe(2);
    expect(result.inserted).toBe(SITE_CONTENT_SEED.length - 2);
    // Inserted keys should NOT include the two existing ones
    const insertedKeys = inserted.map((r) => r.item.key);
    expect(insertedKeys).not.toContain('footer.tagline');
    expect(insertedKeys).not.toContain('hero.headline');
  });

  it('continues seeding when individual rows throw (per-row error isolation)', async () => {
    const insertCount = { n: 0 };
    __onInsert(() => {
      insertCount.n += 1;
      // Throw on the third insert; the rest should still go through.
      if (insertCount.n === 3) throw new Error('simulated row failure');
    });
    __seed('SiteContent', []);

    const result = await _internal._seedSiteContent();

    expect(result.errors).toBe(1);
    expect(result.inserted).toBe(SITE_CONTENT_SEED.length - 1);
  });

  it('stamps an updatedAt timestamp on every inserted row', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push(item));
    __seed('SiteContent', []);

    await _internal._seedSiteContent();

    for (const row of inserted) {
      expect(row.updatedAt).toBeInstanceOf(Date);
    }
  });

  it('preserves seed key + value + description on the inserted row', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push(item));
    __seed('SiteContent', []);

    await _internal._seedSiteContent();

    const tagline = inserted.find((r) => r.key === 'footer.tagline');
    expect(tagline).toBeDefined();
    expect(tagline.value).toBe('Quality futons since 1991');
    expect(tagline.description).toContain('footer');
  });
});
