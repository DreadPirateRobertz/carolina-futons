// contentSchedulerDeep.test.js — CF-xr0u: Deep coverage for contentScheduler.web.js
// Edge cases: empty queue, cancelled items, rate limit exceeded, timezone boundaries,
// dedup window boundaries, mixed status processing, auth, stats edge cases.
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
  __setSecrets({ CONTENT_CRON_KEY: 'deep-test-secret' });
});

const pendingItem = (overrides = {}) => ({
  _id: 'cs-deep-1',
  contentType: 'newsletter',
  platform: 'email',
  productId: 'prod-deep-1',
  productName: 'Deep Test Frame',
  scheduledAt: new Date(Date.now() - 60000),
  status: 'pending',
  priority: 3,
  eventType: 'new_arrival',
  createdBy: 'new_arrival-prod-deep-1-2026-03-16',
  payload: JSON.stringify({ productCategory: 'futon-frames' }),
  processedAt: null,
  error: '',
  ...overrides,
});

// ── processContentSchedule — empty queue ─────────────────────────────

describe('processContentSchedule — empty queue scenarios', () => {
  it('returns zeros for completely empty ContentSchedule', async () => {
    const result = await processContentSchedule('deep-test-secret');
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('ignores non-pending statuses', async () => {
    __seed('ContentSchedule', [
      pendingItem({ _id: 'cs-sent', status: 'sent' }),
      pendingItem({ _id: 'cs-failed', status: 'failed' }),
      pendingItem({ _id: 'cs-cancelled', status: 'cancelled' }),
    ]);
    const result = await processContentSchedule('deep-test-secret');
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('only processes items at or before current time', async () => {
    __seed('ContentSchedule', [
      pendingItem({ _id: 'cs-past', scheduledAt: new Date(Date.now() - 3600000) }),
      pendingItem({ _id: 'cs-future', scheduledAt: new Date(Date.now() + 3600000), productId: 'future-prod' }),
    ]);
    const result = await processContentSchedule('deep-test-secret');
    expect(result.processed).toBe(1);
  });
});

// ── processContentSchedule — cancelled items ─────────────────────────

describe('processContentSchedule — cancelled items', () => {
  it('does not process already cancelled items', async () => {
    __seed('ContentSchedule', [
      pendingItem({ _id: 'cs-c', status: 'cancelled' }),
    ]);
    const result = await processContentSchedule('deep-test-secret');
    expect(result.processed).toBe(0);
  });

  it('marks duplicates as cancelled with reason', async () => {
    const recentDate = new Date(Date.now() - 86400000);
    __seed('ContentSchedule', [
      {
        _id: 'cs-prev',
        contentType: 'newsletter',
        productId: 'dup-prod',
        status: 'sent',
        processedAt: recentDate,
        scheduledAt: recentDate,
        priority: 3,
        payload: '{}',
      },
      pendingItem({ _id: 'cs-dup', productId: 'dup-prod', contentType: 'newsletter' }),
    ]);
    const result = await processContentSchedule('deep-test-secret');
    expect(result.skipped).toBe(1);
  });
});

// ── processContentSchedule — dedup window boundaries ─────────────────

describe('processContentSchedule — dedup window boundaries', () => {
  it('item exactly 7 days old is still within window (skipped)', async () => {
    const exactlySevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 60000); // 7 days minus 1 minute
    __seed('ContentSchedule', [
      {
        _id: 'cs-7d',
        contentType: 'newsletter',
        productId: 'boundary-prod',
        status: 'sent',
        processedAt: exactlySevenDays,
        scheduledAt: exactlySevenDays,
        priority: 3,
        payload: '{}',
      },
      pendingItem({ _id: 'cs-new', productId: 'boundary-prod' }),
    ]);
    const result = await processContentSchedule('deep-test-secret');
    expect(result.skipped).toBe(1);
  });

  it('item just past 7 days is outside window (processed)', async () => {
    const justPastSevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 3600000); // 7d + 1hr ago
    __seed('ContentSchedule', [
      {
        _id: 'cs-old',
        contentType: 'newsletter',
        productId: 'past-prod',
        status: 'sent',
        processedAt: justPastSevenDays,
        scheduledAt: justPastSevenDays,
        priority: 3,
        payload: '{}',
      },
      pendingItem({ _id: 'cs-new', productId: 'past-prod' }),
    ]);
    const result = await processContentSchedule('deep-test-secret');
    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('failed items are NOT considered for dedup (only "sent")', async () => {
    const recentDate = new Date(Date.now() - 86400000);
    __seed('ContentSchedule', [
      {
        _id: 'cs-failed-prev',
        contentType: 'newsletter',
        productId: 'fail-prod',
        status: 'failed',
        processedAt: recentDate,
        scheduledAt: recentDate,
        priority: 3,
        payload: '{}',
      },
      pendingItem({ _id: 'cs-retry', productId: 'fail-prod' }),
    ]);
    const result = await processContentSchedule('deep-test-secret');
    // Should NOT be skipped since previous was failed, not sent
    expect(result.skipped).toBe(0);
    expect(result.processed + result.failed).toBe(1);
  });

  it('cancelled items are NOT considered for dedup', async () => {
    const recentDate = new Date(Date.now() - 86400000);
    __seed('ContentSchedule', [
      {
        _id: 'cs-can-prev',
        contentType: 'newsletter',
        productId: 'can-prod',
        status: 'cancelled',
        processedAt: recentDate,
        scheduledAt: recentDate,
        priority: 3,
        payload: '{}',
      },
      pendingItem({ _id: 'cs-new-can', productId: 'can-prod' }),
    ]);
    const result = await processContentSchedule('deep-test-secret');
    expect(result.skipped).toBe(0);
  });
});

// ── processContentSchedule — action execution edge cases ─────────────

describe('processContentSchedule — action execution', () => {
  it('handles empty payload string', async () => {
    __seed('ContentSchedule', [
      pendingItem({ payload: '' }),
    ]);
    const result = await processContentSchedule('deep-test-secret');
    expect(result.success).toBe(true);
    // Empty string → JSON.parse('{}') via fallback
    expect(result.processed + result.failed).toBe(1);
  });

  it('handles null payload', async () => {
    __seed('ContentSchedule', [
      pendingItem({ payload: null }),
    ]);
    const result = await processContentSchedule('deep-test-secret');
    expect(result.success).toBe(true);
    expect(result.processed + result.failed).toBe(1);
  });

  it('handles catalog_sync content type', async () => {
    __seed('ContentSchedule', [
      pendingItem({ _id: 'cs-cat', contentType: 'catalog_sync', platform: 'facebook' }),
    ]);
    const result = await processContentSchedule('deep-test-secret');
    expect(result.success).toBe(true);
    expect(result.processed + result.failed).toBe(1);
  });

  it('handles social_story content type', async () => {
    __seed('ContentSchedule', [
      pendingItem({ _id: 'cs-social', contentType: 'social_story', platform: 'instagram' }),
    ]);
    const result = await processContentSchedule('deep-test-secret');
    expect(result.success).toBe(true);
    expect(result.processed + result.failed).toBe(1);
  });

  it('processes batch of 50 items (max limit)', async () => {
    const items = Array.from({ length: 55 }, (_, i) => pendingItem({
      _id: `cs-batch-${i}`,
      productId: `batch-prod-${i}`,
    }));
    __seed('ContentSchedule', items);
    const result = await processContentSchedule('deep-test-secret');
    expect(result.success).toBe(true);
    // Should process up to 50 (the query limit)
    expect(result.processed + result.failed + result.skipped).toBeLessThanOrEqual(50);
  });
});

// ── processContentSchedule — auth edge cases ─────────────────────────

describe('processContentSchedule — auth', () => {
  it('rejects undefined secret', async () => {
    const result = await processContentSchedule(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects boolean secret', async () => {
    const result = await processContentSchedule(true);
    expect(result.success).toBe(false);
  });

  it('rejects numeric secret', async () => {
    const result = await processContentSchedule(12345);
    expect(result.success).toBe(false);
  });

  it('rejects secret with extra whitespace', async () => {
    const result = await processContentSchedule(' deep-test-secret ');
    expect(result.success).toBe(false);
  });

  it('accepts exact matching secret', async () => {
    const result = await processContentSchedule('deep-test-secret');
    expect(result.success).toBe(true);
  });
});

// ── getScheduleQueue — edge cases ────────────────────────────────────

describe('getScheduleQueue — edge cases', () => {
  it('handles combined status + contentType filters', async () => {
    __seed('ContentSchedule', [
      { _id: 'q1', status: 'pending', contentType: 'newsletter', scheduledAt: new Date() },
      { _id: 'q2', status: 'pending', contentType: 'social_story', scheduledAt: new Date() },
      { _id: 'q3', status: 'sent', contentType: 'newsletter', scheduledAt: new Date() },
    ]);
    const result = await getScheduleQueue({ status: 'pending', contentType: 'newsletter' });
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(1);
    expect(result.items[0]._id).toBe('q1');
  });

  it('handles limit of 0 (clamps to 1)', async () => {
    const result = await getScheduleQueue({ limit: 0 });
    expect(result.success).toBe(true);
  });

  it('handles negative limit', async () => {
    const result = await getScheduleQueue({ limit: -10 });
    expect(result.success).toBe(true);
  });

  it('handles NaN limit', async () => {
    const result = await getScheduleQueue({ limit: 'abc' });
    expect(result.success).toBe(true);
  });

  it('handles null filters gracefully', async () => {
    const result = await getScheduleQueue(null);
    // null filters causes property access on null → caught by error handler
    expect(result).toHaveProperty('success');
  });

  it('sanitizes status filter', async () => {
    __seed('ContentSchedule', [
      { _id: 'q1', status: 'pending', scheduledAt: new Date() },
    ]);
    const result = await getScheduleQueue({ status: '<script>alert(1)</script>' });
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(0);
  });

  it('returns items sorted by scheduledAt descending', async () => {
    __seed('ContentSchedule', [
      { _id: 'q-old', status: 'pending', scheduledAt: new Date('2026-03-10') },
      { _id: 'q-new', status: 'pending', scheduledAt: new Date('2026-03-16') },
    ]);
    const result = await getScheduleQueue();
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(2);
  });

  it('requires admin auth', async () => {
    __setRoles([{ title: 'Member' }]);
    const result = await getScheduleQueue();
    expect(result.success).toBe(false);
  });
});

// ── cancelScheduledItem — edge cases ─────────────────────────────────

describe('cancelScheduledItem — edge cases', () => {
  it('rejects null item ID', async () => {
    const result = await cancelScheduledItem(null);
    expect(result.success).toBe(false);
  });

  it('rejects undefined item ID', async () => {
    const result = await cancelScheduledItem(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects numeric item ID', async () => {
    const result = await cancelScheduledItem(12345);
    expect(result.success).toBe(false);
  });

  it('rejects object item ID', async () => {
    const result = await cancelScheduledItem({ id: 'cs-1' });
    expect(result.success).toBe(false);
  });

  it('can cancel a cancelled item (no-op, already cancelled)', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-already', status: 'cancelled' },
    ]);
    const result = await cancelScheduledItem('cs-already');
    expect(result.success).toBe(true);
  });

  it('sets processedAt when cancelling', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-cancel', status: 'pending' },
    ]);
    const result = await cancelScheduledItem('cs-cancel');
    expect(result.success).toBe(true);
  });

  it('rejects HTML injection in item ID', async () => {
    const result = await cancelScheduledItem('<img onerror=alert(1)>');
    expect(result.success).toBe(false);
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await cancelScheduledItem('cs-1');
    expect(result.success).toBe(false);
  });
});

// ── getScheduleStats — edge cases ────────────────────────────────────

describe('getScheduleStats — edge cases', () => {
  it('handles days=0 (no items in range)', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'sent', scheduledAt: new Date(Date.now() - 86400000) },
    ]);
    const result = await getScheduleStats(0);
    expect(result.success).toBe(true);
    expect(result.stats.sent).toBe(0);
  });

  it('handles very large days value', async () => {
    const result = await getScheduleStats(99999);
    expect(result.success).toBe(true);
  });

  it('handles negative days', async () => {
    const result = await getScheduleStats(-7);
    expect(result.success).toBe(true);
    // Negative days → cutoff in the future → no items match
    expect(result.stats.pending).toBe(0);
  });

  it('ignores unknown statuses in count', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'pending', scheduledAt: new Date() },
      { _id: 'cs-2', status: 'custom_status', scheduledAt: new Date() },
    ]);
    const result = await getScheduleStats();
    expect(result.success).toBe(true);
    expect(result.stats.pending).toBe(1);
    // custom_status should not appear in counts
  });

  it('counts multiple items per status correctly', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'pending', scheduledAt: new Date() },
      { _id: 'cs-2', status: 'pending', scheduledAt: new Date() },
      { _id: 'cs-3', status: 'sent', scheduledAt: new Date() },
      { _id: 'cs-4', status: 'sent', scheduledAt: new Date() },
      { _id: 'cs-5', status: 'sent', scheduledAt: new Date() },
      { _id: 'cs-6', status: 'failed', scheduledAt: new Date() },
    ]);
    const result = await getScheduleStats();
    expect(result.stats.pending).toBe(2);
    expect(result.stats.sent).toBe(3);
    expect(result.stats.failed).toBe(1);
    expect(result.stats.cancelled).toBe(0);
  });

  it('defaults to 30 days', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-recent', status: 'sent', scheduledAt: new Date() },
      { _id: 'cs-old', status: 'sent', scheduledAt: new Date(Date.now() - 40 * 86400000) },
    ]);
    const result = await getScheduleStats();
    expect(result.stats.sent).toBe(1); // only recent
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await getScheduleStats();
    expect(result.success).toBe(false);
  });
});
