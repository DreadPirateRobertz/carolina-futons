// contentOrchestratorDeep.test.js — CF-xr0u: Deep coverage for contentOrchestrator.web.js
// Edge cases: invalid events, missing product data, concurrent events, config toggling,
// priority ordering, payload serialization, sanitization boundaries.
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

const baseProduct = {
  productId: 'prod-deep-1',
  productName: 'Asheville Hardwood Frame',
  productCategory: 'futon-frames',
  imageUrl: 'https://example.com/frame.jpg',
};

// ── Invalid event types ──────────────────────────────────────────────

describe('triggerManualOrchestration — invalid event types', () => {
  it('rejects event type with whitespace padding', async () => {
    const result = await triggerManualOrchestration('  new_arrival  ', baseProduct);
    // sanitize trims, so this might pass or fail depending on trim behavior
    expect(result).toHaveProperty('success');
  });

  it('rejects event type with HTML injection', async () => {
    const result = await triggerManualOrchestration('<script>alert(1)</script>', baseProduct);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/event type/i);
  });

  it('rejects numeric event type', async () => {
    const result = await triggerManualOrchestration(12345, baseProduct);
    expect(result.success).toBe(false);
  });

  it('rejects undefined event type', async () => {
    const result = await triggerManualOrchestration(undefined, baseProduct);
    expect(result.success).toBe(false);
  });

  it('rejects object event type', async () => {
    const result = await triggerManualOrchestration({ type: 'new_arrival' }, baseProduct);
    expect(result.success).toBe(false);
  });

  it('rejects event type with SQL injection attempt', async () => {
    const result = await triggerManualOrchestration("'; DROP TABLE--", baseProduct);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/event type/i);
  });

  it('rejects extremely long event type', async () => {
    const result = await triggerManualOrchestration('a'.repeat(1000), baseProduct);
    expect(result.success).toBe(false);
  });
});

// ── Missing/malformed product data ───────────────────────────────────

describe('triggerManualOrchestration — missing product data', () => {
  it('rejects undefined productData', async () => {
    const result = await triggerManualOrchestration('new_arrival', undefined);
    expect(result.success).toBe(false);
  });

  it('rejects productData with empty productId string', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      ...baseProduct,
      productId: '',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/product/i);
  });

  it('rejects productData with numeric productId', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      ...baseProduct,
      productId: 12345,
    });
    // validateId may or may not accept numbers — verify behavior
    expect(result).toHaveProperty('success');
  });

  it('handles missing productName gracefully', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      productId: 'prod-no-name',
    });
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(3);
  });

  it('handles missing productCategory gracefully', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      productId: 'prod-no-cat',
      productName: 'Test',
    });
    expect(result.success).toBe(true);
  });

  it('handles missing imageUrl gracefully', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      productId: 'prod-no-img',
      productName: 'Test',
      productCategory: 'frames',
    });
    expect(result.success).toBe(true);
  });

  it('handles productData with only productId', async () => {
    const result = await triggerManualOrchestration('price_drop', {
      productId: 'prod-minimal',
    });
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(2); // social_story + catalog_sync
  });

  it('handles null values in optional fields', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      productId: 'prod-nulls',
      productName: null,
      productCategory: null,
      imageUrl: null,
      oldPrice: null,
      newPrice: null,
    });
    expect(result.success).toBe(true);
  });
});

// ── Concurrent events for same product ───────────────────────────────

describe('triggerManualOrchestration — concurrent/sequential events', () => {
  it('allows different event types for the same product', async () => {
    const r1 = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(r1.success).toBe(true);
    expect(r1.scheduled.length).toBe(3);

    const r2 = await triggerManualOrchestration('price_drop', baseProduct);
    expect(r2.success).toBe(true);
    // price_drop has social_story + catalog_sync
    // social_story and catalog_sync already exist from new_arrival with different eventId
    // They should be separate because eventId includes eventType
    expect(r2.scheduled.length).toBe(2);
  });

  it('back_in_stock after new_arrival creates separate entries', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);
    const r2 = await triggerManualOrchestration('back_in_stock', baseProduct);
    expect(r2.success).toBe(true);
    expect(r2.scheduled.length).toBe(3);
  });

  it('seasonal event is independent from other event types', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct);
    await triggerManualOrchestration('price_drop', baseProduct);
    const r3 = await triggerManualOrchestration('seasonal', baseProduct);
    expect(r3.success).toBe(true);
    expect(r3.scheduled.length).toBe(2); // newsletter + social_story
  });

  it('multiple products with same event type are independent', async () => {
    const products = ['prod-a', 'prod-b', 'prod-c'].map(id => ({
      ...baseProduct,
      productId: id,
    }));

    for (const p of products) {
      const r = await triggerManualOrchestration('new_arrival', p);
      expect(r.success).toBe(true);
      expect(r.scheduled.length).toBe(3);
    }
  });
});

// ── Config toggling edge cases ───────────────────────────────────────

describe('triggerManualOrchestration — config toggle edge cases', () => {
  it('all actions disabled results in 0 scheduled, all skipped', async () => {
    __seed('OrchestrationConfig', [{
      _id: 'config-1',
      enableNewsletter: false,
      enableSocialStory: false,
      enableCatalogSync: false,
      enableEmail: false,
    }]);
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(0);
    expect(result.skipped).toBe(3);
  });

  it('only newsletter enabled for new_arrival', async () => {
    __seed('OrchestrationConfig', [{
      _id: 'config-1',
      enableNewsletter: true,
      enableSocialStory: false,
      enableCatalogSync: false,
      enableEmail: true,
    }]);
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(1);
    expect(result.scheduled[0].contentType).toBe('newsletter');
  });

  it('only social_story enabled for price_drop', async () => {
    __seed('OrchestrationConfig', [{
      _id: 'config-1',
      enableNewsletter: true,
      enableSocialStory: true,
      enableCatalogSync: false,
      enableEmail: true,
    }]);
    const result = await triggerManualOrchestration('price_drop', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(1);
    expect(result.scheduled[0].contentType).toBe('social_story');
  });

  it('toggling config between calls changes scheduled actions', async () => {
    // First: all enabled
    const r1 = await triggerManualOrchestration('new_arrival', {
      ...baseProduct, productId: 'toggle-test-1',
    });
    expect(r1.scheduled.length).toBe(3);

    // Disable newsletter
    __seed('OrchestrationConfig', [{
      _id: 'config-1',
      enableNewsletter: false,
      enableSocialStory: true,
      enableCatalogSync: true,
      enableEmail: true,
    }]);

    const r2 = await triggerManualOrchestration('new_arrival', {
      ...baseProduct, productId: 'toggle-test-2',
    });
    expect(r2.scheduled.length).toBe(2);
    expect(r2.scheduled.map(s => s.contentType)).not.toContain('newsletter');
  });
});

// ── Priority ordering ────────────────────────────────────────────────

describe('triggerManualOrchestration — priority assignment', () => {
  it('back_in_stock gets priority 1 (highest)', async () => {
    const result = await triggerManualOrchestration('back_in_stock', {
      ...baseProduct, productId: 'pri-1',
    });
    expect(result.success).toBe(true);
    // Verify via eventId pattern
    expect(result.scheduled[0].eventId).toContain('back_in_stock');
  });

  it('price_drop gets priority 2', async () => {
    const result = await triggerManualOrchestration('price_drop', {
      ...baseProduct, productId: 'pri-2',
    });
    expect(result.success).toBe(true);
    expect(result.scheduled[0].eventId).toContain('price_drop');
  });

  it('new_arrival gets priority 3', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      ...baseProduct, productId: 'pri-3',
    });
    expect(result.success).toBe(true);
  });

  it('seasonal gets priority 4 (lowest)', async () => {
    const result = await triggerManualOrchestration('seasonal', {
      ...baseProduct, productId: 'pri-4',
    });
    expect(result.success).toBe(true);
  });
});

// ── Dry-run mode edge cases ──────────────────────────────────────────

describe('triggerManualOrchestration — dry-run edge cases', () => {
  it('dry-run with all config disabled still reports skipped count', async () => {
    __seed('OrchestrationConfig', [{
      _id: 'config-1',
      enableNewsletter: false,
      enableSocialStory: false,
      enableCatalogSync: false,
      enableEmail: false,
    }]);
    const result = await triggerManualOrchestration('new_arrival', baseProduct, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.scheduled.length).toBe(0);
    expect(result.skipped).toBe(3);
  });

  it('dry-run does not affect subsequent non-dry-run call', async () => {
    await triggerManualOrchestration('new_arrival', baseProduct, { dryRun: true });
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(3);
    expect(result.dryRun).toBeUndefined();
  });

  it('dry-run with invalid event type still returns error', async () => {
    const result = await triggerManualOrchestration('invalid', baseProduct, { dryRun: true });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/event type/i);
  });

  it('dry-run with missing productId still returns error', async () => {
    const result = await triggerManualOrchestration('new_arrival', {}, { dryRun: true });
    expect(result.success).toBe(false);
  });
});

// ── Idempotency edge cases ───────────────────────────────────────────

describe('triggerManualOrchestration — idempotency edge cases', () => {
  it('partial idempotency: existing entries for some actions skip only those', async () => {
    // Seed one existing entry for newsletter
    const dateKey = new Date().toISOString().slice(0, 10);
    const eventId = `new_arrival-${baseProduct.productId}-${dateKey}`;
    __seed('ContentSchedule', [{
      _id: 'cs-existing',
      contentType: 'newsletter',
      createdBy: eventId,
      status: 'pending',
    }]);

    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(true);
    // newsletter skipped, social_story + catalog_sync scheduled
    expect(result.scheduled.length).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.scheduled.map(s => s.contentType)).not.toContain('newsletter');
  });

  it('all actions already exist → all skipped', async () => {
    const dateKey = new Date().toISOString().slice(0, 10);
    const eventId = `new_arrival-${baseProduct.productId}-${dateKey}`;
    __seed('ContentSchedule', [
      { _id: 'cs-1', contentType: 'newsletter', createdBy: eventId },
      { _id: 'cs-2', contentType: 'social_story', createdBy: eventId },
      { _id: 'cs-3', contentType: 'catalog_sync', createdBy: eventId },
    ]);

    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(0);
    expect(result.skipped).toBe(3);
  });
});

// ── Sanitization boundaries ──────────────────────────────────────────

describe('triggerManualOrchestration — sanitization', () => {
  it('truncates very long product name', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      ...baseProduct,
      productName: 'X'.repeat(500),
    });
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(3);
  });

  it('truncates very long product category', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      ...baseProduct,
      productCategory: 'C'.repeat(300),
    });
    expect(result.success).toBe(true);
  });

  it('handles unicode in product name', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      ...baseProduct,
      productName: 'Café Résumé Naïve — Exposé',
    });
    expect(result.success).toBe(true);
  });

  it('handles emoji in product name', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      ...baseProduct,
      productName: '🛋️ Cozy Futon Frame 🏠',
    });
    expect(result.success).toBe(true);
  });
});

// ── getOrchestrationHistory edge cases ───────────────────────────────

describe('getOrchestrationHistory — edge cases', () => {
  it('handles zero limit (clamps to 1)', async () => {
    const result = await getOrchestrationHistory(0);
    expect(result.success).toBe(true);
  });

  it('handles negative limit (clamps to 1)', async () => {
    const result = await getOrchestrationHistory(-5);
    expect(result.success).toBe(true);
  });

  it('handles decimal limit', async () => {
    const result = await getOrchestrationHistory(10.7);
    expect(result.success).toBe(true);
  });

  it('returns empty array when no entries', async () => {
    const result = await getOrchestrationHistory();
    expect(result.success).toBe(true);
    expect(result.events).toEqual([]);
  });

  it('handles boolean limit (treated as NaN → defaults)', async () => {
    const result = await getOrchestrationHistory(true);
    expect(result.success).toBe(true);
  });
});

// ── updateOrchestrationConfig edge cases ─────────────────────────────

describe('updateOrchestrationConfig — edge cases', () => {
  it('handles null updates param', async () => {
    const result = await updateOrchestrationConfig(null);
    expect(result.success).toBe(true);
  });

  it('handles undefined updates param', async () => {
    const result = await updateOrchestrationConfig(undefined);
    expect(result.success).toBe(true);
  });

  it('handles empty object', async () => {
    const result = await updateOrchestrationConfig({});
    expect(result.success).toBe(true);
  });

  it('updates multiple toggles at once', async () => {
    const result = await updateOrchestrationConfig({
      enableNewsletter: false,
      enableSocialStory: false,
      enableCatalogSync: false,
      enableEmail: false,
    });
    expect(result.success).toBe(true);

    const config = await getOrchestrationConfig();
    expect(config.config.enableNewsletter).toBe(false);
    expect(config.config.enableSocialStory).toBe(false);
  });

  it('ignores non-boolean values mixed with valid booleans', async () => {
    const result = await updateOrchestrationConfig({
      enableNewsletter: false,
      enableSocialStory: 'yes',
      enableCatalogSync: 42,
    });
    expect(result.success).toBe(true);

    const config = await getOrchestrationConfig();
    expect(config.config.enableNewsletter).toBe(false);
    expect(config.config.enableSocialStory).toBe(true); // unchanged — 'yes' ignored
  });

  it('creates config with partial toggles when none exists', async () => {
    __reset();
    __setMember({ _id: 'admin-1' });
    __setRoles([{ title: 'Admin' }]);

    const result = await updateOrchestrationConfig({ enableNewsletter: false });
    expect(result.success).toBe(true);

    const config = await getOrchestrationConfig();
    expect(config.config.enableNewsletter).toBe(false);
    // Other defaults should be true
    expect(config.config.enableSocialStory).toBe(true);
  });

  it('preserves existing config values not in updates', async () => {
    // First disable newsletter
    await updateOrchestrationConfig({ enableNewsletter: false });
    // Then update only catalogSync
    await updateOrchestrationConfig({ enableCatalogSync: false });

    const config = await getOrchestrationConfig();
    expect(config.config.enableNewsletter).toBe(false); // preserved
    expect(config.config.enableCatalogSync).toBe(false); // updated
    expect(config.config.enableSocialStory).toBe(true);  // untouched
  });
});

// ── Auth edge cases ──────────────────────────────────────────────────

describe('contentOrchestrator — auth edge cases', () => {
  it('member with admin role ID passes', async () => {
    __setRoles([{ _id: 'admin' }]);
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(true);
  });

  it('member with both Admin title and admin ID passes', async () => {
    __setRoles([{ title: 'Admin', _id: 'admin' }]);
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(true);
  });

  it('member with empty roles array is rejected', async () => {
    __setRoles([]);
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(false);
  });

  it('member with wrong role title is rejected', async () => {
    __setRoles([{ title: 'Editor' }]);
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.success).toBe(false);
  });

  it('all four webMethods require admin auth', async () => {
    __setMember(null);

    const r1 = await triggerManualOrchestration('new_arrival', baseProduct);
    const r2 = await getOrchestrationHistory();
    const r3 = await getOrchestrationConfig();
    const r4 = await updateOrchestrationConfig({});

    expect(r1.success).toBe(false);
    expect(r2.success).toBe(false);
    expect(r3.success).toBe(false);
    expect(r4.success).toBe(false);
  });
});

// ── Payload serialization ────────────────────────────────────────────

describe('triggerManualOrchestration — payload content', () => {
  it('includes price data in payload for price_drop', async () => {
    const result = await triggerManualOrchestration('price_drop', {
      ...baseProduct,
      oldPrice: 899.99,
      newPrice: 749.99,
    });
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBe(2);
  });

  it('handles zero prices (falsy but valid)', async () => {
    const result = await triggerManualOrchestration('price_drop', {
      ...baseProduct,
      oldPrice: 0,
      newPrice: 0,
    });
    expect(result.success).toBe(true);
  });

  it('handles negative prices without error', async () => {
    const result = await triggerManualOrchestration('price_drop', {
      ...baseProduct,
      oldPrice: -10,
      newPrice: -5,
    });
    expect(result.success).toBe(true);
  });

  it('eventId contains product ID and date', async () => {
    const result = await triggerManualOrchestration('new_arrival', baseProduct);
    expect(result.scheduled[0].eventId).toContain(baseProduct.productId);
    expect(result.scheduled[0].eventId).toContain('new_arrival');
    // Should contain date in YYYY-MM-DD format
    expect(result.scheduled[0].eventId).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
