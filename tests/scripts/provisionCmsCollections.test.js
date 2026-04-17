/**
 * provisionCmsCollections.test.js — Tests for CMS collection provisioning script.
 *
 * Covers: manifest validation, collection status checking, provisioning logic,
 * error handling, and field accuracy vs backend module schemas.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

const {
  COLLECTION_MANIFEST,
  ADMIN_ONLY,
  PUBLIC_READ,
  validateManifest,
  getCollectionStatus,
  provisionCollections,
  fetchExistingIds,
  buildHeaders,
} = await import('../../scripts/provisionCmsCollections.js');

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeCollection(overrides = {}) {
  return {
    id: 'Test',
    displayName: 'Test',
    fields: [{ key: 'a', displayName: 'A', type: 'TEXT' }],
    permissions: { ...ADMIN_ONLY },
    ...overrides,
  };
}

function getCollection(id) {
  const c = COLLECTION_MANIFEST.find((m) => m.id === id);
  if (!c) throw new Error(`Collection ${id} not found in manifest`);
  return c;
}

function getFieldKeys(id) {
  return getCollection(id).fields.map((f) => f.key);
}

// ─── Manifest Structure ───────────────────────────────────────────────────────

describe('COLLECTION_MANIFEST', () => {
  it('should contain exactly 23 collections', () => {
    expect(COLLECTION_MANIFEST).toHaveLength(27);
  });

  it('should have unique collection IDs', () => {
    const ids = COLLECTION_MANIFEST.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should include all 16 original Phase 1 collections', () => {
    const ids = COLLECTION_MANIFEST.map((c) => c.id);
    const original = [
      'ContactSubmissions', 'ProductAnalytics', 'Promotions', 'EmailQueue',
      'Unsubscribes', 'AbandonedCarts', 'Fulfillments', 'GiftCards',
      'DeliverySchedule', 'AssemblyGuides', 'FabricSwatches', 'ProductBundles',
      'CustomerEngagement', 'ReviewRequests', 'ReferralCodes', 'Videos',
    ];
    for (const name of original) {
      expect(ids).toContain(name);
    }
  });

  it('should include 5 new critical collections from CF-d5ib', () => {
    const ids = COLLECTION_MANIFEST.map((c) => c.id);
    const critical = [
      'BackInStockSignups', 'InventoryLevels', 'InventoryLog',
      'RecentlyViewed', 'MemberPreferences',
    ];
    for (const name of critical) {
      expect(ids).toContain(name);
    }
  });

  it('should have displayName for every collection', () => {
    for (const c of COLLECTION_MANIFEST) {
      expect(c.displayName).toBeTruthy();
      expect(typeof c.displayName).toBe('string');
    }
  });

  it('should have at least one field per collection', () => {
    for (const c of COLLECTION_MANIFEST) {
      expect(c.fields.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should have valid field types for all fields', () => {
    const validTypes = ['TEXT', 'NUMBER', 'DATETIME', 'BOOLEAN', 'IMAGE', 'URL', 'RICH_TEXT', 'TAGS'];
    for (const c of COLLECTION_MANIFEST) {
      for (const f of c.fields) {
        expect(validTypes).toContain(f.type);
      }
    }
  });

  it('should have key and displayName for every field', () => {
    for (const c of COLLECTION_MANIFEST) {
      for (const f of c.fields) {
        expect(f.key).toBeTruthy();
        expect(f.displayName).toBeTruthy();
      }
    }
  });

  it('should have permissions object for every collection', () => {
    const validPerms = ['ADMIN', 'MEMBER', 'ANYONE'];
    for (const c of COLLECTION_MANIFEST) {
      expect(c.permissions).toBeDefined();
      expect(validPerms).toContain(c.permissions.read);
      expect(validPerms).toContain(c.permissions.insert);
      expect(validPerms).toContain(c.permissions.update);
      expect(validPerms).toContain(c.permissions.remove);
    }
  });
});

// ─── New Collection Field Schemas (CF-d5ib) ───────────────────────────────────

describe('BackInStockSignups collection', () => {
  it('should have correct fields from inventoryService.web.js @setup', () => {
    const keys = getFieldKeys('BackInStockSignups');
    expect(keys).toEqual(expect.arrayContaining([
      'email', 'productId', 'variantId', 'productName',
      'signedUpAt', 'notified', 'notifiedAt',
    ]));
  });

  it('should use correct field types', () => {
    const c = getCollection('BackInStockSignups');
    const fieldMap = Object.fromEntries(c.fields.map((f) => [f.key, f.type]));
    expect(fieldMap.email).toBe('TEXT');
    expect(fieldMap.productId).toBe('TEXT');
    expect(fieldMap.variantId).toBe('TEXT');
    expect(fieldMap.productName).toBe('TEXT');
    expect(fieldMap.signedUpAt).toBe('DATETIME');
    expect(fieldMap.notified).toBe('BOOLEAN');
    expect(fieldMap.notifiedAt).toBe('DATETIME');
  });

  it('should be admin-only (contains PII emails)', () => {
    const c = getCollection('BackInStockSignups');
    expect(c.permissions).toEqual(ADMIN_ONLY);
  });
});

describe('InventoryLevels collection', () => {
  it('should have correct fields from inventoryService.web.js @setup', () => {
    const keys = getFieldKeys('InventoryLevels');
    expect(keys).toEqual(expect.arrayContaining([
      'productId', 'variantId', 'sku', 'productName', 'variantLabel',
      'quantity', 'threshold', 'preOrder', 'lastRestocked', 'updatedAt',
    ]));
  });

  it('should use correct field types', () => {
    const c = getCollection('InventoryLevels');
    const fieldMap = Object.fromEntries(c.fields.map((f) => [f.key, f.type]));
    expect(fieldMap.productId).toBe('TEXT');
    expect(fieldMap.quantity).toBe('NUMBER');
    expect(fieldMap.threshold).toBe('NUMBER');
    expect(fieldMap.preOrder).toBe('BOOLEAN');
    expect(fieldMap.lastRestocked).toBe('DATETIME');
    expect(fieldMap.updatedAt).toBe('DATETIME');
  });

  it('should be admin-only (internal inventory data)', () => {
    const c = getCollection('InventoryLevels');
    expect(c.permissions).toEqual(ADMIN_ONLY);
  });
});

describe('InventoryLog collection', () => {
  it('should have correct fields from inventoryService.web.js @setup', () => {
    const keys = getFieldKeys('InventoryLog');
    expect(keys).toEqual(expect.arrayContaining([
      'productId', 'variantId', 'change', 'reason', 'timestamp',
    ]));
  });

  it('should use correct field types', () => {
    const c = getCollection('InventoryLog');
    const fieldMap = Object.fromEntries(c.fields.map((f) => [f.key, f.type]));
    expect(fieldMap.productId).toBe('TEXT');
    expect(fieldMap.variantId).toBe('TEXT');
    expect(fieldMap.change).toBe('NUMBER');
    expect(fieldMap.reason).toBe('TEXT');
    expect(fieldMap.timestamp).toBe('DATETIME');
  });

  it('should be admin-only (internal audit log)', () => {
    const c = getCollection('InventoryLog');
    expect(c.permissions).toEqual(ADMIN_ONLY);
  });
});

describe('RecentlyViewed collection', () => {
  it('should have correct fields from productRecommendations.web.js @setup', () => {
    const keys = getFieldKeys('RecentlyViewed');
    expect(keys).toEqual(expect.arrayContaining([
      'memberId', 'productId', 'viewedAt',
    ]));
  });

  it('should use correct field types', () => {
    const c = getCollection('RecentlyViewed');
    const fieldMap = Object.fromEntries(c.fields.map((f) => [f.key, f.type]));
    expect(fieldMap.memberId).toBe('TEXT');
    expect(fieldMap.productId).toBe('TEXT');
    expect(fieldMap.viewedAt).toBe('DATETIME');
  });

  it('should be member-insertable (members track their own views)', () => {
    const c = getCollection('RecentlyViewed');
    expect(c.permissions.insert).toBe('MEMBER');
    expect(c.permissions.read).toBe('ADMIN');
  });
});

describe('MemberPreferences collection', () => {
  it('should have correct fields from accountDashboard.web.js @setup', () => {
    const keys = getFieldKeys('MemberPreferences');
    expect(keys).toEqual(expect.arrayContaining([
      'memberId', 'newsletter', 'saleAlerts', 'backInStock', 'updatedAt',
    ]));
  });

  it('should use correct field types', () => {
    const c = getCollection('MemberPreferences');
    const fieldMap = Object.fromEntries(c.fields.map((f) => [f.key, f.type]));
    expect(fieldMap.memberId).toBe('TEXT');
    expect(fieldMap.newsletter).toBe('BOOLEAN');
    expect(fieldMap.saleAlerts).toBe('BOOLEAN');
    expect(fieldMap.backInStock).toBe('BOOLEAN');
    expect(fieldMap.updatedAt).toBe('DATETIME');
  });

  it('should allow member insert/update (members manage own prefs)', () => {
    const c = getCollection('MemberPreferences');
    expect(c.permissions.insert).toBe('MEMBER');
    expect(c.permissions.update).toBe('MEMBER');
    expect(c.permissions.read).toBe('ADMIN');
    expect(c.permissions.remove).toBe('ADMIN');
  });
});

// ─── Permission Constants ─────────────────────────────────────────────────────

describe('permission constants', () => {
  it('ADMIN_ONLY should restrict all operations to ADMIN', () => {
    expect(ADMIN_ONLY).toEqual({ read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' });
  });

  it('PUBLIC_READ should allow ANYONE to read, ADMIN for write ops', () => {
    expect(PUBLIC_READ).toEqual({ read: 'ANYONE', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' });
  });
});

// ─── buildHeaders ─────────────────────────────────────────────────────────────

describe('buildHeaders', () => {
  it('should return correct Authorization and wix-site-id headers', () => {
    const headers = buildHeaders('mykey', 'mysite');
    expect(headers.Authorization).toBe('mykey');
    expect(headers['wix-site-id']).toBe('mysite');
    expect(headers['Content-Type']).toBe('application/json');
  });
});

// ─── Manifest Validation ──────────────────────────────────────────────────────

describe('validateManifest', () => {
  it('should pass for the built-in manifest', () => {
    const result = validateManifest(COLLECTION_MANIFEST);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when a collection has no id', () => {
    const result = validateManifest([makeCollection({ id: undefined })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('missing id'))).toBe(true);
  });

  it('should fail when a collection has no fields', () => {
    const result = validateManifest([makeCollection({ fields: [] })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('no fields'))).toBe(true);
  });

  it('should fail on duplicate collection IDs', () => {
    const result = validateManifest([
      makeCollection({ id: 'Dup', displayName: 'Dup 1' }),
      makeCollection({ id: 'Dup', displayName: 'Dup 2' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('should fail when a field has an invalid type', () => {
    const result = validateManifest([makeCollection({ fields: [{ key: 'a', displayName: 'A', type: 'INVALID' }] })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('invalid type'))).toBe(true);
  });

  it('should fail when a field is missing key', () => {
    const result = validateManifest([makeCollection({ fields: [{ displayName: 'A', type: 'TEXT' }] })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('missing key'))).toBe(true);
  });

  it('should fail when permissions are missing', () => {
    const result = validateManifest([makeCollection({ permissions: undefined })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('permissions'))).toBe(true);
  });

  it('should fail when a permission value is invalid', () => {
    const result = validateManifest([makeCollection({
      permissions: { read: 'EVERYONE', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
    })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('invalid permission read=EVERYONE'))).toBe(true);
  });

  it('should fail on duplicate field keys within a collection', () => {
    const result = validateManifest([makeCollection({
      fields: [
        { key: 'dup', displayName: 'A', type: 'TEXT' },
        { key: 'dup', displayName: 'B', type: 'NUMBER' },
      ],
    })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate field'))).toBe(true);
  });

  it('should pass for empty array input', () => {
    const result = validateManifest([]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── fetchExistingIds ─────────────────────────────────────────────────────────

describe('fetchExistingIds', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return a Set of collection IDs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ dataCollections: [{ id: 'A' }, { id: 'B' }] })),
    }));
    const ids = await fetchExistingIds(buildHeaders('k', 's'));
    expect(ids).toBeInstanceOf(Set);
    expect(ids.has('A')).toBe(true);
    expect(ids.has('B')).toBe(true);
  });

  it('should throw on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    }));
    await expect(fetchExistingIds(buildHeaders('k', 's'))).rejects.toThrow('Failed to list collections (401)');
  });

  it('should throw on non-JSON response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html>Rate limited</html>'),
    }));
    await expect(fetchExistingIds(buildHeaders('k', 's'))).rejects.toThrow('non-JSON response');
  });

  it('should throw when dataCollections key is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ collections: [] })),
    }));
    await expect(fetchExistingIds(buildHeaders('k', 's'))).rejects.toThrow('missing "dataCollections" key');
  });
});

// ─── getCollectionStatus ──────────────────────────────────────────────────────

describe('getCollectionStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return status array matching manifest length', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ dataCollections: [] })),
    }));
    const status = await getCollectionStatus({ apiKey: 'test', siteId: 'test' });
    expect(status).toHaveLength(COLLECTION_MANIFEST.length);
  });

  it('should mark existing collections as exists=true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        dataCollections: [{ id: 'ContactSubmissions' }, { id: 'GiftCards' }, { id: 'BackInStockSignups' }],
      })),
    }));
    const status = await getCollectionStatus({ apiKey: 'test', siteId: 'test' });
    expect(status.find((s) => s.id === 'ContactSubmissions').exists).toBe(true);
    expect(status.find((s) => s.id === 'GiftCards').exists).toBe(true);
    expect(status.find((s) => s.id === 'BackInStockSignups').exists).toBe(true);
    expect(status.find((s) => s.id === 'EmailQueue').exists).toBe(false);
  });

  it('should throw when apiKey or siteId is missing', async () => {
    await expect(getCollectionStatus({ apiKey: '', siteId: 'test' })).rejects.toThrow('requires apiKey and siteId');
  });
});

// ─── provisionCollections ─────────────────────────────────────────────────────

describe('provisionCollections', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockListResponse(existingIds = []) {
    return {
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        dataCollections: existingIds.map((id) => ({ id })),
      })),
    };
  }

  function mockCreateSuccess() {
    return {
      ok: true,
      json: () => Promise.resolve({ collection: { id: 'created' } }),
    };
  }

  it('should skip already-existing collections', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockListResponse(COLLECTION_MANIFEST.map((c) => c.id)),
    );
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test' });
    expect(results.every((r) => r.status === 'EXISTS')).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should create all 23 missing collections', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockListResponse([]))
      .mockResolvedValue(mockCreateSuccess());
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test' });
    expect(results.filter((r) => r.status === 'CREATED')).toHaveLength(27);
    expect(mockFetch).toHaveBeenCalledTimes(28); // 1 list + 27 creates
  });

  it('should respect dryRun flag', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(mockListResponse([]));
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test', dryRun: true });
    expect(results.every((r) => r.status === 'WOULD_CREATE')).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should report errors for failed creates without stopping', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockListResponse([]))
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Internal Server Error') })
      .mockResolvedValue(mockCreateSuccess());
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test' });
    expect(results.filter((r) => r.status === 'ERROR')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'CREATED')).toHaveLength(26);
  });

  it('should handle mixed existing and missing collections', async () => {
    const existingIds = COLLECTION_MANIFEST.slice(0, 10).map((c) => c.id);
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockListResponse(existingIds))
      .mockResolvedValue(mockCreateSuccess());
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test' });
    expect(results.filter((r) => r.status === 'EXISTS')).toHaveLength(10);
    expect(results.filter((r) => r.status === 'CREATED')).toHaveLength(17);
    expect(results).toHaveLength(27);
  });

  it('should throw when apiKey or siteId is missing', async () => {
    await expect(provisionCollections({ apiKey: '', siteId: 'test' })).rejects.toThrow('requires apiKey and siteId');
  });
});

// ─── Collection-Specific Field Validation ─────────────────────────────────────

describe('collection field accuracy vs backend module schemas', () => {
  const fieldTypeChecks = [
    // Original Phase 1
    ['ContactSubmissions', 'message', 'RICH_TEXT'],
    ['ProductAnalytics', 'viewCount', 'NUMBER'],
    ['ProductAnalytics', 'addToCartCount', 'NUMBER'],
    ['Promotions', 'isActive', 'BOOLEAN'],
    ['Promotions', 'heroImage', 'IMAGE'],
    ['EmailQueue', 'sequenceStep', 'NUMBER'],
    ['EmailQueue', 'scheduledFor', 'DATETIME'],
    ['GiftCards', 'balance', 'NUMBER'],
    ['GiftCards', 'expirationDate', 'DATETIME'],
    ['AbandonedCarts', 'cartTotal', 'NUMBER'],
    ['AbandonedCarts', 'recoveryEmailSent', 'BOOLEAN'],
    ['Videos', 'url', 'URL'],
    ['Videos', 'isFeatured', 'BOOLEAN'],
    // New CF-d5ib collections
    ['BackInStockSignups', 'email', 'TEXT'],
    ['BackInStockSignups', 'notified', 'BOOLEAN'],
    ['BackInStockSignups', 'signedUpAt', 'DATETIME'],
    ['BackInStockSignups', 'notifiedAt', 'DATETIME'],
    ['InventoryLevels', 'quantity', 'NUMBER'],
    ['InventoryLevels', 'threshold', 'NUMBER'],
    ['InventoryLevels', 'preOrder', 'BOOLEAN'],
    ['InventoryLevels', 'lastRestocked', 'DATETIME'],
    ['InventoryLevels', 'updatedAt', 'DATETIME'],
    ['InventoryLog', 'change', 'NUMBER'],
    ['InventoryLog', 'timestamp', 'DATETIME'],
    ['RecentlyViewed', 'memberId', 'TEXT'],
    ['RecentlyViewed', 'viewedAt', 'DATETIME'],
    ['MemberPreferences', 'newsletter', 'BOOLEAN'],
    ['MemberPreferences', 'saleAlerts', 'BOOLEAN'],
    ['MemberPreferences', 'backInStock', 'BOOLEAN'],
    ['MemberPreferences', 'updatedAt', 'DATETIME'],
  ];

  it.each(fieldTypeChecks)('%s.%s should be %s', (collId, fieldKey, expectedType) => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === collId);
    expect(c).toBeDefined();
    const f = c.fields.find((field) => field.key === fieldKey);
    expect(f).toBeDefined();
    expect(f.type).toBe(expectedType);
  });
});
