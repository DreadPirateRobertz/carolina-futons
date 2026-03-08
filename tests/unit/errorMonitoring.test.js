import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from '../__mocks__/wix-data.js';
import { __setMember, __setRoles } from '../__mocks__/wix-members-backend.js';
import {
  logError,
  getErrorDashboard,
  getErrorDetails,
  updateErrorGroupStatus,
  checkErrorRateSpike,
  getErrorFrequency,
} from '../../src/backend/errorMonitoring.web.js';

// ── Test helpers ────────────────────────────────────────────────────

function setupAdmin() {
  __setMember({ _id: 'admin-001', loginEmail: 'admin@carolinafutons.com' });
  __setRoles([{ _id: 'admin', title: 'Admin' }]);
}

function setupNonAdmin() {
  __setMember({ _id: 'member-001', loginEmail: 'user@example.com' });
  __setRoles([{ _id: 'member', title: 'Member' }]);
}

// Use dynamic dates so tests don't drift out of the 7-day dashboard window
const _now = Date.now();
const daysAgo = (n) => new Date(_now - n * 24 * 60 * 60 * 1000);

const sampleErrorGroup = {
  _id: 'grp-001',
  groupKey: 'cart.addItem::Cannot read property S of undefined',
  message: 'Cannot read property \'items\' of undefined',
  firstSeen: daysAgo(12),
  lastSeen: daysAgo(1),
  occurrenceCount: 42,
  status: 'active',
  affectedPages: JSON.stringify(['/product-page', '/cart']),
  sampleStack: 'TypeError: Cannot read property...\n  at addItem (cart.js:15)',
};

const resolvedErrorGroup = {
  _id: 'grp-002',
  groupKey: 'checkout.submit::Network timeout',
  message: 'Network timeout',
  firstSeen: daysAgo(17),
  lastSeen: daysAgo(9),
  occurrenceCount: 5,
  status: 'resolved',
  affectedPages: JSON.stringify(['/checkout']),
  sampleStack: 'Error: Network timeout...',
  resolvedBy: 'admin-001',
  resolvedDate: daysAgo(8),
};

const ignoredErrorGroup = {
  _id: 'grp-003',
  groupKey: 'analytics.track::GA not loaded',
  message: 'GA not loaded',
  firstSeen: daysAgo(26),
  lastSeen: daysAgo(3),
  occurrenceCount: 200,
  status: 'ignored',
  affectedPages: JSON.stringify(['/home', '/product-page']),
  sampleStack: '',
};

const sampleErrorLogs = [
  {
    _id: 'log-001',
    errorGroup: 'cart.addItem::Cannot read property S of undefined',
    message: 'Cannot read property \'items\' of undefined',
    stack: 'TypeError at addItem (cart.js:15)',
    page: '/product-page',
    context: 'cart.addItem',
    userId: 'user-123',
    userAgent: 'Mozilla/5.0',
    severity: 'error',
    metadata: '{}',
    _createdDate: daysAgo(1),
  },
  {
    _id: 'log-002',
    errorGroup: 'cart.addItem::Cannot read property S of undefined',
    message: 'Cannot read property \'items\' of undefined',
    stack: 'TypeError at addItem (cart.js:15)',
    page: '/cart',
    context: 'cart.addItem',
    userId: 'user-456',
    userAgent: 'Mozilla/5.0',
    severity: 'error',
    metadata: '{"cartId":"abc"}',
    _createdDate: daysAgo(1),
  },
  {
    _id: 'log-003',
    errorGroup: 'checkout.submit::Network timeout',
    message: 'Network timeout',
    stack: 'Error: Network timeout',
    page: '/checkout',
    context: 'checkout.submit',
    userId: '',
    userAgent: 'Mozilla/5.0',
    severity: 'critical',
    metadata: '',
    _createdDate: daysAgo(2),
  },
  {
    _id: 'log-004',
    errorGroup: 'analytics.track::GA not loaded',
    message: 'GA not loaded',
    stack: '',
    page: '/home',
    context: 'analytics.track',
    userId: '',
    userAgent: '',
    severity: 'warning',
    metadata: '',
    _createdDate: daysAgo(3),
  },
];

beforeEach(() => {
  __seed('ErrorLogs', [...sampleErrorLogs]);
  __seed('ErrorGroups', [sampleErrorGroup, resolvedErrorGroup, ignoredErrorGroup]);
  setupAdmin();
});

// ── logError ────────────────────────────────────────────────────────

describe('logError', () => {
  it('logs an error and returns success with groupKey', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'ErrorLogs') inserted = item;
    });

    const result = await logError({
      message: 'Test error',
      stack: 'Error at test.js:1',
      page: '/test-page',
      context: 'test.module',
      severity: 'error',
    });

    expect(result.success).toBe(true);
    expect(result.groupKey).toBeTruthy();
    expect(inserted).not.toBeNull();
    expect(inserted.message).toBe('Test error');
    expect(inserted.page).toBe('/test-page');
  });

  it('creates a new error group for first occurrence', async () => {
    __seed('ErrorGroups', []);
    let groupInserted = null;
    __onInsert((col, item) => {
      if (col === 'ErrorGroups') groupInserted = item;
    });

    await logError({
      message: 'Brand new error',
      context: 'new.module',
      page: '/new-page',
    });

    expect(groupInserted).not.toBeNull();
    expect(groupInserted.occurrenceCount).toBe(1);
    expect(groupInserted.status).toBe('active');
    expect(groupInserted.message).toBe('Brand new error');
  });

  it('increments count on existing error group', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'ErrorGroups') updated = item;
    });

    await logError({
      message: 'Cannot read property \'items\' of undefined',
      context: 'cart.addItem',
      page: '/product-page',
    });

    expect(updated).not.toBeNull();
    expect(updated.occurrenceCount).toBe(43);
  });

  it('adds new affected page to existing group', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'ErrorGroups') updated = item;
    });

    await logError({
      message: 'Cannot read property \'items\' of undefined',
      context: 'cart.addItem',
      page: '/new-page',
    });

    const pages = JSON.parse(updated.affectedPages);
    expect(pages).toContain('/new-page');
    expect(pages).toContain('/product-page');
  });

  it('does not duplicate existing affected page', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'ErrorGroups') updated = item;
    });

    await logError({
      message: 'Cannot read property \'items\' of undefined',
      context: 'cart.addItem',
      page: '/product-page',
    });

    const pages = JSON.parse(updated.affectedPages);
    const productPageCount = pages.filter(p => p === '/product-page').length;
    expect(productPageCount).toBe(1);
  });

  it('re-opens resolved error group on new occurrence', async () => {
    __seed('ErrorGroups', [resolvedErrorGroup]);
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'ErrorGroups') updated = item;
    });

    await logError({
      message: 'Network timeout',
      context: 'checkout.submit',
    });

    expect(updated.status).toBe('active');
  });

  it('sanitizes message with HTML tags', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'ErrorLogs') inserted = item;
    });

    await logError({
      message: '<script>alert("xss")</script>Real error',
      context: 'test',
    });

    expect(inserted.message).not.toContain('<script>');
    expect(inserted.message).toContain('Real error');
  });

  it('defaults severity to error for invalid values', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'ErrorLogs') inserted = item;
    });

    await logError({
      message: 'Test',
      severity: 'invalid-severity',
    });

    expect(inserted.severity).toBe('error');
  });

  it('accepts critical severity', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'ErrorLogs') inserted = item;
    });

    await logError({
      message: 'Critical failure',
      severity: 'critical',
    });

    expect(inserted.severity).toBe('critical');
  });

  it('accepts warning severity', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'ErrorLogs') inserted = item;
    });

    await logError({
      message: 'Minor issue',
      severity: 'warning',
    });

    expect(inserted.severity).toBe('warning');
  });

  it('serializes object metadata to JSON string', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'ErrorLogs') inserted = item;
    });

    await logError({
      message: 'Test',
      metadata: { cartId: 'abc', itemCount: 3 },
    });

    expect(inserted.metadata).toContain('cartId');
    expect(inserted.metadata).toContain('abc');
  });

  it('handles string metadata', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'ErrorLogs') inserted = item;
    });

    await logError({
      message: 'Test',
      metadata: '{"key":"value"}',
    });

    expect(inserted.metadata).toBe('{"key":"value"}');
  });

  it('never throws even with bad data', async () => {
    const result = await logError(null);
    expect(result).toBeDefined();
    // Should return success:false but not throw
  });

  it('never throws with undefined data', async () => {
    const result = await logError(undefined);
    expect(result).toBeDefined();
  });

  it('groups similar errors with different numbers', async () => {
    const result1 = await logError({
      message: 'Error at line 42',
      context: 'module',
    });
    const result2 = await logError({
      message: 'Error at line 99',
      context: 'module',
    });

    expect(result1.groupKey).toBe(result2.groupKey);
  });

  it('stores userId when provided', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'ErrorLogs') inserted = item;
    });

    await logError({
      message: 'Test',
      userId: 'member-xyz',
    });

    expect(inserted.userId).toBe('member-xyz');
  });

  it('stores userAgent when provided', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'ErrorLogs') inserted = item;
    });

    await logError({
      message: 'Test',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });

    expect(inserted.userAgent).toContain('Mozilla');
  });
});

// ── getErrorDashboard ───────────────────────────────────────────────

describe('getErrorDashboard', () => {
  it('returns dashboard summary for admin', async () => {
    const result = await getErrorDashboard();
    expect(result.success).toBe(true);
    expect(result.summary).toBeDefined();
    expect(result.summary.totalErrors).toBeGreaterThan(0);
    expect(result.summary.period).toBe('7 days');
  });

  it('returns top errors sorted by occurrence', async () => {
    const result = await getErrorDashboard();
    expect(result.topErrors.length).toBeGreaterThan(0);
    expect(result.topErrors[0].occurrenceCount).toBeGreaterThanOrEqual(
      result.topErrors[result.topErrors.length - 1].occurrenceCount
    );
  });

  it('excludes ignored error groups', async () => {
    const result = await getErrorDashboard();
    const ignored = result.topErrors.filter(e => e.status === 'ignored');
    expect(ignored).toHaveLength(0);
  });

  it('counts active and resolved groups', async () => {
    const result = await getErrorDashboard();
    expect(typeof result.summary.activeGroups).toBe('number');
    expect(typeof result.summary.resolvedGroups).toBe('number');
  });

  it('counts critical errors separately', async () => {
    const result = await getErrorDashboard();
    expect(typeof result.summary.criticalErrors).toBe('number');
  });

  it('counts warnings separately', async () => {
    const result = await getErrorDashboard();
    expect(typeof result.summary.warnings).toBe('number');
  });

  it('respects custom days parameter', async () => {
    const result = await getErrorDashboard({ days: 30 });
    expect(result.summary.period).toBe('30 days');
  });

  it('respects custom limit parameter', async () => {
    const result = await getErrorDashboard({ limit: 1 });
    expect(result.topErrors.length).toBeLessThanOrEqual(1);
  });

  it('parses affectedPages as array', async () => {
    const result = await getErrorDashboard();
    if (result.topErrors.length > 0) {
      expect(Array.isArray(result.topErrors[0].affectedPages)).toBe(true);
    }
  });

  it('rejects non-admin user', async () => {
    setupNonAdmin();
    const result = await getErrorDashboard();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects unauthenticated user', async () => {
    __setMember(null);
    const result = await getErrorDashboard();
    expect(result.success).toBe(false);
  });

  it('returns correct structure', async () => {
    const result = await getErrorDashboard();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('topErrors');
    expect(result.summary).toHaveProperty('totalErrors');
    expect(result.summary).toHaveProperty('criticalErrors');
    expect(result.summary).toHaveProperty('warnings');
    expect(result.summary).toHaveProperty('activeGroups');
    expect(result.summary).toHaveProperty('resolvedGroups');
    expect(result.summary).toHaveProperty('period');
  });
});

// ── getErrorDetails ─────────────────────────────────────────────────

describe('getErrorDetails', () => {
  it('returns error group details with recent logs', async () => {
    const result = await getErrorDetails('cart.addItem::Cannot read property S of undefined');
    expect(result.success).toBe(true);
    expect(result.group.message).toContain('Cannot read property');
    expect(result.group.occurrenceCount).toBe(42);
    expect(result.recentLogs.length).toBeGreaterThan(0);
  });

  it('returns affected pages as array', async () => {
    const result = await getErrorDetails('cart.addItem::Cannot read property S of undefined');
    expect(Array.isArray(result.group.affectedPages)).toBe(true);
    expect(result.group.affectedPages).toContain('/product-page');
  });

  it('returns resolved info for resolved groups', async () => {
    const result = await getErrorDetails('checkout.submit::Network timeout');
    expect(result.success).toBe(true);
    expect(result.group.resolvedBy).toBe('admin-001');
    expect(result.group.resolvedDate).toBeDefined();
  });

  it('returns log entries with metadata parsed', async () => {
    const result = await getErrorDetails('cart.addItem::Cannot read property S of undefined');
    const logWithMeta = result.recentLogs.find(l => l._id === 'log-002');
    if (logWithMeta) {
      expect(typeof logWithMeta.metadata).toBe('object');
    }
  });

  it('rejects empty group key', async () => {
    const result = await getErrorDetails('');
    expect(result.success).toBe(false);
  });

  it('returns not found for unknown group', async () => {
    const result = await getErrorDetails('nonexistent::group');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects non-admin', async () => {
    setupNonAdmin();
    const result = await getErrorDetails('cart.addItem::Cannot read property S of undefined');
    expect(result.success).toBe(false);
  });

  it('returns correct structure', async () => {
    const result = await getErrorDetails('cart.addItem::Cannot read property S of undefined');
    expect(result).toHaveProperty('group');
    expect(result).toHaveProperty('recentLogs');
    expect(result.group).toHaveProperty('groupKey');
    expect(result.group).toHaveProperty('status');
    expect(result.group).toHaveProperty('occurrenceCount');
  });
});

// ── updateErrorGroupStatus ──────────────────────────────────────────

describe('updateErrorGroupStatus', () => {
  it('resolves an active error group', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'ErrorGroups') updated = item;
    });

    const result = await updateErrorGroupStatus('grp-001', 'resolved');
    expect(result.success).toBe(true);
    expect(result.status).toBe('resolved');
    expect(updated.status).toBe('resolved');
    expect(updated.resolvedBy).toBe('admin-001');
    expect(updated.resolvedDate).toBeDefined();
  });

  it('ignores an error group', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'ErrorGroups') updated = item;
    });

    const result = await updateErrorGroupStatus('grp-001', 'ignored');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('ignored');
  });

  it('reactivates a resolved group', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'ErrorGroups') updated = item;
    });

    const result = await updateErrorGroupStatus('grp-002', 'active');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('active');
  });

  it('rejects invalid status', async () => {
    const result = await updateErrorGroupStatus('grp-001', 'invalid');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('rejects nonexistent group', async () => {
    const result = await updateErrorGroupStatus('grp-999', 'resolved');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects empty group ID', async () => {
    const result = await updateErrorGroupStatus('', 'resolved');
    expect(result.success).toBe(false);
  });

  it('rejects non-admin', async () => {
    setupNonAdmin();
    const result = await updateErrorGroupStatus('grp-001', 'resolved');
    expect(result.success).toBe(false);
  });
});

// ── checkErrorRateSpike ─────────────────────────────────────────────

describe('checkErrorRateSpike', () => {
  it('returns spike status for admin', async () => {
    const result = await checkErrorRateSpike();
    expect(result.success).toBe(true);
    expect(typeof result.isSpike).toBe('boolean');
    expect(typeof result.currentHourCount).toBe('number');
    expect(typeof result.hourlyBaseline).toBe('number');
  });

  it('calculates hourly baseline from 24h window', async () => {
    const result = await checkErrorRateSpike();
    expect(result.baselinePeriod).toBe('24 hours');
    expect(result.spikePeriod).toBe('1 hour');
  });

  it('reports no spike with normal error rate', async () => {
    // With few sample logs, should not be a spike
    const result = await checkErrorRateSpike();
    expect(result.success).toBe(true);
    expect(typeof result.threshold).toBe('number');
  });

  it('rejects non-admin', async () => {
    setupNonAdmin();
    const result = await checkErrorRateSpike();
    expect(result.success).toBe(false);
  });

  it('returns correct structure', async () => {
    const result = await checkErrorRateSpike();
    expect(result).toHaveProperty('isSpike');
    expect(result).toHaveProperty('currentHourCount');
    expect(result).toHaveProperty('hourlyBaseline');
    expect(result).toHaveProperty('threshold');
    expect(result).toHaveProperty('baselinePeriod');
    expect(result).toHaveProperty('spikePeriod');
  });
});

// ── getErrorFrequency ───────────────────────────────────────────────

describe('getErrorFrequency', () => {
  it('returns frequency data for admin', async () => {
    const result = await getErrorFrequency(7);
    expect(result.success).toBe(true);
    expect(result.period).toBe('7 days');
    expect(result.totalErrors).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.frequency)).toBe(true);
  });

  it('returns frequency sorted by date', async () => {
    const result = await getErrorFrequency(30);
    for (let i = 1; i < result.frequency.length; i++) {
      expect(result.frequency[i].date >= result.frequency[i - 1].date).toBe(true);
    }
  });

  it('returns breakdown by severity', async () => {
    const result = await getErrorFrequency(30);
    expect(result.bySeverity).toHaveProperty('error');
    expect(result.bySeverity).toHaveProperty('warning');
    expect(result.bySeverity).toHaveProperty('critical');
  });

  it('returns top affected pages', async () => {
    const result = await getErrorFrequency(30);
    expect(Array.isArray(result.topPages)).toBe(true);
    if (result.topPages.length > 0) {
      expect(result.topPages[0]).toHaveProperty('page');
      expect(result.topPages[0]).toHaveProperty('count');
    }
  });

  it('sorts top pages by count descending', async () => {
    const result = await getErrorFrequency(30);
    for (let i = 1; i < result.topPages.length; i++) {
      expect(result.topPages[i].count).toBeLessThanOrEqual(result.topPages[i - 1].count);
    }
  });

  it('caps days at 90', async () => {
    const result = await getErrorFrequency(365);
    expect(result.period).toBe('90 days');
  });

  it('enforces minimum 1 day', async () => {
    const result = await getErrorFrequency(0);
    expect(result.period).toBe('1 days');
  });

  it('rejects non-admin', async () => {
    setupNonAdmin();
    const result = await getErrorFrequency(7);
    expect(result.success).toBe(false);
  });

  it('returns correct structure', async () => {
    const result = await getErrorFrequency(7);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('period');
    expect(result).toHaveProperty('totalErrors');
    expect(result).toHaveProperty('frequency');
    expect(result).toHaveProperty('bySeverity');
    expect(result).toHaveProperty('topPages');
  });
});
