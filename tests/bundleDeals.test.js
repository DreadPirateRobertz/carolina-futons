/**
 * Tests for bundleDeals.web.js
 *
 * Covers: listBundles, getBundleBySlug, addBundleToCart webMethods.
 * Scenarios: happy path, empty catalog, unknown/invalid slugs,
 * coupon auto-apply, coupon already applied, coupon failure (non-fatal),
 * missing products in CMS, products array parsing, security (server-side pricing).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Wix modules ────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin' },
  webMethod: vi.fn((_, fn) => fn),
}));

import { listBundles, getBundleBySlug, addBundleToCart } from '../src/backend/bundleDeals.web.js';
import { __seed, __reset as __resetData, __setQueryError } from './__mocks__/wix-data.js';
import { cart, __setCart, __setGetCurrentCartError, __setAddProductsError, __setApplyCouponError, __reset as __resetCart } from './__mocks__/wix-ecom-backend.js';

// ── Test fixtures ────────────────────────────────────────────────────────

const PRODUCTS_JSON = JSON.stringify([
  { productId: 'frame-001', qty: 1 },
  { productId: 'mattress-001', qty: 1 },
  { productId: 'cover-001', qty: 1 },
]);

const MATTRESS_BUNDLE_PRODUCTS = JSON.stringify([
  { productId: 'cab-001', qty: 1 },
  { productId: 'mattress-001', qty: 1 },
]);

const BUNDLES = [
  {
    _id: 'bundle-1',
    name: 'Complete Futon Set',
    slug: 'complete-futon-set',
    products: PRODUCTS_JSON,
    bundlePrice: 699,
    savings: 124,
    description: 'Frame, mattress, and cover — save 15%',
    image: 'https://example.com/futon-set.jpg',
    couponCode: 'FUTON-SET-15',
    isActive: true,
  },
  {
    _id: 'bundle-2',
    name: 'Murphy Cabinet Bed + Mattress',
    slug: 'murphy-cabinet-bed-mattress',
    products: MATTRESS_BUNDLE_PRODUCTS,
    bundlePrice: 1349,
    savings: 150,
    description: 'Cabinet bed and mattress — save 10%',
    image: 'https://example.com/murphy.jpg',
    couponCode: 'MURPHY-10',
    isActive: true,
  },
  {
    _id: 'bundle-3',
    name: 'Inactive Bundle',
    slug: 'inactive-bundle',
    products: PRODUCTS_JSON,
    bundlePrice: 500,
    savings: 50,
    description: 'Should not appear',
    image: '',
    couponCode: null,
    isActive: false,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  __resetData();
  __resetCart();
  __seed('ProductBundle', BUNDLES);
});

// ── listBundles ──────────────────────────────────────────────────────────

describe('listBundles — happy path', () => {
  it('returns success: true', async () => {
    const result = await listBundles();
    expect(result.success).toBe(true);
  });

  it('returns an array of bundles', async () => {
    const { bundles } = await listBundles();
    expect(Array.isArray(bundles)).toBe(true);
  });

  it('only returns active bundles', async () => {
    const { bundles } = await listBundles();
    for (const b of bundles) {
      expect(b.slug).not.toBe('inactive-bundle');
    }
  });

  it('returns the correct number of active bundles', async () => {
    const { bundles } = await listBundles();
    expect(bundles).toHaveLength(2);
  });

  it('each bundle has name, slug, bundlePrice, savings', async () => {
    const { bundles } = await listBundles();
    for (const b of bundles) {
      expect(typeof b.name).toBe('string');
      expect(b.name.length).toBeGreaterThan(0);
      expect(typeof b.slug).toBe('string');
      expect(b.slug.length).toBeGreaterThan(0);
      expect(typeof b.bundlePrice).toBe('number');
      expect(typeof b.savings).toBe('number');
    }
  });

  it('each bundle has a products array', async () => {
    const { bundles } = await listBundles();
    for (const b of bundles) {
      expect(Array.isArray(b.products)).toBe(true);
      expect(b.products.length).toBeGreaterThan(0);
    }
  });

  it('returns empty array when no active bundles exist', async () => {
    __resetData();
    __seed('ProductBundle', [BUNDLES[2]]); // only the inactive one
    const { bundles } = await listBundles();
    expect(Array.isArray(bundles)).toBe(true);
    expect(bundles).toHaveLength(0);
  });

  it('returns success: true with empty bundles when collection is empty', async () => {
    __resetData();
    __seed('ProductBundle', []);
    const result = await listBundles();
    expect(result.success).toBe(true);
    expect(result.bundles).toHaveLength(0);
  });
});

// ── getBundleBySlug ──────────────────────────────────────────────────────

describe('getBundleBySlug — known slug', () => {
  it('returns success: true for a valid slug', async () => {
    const result = await getBundleBySlug('complete-futon-set');
    expect(result.success).toBe(true);
  });

  it('returns the correct bundle object', async () => {
    const { bundle } = await getBundleBySlug('complete-futon-set');
    expect(bundle).not.toBeNull();
    expect(bundle.slug).toBe('complete-futon-set');
    expect(bundle.name).toBe('Complete Futon Set');
  });

  it('bundle has bundlePrice as number', async () => {
    const { bundle } = await getBundleBySlug('complete-futon-set');
    expect(typeof bundle.bundlePrice).toBe('number');
    expect(bundle.bundlePrice).toBe(699);
  });

  it('bundle has savings as number', async () => {
    const { bundle } = await getBundleBySlug('complete-futon-set');
    expect(bundle.savings).toBe(124);
  });

  it('bundle products is a parsed array', async () => {
    const { bundle } = await getBundleBySlug('complete-futon-set');
    expect(Array.isArray(bundle.products)).toBe(true);
    expect(bundle.products).toHaveLength(3);
  });

  it('bundle products contain productId and qty fields', async () => {
    const { bundle } = await getBundleBySlug('complete-futon-set');
    for (const p of bundle.products) {
      expect(p.productId).toBeTruthy();
      expect(p.qty).toBeGreaterThan(0);
    }
  });

  it('bundle has imageUrl as string', async () => {
    const { bundle } = await getBundleBySlug('complete-futon-set');
    expect(typeof bundle.imageUrl).toBe('string');
  });

  it('bundle has couponCode', async () => {
    const { bundle } = await getBundleBySlug('complete-futon-set');
    expect(bundle.couponCode).toBe('FUTON-SET-15');
  });

  it('works for the second bundle slug', async () => {
    const { bundle } = await getBundleBySlug('murphy-cabinet-bed-mattress');
    expect(bundle.slug).toBe('murphy-cabinet-bed-mattress');
    expect(bundle.bundlePrice).toBe(1349);
  });
});

describe('getBundleBySlug — unknown slug', () => {
  it('returns success: true, bundle: null for unknown slug', async () => {
    const result = await getBundleBySlug('not-a-bundle');
    expect(result.success).toBe(true);
    expect(result.bundle).toBeNull();
  });

  it('does not return inactive bundles', async () => {
    const result = await getBundleBySlug('inactive-bundle');
    expect(result.bundle).toBeNull();
  });
});

describe('getBundleBySlug — invalid slug', () => {
  it('returns success: false for empty string', async () => {
    const result = await getBundleBySlug('');
    expect(result.success).toBe(false);
    expect(result.bundle).toBeNull();
  });

  it('returns success: false for null', async () => {
    const result = await getBundleBySlug(null);
    expect(result.success).toBe(false);
  });

  it('returns success: false for HTML injection', async () => {
    const result = await getBundleBySlug('<script>alert(1)</script>');
    expect(result.success).toBe(false);
  });

  it('returns success: false for path traversal', async () => {
    const result = await getBundleBySlug('../etc/passwd');
    expect(result.success).toBe(false);
  });
});

// ── addBundleToCart ──────────────────────────────────────────────────────

describe('addBundleToCart — happy path', () => {
  it('returns success: true for a valid bundle slug', async () => {
    const result = await addBundleToCart('complete-futon-set');
    expect(result.success).toBe(true);
  });

  it('returns bundleName from CMS (not client)', async () => {
    const { bundleName } = await addBundleToCart('complete-futon-set');
    expect(bundleName).toBe('Complete Futon Set');
  });

  it('returns bundlePrice from CMS (not client)', async () => {
    const { bundlePrice } = await addBundleToCart('complete-futon-set');
    expect(bundlePrice).toBe(699);
  });

  it('returns savings from CMS', async () => {
    const { savings } = await addBundleToCart('complete-futon-set');
    expect(savings).toBe(124);
  });

  it('reports the number of products added', async () => {
    const { productsAdded } = await addBundleToCart('complete-futon-set');
    expect(productsAdded).toBe(3);
  });

  it('calls ecomCart.addProducts once', async () => {
    await addBundleToCart('complete-futon-set');
    expect(cart.addProducts).toHaveBeenCalledTimes(1);
  });

  it('passes correct line items to addProducts', async () => {
    await addBundleToCart('complete-futon-set');
    const [lineItems] = cart.addProducts.mock.calls[0];
    expect(lineItems).toHaveLength(3);
    expect(lineItems[0]).toMatchObject({ productId: 'frame-001', quantity: 1 });
    expect(lineItems[1]).toMatchObject({ productId: 'mattress-001', quantity: 1 });
    expect(lineItems[2]).toMatchObject({ productId: 'cover-001', quantity: 1 });
  });

  it('auto-applies the bundle coupon code', async () => {
    const { couponApplied } = await addBundleToCart('complete-futon-set');
    expect(couponApplied).toBe(true);
    expect(cart.applyCoupon).toHaveBeenCalledWith('FUTON-SET-15');
  });

  it('reports productsAdded: 2 for the 2-item bundle', async () => {
    const { productsAdded } = await addBundleToCart('murphy-cabinet-bed-mattress');
    expect(productsAdded).toBe(2);
  });
});

describe('addBundleToCart — coupon handling', () => {
  it('skips applyCoupon if coupon is already applied to cart', async () => {
    __setCart({ appliedCoupon: { code: 'FUTON-SET-15' } });
    const { couponApplied } = await addBundleToCart('complete-futon-set');
    expect(couponApplied).toBe(false);
    expect(cart.applyCoupon).not.toHaveBeenCalled();
  });

  it('still returns success: true when coupon is already applied', async () => {
    __setCart({ appliedCoupon: { code: 'FUTON-SET-15' } });
    const result = await addBundleToCart('complete-futon-set');
    expect(result.success).toBe(true);
  });

  it('applies coupon when a different coupon is currently on the cart', async () => {
    __setCart({ appliedCoupon: { code: 'OTHER-COUPON' } });
    const { couponApplied } = await addBundleToCart('complete-futon-set');
    expect(couponApplied).toBe(true);
  });

  it('succeeds even if applyCoupon throws (non-fatal)', async () => {
    __setApplyCouponError(new Error('Coupon limit reached'));
    const result = await addBundleToCart('complete-futon-set');
    expect(result.success).toBe(true);
    expect(result.couponApplied).toBe(false);
  });

  it('products are added even if coupon application fails', async () => {
    __setApplyCouponError(new Error('Coupon limit reached'));
    await addBundleToCart('complete-futon-set');
    expect(cart.addProducts).toHaveBeenCalledTimes(1);
  });

  it('returns success: true when getCurrentCart fails (coupon attempted anyway)', async () => {
    __setGetCurrentCartError(new Error('Cart service unavailable'));
    const result = await addBundleToCart('complete-futon-set');
    expect(result.success).toBe(true);
    expect(cart.addProducts).toHaveBeenCalledTimes(1);
  });

  it('couponApplied is false for a bundle with no couponCode', async () => {
    __resetData();
    __seed('ProductBundle', [{
      _id: 'bundle-nc',
      name: 'No Coupon Bundle',
      slug: 'no-coupon-bundle',
      products: JSON.stringify([{ productId: 'frame-001', qty: 1 }]),
      bundlePrice: 300,
      savings: 30,
      isActive: true,
      couponCode: null,
    }]);
    const { couponApplied } = await addBundleToCart('no-coupon-bundle');
    expect(couponApplied).toBe(false);
    expect(cart.applyCoupon).not.toHaveBeenCalled();
  });
});

describe('addBundleToCart — error cases', () => {
  it('returns success: false for unknown slug', async () => {
    const result = await addBundleToCart('not-a-bundle');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Bundle not found.');
  });

  it('returns success: false for inactive bundle', async () => {
    const result = await addBundleToCart('inactive-bundle');
    expect(result.success).toBe(false);
  });

  it('returns success: false for empty string slug', async () => {
    const result = await addBundleToCart('');
    expect(result.success).toBe(false);
  });

  it('returns success: false for null slug', async () => {
    const result = await addBundleToCart(null);
    expect(result.success).toBe(false);
  });

  it('returns success: false for path-traversal slug', async () => {
    const result = await addBundleToCart('../etc/passwd');
    expect(result.success).toBe(false);
  });

  it('returns success: false for a bundle with empty products array', async () => {
    __resetData();
    __seed('ProductBundle', [{
      _id: 'bundle-empty',
      name: 'Empty Bundle',
      slug: 'empty-bundle',
      products: '[]',
      bundlePrice: 0,
      savings: 0,
      isActive: true,
      couponCode: null,
    }]);
    const result = await addBundleToCart('empty-bundle');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Bundle has no products.');
  });

  it('returns success: false when addProducts throws', async () => {
    __setAddProductsError(new Error('Cart service unavailable'));
    const result = await addBundleToCart('complete-futon-set');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to add bundle to cart.');
  });

  it('does not call addProducts for an invalid slug', async () => {
    await addBundleToCart('');
    expect(cart.addProducts).not.toHaveBeenCalled();
  });
});

// ── Error / wixData failure paths ────────────────────────────────────────

describe('listBundles — wixData failure', () => {
  it('returns success: false when query throws', async () => {
    __setQueryError('ProductBundle', new Error('CMS unavailable'));
    const result = await listBundles();
    expect(result.success).toBe(false);
    expect(result.bundles).toHaveLength(0);
  });
});

describe('getBundleBySlug — wixData failure', () => {
  it('returns success: false when query throws', async () => {
    __setQueryError('ProductBundle', new Error('CMS unavailable'));
    const result = await getBundleBySlug('complete-futon-set');
    expect(result.success).toBe(false);
    expect(result.bundle).toBeNull();
  });
});

// ── parseProducts edge cases ──────────────────────────────────────────────

describe('addBundleToCart — products field parsing', () => {
  it('handles products stored as a raw array (not JSON string)', async () => {
    __resetData();
    __seed('ProductBundle', [{
      _id: 'bundle-arr',
      name: 'Array Bundle',
      slug: 'array-bundle',
      products: [{ productId: 'frame-001', qty: 1 }], // raw array, not JSON string
      bundlePrice: 300,
      savings: 30,
      isActive: true,
      couponCode: null,
    }]);
    const result = await addBundleToCart('array-bundle');
    expect(result.success).toBe(true);
    expect(result.productsAdded).toBe(1);
  });

  it('handles malformed JSON in products field gracefully', async () => {
    __resetData();
    __seed('ProductBundle', [{
      _id: 'bundle-bad',
      name: 'Bad JSON Bundle',
      slug: 'bad-json-bundle',
      products: '{not valid json',
      bundlePrice: 300,
      savings: 30,
      isActive: true,
      couponCode: null,
    }]);
    const result = await addBundleToCart('bad-json-bundle');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Bundle has no products.');
  });

  it('treats qty:0 products as qty:1 (enforces minimum quantity)', async () => {
    __resetData();
    __seed('ProductBundle', [{
      _id: 'bundle-qty0',
      name: 'Zero Qty Bundle',
      slug: 'zero-qty-bundle',
      products: JSON.stringify([{ productId: 'frame-001', qty: 0 }]),
      bundlePrice: 300,
      savings: 30,
      isActive: true,
      couponCode: null,
    }]);
    const result = await addBundleToCart('zero-qty-bundle');
    expect(result.success).toBe(true);
    const [lineItems] = cart.addProducts.mock.calls[0];
    expect(lineItems[0].quantity).toBe(1); // Math.max(1, 0) = 1
  });
});

// ── Security: server-side pricing ────────────────────────────────────────

describe('addBundleToCart — server-side pricing (security)', () => {
  it('bundlePrice in response comes from CMS, not from any client input', async () => {
    // addBundleToCart only receives slug — no client price accepted
    const { bundlePrice } = await addBundleToCart('complete-futon-set');
    expect(bundlePrice).toBe(699); // exact CMS value
  });

  it('savings in response comes from CMS', async () => {
    const { savings } = await addBundleToCart('complete-futon-set');
    expect(savings).toBe(124); // exact CMS value
  });

  it('line items use productIds from CMS, sanitized', async () => {
    await addBundleToCart('complete-futon-set');
    const [lineItems] = cart.addProducts.mock.calls[0];
    // All productIds should be strings (sanitized)
    for (const item of lineItems) {
      expect(typeof item.productId).toBe('string');
      expect(item.productId.length).toBeGreaterThan(0);
    }
  });
});
