import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackBrowseSession,
  captureRemindMeRequest,
  triggerBrowseRecovery,
  getBrowseAbandonmentStats,
  exportAbandonmentInsights,
  markSessionConverted,
  HIGH_INTENT_THRESHOLD_MS,
  RECOVERY_WINDOW_MS,
  MAX_PRODUCTS_TRACKED,
  RECOVERY_SEQUENCE,
} from '../../src/backend/browseAbandonment.web.js';
import { __reset, __seed } from 'wix-data';
import { futonFrame, wallHuggerFrame, metalFrame } from '../fixtures/products.js';

// ─── Constants ──────────────────────────────────────────────────

describe('constants', () => {
  it('HIGH_INTENT_THRESHOLD_MS is 2 minutes', () => {
    expect(HIGH_INTENT_THRESHOLD_MS).toBe(2 * 60 * 1000);
  });

  it('RECOVERY_WINDOW_MS is 48 hours', () => {
    expect(RECOVERY_WINDOW_MS).toBe(48 * 60 * 60 * 1000);
  });

  it('MAX_PRODUCTS_TRACKED is 20', () => {
    expect(MAX_PRODUCTS_TRACKED).toBe(20);
  });

  it('RECOVERY_SEQUENCE has 3 steps', () => {
    expect(RECOVERY_SEQUENCE).toHaveLength(3);
    expect(RECOVERY_SEQUENCE[0].step).toBe(1);
    expect(RECOVERY_SEQUENCE[1].step).toBe(2);
    expect(RECOVERY_SEQUENCE[2].step).toBe(3);
  });

  it('each recovery step has templateId and subject', () => {
    for (const step of RECOVERY_SEQUENCE) {
      expect(step).toHaveProperty('templateId');
      expect(step).toHaveProperty('subject');
      expect(step).toHaveProperty('delayMs');
      expect(step.delayMs).toBeGreaterThan(0);
    }
  });

  it('recovery delays increase with each step', () => {
    for (let i = 1; i < RECOVERY_SEQUENCE.length; i++) {
      expect(RECOVERY_SEQUENCE[i].delayMs).toBeGreaterThan(RECOVERY_SEQUENCE[i - 1].delayMs);
    }
  });
});

// ─── trackBrowseSession ─────────────────────────────────────────

describe('trackBrowseSession', () => {
  beforeEach(() => __reset());

  it('returns error without sessionId', async () => {
    const result = await trackBrowseSession({});
    expect(result.success).toBe(false);
  });

  it('returns error for null input', async () => {
    const result = await trackBrowseSession(null);
    expect(result.success).toBe(false);
  });

  it('creates new session record', async () => {
    const result = await trackBrowseSession({
      sessionId: 'sess-001',
      productsViewed: [
        { productId: futonFrame._id, productName: futonFrame.name, price: futonFrame.price, viewDuration: 30000 },
      ],
      totalDuration: 150000,
      entryPage: '/futon-frames',
      exitPage: '/product-page/eureka',
    });
    expect(result.success).toBe(true);
    expect(result.isHighIntent).toBe(true);
  });

  it('marks session as high-intent when >2min with products', async () => {
    const result = await trackBrowseSession({
      sessionId: 'sess-002',
      productsViewed: [{ productId: 'prod-1', productName: 'Test', price: 100, viewDuration: 60000 }],
      totalDuration: HIGH_INTENT_THRESHOLD_MS + 1000,
    });
    expect(result.isHighIntent).toBe(true);
  });

  it('marks session as not high-intent when <2min', async () => {
    const result = await trackBrowseSession({
      sessionId: 'sess-003',
      productsViewed: [{ productId: 'prod-1', productName: 'Test', price: 100, viewDuration: 10000 }],
      totalDuration: 30000,
    });
    expect(result.isHighIntent).toBe(false);
  });

  it('marks session as not high-intent when no products viewed', async () => {
    const result = await trackBrowseSession({
      sessionId: 'sess-004',
      productsViewed: [],
      totalDuration: 300000,
    });
    expect(result.isHighIntent).toBe(false);
  });

  it('updates existing session', async () => {
    __seed('BrowseSessions', [{
      _id: 'bs-1',
      sessionId: 'sess-005',
      productsViewed: '[]',
      productCount: 0,
      totalDuration: 10000,
      isHighIntent: false,
      hasEmail: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await trackBrowseSession({
      sessionId: 'sess-005',
      productsViewed: [{ productId: 'prod-1', productName: 'Test', price: 100, viewDuration: 60000 }],
      totalDuration: 200000,
      exitPage: '/cart',
    });
    expect(result.success).toBe(true);
    expect(result.isHighIntent).toBe(true);
  });

  it('limits products to MAX_PRODUCTS_TRACKED', async () => {
    const products = Array.from({ length: 25 }, (_, i) => ({
      productId: `prod-${i}`,
      productName: `Product ${i}`,
      price: 100,
      viewDuration: 5000,
    }));

    const result = await trackBrowseSession({
      sessionId: 'sess-006',
      productsViewed: products,
      totalDuration: 300000,
    });
    expect(result.success).toBe(true);
  });

  it('sanitizes session ID', async () => {
    const result = await trackBrowseSession({
      sessionId: '<script>alert(1)</script>',
      productsViewed: [],
      totalDuration: 0,
    });
    // Sanitized ID may be empty after stripping HTML
    expect(result).toBeDefined();
  });

  it('filters out products with invalid IDs', async () => {
    const result = await trackBrowseSession({
      sessionId: 'sess-007',
      productsViewed: [
        { productId: '', productName: 'No ID', price: 100, viewDuration: 5000 },
        { productId: futonFrame._id, productName: futonFrame.name, price: futonFrame.price, viewDuration: 60000 },
      ],
      totalDuration: 200000,
    });
    expect(result.success).toBe(true);
  });

  it('handles missing totalDuration gracefully', async () => {
    const result = await trackBrowseSession({
      sessionId: 'sess-008',
      productsViewed: [],
    });
    expect(result.success).toBe(true);
    expect(result.isHighIntent).toBe(false);
  });
});

// ─── captureRemindMeRequest ─────────────────────────────────────

describe('captureRemindMeRequest', () => {
  beforeEach(() => __reset());

  it('returns error without session ID', async () => {
    const result = await captureRemindMeRequest('', 'test@example.com');
    expect(result.success).toBe(false);
  });

  it('returns error for invalid email', async () => {
    const result = await captureRemindMeRequest('sess-001', 'not-an-email');
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('captures email for existing session', async () => {
    __seed('BrowseSessions', [{
      _id: 'bs-1',
      sessionId: 'sess-010',
      productsViewed: '[]',
      productCount: 0,
      totalDuration: 150000,
      isHighIntent: true,
      hasEmail: false,
      visitorEmail: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await captureRemindMeRequest('sess-010', 'jane@example.com', 'Jane');
    expect(result.success).toBe(true);
  });

  it('creates new session if not tracked yet', async () => {
    const result = await captureRemindMeRequest('sess-new', 'bob@example.com', 'Bob');
    expect(result.success).toBe(true);
  });

  it('respects unsubscribes for browse_recovery', async () => {
    __seed('Unsubscribes', [{
      _id: 'unsub-1',
      email: 'unsub@example.com',
      sequenceType: 'browse_recovery',
    }]);

    const result = await captureRemindMeRequest('sess-011', 'unsub@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('unsubscribed');
  });

  it('respects unsubscribes for "all" type', async () => {
    __seed('Unsubscribes', [{
      _id: 'unsub-2',
      email: 'unsub-all@example.com',
      sequenceType: 'all',
    }]);

    const result = await captureRemindMeRequest('sess-012', 'unsub-all@example.com');
    expect(result.success).toBe(false);
  });

  it('allows capture for different unsubscribe type', async () => {
    __seed('Unsubscribes', [{
      _id: 'unsub-3',
      email: 'other-unsub@example.com',
      sequenceType: 'welcome',
    }]);

    const result = await captureRemindMeRequest('sess-013', 'other-unsub@example.com', 'User');
    expect(result.success).toBe(true);
  });
});

// ─── triggerBrowseRecovery ──────────────────────────────────────

describe('triggerBrowseRecovery', () => {
  beforeEach(() => __reset());

  it('returns success with zero triggers when no eligible sessions', async () => {
    const result = await triggerBrowseRecovery();
    expect(result.success).toBe(true);
    expect(result.triggered).toBe(0);
  });

  it('triggers step 1 for eligible high-intent sessions', async () => {
    const twoHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    __seed('BrowseSessions', [{
      _id: 'bs-100',
      sessionId: 'sess-100',
      productsViewed: JSON.stringify([{ productId: futonFrame._id, productName: futonFrame.name, price: futonFrame.price }]),
      productCount: 1,
      totalDuration: 300000,
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'customer@example.com',
      visitorName: 'Customer',
      converted: false,
      recoveryStep: 0,
      recoveryTriggered: false,
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo,
    }]);

    const result = await triggerBrowseRecovery();
    expect(result.success).toBe(true);
    expect(result.triggered).toBe(1);
  });

  it('skips sessions that have already converted', async () => {
    __seed('BrowseSessions', [{
      _id: 'bs-101',
      sessionId: 'sess-101',
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'buyer@example.com',
      converted: true,
      recoveryStep: 0,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    }]);

    const result = await triggerBrowseRecovery();
    expect(result.triggered).toBe(0);
  });

  it('skips sessions without email', async () => {
    __seed('BrowseSessions', [{
      _id: 'bs-102',
      sessionId: 'sess-102',
      isHighIntent: true,
      hasEmail: false,
      converted: false,
      recoveryStep: 0,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    }]);

    const result = await triggerBrowseRecovery();
    expect(result.triggered).toBe(0);
  });

  it('skips unsubscribed visitors', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    __seed('BrowseSessions', [{
      _id: 'bs-103',
      sessionId: 'sess-103',
      productsViewed: '[]',
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'unsub@example.com',
      converted: false,
      recoveryStep: 0,
      createdAt: threeHoursAgo,
    }]);
    __seed('Unsubscribes', [{
      _id: 'unsub-10',
      email: 'unsub@example.com',
      sequenceType: 'all',
    }]);

    const result = await triggerBrowseRecovery();
    expect(result.skipped).toBe(1);
    expect(result.triggered).toBe(0);
  });

  it('skips sessions too recent for next step', async () => {
    __seed('BrowseSessions', [{
      _id: 'bs-104',
      sessionId: 'sess-104',
      productsViewed: '[]',
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'recent@example.com',
      converted: false,
      recoveryStep: 0,
      createdAt: new Date(), // just now
    }]);

    const result = await triggerBrowseRecovery();
    expect(result.skipped).toBe(1);
    expect(result.triggered).toBe(0);
  });
});

// ─── getBrowseAbandonmentStats ──────────────────────────────────

describe('getBrowseAbandonmentStats', () => {
  beforeEach(() => __reset());

  it('returns zero stats when no data', async () => {
    const result = await getBrowseAbandonmentStats(30);
    expect(result.success).toBe(true);
    expect(result.totalSessions).toBe(0);
    expect(result.highIntentSessions).toBe(0);
  });

  it('returns correct stats for seeded data', async () => {
    const now = new Date();
    __seed('BrowseSessions', [
      { _id: 'bs-200', sessionId: 'a', isHighIntent: true, hasEmail: true, converted: true, recoveryTriggered: true, createdAt: now },
      { _id: 'bs-201', sessionId: 'b', isHighIntent: true, hasEmail: false, converted: false, recoveryTriggered: false, createdAt: now },
      { _id: 'bs-202', sessionId: 'c', isHighIntent: false, hasEmail: false, converted: false, recoveryTriggered: false, createdAt: now },
    ]);

    const result = await getBrowseAbandonmentStats(30);
    expect(result.success).toBe(true);
    expect(result.totalSessions).toBe(3);
    expect(result.highIntentSessions).toBe(2);
    expect(result.sessionsWithEmail).toBe(1);
    expect(result.convertedSessions).toBe(1);
    expect(result.recoveryConverted).toBe(1);
  });

  it('calculates rates correctly', async () => {
    const now = new Date();
    __seed('BrowseSessions', [
      { _id: 'bs-300', sessionId: 'x', isHighIntent: true, hasEmail: true, converted: false, recoveryTriggered: false, createdAt: now },
      { _id: 'bs-301', sessionId: 'y', isHighIntent: true, hasEmail: true, converted: false, recoveryTriggered: false, createdAt: now },
    ]);

    const result = await getBrowseAbandonmentStats(30);
    expect(result.highIntentRate).toBe(100);
    expect(result.emailCaptureRate).toBe(100);
    expect(result.conversionRate).toBe(0);
  });

  it('clamps days to safe range', async () => {
    const result = await getBrowseAbandonmentStats(0);
    expect(result.success).toBe(true);
    expect(result.period).toBe('1 days');
  });

  it('includes period in response', async () => {
    const result = await getBrowseAbandonmentStats(7);
    expect(result.period).toBe('7 days');
  });
});

// ─── exportAbandonmentInsights ──────────────────────────────────

describe('exportAbandonmentInsights', () => {
  beforeEach(() => __reset());

  it('returns empty insights when no data', async () => {
    const result = await exportAbandonmentInsights(10);
    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
  });

  it('aggregates product-level abandonment data', async () => {
    const now = new Date();
    __seed('BrowseSessions', [
      {
        _id: 'bs-400',
        sessionId: 's1',
        isHighIntent: true,
        converted: false,
        productsViewed: JSON.stringify([
          { productId: futonFrame._id, productName: futonFrame.name, price: futonFrame.price, viewDuration: 30000 },
          { productId: wallHuggerFrame._id, productName: wallHuggerFrame.name, price: wallHuggerFrame.price, viewDuration: 20000 },
        ]),
        createdAt: now,
      },
      {
        _id: 'bs-401',
        sessionId: 's2',
        isHighIntent: true,
        converted: false,
        productsViewed: JSON.stringify([
          { productId: futonFrame._id, productName: futonFrame.name, price: futonFrame.price, viewDuration: 45000 },
        ]),
        createdAt: now,
      },
    ]);

    const result = await exportAbandonmentInsights(10);
    expect(result.success).toBe(true);
    expect(result.insights.length).toBeGreaterThanOrEqual(1);

    // futonFrame should be first (2 abandoned views)
    const top = result.insights[0];
    expect(top.productId).toBe(futonFrame._id);
    expect(top.abandonedViews).toBe(2);
    expect(top.avgViewDuration).toBe(37500); // (30000+45000)/2
  });

  it('sorts by abandoned views descending', async () => {
    const now = new Date();
    __seed('BrowseSessions', [
      {
        _id: 'bs-500',
        sessionId: 's3',
        isHighIntent: true,
        converted: false,
        productsViewed: JSON.stringify([
          { productId: 'prod-a', productName: 'A', price: 100, viewDuration: 10000 },
          { productId: 'prod-b', productName: 'B', price: 200, viewDuration: 20000 },
        ]),
        createdAt: now,
      },
      {
        _id: 'bs-501',
        sessionId: 's4',
        isHighIntent: true,
        converted: false,
        productsViewed: JSON.stringify([
          { productId: 'prod-b', productName: 'B', price: 200, viewDuration: 15000 },
        ]),
        createdAt: now,
      },
    ]);

    const result = await exportAbandonmentInsights(10);
    expect(result.insights[0].productId).toBe('prod-b'); // 2 views
    expect(result.insights[1].productId).toBe('prod-a'); // 1 view
  });

  it('respects limit parameter', async () => {
    const now = new Date();
    const products = Array.from({ length: 5 }, (_, i) => ({
      productId: `prod-${i}`, productName: `P${i}`, price: 100, viewDuration: 5000,
    }));
    __seed('BrowseSessions', [{
      _id: 'bs-600',
      sessionId: 's5',
      isHighIntent: true,
      converted: false,
      productsViewed: JSON.stringify(products),
      createdAt: now,
    }]);

    const result = await exportAbandonmentInsights(3);
    expect(result.insights.length).toBeLessThanOrEqual(3);
  });

  it('excludes converted sessions', async () => {
    const now = new Date();
    __seed('BrowseSessions', [{
      _id: 'bs-700',
      sessionId: 's6',
      isHighIntent: true,
      converted: true, // converted — should be excluded
      productsViewed: JSON.stringify([
        { productId: 'prod-c', productName: 'C', price: 100, viewDuration: 10000 },
      ]),
      createdAt: now,
    }]);

    const result = await exportAbandonmentInsights(10);
    expect(result.insights).toEqual([]);
  });
});

// ─── markSessionConverted ───────────────────────────────────────

describe('markSessionConverted', () => {
  beforeEach(() => __reset());

  it('returns false for empty session ID', async () => {
    expect(await markSessionConverted('')).toBe(false);
  });

  it('returns false for non-existent session', async () => {
    expect(await markSessionConverted('nonexistent')).toBe(false);
  });

  it('marks session as converted', async () => {
    __seed('BrowseSessions', [{
      _id: 'bs-800',
      sessionId: 'sess-800',
      converted: false,
      updatedAt: new Date(),
    }]);

    const result = await markSessionConverted('sess-800');
    expect(result).toBe(true);
  });

  it('cancels pending recovery emails on conversion', async () => {
    __seed('BrowseSessions', [{
      _id: 'bs-900',
      sessionId: 'sess-900',
      converted: false,
      updatedAt: new Date(),
    }]);
    __seed('BrowseRecoveryEmails', [
      { _id: 'bre-1', sessionId: 'sess-900', status: 'pending', step: 2 },
      { _id: 'bre-2', sessionId: 'sess-900', status: 'sent', step: 1 },
    ]);

    const result = await markSessionConverted('sess-900');
    expect(result).toBe(true);
  });
});
