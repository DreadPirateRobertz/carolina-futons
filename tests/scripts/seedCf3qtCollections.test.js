/**
 * seedCf3qtCollections.test.js — Tests for the cf-3qt Phase 4/5 seed script.
 *
 * Covers: manifest shape, idempotent skipping on existing rows, dry-run mode,
 * error handling, and that all four collections (Landings, PressMentions,
 * PressKitAssets, ComparisonFeatures) are represented.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

const {
  SEED_MANIFEST,
  LANDINGS_SEED,
  PRESS_MENTIONS_SEED,
  PRESS_KIT_ASSETS_SEED,
  COMPARISON_FEATURES_SEED,
  fetchExistingKeys,
  getSeedStatus,
  seedCollections,
} = await import('../../scripts/seedCf3qtCollections.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockQueryResponse(keys, uniqueKey) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        dataItems: keys.map((k) => ({ data: { [uniqueKey]: k } })),
      }),
  };
}

function mockQueryFailure(status = 500, text = 'Internal Error') {
  return { ok: false, status, text: () => Promise.resolve(text) };
}

function mockInsertSuccess() {
  return { ok: true, json: () => Promise.resolve({ dataItem: { _id: 'row-1' } }) };
}

function mockInsertFailure(status = 500, text = 'Server Error') {
  return { ok: false, status, text: () => Promise.resolve(text) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Manifest structure ───────────────────────────────────────────────────────

describe('SEED_MANIFEST', () => {
  it('covers all four cf-3qt collections', () => {
    const collections = SEED_MANIFEST.map((e) => e.collection);
    expect(collections).toContain('Landings');
    expect(collections).toContain('PressMentions');
    expect(collections).toContain('PressKitAssets');
    expect(collections).toContain('ComparisonFeatures');
  });

  it('declares the correct uniqueKey for each collection', () => {
    const byName = Object.fromEntries(SEED_MANIFEST.map((e) => [e.collection, e]));
    expect(byName.Landings.uniqueKey).toBe('slug');
    expect(byName.PressMentions.uniqueKey).toBe('articleUrl');
    expect(byName.PressKitAssets.uniqueKey).toBe('fileUrl');
    expect(byName.ComparisonFeatures.uniqueKey).toBe('featureKey');
  });

  it('has unique keys within each collection', () => {
    for (const entry of SEED_MANIFEST) {
      const keys = entry.rows.map((r) => r[entry.uniqueKey]);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('seeds exactly two Landings rows (spring-sale, winback)', () => {
    expect(LANDINGS_SEED).toHaveLength(2);
    expect(LANDINGS_SEED.map((r) => r.slug).sort()).toEqual(['spring-sale', 'winback']);
  });

  it('seeds exactly three PressMentions rows with distinct outlets', () => {
    expect(PRESS_MENTIONS_SEED).toHaveLength(3);
    const outlets = new Set(PRESS_MENTIONS_SEED.map((r) => r.outlet));
    expect(outlets.size).toBe(3);
  });

  it('seeds exactly one PressKitAssets row (primary logo)', () => {
    expect(PRESS_KIT_ASSETS_SEED).toHaveLength(1);
    expect(PRESS_KIT_ASSETS_SEED[0].category).toBe('logo');
  });

  it('seeds exactly twenty ComparisonFeatures rows spanning multiple buckets', () => {
    expect(COMPARISON_FEATURES_SEED).toHaveLength(20);
    const categories = new Set(COMPARISON_FEATURES_SEED.map((r) => r.category));
    expect(categories.size).toBeGreaterThanOrEqual(4);
  });

  it('every row declares a non-empty value for its uniqueKey', () => {
    for (const entry of SEED_MANIFEST) {
      for (const row of entry.rows) {
        expect(typeof row[entry.uniqueKey]).toBe('string');
        expect(row[entry.uniqueKey].length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── fetchExistingKeys ────────────────────────────────────────────────────────

describe('fetchExistingKeys', () => {
  it('returns a Set of unique-key values from the query response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockQueryResponse(['a', 'b'], 'slug'));
    vi.stubGlobal('fetch', mockFetch);

    const keys = await fetchExistingKeys({ collection: 'Landings', uniqueKey: 'slug', headers: {} });
    expect(keys).toBeInstanceOf(Set);
    expect(keys.has('a')).toBe(true);
    expect(keys.has('b')).toBe(true);
  });

  it('throws when the query API returns a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockQueryFailure(403, 'Forbidden')));
    await expect(
      fetchExistingKeys({ collection: 'Landings', uniqueKey: 'slug', headers: {} }),
    ).rejects.toThrow(/Failed to query Landings.*403/);
  });

  it('returns an empty Set when no items are returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockQueryResponse([], 'slug')));
    const keys = await fetchExistingKeys({ collection: 'Landings', uniqueKey: 'slug', headers: {} });
    expect(keys.size).toBe(0);
  });
});

// ─── getSeedStatus ────────────────────────────────────────────────────────────

describe('getSeedStatus', () => {
  it('reports exists:true for rows already present', async () => {
    const mockFetch = vi.fn()
      // Query order matches SEED_MANIFEST: Landings, PressMentions, PressKitAssets, ComparisonFeatures.
      .mockResolvedValueOnce(mockQueryResponse(['spring-sale'], 'slug'))
      .mockResolvedValueOnce(mockQueryResponse([], 'articleUrl'))
      .mockResolvedValueOnce(mockQueryResponse([], 'fileUrl'))
      .mockResolvedValueOnce(mockQueryResponse([], 'featureKey'));
    vi.stubGlobal('fetch', mockFetch);

    const status = await getSeedStatus({ apiKey: 'k', siteId: 's' });
    const springSale = status.find((r) => r.rowKey === 'spring-sale');
    expect(springSale.exists).toBe(true);

    const missing = status.find((r) => r.rowKey === 'winback');
    expect(missing.exists).toBe(false);
  });

  it('throws if apiKey or siteId are missing', async () => {
    await expect(getSeedStatus({ apiKey: '', siteId: 's' })).rejects.toThrow(/apiKey and siteId/);
  });
});

// ─── seedCollections ──────────────────────────────────────────────────────────

describe('seedCollections', () => {
  it('inserts missing rows and skips existing ones', async () => {
    const mockFetch = vi.fn()
      // Landings query → 'spring-sale' already exists
      .mockResolvedValueOnce(mockQueryResponse(['spring-sale'], 'slug'))
      // Landings insert: winback
      .mockResolvedValueOnce(mockInsertSuccess())
      // PressMentions query → empty
      .mockResolvedValueOnce(mockQueryResponse([], 'articleUrl'))
      // PressMentions inserts (3)
      .mockResolvedValueOnce(mockInsertSuccess())
      .mockResolvedValueOnce(mockInsertSuccess())
      .mockResolvedValueOnce(mockInsertSuccess())
      // PressKitAssets query → empty
      .mockResolvedValueOnce(mockQueryResponse([], 'fileUrl'))
      // PressKitAssets insert (1)
      .mockResolvedValueOnce(mockInsertSuccess())
      // ComparisonFeatures query → empty
      .mockResolvedValueOnce(mockQueryResponse([], 'featureKey'))
      // ComparisonFeatures inserts (20, matched by the terminal mockResolvedValue)
      .mockResolvedValue(mockInsertSuccess());
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await seedCollections({ apiKey: 'k', siteId: 's' });

    const springSale = results.find((r) => r.rowKey === 'spring-sale');
    expect(springSale.status).toBe('EXISTS');

    const winback = results.find((r) => r.rowKey === 'winback');
    expect(winback.status).toBe('INSERTED');

    const everyCompFeature = results.filter((r) => r.collection === 'ComparisonFeatures');
    expect(everyCompFeature).toHaveLength(COMPARISON_FEATURES_SEED.length);
    expect(everyCompFeature.every((r) => r.status === 'INSERTED')).toBe(true);

    const pressMentions = results.filter((r) => r.collection === 'PressMentions');
    expect(pressMentions).toHaveLength(PRESS_MENTIONS_SEED.length);
    expect(pressMentions.every((r) => r.status === 'INSERTED')).toBe(true);

    const pressKit = results.filter((r) => r.collection === 'PressKitAssets');
    expect(pressKit).toHaveLength(PRESS_KIT_ASSETS_SEED.length);
    expect(pressKit.every((r) => r.status === 'INSERTED')).toBe(true);
  });

  it('dry-run mode never calls the insert endpoint', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockQueryResponse([], 'slug'))
      .mockResolvedValueOnce(mockQueryResponse([], 'articleUrl'))
      .mockResolvedValueOnce(mockQueryResponse([], 'fileUrl'))
      .mockResolvedValueOnce(mockQueryResponse([], 'featureKey'));
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await seedCollections({ apiKey: 'k', siteId: 's', dryRun: true });
    expect(results.every((r) => r.status === 'WOULD_INSERT')).toBe(true);
    // Exactly 4 fetches: one query per collection in SEED_MANIFEST.
    expect(mockFetch).toHaveBeenCalledTimes(SEED_MANIFEST.length);
  });

  it('captures individual insert errors without stopping', async () => {
    const mockFetch = vi.fn()
      // Landings: query empty, first insert fails, second succeeds
      .mockResolvedValueOnce(mockQueryResponse([], 'slug'))
      .mockResolvedValueOnce(mockInsertFailure(500, 'Boom'))
      .mockResolvedValueOnce(mockInsertSuccess())
      // PressMentions: query empty, all 3 inserts succeed
      .mockResolvedValueOnce(mockQueryResponse([], 'articleUrl'))
      .mockResolvedValueOnce(mockInsertSuccess())
      .mockResolvedValueOnce(mockInsertSuccess())
      .mockResolvedValueOnce(mockInsertSuccess())
      // PressKitAssets: query empty, insert succeeds
      .mockResolvedValueOnce(mockQueryResponse([], 'fileUrl'))
      .mockResolvedValueOnce(mockInsertSuccess())
      // ComparisonFeatures: query empty, all inserts succeed (terminal fallback)
      .mockResolvedValueOnce(mockQueryResponse([], 'featureKey'))
      .mockResolvedValue(mockInsertSuccess());
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await seedCollections({ apiKey: 'k', siteId: 's' });
    const errors = results.filter((r) => r.status === 'ERROR');
    expect(errors).toHaveLength(1);
    expect(errors[0].detail).toMatch(/500.*Boom/);

    const totalRows =
      LANDINGS_SEED.length +
      PRESS_MENTIONS_SEED.length +
      PRESS_KIT_ASSETS_SEED.length +
      COMPARISON_FEATURES_SEED.length;
    const inserted = results.filter((r) => r.status === 'INSERTED');
    expect(inserted.length).toBe(totalRows - 1);
  });

  it('throws if apiKey or siteId are missing', async () => {
    await expect(seedCollections({ apiKey: 'k', siteId: '' })).rejects.toThrow(/apiKey and siteId/);
  });
});
