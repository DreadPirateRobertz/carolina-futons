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
import { currentMember } from 'wix-members-backend';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';
import { _resolveContactIdInternal } from 'backend/contacts/contactResolver.web';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logError } from 'backend/utils/errorHandler';

const DISCOUNT_CODE = 'WELCOME10';
const KLAVIYO_API_BASE = 'https://a.klaviyo.com/api';
const KLAVIYO_API_REVISION = '2024-10-15';

// ── Rate limiting ──────────────────────────────────────────────────
// Keyed by normalized email (Wix webMethods do not expose caller IP).
// CMS collection `NewsletterRateLimit`: key (Text), count (Number), windowStart (DateTime).

export const RATE_LIMIT_MAX = 3;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check and record a rate-limit attempt for a given key.
 *
 * cf-c0np (cf-3ldu F4): migrated from local re-implementation to the
 * canonical wixData-backed helper. The previous local impl stored
 * plaintext lowercased emails as bucket keys (cf-sec1 CMEK gap) and
 * failed-open on DB error (cf-8p52 flipped the canonical helper to
 * fail-closed). Both gaps close by deferring to the canonical.
 *
 * @param {string} key - Normalized identifier (email).
 * @param {Object} [opts]
 * @param {number} [opts.now] - Timestamp override for testing.
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
export async function _checkRateLimit(key, opts = {}) {
  return checkRateLimit('NewsletterRateLimit', key, {
    now: opts && opts.now,
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
}

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
 * Internal ESP sync logic — not wrapped in webMethod permissions.
 * Called directly by subscribeToNewsletter (Anyone context) and
 * by the syncToESP webMethod (SiteMember context).
 *
 * @param {string} email - Subscriber email.
 * @param {string} source - Capture source (e.g. 'exit_intent_popup', 'footer').
 * @returns {Promise<{synced: boolean, reason?: string}>}
 */
async function _syncToESPInternal(email, source) {
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
    logError('[newsletterService] ESP sync', err);
    return { synced: false, reason: 'sync_failed' };
  }
}

/**
 * Create or update a profile in Klaviyo and subscribe to the configured list.
 * Delegates to _syncToESPInternal.
 *
 * @function syncToESP
 * @param {string} email - Subscriber email.
 * @param {string} source - Capture source (e.g. 'exit_intent_popup', 'footer').
 * @returns {Promise<{synced: boolean, reason?: string}>}
 * @permission SiteMember — exposed endpoint for admin/member use.
 */
export const syncToESP = webMethod(
  Permissions.SiteMember,
  async (email, source) => {
    if (!email || typeof email !== 'string' || !validateEmail(email.trim())) {
      return { synced: false, reason: 'invalid_email' };
    }
    const cleanEmail = email.trim().toLowerCase();
    const member = await currentMember.getMember();
    if (!member?.loginEmail || member.loginEmail.toLowerCase() !== cleanEmail) {
      return { synced: false, reason: 'unauthorized' };
    }
    return _syncToESPInternal(cleanEmail, source);
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

      const member = await currentMember.getMember();
      if (!member?.loginEmail || member.loginEmail.toLowerCase() !== cleanEmail) {
        return { unsubscribed: false, reason: 'unauthorized' };
      }

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
      logError('[newsletterService] ESP unsubscribe', err);
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

      // Honeypot — bots fill hidden fields; humans leave them empty
      if (options && options.honeypot) {
        return { success: true, discountCode: DISCOUNT_CODE };
      }

      const cleaned = sanitize(email, 254).toLowerCase().trim();
      if (!validateEmail(cleaned)) {
        return { success: false, message: 'Invalid email format' };
      }

      // Deduplicate — silent success for existing subscribers (checked before rate limit
      // so repeat submissions from known subscribers don't consume rate limit quota)
      const existing = await wixData.query('NewsletterSubscribers')
        .eq('email', cleaned)
        .find();

      if (existing.items.length > 0) {
        return { success: true, discountCode: DISCOUNT_CODE };
      }

      // Rate limit: max 3 submissions per email per hour
      // NOTE: do NOT forward `options` here — callers can inject { now: 0 } to bypass (CF-xz8y)
      const rateCheck = await _checkRateLimit(cleaned);
      if (!rateCheck.allowed) {
        return { success: false, message: 'Too many requests. Please try again later.' };
      }

      const source = sanitize((options && options.source) || 'exit_intent_popup', 50);

      await wixData.insert('NewsletterSubscribers', {
        email: cleaned,
        source,
        subscribedAt: new Date(),
        loyaltyTier: 'Bronze',
      });

      // Non-blocking ESP sync — uses internal function to bypass
      // webMethod permission layer (subscribeToNewsletter is Anyone,
      // but syncToESP webMethod requires SiteMember)
      _syncToESPInternal(cleaned, source).catch(() => {});

      // cf-3l0d Option B (post-cf-xdji): auto-trigger the welcome series so
      // every caller of subscribeToNewsletter gets the welcome flow. The
      // trigger resolves a CRM contact via cf-xdji's resolveContactId and
      // delegates to triggerWelcomeSequence (whose dedup guard prevents
      // double-queue on repeat subscribes). Non-blocking — a welcome-trigger
      // failure does not fail the subscribe call.
      _triggerWelcomeFlowInternal(cleaned, source).catch((err) => {
        console.warn('[newsletterService] welcome auto-trigger failed (non-blocking):', err?.message ?? err);
      });

      logAuditEvent('NewsletterSubscribers', 'subscribe', cleaned, { source });
      return { success: true, discountCode: DISCOUNT_CODE };
    } catch (err) {
      logError('[newsletterService] subscribe', err);
      return { success: false, message: 'Subscription failed. Please try again.' };
    }
  }
);

// Welcome sequence steps matching emailAutomation.web.js SEQUENCES.welcome
const WELCOME_STEPS = [
  { step: 1, templateId: 'welcome_series_1', delayHours: 0 },
  { step: 2, templateId: 'welcome_series_2', delayHours: 72 },
  { step: 3, templateId: 'welcome_series_3', delayHours: 168 },
];

/**
 * Internal welcome-flow trigger called by subscribeToNewsletter (cf-3l0d).
 * Resolves a Wix CRM contactId for the email, then delegates to the
 * existing triggerWelcomeSequence in emailAutomation. Wrapped in a
 * try/catch + dynamic imports so a missing helper file (during the brief
 * window between this branch landing and cf-xdji shipping resolveContactId)
 * does not break the subscribe flow.
 *
 * @param {string} email - Already-validated lowercase email
 * @param {string} [source=''] - Capture source label for logging
 * @returns {Promise<void>}
 */
async function _triggerWelcomeFlowInternal(email, source = '') {
  try {
    const { resolveContactId } = await import('backend/contacts/contactResolver.web');
    const contactId = await resolveContactId(email, '');
    if (!contactId) {
      console.warn('[newsletterService] welcome auto-trigger skipped — resolveContactId returned empty', { email, source });
      return;
    }
    const { triggerWelcomeSequence } = await import('backend/emailAutomation.web');
    // triggerWelcomeSequence has its own dedup (queries EmailQueue for an
    // existing welcome step 1 row keyed on recipientEmail) so repeat
    // subscribe calls don't double-queue.
    await triggerWelcomeSequence(contactId, email, '');
  } catch (err) {
    // Re-throw so the caller's .catch logs with context. We deliberately
    // do not swallow here — silent-failure-hunter would (rightly) flag it.
    throw err;
  }
}

// cf-ykmj / cf-4x7e: captureExitIntentEmail SUPERSEDED.
// Removed 2026-05-15. The exit-intent path now flows entirely through
// subscribeToNewsletter() — which auto-queues the welcome series via
// triggerWelcomeSequence() — per src/public/exitIntentCapture.js
// submitExitCapture() (cf-3l0d Option B). The previously-broken
// captureExitIntentEmail entrypoint (F1: empty contactId) was already
// dead at runtime; this commit removes the orphan code + JSDoc.
