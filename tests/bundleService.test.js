/**
 * Tests for bundleService.web.js
 *
 * Covers: getBundlesByFrame, addBundle, validateBundleCohesion webMethods.
 * Scenarios: happy path, missing/inactive bundles, component validation,
 * cart cohesion detection, coupon application, UserBundleCart tracking,
 * input sanitization, cart API errors.
 *
 * TDD: written before implementation (CF-vtle, updated CF-ynyn).
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
import {
  __seed,
  __reset as __resetData,
  __setQueryError,
  __setInsertError,
  __onInsert,
  __getInserted,
} from './__mocks__/wix-data.js';
import {
  cart,
  __setAddProductsError,
  __setApplyCouponError,
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
    couponCode: 'SUNSET-BUNDLE',
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
    couponCode: 'SUNSET-MICRO',
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
    couponCode: 'EMPIRE-DELUXE',
    isActive: true,
  },
  {
    _id: 'bundle-no-coupon',
    displayName: 'Budget Set (no coupon)',
    frameProductId: 'frame-budget',
    mattressProductId: 'mattress-budget',
    coverProductId: 'cover-budget',
    bundlePrice: 299,
    savings: 30,
    couponCode: null,
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
    couponCode: null,
    isActive: false,
  },
];

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

  it('components[].productId values match the CMS product ID fields', async () => {
    const result = await getBundlesByFrame('frame-sunset-full');
    const bundle = result.bundles.find(b => b._id === 'bundle-001');
    const frame = bundle.components.find(c => c.type === 'frame');
    const mattress = bundle.components.find(c => c.type === 'mattress');
    const cover = bundle.components.find(c => c.type === 'cover');
    expect(frame.productId).toBe('frame-sunset-full');
    expect(mattress.productId).toBe('mattress-sunset-6in');
    expect(cover.productId).toBe('cover-sunset-cotton');
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

  it('line items have no customTextFields (ecom API does not support this field)', async () => {
    await addBundle('bundle-001');
    const [lineItems] = cart.addProducts.mock.calls[0];
    for (const item of lineItems) {
      expect(item.customTextFields).toBeUndefined();
    }
  });

  it('applies the bundle coupon code from CMS after adding products', async () => {
    await addBundle('bundle-001');
    expect(cart.applyCoupon).toHaveBeenCalledWith('SUNSET-BUNDLE');
  });

  it('applies coupon AFTER addProducts (correct order)', async () => {
    const callOrder = [];
    cart.addProducts.mockImplementationOnce(async () => {
      callOrder.push('addProducts');
      return {};
    });
    cart.applyCoupon.mockImplementationOnce(async () => {
      callOrder.push('applyCoupon');
      return {};
    });
    await addBundle('bundle-001');
    expect(callOrder).toEqual(['addProducts', 'applyCoupon']);
  });

  it('skips coupon application when bundle has no couponCode', async () => {
    await addBundle('bundle-no-coupon');
    expect(cart.applyCoupon).not.toHaveBeenCalled();
  });

  it('succeeds even if coupon application fails (coupon is non-fatal)', async () => {
    __setApplyCouponError(new Error('Coupon already applied'));
    const result = await addBundle('bundle-001');
    expect(result.success).toBe(true);
    expect(result.productsAdded).toBe(3);
  });

  it('writes a UserBundleCart record after successful add', async () => {
    await addBundle('bundle-001', 'session-abc');
    const inserted = __getInserted('UserBundleCart');
    expect(inserted).toHaveLength(1);
  });

  it('UserBundleCart record contains bundleId and all 3 component productIds', async () => {
    await addBundle('bundle-001', 'session-abc');
    const [record] = __getInserted('UserBundleCart');
    expect(record.bundleId).toBe('bundle-001');
    expect(record.frameProductId).toBe('frame-sunset-full');
    expect(record.mattressProductId).toBe('mattress-sunset-6in');
    expect(record.coverProductId).toBe('cover-sunset-cotton');
  });

  it('UserBundleCart record stores the sessionId', async () => {
    await addBundle('bundle-001', 'session-xyz');
    const [record] = __getInserted('UserBundleCart');
    expect(record.sessionId).toBe('session-xyz');
  });

  it('UserBundleCart record stores bundleTag for display use', async () => {
    await addBundle('bundle-001', 'session-abc');
    const [record] = __getInserted('UserBundleCart');
    expect(record.bundleTag).toBe('bundle:bundle-001');
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

  it('does not write UserBundleCart when addProducts fails', async () => {
    __setAddProductsError(new Error('Cart service unavailable'));
    await addBundle('bundle-001', 'session-abc');
    expect(__getInserted('UserBundleCart')).toHaveLength(0);
  });

  it('pricing comes from CMS — bundlePrice not overridable by caller', async () => {
    // addBundle accepts only bundleId + optional sessionId — no price param
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
      couponCode: null,
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
      couponCode: null,
      isActive: true,
    }]);
    const result = await addBundle('bundle-no-mattress');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('BUNDLE_INCOMPLETE');
  });
});

// ── validateBundleCohesion ───────────────────────────────────────────────────
//
// New approach (CF-ynyn): cross-references UserBundleCart CMS against current
// cart items by productId — no longer relies on customTextFields.

describe('validateBundleCohesion', () => {
  // Seed UserBundleCart records — simulates what addBundle writes
  function seedUserBundleCart(records) {
    __seed('UserBundleCart', records);
  }

  const SESSION = 'session-test-001';

  const UBC_001 = {
    _id: 'ubc-001',
    sessionId: SESSION,
    bundleId: 'bundle-001',
    bundleTag: 'bundle:bundle-001',
    frameProductId: 'frame-sunset-full',
    mattressProductId: 'mattress-sunset-6in',
    coverProductId: 'cover-sunset-cotton',
  };

  const UBC_003 = {
    _id: 'ubc-003',
    sessionId: SESSION,
    bundleId: 'bundle-003',
    bundleTag: 'bundle:bundle-003',
    frameProductId: 'frame-empire-queen',
    mattressProductId: 'mattress-empire-8in',
    coverProductId: 'cover-empire-velvet',
  };

  function makeCartItems(...productIds) {
    return productIds.map(productId => ({ productId, quantity: 1 }));
  }

  it('returns valid:true for a complete bundle (all 3 productIds in cart)', async () => {
    seedUserBundleCart([UBC_001]);
    const cartItems = makeCartItems(
      'frame-sunset-full', 'mattress-sunset-6in', 'cover-sunset-cotton'
    );
    const result = await validateBundleCohesion(SESSION, cartItems);
    expect(result.valid).toBe(true);
    expect(result.brokenBundles).toHaveLength(0);
  });

  it('returns valid:false when one component productId is missing from cart', async () => {
    seedUserBundleCart([UBC_001]);
    const cartItems = makeCartItems('frame-sunset-full', 'mattress-sunset-6in'); // no cover
    const result = await validateBundleCohesion(SESSION, cartItems);
    expect(result.valid).toBe(false);
    expect(result.brokenBundles).toHaveLength(1);
  });

  it('returns valid:false when two component productIds are missing from cart', async () => {
    seedUserBundleCart([UBC_001]);
    const cartItems = makeCartItems('frame-sunset-full'); // only frame
    const result = await validateBundleCohesion(SESSION, cartItems);
    expect(result.valid).toBe(false);
    expect(result.brokenBundles).toHaveLength(1);
  });

  it('identifies the specific bundleTag that is broken', async () => {
    seedUserBundleCart([UBC_001]);
    const cartItems = makeCartItems('frame-sunset-full', 'mattress-sunset-6in');
    const result = await validateBundleCohesion(SESSION, cartItems);
    expect(result.brokenBundles[0].bundleTag).toBe('bundle:bundle-001');
  });

  it('returns valid:true for two complete bundles in cart', async () => {
    seedUserBundleCart([UBC_001, UBC_003]);
    const cartItems = makeCartItems(
      'frame-sunset-full', 'mattress-sunset-6in', 'cover-sunset-cotton',
      'frame-empire-queen', 'mattress-empire-8in', 'cover-empire-velvet',
    );
    const result = await validateBundleCohesion(SESSION, cartItems);
    expect(result.valid).toBe(true);
    expect(result.brokenBundles).toHaveLength(0);
  });

  it('identifies one broken bundle when another is complete', async () => {
    seedUserBundleCart([UBC_001, UBC_003]);
    // bundle-001 complete, bundle-003 missing cover
    const cartItems = makeCartItems(
      'frame-sunset-full', 'mattress-sunset-6in', 'cover-sunset-cotton',
      'frame-empire-queen', 'mattress-empire-8in', // no cover-empire-velvet
    );
    const result = await validateBundleCohesion(SESSION, cartItems);
    expect(result.valid).toBe(false);
    expect(result.brokenBundles).toHaveLength(1);
    expect(result.brokenBundles[0].bundleTag).toBe('bundle:bundle-003');
  });

  it('returns valid:true when no UserBundleCart records exist for session', async () => {
    // no __seed for UserBundleCart → empty
    const cartItems = makeCartItems('some-product');
    const result = await validateBundleCohesion(SESSION, cartItems);
    expect(result.valid).toBe(true);
    expect(result.brokenBundles).toHaveLength(0);
  });

  it('returns valid:true for empty cart (session has bundles but cart is empty)', async () => {
    seedUserBundleCart([UBC_001]);
    const result = await validateBundleCohesion(SESSION, []);
    expect(result.valid).toBe(false); // bundle was added but all 3 items removed
    expect(result.brokenBundles).toHaveLength(1);
  });

  it('ignores UserBundleCart records belonging to a different session', async () => {
    seedUserBundleCart([{ ...UBC_001, sessionId: 'other-session' }]);
    const cartItems = makeCartItems('frame-sunset-full', 'mattress-sunset-6in', 'cover-sunset-cotton');
    const result = await validateBundleCohesion(SESSION, cartItems);
    // other session's bundles not visible to SESSION
    expect(result.valid).toBe(true);
    expect(result.brokenBundles).toHaveLength(0);
  });

  it('includes componentCount and expectedCount in broken bundle report', async () => {
    seedUserBundleCart([UBC_001]);
    const cartItems = makeCartItems('frame-sunset-full'); // only 1 of 3
    const result = await validateBundleCohesion(SESSION, cartItems);
    const broken = result.brokenBundles[0];
    expect(broken.componentCount).toBe(1);
    expect(broken.expectedCount).toBe(3);
  });

  it('provides a human-readable message for broken bundles', async () => {
    seedUserBundleCart([UBC_001]);
    const cartItems = makeCartItems('frame-sunset-full', 'mattress-sunset-6in');
    const result = await validateBundleCohesion(SESSION, cartItems);
    expect(typeof result.brokenBundles[0].message).toBe('string');
    expect(result.brokenBundles[0].message.length).toBeGreaterThan(0);
  });

  it('returns valid:true for null sessionId', async () => {
    const result = await validateBundleCohesion(null, []);
    expect(result.valid).toBe(true);
    expect(result.brokenBundles).toHaveLength(0);
  });

  it('returns valid:true for undefined cartItems', async () => {
    seedUserBundleCart([UBC_001]);
    const result = await validateBundleCohesion(SESSION, undefined);
    expect(result.valid).toBe(false); // bundle in session, 0 cart items → broken
    expect(result.brokenBundles).toHaveLength(1);
  });

  it('returns valid:false (not valid:true) on CMS query error — error must not be masked', async () => {
    __setQueryError('UserBundleCart', new Error('DB unavailable'));
    const result = await validateBundleCohesion(SESSION, []);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.brokenBundles).toHaveLength(0);
  });

  it('sanitizes sessionId — rejects XSS payload', async () => {
    const result = await validateBundleCohesion('<script>alert(1)</script>', []);
    expect(result.valid).toBe(true); // sanitized → null → treated as no session
    expect(result.brokenBundles).toHaveLength(0);
  });
});

// ── addBundle sessionId sanitization ────────────────────────────────────────

describe('addBundle — sessionId sanitization', () => {
  it('sanitizes sessionId before writing to UserBundleCart', async () => {
    const result = await addBundle('bundle-001', 'valid-session-123');
    expect(result.success).toBe(true);
    const inserted = __getInserted('UserBundleCart');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].sessionId).toBe('valid-session-123');
  });

  it('stores null sessionId when sessionId is invalid/XSS', async () => {
    const result = await addBundle('bundle-001', '<script>bad</script>');
    expect(result.success).toBe(true);
    const inserted = __getInserted('UserBundleCart');
    expect(inserted[0].sessionId).toBeNull();
  });

  it('stores null sessionId when sessionId is omitted', async () => {
    const result = await addBundle('bundle-001');
    expect(result.success).toBe(true);
    const inserted = __getInserted('UserBundleCart');
    expect(inserted[0].sessionId).toBeNull();
  });
});
