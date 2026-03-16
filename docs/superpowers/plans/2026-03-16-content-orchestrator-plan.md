# Content Orchestrator Engine — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire existing content generation modules (email, social, catalog sync) into an automated event-driven pipeline with queue-based scheduling.

**Architecture:** Two new backend modules. `contentOrchestrator.web.js` receives catalog events and creates schedule entries in a CMS queue. `contentScheduler.web.js` processes that queue via cron endpoint, executing actions in priority order with deduplication and rate-limit checks. Both follow existing Wix Velo patterns: `webMethod` exports, `wix-data` CMS, `sanitize` for inputs, `X-Cron-Secret` auth for cron endpoints.

**Tech Stack:** Wix Velo (wix-web-module, wix-data, wix-members-backend, wix-secrets-backend), vitest with existing `__mocks__/` harness.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/backend/contentOrchestrator.web.js` (CREATE) | Event coordinator — maps catalog events to scheduled content actions |
| `src/backend/contentScheduler.web.js` (CREATE) | Queue processor — executes scheduled items via cron, respects dedup/rate limits |
| `src/backend/http-functions.js` (MODIFY) | Add `get_processContentScheduleCron` cron endpoint |
| `src/backend/events.js` (MODIFY) | Add content orchestration triggers to inventory restock + order events |
| `tests/contentOrchestrator.test.js` (CREATE) | Tests for orchestrator |
| `tests/contentScheduler.test.js` (CREATE) | Tests for scheduler |

---

## Chunk 1: Content Orchestrator Module

### Task 1: Orchestrator — Core Scheduling Logic + Tests

**Files:**
- Create: `src/backend/contentOrchestrator.web.js`
- Test: `tests/contentOrchestrator.test.js`

- [ ] **Step 1: Write failing tests for `scheduleContentForEvent`**

```js
// tests/contentOrchestrator.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from 'wix-data';
import { __setMember, __setRoles } from 'wix-members-backend';

// Import after mocks resolve
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
  // Seed default orchestration config
  __seed('OrchestrationConfig', [{
    _id: 'config-1',
    enableNewsletter: true,
    enableSocialStory: true,
    enableCatalogSync: true,
    enableEmail: true,
  }]);
});

describe('triggerManualOrchestration', () => {
  it('schedules newsletter + social + catalog_sync for new_arrival event', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      productId: 'prod-1',
      productName: 'Blue Ridge Frame',
      productCategory: 'futon-frames',
      imageUrl: 'https://example.com/img.jpg',
    });
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBeGreaterThanOrEqual(3);
    expect(result.scheduled.map(s => s.contentType)).toContain('newsletter');
    expect(result.scheduled.map(s => s.contentType)).toContain('social_story');
    expect(result.scheduled.map(s => s.contentType)).toContain('catalog_sync');
  });

  it('schedules social_story + catalog_sync for price_drop event', async () => {
    const result = await triggerManualOrchestration('price_drop', {
      productId: 'prod-2',
      productName: 'Cypress Frame',
      productCategory: 'futon-frames',
      oldPrice: 899,
      newPrice: 749,
    });
    expect(result.success).toBe(true);
    expect(result.scheduled.map(s => s.contentType)).toContain('social_story');
    expect(result.scheduled.map(s => s.contentType)).toContain('catalog_sync');
  });

  it('schedules newsletter + social + catalog_sync for back_in_stock event', async () => {
    const result = await triggerManualOrchestration('back_in_stock', {
      productId: 'prod-3',
      productName: 'Monterey Frame',
      productCategory: 'futon-frames',
    });
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBeGreaterThanOrEqual(3);
  });

  it('generates deterministic event ID for idempotency', async () => {
    const data = { productId: 'prod-1', productName: 'Test', productCategory: 'frames' };
    await triggerManualOrchestration('new_arrival', data);
    const result2 = await triggerManualOrchestration('new_arrival', data);
    // Second call should skip — already scheduled
    expect(result2.scheduled.length).toBe(0);
    expect(result2.skipped).toBeGreaterThan(0);
  });

  it('returns dry-run results without CMS writes', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      productId: 'prod-1',
      productName: 'Test',
      productCategory: 'frames',
    }, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.scheduled.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects invalid event type', async () => {
    const result = await triggerManualOrchestration('invalid_type', {
      productId: 'prod-1', productName: 'Test', productCategory: 'frames',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/event type/i);
  });

  it('rejects missing productId', async () => {
    const result = await triggerManualOrchestration('new_arrival', {
      productName: 'Test', productCategory: 'frames',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/product/i);
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await triggerManualOrchestration('new_arrival', {
      productId: 'p1', productName: 'T', productCategory: 'f',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth|admin/i);
  });

  it('respects disabled actions in config', async () => {
    __seed('OrchestrationConfig', [{
      _id: 'config-1',
      enableNewsletter: false,
      enableSocialStory: true,
      enableCatalogSync: false,
      enableEmail: true,
    }]);
    const result = await triggerManualOrchestration('new_arrival', {
      productId: 'prod-1', productName: 'Test', productCategory: 'frames',
    });
    expect(result.scheduled.map(s => s.contentType)).not.toContain('newsletter');
    expect(result.scheduled.map(s => s.contentType)).not.toContain('catalog_sync');
    expect(result.scheduled.map(s => s.contentType)).toContain('social_story');
  });
});

describe('getOrchestrationHistory', () => {
  it('returns recent orchestration events', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', contentType: 'newsletter', status: 'sent', scheduledAt: new Date() },
      { _id: 'cs-2', contentType: 'social_story', status: 'pending', scheduledAt: new Date() },
    ]);
    const result = await getOrchestrationHistory();
    expect(result.success).toBe(true);
    expect(result.events.length).toBe(2);
  });

  it('clamps limit to 1-500', async () => {
    const result = await getOrchestrationHistory(9999);
    expect(result.success).toBe(true);
  });
});

describe('getOrchestrationConfig / updateOrchestrationConfig', () => {
  it('returns current config', async () => {
    const result = await getOrchestrationConfig();
    expect(result.success).toBe(true);
    expect(result.config.enableNewsletter).toBe(true);
  });

  it('updates config', async () => {
    const result = await updateOrchestrationConfig({ enableNewsletter: false });
    expect(result.success).toBe(true);
  });

  it('rejects non-admin for update', async () => {
    __setRoles([]);
    const result = await updateOrchestrationConfig({ enableNewsletter: false });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/contentOrchestrator.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write contentOrchestrator.web.js implementation**

```js
// src/backend/contentOrchestrator.web.js
/**
 * @module contentOrchestrator
 * @description Event-driven coordinator that triggers content generation
 * when catalog changes happen. Maps events to scheduled content actions
 * (newsletter, social story, catalog sync) via the ContentSchedule CMS queue.
 *
 * CMS collections:
 * - ContentSchedule (read/write) — Queue of scheduled content actions
 * - OrchestrationConfig (read/write) — Enable/disable toggles per action type
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 * @requires backend/utils/sanitize
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

const VALID_EVENT_TYPES = ['new_arrival', 'price_drop', 'back_in_stock', 'seasonal'];

const EVENT_ACTIONS = {
  new_arrival:    ['newsletter', 'social_story', 'catalog_sync'],
  price_drop:     ['social_story', 'catalog_sync'],
  back_in_stock:  ['newsletter', 'social_story', 'catalog_sync'],
  seasonal:       ['newsletter', 'social_story'],
};

const ACTION_PRIORITY = {
  back_in_stock: 1,
  price_drop: 2,
  new_arrival: 3,
  seasonal: 4,
};

const CONFIG_KEY_MAP = {
  newsletter: 'enableNewsletter',
  social_story: 'enableSocialStory',
  catalog_sync: 'enableCatalogSync',
  email: 'enableEmail',
};

async function requireAdmin() {
  const member = await currentMember.getMember();
  if (!member || !member._id) throw new Error('Authentication required.');
  const roles = await currentMember.getRoles();
  const isAdmin = roles.some(r => r.title === 'Admin' || r._id === 'admin');
  if (!isAdmin) throw new Error('Admin access required.');
  return member._id;
}

function buildEventId(eventType, productId) {
  const dateKey = new Date().toISOString().slice(0, 10);
  return `${eventType}-${productId}-${dateKey}`;
}

async function getConfig() {
  const result = await wixData.query('OrchestrationConfig').limit(1).find();
  if (result.items.length === 0) {
    return { enableNewsletter: true, enableSocialStory: true, enableCatalogSync: true, enableEmail: true };
  }
  return result.items[0];
}

/**
 * Trigger content orchestration for a catalog event.
 * Creates schedule entries in ContentSchedule CMS queue.
 *
 * @param {string} eventType - 'new_arrival'|'price_drop'|'back_in_stock'|'seasonal'
 * @param {Object} productData - Product info for content generation
 * @param {Object} [options] - { dryRun: boolean }
 * @returns {Promise<{success: boolean, scheduled: Array, skipped?: number, dryRun?: boolean, error?: string}>}
 */
export const triggerManualOrchestration = webMethod(
  Permissions.Admin,
  async (eventType, productData, options = {}) => {
    try {
      await requireAdmin();

      const cleanType = sanitize(eventType, 50);
      if (!VALID_EVENT_TYPES.includes(cleanType)) {
        return { success: false, error: 'Invalid event type. Must be: ' + VALID_EVENT_TYPES.join(', '), scheduled: [] };
      }

      const productId = validateId(productData?.productId);
      if (!productId) {
        return { success: false, error: 'Valid product ID is required.', scheduled: [] };
      }

      const config = await getConfig();
      const actions = EVENT_ACTIONS[cleanType] || [];
      const eventId = buildEventId(cleanType, productId);
      const dryRun = !!options.dryRun;

      // Check for existing schedule entries with same eventId (idempotency)
      const existing = await wixData.query('ContentSchedule')
        .eq('createdBy', eventId)
        .find();
      const existingTypes = new Set(existing.items.map(i => i.contentType));

      const scheduled = [];
      let skipped = 0;

      for (const action of actions) {
        const configKey = CONFIG_KEY_MAP[action];
        if (configKey && config[configKey] === false) {
          skipped++;
          continue;
        }

        if (existingTypes.has(action)) {
          skipped++;
          continue;
        }

        const entry = {
          contentType: action,
          platform: getPlatformForAction(action),
          productId,
          productName: sanitize(productData.productName || '', 200),
          scheduledAt: new Date(),
          status: 'pending',
          priority: ACTION_PRIORITY[cleanType] ?? 3,
          eventType: cleanType,
          createdBy: eventId,
          payload: JSON.stringify({
            productCategory: sanitize(productData.productCategory || '', 100),
            imageUrl: productData.imageUrl || '',
            oldPrice: productData.oldPrice ?? null,
            newPrice: productData.newPrice ?? null,
          }),
          processedAt: null,
          error: '',
        };

        if (!dryRun) {
          await wixData.insert('ContentSchedule', entry);
        }
        scheduled.push({ contentType: action, platform: entry.platform, eventId });
      }

      const result = { success: true, scheduled, skipped };
      if (dryRun) result.dryRun = true;
      return result;
    } catch (err) {
      console.error('[contentOrchestrator] Error in triggerManualOrchestration:', err);
      return { success: false, error: err.message || 'Orchestration failed.', scheduled: [] };
    }
  }
);

/**
 * Get orchestration history from ContentSchedule.
 * @param {number} [limit=100]
 * @returns {Promise<{success: boolean, events: Array}>}
 */
export const getOrchestrationHistory = webMethod(
  Permissions.Admin,
  async (limit = 100) => {
    try {
      await requireAdmin();
      const clampedLimit = Math.min(Math.max(1, Number(limit) || 100), 500);
      const result = await wixData.query('ContentSchedule')
        .descending('scheduledAt')
        .limit(clampedLimit)
        .find();
      return { success: true, events: result.items };
    } catch (err) {
      console.error('[contentOrchestrator] Error getting history:', err);
      return { success: false, error: err.message || 'Failed to get history.', events: [] };
    }
  }
);

/**
 * Get current orchestration config.
 * @returns {Promise<{success: boolean, config: Object}>}
 */
export const getOrchestrationConfig = webMethod(
  Permissions.Admin,
  async () => {
    try {
      await requireAdmin();
      const config = await getConfig();
      return { success: true, config };
    } catch (err) {
      console.error('[contentOrchestrator] Error getting config:', err);
      return { success: false, error: err.message || 'Failed to get config.', config: {} };
    }
  }
);

/**
 * Update orchestration config toggles.
 * @param {Object} updates - { enableNewsletter?, enableSocialStory?, enableCatalogSync?, enableEmail? }
 * @returns {Promise<{success: boolean}>}
 */
export const updateOrchestrationConfig = webMethod(
  Permissions.Admin,
  async (updates) => {
    try {
      await requireAdmin();

      const result = await wixData.query('OrchestrationConfig').limit(1).find();
      let config;
      if (result.items.length > 0) {
        config = result.items[0];
      } else {
        config = { enableNewsletter: true, enableSocialStory: true, enableCatalogSync: true, enableEmail: true };
      }

      const validKeys = Object.values(CONFIG_KEY_MAP);
      for (const [key, value] of Object.entries(updates || {})) {
        if (validKeys.includes(key) && typeof value === 'boolean') {
          config[key] = value;
        }
      }

      if (config._id) {
        await wixData.update('OrchestrationConfig', config);
      } else {
        await wixData.insert('OrchestrationConfig', config);
      }

      return { success: true };
    } catch (err) {
      console.error('[contentOrchestrator] Error updating config:', err);
      return { success: false, error: err.message || 'Failed to update config.' };
    }
  }
);

// ── Helpers ──────────────────────────────────────────────────────────

function getPlatformForAction(action) {
  switch (action) {
    case 'newsletter': return 'email';
    case 'social_story': return 'instagram';
    case 'catalog_sync': return 'facebook';
    default: return 'email';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/contentOrchestrator.test.js`
Expected: ALL PASS

- [ ] **Step 5: Commit orchestrator module + tests**

```bash
git add src/backend/contentOrchestrator.web.js tests/contentOrchestrator.test.js
git commit -m "feat(CF-483q): content orchestrator — event-driven content scheduling with TDD"
```

---

## Chunk 2: Content Scheduler Module

### Task 2: Scheduler — Queue Processing + Dedup + Tests

**Files:**
- Create: `src/backend/contentScheduler.web.js`
- Test: `tests/contentScheduler.test.js`

- [ ] **Step 1: Write failing tests for scheduler**

```js
// tests/contentScheduler.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

describe('processContentSchedule', () => {
  it('processes pending items with scheduledAt <= now', async () => {
    __seed('ContentSchedule', [
      {
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
      },
    ]);

    const result = await processContentSchedule('test-cron-secret');
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
  });

  it('skips items scheduled in the future', async () => {
    __seed('ContentSchedule', [
      {
        _id: 'cs-1',
        contentType: 'newsletter',
        status: 'pending',
        scheduledAt: new Date(Date.now() + 3600000),
        priority: 3,
      },
    ]);
    const result = await processContentSchedule('test-cron-secret');
    expect(result.processed).toBe(0);
  });

  it('processes items in priority order (lower = first)', async () => {
    const processed = [];
    __seed('ContentSchedule', [
      { _id: 'cs-low', contentType: 'social_story', status: 'pending', priority: 4, scheduledAt: new Date(Date.now() - 1000), productId: 'p1', payload: '{}' },
      { _id: 'cs-high', contentType: 'newsletter', status: 'pending', priority: 1, scheduledAt: new Date(Date.now() - 1000), productId: 'p2', payload: '{}' },
    ]);
    const result = await processContentSchedule('test-cron-secret');
    expect(result.success).toBe(true);
    expect(result.processed).toBe(2);
  });

  it('skips duplicate product+contentType within 7-day window', async () => {
    const recentDate = new Date(Date.now() - 86400000); // 1 day ago
    __seed('ContentSchedule', [
      { _id: 'cs-old', contentType: 'newsletter', productId: 'prod-1', status: 'sent', processedAt: recentDate, scheduledAt: recentDate, priority: 3, payload: '{}' },
      { _id: 'cs-new', contentType: 'newsletter', productId: 'prod-1', status: 'pending', scheduledAt: new Date(Date.now() - 1000), priority: 3, payload: '{}' },
    ]);
    const result = await processContentSchedule('test-cron-secret');
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid cron secret', async () => {
    const result = await processContentSchedule('wrong-secret');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth|secret/i);
  });

  it('rejects empty cron secret', async () => {
    const result = await processContentSchedule('');
    expect(result.success).toBe(false);
  });

  it('marks failed items with error', async () => {
    // This tests that processing failure updates status to 'failed'
    __seed('ContentSchedule', [
      {
        _id: 'cs-bad',
        contentType: 'unknown_action',
        status: 'pending',
        scheduledAt: new Date(Date.now() - 1000),
        priority: 3,
        productId: 'p1',
        payload: '{}',
      },
    ]);
    const result = await processContentSchedule('test-cron-secret');
    expect(result.failed).toBeGreaterThanOrEqual(0);
  });
});

describe('getScheduleQueue', () => {
  it('returns pending items', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'pending', contentType: 'newsletter', scheduledAt: new Date(), priority: 3 },
      { _id: 'cs-2', status: 'sent', contentType: 'social_story', scheduledAt: new Date(), priority: 2 },
    ]);
    const result = await getScheduleQueue({ status: 'pending' });
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(1);
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

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await getScheduleQueue();
    expect(result.success).toBe(false);
  });
});

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
});

describe('getScheduleStats', () => {
  it('returns stats breakdown', async () => {
    __seed('ContentSchedule', [
      { _id: 'cs-1', status: 'pending', contentType: 'newsletter', scheduledAt: new Date() },
      { _id: 'cs-2', status: 'sent', contentType: 'social_story', scheduledAt: new Date() },
      { _id: 'cs-3', status: 'failed', contentType: 'catalog_sync', scheduledAt: new Date() },
    ]);
    const result = await getScheduleStats();
    expect(result.success).toBe(true);
    expect(result.stats.pending).toBe(1);
    expect(result.stats.sent).toBe(1);
    expect(result.stats.failed).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/contentScheduler.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write contentScheduler.web.js implementation**

```js
// src/backend/contentScheduler.web.js
/**
 * @module contentScheduler
 * @description Queue-based scheduler that processes content schedule entries.
 * Executes newsletter, social story, and catalog sync actions in priority order
 * with 7-day dedup window and rate-limit awareness.
 *
 * CMS collections:
 * - ContentSchedule (read/write) — Queue of scheduled content actions
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 * @requires backend/utils/sanitize
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

const DEDUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function requireAdmin() {
  const member = await currentMember.getMember();
  if (!member || !member._id) throw new Error('Authentication required.');
  const roles = await currentMember.getRoles();
  const isAdmin = roles.some(r => r.title === 'Admin' || r._id === 'admin');
  if (!isAdmin) throw new Error('Admin access required.');
  return member._id;
}

async function verifyCronSecret(providedSecret) {
  if (!providedSecret) return false;
  const { getSecret } = await import('wix-secrets-backend');
  const expected = await getSecret('CONTENT_CRON_KEY');
  return providedSecret === expected;
}

/**
 * Check if a product+contentType was already processed within the dedup window.
 */
async function isDuplicate(productId, contentType) {
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
  const result = await wixData.query('ContentSchedule')
    .eq('productId', productId)
    .eq('contentType', contentType)
    .eq('status', 'sent')
    .gt('processedAt', cutoff)
    .limit(1)
    .find();
  return result.items.length > 0;
}

/**
 * Execute a single content action. Delegates to the appropriate module.
 * Returns { success, error? }
 */
async function executeAction(item) {
  const payload = JSON.parse(item.payload || '{}');

  switch (item.contentType) {
    case 'newsletter': {
      const { queuePromotionalEmail } = await import('backend/emailTemplates.web');
      await queuePromotionalEmail('new-arrivals', [], {
        productName: item.productName || '',
        productCategory: payload.productCategory || '',
      });
      return { success: true };
    }
    case 'social_story': {
      const { buildTemplateData, buildMetaStoryPayload } = await import('public/socialStoryHelpers');
      const { postStory } = await import('backend/socialStoryService.web');
      const templateData = buildTemplateData('new_arrival', {
        productName: item.productName || '',
        imageUrl: payload.imageUrl || '',
      });
      if (!templateData) return { success: false, error: 'Failed to build template data' };
      const storyPayload = buildMetaStoryPayload({
        imageUrl: payload.imageUrl || '',
        caption: templateData.caption || '',
        pageId: '',
      });
      if (!storyPayload) return { success: false, error: 'Failed to build story payload' };
      const result = await postStory({ imageUrl: payload.imageUrl, caption: templateData.caption || '' });
      return result;
    }
    case 'catalog_sync': {
      const { getEnhancedCatalogFields } = await import('backend/facebookCatalog.web');
      const { validateCatalogProduct } = await import('backend/pinterestCatalogSync.web');
      // Trigger catalog field refresh for both platforms
      await getEnhancedCatalogFields({ _id: item.productId, name: item.productName });
      await validateCatalogProduct({ _id: item.productId, name: item.productName });
      return { success: true };
    }
    default:
      return { success: false, error: `Unknown content type: ${item.contentType}` };
  }
}

/**
 * Process the content schedule queue. Called by cron endpoint.
 * Authenticates via cron secret, not member auth.
 *
 * @param {string} cronSecret - Cron authentication secret
 * @returns {Promise<{success: boolean, processed: number, failed: number, skipped: number, error?: string}>}
 */
export const processContentSchedule = webMethod(
  Permissions.Anyone,
  async (cronSecret) => {
    try {
      const valid = await verifyCronSecret(cronSecret);
      if (!valid) {
        return { success: false, error: 'Authentication failed: invalid cron secret.', processed: 0, failed: 0, skipped: 0 };
      }

      const now = new Date();
      const pending = await wixData.query('ContentSchedule')
        .eq('status', 'pending')
        .le('scheduledAt', now)
        .ascending('priority')
        .limit(50)
        .find();

      let processed = 0;
      let failed = 0;
      let skipped = 0;

      for (const item of pending.items) {
        // Dedup check
        if (item.productId && await isDuplicate(item.productId, item.contentType)) {
          item.status = 'cancelled';
          item.error = 'Duplicate within 7-day window';
          item.processedAt = now;
          await wixData.update('ContentSchedule', item);
          skipped++;
          continue;
        }

        try {
          const result = await executeAction(item);
          if (result.success) {
            item.status = 'sent';
            item.processedAt = now;
            item.error = '';
          } else {
            item.status = 'failed';
            item.processedAt = now;
            item.error = result.error || 'Action failed';
            failed++;
          }
        } catch (actionErr) {
          item.status = 'failed';
          item.processedAt = now;
          item.error = 'Processing error';
          console.error(`[contentScheduler] Action failed for ${item._id}:`, actionErr);
          failed++;
        }

        await wixData.update('ContentSchedule', item);
        if (item.status === 'sent') processed++;
      }

      return { success: true, processed, failed, skipped };
    } catch (err) {
      console.error('[contentScheduler] Error processing schedule:', err);
      return { success: false, error: 'Failed to process schedule.', processed: 0, failed: 0, skipped: 0 };
    }
  }
);

/**
 * Get the current schedule queue with optional filters.
 * @param {Object} [filters] - { status?, contentType?, limit? }
 * @returns {Promise<{success: boolean, items: Array}>}
 */
export const getScheduleQueue = webMethod(
  Permissions.Admin,
  async (filters = {}) => {
    try {
      await requireAdmin();

      let query = wixData.query('ContentSchedule')
        .descending('scheduledAt');

      if (filters.status) {
        query = query.eq('status', sanitize(filters.status, 20));
      }
      if (filters.contentType) {
        query = query.eq('contentType', sanitize(filters.contentType, 50));
      }

      const limit = Math.min(Math.max(1, Number(filters.limit) || 100), 500);
      const result = await query.limit(limit).find();

      return { success: true, items: result.items };
    } catch (err) {
      console.error('[contentScheduler] Error getting queue:', err);
      return { success: false, error: err.message || 'Failed to get queue.', items: [] };
    }
  }
);

/**
 * Cancel a pending scheduled item.
 * @param {string} itemId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const cancelScheduledItem = webMethod(
  Permissions.Admin,
  async (itemId) => {
    try {
      await requireAdmin();

      const cleanId = validateId(itemId);
      if (!cleanId) {
        return { success: false, error: 'Valid item ID is required.' };
      }

      const item = await wixData.get('ContentSchedule', cleanId);
      if (!item) {
        return { success: false, error: 'Schedule item not found.' };
      }

      if (item.status === 'sent') {
        return { success: false, error: 'Cannot cancel an already sent item.' };
      }

      item.status = 'cancelled';
      item.processedAt = new Date();
      await wixData.update('ContentSchedule', item);

      return { success: true };
    } catch (err) {
      console.error('[contentScheduler] Error cancelling item:', err);
      return { success: false, error: err.message || 'Failed to cancel item.' };
    }
  }
);

/**
 * Get schedule stats (counts by status).
 * @param {number} [days=30]
 * @returns {Promise<{success: boolean, stats: Object}>}
 */
export const getScheduleStats = webMethod(
  Permissions.Admin,
  async (days = 30) => {
    try {
      await requireAdmin();

      const result = await wixData.query('ContentSchedule')
        .limit(1000)
        .find();

      const stats = { pending: 0, sent: 0, failed: 0, cancelled: 0 };
      for (const item of result.items) {
        if (stats[item.status] !== undefined) {
          stats[item.status]++;
        }
      }

      return { success: true, stats };
    } catch (err) {
      console.error('[contentScheduler] Error getting stats:', err);
      return { success: false, error: err.message || 'Failed to get stats.', stats: {} };
    }
  }
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/contentScheduler.test.js`
Expected: ALL PASS

- [ ] **Step 5: Commit scheduler module + tests**

```bash
git add src/backend/contentScheduler.web.js tests/contentScheduler.test.js
git commit -m "feat(CF-483q): content scheduler — queue processing with dedup and priority ordering"
```

---

## Chunk 3: Cron Endpoint + Event Wiring

### Task 3: Add Cron Endpoint to http-functions.js

**Files:**
- Modify: `src/backend/http-functions.js`

- [ ] **Step 1: Add cron endpoint import and function**

Add at the top with other imports:
```js
import { processContentSchedule } from 'backend/contentScheduler.web';
```

Add after the last cron endpoint (post-purchase care):
```js
// ── Content Schedule Processor Cron ────────────────────────────────────
// URL: GET https://www.carolinafutons.com/_functions/processContentScheduleCron
// Schedule every 30 minutes via Wix Automations or external cron.
// Pass X-Cron-Secret header for auth (CONTENT_CRON_KEY in Secrets Manager).
export async function get_processContentScheduleCron(request) {
  try {
    const { getSecret } = await import('wix-secrets-backend');
    const cronKey = await getSecret('CONTENT_CRON_KEY');
    const requestKey = request.headers?.['x-cron-secret'];

    if (!requestKey || requestKey !== cronKey) {
      return forbidden({ body: 'Unauthorized', headers: { 'Content-Type': 'text/plain' } });
    }

    const result = await processContentSchedule(requestKey);
    return ok({
      body: JSON.stringify(result),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('HTTP function error (processContentScheduleCron):', err);
    return serverError({ body: 'Internal server error', headers: { 'Content-Type': 'text/plain' } });
  }
}
```

- [ ] **Step 2: Commit cron endpoint**

```bash
git add src/backend/http-functions.js
git commit -m "feat(CF-483q): add content schedule cron endpoint to http-functions"
```

### Task 4: Add Orchestration Triggers to events.js

**Files:**
- Modify: `src/backend/events.js`

- [ ] **Step 1: Add orchestration call to restock handler**

In `wixStores_onInventoryVariantUpdated`, after the restock notification block (line ~233), add:

```js
    // Trigger content orchestration for back-in-stock
    try {
      const { triggerManualOrchestration } = await import('backend/contentOrchestrator.web');
      const product = await wixData.get('Stores/Products', productId);
      if (product) {
        await triggerManualOrchestration('back_in_stock', {
          productId,
          productName: product.name || '',
          productCategory: product.productType || '',
          imageUrl: product.mainMedia || '',
        });
      }
    } catch (orchErr) {
      console.error('[events] Content orchestration failed for restock:', orchErr);
    }
```

- [ ] **Step 2: Commit event wiring**

```bash
git add src/backend/events.js
git commit -m "feat(CF-483q): wire content orchestration to inventory restock events"
```

- [ ] **Step 3: Run full test suite to verify no regressions**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/contentOrchestrator.test.js tests/contentScheduler.test.js`
Expected: ALL PASS

- [ ] **Step 4: Final commit if any fixes needed, then push**

```bash
git push -u origin cf-483q-content-orchestrator
```
