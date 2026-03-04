import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const mockItems = [];
let mockTotalCount = 0;

const mockQuery = {
  eq: vi.fn().mockReturnThis(),
  ne: vi.fn().mockReturnThis(),
  ge: vi.fn().mockReturnThis(),
  le: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  ascending: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn(async () => ({ items: mockItems, totalCount: mockTotalCount })),
};

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({ ...mockQuery })),
    get: vi.fn(async (collection, id) => mockItems.find(i => i._id === id)),
    insert: vi.fn(async (collection, record) => ({
      ...record,
      _id: record._id || 'pm-001',
      _createdDate: new Date(),
    })),
    update: vi.fn(async (collection, record) => record),
  },
}));

const mockMember = {
  _id: 'member-001',
  loginEmail: 'jane@example.com',
  contactDetails: { firstName: 'Jane', lastName: 'Smith' },
};

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(async () => mockMember),
    getRoles: vi.fn(async () => [{ title: 'Admin', _id: 'admin' }]),
  },
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember', Admin: 'Admin' },
  webMethod: (perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateId: (id) => {
    if (typeof id !== 'string') return '';
    const cleaned = id.trim().slice(0, 50);
    return /^[a-zA-Z0-9_-]+$/.test(cleaned) ? cleaned : '';
  },
  validateEmail: (email) => {
    if (typeof email !== 'string') return false;
    return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email.trim());
  },
}));

vi.mock('backend/utils/safeParse', () => ({
  safeParse: (str, fallback = null) => {
    if (str == null || str === '') return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
  },
}));

import {
  submitPriceMatchRequest,
  getMyPriceMatches,
  getPriceMatchById,
  reviewPriceMatchRequest,
  getCompetitorSources,
  getPriceMatchStats,
} from '../src/backend/priceMatchService.web.js';

// ── Test Data ────────────────────────────────────────────────────────

const validRequest = {
  productId: 'prod-001',
  productName: 'Eureka Futon Frame',
  ourPrice: 899,
  competitorName: 'Wayfair',
  competitorUrl: 'https://www.wayfair.com/furniture/eureka-futon',
  competitorPrice: 749,
};

const validRequestNoUrl = {
  productId: 'prod-002',
  productName: 'Kodiak Futon',
  ourPrice: 599,
  competitorName: 'Amazon',
  competitorUrl: '',
  competitorPrice: 499,
};

// ── submitPriceMatchRequest ──────────────────────────────────────────

describe('submitPriceMatchRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems.length = 0;
    mockTotalCount = 0;
  });

  it('should submit a valid price match request', async () => {
    const result = await submitPriceMatchRequest(validRequest);
    expect(result.success).toBe(true);
    expect(result.request).toBeDefined();
    expect(result.request.status).toBe('pending');
    expect(result.request.claimNumber).toBeDefined();
    expect(result.request.claimNumber).toMatch(/^PM-/);
  });

  it('should reject when productId is missing', async () => {
    const result = await submitPriceMatchRequest({ ...validRequest, productId: '' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/product/i);
  });

  it('should reject when competitorName is missing', async () => {
    const result = await submitPriceMatchRequest({ ...validRequest, competitorName: '' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/competitor/i);
  });

  it('should reject when competitorPrice is not a positive number', async () => {
    const result = await submitPriceMatchRequest({ ...validRequest, competitorPrice: -10 });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/price/i);
  });

  it('should reject when competitorPrice is zero', async () => {
    const result = await submitPriceMatchRequest({ ...validRequest, competitorPrice: 0 });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/price/i);
  });

  it('should reject when ourPrice is not a positive number', async () => {
    const result = await submitPriceMatchRequest({ ...validRequest, ourPrice: 0 });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/price/i);
  });

  it('should reject when competitor price is higher than our price', async () => {
    const result = await submitPriceMatchRequest({ ...validRequest, competitorPrice: 999 });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/lower|higher|must be less/i);
  });

  it('should reject when competitor price equals our price', async () => {
    const result = await submitPriceMatchRequest({ ...validRequest, competitorPrice: 899 });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/lower|must be less/i);
  });

  it('should reject an invalid competitor URL format', async () => {
    const result = await submitPriceMatchRequest({
      ...validRequest,
      competitorUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/url/i);
  });

  it('should allow empty competitor URL', async () => {
    const result = await submitPriceMatchRequest(validRequestNoUrl);
    expect(result.success).toBe(true);
  });

  it('should sanitize XSS in competitor name', async () => {
    const result = await submitPriceMatchRequest({
      ...validRequest,
      competitorName: '<script>alert("xss")</script>Wayfair',
    });
    expect(result.success).toBe(true);
    expect(result.request.competitorName).not.toContain('<script>');
  });

  it('should sanitize XSS in product name', async () => {
    const result = await submitPriceMatchRequest({
      ...validRequest,
      productName: '<img onerror=alert(1)>Futon',
    });
    expect(result.success).toBe(true);
    expect(result.request.productName).not.toContain('<img');
  });

  it('should reject when not logged in', async () => {
    const { currentMember } = await import('wix-members-backend');
    currentMember.getMember.mockResolvedValueOnce(null);
    const result = await submitPriceMatchRequest(validRequest);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/log.*in|member|auth/i);
  });

  it('should calculate correct price difference', async () => {
    const result = await submitPriceMatchRequest(validRequest);
    expect(result.success).toBe(true);
    expect(result.request.priceDifference).toBe(150); // 899 - 749
  });

  it('should reject null/undefined input', async () => {
    const result1 = await submitPriceMatchRequest(null);
    expect(result1.success).toBe(false);
    const result2 = await submitPriceMatchRequest(undefined);
    expect(result2.success).toBe(false);
  });

  it('should reject when competitor price exceeds sanity limit', async () => {
    const result = await submitPriceMatchRequest({
      ...validRequest,
      competitorPrice: 100000,
      ourPrice: 200000,
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/price/i);
  });

  it('should limit notes length', async () => {
    const longNotes = 'a'.repeat(3000);
    const result = await submitPriceMatchRequest({
      ...validRequest,
      notes: longNotes,
    });
    expect(result.success).toBe(true);
    expect(result.request.notes.length).toBeLessThanOrEqual(2000);
  });

  it('should prevent duplicate pending requests for same product/competitor', async () => {
    mockItems.push({
      _id: 'pm-existing',
      productId: 'prod-001',
      competitorName: 'wayfair',
      status: 'pending',
      memberId: 'member-001',
    });
    mockTotalCount = 1;
    const result = await submitPriceMatchRequest(validRequest);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already|pending|duplicate/i);
  });
});

// ── getMyPriceMatches ────────────────────────────────────────────────

describe('getMyPriceMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems.length = 0;
    mockTotalCount = 0;
  });

  it('should return empty array when no matches', async () => {
    const result = await getMyPriceMatches();
    expect(result.requests).toEqual([]);
  });

  it('should return member price match requests', async () => {
    mockItems.push({
      _id: 'pm-001',
      productName: 'Eureka Futon',
      competitorName: 'Wayfair',
      status: 'pending',
      memberId: 'member-001',
    });
    mockTotalCount = 1;
    const result = await getMyPriceMatches();
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].productName).toBe('Eureka Futon');
  });

  it('should return empty when not logged in', async () => {
    const { currentMember } = await import('wix-members-backend');
    currentMember.getMember.mockResolvedValueOnce(null);
    const result = await getMyPriceMatches();
    expect(result.requests).toEqual([]);
  });
});

// ── getPriceMatchById ────────────────────────────────────────────────

describe('getPriceMatchById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems.length = 0;
  });

  it('should return a price match by ID', async () => {
    mockItems.push({
      _id: 'pm-001',
      claimNumber: 'PM-TEST-001',
      productName: 'Eureka Futon',
      status: 'pending',
      memberId: 'member-001',
    });
    const result = await getPriceMatchById('pm-001');
    expect(result.request).toBeDefined();
    expect(result.request.claimNumber).toBe('PM-TEST-001');
  });

  it('should return error for empty ID', async () => {
    const result = await getPriceMatchById('');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/id/i);
  });

  it('should return error for invalid ID format', async () => {
    const result = await getPriceMatchById('<script>alert(1)</script>');
    expect(result.success).toBe(false);
  });

  it('should return error when record not found', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.get.mockResolvedValueOnce(null);
    const result = await getPriceMatchById('pm-nonexistent');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });
});

// ── reviewPriceMatchRequest (Admin) ──────────────────────────────────

describe('reviewPriceMatchRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems.length = 0;
  });

  it('should approve a pending request', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.get.mockResolvedValueOnce({
      _id: 'pm-001',
      status: 'pending',
      ourPrice: 899,
      competitorPrice: 749,
      priceDifference: 150,
    });
    const result = await reviewPriceMatchRequest('pm-001', 'approved', 'Verified on Wayfair');
    expect(result.success).toBe(true);
    expect(result.request.status).toBe('approved');
    expect(result.request.creditAmount).toBeDefined();
  });

  it('should deny a pending request', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.get.mockResolvedValueOnce({
      _id: 'pm-002',
      status: 'pending',
      ourPrice: 899,
      competitorPrice: 749,
    });
    const result = await reviewPriceMatchRequest('pm-002', 'denied', 'Product not identical');
    expect(result.success).toBe(true);
    expect(result.request.status).toBe('denied');
  });

  it('should reject invalid decision', async () => {
    const result = await reviewPriceMatchRequest('pm-001', 'maybe', 'notes');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/decision|approved|denied/i);
  });

  it('should reject review of non-pending request', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.get.mockResolvedValueOnce({
      _id: 'pm-001',
      status: 'approved',
    });
    const result = await reviewPriceMatchRequest('pm-001', 'denied', 'Changed mind');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already|pending/i);
  });

  it('should reject review with empty ID', async () => {
    const result = await reviewPriceMatchRequest('', 'approved', 'notes');
    expect(result.success).toBe(false);
  });

  it('should reject review when request not found', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.get.mockResolvedValueOnce(null);
    const result = await reviewPriceMatchRequest('pm-ghost', 'approved', 'notes');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it('should sanitize admin notes', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.get.mockResolvedValueOnce({
      _id: 'pm-001',
      status: 'pending',
      ourPrice: 899,
      competitorPrice: 749,
      priceDifference: 150,
    });
    const result = await reviewPriceMatchRequest(
      'pm-001',
      'approved',
      '<script>alert("xss")</script>Verified'
    );
    expect(result.success).toBe(true);
    expect(result.request.adminNotes).not.toContain('<script>');
  });

  it('should set credit amount to price difference on approval', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.get.mockResolvedValueOnce({
      _id: 'pm-001',
      status: 'pending',
      ourPrice: 899,
      competitorPrice: 749,
      priceDifference: 150,
    });
    const result = await reviewPriceMatchRequest('pm-001', 'approved', 'Verified');
    expect(result.request.creditAmount).toBe(150);
  });
});

// ── getCompetitorSources ─────────────────────────────────────────────

describe('getCompetitorSources', () => {
  it('should return the list of approved competitor sources', async () => {
    const result = await getCompetitorSources();
    expect(result.competitors).toBeDefined();
    expect(Array.isArray(result.competitors)).toBe(true);
    expect(result.competitors.length).toBeGreaterThan(0);
    expect(result.competitors[0]).toHaveProperty('name');
    expect(result.competitors[0]).toHaveProperty('domain');
  });
});

// ── getPriceMatchStats (Admin) ───────────────────────────────────────

describe('getPriceMatchStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems.length = 0;
    mockTotalCount = 0;
  });

  it('should return stats with zero counts when empty', async () => {
    const result = await getPriceMatchStats();
    expect(result.stats).toBeDefined();
    expect(result.stats.total).toBe(0);
    expect(result.stats.pending).toBe(0);
    expect(result.stats.approved).toBe(0);
    expect(result.stats.denied).toBe(0);
  });

  it('should count requests by status', async () => {
    mockItems.push(
      { status: 'pending' },
      { status: 'pending' },
      { status: 'approved', creditAmount: 100 },
      { status: 'denied' },
    );
    mockTotalCount = 4;
    const result = await getPriceMatchStats();
    expect(result.stats.total).toBe(4);
    expect(result.stats.pending).toBe(2);
    expect(result.stats.approved).toBe(1);
    expect(result.stats.denied).toBe(1);
  });

  it('should calculate total credit amount', async () => {
    mockItems.push(
      { status: 'approved', creditAmount: 100 },
      { status: 'approved', creditAmount: 75 },
      { status: 'denied', creditAmount: 0 },
    );
    mockTotalCount = 3;
    const result = await getPriceMatchStats();
    expect(result.stats.totalCreditIssued).toBe(175);
  });
});

// ── Edge Cases & Security ────────────────────────────────────────────

describe('Edge cases and security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems.length = 0;
    mockTotalCount = 0;
  });

  it('should handle wix-data query failure gracefully in submit', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => {
      throw new Error('Database connection lost');
    });
    const result = await submitPriceMatchRequest(validRequest);
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });

  it('should handle wix-data insert failure gracefully', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.insert.mockRejectedValueOnce(new Error('Insert failed'));
    const result = await submitPriceMatchRequest(validRequest);
    expect(result.success).toBe(false);
  });

  it('should handle wix-data query failure in getMyPriceMatches', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => {
      throw new Error('Query failed');
    });
    const result = await getMyPriceMatches();
    expect(result.requests).toEqual([]);
  });

  it('should handle wix-data get failure in getPriceMatchById', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.get.mockRejectedValueOnce(new Error('Get failed'));
    const result = await getPriceMatchById('pm-001');
    expect(result.success).toBe(false);
  });

  it('should handle non-string competitor URL (number)', async () => {
    const result = await submitPriceMatchRequest({
      ...validRequest,
      competitorUrl: 12345,
    });
    expect(result.success).toBe(false);
  });

  it('should handle NaN competitor price', async () => {
    const result = await submitPriceMatchRequest({
      ...validRequest,
      competitorPrice: NaN,
    });
    expect(result.success).toBe(false);
  });

  it('should handle Infinity competitor price', async () => {
    const result = await submitPriceMatchRequest({
      ...validRequest,
      competitorPrice: Infinity,
    });
    expect(result.success).toBe(false);
  });

  it('should handle string competitor price', async () => {
    const result = await submitPriceMatchRequest({
      ...validRequest,
      competitorPrice: '749',
    });
    // Should coerce or reject — implementation decides
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('should reject javascript: protocol URLs', async () => {
    const result = await submitPriceMatchRequest({
      ...validRequest,
      competitorUrl: 'javascript:alert(1)',
    });
    expect(result.success).toBe(false);
  });

  it('should reject data: protocol URLs', async () => {
    const result = await submitPriceMatchRequest({
      ...validRequest,
      competitorUrl: 'data:text/html,<h1>hi</h1>',
    });
    expect(result.success).toBe(false);
  });
});
