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
});
