/**
 * provisionCmsCollections.test.js — Tests for CMS collection provisioning script.
 *
 * TDD: Tests written BEFORE implementation per PM directive.
 * Covers: manifest validation, collection status checking, provisioning logic,
 * error handling, CLI argument parsing, and edge cases.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Will be implemented in scripts/provisionCmsCollections.js
const {
  COLLECTION_MANIFEST,
  validateManifest,
  getCollectionStatus,
  provisionCollections,
} = await import('../scripts/provisionCmsCollections.js');

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
      'ContactSubmissions',
      'ProductAnalytics',
      'Promotions',
      'EmailQueue',
      'Unsubscribes',
      'AbandonedCarts',
      'Fulfillments',
      'GiftCards',
      'DeliverySchedule',
      'AssemblyGuides',
      'FabricSwatches',
      'ProductBundles',
      'CustomerEngagement',
      'ReviewRequests',
      'ReferralCodes',
      'Videos',
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
    const validTypes = [
      'TEXT',
      'NUMBER',
      'DATETIME',
      'BOOLEAN',
      'IMAGE',
      'URL',
      'RICH_TEXT',
      'TAGS',
    ];
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
        expect(typeof f.key).toBe('string');
        expect(f.displayName).toBeTruthy();
        expect(typeof f.displayName).toBe('string');
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

  it('should set ContactSubmissions permissions to allow ANYONE to insert (form submissions)', () => {
    const cs = COLLECTION_MANIFEST.find((c) => c.id === 'ContactSubmissions');
    expect(cs.permissions.insert).toBe('ANYONE');
    expect(cs.permissions.read).toBe('ADMIN');
  });

  it('should set most collections to ADMIN insert/update/remove with ADMIN read', () => {
    const adminOnly = ['ProductAnalytics', 'EmailQueue', 'Fulfillments', 'GiftCards'];
    for (const name of adminOnly) {
      const c = COLLECTION_MANIFEST.find((m) => m.id === name);
      expect(c.permissions.insert).toBe('ADMIN');
      expect(c.permissions.update).toBe('ADMIN');
      expect(c.permissions.remove).toBe('ADMIN');
    }
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
    const bad = [{ displayName: 'Test', fields: [{ key: 'a', displayName: 'A', type: 'TEXT' }], permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' } }];
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('missing id'))).toBe(true);
  });

  it('should fail when a collection has no fields', () => {
    const bad = [{ id: 'Test', displayName: 'Test', fields: [], permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' } }];
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('no fields'))).toBe(true);
  });

  it('should fail on duplicate collection IDs', () => {
    const bad = [
      { id: 'Dup', displayName: 'Dup 1', fields: [{ key: 'a', displayName: 'A', type: 'TEXT' }], permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' } },
      { id: 'Dup', displayName: 'Dup 2', fields: [{ key: 'b', displayName: 'B', type: 'TEXT' }], permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' } },
    ];
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('should fail when a field has an invalid type', () => {
    const bad = [{ id: 'Test', displayName: 'Test', fields: [{ key: 'a', displayName: 'A', type: 'INVALID' }], permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' } }];
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('invalid type'))).toBe(true);
  });

  it('should fail when a field is missing key', () => {
    const bad = [{ id: 'Test', displayName: 'Test', fields: [{ displayName: 'A', type: 'TEXT' }], permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' } }];
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('missing key'))).toBe(true);
  });

  it('should fail when permissions are missing', () => {
    const bad = [{ id: 'Test', displayName: 'Test', fields: [{ key: 'a', displayName: 'A', type: 'TEXT' }] }];
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('permissions'))).toBe(true);
  });

  it('should fail on duplicate field keys within a collection', () => {
    const bad = [{
      id: 'Test', displayName: 'Test',
      fields: [
        { key: 'dup', displayName: 'A', type: 'TEXT' },
        { key: 'dup', displayName: 'B', type: 'NUMBER' },
      ],
      permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
    }];
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate field'))).toBe(true);
  });

  it('should warn on missing displayName for a field', () => {
    const input = [{ id: 'Test', displayName: 'Test', fields: [{ key: 'a', type: 'TEXT' }], permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' } }];
    const result = validateManifest(input);
    expect(result.warnings.some((w) => w.includes('displayName'))).toBe(true);
  });
});

// ─── getCollectionStatus ──────────────────────────────────────────────────────

describe('getCollectionStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return status array matching manifest length', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ dataCollections: [] }),
    }));

    const status = await getCollectionStatus({ apiKey: 'test', siteId: 'test' });
    expect(status).toHaveLength(COLLECTION_MANIFEST.length);
  });

  it('should mark existing collections as exists=true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        dataCollections: [{ id: 'ContactSubmissions' }, { id: 'GiftCards' }],
      }),
    }));

    const status = await getCollectionStatus({ apiKey: 'test', siteId: 'test' });
    const cs = status.find((s) => s.id === 'ContactSubmissions');
    const gc = status.find((s) => s.id === 'GiftCards');
    const eq = status.find((s) => s.id === 'EmailQueue');

    expect(cs.exists).toBe(true);
    expect(gc.exists).toBe(true);
    expect(eq.exists).toBe(false);
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

  it('should handle empty dataCollections response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));

    const status = await getCollectionStatus({ apiKey: 'test', siteId: 'test' });
    expect(status.every((s) => s.exists === false)).toBe(true);
  });
});

// ─── provisionCollections ─────────────────────────────────────────────────────

describe('provisionCollections', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should skip already-existing collections', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          dataCollections: COLLECTION_MANIFEST.map((c) => ({ id: c.id })),
        }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test' });
    expect(results.every((r) => r.status === 'EXISTS')).toBe(true);
    // Should only call fetch once (the list call), no creates
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should create missing collections', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ dataCollections: [] }),
      })
      // Each create call succeeds
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ collection: { id: 'created' } }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test' });
    const created = results.filter((r) => r.status === 'CREATED');
    expect(created).toHaveLength(16);
    // 1 list + 16 creates
    expect(mockFetch).toHaveBeenCalledTimes(17);
  });

  it('should respect dryRun flag', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ dataCollections: [] }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test', dryRun: true });
    expect(results.every((r) => r.status === 'WOULD_CREATE')).toBe(true);
    // Only the list call, no creates
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should report errors for failed creates without stopping', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ dataCollections: [] }),
      })
      // First create fails
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })
      // Rest succeed
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ collection: { id: 'ok' } }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const { results } = await provisionCollections({ apiKey: 'test', siteId: 'test' });
    const errors = results.filter((r) => r.status === 'ERROR');
    const created = results.filter((r) => r.status === 'CREATED');
    expect(errors).toHaveLength(1);
    expect(created).toHaveLength(15);
  });

  it('should send correct request body structure to Wix API', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          dataCollections: COLLECTION_MANIFEST.slice(1).map((c) => ({ id: c.id })),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ collection: { id: 'ContactSubmissions' } }),
      });
    vi.stubGlobal('fetch', mockFetch);

    await provisionCollections({ apiKey: 'mykey', siteId: 'mysite' });

    // Second call is the create for ContactSubmissions
    const createCall = mockFetch.mock.calls[1];
    expect(createCall[0]).toBe('https://www.wixapis.com/wix-data/v2/collections');
    expect(createCall[1].method).toBe('POST');

    const headers = createCall[1].headers;
    expect(headers.Authorization).toBe('mykey');
    expect(headers['wix-site-id']).toBe('mysite');

    const body = JSON.parse(createCall[1].body);
    expect(body.collection).toBeDefined();
    expect(body.collection.id).toBe('ContactSubmissions');
    expect(body.collection.displayName).toBeTruthy();
    expect(Array.isArray(body.collection.fields)).toBe(true);
    expect(body.collection.permissions).toBeDefined();
  });

  it('should handle network errors gracefully', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ dataCollections: [] }),
      })
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ collection: { id: 'ok' } }),
      });
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
});

// ─── Collection-Specific Field Validation ─────────────────────────────────────

describe('collection field accuracy vs MASTER-HOOKUP.md', () => {
  it('ContactSubmissions should have email, name, phone, subject, message, submittedAt, status, source, notes, productId, productName fields', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'ContactSubmissions');
    const keys = c.fields.map((f) => f.key);
    expect(keys).toContain('email');
    expect(keys).toContain('name');
    expect(keys).toContain('phone');
    expect(keys).toContain('subject');
    expect(keys).toContain('message');
    expect(keys).toContain('submittedAt');
    expect(keys).toContain('status');
    expect(keys).toContain('source');
    expect(keys).toContain('notes');
    expect(keys).toContain('productId');
    expect(keys).toContain('productName');
  });

  it('ContactSubmissions message field should be RICH_TEXT', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'ContactSubmissions');
    const msg = c.fields.find((f) => f.key === 'message');
    expect(msg.type).toBe('RICH_TEXT');
  });

  it('ProductAnalytics should have numeric fields for counts', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'ProductAnalytics');
    const viewCount = c.fields.find((f) => f.key === 'viewCount');
    const addToCartCount = c.fields.find((f) => f.key === 'addToCartCount');
    const purchaseCount = c.fields.find((f) => f.key === 'purchaseCount');
    expect(viewCount.type).toBe('NUMBER');
    expect(addToCartCount.type).toBe('NUMBER');
    expect(purchaseCount.type).toBe('NUMBER');
  });

  it('Promotions should have isActive as BOOLEAN and dates as DATETIME', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'Promotions');
    expect(c.fields.find((f) => f.key === 'isActive').type).toBe('BOOLEAN');
    expect(c.fields.find((f) => f.key === 'startDate').type).toBe('DATETIME');
    expect(c.fields.find((f) => f.key === 'endDate').type).toBe('DATETIME');
  });

  it('Promotions should have heroImage as IMAGE', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'Promotions');
    expect(c.fields.find((f) => f.key === 'heroImage').type).toBe('IMAGE');
  });

  it('EmailQueue should have step as NUMBER and scheduledFor as DATETIME', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'EmailQueue');
    expect(c.fields.find((f) => f.key === 'step').type).toBe('NUMBER');
    expect(c.fields.find((f) => f.key === 'scheduledFor').type).toBe('DATETIME');
    expect(c.fields.find((f) => f.key === 'variables').type).toBe('RICH_TEXT');
  });

  it('GiftCards should have balance and originalBalance as NUMBER', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'GiftCards');
    expect(c.fields.find((f) => f.key === 'balance').type).toBe('NUMBER');
    expect(c.fields.find((f) => f.key === 'originalBalance').type).toBe('NUMBER');
    expect(c.fields.find((f) => f.key === 'expirationDate').type).toBe('DATETIME');
  });

  it('FabricSwatches should have swatchImage as IMAGE and sortOrder as NUMBER', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'FabricSwatches');
    expect(c.fields.find((f) => f.key === 'swatchImage').type).toBe('IMAGE');
    expect(c.fields.find((f) => f.key === 'sortOrder').type).toBe('NUMBER');
  });

  it('DeliverySchedule date field should be DATETIME', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'DeliverySchedule');
    expect(c.fields.find((f) => f.key === 'date').type).toBe('DATETIME');
  });

  it('Videos should have url as URL and viewCount as NUMBER', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'Videos');
    expect(c.fields.find((f) => f.key === 'url').type).toBe('URL');
    expect(c.fields.find((f) => f.key === 'viewCount').type).toBe('NUMBER');
    expect(c.fields.find((f) => f.key === 'isFeatured').type).toBe('BOOLEAN');
  });

  it('AbandonedCarts should have cartTotal as NUMBER and recoveryEmailSent as BOOLEAN', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'AbandonedCarts');
    expect(c.fields.find((f) => f.key === 'cartTotal').type).toBe('NUMBER');
    expect(c.fields.find((f) => f.key === 'recoveryEmailSent').type).toBe('BOOLEAN');
    expect(c.fields.find((f) => f.key === 'abandonedAt').type).toBe('DATETIME');
  });

  it('AssemblyGuides should have instructions as RICH_TEXT and videoUrl as URL', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'AssemblyGuides');
    expect(c.fields.find((f) => f.key === 'instructions').type).toBe('RICH_TEXT');
    expect(c.fields.find((f) => f.key === 'videoUrl').type).toBe('URL');
  });

  it('CustomerEngagement should have timestamp as DATETIME', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'CustomerEngagement');
    expect(c.fields.find((f) => f.key === 'timestamp').type).toBe('DATETIME');
  });

  it('ReferralCodes should have referrerCredit and friendDiscount as NUMBER', () => {
    const c = COLLECTION_MANIFEST.find((m) => m.id === 'ReferralCodes');
    expect(c.fields.find((f) => f.key === 'referrerCredit').type).toBe('NUMBER');
    expect(c.fields.find((f) => f.key === 'friendDiscount').type).toBe('NUMBER');
  });
});
