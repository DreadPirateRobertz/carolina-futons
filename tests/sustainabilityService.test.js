import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (perm, fn) => fn,
}));

const mockQueryChain = {
  eq: vi.fn().mockReturnThis(),
  ne: vi.fn().mockReturnThis(),
  hasSome: vi.fn().mockReturnThis(),
  ascending: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
  count: vi.fn().mockResolvedValue(0),
};

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({ ...mockQueryChain })),
    get: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockImplementation(async (col, data) => ({ ...data, _id: 'new-req-id', _createdDate: new Date() })),
    update: vi.fn().mockImplementation(async (col, data) => data),
  },
}));

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn().mockResolvedValue({ _id: 'member-1', loginEmail: 'test@example.com' }),
    getRoles: vi.fn().mockResolvedValue([{ title: 'Admin', _id: 'admin' }]),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.slice(0, maxLen);
  },
}));

import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import {
  getSustainabilityInfo,
  getBatchSustainabilityBadges,
  calculateCarbonOffset,
  estimateTradeInCredit,
  submitTradeIn,
  getTradeInStatus,
  getMyTradeIns,
  moderateTradeIn,
  getPendingTradeIns,
  getSustainabilityStats,
} from '../src/backend/sustainabilityService.web.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryChain.eq.mockReturnThis();
  mockQueryChain.ne.mockReturnThis();
  mockQueryChain.hasSome.mockReturnThis();
  mockQueryChain.ascending.mockReturnThis();
  mockQueryChain.descending.mockReturnThis();
  mockQueryChain.limit.mockReturnThis();
  mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });
  mockQueryChain.count.mockResolvedValue(0);
  wixData.get.mockResolvedValue(null);
  wixData.insert.mockImplementation(async (col, data) => ({ ...data, _id: 'new-req-id', _createdDate: new Date() }));
  wixData.update.mockImplementation(async (col, data) => data);
  currentMember.getMember.mockResolvedValue({ _id: 'member-1', loginEmail: 'test@example.com' });
  currentMember.getRoles.mockResolvedValue([{ title: 'Admin', _id: 'admin' }]);
});

// ── getSustainabilityInfo ───────────────────────────────────────────

describe('getSustainabilityInfo', () => {
  it('returns error for empty product ID', async () => {
    const result = await getSustainabilityInfo('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID required');
  });

  it('returns found:false when no sustainability data', async () => {
    const result = await getSustainabilityInfo('prod-1');
    expect(result.success).toBe(true);
    expect(result.found).toBe(false);
    expect(result.info).toBeNull();
  });

  it('returns sustainability info for product', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        productId: 'prod-1',
        materialSource: 'FSC-certified hardwood',
        durabilityRating: 4,
        recyclabilityPercent: 85,
        carbonFootprintKg: 45.5,
        certifications: ['FSC', 'GREENGUARD'],
        ecoScore: 'A',
        tradeInEligible: true,
        tradeInCreditMin: 75,
        tradeInCreditMax: 200,
      }],
      totalCount: 1,
    });

    const result = await getSustainabilityInfo('prod-1');
    expect(result.success).toBe(true);
    expect(result.found).toBe(true);
    expect(result.info.materialSource).toBe('FSC-certified hardwood');
    expect(result.info.durabilityRating).toBe(4);
    expect(result.info.recyclabilityPercent).toBe(85);
    expect(result.info.certifications).toEqual(['FSC', 'GREENGUARD']);
    expect(result.info.ecoScore).toBe('A');
    expect(result.info.tradeInCreditRange).toEqual({ min: 75, max: 200 });
  });

  it('returns null tradeInCreditRange when not eligible', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        productId: 'prod-2',
        tradeInEligible: false,
        durabilityRating: 3,
        recyclabilityPercent: 40,
        ecoScore: 'C',
      }],
      totalCount: 1,
    });

    const result = await getSustainabilityInfo('prod-2');
    expect(result.info.tradeInCreditRange).toBeNull();
  });

  it('handles DB errors gracefully', async () => {
    mockQueryChain.find.mockRejectedValueOnce(new Error('DB down'));
    const result = await getSustainabilityInfo('prod-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unable to fetch sustainability info');
  });
});

// ── getBatchSustainabilityBadges ────────────────────────────────────

describe('getBatchSustainabilityBadges', () => {
  it('returns empty badges for empty array', async () => {
    const result = await getBatchSustainabilityBadges([]);
    expect(result.success).toBe(true);
    expect(result.badges).toEqual({});
  });

  it('returns empty badges for non-array input', async () => {
    const result = await getBatchSustainabilityBadges(null);
    expect(result.success).toBe(true);
    expect(result.badges).toEqual({});
  });

  it('generates correct badges for eco-score A product', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        productId: 'prod-1',
        ecoScore: 'A',
        certifications: ['FSC'],
        durabilityRating: 5,
        recyclabilityPercent: 90,
        tradeInEligible: true,
      }],
      totalCount: 1,
    });

    const result = await getBatchSustainabilityBadges(['prod-1']);
    expect(result.success).toBe(true);
    const badges = result.badges['prod-1'];
    expect(badges.length).toBe(5); // eco-score, certified, durable, recyclable, trade-in
    expect(badges[0].type).toBe('eco-score');
    expect(badges[0].label).toBe('Eco Score: A');
    expect(badges[1].type).toBe('certified');
    expect(badges[2].type).toBe('durable');
    expect(badges[3].type).toBe('recyclable');
    expect(badges[4].type).toBe('trade-in');
  });

  it('skips products with no notable badges', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        productId: 'prod-low',
        ecoScore: 'D',
        certifications: [],
        durabilityRating: 2,
        recyclabilityPercent: 30,
        tradeInEligible: false,
      }],
      totalCount: 1,
    });

    const result = await getBatchSustainabilityBadges(['prod-low']);
    expect(result.badges['prod-low']).toBeUndefined();
  });

  it('limits to 50 product IDs', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `prod-${i}`);
    await getBatchSustainabilityBadges(ids);
    const callArgs = mockQueryChain.hasSome.mock.calls[0];
    expect(callArgs[1].length).toBeLessThanOrEqual(50);
  });

  it('handles DB errors gracefully', async () => {
    mockQueryChain.find.mockRejectedValueOnce(new Error('DB down'));
    const result = await getBatchSustainabilityBadges(['prod-1']);
    expect(result.success).toBe(false);
  });
});

// ── calculateCarbonOffset ───────────────────────────────────────────

describe('calculateCarbonOffset', () => {
  it('returns zero for empty array', async () => {
    const result = await calculateCarbonOffset([]);
    expect(result.success).toBe(true);
    expect(result.totalKg).toBe(0);
    expect(result.offsetCost).toBe(0);
  });

  it('calculates offset for single product', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'prod-1', carbonFootprintKg: 50 }],
      totalCount: 1,
    });

    const result = await calculateCarbonOffset(['prod-1']);
    expect(result.success).toBe(true);
    expect(result.totalKg).toBe(50);
    expect(result.offsetCost).toBe(1.0); // 50 * 0.02
    expect(result.products.length).toBe(1);
    expect(result.products[0].offsetCost).toBe(1.0);
  });

  it('calculates offset for multiple products', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { productId: 'prod-1', carbonFootprintKg: 50 },
        { productId: 'prod-2', carbonFootprintKg: 30 },
      ],
      totalCount: 2,
    });

    const result = await calculateCarbonOffset(['prod-1', 'prod-2']);
    expect(result.totalKg).toBe(80);
    expect(result.offsetCost).toBe(1.6); // 80 * 0.02
    expect(result.products.length).toBe(2);
  });

  it('limits to 20 product IDs', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `prod-${i}`);
    await calculateCarbonOffset(ids);
    const callArgs = mockQueryChain.hasSome.mock.calls[0];
    expect(callArgs[1].length).toBeLessThanOrEqual(20);
  });

  it('handles products with zero carbon footprint', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'prod-1', carbonFootprintKg: 0 }],
      totalCount: 1,
    });

    const result = await calculateCarbonOffset(['prod-1']);
    expect(result.totalKg).toBe(0);
    expect(result.offsetCost).toBe(0);
  });

  it('handles DB errors gracefully', async () => {
    mockQueryChain.find.mockRejectedValueOnce(new Error('fail'));
    const result = await calculateCarbonOffset(['prod-1']);
    expect(result.success).toBe(false);
  });
});

// ── estimateTradeInCredit ───────────────────────────────────────────

describe('estimateTradeInCredit', () => {
  it('returns error for missing category', async () => {
    const result = await estimateTradeInCredit('', 'good');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Category and condition required');
  });

  it('returns error for invalid category', async () => {
    const result = await estimateTradeInCredit('invalid-cat', 'good');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid product category');
  });

  it('returns error for invalid condition', async () => {
    const result = await estimateTradeInCredit('futon-frames', 'terrible');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid condition');
  });

  it('calculates correct credit for futon-frames/excellent', async () => {
    const result = await estimateTradeInCredit('futon-frames', 'excellent');
    expect(result.success).toBe(true);
    expect(result.creditRange.min).toBe(75);
    expect(result.creditRange.max).toBe(200);
  });

  it('calculates correct credit for futon-frames/fair', async () => {
    const result = await estimateTradeInCredit('futon-frames', 'fair');
    expect(result.success).toBe(true);
    expect(result.creditRange.min).toBe(38); // 75 * 0.5 = 37.5 → 38
    expect(result.creditRange.max).toBe(100); // 200 * 0.5
  });

  it('calculates correct credit for mattresses/poor', async () => {
    const result = await estimateTradeInCredit('mattresses', 'poor');
    expect(result.success).toBe(true);
    expect(result.creditRange.min).toBe(13); // 50 * 0.25 = 12.5 → 13
    expect(result.creditRange.max).toBe(25); // 100 * 0.25
  });

  it('includes human-readable message', async () => {
    const result = await estimateTradeInCredit('outdoor-furniture', 'good');
    expect(result.message).toContain('outdoor furniture');
    expect(result.message).toContain('good');
    expect(result.message).toContain('$');
  });
});

// ── submitTradeIn ───────────────────────────────────────────────────

describe('submitTradeIn', () => {
  it('requires login', async () => {
    currentMember.getMember.mockResolvedValueOnce(null);
    const result = await submitTradeIn({ category: 'futon-frames', condition: 'good' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('requires category and condition', async () => {
    const result = await submitTradeIn({ category: '', condition: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Category and condition required');
  });

  it('rejects invalid category', async () => {
    const result = await submitTradeIn({ category: 'invalid', condition: 'good' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid product category');
  });

  it('rejects invalid condition', async () => {
    const result = await submitTradeIn({ category: 'futon-frames', condition: 'broken' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid condition');
  });

  it('creates trade-in request with correct data', async () => {
    const result = await submitTradeIn({
      category: 'futon-frames',
      condition: 'good',
      description: 'Oak frame, 5 years old',
      photos: ['https://example.com/photo1.jpg'],
    });

    expect(result.success).toBe(true);
    expect(result.requestId).toBe('new-req-id');
    expect(result.creditRange.min).toBe(56); // 75 * 0.75 = 56.25 → 56
    expect(result.creditRange.max).toBe(150); // 200 * 0.75

    const insertCall = wixData.insert.mock.calls[0];
    expect(insertCall[0]).toBe('TradeInRequests');
    expect(insertCall[1].memberId).toBe('member-1');
    expect(insertCall[1].productCategory).toBe('futon-frames');
    expect(insertCall[1].status).toBe('pending');
  });

  it('limits photos to 5', async () => {
    const photos = Array.from({ length: 8 }, (_, i) => `https://example.com/photo${i}.jpg`);
    await submitTradeIn({
      category: 'mattresses',
      condition: 'excellent',
      photos,
    });

    const insertCall = wixData.insert.mock.calls[0];
    expect(insertCall[1].photos.length).toBeLessThanOrEqual(5);
  });

  it('handles DB errors gracefully', async () => {
    wixData.insert.mockRejectedValueOnce(new Error('insert fail'));
    const result = await submitTradeIn({ category: 'futon-frames', condition: 'good' });
    expect(result.success).toBe(false);
  });
});

// ── getTradeInStatus ────────────────────────────────────────────────

describe('getTradeInStatus', () => {
  it('requires login', async () => {
    currentMember.getMember.mockResolvedValueOnce(null);
    const result = await getTradeInStatus('req-1');
    expect(result.success).toBe(false);
  });

  it('returns error for missing request ID', async () => {
    const result = await getTradeInStatus('');
    expect(result.success).toBe(false);
  });

  it('returns error for not found', async () => {
    wixData.get.mockResolvedValueOnce(null);
    const result = await getTradeInStatus('req-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('denies access to other member requests', async () => {
    wixData.get.mockResolvedValueOnce({ _id: 'req-1', memberId: 'other-member' });
    const result = await getTradeInStatus('req-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('returns request status for owner', async () => {
    wixData.get.mockResolvedValueOnce({
      _id: 'req-1',
      memberId: 'member-1',
      productCategory: 'futon-frames',
      condition: 'good',
      description: 'Oak frame',
      estimatedCredit: 100,
      status: 'approved',
      adminNotes: 'Looks great',
      _createdDate: new Date(),
    });

    const result = await getTradeInStatus('req-1');
    expect(result.success).toBe(true);
    expect(result.request.status).toBe('approved');
    expect(result.request.adminNotes).toBe('Looks great');
  });

  it('hides admin notes for pending requests', async () => {
    wixData.get.mockResolvedValueOnce({
      _id: 'req-1',
      memberId: 'member-1',
      status: 'pending',
      adminNotes: 'Internal note',
      _createdDate: new Date(),
    });

    const result = await getTradeInStatus('req-1');
    expect(result.request.adminNotes).toBe('');
  });
});

// ── getMyTradeIns ───────────────────────────────────────────────────

describe('getMyTradeIns', () => {
  it('requires login', async () => {
    currentMember.getMember.mockResolvedValueOnce(null);
    const result = await getMyTradeIns();
    expect(result.success).toBe(false);
  });

  it('returns member trade-in list', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { _id: 'req-1', productCategory: 'futon-frames', condition: 'good', estimatedCredit: 100, status: 'approved', _createdDate: new Date() },
        { _id: 'req-2', productCategory: 'mattresses', condition: 'fair', estimatedCredit: 38, status: 'pending', _createdDate: new Date() },
      ],
      totalCount: 2,
    });

    const result = await getMyTradeIns();
    expect(result.success).toBe(true);
    expect(result.requests.length).toBe(2);
    expect(result.requests[0]._id).toBe('req-1');
  });
});

// ── moderateTradeIn ─────────────────────────────────────────────────

describe('moderateTradeIn', () => {
  it('requires admin', async () => {
    currentMember.getRoles.mockResolvedValueOnce([]);
    const result = await moderateTradeIn('req-1', { action: 'approved' });
    expect(result.success).toBe(false);
  });

  it('requires valid action', async () => {
    const result = await moderateTradeIn('req-1', { action: 'maybe' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Action must be');
  });

  it('requires request ID', async () => {
    const result = await moderateTradeIn('', { action: 'approved' });
    expect(result.success).toBe(false);
  });

  it('returns error for not found', async () => {
    wixData.get.mockResolvedValueOnce(null);
    const result = await moderateTradeIn('req-1', { action: 'approved' });
    expect(result.success).toBe(false);
  });

  it('rejects already-processed requests', async () => {
    wixData.get.mockResolvedValueOnce({ _id: 'req-1', status: 'approved' });
    const result = await moderateTradeIn('req-1', { action: 'approved' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already approved');
  });

  it('approves pending request', async () => {
    wixData.get.mockResolvedValueOnce({
      _id: 'req-1',
      status: 'pending',
      estimatedCredit: 100,
    });

    const result = await moderateTradeIn('req-1', {
      action: 'approved',
      notes: 'Verified condition',
      creditAmount: 120,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('approved');
    expect(result.creditAmount).toBe(120);

    const updateCall = wixData.update.mock.calls[0];
    expect(updateCall[1].status).toBe('approved');
    expect(updateCall[1].reviewedBy).toBe('member-1');
  });

  it('rejects pending request', async () => {
    wixData.get.mockResolvedValueOnce({
      _id: 'req-1',
      status: 'pending',
      estimatedCredit: 100,
    });

    const result = await moderateTradeIn('req-1', {
      action: 'rejected',
      notes: 'Item too damaged',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('rejected');
  });
});

// ── getPendingTradeIns ──────────────────────────────────────────────

describe('getPendingTradeIns', () => {
  it('requires admin', async () => {
    currentMember.getRoles.mockResolvedValueOnce([]);
    const result = await getPendingTradeIns();
    expect(result.success).toBe(false);
  });

  it('returns pending requests with details', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'req-1',
        memberId: 'member-1',
        memberEmail: 'test@example.com',
        productCategory: 'futon-frames',
        condition: 'good',
        description: 'Oak frame',
        photos: ['https://example.com/photo.jpg'],
        estimatedCredit: 100,
        status: 'pending',
        _createdDate: new Date(),
      }],
      totalCount: 1,
    });

    const result = await getPendingTradeIns();
    expect(result.success).toBe(true);
    expect(result.requests.length).toBe(1);
    expect(result.requests[0].memberEmail).toBe('test@example.com');
  });

  it('supports status filter', async () => {
    await getPendingTradeIns({ status: 'approved' });
    expect(mockQueryChain.eq).toHaveBeenCalledWith('status', 'approved');
  });

  it('supports "all" status', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    await getPendingTradeIns({ status: 'all' });
    // eq should not be called with 'status' when 'all'
    const statusCalls = mockQueryChain.eq.mock.calls.filter(c => c[0] === 'status');
    expect(statusCalls.length).toBe(0);
  });

  it('caps limit at 100', async () => {
    await getPendingTradeIns({ limit: 200 });
    expect(mockQueryChain.limit).toHaveBeenCalledWith(100);
  });
});

// ── getSustainabilityStats ──────────────────────────────────────────

describe('getSustainabilityStats', () => {
  it('requires admin', async () => {
    currentMember.getRoles.mockResolvedValueOnce([]);
    const result = await getSustainabilityStats();
    expect(result.success).toBe(false);
  });

  it('calculates correct stats', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { durabilityRating: 4, recyclabilityPercent: 80, ecoScore: 'A', tradeInEligible: true },
        { durabilityRating: 3, recyclabilityPercent: 60, ecoScore: 'B', tradeInEligible: false },
        { durabilityRating: 2, recyclabilityPercent: 40, ecoScore: 'C', tradeInEligible: false },
      ],
      totalCount: 3,
    });

    // Mock count calls for trade-in stats
    mockQueryChain.count
      .mockResolvedValueOnce(5)   // pending
      .mockResolvedValueOnce(3)   // approved
      .mockResolvedValueOnce(10); // completed

    const result = await getSustainabilityStats();
    expect(result.success).toBe(true);
    expect(result.stats.totalProducts).toBe(3);
    expect(result.stats.tradeInEligible).toBe(1);
    expect(result.stats.avgDurability).toBe(3);
    expect(result.stats.avgRecyclability).toBe(60);
    expect(result.stats.ecoScoreCounts.A).toBe(1);
    expect(result.stats.ecoScoreCounts.B).toBe(1);
    expect(result.stats.ecoScoreCounts.C).toBe(1);
    expect(result.stats.tradeIns.pending).toBe(5);
    expect(result.stats.tradeIns.approved).toBe(3);
    expect(result.stats.tradeIns.completed).toBe(10);
  });

  it('handles empty catalog', async () => {
    const result = await getSustainabilityStats();
    expect(result.success).toBe(true);
    expect(result.stats.totalProducts).toBe(0);
    expect(result.stats.avgDurability).toBe(0);
  });
});
