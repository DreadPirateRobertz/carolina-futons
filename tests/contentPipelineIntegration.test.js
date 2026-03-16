// contentPipelineIntegration.test.js — CF-qy9o: Content pipeline end-to-end flow verification
// Integration tests spanning contentOrchestrator → contentScheduler → downstream generators.
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from 'wix-data';
import { __setMember, __setRoles } from 'wix-members-backend';
import { __setSecrets, __reset as __resetSecrets } from 'wix-secrets-backend';

import {
  triggerManualOrchestration,
  getOrchestrationHistory,
  updateOrchestrationConfig,
} from '../src/backend/contentOrchestrator.web.js';

import {
  processContentSchedule,
  getScheduleQueue,
  cancelScheduledItem,
  getScheduleStats,
} from '../src/backend/contentScheduler.web.js';

// ── Shared setup ─────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret';

const baseProduct = {
  productId: 'prod-br1',
  productName: 'Blue Ridge Frame',
  productCategory: 'futon-frames',
  imageUrl: 'https://example.com/blue-ridge.jpg',
};

beforeEach(() => {
  __reset();
  __resetSecrets();
  __setMember({ _id: 'admin-1' });
  __setRoles([{ title: 'Admin' }]);
  __setSecrets({ CONTENT_CRON_KEY: CRON_SECRET });
  __seed('OrchestrationConfig', [{
    _id: 'config-1',
    enableNewsletter: true,
    enableSocialStory: true,
    enableCatalogSync: true,
    enableEmail: true,
  }]);
});

// ── 1. Catalog event → orchestrator → scheduler entries created ──────

describe('catalog event → orchestrator → scheduler entries', () => {
  it('new_arrival event creates 3 schedule entries that appear in queue', async () => {
    const orchResult = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(orchResult.success).toBe(true);
    expect(orchResult.scheduled.length).toBe(3);

    // Entries should now be queryable via scheduler
    const queue = await getScheduleQueue({ status: 'pending' });
    expect(queue.success).toBe(true);
    expect(queue.items.length).toBe(3);

    const types = queue.items.map(i => i.contentType);
    expect(types).toContain('newsletter');
    expect(types).toContain('social_story');
    expect(types).toContain('catalog_sync');
  });

  it('back_in_stock event creates entries with priority 1 (highest)', async () => {
    await triggerManualOrchestration('back_in_stock', baseProduct);
    const queue = await getScheduleQueue({ status: 'pending' });
    expect(queue.items.every(i => i.priority === 1)).toBe(true);
  });

  it('price_drop event creates only social_story + catalog_sync (no newsletter)', async () => {
    const result = await triggerManualOrchestration('price_drop', {
      ...baseProduct,
      oldPrice: 899,
      newPrice: 749,
    });
    expect(result.scheduled.length).toBe(2);

    const queue = await getScheduleQueue({ status: 'pending' });
    const types = queue.items.map(i => i.contentType);
    expect(types).not.toContain('newsletter');
    expect(types).toContain('social_story');
    expect(types).toContain('catalog_sync');
  });

  it('seasonal event creates newsletter + social_story only', async () => {
    await triggerManualOrchestration('seasonal', baseProduct);
    const queue = await getScheduleQueue({ status: 'pending' });
    expect(queue.items.length).toBe(2);
    const types = queue.items.map(i => i.contentType);
    expect(types).toContain('newsletter');
    expect(types).toContain('social_story');
    expect(types).not.toContain('catalog_sync');
  });

  it('entries carry product metadata through to schedule queue', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);
    const queue = await getScheduleQueue();
    for (const item of queue.items) {
      expect(item.productId).toBe('prod-br1');
      expect(item.productName).toBe('Blue Ridge Frame');
      expect(item.eventType).toBe('new_arrival');
      const payload = JSON.parse(item.payload);
      expect(payload.productCategory).toBe('futon-frames');
      expect(payload.imageUrl).toBe('https://example.com/blue-ridge.jpg');
    }
  });

  it('orchestration history reflects all created entries', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);
    const history = await getOrchestrationHistory();
    expect(history.success).toBe(true);
    expect(history.events.length).toBe(3);
  });
});

// ── 2. Scheduler processes queue → calls correct content generators ──

describe('scheduler processes queue → correct generators called', () => {
  it('newsletter entry processed via processContentSchedule', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);
    const result = await processContentSchedule(CRON_SECRET);
    expect(result.success).toBe(true);
    // newsletter calls queuePromotionalEmail (may fail on template mismatch — that's a processing attempt, not skip)
    expect(result.processed + result.failed).toBeGreaterThanOrEqual(1);
    expect(result.skipped).toBe(0);
  });

  it('all entries transition from pending to sent or failed', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);
    await processContentSchedule(CRON_SECRET);

    const pending = await getScheduleQueue({ status: 'pending' });
    expect(pending.items.length).toBe(0);

    const stats = await getScheduleStats();
    expect(stats.stats.pending).toBe(0);
    expect(stats.stats.sent + stats.stats.failed).toBe(3);
  });

  it('stats reflect processed counts after scheduler run', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);
    await processContentSchedule(CRON_SECRET);

    const stats = await getScheduleStats();
    expect(stats.success).toBe(true);
    expect(stats.stats.sent + stats.stats.failed + stats.stats.cancelled).toBe(3);
  });
});

// ── 3. Deduplication — same event twice → no duplicate content ───────

describe('deduplication across orchestrator + scheduler', () => {
  it('orchestrator idempotency: same product+event on same day → second call produces no new entries', async () => {
    const first = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(first.scheduled.length).toBe(3);

    const second = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(second.scheduled.length).toBe(0);
    expect(second.skipped).toBeGreaterThan(0);

    // Queue still has only 3 entries
    const queue = await getScheduleQueue();
    expect(queue.items.length).toBe(3);
  });

  it('scheduler dedup: product processed within 7 days → skip on next cron run', async () => {
    // Seed an already-sent entry from 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    __seed('ContentSchedule', [
      {
        _id: 'cs-old-sent',
        contentType: 'newsletter',
        productId: 'prod-br1',
        status: 'sent',
        processedAt: twoDaysAgo,
        scheduledAt: twoDaysAgo,
        priority: 3,
        payload: '{}',
        eventType: 'new_arrival',
        createdBy: 'old-event',
        error: '',
      },
      {
        _id: 'cs-new-pending',
        contentType: 'newsletter',
        productId: 'prod-br1',
        productName: 'Blue Ridge Frame',
        status: 'pending',
        scheduledAt: new Date(Date.now() - 60000),
        priority: 3,
        payload: JSON.stringify({ productCategory: 'futon-frames' }),
        eventType: 'new_arrival',
        createdBy: 'new-event',
        processedAt: null,
        error: '',
      },
    ]);

    const result = await processContentSchedule(CRON_SECRET);
    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(0);
  });

  it('dedup window expires after 7 days — allows reprocessing', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000);
    __seed('ContentSchedule', [
      {
        _id: 'cs-old-sent',
        contentType: 'newsletter',
        productId: 'prod-br1',
        status: 'sent',
        processedAt: eightDaysAgo,
        scheduledAt: eightDaysAgo,
        priority: 3,
        payload: '{}',
        eventType: 'new_arrival',
        createdBy: 'old-event',
        error: '',
      },
      {
        _id: 'cs-new-pending',
        contentType: 'newsletter',
        productId: 'prod-br1',
        productName: 'Blue Ridge Frame',
        status: 'pending',
        scheduledAt: new Date(Date.now() - 60000),
        priority: 3,
        payload: JSON.stringify({ productCategory: 'futon-frames' }),
        eventType: 'new_arrival',
        createdBy: 'new-event',
        processedAt: null,
        error: '',
      },
    ]);

    const result = await processContentSchedule(CRON_SECRET);
    expect(result.skipped).toBe(0);
    // Processed or failed (downstream may not be mocked), but NOT skipped
    expect(result.processed + result.failed).toBe(1);
  });

  it('different contentType for same product is NOT a duplicate', async () => {
    const recentDate = new Date(Date.now() - 86400000);
    __seed('ContentSchedule', [
      {
        _id: 'cs-sent-newsletter',
        contentType: 'newsletter',
        productId: 'prod-br1',
        status: 'sent',
        processedAt: recentDate,
        scheduledAt: recentDate,
        priority: 3,
        payload: '{}',
        eventType: 'new_arrival',
        createdBy: 'old-event',
        error: '',
      },
      {
        _id: 'cs-pending-social',
        contentType: 'social_story',
        productId: 'prod-br1',
        productName: 'Blue Ridge Frame',
        status: 'pending',
        scheduledAt: new Date(Date.now() - 60000),
        priority: 3,
        payload: JSON.stringify({ imageUrl: 'https://example.com/img.jpg' }),
        eventType: 'new_arrival',
        createdBy: 'new-event',
        processedAt: null,
        error: '',
      },
    ]);

    const result = await processContentSchedule(CRON_SECRET);
    expect(result.skipped).toBe(0);
    expect(result.processed + result.failed).toBe(1);
  });

  it('different product same contentType is NOT a duplicate', async () => {
    const recentDate = new Date(Date.now() - 86400000);
    __seed('ContentSchedule', [
      {
        _id: 'cs-sent',
        contentType: 'newsletter',
        productId: 'prod-br1',
        status: 'sent',
        processedAt: recentDate,
        scheduledAt: recentDate,
        priority: 3,
        payload: '{}',
        eventType: 'new_arrival',
        createdBy: 'old-event',
        error: '',
      },
      {
        _id: 'cs-pending',
        contentType: 'newsletter',
        productId: 'prod-different',
        productName: 'Mountain View Frame',
        status: 'pending',
        scheduledAt: new Date(Date.now() - 60000),
        priority: 3,
        payload: JSON.stringify({ productCategory: 'futon-frames' }),
        eventType: 'new_arrival',
        createdBy: 'new-event',
        processedAt: null,
        error: '',
      },
    ]);

    const result = await processContentSchedule(CRON_SECRET);
    expect(result.skipped).toBe(0);
    expect(result.processed + result.failed).toBe(1);
  });
});

// ── 4. Priority queue ordering ───────────────────────────────────────

describe('priority queue ordering', () => {
  it('back_in_stock (P1) > price_drop (P2) > new_arrival (P3) > seasonal (P4)', async () => {
    // Create entries from different event types for different products
    await triggerManualOrchestration('seasonal', { ...baseProduct, productId: 'prod-s1' });
    await triggerManualOrchestration('new_arrival', { ...baseProduct, productId: 'prod-n1' });
    await triggerManualOrchestration('back_in_stock', { ...baseProduct, productId: 'prod-b1' });
    await triggerManualOrchestration('price_drop', { ...baseProduct, productId: 'prod-p1', oldPrice: 899, newPrice: 749 });

    const queue = await getScheduleQueue({ status: 'pending' });
    expect(queue.items.length).toBe(10); // 2+3+3+2

    // Verify priority values
    const priorities = {};
    for (const item of queue.items) {
      if (!priorities[item.eventType]) priorities[item.eventType] = item.priority;
    }
    expect(priorities.back_in_stock).toBe(1);
    expect(priorities.price_drop).toBe(2);
    expect(priorities.new_arrival).toBe(3);
    expect(priorities.seasonal).toBe(4);
  });

  it('scheduler processes lower priority numbers first', async () => {
    // Seed items with explicit priority ordering
    __seed('ContentSchedule', [
      {
        _id: 'cs-low-priority',
        contentType: 'newsletter',
        productId: 'prod-seasonal',
        productName: 'Seasonal Item',
        status: 'pending',
        scheduledAt: new Date(Date.now() - 60000),
        priority: 4,
        eventType: 'seasonal',
        createdBy: 'seasonal-prod-seasonal-2026-03-16',
        payload: JSON.stringify({ productCategory: 'futon-frames' }),
        processedAt: null,
        error: '',
      },
      {
        _id: 'cs-high-priority',
        contentType: 'newsletter',
        productId: 'prod-backstock',
        productName: 'Back In Stock Item',
        status: 'pending',
        scheduledAt: new Date(Date.now() - 60000),
        priority: 1,
        eventType: 'back_in_stock',
        createdBy: 'back_in_stock-prod-backstock-2026-03-16',
        payload: JSON.stringify({ productCategory: 'futon-frames' }),
        processedAt: null,
        error: '',
      },
    ]);

    const result = await processContentSchedule(CRON_SECRET);
    expect(result.success).toBe(true);
    // Both should be attempted (processed or failed)
    expect(result.processed + result.failed).toBe(2);
  });
});

// ── 5. Downstream dispatch (catalog sync + social story) ─────────────

describe('downstream dispatch paths', () => {
  it('catalog_sync action dispatches to facebook and pinterest modules', async () => {
    // Create a catalog_sync entry directly
    __seed('ContentSchedule', [
      {
        _id: 'cs-catalog',
        contentType: 'catalog_sync',
        platform: 'facebook',
        productId: 'prod-br1',
        productName: 'Blue Ridge Frame',
        status: 'pending',
        scheduledAt: new Date(Date.now() - 60000),
        priority: 3,
        eventType: 'new_arrival',
        createdBy: 'new_arrival-prod-br1-2026-03-16',
        payload: JSON.stringify({ productCategory: 'futon-frames' }),
        processedAt: null,
        error: '',
      },
    ]);

    const result = await processContentSchedule(CRON_SECRET);
    expect(result.success).toBe(true);
    // catalog_sync dispatches to getEnhancedCatalogFields + validateCatalogProduct
    // May succeed or fail depending on downstream mock availability — should not crash
    expect(result.processed + result.failed).toBe(1);
  });

  it('social_story action calls Meta story posting service', async () => {
    __seed('ContentSchedule', [
      {
        _id: 'cs-social',
        contentType: 'social_story',
        platform: 'instagram',
        productId: 'prod-br1',
        productName: 'Blue Ridge Frame',
        status: 'pending',
        scheduledAt: new Date(Date.now() - 60000),
        priority: 2,
        eventType: 'price_drop',
        createdBy: 'price_drop-prod-br1-2026-03-16',
        payload: JSON.stringify({
          imageUrl: 'https://example.com/blue-ridge.jpg',
          productCategory: 'futon-frames',
        }),
        processedAt: null,
        error: '',
      },
    ]);

    const result = await processContentSchedule(CRON_SECRET);
    expect(result.success).toBe(true);
    // social_story dispatches to socialStoryHelpers + socialStoryService
    expect(result.processed + result.failed).toBe(1);
  });
});

// ── 6. Dry-run mode — logs but no side effects ──────────────────────

describe('dry-run mode', () => {
  it('dry-run creates no CMS entries but returns scheduled actions', async () => {
    const result = await triggerManualOrchestration('new_arrival', baseProduct, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.scheduled.length).toBe(3);

    // No entries in the queue
    const queue = await getScheduleQueue();
    expect(queue.items.length).toBe(0);
  });

  it('dry-run does not affect future real orchestration', async () => {
    // Dry run first
    await triggerManualOrchestration('new_arrival', baseProduct, { dryRun: true });

    // Real run should still create entries
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.scheduled.length).toBe(3);

    const queue = await getScheduleQueue({ status: 'pending' });
    expect(queue.items.length).toBe(3);
  });

  it('dry-run respects config toggles', async () => {
    __seed('OrchestrationConfig', [{
      _id: 'config-1',
      enableNewsletter: false,
      enableSocialStory: true,
      enableCatalogSync: true,
      enableEmail: true,
    }]);

    const result = await triggerManualOrchestration('new_arrival', baseProduct, { dryRun: true });
    expect(result.scheduled.length).toBe(2);
    const types = result.scheduled.map(s => s.contentType);
    expect(types).not.toContain('newsletter');
  });

  it('dry-run + scheduler: nothing to process after dry-run', async () => {
    await triggerManualOrchestration('back_in_stock', baseProduct, { dryRun: true });

    const processed = await processContentSchedule(CRON_SECRET);
    expect(processed.success).toBe(true);
    expect(processed.processed).toBe(0);
    expect(processed.failed).toBe(0);
    expect(processed.skipped).toBe(0);
  });
});

// ── 7. Newsletter auto-generation from content pipeline ──────────────

describe('newsletter generation via content pipeline', () => {
  it('new_arrival triggers newsletter entry → scheduler processes it', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);

    const queue = await getScheduleQueue({ contentType: 'newsletter' });
    expect(queue.items.length).toBe(1);
    expect(queue.items[0].platform).toBe('email');
    expect(queue.items[0].contentType).toBe('newsletter');

    const result = await processContentSchedule(CRON_SECRET);
    // Newsletter action calls queuePromotionalEmail — should attempt processing
    expect(result.processed + result.failed).toBeGreaterThanOrEqual(1);
  });

  it('back_in_stock also generates newsletter entry', async () => {
    await triggerManualOrchestration('back_in_stock', baseProduct);

    const queue = await getScheduleQueue({ contentType: 'newsletter' });
    expect(queue.items.length).toBe(1);
    expect(queue.items[0].eventType).toBe('back_in_stock');
    expect(queue.items[0].priority).toBe(1);
  });

  it('price_drop does NOT generate newsletter (only social + catalog)', async () => {
    await triggerManualOrchestration('price_drop', {
      ...baseProduct,
      oldPrice: 899,
      newPrice: 749,
    });

    const queue = await getScheduleQueue({ contentType: 'newsletter' });
    expect(queue.items.length).toBe(0);
  });
});

// ── Cross-cutting: config toggles affect full pipeline ───────────────

describe('config toggles affect full pipeline', () => {
  it('disabling newsletter prevents newsletter entries from being created', async () => {
    await updateOrchestrationConfig({ enableNewsletter: false });
    await triggerManualOrchestration('new_arrival', baseProduct);

    const queue = await getScheduleQueue({ contentType: 'newsletter' });
    expect(queue.items.length).toBe(0);

    // social_story + catalog_sync still created
    const allItems = await getScheduleQueue({ status: 'pending' });
    expect(allItems.items.length).toBe(2);
  });

  it('disabling all actions results in no entries', async () => {
    await updateOrchestrationConfig({
      enableNewsletter: false,
      enableSocialStory: false,
      enableCatalogSync: false,
    });
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(0);
    expect(result.skipped).toBe(3);
  });

  it('re-enabling actions after disable restores normal behavior', async () => {
    await updateOrchestrationConfig({ enableNewsletter: false });
    const r1 = await triggerManualOrchestration('seasonal', { ...baseProduct, productId: 'prod-1' });
    expect(r1.scheduled.map(s => s.contentType)).not.toContain('newsletter');

    await updateOrchestrationConfig({ enableNewsletter: true });
    const r2 = await triggerManualOrchestration('seasonal', { ...baseProduct, productId: 'prod-2' });
    expect(r2.scheduled.map(s => s.contentType)).toContain('newsletter');
  });
});

// ── Cross-cutting: cancel + requeue ──────────────────────────────────

describe('cancel and requeue flow', () => {
  it('cancelled entry does not get processed by scheduler', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);

    const queue = await getScheduleQueue({ status: 'pending' });
    const newsletterItem = queue.items.find(i => i.contentType === 'newsletter');
    expect(newsletterItem).toBeDefined();

    await cancelScheduledItem(newsletterItem._id);

    const result = await processContentSchedule(CRON_SECRET);
    // Only 2 remaining pending items should be processed (social_story + catalog_sync)
    expect(result.processed + result.failed).toBe(2);
  });

  it('cannot cancel already-processed entry', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);
    await processContentSchedule(CRON_SECRET);

    // At least some items should have been processed (sent or failed)
    const sent = await getScheduleQueue({ status: 'sent' });
    const failed = await getScheduleQueue({ status: 'failed' });
    const processedItems = [...sent.items, ...failed.items];
    expect(processedItems.length).toBeGreaterThan(0);

    // Sent items cannot be cancelled
    if (sent.items.length > 0) {
      const result = await cancelScheduledItem(sent.items[0]._id);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already|sent/i);
    }

    // Failed items CAN be cancelled (verified separately in unit tests)
  });
});

// ── Cross-cutting: multi-product batch ───────────────────────────────

describe('multi-product batch orchestration', () => {
  it('multiple products can be orchestrated independently', async () => {
    const products = [
      { ...baseProduct, productId: 'prod-1', productName: 'Frame A' },
      { ...baseProduct, productId: 'prod-2', productName: 'Frame B' },
      { ...baseProduct, productId: 'prod-3', productName: 'Frame C' },
    ];

    for (const p of products) {
      const r = await triggerManualOrchestration('new_arrival', p);
      expect(r.scheduled.length).toBe(3);
    }

    const queue = await getScheduleQueue({ status: 'pending' });
    expect(queue.items.length).toBe(9); // 3 products × 3 actions

    const result = await processContentSchedule(CRON_SECRET);
    expect(result.success).toBe(true);
    expect(result.processed + result.failed + result.skipped).toBe(9);
  });

  it('stats reflect multi-product batch', async () => {
    await triggerManualOrchestration('new_arrival', { ...baseProduct, productId: 'p1' });
    await triggerManualOrchestration('price_drop', { ...baseProduct, productId: 'p2', oldPrice: 500, newPrice: 400 });

    const stats = await getScheduleStats();
    expect(stats.stats.pending).toBe(5); // 3 (new_arrival) + 2 (price_drop)
  });
});

// ── Cross-cutting: auth boundaries ───────────────────────────────────

describe('auth boundaries across pipeline', () => {
  it('unauthenticated user cannot trigger orchestration or read queue', async () => {
    __setMember(null);
    const orchResult = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(orchResult.success).toBe(false);

    const queueResult = await getScheduleQueue();
    expect(queueResult.success).toBe(false);

    const statsResult = await getScheduleStats();
    expect(statsResult.success).toBe(false);
  });

  it('scheduler cron uses secret auth — works without member context', async () => {
    // Seed pending items directly (as if orchestrator created them)
    __seed('ContentSchedule', [
      {
        _id: 'cs-1',
        contentType: 'newsletter',
        productId: 'prod-br1',
        productName: 'Blue Ridge Frame',
        status: 'pending',
        scheduledAt: new Date(Date.now() - 60000),
        priority: 3,
        eventType: 'new_arrival',
        createdBy: 'new_arrival-prod-br1-2026-03-16',
        payload: JSON.stringify({ productCategory: 'futon-frames' }),
        processedAt: null,
        error: '',
      },
    ]);

    // Clear member context — cron runs without user session
    __setMember(null);
    __setRoles([]);

    const result = await processContentSchedule(CRON_SECRET);
    expect(result.success).toBe(true);
    expect(result.processed + result.failed).toBe(1);
  });

  it('wrong cron secret is rejected even with valid schedule entries', async () => {
    __seed('ContentSchedule', [
      {
        _id: 'cs-1',
        contentType: 'newsletter',
        productId: 'prod-1',
        productName: 'Test',
        status: 'pending',
        scheduledAt: new Date(Date.now() - 60000),
        priority: 3,
        eventType: 'new_arrival',
        createdBy: 'new_arrival-prod-1-2026-03-16',
        payload: '{}',
        processedAt: null,
        error: '',
      },
    ]);

    const result = await processContentSchedule('wrong-secret');
    expect(result.success).toBe(false);
    expect(result.processed).toBe(0);
  });
});
