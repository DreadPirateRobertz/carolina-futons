/**
 * Tests for bundleService.web.js
 *
 * Covers: getBundlesByFrame, addBundle, validateBundleCohesion webMethods.
 * Scenarios: happy path, missing/inactive bundles, component validation,
 * cart cohesion detection, input sanitization, cart API errors.
 *
 * TDD: written before implementation (CF-vtle).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin' },
  webMethod: vi.fn((_, fn) => fn),
}));

import {
  getBundlesByFrame,
  addBundle,
  validateBundleCohesion,
} from '../src/backend/bundleService.web.js';
import { __seed, __reset as __resetData, __setQueryError } from './__mocks__/wix-data.js';
import {
  cart,
  __setAddProductsError,
  __reset as __resetCart,
} from './__mocks__/wix-ecom-backend.js';

// Suppress logError console output during tests
vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BUNDLES = [
  {
    _id: 'bundle-001',
    displayName: 'Sunset Complete Set',
    frameProductId: 'frame-sunset-full',
    mattressProductId: 'mattress-sunset-6in',
    coverProductId: 'cover-sunset-cotton',
    bundlePrice: 549,
    savings: 75,
    isActive: true,
  },
  {
    _id: 'bundle-002',
    displayName: 'Sunset Complete Set (Microfiber Cover)',
    frameProductId: 'frame-sunset-full',
    mattressProductId: 'mattress-sunset-6in',
    coverProductId: 'cover-sunset-micro',
    bundlePrice: 529,
    savings: 65,
    isActive: true,
  },
  {
    _id: 'bundle-003',
    displayName: 'Empire Deluxe Set',
    frameProductId: 'frame-empire-queen',
    mattressProductId: 'mattress-empire-8in',
    coverProductId: 'cover-empire-velvet',
    bundlePrice: 899,
    savings: 120,
    isActive: true,
  },
  {
    _id: 'bundle-inactive',
    displayName: 'Discontinued Set',
    frameProductId: 'frame-sunset-full',
    mattressProductId: 'mattress-old',
    coverProductId: 'cover-old',
    bundlePrice: 399,
    savings: 0,
    isActive: false,
  },
];

function makeBundleLineItems(bundleId, bundle) {
  const tag = `bundle:${bundleId}`;
  return [
    { productId: bundle.frameProductId, customTextFields: [{ title: 'bundleTag', value: tag }] },
    { productId: bundle.mattressProductId, customTextFields: [{ title: 'bundleTag', value: tag }] },
    { productId: bundle.coverProductId, customTextFields: [{ title: 'bundleTag', value: tag }] },
  ];
}

beforeEach(() => {
  __resetData();
  __resetCart();
  __seed('Bundles', BUNDLES);
});

// ── getBundlesByFrame ─────────────────────────────────────────────────────────

describe('getBundlesByFrame', () => {
  it('returns bundles matching the given frameId', async () => {
    const result = await getBundlesByFrame('frame-sunset-full');
    expect(result.success).toBe(true);
    expect(result.bundles).toHaveLength(2);
  });

  it('returns empty bundles array when no matches exist', async () => {
    const result = await getBundlesByFrame('frame-unknown-xyz');
    expect(result.success).toBe(true);
    expect(result.bundles).toHaveLength(0);
  });

  it('only returns active bundles', async () => {
    const result = await getBundlesByFrame('frame-sunset-full');
    expect(result.bundles.every(b => b.isActive !== false)).toBe(true);
    // inactive bundle-inactive is excluded even though frameProductId matches
    expect(result.bundles.find(b => b._id === 'bundle-inactive')).toBeUndefined();
  });

  it('each bundle includes required display fields', async () => {
    const result = await getBundlesByFrame('frame-sunset-full');
    for (const bundle of result.bundles) {
      expect(bundle).toHaveProperty('_id');
      expect(bundle).toHaveProperty('displayName');
      expect(bundle).toHaveProperty('bundlePrice');
      expect(bundle).toHaveProperty('savings');
      expect(bundle).toHaveProperty('components');
    }
  });

  it('components array contains frame, mattress, and cover entries', async () => {
    const result = await getBundlesByFrame('frame-sunset-full');
    const bundle = result.bundles[0];
    expect(bundle.components).toHaveLength(3);
    const types = bundle.components.map(c => c.type);
    expect(types).toContain('frame');
    expect(types).toContain('mattress');
    expect(types).toContain('cover');
  });

  it('savings is a non-negative number', async () => {
    const result = await getBundlesByFrame('frame-sunset-full');
    for (const bundle of result.bundles) {
      expect(bundle.savings).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns error for empty frameId', async () => {
    const result = await getBundlesByFrame('');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('sanitizes frameId — rejects XSS payload', async () => {
    const result = await getBundlesByFrame('<script>alert(1)</script>');
    expect(result.success).toBe(false);
  });

  it('handles CMS query error gracefully', async () => {
    __setQueryError('Bundles', new Error('DB unavailable'));
    const result = await getBundlesByFrame('frame-sunset-full');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns bundles for a different frame (no cross-contamination)', async () => {
    const result = await getBundlesByFrame('frame-empire-queen');
    expect(result.bundles).toHaveLength(1);
    expect(result.bundles[0]._id).toBe('bundle-003');
  });
});

// ── addBundle ────────────────────────────────────────────────────────────────

describe('addBundle', () => {
  it('adds exactly 3 line items to the cart', async () => {
    const result = await addBundle('bundle-001');
    expect(result.success).toBe(true);
    expect(result.productsAdded).toBe(3);
    expect(cart.addProducts).toHaveBeenCalledTimes(1);
    const [lineItems] = cart.addProducts.mock.calls[0];
    expect(lineItems).toHaveLength(3);
  });

  it('line items contain the correct productIds from CMS', async () => {
    await addBundle('bundle-001');
    const [lineItems] = cart.addProducts.mock.calls[0];
    const ids = lineItems.map(li => li.productId);
    expect(ids).toContain('frame-sunset-full');
    expect(ids).toContain('mattress-sunset-6in');
    expect(ids).toContain('cover-sunset-cotton');
  });

  it('each line item has quantity 1', async () => {
    await addBundle('bundle-001');
    const [lineItems] = cart.addProducts.mock.calls[0];
    for (const item of lineItems) {
      expect(item.quantity).toBe(1);
    }
  });

  it('each line item carries the bundleTag in customTextFields', async () => {
    await addBundle('bundle-001');
    const [lineItems] = cart.addProducts.mock.calls[0];
    for (const item of lineItems) {
      const tagField = item.customTextFields?.find(f => f.title === 'bundleTag');
      expect(tagField).toBeDefined();
      expect(tagField.value).toMatch(/^bundle:/);
    }
  });

  it('all 3 line items share the same bundleTag', async () => {
    await addBundle('bundle-001');
    const [lineItems] = cart.addProducts.mock.calls[0];
    const tags = lineItems.map(li => li.customTextFields.find(f => f.title === 'bundleTag').value);
    expect(new Set(tags).size).toBe(1);
  });

  it('bundleTag format is bundle:<bundleId>', async () => {
    await addBundle('bundle-001');
    const [lineItems] = cart.addProducts.mock.calls[0];
    const tag = lineItems[0].customTextFields.find(f => f.title === 'bundleTag').value;
    expect(tag).toBe('bundle:bundle-001');
  });

  it('returns bundleTag, bundlePrice, savings, and displayName', async () => {
    const result = await addBundle('bundle-001');
    expect(result.bundleTag).toBe('bundle:bundle-001');
    expect(result.bundlePrice).toBe(549);
    expect(result.savings).toBe(75);
    expect(result.displayName).toBe('Sunset Complete Set');
  });

  it('returns error for unknown bundleId', async () => {
    const result = await addBundle('bundle-does-not-exist');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.errorCode).toBe('BUNDLE_NOT_FOUND');
  });

  it('returns error for empty bundleId', async () => {
    const result = await addBundle('');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('does not add inactive bundles to cart', async () => {
    const result = await addBundle('bundle-inactive');
    expect(result.success).toBe(false);
    expect(cart.addProducts).not.toHaveBeenCalled();
  });

  it('returns error when cart.addProducts fails', async () => {
    __setAddProductsError(new Error('Cart service unavailable'));
    const result = await addBundle('bundle-001');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('pricing comes from CMS — bundlePrice not overridable by caller', async () => {
    // addBundle accepts only bundleId — no price param
    const result = await addBundle('bundle-001');
    expect(result.bundlePrice).toBe(549); // exact CMS value, not manipulable
  });

  it('returns error when CMS query throws', async () => {
    __setQueryError('Bundles', new Error('DB unavailable'));
    const result = await addBundle('bundle-001');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns BUNDLE_INCOMPLETE error when a CMS record has empty frameProductId', async () => {
    __resetData();
    __seed('Bundles', [{
      _id: 'bundle-bad',
      displayName: 'Broken Bundle',
      frameProductId: '',        // missing
      mattressProductId: 'mattress-ok',
      coverProductId: 'cover-ok',
      bundlePrice: 400,
      savings: 50,
      isActive: true,
    }]);
    const result = await addBundle('bundle-bad');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('BUNDLE_INCOMPLETE');
    expect(cart.addProducts).not.toHaveBeenCalled();
  });

  it('returns BUNDLE_INCOMPLETE when mattressProductId is missing', async () => {
    __resetData();
    __seed('Bundles', [{
      _id: 'bundle-no-mattress',
      displayName: 'No Mattress Bundle',
      frameProductId: 'frame-ok',
      mattressProductId: '',     // missing
      coverProductId: 'cover-ok',
      bundlePrice: 400,
      savings: 50,
      isActive: true,
    }]);
    const result = await addBundle('bundle-no-mattress');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('BUNDLE_INCOMPLETE');
  });
});

// ── validateBundleCohesion ───────────────────────────────────────────────────

describe('validateBundleCohesion', () => {
  it('returns valid:true for a complete bundle (3 items with same tag)', async () => {
    const cartItems = makeBundleLineItems('bundle-001', BUNDLES[0]);
    const result = await validateBundleCohesion(cartItems);
    expect(result.valid).toBe(true);
    expect(result.brokenBundles).toHaveLength(0);
  });

  it('returns valid:false when one component is removed', async () => {
    const cartItems = makeBundleLineItems('bundle-001', BUNDLES[0]);
    const incomplete = cartItems.slice(0, 2); // only frame + mattress
    const result = await validateBundleCohesion(incomplete);
    expect(result.valid).toBe(false);
    expect(result.brokenBundles).toHaveLength(1);
  });

  it('returns valid:false when only one component remains', async () => {
    const cartItems = makeBundleLineItems('bundle-001', BUNDLES[0]).slice(0, 1);
    const result = await validateBundleCohesion(cartItems);
    expect(result.valid).toBe(false);
  });

  it('identifies the specific bundleTag that is broken', async () => {
    const incomplete = makeBundleLineItems('bundle-001', BUNDLES[0]).slice(0, 2);
    const result = await validateBundleCohesion(incomplete);
    expect(result.brokenBundles[0].bundleTag).toBe('bundle:bundle-001');
  });

  it('returns valid:true for two complete bundles in cart', async () => {
    const items = [
      ...makeBundleLineItems('bundle-001', BUNDLES[0]),
      ...makeBundleLineItems('bundle-003', BUNDLES[2]),
    ];
    const result = await validateBundleCohesion(items);
    expect(result.valid).toBe(true);
    expect(result.brokenBundles).toHaveLength(0);
  });

  it('identifies one broken bundle when another is complete', async () => {
    const items = [
      ...makeBundleLineItems('bundle-001', BUNDLES[0]),
      ...makeBundleLineItems('bundle-003', BUNDLES[2]).slice(0, 2),
    ];
    const result = await validateBundleCohesion(items);
    expect(result.valid).toBe(false);
    expect(result.brokenBundles).toHaveLength(1);
    expect(result.brokenBundles[0].bundleTag).toBe('bundle:bundle-003');
  });

  it('returns valid:true for empty cart', async () => {
    const result = await validateBundleCohesion([]);
    expect(result.valid).toBe(true);
    expect(result.brokenBundles).toHaveLength(0);
  });

  it('ignores items with no bundleTag (non-bundle items)', async () => {
    const cartItems = [{ productId: 'standalone-product', customTextFields: [] }];
    const result = await validateBundleCohesion(cartItems);
    expect(result.valid).toBe(true);
    expect(result.brokenBundles).toHaveLength(0);
  });

  it('includes componentCount and expectedCount in broken bundle report', async () => {
    const incomplete = makeBundleLineItems('bundle-001', BUNDLES[0]).slice(0, 1);
    const result = await validateBundleCohesion(incomplete);
    const broken = result.brokenBundles[0];
    expect(broken.componentCount).toBe(1);
    expect(broken.expectedCount).toBe(3);
  });

  it('provides a human-readable message for broken bundles', async () => {
    const incomplete = makeBundleLineItems('bundle-001', BUNDLES[0]).slice(0, 2);
    const result = await validateBundleCohesion(incomplete);
    expect(typeof result.brokenBundles[0].message).toBe('string');
    expect(result.brokenBundles[0].message.length).toBeGreaterThan(0);
  });

  it('returns valid:true for null input (non-array guard)', async () => {
    const result = await validateBundleCohesion(null);
    expect(result.valid).toBe(true);
    expect(result.brokenBundles).toHaveLength(0);
  });

  it('returns valid:true for undefined input', async () => {
    const result = await validateBundleCohesion(undefined);
    expect(result.valid).toBe(true);
    expect(result.brokenBundles).toHaveLength(0);
  });
});
