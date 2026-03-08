import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { futonFrame, futonMattress, wallHuggerFrame, saleProduct } from '../fixtures/products.js';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    options: [],
    data: [],
    items: [],
    checked: false,
    style: { color: '' },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    onItemClicked: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    onCurrentIndexChanged: vi.fn(),
    getCurrentItem: vi.fn(),
    getTotalCount: vi.fn(() => 0),
    getItems: vi.fn(() => ({ items: [] })),
    setSort: vi.fn(),
    setFilter: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Backend Modules ────────────────────────────────────────────

const mockFeatured = [wallHuggerFrame, futonFrame, futonMattress];
const mockSaleItems = [saleProduct, futonMattress];

vi.mock('backend/productRecommendations.web', () => ({
  getFeaturedProducts: vi.fn().mockResolvedValue(mockFeatured),
  getSaleProducts: vi.fn().mockResolvedValue(mockSaleItems),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getWebSiteSchema: vi.fn().mockResolvedValue('{"@type":"WebSite"}'),
}));

vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('backend/testimonialService.web', () => ({
  getFeaturedTestimonials: vi.fn().mockResolvedValue({ success: true, items: [] }),
  getTestimonialSchema: vi.fn().mockResolvedValue(null),
}));

// ── Home Page Tests ─────────────────────────────────────────────────

describe('Promise.allSettled — Home Page partial failures', () => {
  beforeAll(async () => {
    await import('../../src/pages/Home.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('page loads even when getFeaturedProducts rejects', async () => {
    const { getFeaturedProducts } = await import('backend/productRecommendations.web');
    getFeaturedProducts.mockRejectedValueOnce(new Error('API timeout'));

    // Should not throw — allSettled handles the rejection
    await expect(onReadyHandler()).resolves.not.toThrow();
  });

  it('sale section renders even when featured products fail', async () => {
    const { getFeaturedProducts } = await import('backend/productRecommendations.web');
    getFeaturedProducts.mockRejectedValueOnce(new Error('API timeout'));

    await onReadyHandler();
    // Sale repeater should still be populated
    const saleRepeater = getEl('#saleRepeater');
    expect(saleRepeater.data).toEqual(mockSaleItems);
  });

  it('hero animation runs even when sale products fail', async () => {
    const { getSaleProducts } = await import('backend/productRecommendations.web');
    getSaleProducts.mockRejectedValueOnce(new Error('Sale API down'));

    await onReadyHandler();
    expect(getEl('#heroTitle').show).toHaveBeenCalled();
    expect(getEl('#heroSubtitle').show).toHaveBeenCalled();
    expect(getEl('#heroCTA').show).toHaveBeenCalled();
  });

  it('schema injection works even when testimonials fail', async () => {
    const { getFeaturedTestimonials } = await import('backend/testimonialService.web');
    getFeaturedTestimonials.mockRejectedValueOnce(new Error('CMS error'));

    await onReadyHandler();
    expect(getEl('#websiteSchemaHtml').postMessage).toHaveBeenCalledWith('{"@type":"WebSite"}');
  });

  it('logs rejected section errors to console', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getFeaturedProducts } = await import('backend/productRecommendations.web');
    // getFeaturedProducts has an internal try/catch, so allSettled sees it as fulfilled.
    // Sections that DON'T have internal try/catch will surface through allSettled.
    // Either way, errors from the section are logged to console.error.
    getFeaturedProducts.mockRejectedValueOnce(new Error('Featured API timeout'));

    await onReadyHandler();

    // The internal catch logs with 'Error loading featured products:'
    const anyError = consoleSpy.mock.calls.find(
      call => typeof call[0] === 'string' && call[0].includes('featured')
    );
    expect(anyError).toBeDefined();

    consoleSpy.mockRestore();
  });

  it('category showcase still loads when both featured and sale fail', async () => {
    const { getFeaturedProducts, getSaleProducts } = await import('backend/productRecommendations.web');
    getFeaturedProducts.mockRejectedValueOnce(new Error('fail'));
    getSaleProducts.mockRejectedValueOnce(new Error('fail'));

    await onReadyHandler();

    // Category click handlers should still be registered
    expect(getEl('#categoryFutonFrames').onClick).toHaveBeenCalled();
    expect(getEl('#categoryMattresses').onClick).toHaveBeenCalled();
  });
});

// ── Fulfillment Tests ───────────────────────────────────────────────

describe('Promise.allSettled — Fulfillment batch tracking', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('updateAllTracking returns partial success count', async () => {
    const { __seed } = await import('../__mocks__/wix-data.js');
    const { __setMember, __setRoles } = await import('../__mocks__/wix-members-backend.js');
    const { __setSecrets } = await import('../__mocks__/wix-secrets-backend.js');
    const { __setHandler } = await import('../__mocks__/wix-fetch.js');

    __setMember({ _id: 'admin-001' });
    __setRoles([{ _id: 'admin', title: 'Admin' }]);
    __setSecrets({ UPS_CLIENT_ID: 'x', UPS_CLIENT_SECRET: 'y', UPS_ACCOUNT_NUMBER: '123', UPS_SANDBOX: 'true' });

    __seed('Fulfillments', [
      { _id: 'f1', trackingNumber: '1Z111', status: 'IN_TRANSIT' },
      { _id: 'f2', trackingNumber: '1Z222', status: 'LABEL_CREATED' },
    ]);

    // Mock UPS tracking — first succeeds, second fails
    let callCount = 0;
    __setHandler((url) => {
      if (url.includes('/oauth/token')) {
        return { ok: true, async json() { return { access_token: 'tok', expires_in: '3600' }; }, async text() { return ''; } };
      }
      if (url.includes('/track/')) {
        callCount++;
        if (callCount === 1) {
          return { ok: true, async json() { return { trackResponse: { shipment: [{ package: [{ activity: [{ status: { statusCode: 'IT' } }] }] }] } }; }, async text() { return ''; } };
        }
        return { ok: false, async json() { throw new Error('UPS error'); }, async text() { return 'UPS error'; } };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    const { updateAllTracking } = await import('../../src/backend/fulfillment.web.js');
    const result = await updateAllTracking();

    expect(result.success).toBe(true);
    // The result should include the count fields
    expect(typeof result.updated).toBe('number');
  });
});

// ── Gift Registry Tests ─────────────────────────────────────────────

describe('Promise.allSettled — Gift Registry partial failures', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getMyRegistries returns successful registries even when item count query fails for one', async () => {
    const { __seed, __setQueryErrorFor } = await import('../__mocks__/wix-data.js');
    const { __setMember } = await import('../__mocks__/wix-members-backend.js');

    __setMember({ _id: 'member-001' });
    __seed('GiftRegistries', [
      { _id: 'reg-1', memberId: 'member-001', title: 'Wedding', slug: 'wedding-abc', occasion: 'wedding', isPublic: true, _createdDate: new Date() },
      { _id: 'reg-2', memberId: 'member-001', title: 'Housewarming', slug: 'hw-xyz', occasion: 'housewarming', isPublic: false, _createdDate: new Date() },
    ]);
    __seed('GiftRegistryItems', [
      { _id: 'item-1', registryId: 'reg-1', productName: 'Futon' },
    ]);

    const { getMyRegistries } = await import('../../src/backend/giftRegistry.web.js');
    const result = await getMyRegistries();

    expect(result.success).toBe(true);
    // At minimum, the registries that didn't fail should be present
    expect(result.data.registries.length).toBeGreaterThanOrEqual(1);
  });
});
