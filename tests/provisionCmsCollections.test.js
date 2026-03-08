/**
 * provisionCmsCollections.test.js — Tests for CMS collection provisioning script.
 *
 * Covers: manifest validation, collection status checking, provisioning logic,
 * error handling, and field accuracy vs MASTER-HOOKUP.md.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  COLLECTION_MANIFEST,
  ADMIN_ONLY,
  PUBLIC_READ,
  validateManifest,
  getCollectionStatus,
  provisionCollections,
  fetchExistingIds,
  buildHeaders,
} = await import('../scripts/provisionCmsCollections.js');

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

// ─── Manifest Structure ───────────────────────────────────────────────────────

describe('COLLECTION_MANIFEST', () => {
  it('should contain exactly 16 collections', () => {
    expect(COLLECTION_MANIFEST).toHaveLength(16);
  });

  it('should have unique collection IDs', () => {
    const ids = COLLECTION_MANIFEST.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should include all 16 required collections from MASTER-HOOKUP.md Step 4', () => {
    const ids = COLLECTION_MANIFEST.map((c) => c.id);
    const required = [
      'ContactSubmissions', 'ProductAnalytics', 'Promotions', 'EmailQueue',
      'Unsubscribes', 'AbandonedCarts', 'Fulfillments', 'GiftCards',
      'DeliverySchedule', 'AssemblyGuides', 'FabricSwatches', 'ProductBundles',
      'CustomerEngagement', 'ReviewRequests', 'ReferralCodes', 'Videos',
    ];
    for (const name of required) {
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

  it('should set ContactSubmissions to ANYONE insert and ADMIN read', () => {
    const cs = COLLECTION_MANIFEST.find((c) => c.id === 'ContactSubmissions');
    expect(cs.permissions.insert).toBe('ANYONE');
    expect(cs.permissions.read).toBe('ADMIN');
  });

  it('should set admin-only collections to ADMIN for all operations', () => {
    const adminOnly = ['ProductAnalytics', 'EmailQueue', 'Fulfillments', 'GiftCards'];
    for (const name of adminOnly) {
      const c = COLLECTION_MANIFEST.find((m) => m.id === name);
      expect(c.permissions.read).toBe('ADMIN');
      expect(c.permissions.insert).toBe('ADMIN');
      expect(c.permissions.update).toBe('ADMIN');
      expect(c.permissions.remove).toBe('ADMIN');
    }
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

  it('should fail when fields is not an array', () => {
    const result = validateManifest([makeCollection({ fields: null })]);
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

  it('should warn on missing displayName for a field', () => {
    const result = validateManifest([makeCollection({ fields: [{ key: 'a', type: 'TEXT' }] })]);
    expect(result.warnings.some((w) => w.includes('displayName'))).toBe(true);
  });

  it('should warn on missing collection displayName', () => {
    const result = validateManifest([makeCollection({ displayName: undefined })]);
    expect(result.warnings.some((w) => w.includes('missing displayName'))).toBe(true);
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
        dataCollections: [{ id: 'ContactSubmissions' }, { id: 'GiftCards' }],
      })),
    }));
    const status = await getCollectionStatus({ apiKey: 'test', siteId: 'test' });
    expect(status.find((s) => s.id === 'ContactSubmissions').exists).toBe(true);
    expect(status.find((s) => s.id === 'GiftCards').exists).toBe(true);
    expect(status.find((s) => s.id === 'EmailQueue').exists).toBe(false);
  });

  it('should throw on API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    }));
    await expect(
      getCollectionStatus({ apiKey: 'bad', siteId: 'test' }),
    ).rejects.toThrow('Failed to list collections (401)');
  });

  it('should throw when apiKey or siteId is missing', async () => {
    await expect(getCollectionStatus({ apiKey: '', siteId: 'test' })).rejects.toThrow('requires apiKey and siteId');
    await expect(getCollectionStatus({ apiKey: 'test', siteId: '' })).rejects.toThrow('requires apiKey and siteId');
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

  it('should create missing collections', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockListResponse([]))
      .mockResolvedValue(mockCreateSuccess());
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test' });
    expect(results.filter((r) => r.status === 'CREATED')).toHaveLength(16);
    expect(mockFetch).toHaveBeenCalledTimes(17); // 1 list + 16 creates
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
    expect(results.filter((r) => r.status === 'CREATED')).toHaveLength(15);
  });

  it('should send correct request body structure to Wix API', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockListResponse(COLLECTION_MANIFEST.slice(1).map((c) => c.id)))
      .mockResolvedValueOnce(mockCreateSuccess());
    vi.stubGlobal('fetch', mockFetch);

    await provisionCollections({ apiKey: 'mykey', siteId: 'mysite' });

    const createCall = mockFetch.mock.calls[1];
    expect(createCall[0]).toBe('https://www.wixapis.com/wix-data/v2/collections');
    expect(createCall[1].method).toBe('POST');
    expect(createCall[1].headers.Authorization).toBe('mykey');
    expect(createCall[1].headers['wix-site-id']).toBe('mysite');

    const body = JSON.parse(createCall[1].body);
    expect(body.collection).toBeDefined();
    expect(body.collection.id).toBe('ContactSubmissions');
    expect(body.collection.displayName).toBeTruthy();
    expect(Array.isArray(body.collection.fields)).toBe(true);
    expect(body.collection.permissions).toBeDefined();
  });

  it('should include error constructor name in error detail', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockListResponse([]))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue(mockCreateSuccess());
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test' });
    const errors = results.filter((r) => r.status === 'ERROR');
    expect(errors).toHaveLength(1);
    expect(errors[0].detail).toContain('TypeError');
    expect(errors[0].detail).toContain('fetch failed');
  });

  it('should handle network errors gracefully', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockListResponse([]))
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValue(mockCreateSuccess());
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test' });
    const errors = results.filter((r) => r.status === 'ERROR');
    expect(errors).toHaveLength(1);
    expect(errors[0].detail).toContain('Network timeout');
  });

  it('should handle list API failure by throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    }));
    await expect(
      provisionCollections({ apiKey: 'test', siteId: 'test' }),
    ).rejects.toThrow('Failed to list collections (403)');
  });

  it('should throw when apiKey or siteId is missing', async () => {
    await expect(provisionCollections({ apiKey: '', siteId: 'test' })).rejects.toThrow('requires apiKey and siteId');
  });

  it('should handle mixed existing and missing collections', async () => {
    const existingIds = COLLECTION_MANIFEST.slice(0, 8).map((c) => c.id);
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockListResponse(existingIds))
      .mockResolvedValue(mockCreateSuccess());
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test' });
    expect(results.filter((r) => r.status === 'EXISTS')).toHaveLength(8);
    expect(results.filter((r) => r.status === 'CREATED')).toHaveLength(8);
    expect(results).toHaveLength(16);
  });

  it('should guard res.text() failure in error path', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockListResponse([]))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error('stream consumed')),
      })
      .mockResolvedValue(mockCreateSuccess());
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test' });
    const errors = results.filter((r) => r.status === 'ERROR');
    expect(errors).toHaveLength(1);
    expect(errors[0].detail).toContain('(response body unreadable)');
  });
});

// ─── Collection-Specific Field Validation ─────────────────────────────────────

describe('collection field accuracy vs MASTER-HOOKUP.md', () => {
  const fieldTypeChecks = [
    ['ContactSubmissions', 'message', 'RICH_TEXT'],
    ['ProductAnalytics', 'viewCount', 'NUMBER'],
    ['ProductAnalytics', 'addToCartCount', 'NUMBER'],
    ['ProductAnalytics', 'purchaseCount', 'NUMBER'],
    ['Promotions', 'isActive', 'BOOLEAN'],
    ['Promotions', 'startDate', 'DATETIME'],
    ['Promotions', 'endDate', 'DATETIME'],
    ['Promotions', 'heroImage', 'IMAGE'],
    ['EmailQueue', 'sequenceStep', 'NUMBER'],
    ['EmailQueue', 'scheduledFor', 'DATETIME'],
    ['EmailQueue', 'variables', 'RICH_TEXT'],
    ['EmailQueue', 'attempt', 'NUMBER'],
    ['EmailQueue', 'recipientContactId', 'TEXT'],
    ['EmailQueue', 'lastError', 'TEXT'],
    ['EmailQueue', 'abVariant', 'TEXT'],
    ['EmailQueue', 'createdAt', 'DATETIME'],
    ['GiftCards', 'balance', 'NUMBER'],
    ['GiftCards', 'originalBalance', 'NUMBER'],
    ['GiftCards', 'expirationDate', 'DATETIME'],
    ['FabricSwatches', 'swatchImage', 'IMAGE'],
    ['FabricSwatches', 'sortOrder', 'NUMBER'],
    ['DeliverySchedule', 'date', 'DATETIME'],
    ['Videos', 'url', 'URL'],
    ['Videos', 'viewCount', 'NUMBER'],
    ['Videos', 'isFeatured', 'BOOLEAN'],
    ['AbandonedCarts', 'cartTotal', 'NUMBER'],
    ['AbandonedCarts', 'recoveryEmailSent', 'BOOLEAN'],
    ['AbandonedCarts', 'abandonedAt', 'DATETIME'],
    ['AbandonedCarts', 'buyerName', 'TEXT'],
    ['AbandonedCarts', 'lineItems', 'RICH_TEXT'],
    ['AbandonedCarts', 'recoveryEmailSentAt', 'DATETIME'],
    ['Fulfillments', 'orderNumber', 'TEXT'],
    ['Fulfillments', 'serviceCode', 'TEXT'],
    ['Fulfillments', 'serviceName', 'TEXT'],
    ['Fulfillments', 'shippingCost', 'NUMBER'],
    ['Fulfillments', 'recipientName', 'TEXT'],
    ['Promotions', 'ctaUrl', 'URL'],
    ['Videos', 'thumbnailUrl', 'URL'],
    ['AssemblyGuides', 'instructions', 'RICH_TEXT'],
    ['AssemblyGuides', 'videoUrl', 'URL'],
    ['CustomerEngagement', 'timestamp', 'DATETIME'],
    ['ReferralCodes', 'referrerCredit', 'NUMBER'],
    ['ReferralCodes', 'friendDiscount', 'NUMBER'],
  ];

  it.each(fieldTypeChecks)('%s.%s should be %s', (collId, fieldKey, expectedType) => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === collId);
    expect(c).toBeDefined();
    const f = c.fields.find((field) => field.key === fieldKey);
    expect(f).toBeDefined();
    expect(f.type).toBe(expectedType);
  });

  it('ContactSubmissions should have all required fields', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'ContactSubmissions');
    const keys = c.fields.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining([
      'email', 'name', 'phone', 'subject', 'message',
      'submittedAt', 'status', 'source', 'notes', 'productId', 'productName',
    ]));
  });
});
