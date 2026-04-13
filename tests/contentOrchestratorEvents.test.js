// contentOrchestratorEvents.test.js — CF-tap5: Wix Events integration + dry-run + dashboard
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __setQueryError } from 'wix-data';
import { __setMember, __setRoles } from 'wix-members-backend';
import { __setSecrets, __reset as __resetSecrets } from 'wix-secrets-backend';

import {
  triggerEventOrchestration,
  previewOrchestration,
  getOrchestrationDashboard,
  triggerManualOrchestration,
} from '../src/backend/contentOrchestrator.web.js';

import {
  wixStores_onProductCreated,
  wixStores_onProductUpdated,
} from '../src/backend/events.js';

const EVENT_SECRET = 'test-event-secret';

beforeEach(() => {
  __reset();
  __resetSecrets();
  __setMember({ _id: 'admin-1' });
  __setRoles([{ title: 'Admin' }]);
  __setSecrets({ CONTENT_EVENT_KEY: EVENT_SECRET });
  __seed('OrchestrationConfig', [{
    _id: 'config-1',
    enableNewsletter: true,
    enableSocialStory: true,
    enableCatalogSync: true,
    enableEmail: true,
  }]);
});

const baseProduct = {
  productId: 'prod-br1',
  productName: 'Blue Ridge Frame',
  productCategory: 'futon-frames',
  imageUrl: 'https://example.com/blue-ridge.jpg',
};

// ── triggerEventOrchestration (secret-authenticated) ─────────────────

describe('triggerEventOrchestration', () => {
  it('schedules actions for new_arrival with valid secret', async () => {
    __setMember(null);
    __setRoles([]);
    const result = await triggerEventOrchestration(EVENT_SECRET, 'new_arrival', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(3);
  });

  it('rejects invalid secret', async () => {
    const result = await triggerEventOrchestration('wrong-secret', 'new_arrival', baseProduct);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth|secret/i);
  });

  it('rejects empty secret', async () => {
    const result = await triggerEventOrchestration('', 'new_arrival', baseProduct);
    expect(result.success).toBe(false);
  });

  it('rejects null secret', async () => {
    const result = await triggerEventOrchestration(null, 'new_arrival', baseProduct);
    expect(result.success).toBe(false);
  });

  it('schedules actions for price_drop', async () => {
    const result = await triggerEventOrchestration(EVENT_SECRET, 'price_drop', {
      ...baseProduct,
      oldPrice: 899,
      newPrice: 749,
    });
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(2);
    const types = result.scheduled.map(s => s.contentType);
    expect(types).toContain('social_story');
    expect(types).toContain('catalog_sync');
  });

  it('schedules actions for back_in_stock', async () => {
    const result = await triggerEventOrchestration(EVENT_SECRET, 'back_in_stock', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(3);
  });

  it('schedules actions for seasonal', async () => {
    const result = await triggerEventOrchestration(EVENT_SECRET, 'seasonal', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(2);
  });

  it('rejects invalid event type', async () => {
    const result = await triggerEventOrchestration(EVENT_SECRET, 'invalid', baseProduct);
    expect(result.success).toBe(false);
  });

  it('rejects missing productId', async () => {
    const result = await triggerEventOrchestration(EVENT_SECRET, 'new_arrival', { productName: 'Test' });
    expect(result.success).toBe(false);
  });

  it('idempotent — second call skips duplicates', async () => {
    await triggerEventOrchestration(EVENT_SECRET, 'new_arrival', baseProduct);
    const r2 = await triggerEventOrchestration(EVENT_SECRET, 'new_arrival', baseProduct);
    expect(r2.scheduled.length).toBe(0);
    expect(r2.skipped).toBeGreaterThan(0);
  });

  it('respects config toggles', async () => {
    __seed('OrchestrationConfig', [{
      _id: 'config-1',
      enableNewsletter: false,
      enableSocialStory: true,
      enableCatalogSync: true,
      enableEmail: true,
    }]);
    const result = await triggerEventOrchestration(EVENT_SECRET, 'new_arrival', baseProduct);
    expect(result.scheduled.map(s => s.contentType)).not.toContain('newsletter');
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('returns success false and safe fallback when DB throws (catch branch)', async () => {
    // Covers the catch(err) block in triggerEventOrchestration (lines ~214-216)
    __setQueryError('ContentSchedule', new Error('DB timeout'));
    const result = await triggerEventOrchestration(EVENT_SECRET, 'new_arrival', baseProduct);
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.scheduled).toEqual([]);
  });
});

// ── Wix Event Handlers ──────────────────────────────────────────────

describe('wixStores_onProductCreated', () => {
  it('triggers new_arrival orchestration for new product', async () => {
    await wixStores_onProductCreated({
      entity: {
        _id: 'prod-new1',
        name: 'Asheville Daybed',
        productType: 'futon-frames',
        mainMedia: 'https://example.com/asheville.jpg',
      },
    });

    const { items } = await (await import('wix-data')).default
      .query('ContentSchedule')
      .eq('productId', 'prod-new1')
      .find();
    expect(items.length).toBe(3);
    expect(items[0].eventType).toBe('new_arrival');
  });

  it('skips products without _id', async () => {
    await wixStores_onProductCreated({ entity: { name: 'No ID Product' } });
    const { items } = await (await import('wix-data')).default
      .query('ContentSchedule')
      .find();
    expect(items.length).toBe(0);
  });

  it('handles missing event entity gracefully', async () => {
    await wixStores_onProductCreated({});
  });
});

describe('wixStores_onProductUpdated', () => {
  it('triggers price_drop orchestration when price decreases', async () => {
    await wixStores_onProductUpdated({
      entity: {
        _id: 'prod-pd1',
        name: 'Blue Ridge Frame',
        productType: 'futon-frames',
        mainMedia: 'https://example.com/blue-ridge.jpg',
        price: { amount: 749 },
      },
      previousEntity: {
        price: { amount: 899 },
      },
    });

    const { items } = await (await import('wix-data')).default
      .query('ContentSchedule')
      .eq('productId', 'prod-pd1')
      .find();
    expect(items.length).toBe(2);
    expect(items[0].eventType).toBe('price_drop');
  });

  it('does NOT trigger on price increase', async () => {
    await wixStores_onProductUpdated({
      entity: {
        _id: 'prod-pi1',
        name: 'Frame',
        price: { amount: 999 },
      },
      previousEntity: {
        price: { amount: 799 },
      },
    });

    const { items } = await (await import('wix-data')).default
      .query('ContentSchedule')
      .eq('productId', 'prod-pi1')
      .find();
    expect(items.length).toBe(0);
  });

  it('does NOT trigger when price unchanged', async () => {
    await wixStores_onProductUpdated({
      entity: {
        _id: 'prod-same',
        name: 'Frame',
        price: { amount: 799 },
      },
      previousEntity: {
        price: { amount: 799 },
      },
    });

    const { items } = await (await import('wix-data')).default
      .query('ContentSchedule')
      .eq('productId', 'prod-same')
      .find();
    expect(items.length).toBe(0);
  });

  it('does NOT trigger when previous price is null', async () => {
    await wixStores_onProductUpdated({
      entity: {
        _id: 'prod-noprev',
        name: 'Frame',
        price: { amount: 799 },
      },
      previousEntity: {},
    });

    const { items } = await (await import('wix-data')).default
      .query('ContentSchedule')
      .eq('productId', 'prod-noprev')
      .find();
    expect(items.length).toBe(0);
  });

  it('skips products without _id', async () => {
    await wixStores_onProductUpdated({
      entity: { name: 'No ID', price: { amount: 500 } },
      previousEntity: { price: { amount: 700 } },
    });
  });

  it('handles flat price values (not nested objects)', async () => {
    await wixStores_onProductUpdated({
      entity: {
        _id: 'prod-flat',
        name: 'Flat Price Frame',
        price: 599,
      },
      previousEntity: {
        price: 799,
      },
    });

    const { items } = await (await import('wix-data')).default
      .query('ContentSchedule')
      .eq('productId', 'prod-flat')
      .find();
    expect(items.length).toBe(2);
  });
});

// ── previewOrchestration (dry-run preview) ──────────────────────────

describe('previewOrchestration', () => {
  it('returns planned actions without writing to CMS', async () => {
    const result = await previewOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(true);
    expect(result.planned.length).toBe(3);

    const { items } = await (await import('wix-data')).default
      .query('ContentSchedule')
      .find();
    expect(items.length).toBe(0);
  });

  it('includes reason and priority in planned actions', async () => {
    const result = await previewOrchestration('back_in_stock', baseProduct);
    for (const action of result.planned) {
      expect(action.reason).toMatch(/back_in_stock/);
      expect(action.priority).toBe(1);
      expect(action.platform).toBeDefined();
      expect(action.eventId).toBeDefined();
    }
  });

  it('shows wouldSkip count for disabled actions', async () => {
    __seed('OrchestrationConfig', [{
      _id: 'config-1',
      enableNewsletter: false,
      enableSocialStory: false,
      enableCatalogSync: true,
      enableEmail: true,
    }]);
    const result = await previewOrchestration('new_arrival', baseProduct);
    expect(result.planned.length).toBe(1);
    expect(result.planned[0].contentType).toBe('catalog_sync');
    expect(result.wouldSkip).toBe(2);
  });

  it('shows wouldSkip for already-existing entries', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);
    const result = await previewOrchestration('new_arrival', baseProduct);
    expect(result.planned.length).toBe(0);
    expect(result.wouldSkip).toBe(3);
  });

  it('rejects invalid event type', async () => {
    const result = await previewOrchestration('bogus', baseProduct);
    expect(result.success).toBe(false);
  });

  it('rejects missing productId', async () => {
    const result = await previewOrchestration('new_arrival', { productName: 'Test' });
    expect(result.success).toBe(false);
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await previewOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(false);
  });
});

// ── getOrchestrationDashboard ───────────────────────────────────────

describe('getOrchestrationDashboard', () => {
  it('returns pending items, config, and stats in one call', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);

    const dashboard = await getOrchestrationDashboard();
    expect(dashboard.success).toBe(true);
    expect(dashboard.pending.length).toBe(3);
    expect(dashboard.pending[0].status).toBe('pending');
    expect(dashboard.config.enableNewsletter).toBe(true);
    expect(dashboard.config.enableSocialStory).toBe(true);
    expect(dashboard.stats.pending).toBe(3);
    expect(dashboard.stats.sent).toBe(0);
  });

  it('returns empty dashboard when no data', async () => {
    const dashboard = await getOrchestrationDashboard();
    expect(dashboard.success).toBe(true);
    expect(dashboard.pending.length).toBe(0);
    expect(dashboard.stats.pending).toBe(0);
  });

  it('pending items are sorted by priority ascending', async () => {
    await triggerManualOrchestration('seasonal', { ...baseProduct, productId: 'p-s' });
    await triggerManualOrchestration('back_in_stock', { ...baseProduct, productId: 'p-b' });

    const dashboard = await getOrchestrationDashboard();
    const priorities = dashboard.pending.map(i => i.priority);
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
    }
  });

  it('stats count sent/failed/cancelled entries from last 30 days', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'sent', scheduledAt: new Date(), contentType: 'newsletter' },
      { _id: 'cs-2', status: 'failed', scheduledAt: new Date(), contentType: 'social_story' },
      { _id: 'cs-3', status: 'cancelled', scheduledAt: new Date(), contentType: 'catalog_sync' },
      { _id: 'cs-4', status: 'pending', scheduledAt: new Date(), contentType: 'newsletter' },
    ]);

    const dashboard = await getOrchestrationDashboard();
    expect(dashboard.stats.sent).toBe(1);
    expect(dashboard.stats.failed).toBe(1);
    expect(dashboard.stats.cancelled).toBe(1);
    expect(dashboard.stats.pending).toBe(1);
    expect(dashboard.pending.length).toBe(1);
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const dashboard = await getOrchestrationDashboard();
    expect(dashboard.success).toBe(false);
  });

  it('non-admin is rejected', async () => {
    __setRoles([{ title: 'Member' }]);
    const dashboard = await getOrchestrationDashboard();
    expect(dashboard.success).toBe(false);
  });
});
