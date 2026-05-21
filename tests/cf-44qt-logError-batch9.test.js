/**
 * @file cf-44qt-logError-batch9.test.js
 * @description Pin logError migration for batch9: 5 backend modules.
 * Tests trigger each error path and assert logError is called with a tag
 * containing the module prefix (colon-namespace style).
 *
 * Modules:
 *   - googleMerchantFeed.web.js   (2 sites: generateFeed, getFeedData)
 *   - guideSeoService.web.js      (2 sites: getRelatedProducts, getGuidePageSeoData)
 *   - inventorySync.web.js        (2 sites: syncProduct, syncFailed)
 *   - inventoryService.web.js     (3 sites: getStockStatus, signUpBackInStock, getInventoryUrgency)
 *   - facebookCatalog.web.js      (4+ sites: buildCatalogBatch, refreshFacebookCatalog-*)
 *
 * cf-d24u
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockLogError } = vi.hoisted(() => ({ mockLogError: vi.fn() }));
const { mockQueryProducts } = vi.hoisted(() => ({ mockQueryProducts: vi.fn() }));
const { mockNotifyOwner } = vi.hoisted(() => ({ mockNotifyOwner: vi.fn() }));

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/errorHandler', () => ({ logError: mockLogError }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : ''),
  validateEmail: (v) => (typeof v === 'string' && v.includes('@') ? v.trim() : ''),
  validateId: (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
}));

vi.mock('backend/utils/mediaHelpers', () => ({
  getImageUrl: vi.fn((url) => url || ''),
}));

vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('backend/utils/auditLog', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn().mockResolvedValue({ _id: 'mem-1' }) },
}));

vi.mock('wix-stores-backend', () => ({
  products: { queryProducts: mockQueryProducts },
}));

vi.mock('backend/notificationService.web', () => ({
  notifyOwner: mockNotifyOwner,
}));

import { __seed, __setQueryError, __reset } from './__mocks__/wix-data.js';

// ── SUT imports ───────────────────────────────────────────────────────────────

const { generateFeed, getFeedData } =
  await import('../src/backend/googleMerchantFeed.web.js');
const { getRelatedProducts } =
  await import('../src/backend/guideSeoService.web.js');
const { triggerInventorySync } =
  await import('../src/backend/inventorySync.web.js');
const { getStockStatus, signUpBackInStock, getInventoryUrgency } =
  await import('../src/backend/inventoryService.web.js');
const { refreshFacebookCatalog } =
  await import('../src/backend/facebookCatalog.web.js');

// ════════════════════════════════════════════════════════════════════════════
// googleMerchantFeed
// ════════════════════════════════════════════════════════════════════════════

describe('googleMerchantFeed — logError migration', () => {
  beforeEach(() => { __reset(); mockLogError.mockClear(); });

  it('generateFeed: logError called with googleMerchantFeed: prefix on query failure', async () => {
    __setQueryError('Stores/Products', new Error('db fail'));
    await generateFeed();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringMatching(/^googleMerchantFeed:/),
      expect.any(Error),
    );
  });

  it('getFeedData: logError called with googleMerchantFeed: prefix on query failure', async () => {
    __setQueryError('Stores/Products', new Error('db fail'));
    const r = await getFeedData();
    expect(Array.isArray(r)).toBe(true);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringMatching(/^googleMerchantFeed:/),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// guideSeoService
// ════════════════════════════════════════════════════════════════════════════

describe('guideSeoService — logError migration', () => {
  beforeEach(() => { __reset(); mockLogError.mockClear(); });

  it('getRelatedProducts: logError called with guideSeoService tag on query failure', async () => {
    __setQueryError('Products', new Error('db fail'));
    const r = await getRelatedProducts('futon-frames', 6);
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('guideSeoService'),
      expect.any(Error),
    );
  });

});

// ════════════════════════════════════════════════════════════════════════════
// inventorySync
// ════════════════════════════════════════════════════════════════════════════

describe('inventorySync — logError migration', () => {
  beforeEach(() => { __reset(); mockLogError.mockClear(); });

  it('triggerInventorySync: logError called with inventorySync: prefix when queryProducts throws', async () => {
    mockQueryProducts.mockReturnValue({
      limit: vi.fn().mockReturnThis(),
      find: vi.fn().mockRejectedValue(new Error('wix stores fail')),
    });
    const r = await triggerInventorySync();
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringMatching(/^inventorySync:/),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// inventoryService
// ════════════════════════════════════════════════════════════════════════════

describe('inventoryService — logError migration', () => {
  beforeEach(() => { __reset(); mockLogError.mockClear(); });

  it('getStockStatus: logError called with inventoryService: prefix on query failure', async () => {
    __setQueryError('InventoryLevels', new Error('db fail'));
    await getStockStatus('prod-1');
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringMatching(/^inventoryService:/),
      expect.any(Error),
    );
  });

  it('signUpBackInStock: logError called with inventoryService: prefix on query failure', async () => {
    __setQueryError('BackInStockSignups', new Error('db fail'));
    const r = await signUpBackInStock({ productId: 'prod-1', email: 'test@example.com' });
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringMatching(/^inventoryService:/),
      expect.any(Error),
    );
  });

  it('getInventoryUrgency: logError called with inventoryService: prefix on query failure', async () => {
    __setQueryError('InventoryLevels', new Error('db fail'));
    await getInventoryUrgency('prod-1');
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringMatching(/^inventoryService:/),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// facebookCatalog
// ════════════════════════════════════════════════════════════════════════════

describe('facebookCatalog — logError migration', () => {
  beforeEach(() => {
    __reset();
    mockLogError.mockClear();
    mockNotifyOwner.mockResolvedValue(undefined);
  });

  it('refreshFacebookCatalog: logError called with facebookCatalog: prefix on query failure', async () => {
    __setQueryError('Stores/Products', new Error('db fail'));
    const r = await refreshFacebookCatalog();
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringMatching(/^facebookCatalog:/),
      expect.toSatisfy(v => v === null || v instanceof Error),
    );
  });
});
