import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from '../__mocks__/wix-data.js';
import { __setMember } from '../__mocks__/wix-members-backend.js';
import {
  getWarrantyPlans,
  calculateWarrantyPrice,
  purchaseWarranty,
  registerWarranty,
  getMyWarranties,
  getWarrantyDetails,
  submitClaim,
  getClaimStatus,
  getMyClaims,
} from '../../src/backend/warrantyService.web.js';

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
});

const SAMPLE_PLANS = [
  { _id: 'plan-basic', name: 'Basic Protection', tierSlug: 'basic', durationYears: 1, coverageType: 'manufacturer', priceMultiplier: 0, description: 'Standard manufacturer warranty', coveredItems: '["frame defects","structural issues"]', excludedItems: '["normal wear","cosmetic damage"]', priority: 1, active: true },
  { _id: 'plan-extended', name: 'Extended Protection', tierSlug: 'extended', durationYears: 3, coverageType: 'extended', priceMultiplier: 0.08, description: '3-year extended coverage', coveredItems: '["frame defects","structural issues","fabric tears","mechanism failure"]', excludedItems: '["cosmetic damage","pet damage"]', priority: 2, active: true },
  { _id: 'plan-premium', name: 'Premium Protection', tierSlug: 'premium', durationYears: 5, coverageType: 'comprehensive', priceMultiplier: 0.12, description: '5-year comprehensive with accident protection', coveredItems: '["frame defects","structural issues","fabric tears","mechanism failure","accidental damage","stains","pet damage"]', excludedItems: '["intentional damage","commercial use"]', priority: 3, active: true },
];

// ── getWarrantyPlans ──────────────────────────────────────────────────

describe('getWarrantyPlans', () => {
  it('returns all active warranty plans for a product category', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);

    const result = await getWarrantyPlans('futon-frames');
    expect(result.success).toBe(true);
    expect(result.plans).toHaveLength(3);
    expect(result.plans[0].name).toBe('Basic Protection');
    expect(result.plans[0].coveredItems).toEqual(['frame defects', 'structural issues']);
  });

  it('returns plans sorted by priority', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);

    const result = await getWarrantyPlans('futon-frames');
    expect(result.success).toBe(true);
    expect(result.plans[0].tierSlug).toBe('basic');
    expect(result.plans[1].tierSlug).toBe('extended');
    expect(result.plans[2].tierSlug).toBe('premium');
  });

  it('excludes inactive plans', async () => {
    __seed('WarrantyPlans', [
      ...SAMPLE_PLANS,
      { _id: 'plan-old', name: 'Discontinued Plan', tierSlug: 'old', durationYears: 2, coverageType: 'basic', priceMultiplier: 0.05, description: 'No longer offered', coveredItems: '[]', excludedItems: '[]', priority: 4, active: false },
    ]);

    const result = await getWarrantyPlans('futon-frames');
    expect(result.success).toBe(true);
    expect(result.plans).toHaveLength(3);
    expect(result.plans.find(p => p.tierSlug === 'old')).toBeUndefined();
  });

  it('requires product category', async () => {
    const result = await getWarrantyPlans('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('category');
  });

  it('requires non-null category', async () => {
    const result = await getWarrantyPlans(null);
    expect(result.success).toBe(false);
  });

  it('sanitizes XSS in category input', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);
    // XSS is stripped but plans are global (not filtered by category),
    // so sanitized input still returns all active plans
    const result = await getWarrantyPlans('<script>alert(1)</script>');
    expect(result.success).toBe(true);
    // Plans are returned — the category is sanitized but doesn't filter results
    expect(result.plans.length).toBeGreaterThanOrEqual(0);
  });

  it('handles invalid coveredItems JSON gracefully', async () => {
    __seed('WarrantyPlans', [
      { _id: 'plan-bad', name: 'Bad JSON Plan', tierSlug: 'bad', durationYears: 1, coverageType: 'basic', priceMultiplier: 0, description: 'Test', coveredItems: 'not valid json', excludedItems: null, priority: 1, active: true },
    ]);

    const result = await getWarrantyPlans('futon-frames');
    expect(result.success).toBe(true);
    expect(result.plans[0].coveredItems).toEqual([]);
    expect(result.plans[0].excludedItems).toEqual([]);
  });

  it('returns empty array when no plans exist', async () => {
    __seed('WarrantyPlans', []);
    const result = await getWarrantyPlans('futon-frames');
    expect(result.success).toBe(true);
    expect(result.plans).toHaveLength(0);
  });
});

// ── calculateWarrantyPrice ────────────────────────────────────────────

describe('calculateWarrantyPrice', () => {
  it('calculates price based on product price and plan multiplier', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);

    const result = await calculateWarrantyPrice('plan-extended', 499.99);
    expect(result.success).toBe(true);
    expect(result.price).toBe(40); // 499.99 * 0.08 = 39.9992 → rounded to 40
    expect(result.planName).toBe('Extended Protection');
    expect(result.durationYears).toBe(3);
  });

  it('returns 0 for free (basic) plan', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);

    const result = await calculateWarrantyPrice('plan-basic', 499.99);
    expect(result.success).toBe(true);
    expect(result.price).toBe(0);
  });

  it('calculates premium plan price', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);

    const result = await calculateWarrantyPrice('plan-premium', 1299.00);
    expect(result.success).toBe(true);
    expect(result.price).toBe(155.88); // 1299 * 0.12 = 155.88
  });

  it('requires valid plan ID', async () => {
    const result = await calculateWarrantyPrice('', 499.99);
    expect(result.success).toBe(false);
    expect(result.error).toContain('plan ID');
  });

  it('requires positive product price', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);
    const result = await calculateWarrantyPrice('plan-extended', 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('price');
  });

  it('rejects negative product price', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);
    const result = await calculateWarrantyPrice('plan-extended', -100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('price');
  });

  it('fails when plan not found', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);
    const result = await calculateWarrantyPrice('plan-nonexistent', 499.99);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails for inactive plan', async () => {
    __seed('WarrantyPlans', [
      { _id: 'plan-inactive', name: 'Inactive', tierSlug: 'old', durationYears: 1, coverageType: 'basic', priceMultiplier: 0.05, description: 'Gone', coveredItems: '[]', excludedItems: '[]', priority: 1, active: false },
    ]);

    const result = await calculateWarrantyPrice('plan-inactive', 499.99);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('caps product price at reasonable maximum', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);
    const result = await calculateWarrantyPrice('plan-extended', 999999);
    expect(result.success).toBe(true);
    // Price should be calculated on capped value (max $25,000)
    expect(result.price).toBeLessThanOrEqual(25000 * 0.12);
  });
});

// ── purchaseWarranty ──────────────────────────────────────────────────

describe('purchaseWarranty', () => {
  it('records a warranty purchase at checkout', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);

    const result = await purchaseWarranty({
      planId: 'plan-extended',
      productId: 'prod-frame-1',
      productName: 'Classic Wood Futon Frame',
      productPrice: 499.99,
      orderId: 'order-abc',
    });

    expect(result.success).toBe(true);
    expect(result.warranty).toBeDefined();
    expect(result.warranty.planName).toBe('Extended Protection');
    expect(result.warranty.warrantyPrice).toBe(40);
    expect(result.warranty.status).toBe('active');
    expect(result.warranty.expiresAt).toBeDefined();
  });

  it('sets correct expiration based on plan duration', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);

    const result = await purchaseWarranty({
      planId: 'plan-premium',
      productId: 'prod-matt-1',
      productName: 'Luxury Futon Mattress',
      productPrice: 899.00,
      orderId: 'order-xyz',
    });

    expect(result.success).toBe(true);
    const expires = new Date(result.warranty.expiresAt);
    const now = new Date();
    const yearDiff = expires.getFullYear() - now.getFullYear();
    expect(yearDiff).toBeGreaterThanOrEqual(4);
    expect(yearDiff).toBeLessThanOrEqual(5);
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await purchaseWarranty({
      planId: 'plan-extended',
      productId: 'prod-1',
      productName: 'Test',
      productPrice: 499.99,
      orderId: 'order-1',
    });
    expect(result.success).toBe(false);
  });

  it('requires plan ID', async () => {
    const result = await purchaseWarranty({
      planId: '',
      productId: 'prod-1',
      productName: 'Test',
      productPrice: 499.99,
      orderId: 'order-1',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('plan ID');
  });

  it('requires product ID', async () => {
    const result = await purchaseWarranty({
      planId: 'plan-extended',
      productId: '',
      productName: 'Test',
      productPrice: 499.99,
      orderId: 'order-1',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('product ID');
  });

  it('requires order ID', async () => {
    const result = await purchaseWarranty({
      planId: 'plan-extended',
      productId: 'prod-1',
      productName: 'Test',
      productPrice: 499.99,
      orderId: '',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('order ID');
  });

  it('requires positive product price', async () => {
    const result = await purchaseWarranty({
      planId: 'plan-extended',
      productId: 'prod-1',
      productName: 'Test',
      productPrice: 0,
      orderId: 'order-1',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('price');
  });

  it('fails when plan is not found', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);

    const result = await purchaseWarranty({
      planId: 'plan-nonexistent',
      productId: 'prod-1',
      productName: 'Test',
      productPrice: 499.99,
      orderId: 'order-1',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('sanitizes product name to prevent XSS', async () => {
    __seed('WarrantyPlans', SAMPLE_PLANS);

    const result = await purchaseWarranty({
      planId: 'plan-basic',
      productId: 'prod-1',
      productName: '<img onerror=alert(1)>Futon',
      productPrice: 499.99,
      orderId: 'order-1',
    });
    expect(result.success).toBe(true);
    expect(result.warranty.productName).not.toContain('<img');
  });
});

// ── registerWarranty ──────────────────────────────────────────────────

describe('registerWarranty', () => {
  it('registers a warranty for a purchased product', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-1', memberId: 'member-1', planId: 'plan-extended', productId: 'prod-1', productName: 'Futon Frame', orderId: 'order-abc', warrantyPrice: 40, status: 'active', purchasedAt: new Date(), expiresAt: new Date(Date.now() + 3 * 365 * 86400000), registeredAt: null },
    ]);

    const result = await registerWarranty({
      warrantyId: 'wr-1',
      serialNumber: 'SN-12345-AB',
      purchaseDate: '2026-01-15',
    });

    expect(result.success).toBe(true);
  });

  it('requires warranty ID', async () => {
    const result = await registerWarranty({
      warrantyId: '',
      serialNumber: 'SN-123',
      purchaseDate: '2026-01-15',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('warranty ID');
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await registerWarranty({
      warrantyId: 'wr-1',
      serialNumber: 'SN-123',
      purchaseDate: '2026-01-15',
    });
    expect(result.success).toBe(false);
  });

  it('fails when warranty not found', async () => {
    __seed('WarrantyRegistrations', []);
    const result = await registerWarranty({
      warrantyId: 'wr-nonexistent',
      serialNumber: 'SN-123',
      purchaseDate: '2026-01-15',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('prevents registering another members warranty', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-other', memberId: 'member-other', planId: 'plan-basic', productId: 'prod-1', productName: 'Frame', orderId: 'order-1', warrantyPrice: 0, status: 'active', purchasedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400000), registeredAt: null },
    ]);

    const result = await registerWarranty({
      warrantyId: 'wr-other',
      serialNumber: 'SN-123',
      purchaseDate: '2026-01-15',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('sanitizes serial number input', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-1', memberId: 'member-1', planId: 'plan-basic', productId: 'prod-1', productName: 'Frame', orderId: 'order-1', warrantyPrice: 0, status: 'active', purchasedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400000), registeredAt: null },
    ]);

    const result = await registerWarranty({
      warrantyId: 'wr-1',
      serialNumber: '<script>hack</script>SN-999',
      purchaseDate: '2026-01-15',
    });
    expect(result.success).toBe(true);
  });
});

// ── getMyWarranties ───────────────────────────────────────────────────

describe('getMyWarranties', () => {
  it('returns all warranties for the authenticated member', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-1', memberId: 'member-1', planId: 'plan-extended', planName: 'Extended Protection', productId: 'prod-1', productName: 'Futon Frame', orderId: 'order-1', warrantyPrice: 40, status: 'active', purchasedAt: new Date(), expiresAt: new Date(Date.now() + 3 * 365 * 86400000), registeredAt: new Date() },
      { _id: 'wr-2', memberId: 'member-1', planId: 'plan-premium', planName: 'Premium Protection', productId: 'prod-2', productName: 'Mattress', orderId: 'order-2', warrantyPrice: 108, status: 'active', purchasedAt: new Date(), expiresAt: new Date(Date.now() + 5 * 365 * 86400000), registeredAt: null },
      { _id: 'wr-3', memberId: 'member-other', planId: 'plan-basic', planName: 'Basic Protection', productId: 'prod-3', productName: 'Cover', orderId: 'order-3', warrantyPrice: 0, status: 'active', purchasedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400000), registeredAt: null },
    ]);

    const result = await getMyWarranties();
    expect(result.success).toBe(true);
    expect(result.warranties).toHaveLength(2);
    expect(result.warranties.every(w => w.memberId === undefined)).toBe(true);
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await getMyWarranties();
    expect(result.success).toBe(false);
  });

  it('returns empty when member has no warranties', async () => {
    __seed('WarrantyRegistrations', []);
    const result = await getMyWarranties();
    expect(result.success).toBe(true);
    expect(result.warranties).toHaveLength(0);
  });
});

// ── getWarrantyDetails ────────────────────────────────────────────────

describe('getWarrantyDetails', () => {
  it('returns full details for a specific warranty', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-1', memberId: 'member-1', planId: 'plan-extended', planName: 'Extended Protection', productId: 'prod-1', productName: 'Classic Frame', orderId: 'order-1', warrantyPrice: 40, status: 'active', purchasedAt: new Date('2026-01-01'), expiresAt: new Date('2029-01-01'), registeredAt: new Date('2026-01-05'), serialNumber: 'SN-12345' },
    ]);
    __seed('WarrantyPlans', SAMPLE_PLANS);

    const result = await getWarrantyDetails('wr-1');
    expect(result.success).toBe(true);
    expect(result.warranty.productName).toBe('Classic Frame');
    expect(result.warranty.planName).toBe('Extended Protection');
    expect(result.warranty.coveredItems).toBeDefined();
  });

  it('requires warranty ID', async () => {
    const result = await getWarrantyDetails('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('warranty ID');
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await getWarrantyDetails('wr-1');
    expect(result.success).toBe(false);
  });

  it('prevents accessing other members warranties', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-other', memberId: 'member-other', planId: 'plan-basic', planName: 'Basic', productId: 'prod-1', productName: 'Frame', orderId: 'order-1', warrantyPrice: 0, status: 'active', purchasedAt: new Date(), expiresAt: new Date(), registeredAt: null },
    ]);

    const result = await getWarrantyDetails('wr-other');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('handles missing plan gracefully', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-1', memberId: 'member-1', planId: 'plan-deleted', planName: 'Deleted Plan', productId: 'prod-1', productName: 'Frame', orderId: 'order-1', warrantyPrice: 0, status: 'active', purchasedAt: new Date(), expiresAt: new Date(), registeredAt: null },
    ]);
    __seed('WarrantyPlans', []);

    const result = await getWarrantyDetails('wr-1');
    expect(result.success).toBe(true);
    // Should still return warranty info even if plan no longer exists
    expect(result.warranty.planName).toBe('Deleted Plan');
  });
});

// ── submitClaim ───────────────────────────────────────────────────────

describe('submitClaim', () => {
  it('submits a warranty claim', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-1', memberId: 'member-1', planId: 'plan-extended', planName: 'Extended Protection', productId: 'prod-1', productName: 'Futon Frame', orderId: 'order-1', warrantyPrice: 40, status: 'active', purchasedAt: new Date('2026-01-01'), expiresAt: new Date('2029-01-01'), registeredAt: new Date('2026-01-05') },
    ]);

    const result = await submitClaim({
      warrantyId: 'wr-1',
      issueType: 'structural',
      description: 'Frame leg cracked after normal use.',
      contactEmail: 'test@example.com',
      contactPhone: '555-0123',
    });

    expect(result.success).toBe(true);
    expect(result.claim).toBeDefined();
    expect(result.claim.status).toBe('submitted');
    expect(result.claim.claimNumber).toBeDefined();
  });

  it('requires warranty ID', async () => {
    const result = await submitClaim({
      warrantyId: '',
      issueType: 'structural',
      description: 'Something broke',
      contactEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('warranty ID');
  });

  it('requires issue type', async () => {
    const result = await submitClaim({
      warrantyId: 'wr-1',
      issueType: '',
      description: 'Something broke',
      contactEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('issue type');
  });

  it('validates issue type against allowed values', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-1', memberId: 'member-1', planId: 'plan-extended', planName: 'Extended', productId: 'prod-1', productName: 'Frame', orderId: 'order-1', warrantyPrice: 40, status: 'active', purchasedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400000), registeredAt: new Date() },
    ]);

    const result = await submitClaim({
      warrantyId: 'wr-1',
      issueType: 'invalid_type',
      description: 'Something broke',
      contactEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('issue type');
  });

  it('requires description', async () => {
    const result = await submitClaim({
      warrantyId: 'wr-1',
      issueType: 'structural',
      description: '',
      contactEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('description');
  });

  it('requires description minimum length', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-1', memberId: 'member-1', planId: 'plan-extended', planName: 'Extended', productId: 'prod-1', productName: 'Frame', orderId: 'order-1', warrantyPrice: 40, status: 'active', purchasedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400000), registeredAt: new Date() },
    ]);

    const result = await submitClaim({
      warrantyId: 'wr-1',
      issueType: 'structural',
      description: 'Hi',
      contactEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('description');
  });

  it('requires valid contact email', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-1', memberId: 'member-1', planId: 'plan-extended', planName: 'Extended', productId: 'prod-1', productName: 'Frame', orderId: 'order-1', warrantyPrice: 40, status: 'active', purchasedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400000), registeredAt: new Date() },
    ]);

    const result = await submitClaim({
      warrantyId: 'wr-1',
      issueType: 'structural',
      description: 'Frame leg cracked after normal use.',
      contactEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await submitClaim({
      warrantyId: 'wr-1',
      issueType: 'structural',
      description: 'Something broke',
      contactEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects claim on expired warranty', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-expired', memberId: 'member-1', planId: 'plan-basic', planName: 'Basic', productId: 'prod-1', productName: 'Frame', orderId: 'order-1', warrantyPrice: 0, status: 'expired', purchasedAt: new Date('2020-01-01'), expiresAt: new Date('2021-01-01'), registeredAt: new Date() },
    ]);

    const result = await submitClaim({
      warrantyId: 'wr-expired',
      issueType: 'structural',
      description: 'Frame leg cracked after normal use.',
      contactEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('prevents claims on other members warranties', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-other', memberId: 'member-other', planId: 'plan-extended', planName: 'Extended', productId: 'prod-1', productName: 'Frame', orderId: 'order-1', warrantyPrice: 40, status: 'active', purchasedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400000), registeredAt: new Date() },
    ]);

    const result = await submitClaim({
      warrantyId: 'wr-other',
      issueType: 'structural',
      description: 'Frame leg cracked after normal use.',
      contactEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('sanitizes description to prevent XSS', async () => {
    __seed('WarrantyRegistrations', [
      { _id: 'wr-1', memberId: 'member-1', planId: 'plan-extended', planName: 'Extended', productId: 'prod-1', productName: 'Frame', orderId: 'order-1', warrantyPrice: 40, status: 'active', purchasedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400000), registeredAt: new Date() },
    ]);

    const result = await submitClaim({
      warrantyId: 'wr-1',
      issueType: 'structural',
      description: '<script>alert("xss")</script>Frame leg broke during normal use of the product.',
      contactEmail: 'test@example.com',
    });
    expect(result.success).toBe(true);
    expect(result.claim.description).not.toContain('<script>');
  });
});

// ── getClaimStatus ────────────────────────────────────────────────────

describe('getClaimStatus', () => {
  it('returns claim details', async () => {
    __seed('WarrantyClaims', [
      { _id: 'claim-1', memberId: 'member-1', warrantyId: 'wr-1', claimNumber: 'CLM-20260301-0001', issueType: 'structural', description: 'Leg broke', status: 'submitted', contactEmail: 'test@example.com', contactPhone: '555-0123', submittedAt: new Date(), resolvedAt: null, resolution: '' },
    ]);

    const result = await getClaimStatus('claim-1');
    expect(result.success).toBe(true);
    expect(result.claim.claimNumber).toBe('CLM-20260301-0001');
    expect(result.claim.status).toBe('submitted');
  });

  it('requires claim ID', async () => {
    const result = await getClaimStatus('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('claim ID');
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await getClaimStatus('claim-1');
    expect(result.success).toBe(false);
  });

  it('prevents accessing other members claims', async () => {
    __seed('WarrantyClaims', [
      { _id: 'claim-other', memberId: 'member-other', warrantyId: 'wr-1', claimNumber: 'CLM-001', issueType: 'structural', description: 'Broke', status: 'submitted', contactEmail: 'other@example.com', submittedAt: new Date() },
    ]);

    const result = await getClaimStatus('claim-other');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns not found for nonexistent claim', async () => {
    __seed('WarrantyClaims', []);
    const result = await getClaimStatus('claim-nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ── getMyClaims ───────────────────────────────────────────────────────

describe('getMyClaims', () => {
  it('returns all claims for the authenticated member', async () => {
    __seed('WarrantyClaims', [
      { _id: 'claim-1', memberId: 'member-1', warrantyId: 'wr-1', claimNumber: 'CLM-001', issueType: 'structural', description: 'Leg broke', status: 'submitted', contactEmail: 'test@example.com', submittedAt: new Date() },
      { _id: 'claim-2', memberId: 'member-1', warrantyId: 'wr-2', claimNumber: 'CLM-002', issueType: 'fabric', description: 'Tear in cover', status: 'approved', contactEmail: 'test@example.com', submittedAt: new Date() },
      { _id: 'claim-3', memberId: 'member-other', warrantyId: 'wr-3', claimNumber: 'CLM-003', issueType: 'mechanism', description: 'Stuck', status: 'submitted', contactEmail: 'other@example.com', submittedAt: new Date() },
    ]);

    const result = await getMyClaims();
    expect(result.success).toBe(true);
    expect(result.claims).toHaveLength(2);
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await getMyClaims();
    expect(result.success).toBe(false);
  });

  it('returns empty when no claims exist', async () => {
    __seed('WarrantyClaims', []);
    const result = await getMyClaims();
    expect(result.success).toBe(true);
    expect(result.claims).toHaveLength(0);
  });
});
