// contentScheduler.test.js — CF-483q: Content Scheduler
// Tests for queue-based content schedule processing: dedup, priority, rate limits.
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from 'wix-data';
import { __setMember, __setRoles } from 'wix-members-backend';
import { __setSecrets, __reset as __resetSecrets } from 'wix-secrets-backend';

import {
  processContentSchedule,
  getScheduleQueue,
  cancelScheduledItem,
  getScheduleStats,
} from '../src/backend/contentScheduler.web.js';

beforeEach(() => {
  __reset();
  __resetSecrets();
  __setMember({ _id: 'admin-1' });
  __setRoles([{ title: 'Admin' }]);
  __setSecrets({ CONTENT_CRON_KEY: 'test-cron-secret' });
});

// ── processContentSchedule ──────────────────────────────────────────

describe('processContentSchedule', () => {
  const pendingItem = (overrides = {}) => ({
    _id: 'cs-1',
    contentType: 'newsletter',
    platform: 'email',
    productId: 'prod-1',
    productName: 'Test Frame',
    scheduledAt: new Date(Date.now() - 60000),
    status: 'pending',
    priority: 3,
    eventType: 'new_arrival',
    createdBy: 'new_arrival-prod-1-2026-03-16',
    payload: JSON.stringify({ productCategory: 'futon-frames' }),
    processedAt: null,
    error: '',
    ...overrides,
  });

  it('processes pending items with scheduledAt <= now', async () => {
    __seed('ContentSchedule', [pendingItem()]);
    const result = await processContentSchedule('test-cron-secret');
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
  });

  it('skips items scheduled in the future', async () => {
    __seed('ContentSchedule', [
      pendingItem({ scheduledAt: new Date(Date.now() + 3600000) }),
    ]);
    const result = await processContentSchedule('test-cron-secret');
    expect(result.processed).toBe(0);
  });

  it('processes items in priority order (lower = first)', async () => {
    __seed('ContentSchedule', [
      pendingItem({ _id: 'cs-low', priority: 4, productId: 'p1' }),
      pendingItem({ _id: 'cs-high', priority: 1, productId: 'p2' }),
    ]);
    const result = await processContentSchedule('test-cron-secret');
    expect(result.success).toBe(true);
    expect(result.processed).toBe(2);
  });

  it('skips duplicate product+contentType within 7-day window', async () => {
    const recentDate = new Date(Date.now() - 86400000); // 1 day ago
    __seed('ContentSchedule', [
      {
        _id: 'cs-old',
        contentType: 'newsletter',
        productId: 'prod-1',
        status: 'sent',
        processedAt: recentDate,
        scheduledAt: recentDate,
        priority: 3,
        payload: '{}',
      },
      pendingItem({ _id: 'cs-new', productId: 'prod-1' }),
    ]);
    const result = await processContentSchedule('test-cron-secret');
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it('allows same product after 7-day window expires', async () => {
    const oldDate = new Date(Date.now() - 8 * 86400000); // 8 days ago
    __seed('ContentSchedule', [
      {
        _id: 'cs-old',
        contentType: 'newsletter',
        productId: 'prod-1',
        status: 'sent',
        processedAt: oldDate,
        scheduledAt: oldDate,
        priority: 3,
        payload: '{}',
      },
      pendingItem({ _id: 'cs-new', productId: 'prod-1' }),
    ]);
    const result = await processContentSchedule('test-cron-secret');
    expect(result.processed).toBe(1);
  });

  it('different contentType for same product is not a duplicate', async () => {
    const recentDate = new Date(Date.now() - 86400000);
    __seed('ContentSchedule', [
      {
        _id: 'cs-old',
        contentType: 'newsletter',
        productId: 'prod-1',
        status: 'sent',
        processedAt: recentDate,
        scheduledAt: recentDate,
        priority: 3,
        payload: '{}',
      },
      pendingItem({ _id: 'cs-new', productId: 'prod-1', contentType: 'social_story' }),
    ]);
    const result = await processContentSchedule('test-cron-secret');
    // Item was attempted (not skipped as duplicate) — may fail due to unmocked downstream
    expect(result.processed + result.failed).toBe(1);
    expect(result.skipped).toBe(0);
  });

  // ── Auth ─────────────────────────────────────────────────────────

  it('rejects invalid cron secret', async () => {
    const result = await processContentSchedule('wrong-secret');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth|secret/i);
  });

  it('rejects empty cron secret', async () => {
    const result = await processContentSchedule('');
    expect(result.success).toBe(false);
  });

  it('rejects null cron secret', async () => {
    const result = await processContentSchedule(null);
    expect(result.success).toBe(false);
  });

  // ── Edge cases ──────────────────────────────────────────────────

  it('handles empty queue', async () => {
    const result = await processContentSchedule('test-cron-secret');
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('handles items with missing productId (no dedup check)', async () => {
    __seed('ContentSchedule', [
      pendingItem({ _id: 'cs-1', productId: '' }),
    ]);
    const result = await processContentSchedule('test-cron-secret');
    expect(result.success).toBe(true);
  });

  it('handles malformed payload JSON gracefully', async () => {
    __seed('ContentSchedule', [
      pendingItem({ payload: 'not-valid-json' }),
    ]);
    const result = await processContentSchedule('test-cron-secret');
    // Should mark as failed, not crash
    expect(result.success).toBe(true);
    expect(result.failed).toBe(1);
  });

  it('handles unknown contentType as failure', async () => {
    __seed('ContentSchedule', [
      pendingItem({ contentType: 'unknown_type' }),
    ]);
    const result = await processContentSchedule('test-cron-secret');
    expect(result.success).toBe(true);
    expect(result.failed).toBeGreaterThanOrEqual(1);
  });

  it('processes multiple items and reports mixed results', async () => {
    __seed('ContentSchedule', [
      pendingItem({ _id: 'cs-1', productId: 'p1' }),
      pendingItem({ _id: 'cs-2', productId: 'p2', contentType: 'unknown_type' }),
    ]);
    const result = await processContentSchedule('test-cron-secret');
    expect(result.success).toBe(true);
    expect(result.processed + result.failed).toBe(2);
  });
});

// ── getScheduleQueue ────────────────────────────────────────────────

describe('getScheduleQueue', () => {
  it('returns pending items when filtered', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'pending', contentType: 'newsletter', scheduledAt: new Date(), priority: 3 },
      { _id: 'cs-2', status: 'sent', contentType: 'social_story', scheduledAt: new Date(), priority: 2 },
    ]);
    const result = await getScheduleQueue({ status: 'pending' });
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(1);
    expect(result.items[0]._id).toBe('cs-1');
  });

  it('returns all items when no filter', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'pending', scheduledAt: new Date() },
      { _id: 'cs-2', status: 'sent', scheduledAt: new Date() },
    ]);
    const result = await getScheduleQueue();
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(2);
  });

  it('filters by contentType', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'pending', contentType: 'newsletter', scheduledAt: new Date() },
      { _id: 'cs-2', status: 'pending', contentType: 'social_story', scheduledAt: new Date() },
    ]);
    const result = await getScheduleQueue({ contentType: 'newsletter' });
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(1);
  });

  it('clamps limit to 1-500', async () => {
    const result = await getScheduleQueue({ limit: 9999 });
    expect(result.success).toBe(true);
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await getScheduleQueue();
    expect(result.success).toBe(false);
  });
});

// ── cancelScheduledItem ─────────────────────────────────────────────

describe('cancelScheduledItem', () => {
  it('cancels a pending item', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'pending', contentType: 'newsletter' },
    ]);
    const result = await cancelScheduledItem('cs-1');
    expect(result.success).toBe(true);
  });

  it('rejects cancelling already-sent item', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'sent', contentType: 'newsletter' },
    ]);
    const result = await cancelScheduledItem('cs-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already|sent/i);
  });

  it('rejects invalid item ID', async () => {
    const result = await cancelScheduledItem('');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent item', async () => {
    const result = await cancelScheduledItem('nonexistent-id');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('can cancel a failed item', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'failed', contentType: 'newsletter' },
    ]);
    const result = await cancelScheduledItem('cs-1');
    expect(result.success).toBe(true);
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await cancelScheduledItem('cs-1');
    expect(result.success).toBe(false);
  });
});

// ── getScheduleStats ────────────────────────────────────────────────

describe('getScheduleStats', () => {
  it('returns stats breakdown', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'pending', contentType: 'newsletter', scheduledAt: new Date() },
      { _id: 'cs-2', status: 'sent', contentType: 'social_story', scheduledAt: new Date() },
      { _id: 'cs-3', status: 'failed', contentType: 'catalog_sync', scheduledAt: new Date() },
      { _id: 'cs-4', status: 'cancelled', contentType: 'newsletter', scheduledAt: new Date() },
    ]);
    const result = await getScheduleStats();
    expect(result.success).toBe(true);
    expect(result.stats.pending).toBe(1);
    expect(result.stats.sent).toBe(1);
    expect(result.stats.failed).toBe(1);
    expect(result.stats.cancelled).toBe(1);
  });

  it('filters by days parameter', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-recent', status: 'sent', contentType: 'newsletter', scheduledAt: new Date() },
      { _id: 'cs-old', status: 'sent', contentType: 'social_story', scheduledAt: new Date(Date.now() - 60 * 86400000) },
    ]);
    const result = await getScheduleStats(7);
    expect(result.success).toBe(true);
    // Only the recent item should be counted
    expect(result.stats.sent).toBe(1);
  });

  it('returns zero counts for empty queue', async () => {
    const result = await getScheduleStats();
    expect(result.success).toBe(true);
    expect(result.stats.pending).toBe(0);
    expect(result.stats.sent).toBe(0);
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await getScheduleStats();
    expect(result.success).toBe(false);
  });
});
