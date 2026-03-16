import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let _collections = {};
let _insertCbs = [];
let _updateCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}
function __onInsert(cb) { _insertCbs.push(cb); }
function __onUpdate(cb) { _updateCbs.push(cb); }

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ge: (field, val) => { filters[field] = { type: 'ge', value: val }; return chain; },
    lt: (field, val) => { filters[field] = { type: 'lt', value: val }; return chain; },
    le: (field, val) => { filters[field] = { type: 'le', value: val }; return chain; },
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field.startsWith('_')) continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'ge') items = items.filter(i => i[field] >= f.value);
        if (f.type === 'lt') items = items.filter(i => i[field] < f.value);
        if (f.type === 'le') items = items.filter(i => i[field] <= f.value);
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
    count: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field.startsWith('_')) continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'ge') items = items.filter(i => i[field] >= f.value);
      }
      return items.length;
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn((col) => buildQueryChain(col)),
    get: vi.fn(async (col, id) => (_collections[col] || []).find(i => i._id === id) || null),
    insert: vi.fn(async (col, data) => {
      const item = { ...data, _id: data._id || 'a1b2c3d4-0000-0000-0000-000000000099' };
      if (!_collections[col]) _collections[col] = [];
      _collections[col].push(item);
      _insertCbs.forEach(cb => cb(col, item));
      return item;
    }),
    update: vi.fn(async (col, data) => {
      if (_collections[col]) {
        const idx = _collections[col].findIndex(i => i._id === data._id);
        if (idx >= 0) _collections[col][idx] = { ...data };
      }
      _updateCbs.forEach(cb => cb(col, data));
      return data;
    }),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.slice(0, maxLen);
  },
  validateEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  validateId: (id) => {
    if (!id || typeof id !== 'string') return '';
    return /^[a-f0-9-]+$/i.test(id) ? id : '';
  },
}));

vi.mock('backend/utils/safeParse', () => ({
  safeParse: (str, fallback) => {
    try { return JSON.parse(str); } catch { return fallback; }
  },
}));

import {
  trackBrowseSession,
  captureRemindMeRequest,
  triggerBrowseRecovery,
  getBrowseAbandonmentStats,
  exportAbandonmentInsights,
  markSessionConverted,
  HIGH_INTENT_THRESHOLD_MS,
  MAX_PRODUCTS_TRACKED,
  RECOVERY_SEQUENCE,
} from '../src/backend/browseAbandonment.web.js';

beforeEach(() => {
  vi.clearAllMocks();
  _collections = {};
  _insertCbs = [];
  _updateCbs = [];
});

// ── trackBrowseSession — deep edge cases ────────────────────────────

describe('trackBrowseSession — deep edge cases', () => {
  it('rejects null sessionData', async () => {
    const result = await trackBrowseSession(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Session ID');
  });

  it('rejects missing sessionId', async () => {
    const result = await trackBrowseSession({ productsViewed: [] });
    expect(result.success).toBe(false);
  });

  it('rejects empty sessionId', async () => {
    const result = await trackBrowseSession({ sessionId: '' });
    expect(result.success).toBe(false);
  });

  it('creates new session record on first track', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    const result = await trackBrowseSession({
      sessionId: 'sess-1',
      productsViewed: [{ productId: 'a1b2c3d4', productName: 'Futon', price: 299, viewDuration: 5000 }],
      totalDuration: 150000,
      entryPage: '/products',
      exitPage: '/product/futon',
    });

    expect(result.success).toBe(true);
    expect(result.isHighIntent).toBe(true); // 150s > 120s threshold
    expect(inserted.sessionId).toBe('sess-1');
    expect(inserted.productCount).toBe(1);
    expect(inserted.hasEmail).toBe(false);
    expect(inserted.converted).toBe(false);
    expect(inserted.recoveryStep).toBe(0);
  });

  it('updates existing session on re-track', async () => {
    __seed('BrowseSessions', [{
      _id: 'a1-0000-0000-0000-000000000001',
      sessionId: 'sess-1',
      productCount: 1,
      totalDuration: 30000,
      isHighIntent: false,
    }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'BrowseSessions') updated = data; });

    await trackBrowseSession({
      sessionId: 'sess-1',
      productsViewed: [{ productId: 'a1b2c3d4', productName: 'Futon', price: 299, viewDuration: 5000 }],
      totalDuration: 180000,
    });

    expect(updated.totalDuration).toBe(180000);
    expect(updated.isHighIntent).toBe(true);
  });

  it('high intent requires duration >= 2 min AND products > 0', async () => {
    // Long duration but no products → NOT high intent
    const result1 = await trackBrowseSession({
      sessionId: 'sess-no-products',
      productsViewed: [],
      totalDuration: 300000,
    });
    expect(result1.isHighIntent).toBe(false);

    // Products but short duration → NOT high intent
    const result2 = await trackBrowseSession({
      sessionId: 'sess-short',
      productsViewed: [{ productId: 'a1b2c3d4', productName: 'X', price: 10, viewDuration: 1000 }],
      totalDuration: 60000,
    });
    expect(result2.isHighIntent).toBe(false);
  });

  it('high intent threshold is exactly 2 minutes', () => {
    expect(HIGH_INTENT_THRESHOLD_MS).toBe(120000);
  });

  it('limits products to MAX_PRODUCTS_TRACKED (20)', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    const products = Array.from({ length: 30 }, (_, i) => ({
      productId: `a1b2c3d4-0000-0000-0000-${String(i).padStart(12, '0')}`,
      productName: `P${i}`,
      price: 10,
      viewDuration: 1000,
    }));
    await trackBrowseSession({ sessionId: 'sess-many', productsViewed: products, totalDuration: 300000 });

    const parsed = JSON.parse(inserted.productsViewed);
    expect(parsed.length).toBeLessThanOrEqual(20);
  });

  it('filters out products with invalid IDs', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    await trackBrowseSession({
      sessionId: 'sess-invalid',
      productsViewed: [
        { productId: 'a1b2c3d4', productName: 'Valid', price: 10, viewDuration: 1000 },
        { productId: 'has spaces!', productName: 'Invalid', price: 20, viewDuration: 2000 },
        { productId: '', productName: 'Empty', price: 30, viewDuration: 3000 },
      ],
      totalDuration: 300000,
    });

    const parsed = JSON.parse(inserted.productsViewed);
    expect(parsed.length).toBe(1);
    expect(parsed[0].productId).toBe('a1b2c3d4');
  });

  it('clamps negative totalDuration to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    await trackBrowseSession({ sessionId: 'sess-neg', productsViewed: [], totalDuration: -5000 });
    expect(inserted.totalDuration).toBe(0);
  });

  it('defaults non-number totalDuration to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    await trackBrowseSession({ sessionId: 'sess-str', productsViewed: [], totalDuration: 'long' });
    expect(inserted.totalDuration).toBe(0);
  });

  it('defaults missing product fields', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    await trackBrowseSession({
      sessionId: 'sess-partial',
      productsViewed: [{ productId: 'a1b2c3d4' }],
      totalDuration: 300000,
    });

    const parsed = JSON.parse(inserted.productsViewed);
    expect(parsed[0].productName).toBe('');
    expect(parsed[0].price).toBe(0);
    expect(parsed[0].viewDuration).toBe(0);
  });
});

// ── captureRemindMeRequest — deep edge cases ────────────────────────

describe('captureRemindMeRequest — deep edge cases', () => {
  it('rejects empty sessionId', async () => {
    const result = await captureRemindMeRequest('', 'test@test.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Session ID');
  });

  it('rejects invalid email', async () => {
    const result = await captureRemindMeRequest('sess-1', 'not-email');
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('rejects unsubscribed email (all)', async () => {
    __seed('Unsubscribes', [{ _id: 'u1', email: 'unsub@test.com', sequenceType: 'all' }]);
    const result = await captureRemindMeRequest('sess-1', 'unsub@test.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('unsubscribed');
  });

  it('rejects unsubscribed email (browse_recovery)', async () => {
    __seed('Unsubscribes', [{ _id: 'u1', email: 'unsub@test.com', sequenceType: 'browse_recovery' }]);
    const result = await captureRemindMeRequest('sess-1', 'unsub@test.com');
    expect(result.success).toBe(false);
  });

  it('allows email unsubscribed from other sequences', async () => {
    __seed('Unsubscribes', [{ _id: 'u1', email: 'other@test.com', sequenceType: 'cart_recovery' }]);
    // Create a session so the capture succeeds
    __seed('BrowseSessions', [{ _id: 'a1-0000', sessionId: 'sess-1' }]);

    const result = await captureRemindMeRequest('sess-1', 'other@test.com');
    expect(result.success).toBe(true);
  });

  it('updates existing session with email', async () => {
    __seed('BrowseSessions', [{
      _id: 'a1-0000-0000-0000-000000000001',
      sessionId: 'sess-1',
      hasEmail: false,
      visitorEmail: '',
    }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'BrowseSessions') updated = data; });

    await captureRemindMeRequest('sess-1', 'user@example.com', 'John');
    expect(updated.hasEmail).toBe(true);
    expect(updated.visitorEmail).toBe('user@example.com');
    expect(updated.visitorName).toBe('John');
  });

  it('creates new session when not tracked yet', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    const result = await captureRemindMeRequest('sess-new', 'new@test.com', 'Jane');
    expect(result.success).toBe(true);
    expect(inserted.sessionId).toBe('sess-new');
    expect(inserted.hasEmail).toBe(true);
    expect(inserted.visitorEmail).toBe('new@test.com');
    expect(inserted.productsViewed).toBe('[]');
  });

  it('defaults name to empty when not provided', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    await captureRemindMeRequest('sess-noname', 'test@test.com');
    expect(inserted.visitorName).toBe('');
  });
});

// ── triggerBrowseRecovery — deep edge cases ─────────────────────────

describe('triggerBrowseRecovery — deep edge cases', () => {
  it('returns 0 triggered when no eligible sessions', async () => {
    const result = await triggerBrowseRecovery();
    expect(result.success).toBe(true);
    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('has 3-step recovery sequence', () => {
    expect(RECOVERY_SEQUENCE.length).toBe(3);
    expect(RECOVERY_SEQUENCE[0].step).toBe(1);
    expect(RECOVERY_SEQUENCE[1].step).toBe(2);
    expect(RECOVERY_SEQUENCE[2].step).toBe(3);
  });

  it('step 1 delay is 2 hours', () => {
    expect(RECOVERY_SEQUENCE[0].delayMs).toBe(2 * 60 * 60 * 1000);
  });

  it('step 2 delay is 24 hours', () => {
    expect(RECOVERY_SEQUENCE[1].delayMs).toBe(24 * 60 * 60 * 1000);
  });

  it('step 3 delay is 48 hours', () => {
    expect(RECOVERY_SEQUENCE[2].delayMs).toBe(48 * 60 * 60 * 1000);
  });

  it('triggers step 1 for eligible session after 2 hours', async () => {
    const twoHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
    __seed('BrowseSessions', [{
      _id: 'a1-0000-0000-0000-000000000001',
      sessionId: 'sess-1',
      isHighIntent: true,
      hasEmail: true,
      converted: false,
      recoveryStep: 0,
      visitorEmail: 'user@test.com',
      visitorName: 'User',
      productsViewed: JSON.stringify([{ productId: 'p1', productName: 'Futon', price: 299 }]),
      createdAt: twoHoursAgo,
    }]);

    let emailInserted = null;
    __onInsert((col, item) => { if (col === 'BrowseRecoveryEmails') emailInserted = item; });

    const result = await triggerBrowseRecovery();
    expect(result.triggered).toBe(1);
    expect(emailInserted.step).toBe(1);
    expect(emailInserted.recipientEmail).toBe('user@test.com');
    expect(emailInserted.templateId).toBe('browse_recovery_1');
    expect(emailInserted.status).toBe('pending');
  });

  it('skips session if not enough time for next step', async () => {
    const recentTime = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    __seed('BrowseSessions', [{
      _id: 'a1-0000-0000-0000-000000000001',
      sessionId: 'sess-1',
      isHighIntent: true,
      hasEmail: true,
      converted: false,
      recoveryStep: 0,
      visitorEmail: 'user@test.com',
      productsViewed: '[]',
      createdAt: recentTime,
    }]);

    const result = await triggerBrowseRecovery();
    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips unsubscribed email', async () => {
    const oldTime = new Date(Date.now() - 5 * 60 * 60 * 1000);
    __seed('BrowseSessions', [{
      _id: 'a1-0000-0000-0000-000000000001',
      sessionId: 'sess-1',
      isHighIntent: true,
      hasEmail: true,
      converted: false,
      recoveryStep: 0,
      visitorEmail: 'unsub@test.com',
      productsViewed: '[]',
      createdAt: oldTime,
    }]);
    __seed('Unsubscribes', [{ _id: 'u1', email: 'unsub@test.com', sequenceType: 'all' }]);

    const result = await triggerBrowseRecovery();
    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('limits top products to 3 in email', async () => {
    const oldTime = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const products = Array.from({ length: 10 }, (_, i) => ({
      productId: `p${i}`, productName: `Product ${i}`, price: 100,
    }));
    __seed('BrowseSessions', [{
      _id: 'a1-0000-0000-0000-000000000001',
      sessionId: 'sess-1',
      isHighIntent: true,
      hasEmail: true,
      converted: false,
      recoveryStep: 0,
      visitorEmail: 'user@test.com',
      productsViewed: JSON.stringify(products),
      createdAt: oldTime,
    }]);

    let emailInserted = null;
    __onInsert((col, item) => { if (col === 'BrowseRecoveryEmails') emailInserted = item; });

    await triggerBrowseRecovery();
    const emailProducts = JSON.parse(emailInserted.products);
    expect(emailProducts.length).toBe(3);
  });
});

// ── getBrowseAbandonmentStats — deep edge cases ─────────────────────

describe('getBrowseAbandonmentStats — deep edge cases', () => {
  it('returns zero stats for empty data', async () => {
    const result = await getBrowseAbandonmentStats();
    expect(result.success).toBe(true);
    expect(result.totalSessions).toBe(0);
    expect(result.highIntentRate).toBe(0);
    expect(result.conversionRate).toBe(0);
  });

  it('clamps days to 1-365', async () => {
    const result = await getBrowseAbandonmentStats(0);
    expect(result.success).toBe(true);
    expect(result.period).toBe('1 days');
  });

  it('caps days at 365', async () => {
    const result = await getBrowseAbandonmentStats(999);
    expect(result.period).toBe('365 days');
  });

  it('calculates rates correctly', async () => {
    const recent = new Date();
    __seed('BrowseSessions', [
      { _id: 's1', isHighIntent: true, hasEmail: true, converted: true, recoveryTriggered: true, createdAt: recent },
      { _id: 's2', isHighIntent: true, hasEmail: true, converted: false, recoveryTriggered: true, createdAt: recent },
      { _id: 's3', isHighIntent: true, hasEmail: false, converted: false, recoveryTriggered: false, createdAt: recent },
      { _id: 's4', isHighIntent: false, hasEmail: false, converted: false, recoveryTriggered: false, createdAt: recent },
    ]);
    __seed('BrowseRecoveryEmails', [
      { _id: 'e1', createdAt: recent },
      { _id: 'e2', createdAt: recent },
    ]);

    const result = await getBrowseAbandonmentStats(30);
    expect(result.totalSessions).toBe(4);
    expect(result.highIntentSessions).toBe(3);
    expect(result.highIntentRate).toBe(75); // 3/4 * 100
    expect(result.sessionsWithEmail).toBe(2);
    expect(result.emailCaptureRate).toBe(67); // 2/3 * 100 rounded
    expect(result.convertedSessions).toBe(1);
    expect(result.conversionRate).toBe(25); // 1/4 * 100
    expect(result.recoverySent).toBe(2);
    expect(result.recoveryConverted).toBe(1);
    expect(result.recoveryRate).toBe(50); // 1/2 * 100
  });

  it('avoids division by zero when no high intent sessions', async () => {
    const recent = new Date();
    __seed('BrowseSessions', [
      { _id: 's1', isHighIntent: false, hasEmail: true, converted: false, recoveryTriggered: false, createdAt: recent },
    ]);
    const result = await getBrowseAbandonmentStats(30);
    expect(result.emailCaptureRate).toBe(0);
  });
});

// ── exportAbandonmentInsights — deep edge cases ─────────────────────

describe('exportAbandonmentInsights — deep edge cases', () => {
  it('returns empty insights for no data', async () => {
    const result = await exportAbandonmentInsights();
    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
  });

  it('clamps limit to 1-50', async () => {
    const result = await exportAbandonmentInsights(0);
    expect(result.success).toBe(true);
  });

  it('aggregates product views across sessions', async () => {
    const recent = new Date();
    __seed('BrowseSessions', [
      {
        _id: 's1', isHighIntent: true, converted: false, createdAt: recent,
        productsViewed: JSON.stringify([
          { productId: 'p1', productName: 'Futon A', price: 299, viewDuration: 5000 },
          { productId: 'p2', productName: 'Futon B', price: 199, viewDuration: 3000 },
        ]),
      },
      {
        _id: 's2', isHighIntent: true, converted: false, createdAt: recent,
        productsViewed: JSON.stringify([
          { productId: 'p1', productName: 'Futon A', price: 299, viewDuration: 8000 },
        ]),
      },
    ]);

    const result = await exportAbandonmentInsights(10);
    expect(result.insights.length).toBe(2);
    // p1 should be first (2 abandoned views)
    expect(result.insights[0].productId).toBe('p1');
    expect(result.insights[0].abandonedViews).toBe(2);
    expect(result.insights[0].avgViewDuration).toBe(6500); // (5000+8000)/2
    // p2 should be second (1 abandoned view)
    expect(result.insights[1].productId).toBe('p2');
    expect(result.insights[1].abandonedViews).toBe(1);
  });

  it('sorts by abandoned views descending', async () => {
    const recent = new Date();
    __seed('BrowseSessions', [
      {
        _id: 's1', isHighIntent: true, converted: false, createdAt: recent,
        productsViewed: JSON.stringify([
          { productId: 'rare', productName: 'Rare', price: 999, viewDuration: 1000 },
        ]),
      },
      {
        _id: 's2', isHighIntent: true, converted: false, createdAt: recent,
        productsViewed: JSON.stringify([
          { productId: 'popular', productName: 'Pop', price: 99, viewDuration: 2000 },
        ]),
      },
      {
        _id: 's3', isHighIntent: true, converted: false, createdAt: recent,
        productsViewed: JSON.stringify([
          { productId: 'popular', productName: 'Pop', price: 99, viewDuration: 3000 },
        ]),
      },
    ]);

    const result = await exportAbandonmentInsights(10);
    expect(result.insights[0].productId).toBe('popular');
    expect(result.insights[0].abandonedViews).toBe(2);
  });

  it('handles malformed productsViewed JSON', async () => {
    const recent = new Date();
    __seed('BrowseSessions', [{
      _id: 's1', isHighIntent: true, converted: false, createdAt: recent,
      productsViewed: 'not-json',
    }]);

    const result = await exportAbandonmentInsights();
    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
  });
});

// ── markSessionConverted — deep edge cases ──────────────────────────

describe('markSessionConverted — deep edge cases', () => {
  it('returns false for empty sessionId', async () => {
    const result = await markSessionConverted('');
    expect(result).toBe(false);
  });

  it('returns false for non-existent session', async () => {
    const result = await markSessionConverted('nonexistent');
    expect(result).toBe(false);
  });

  it('marks session as converted', async () => {
    __seed('BrowseSessions', [{
      _id: 'a1-0000-0000-0000-000000000001',
      sessionId: 'sess-1',
      converted: false,
    }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'BrowseSessions') updated = data; });

    const result = await markSessionConverted('sess-1');
    expect(result).toBe(true);
    expect(updated.converted).toBe(true);
  });

  it('cancels pending recovery emails on conversion', async () => {
    __seed('BrowseSessions', [{
      _id: 'a1-0000-0000-0000-000000000001',
      sessionId: 'sess-1',
      converted: false,
    }]);
    __seed('BrowseRecoveryEmails', [
      { _id: 'e1', sessionId: 'sess-1', status: 'pending' },
      { _id: 'e2', sessionId: 'sess-1', status: 'sent' },
      { _id: 'e3', sessionId: 'sess-1', status: 'pending' },
    ]);

    const updates = [];
    __onUpdate((col, data) => { if (col === 'BrowseRecoveryEmails') updates.push(data); });

    await markSessionConverted('sess-1');

    // Only pending emails should be cancelled
    const cancelledEmails = updates.filter(u => u.status === 'cancelled');
    expect(cancelledEmails.length).toBe(2);
  });

  it('does not cancel non-pending emails', async () => {
    __seed('BrowseSessions', [{
      _id: 'a1-0000-0000-0000-000000000001',
      sessionId: 'sess-1',
      converted: false,
    }]);
    __seed('BrowseRecoveryEmails', [
      { _id: 'e1', sessionId: 'sess-1', status: 'sent' },
    ]);

    const updates = [];
    __onUpdate((col, data) => { if (col === 'BrowseRecoveryEmails') updates.push(data); });

    await markSessionConverted('sess-1');
    // The 'sent' email should not be updated
    const emailUpdates = updates.filter(u => u._id === 'e1');
    expect(emailUpdates.length).toBe(0);
  });
});
