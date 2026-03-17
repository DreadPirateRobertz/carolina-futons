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
  email: 'enableEmail', // used by updateOrchestrationConfig, not by EVENT_ACTIONS loop
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

function getPlatformForAction(action) {
  switch (action) {
    case 'newsletter': return 'email';
    case 'social_story': return 'instagram';
    case 'catalog_sync': return 'facebook';
    default: return 'email';
  }
}

// ── WebMethods ──────────────────────────────────────────────────────

/**
 * Trigger content orchestration for a catalog event.
 * Creates schedule entries in ContentSchedule CMS queue.
 *
 * @param {string} eventType - 'new_arrival'|'price_drop'|'back_in_stock'|'seasonal'
 * @param {Object} productData - { productId, productName, productCategory, imageUrl?, oldPrice?, newPrice? }
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

      // Idempotency: check for existing entries with same eventId
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
 * Event-triggered orchestration — called by Wix event handlers (no admin auth).
 * Uses the same scheduling logic as triggerManualOrchestration but authenticates
 * via system context (event handlers run server-side without user session).
 *
 * @param {string} eventType - 'new_arrival'|'price_drop'|'back_in_stock'|'seasonal'
 * @param {Object} productData - { productId, productName, productCategory, imageUrl?, oldPrice?, newPrice? }
 * @returns {Promise<{success: boolean, scheduled: Array, skipped?: number, error?: string}>}
 */
export const triggerEventOrchestration = webMethod(
  Permissions.Anyone,
  async (eventType, productData) => {
    try {
      const cleanType = sanitize(eventType, 50);
      if (!VALID_EVENT_TYPES.includes(cleanType)) {
        return { success: false, error: 'Invalid event type.', scheduled: [] };
      }

      const productId = validateId(productData?.productId);
      if (!productId) {
        return { success: false, error: 'Valid product ID is required.', scheduled: [] };
      }

      const config = await getConfig();
      const actions = EVENT_ACTIONS[cleanType] || [];
      const eventId = buildEventId(cleanType, productId);

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

        await wixData.insert('ContentSchedule', entry);
        scheduled.push({ contentType: action, platform: entry.platform, eventId });
      }

      return { success: true, scheduled, skipped };
    } catch (err) {
      console.error('[contentOrchestrator] Error in triggerEventOrchestration:', err);
      return { success: false, error: err.message || 'Event orchestration failed.', scheduled: [] };
    }
  }
);

/**
 * Dry-run preview — shows what actions would be scheduled without writing to CMS.
 * @param {string} eventType
 * @param {Object} productData
 * @returns {Promise<{success: boolean, planned: Array, wouldSkip: number, error?: string}>}
 */
export const previewOrchestration = webMethod(
  Permissions.Admin,
  async (eventType, productData) => {
    try {
      await requireAdmin();

      const cleanType = sanitize(eventType, 50);
      if (!VALID_EVENT_TYPES.includes(cleanType)) {
        return { success: false, error: 'Invalid event type.', planned: [] };
      }

      const productId = validateId(productData?.productId);
      if (!productId) {
        return { success: false, error: 'Valid product ID is required.', planned: [] };
      }

      const config = await getConfig();
      const actions = EVENT_ACTIONS[cleanType] || [];
      const eventId = buildEventId(cleanType, productId);

      const existing = await wixData.query('ContentSchedule')
        .eq('createdBy', eventId)
        .find();
      const existingTypes = new Set(existing.items.map(i => i.contentType));

      const planned = [];
      let wouldSkip = 0;

      for (const action of actions) {
        const configKey = CONFIG_KEY_MAP[action];
        const disabled = configKey && config[configKey] === false;
        const duplicate = existingTypes.has(action);

        if (disabled || duplicate) {
          wouldSkip++;
          continue;
        }

        planned.push({
          contentType: action,
          platform: getPlatformForAction(action),
          priority: ACTION_PRIORITY[cleanType] ?? 3,
          eventId,
          reason: `${cleanType} → ${action}`,
        });
      }

      return { success: true, planned, wouldSkip };
    } catch (err) {
      console.error('[contentOrchestrator] Error in previewOrchestration:', err);
      return { success: false, error: err.message || 'Preview failed.', planned: [] };
    }
  }
);

/**
 * Admin dashboard endpoint — returns pending schedule, config, and stats in one call.
 * @returns {Promise<{success: boolean, pending: Array, config: Object, stats: Object, error?: string}>}
 */
export const getOrchestrationDashboard = webMethod(
  Permissions.Admin,
  async () => {
    try {
      await requireAdmin();

      const [configResult, pendingResult, statsResult] = await Promise.all([
        getConfig(),
        wixData.query('ContentSchedule')
          .eq('status', 'pending')
          .ascending('priority')
          .limit(100)
          .find(),
        wixData.query('ContentSchedule')
          .gt('scheduledAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
          .limit(1000)
          .find(),
      ]);

      const stats = { pending: 0, sent: 0, failed: 0, cancelled: 0 };
      for (const item of statsResult.items) {
        if (stats[item.status] !== undefined) {
          stats[item.status]++;
        }
      }

      return {
        success: true,
        pending: pendingResult.items,
        config: configResult,
        stats,
      };
    } catch (err) {
      console.error('[contentOrchestrator] Error getting dashboard:', err);
      return { success: false, error: err.message || 'Dashboard failed.', pending: [], config: {}, stats: {} };
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
