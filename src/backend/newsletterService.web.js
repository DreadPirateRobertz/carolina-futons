/**
 * @module newsletterService
 * @description Backend web module for newsletter subscription, welcome discount,
 * and Klaviyo ESP integration. Persists subscriber to NewsletterSubscribers
 * collection, deduplicates by email, auto-enrolls in Bronze loyalty tier,
 * and syncs to Klaviyo for welcome sequence and email campaigns.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * 1. Create the `NewsletterSubscribers` CMS collection with fields:
 *    email (Text), source (Text), subscribedAt (Date), loyaltyTier (Text),
 *    status (Text), unsubscribedAt (Date)
 * 2. Add secrets in Wix Secrets Manager:
 *    - ESP_API_KEY: Klaviyo private API key (pk_...)
 *    - ESP_LIST_ID: Klaviyo list ID to subscribe profiles to
 *    - KLAVIYO_WEBHOOK_SECRET: shared secret for webhook auth
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

const DISCOUNT_CODE = 'WELCOME10';
const KLAVIYO_API_BASE = 'https://a.klaviyo.com/api';
const KLAVIYO_API_REVISION = '2024-10-15';

/**
 * Load ESP secrets. Returns { espKey, listId } or nulls.
 * @returns {Promise<{espKey: string|null, listId: string|null}>}
 */
async function loadESPSecrets() {
  let espKey = null;
  let listId = null;
  try {
    const { getSecret } = await import('wix-secrets-backend');
    espKey = await getSecret('ESP_API_KEY');
    try { listId = await getSecret('ESP_LIST_ID'); } catch (_) { /* optional */ }
  } catch (_) {
    // Secrets not configured
  }
  return { espKey, listId };
}

/**
 * Create or update a profile in Klaviyo and subscribe to the configured list.
 * Returns immediately with `{ synced: false, reason: 'no_esp_configured' }` when
 * no ESP API key is set.
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

      const cleanEmail = email.trim().toLowerCase();
      const cleanSource = sanitize((source || ''), 50);

      const { espKey, listId } = await loadESPSecrets();
      if (!espKey) {
        return { synced: false, reason: 'no_esp_configured' };
      }

      const { fetch } = await import('wix-fetch');

      // Step 1: Create or update profile via Klaviyo Profiles API
      const profileRes = await fetch(`${KLAVIYO_API_BASE}/profiles/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${espKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'revision': KLAVIYO_API_REVISION,
        },
        body: JSON.stringify({
          data: {
            type: 'profile',
            attributes: {
              email: cleanEmail,
              properties: {
                source: cleanSource,
                subscribed_via: 'carolina_futons_website',
              },
            },
          },
        }),
      });

      if (!profileRes.ok) {
        if (profileRes.status === 429) {
          return { synced: false, reason: 'esp_rate_limited' };
        }
        return { synced: false, reason: 'esp_api_error' };
      }

      // Step 2: Subscribe profile to the list (triggers welcome flow)
      if (listId) {
        const subscribeRes = await fetch(`${KLAVIYO_API_BASE}/lists/${listId}/relationships/profiles/`, {
          method: 'POST',
          headers: {
            'Authorization': `Klaviyo-API-Key ${espKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'revision': KLAVIYO_API_REVISION,
          },
          body: JSON.stringify({
            data: [{
              type: 'profile',
              id: (await profileRes.json()).data.id,
            }],
          }),
        });

        if (!subscribeRes.ok && subscribeRes.status === 429) {
          return { synced: false, reason: 'esp_rate_limited' };
        }
      }

      return { synced: true };
    } catch (err) {
      console.error('ESP sync error:', err);
      return { synced: false, reason: 'sync_failed' };
    }
  }
);

/**
 * Unsubscribe an email from the ESP and update the CMS record.
 *
 * @function unsubscribeFromESP
 * @param {string} email - Email address to unsubscribe.
 * @returns {Promise<{unsubscribed: boolean, reason?: string}>}
 * @permission SiteMember
 */
export const unsubscribeFromESP = webMethod(
  Permissions.SiteMember,
  async (email) => {
    try {
      if (!email || typeof email !== 'string' || !validateEmail(email.trim())) {
        return { unsubscribed: false, reason: 'invalid_email' };
      }

      const cleanEmail = email.trim().toLowerCase();

      const { espKey, listId } = await loadESPSecrets();
      if (!espKey) {
        return { unsubscribed: false, reason: 'no_esp_configured' };
      }

      const { fetch } = await import('wix-fetch');

      // Suppress profile in Klaviyo (unsubscribe from all email)
      const suppressRes = await fetch(`${KLAVIYO_API_BASE}/profiles/suppression/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${espKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'revision': KLAVIYO_API_REVISION,
        },
        body: JSON.stringify({
          data: {
            type: 'profile-suppression-bulk-create-job',
            attributes: {
              profiles: {
                data: [{ type: 'profile', attributes: { email: cleanEmail } }],
              },
            },
          },
        }),
      });

      if (!suppressRes.ok) {
        return { unsubscribed: false, reason: 'esp_api_error' };
      }

      // Update CMS record
      const existing = await wixData.query('NewsletterSubscribers')
        .eq('email', cleanEmail)
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];
        await wixData.update('NewsletterSubscribers', {
          ...record,
          status: 'unsubscribed',
          unsubscribedAt: new Date(),
        });
      }

      return { unsubscribed: true };
    } catch (err) {
      console.error('ESP unsubscribe error:', err);
      return { unsubscribed: false, reason: 'unsubscribe_failed' };
    }
  }
);

/**
 * Check whether an ESP provider is configured.
 *
 * @function getESPStatus
 * @returns {Promise<{configured: boolean, provider?: string}>}
 * @permission Admin
 */
export const getESPStatus = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const { espKey } = await loadESPSecrets();
      if (!espKey) {
        return { configured: false };
      }
      return { configured: true, provider: 'klaviyo' };
    } catch (_) {
      return { configured: false };
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
