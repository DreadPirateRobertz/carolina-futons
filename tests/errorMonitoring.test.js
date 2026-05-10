import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember, __setRoles } from './__mocks__/wix-members-backend.js';
// cf-4x7e Pass 2 chunk 9 retired the dashboard / details /
// updateGroupStatus / checkRateSpike / getErrorFrequency methods
// (admin tooling, never wired). Only logError + createErrorBoundaryLogger
// remain on errorMonitoring.web.js. createErrorBoundaryLogger coverage
// lives in errorMonitoringWiring.test.js.
import { logError } from '../src/backend/errorMonitoring.web.js';

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
