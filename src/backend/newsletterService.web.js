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

      return { success: true, discountCode: DISCOUNT_CODE };
    } catch (err) {
      console.error('Newsletter subscription error:', err);
      return { success: false, message: 'Subscription failed. Please try again.' };
    }
  }
);
