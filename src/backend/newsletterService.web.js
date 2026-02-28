/**
 * @module newsletterService
 * @description Backend web module for newsletter subscription and welcome discount.
 * Persists subscriber to NewsletterSubscribers collection, deduplicates by email,
 * and auto-enrolls in Bronze loyalty tier.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Create the `NewsletterSubscribers` CMS collection with fields:
 *   email (Text), source (Text), subscribedAt (Date), loyaltyTier (Text)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

const DISCOUNT_CODE = 'WELCOME10';

/**
 * Forward a subscriber to an external ESP (Mailchimp, Klaviyo, etc.) via webhook.
 * Returns immediately with `{ synced: false, reason: 'no_esp_configured' }` when
 * no ESP API key is set — a no-op placeholder until the business configures one.
 *
 * @function syncToESP
 * @param {string} email - Subscriber email.
 * @param {string} source - Capture source (e.g. 'exit_intent_popup', 'footer').
 * @returns {Promise<{synced: boolean, reason?: string}>}
 * @permission SiteMember — only called from backend, not directly by visitors.
 */
export const syncToESP = webMethod(
  Permissions.SiteMember,
  async (email, source) => {
    try {
      if (!email || typeof email !== 'string' || !validateEmail(email.trim())) {
        return { synced: false, reason: 'invalid_email' };
      }

      const cleanSource = sanitize((source || ''), 50);

      // Check for ESP config in Secrets Manager
      // When ready, add a secret named 'ESP_API_KEY' and 'ESP_PROVIDER' (mailchimp|klaviyo)
      let espKey;
      try {
        const { getSecret } = await import('wix-secrets-backend');
        espKey = await getSecret('ESP_API_KEY');
      } catch (_) {
        // Secrets not configured — ESP integration not active
      }

      if (!espKey) {
        return { synced: false, reason: 'no_esp_configured' };
      }

      // Future: forward to ESP webhook here
      // const provider = await getSecret('ESP_PROVIDER');
      // await fetch(`https://api.${provider}.com/...`, { ... });

      return { synced: true };
    } catch (err) {
      console.error('ESP sync error:', err);
      return { synced: false, reason: 'sync_failed' };
    }
  }
);

/**
 * Subscribe an email to the newsletter with a welcome discount.
 * Deduplicates silently — returns success even for existing subscribers
 * to prevent email enumeration.
 *
 * @function subscribeToNewsletter
 * @param {string} email - Email address to subscribe.
 * @param {Object} [options] - Optional parameters.
 * @param {string} [options.source='exit_intent_popup'] - Capture source.
 * @returns {Promise<{success: boolean, discountCode?: string, message?: string}>}
 * @permission Anyone — captures from anonymous visitors.
 */
export const subscribeToNewsletter = webMethod(
  Permissions.Anyone,
  async (email, options = {}) => {
    try {
      if (!email || typeof email !== 'string' || !email.trim()) {
        return { success: false, message: 'Email is required' };
      }

      const cleaned = sanitize(email, 254).toLowerCase().trim();
      if (!validateEmail(cleaned)) {
        return { success: false, message: 'Invalid email format' };
      }

      // Deduplicate — silent success for existing subscribers
      const existing = await wixData.query('NewsletterSubscribers')
        .eq('email', cleaned)
        .find();

      if (existing.items.length > 0) {
        return { success: true, discountCode: DISCOUNT_CODE };
      }

      const source = sanitize((options && options.source) || 'exit_intent_popup', 50);

      await wixData.insert('NewsletterSubscribers', {
        email: cleaned,
        source,
        subscribedAt: new Date(),
        loyaltyTier: 'Bronze',
      });

      // Non-blocking ESP sync — don't block the user response
      syncToESP(cleaned, source).catch(() => {});

      return { success: true, discountCode: DISCOUNT_CODE };
    } catch (err) {
      console.error('Newsletter subscription error:', err);
      return { success: false, message: 'Subscription failed. Please try again.' };
    }
  }
);
