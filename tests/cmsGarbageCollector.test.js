/**
 * @file cmsGarbageCollector.test.js
 * @description Tests for CMS garbage collection cron (CF-au1w).
 * Covers: rate limit purge, browse session cleanup, email queue cleanup,
 * viewer session cleanup, audit log retention, batch limits, error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __seed, __onRemove } from './__mocks__/wix-data.js';

import {
  runGarbageCollection,
  _RATE_LIMIT_COLLECTIONS,
  _TTL,
  _BATCH_SIZE,
  _MAX_PASSES,
  _batchPurge,
} from '../src/backend/cmsGarbageCollector.web.js';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── Constants ─────────────────────────────────────────────────────────

describe('GC configuration', () => {
  it('exports 42 rate limit collections', () => {
    expect(_RATE_LIMIT_COLLECTIONS).toHaveLength(42);
  });

  it('has correct TTL values', () => {
    expect(_TTL.rateLimitHours).toBe(24);
    expect(_TTL.browseSessionDays).toBe(30);
    expect(_TTL.emailQueueDays).toBe(7);
    expect(_TTL.viewerCountHours).toBe(48);
    expect(_TTL.auditLogDays).toBe(90);
    expect(_TTL.auditLogRetentionDays).toBe(365);
  });

  it('batch size is 100', () => {
    expect(_BATCH_SIZE).toBe(100);
  });

  it('max passes is 5', () => {
    expect(_MAX_PASSES).toBe(5);
  });
});

// ── batchPurge ────────────────────────────────────────────────────────

describe('batchPurge', () => {
  it('deletes records older than cutoff', async () => {
    const staleDate = new Date(Date.now() - 48 * MS_PER_HOUR);
    __seed('TestCollection', [
      { _id: 'old-1', windowStart: staleDate },
      { _id: 'old-2', windowStart: staleDate },
    ]);

    const removed = await _batchPurge('TestCollection', 'windowStart', new Date(Date.now() - 24 * MS_PER_HOUR));
    expect(removed).toBe(2);
  });

  it('does not delete records newer than cutoff', async () => {
    const freshDate = new Date();
    __seed('TestCollection', [
      { _id: 'fresh-1', windowStart: freshDate },
    ]);

    const removed = await _batchPurge('TestCollection', 'windowStart', new Date(Date.now() - 24 * MS_PER_HOUR));
    expect(removed).toBe(0);
  });

  it('returns 0 for empty collection', async () => {
    const removed = await _batchPurge('EmptyCollection', 'windowStart', new Date());
    expect(removed).toBe(0);
  });

  it('applies extra filter when provided', async () => {
    const staleDate = new Date(Date.now() - 48 * MS_PER_HOUR);
    __seed('EmailQueue', [
      { _id: 'eq-1', createdAt: staleDate, status: 'sent' },
      { _id: 'eq-2', createdAt: staleDate, status: 'pending' },
    ]);

    const removed = await _batchPurge('EmailQueue', 'createdAt', new Date(Date.now() - 24 * MS_PER_HOUR), {
      field: 'status',
      value: 'sent',
    });
    expect(removed).toBe(1);
  });
});

// ── Rate Limit Purge ─────────────────────────────────────────────────

describe('rate limit purge', () => {
  it('purges stale rate limit records from a collection', async () => {
    const staleDate = new Date(Date.now() - 48 * MS_PER_HOUR);
    __seed('EmailRateLimit', [
      { _id: 'rl-1', key: 'test@example.com', count: 3, windowStart: staleDate },
    ]);

    const result = await runGarbageCollection();
    expect(result.success).toBe(true);
    expect(result.rateLimits.total).toBeGreaterThanOrEqual(1);
  });

  it('does not purge fresh rate limit records', async () => {
    const freshDate = new Date();
    __seed('EmailRateLimit', [
      { _id: 'rl-fresh', key: 'test@example.com', count: 1, windowStart: freshDate },
    ]);

    const removals = [];
    __onRemove((col, id) => { removals.push({ col, id }); });

    const result = await runGarbageCollection();
    const emailRateLimitRemovals = removals.filter(r => r.col === 'EmailRateLimit');
    expect(emailRateLimitRemovals).toHaveLength(0);
  });
});

// ── BrowseSessions Purge ─────────────────────────────────────────────

describe('browse session purge', () => {
  it('purges sessions older than 30 days', async () => {
    const staleDate = new Date(Date.now() - 31 * MS_PER_DAY);
    __seed('BrowseSessions', [
      { _id: 'bs-1', sessionId: 'sess-1', updatedAt: staleDate },
      { _id: 'bs-2', sessionId: 'sess-2', updatedAt: staleDate },
    ]);

    const result = await runGarbageCollection();
    expect(result.browseSessions).toBe(2);
  });

  it('preserves sessions within 30 days', async () => {
    const recentDate = new Date(Date.now() - 10 * MS_PER_DAY);
    __seed('BrowseSessions', [
      { _id: 'bs-recent', sessionId: 'sess-r', updatedAt: recentDate },
    ]);

    const removals = [];
    __onRemove((col, id) => { if (col === 'BrowseSessions') removals.push(id); });

    await runGarbageCollection();
    expect(removals).toHaveLength(0);
  });
});

// ── EmailQueue Purge ─────────────────────────────────────────────────

describe('email queue purge', () => {
  it('purges sent emails older than 7 days', async () => {
    const staleDate = new Date(Date.now() - 8 * MS_PER_DAY);
    __seed('EmailQueue', [
      { _id: 'eq-1', status: 'sent', createdAt: staleDate, templateId: 'welcome_series_1' },
    ]);

    const result = await runGarbageCollection();
    expect(result.emailQueue).toBeGreaterThanOrEqual(1);
  });

  it('purges cancelled emails older than 7 days', async () => {
    const staleDate = new Date(Date.now() - 8 * MS_PER_DAY);
    __seed('EmailQueue', [
      { _id: 'eq-c1', status: 'cancelled', createdAt: staleDate, templateId: 'cart_recovery_2' },
    ]);

    const result = await runGarbageCollection();
    expect(result.emailQueue).toBeGreaterThanOrEqual(1);
  });

  it('preserves pending emails regardless of age', async () => {
    const staleDate = new Date(Date.now() - 30 * MS_PER_DAY);
    __seed('EmailQueue', [
      { _id: 'eq-p1', status: 'pending', createdAt: staleDate, templateId: 'welcome_series_1' },
    ]);

    const removals = [];
    __onRemove((col, id) => { if (col === 'EmailQueue') removals.push(id); });

    await runGarbageCollection();
    expect(removals).toHaveLength(0);
  });

  it('preserves failed emails regardless of age', async () => {
    const staleDate = new Date(Date.now() - 30 * MS_PER_DAY);
    __seed('EmailQueue', [
      { _id: 'eq-f1', status: 'failed', createdAt: staleDate, templateId: 'welcome_series_1' },
    ]);

    const removals = [];
    __onRemove((col, id) => { if (col === 'EmailQueue') removals.push(id); });

    await runGarbageCollection();
    expect(removals).toHaveLength(0);
  });
});

// ── ViewerCount Purge ────────────────────────────────────────────────

describe('viewer session purge', () => {
  it('purges orphan viewer records older than 48h', async () => {
    const staleDate = new Date(Date.now() - 72 * MS_PER_HOUR);
    __seed('ViewerCount', [
      { _id: 'vc-1', productId: 'prod-1', viewCount: 5, updatedAt: staleDate },
    ]);

    const result = await runGarbageCollection();
    expect(result.viewerSessions).toBe(1);
  });

  it('preserves recent viewer records', async () => {
    const recentDate = new Date(Date.now() - 12 * MS_PER_HOUR);
    __seed('ViewerCount', [
      { _id: 'vc-recent', productId: 'prod-2', viewCount: 3, updatedAt: recentDate },
    ]);

    const removals = [];
    __onRemove((col, id) => { if (col === 'ViewerCount') removals.push(id); });

    await runGarbageCollection();
    expect(removals).toHaveLength(0);
  });
});

// ── AuditLog Purge ───────────────────────────────────────────────────

describe('audit log purge', () => {
  it('purges standard records older than 90 days', async () => {
    const staleDate = new Date(Date.now() - 91 * MS_PER_DAY);
    __seed('AuditLog', [
      { _id: 'al-1', collection: 'EmailRateLimit', action: 'insert', key: 'test@x.com', timestamp: staleDate },
    ]);

    const result = await runGarbageCollection();
    expect(result.auditLog).toBeGreaterThanOrEqual(1);
  });

  it('preserves records within 90 days', async () => {
    const recentDate = new Date(Date.now() - 30 * MS_PER_DAY);
    __seed('AuditLog', [
      { _id: 'al-recent', collection: 'Test', action: 'insert', key: 'k', timestamp: recentDate },
    ]);

    const removals = [];
    __onRemove((col, id) => { if (col === 'AuditLog') removals.push(id); });

    await runGarbageCollection();
    expect(removals).toHaveLength(0);
  });
});

// ── runGarbageCollection ─────────────────────────────────────────────

describe('runGarbageCollection', () => {
  it('returns success with summary', async () => {
    const result = await runGarbageCollection();
    expect(result.success).toBe(true);
    expect(result.totalPurged).toBeDefined();
    expect(result.durationMs).toBeDefined();
    expect(typeof result.durationMs).toBe('number');
  });

  it('totals purged records across all categories', async () => {
    const staleRL = new Date(Date.now() - 48 * MS_PER_HOUR);
    const staleBrowse = new Date(Date.now() - 31 * MS_PER_DAY);
    const staleEmail = new Date(Date.now() - 8 * MS_PER_DAY);

    __seed('QARateLimit', [{ _id: 'qa-1', key: 'test', count: 1, windowStart: staleRL }]);
    __seed('BrowseSessions', [{ _id: 'bs-1', sessionId: 's1', updatedAt: staleBrowse }]);
    __seed('EmailQueue', [{ _id: 'eq-1', status: 'sent', createdAt: staleEmail, templateId: 't1' }]);

    const result = await runGarbageCollection();
    expect(result.totalPurged).toBe(
      result.rateLimits.total + result.browseSessions + result.emailQueue +
      result.viewerSessions + result.auditLog
    );
  });

  it('handles empty database gracefully', async () => {
    const result = await runGarbageCollection();
    expect(result.success).toBe(true);
    expect(result.totalPurged).toBe(0);
  });
});
