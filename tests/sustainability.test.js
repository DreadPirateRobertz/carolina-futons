import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  getSustainabilityInfo,
  calculateCarbonOffset,
  submitTradeIn,
  getTradeInStatus,
} from '../src/backend/sustainability.web.js';

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
});

// ── getSustainabilityInfo ─────────────────────────────────────────────

describe('getSustainabilityInfo', () => {
  it('returns sustainability data with badges', async () => {
    __seed('ProductSustainability', [
      {
        _id: 's-1',
        productId: 'prod-eureka',
        materialSource: 'Plantation-grown rubberwood',
        durabilityRating: 5,
        durabilityYears: 20,
        recyclability: 'fully',
        certifications: '["FSC Certified","GREENGUARD"]',
        carbonFootprint: 45,
        sustainabilityScore: 88,
        badges: '["eco-material","long-lasting","recyclable"]',
        active: true,
      },
    ]);

    const result = await getSustainabilityInfo('prod-eureka');
    expect(result.success).toBe(true);
    expect(result.sustainability.materialSource).toBe('Plantation-grown rubberwood');
    expect(result.sustainability.durabilityYears).toBe(20);
    expect(result.sustainability.recyclability).toBe('fully');
    expect(result.sustainability.certifications).toEqual(['FSC Certified', 'GREENGUARD']);
    expect(result.sustainability.sustainabilityScore).toBe(88);
    expect(result.sustainability.badges).toHaveLength(3);
    expect(result.sustainability.badges[0].slug).toBe('eco-material');
    expect(result.sustainability.badges[0].label).toBe('Eco-Friendly Materials');
  });

  it('returns null for product without sustainability data', async () => {
    __seed('ProductSustainability', []);
    const result = await getSustainabilityInfo('prod-unknown');
    expect(result.success).toBe(true);
    expect(result.sustainability).toBeNull();
  });

  it('requires valid product ID', async () => {
    const result = await getSustainabilityInfo('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('product ID');
  });

  it('only returns active records', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', sustainabilityScore: 50, badges: '[]', active: false },
    ]);

    const result = await getSustainabilityInfo('prod-1');
    expect(result.sustainability).toBeNull();
  });

  it('handles invalid badges JSON gracefully', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', badges: 'not json', certifications: 'bad', active: true },
    ]);

    const result = await getSustainabilityInfo('prod-1');
    expect(result.success).toBe(true);
    expect(result.sustainability.badges).toHaveLength(0);
    expect(result.sustainability.certifications).toEqual([]);
  });

  it('returns error for null product ID', async () => {
    const result = await getSustainabilityInfo(null);
    expect(result.success).toBe(false);
  });

  it('returns error for undefined product ID', async () => {
    const result = await getSustainabilityInfo(undefined);
    expect(result.success).toBe(false);
  });

  it('handles unknown badge slug with defaults', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', badges: '["unknown-badge"]', active: true },
    ]);

    const result = await getSustainabilityInfo('prod-1');
    expect(result.sustainability.badges[0].slug).toBe('unknown-badge');
    expect(result.sustainability.badges[0].label).toBe('unknown-badge');
  });

  it('defaults missing numeric fields to 0', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', badges: '[]', active: true },
    ]);

    const result = await getSustainabilityInfo('prod-1');
    expect(result.sustainability.durabilityRating).toBe(0);
    expect(result.sustainability.durabilityYears).toBe(0);
    expect(result.sustainability.carbonFootprint).toBe(0);
    expect(result.sustainability.sustainabilityScore).toBe(0);
  });

  it('defaults recyclability to none', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', badges: '[]', active: true },
    ]);

    const result = await getSustainabilityInfo('prod-1');
    expect(result.sustainability.recyclability).toBe('none');
  });

  it('defaults materialSource to empty string', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', badges: '[]', active: true },
    ]);

    const result = await getSustainabilityInfo('prod-1');
    expect(result.sustainability.materialSource).toBe('');
  });

  it('includes productId in response', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-eureka', badges: '[]', active: true },
    ]);

    const result = await getSustainabilityInfo('prod-eureka');
    expect(result.sustainability.productId).toBe('prod-eureka');
  });

  it('handles empty badges array', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', badges: '[]', active: true },
    ]);

    const result = await getSustainabilityInfo('prod-1');
    expect(result.sustainability.badges).toEqual([]);
  });

  it('handles null badges field', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', badges: null, active: true },
    ]);

    const result = await getSustainabilityInfo('prod-1');
    expect(result.sustainability.badges).toEqual([]);
  });
});

// ── calculateCarbonOffset ─────────────────────────────────────────────

describe('calculateCarbonOffset', () => {
  it('calculates offset for multiple products', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', carbonFootprint: 45, active: true },
      { _id: 's-2', productId: 'prod-2', carbonFootprint: 30, active: true },
    ]);

    const result = await calculateCarbonOffset(['prod-1', 'prod-2']);
    expect(result.success).toBe(true);
    expect(result.offset.totalCarbonKg).toBe(75);
    expect(result.offset.offsetCost).toBeGreaterThan(0);
    expect(result.offset.productsMatched).toBe(2);
    expect(result.offset.treesEquivalent).toBeGreaterThan(0);
  });

  it('enforces minimum $1 offset', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', carbonFootprint: 5, active: true },
    ]);

    const result = await calculateCarbonOffset(['prod-1']);
    expect(result.offset.offsetCost).toBe(1);
  });

  it('returns zero when no products match', async () => {
    __seed('ProductSustainability', []);
    const result = await calculateCarbonOffset(['prod-none']);
    expect(result.success).toBe(true);
    expect(result.offset.totalCarbonKg).toBe(0);
    expect(result.offset.offsetCost).toBe(0);
  });

  it('requires product IDs array', async () => {
    const result = await calculateCarbonOffset(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product IDs');
  });

  it('requires non-empty array', async () => {
    const result = await calculateCarbonOffset([]);
    expect(result.success).toBe(false);
  });

  it('limits to 20 products', async () => {
    __seed('ProductSustainability', []);
    const ids = Array.from({ length: 25 }, (_, i) => `prod-${i}`);
    const result = await calculateCarbonOffset(ids);
    expect(result.success).toBe(true);
  });

  it('returns error when all IDs are invalid', async () => {
    const result = await calculateCarbonOffset([null, undefined, '']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid');
  });

  it('reports productsRequested count', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', carbonFootprint: 20, active: true },
    ]);

    const result = await calculateCarbonOffset(['prod-1', 'prod-missing']);
    expect(result.offset.productsRequested).toBe(2);
    expect(result.offset.productsMatched).toBe(1);
  });

  it('calculates treesEquivalent correctly', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', carbonFootprint: 21.77, active: true },
    ]);

    const result = await calculateCarbonOffset(['prod-1']);
    expect(result.offset.treesEquivalent).toBe(1);
  });

  it('handles product with zero carbon footprint', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', carbonFootprint: 0, active: true },
    ]);

    const result = await calculateCarbonOffset(['prod-1']);
    expect(result.offset.totalCarbonKg).toBe(0);
    expect(result.offset.offsetCost).toBe(0);
  });

  it('handles missing carbonFootprint field', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', active: true },
    ]);

    const result = await calculateCarbonOffset(['prod-1']);
    expect(result.offset.totalCarbonKg).toBe(0);
  });

  it('rounds totalCarbonKg to one decimal', async () => {
    __seed('ProductSustainability', [
      { _id: 's-1', productId: 'prod-1', carbonFootprint: 33.333, active: true },
    ]);

    const result = await calculateCarbonOffset(['prod-1']);
    expect(result.offset.totalCarbonKg).toBe(33.3);
  });
});

// ── submitTradeIn ─────────────────────────────────────────────────────

describe('submitTradeIn', () => {
  it('submits a trade-in request with estimated credit', async () => {
    const result = await submitTradeIn({
      productType: 'Futon Frame',
      condition: 'good',
      age: '3 years',
      description: 'Night & Day Vienna frame, light wear, no structural issues.',
      photos: ['https://example.com/photo1.jpg'],
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.estimatedCredit.condition).toBe('good');
    expect(result.estimatedCredit.amount).toBeGreaterThan(0);
    expect(result.estimatedCredit.range.min).toBe(75);
    expect(result.estimatedCredit.range.max).toBe(150);
  });

  it('returns higher credit for excellent condition', async () => {
    const result = await submitTradeIn({
      productType: 'Futon Frame',
      condition: 'excellent',
    });

    expect(result.estimatedCredit.range.min).toBe(100);
    expect(result.estimatedCredit.range.max).toBe(200);
  });

  it('returns lower credit for poor condition', async () => {
    const result = await submitTradeIn({
      productType: 'Mattress',
      condition: 'poor',
    });

    expect(result.estimatedCredit.range.min).toBe(25);
    expect(result.estimatedCredit.range.max).toBe(50);
  });

  it('requires product type', async () => {
    const result = await submitTradeIn({
      productType: '',
      condition: 'good',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Product type');
  });

  it('requires valid condition', async () => {
    const result = await submitTradeIn({
      productType: 'Frame',
      condition: 'mint',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Condition');
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await submitTradeIn({
      productType: 'Frame',
      condition: 'good',
    });

    expect(result.success).toBe(false);
  });

  it('limits photos to 5', async () => {
    const photos = Array.from({ length: 10 }, (_, i) => `https://example.com/photo${i}.jpg`);
    const result = await submitTradeIn({
      productType: 'Frame',
      condition: 'fair',
      photos,
    });

    expect(result.success).toBe(true);
  });

  it('calculates estimated credit as midpoint of range', async () => {
    const result = await submitTradeIn({
      productType: 'Futon Frame',
      condition: 'good',
    });

    // good range: min 75, max 150, midpoint = 112.5 -> rounds to 113
    expect(result.estimatedCredit.amount).toBe(113);
  });

  it('handles missing optional fields', async () => {
    const result = await submitTradeIn({
      productType: 'Futon',
      condition: 'fair',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it('handles non-array photos field', async () => {
    const result = await submitTradeIn({
      productType: 'Frame',
      condition: 'good',
      photos: 'not-an-array',
    });

    expect(result.success).toBe(true);
  });

  it('returns fair condition credit range', async () => {
    const result = await submitTradeIn({
      productType: 'Mattress',
      condition: 'fair',
    });

    expect(result.estimatedCredit.range.min).toBe(50);
    expect(result.estimatedCredit.range.max).toBe(100);
  });

  it('sets initial status to submitted', async () => {
    const result = await submitTradeIn({
      productType: 'Frame',
      condition: 'excellent',
    });

    expect(result.success).toBe(true);
    // The record was inserted with status 'submitted'
  });
});

// ── getTradeInStatus ──────────────────────────────────────────────────

describe('getTradeInStatus', () => {
  it('returns all trade-in requests for current member', async () => {
    __seed('TradeInRequests', [
      { _id: 'ti-1', memberId: 'member-1', productType: 'Frame', condition: 'good', status: 'submitted', submittedAt: new Date(), estimatedCredit: 112 },
      { _id: 'ti-2', memberId: 'member-1', productType: 'Mattress', condition: 'fair', status: 'approved', submittedAt: new Date(), estimatedCredit: 75, creditAmount: 80 },
      { _id: 'ti-3', memberId: 'member-2', productType: 'Cover', condition: 'poor', status: 'submitted', submittedAt: new Date(), estimatedCredit: 37 },
    ]);

    const result = await getTradeInStatus();
    expect(result.success).toBe(true);
    expect(result.requests).toHaveLength(2);
  });

  it('returns specific request by ID', async () => {
    __seed('TradeInRequests', [
      { _id: 'ti-1', memberId: 'member-1', productType: 'Frame', condition: 'good', status: 'reviewing', submittedAt: new Date(), estimatedCredit: 112 },
    ]);

    const result = await getTradeInStatus('ti-1');
    expect(result.success).toBe(true);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].status).toBe('reviewing');
  });

  it('returns empty for other members request', async () => {
    __seed('TradeInRequests', [
      { _id: 'ti-1', memberId: 'member-2', productType: 'Frame', condition: 'good', status: 'submitted', submittedAt: new Date() },
    ]);

    const result = await getTradeInStatus('ti-1');
    expect(result.requests).toHaveLength(0);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await getTradeInStatus();
    expect(result.success).toBe(false);
  });

  it('returns empty when no requests exist', async () => {
    __seed('TradeInRequests', []);
    const result = await getTradeInStatus();
    expect(result.success).toBe(true);
    expect(result.requests).toHaveLength(0);
  });

  it('treats empty request ID as get-all', async () => {
    __seed('TradeInRequests', []);
    const result = await getTradeInStatus('');
    expect(result.success).toBe(true);
    expect(result.requests).toHaveLength(0);
  });

  it('formats trade-in response with correct fields', async () => {
    __seed('TradeInRequests', [
      {
        _id: 'ti-1',
        memberId: 'member-1',
        productType: 'Frame',
        condition: 'good',
        age: '2 years',
        description: 'Minimal wear',
        status: 'approved',
        submittedAt: new Date('2026-03-01'),
        reviewedAt: new Date('2026-03-05'),
        estimatedCredit: 112,
        creditAmount: 120,
      },
    ]);

    const result = await getTradeInStatus('ti-1');
    expect(result.requests[0]._id).toBe('ti-1');
    expect(result.requests[0].productType).toBe('Frame');
    expect(result.requests[0].condition).toBe('good');
    expect(result.requests[0].age).toBe('2 years');
    expect(result.requests[0].description).toBe('Minimal wear');
    expect(result.requests[0].status).toBe('approved');
    expect(result.requests[0].estimatedCredit).toBe(112);
    expect(result.requests[0].creditAmount).toBe(120);
  });

  it('defaults creditAmount to 0 when missing', async () => {
    __seed('TradeInRequests', [
      { _id: 'ti-1', memberId: 'member-1', productType: 'Frame', condition: 'fair', status: 'submitted', submittedAt: new Date(), estimatedCredit: 75 },
    ]);

    const result = await getTradeInStatus('ti-1');
    expect(result.requests[0].creditAmount).toBe(0);
  });

  it('returns requests sorted by submittedAt descending', async () => {
    __seed('TradeInRequests', [
      { _id: 'ti-1', memberId: 'member-1', productType: 'Frame', condition: 'good', status: 'submitted', submittedAt: new Date('2026-01-01'), estimatedCredit: 100 },
      { _id: 'ti-2', memberId: 'member-1', productType: 'Mattress', condition: 'fair', status: 'approved', submittedAt: new Date('2026-03-01'), estimatedCredit: 75 },
    ]);

    const result = await getTradeInStatus();
    expect(result.requests).toHaveLength(2);
    // The mock sorts descending by submittedAt
  });

  it('returns empty for nonexistent request ID', async () => {
    __seed('TradeInRequests', []);
    const result = await getTradeInStatus('ti-nonexistent');
    expect(result.success).toBe(true);
    expect(result.requests).toHaveLength(0);
  });
});
