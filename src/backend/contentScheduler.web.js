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
 * @requires wix-secrets-backend
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
      const result = await postStory(storyPayload);
      return result;
    }
    case 'catalog_sync': {
      const { getEnhancedCatalogFields } = await import('backend/facebookCatalog.web');
      const { validateCatalogProduct } = await import('backend/pinterestCatalogSync.web');
      await getEnhancedCatalogFields({ _id: item.productId, name: item.productName });
      await validateCatalogProduct({ _id: item.productId, name: item.productName });
      return { success: true };
    }
    default:
      return { success: false, error: `Unknown content type: ${item.contentType}` };
  }
}

// ── WebMethods ──────────────────────────────────────────────────────

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
        // Dedup check: skip if same product+contentType sent within 7 days
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
            item.error = '';
          } else {
            item.status = 'failed';
            item.error = result.error || 'Action failed';
          }
        } catch (actionErr) {
          item.status = 'failed';
          item.error = 'Processing error';
          console.error(`[contentScheduler] Action failed for ${item._id}:`, actionErr);
        }

        item.processedAt = now;
        await wixData.update('ContentSchedule', item);
        if (item.status === 'sent') processed++;
        else if (item.status === 'failed') failed++;
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

      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await wixData.query('ContentSchedule')
        .gt('scheduledAt', cutoff)
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
