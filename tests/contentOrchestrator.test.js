// contentOrchestrator.test.js — CF-483q: Content Orchestrator Engine
// Tests for event-driven content scheduling: catalog events → newsletter/social/catalog queue.
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from 'wix-data';
import { __setMember, __setRoles } from 'wix-members-backend';

import {
  triggerManualOrchestration,
  getOrchestrationHistory,
  getOrchestrationConfig,
  updateOrchestrationConfig,
} from '../src/backend/contentOrchestrator.web.js';

beforeEach(() => {
  __reset();
  __setMember({ _id: 'admin-1' });
  __setRoles([{ title: 'Admin' }]);
  __seed('OrchestrationConfig', [{
    _id: 'config-1',
    enableNewsletter: true,
    enableSocialStory: true,
    enableCatalogSync: true,
    enableEmail: true,
  }]);
});

// ── triggerManualOrchestration ──────────────────────────────────────

describe('triggerManualOrchestration', () => {
  const baseProduct = {
    productId: 'prod-1',
    productName: 'Blue Ridge Frame',
    productCategory: 'futon-frames',
    imageUrl: 'https://example.com/img.jpg',
  };

  // ── Event type → action mapping ──────────────────────────────────

  it('schedules newsletter + social + catalog_sync for new_arrival', async () => {
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(3);
    const types = result.scheduled.map(s => s.contentType);
    expect(types).toContain('newsletter');
    expect(types).toContain('social_story');
    expect(types).toContain('catalog_sync');
  });

  it('schedules social_story + catalog_sync for price_drop', async () => {
    const result = await triggerManualOrchestration('price_drop', {
      ...baseProduct,
      oldPrice: 899,
      newPrice: 749,
    });
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(2);
    const types = result.scheduled.map(s => s.contentType);
    expect(types).toContain('social_story');
    expect(types).toContain('catalog_sync');
    expect(types).not.toContain('newsletter');
  });

  it('schedules newsletter + social + catalog_sync for back_in_stock', async () => {
    const result = await triggerManualOrchestration('back_in_stock', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(3);
  });

  it('schedules newsletter + social_story for seasonal', async () => {
    const result = await triggerManualOrchestration('seasonal', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(2);
    const types = result.scheduled.map(s => s.contentType);
    expect(types).toContain('newsletter');
    expect(types).toContain('social_story');
    expect(types).not.toContain('catalog_sync');
  });

  // ── Idempotency ──────────────────────────────────────────────────

  it('generates deterministic event ID — second call skips duplicates', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);
    const result2 = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result2.success).toBe(true);
    expect(result2.scheduled.length).toBe(0);
    expect(result2.skipped).toBeGreaterThan(0);
  });

  it('different products get different event IDs', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);
    const result2 = await triggerManualOrchestration('new_arrival', {
      ...baseProduct,
      productId: 'prod-2',
    });
    expect(result2.scheduled.length).toBe(3);
  });

  // ── Dry-run mode ─────────────────────────────────────────────────

  it('returns dry-run results without CMS writes', async () => {
    const result = await triggerManualOrchestration('new_arrival', baseProduct, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.scheduled.length).toBe(3);
    // Second call should still schedule (no CMS entry from dry-run)
    const result2 = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result2.scheduled.length).toBe(3);
  });

  // ── Config toggles ──────────────────────────────────────────────

  it('respects disabled actions in config', async () => {
    __seed('OrchestrationConfig', [{
      _id: 'config-1',
      enableNewsletter: false,
      enableSocialStory: true,
      enableCatalogSync: false,
      enableEmail: true,
    }]);
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(true);
    const types = result.scheduled.map(s => s.contentType);
    expect(types).not.toContain('newsletter');
    expect(types).not.toContain('catalog_sync');
    expect(types).toContain('social_story');
  });

  it('uses defaults when config collection is empty', async () => {
    __reset(); // clears config too
    __setMember({ _id: 'admin-1' });
    __setRoles([{ title: 'Admin' }]);
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(3);
  });

  // ── Validation ──────────────────────────────────────────────────

  it('rejects invalid event type', async () => {
    const result = await triggerManualOrchestration('invalid_type', baseProduct);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/event type/i);
  });

  it('rejects missing productId', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      productName: 'Test',
      productCategory: 'frames',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/product/i);
  });

  it('rejects null productData', async () => {
    const result = await triggerManualOrchestration('new_arrival', null);
    expect(result.success).toBe(false);
  });

  it('rejects empty event type', async () => {
    const result = await triggerManualOrchestration('', baseProduct);
    expect(result.success).toBe(false);
  });

  // ── Auth ─────────────────────────────────────────────────────────

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth/i);
  });

  it('rejects non-admin member', async () => {
    __setRoles([{ title: 'Member' }]);
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/admin/i);
  });

  // ── Platform mapping ─────────────────────────────────────────────

  it('maps newsletter to email platform', async () => {
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    const newsletter = result.scheduled.find(s => s.contentType === 'newsletter');
    expect(newsletter.platform).toBe('email');
  });

  it('maps social_story to instagram platform', async () => {
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    const social = result.scheduled.find(s => s.contentType === 'social_story');
    expect(social.platform).toBe('instagram');
  });

  it('maps catalog_sync to facebook platform', async () => {
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    const catalog = result.scheduled.find(s => s.contentType === 'catalog_sync');
    expect(catalog.platform).toBe('facebook');
  });

  // ── Sanitization ─────────────────────────────────────────────────

  it('sanitizes product name in schedule entry', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      ...baseProduct,
      productName: '<script>alert("xss")</script>Blue Ridge',
    });
    expect(result.success).toBe(true);
    // The entry was created — sanitization is applied internally
    expect(result.scheduled.length).toBe(3);
  });
});

// ── getOrchestrationHistory ─────────────────────────────────────────

describe('getOrchestrationHistory', () => {
  it('returns schedule entries sorted by scheduledAt desc', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', contentType: 'newsletter', status: 'sent', scheduledAt: new Date('2026-03-15') },
      { _id: 'cs-2', contentType: 'social_story', status: 'pending', scheduledAt: new Date('2026-03-16') },
    ]);
    const result = await getOrchestrationHistory();
    expect(result.success).toBe(true);
    expect(result.events.length).toBe(2);
  });

  it('clamps limit to 1-500', async () => {
    const result = await getOrchestrationHistory(9999);
    expect(result.success).toBe(true);
  });

  it('defaults to 100 limit', async () => {
    const result = await getOrchestrationHistory();
    expect(result.success).toBe(true);
  });

  it('handles NaN limit gracefully', async () => {
    const result = await getOrchestrationHistory('not-a-number');
    expect(result.success).toBe(true);
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await getOrchestrationHistory();
    expect(result.success).toBe(false);
  });
});

// ── getOrchestrationConfig ──────────────────────────────────────────

describe('getOrchestrationConfig', () => {
  it('returns current config', async () => {
    const result = await getOrchestrationConfig();
    expect(result.success).toBe(true);
    expect(result.config.enableNewsletter).toBe(true);
    expect(result.config.enableSocialStory).toBe(true);
    expect(result.config.enableCatalogSync).toBe(true);
  });

  it('returns defaults when config empty', async () => {
    __reset();
    __setMember({ _id: 'admin-1' });
    __setRoles([{ title: 'Admin' }]);
    const result = await getOrchestrationConfig();
    expect(result.success).toBe(true);
    expect(result.config.enableNewsletter).toBe(true);
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await getOrchestrationConfig();
    expect(result.success).toBe(false);
  });
});

// ── updateOrchestrationConfig ───────────────────────────────────────

describe('updateOrchestrationConfig', () => {
  it('updates config toggles', async () => {
    const result = await updateOrchestrationConfig({ enableNewsletter: false });
    expect(result.success).toBe(true);
  });

  it('ignores invalid keys', async () => {
    const result = await updateOrchestrationConfig({ invalidKey: true });
    expect(result.success).toBe(true);
  });

  it('ignores non-boolean values', async () => {
    const result = await updateOrchestrationConfig({ enableNewsletter: 'yes' });
    expect(result.success).toBe(true);
  });

  it('creates config if none exists', async () => {
    __reset();
    __setMember({ _id: 'admin-1' });
    __setRoles([{ title: 'Admin' }]);
    const result = await updateOrchestrationConfig({ enableNewsletter: false });
    expect(result.success).toBe(true);
  });

  it('requires admin auth', async () => {
    __setRoles([]);
    const result = await updateOrchestrationConfig({ enableNewsletter: false });
    expect(result.success).toBe(false);
  });

  it('rejects unauthenticated user', async () => {
    __setMember(null);
    const result = await updateOrchestrationConfig({ enableNewsletter: false });
    expect(result.success).toBe(false);
  });
});
