/**
 * @module priceAlertService
 * @description Price drop alert subscription service.
 * Allows anonymous visitors to subscribe or unsubscribe to price-drop
 * notifications for a specific product by email. Stores subscriptions in the
 * PriceAlerts CMS collection with deduplication on (productId, email).
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create `PriceAlerts` CMS collection with fields:
 *   productId              (text)
 *   email                  (text)
 *   subscribedAt           (dateTime)
 *   active                 (boolean)
 *   subscriberDeviceToken  (text, optional, indexed) — mobile push token (FCM/APNs); null for web-only subscribers
 * Set collection permissions to Anyone for read + write (webMethod handles authz).
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

const COLLECTION = 'PriceAlerts';

/**
 * Subscribe an email address to price-drop alerts for a product.
 * Deduplicates: reactivates an existing inactive subscription instead of
 * creating a duplicate. Rejects if already actively subscribed.
 *
 * @param {string}      productId
 * @param {string}      email
 * @param {string|null} [deviceToken]  Optional mobile push token (FCM/APNs). Stored
 *                                     as subscriberDeviceToken; null for web-only subscribers.
 * @returns {Promise<{success: boolean, reason?: string, error?: string}>}
 */
export const subscribe = webMethod(
  Permissions.Anyone,
  async (productId, email, deviceToken) => {
    try {
      const cleanProductId = sanitize(productId, 50);
      if (!cleanProductId) return { success: false, error: 'invalid_product_id' };

      if (!email || typeof email !== 'string') return { success: false, error: 'invalid_email' };
      const normalizedEmail = email.trim().toLowerCase();
      if (!validateEmail(normalizedEmail)) return { success: false, error: 'invalid_email' };

      const cleanDeviceToken =
        deviceToken && typeof deviceToken === 'string'
          ? deviceToken.trim().slice(0, 500) || null
          : null;

      // Check for existing subscription (dedup on productId+email)
      const existing = await wixData.query(COLLECTION)
        .eq('productId', cleanProductId)
        .eq('email', normalizedEmail)
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];

        if (record.active) {
          return { success: false, reason: 'already_subscribed' };
        }

        // Reactivate inactive subscription; update device token in case device changed
        await wixData.update(COLLECTION, {
          ...record,
          active: true,
          subscribedAt: new Date(),
          subscriberDeviceToken: cleanDeviceToken,
        });
        return { success: true };
      }

      // New subscription
      await wixData.insert(COLLECTION, {
        productId: cleanProductId,
        email: normalizedEmail,
        subscribedAt: new Date(),
        active: true,
        subscriberDeviceToken: cleanDeviceToken,
      });

      return { success: true };
    } catch (err) {
      console.error('[priceAlertService] subscribe error:', err);
      return { success: false, error: 'internal_error' };
    }
  }
);

/**
 * Unsubscribe an email address from price-drop alerts for a product.
 *
 * @param {string} productId
 * @param {string} email
 * @returns {Promise<{success: boolean, reason?: string, error?: string}>}
 */
export const unsubscribe = webMethod(
  Permissions.Anyone,
  async (productId, email) => {
    try {
      const cleanProductId = sanitize(productId, 50);
      if (!cleanProductId) return { success: false, error: 'invalid_product_id' };

      if (!email || typeof email !== 'string') return { success: false, error: 'invalid_email' };
      const normalizedEmail = email.trim().toLowerCase();
      if (!validateEmail(normalizedEmail)) return { success: false, error: 'invalid_email' };

      const existing = await wixData.query(COLLECTION)
        .eq('productId', cleanProductId)
        .eq('email', normalizedEmail)
        .find();

      if (existing.items.length === 0) {
        return { success: false, reason: 'not_found' };
      }

      const record = existing.items[0];
      if (!record.active) {
        return { success: false, reason: 'already_unsubscribed' };
      }

      await wixData.update(COLLECTION, { ...record, active: false });
      return { success: true };
    } catch (err) {
      console.error('[priceAlertService] unsubscribe error:', err);
      return { success: false, error: 'internal_error' };
    }
  }
);

/**
 * Get all active subscribers for a product.
 *
 * @param {string} productId
 * @returns {Promise<{success: boolean, subscribers?: Array<{email: string, productId: string, subscribedAt: Date, subscriberDeviceToken: string|null}>, count?: number, error?: string}>}
 */
export const getSubscribers = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const cleanProductId = sanitize(productId, 50);
      if (!cleanProductId) return { success: false, error: 'invalid_product_id' };

      const result = await wixData.query(COLLECTION)
        .eq('productId', cleanProductId)
        .eq('active', true)
        .find();

      const subscribers = result.items.map(i => ({
        email: i.email,
        memberId: i.memberId ?? null,
        productId: i.productId,
        subscribedAt: i.subscribedAt,
        subscriberDeviceToken: i.subscriberDeviceToken ?? null,
      }));

      return { success: true, subscribers, count: subscribers.length };
    } catch (err) {
      console.error('[priceAlertService] getSubscribers error:', err);
      return { success: false, error: 'internal_error' };
    }
  }
);
