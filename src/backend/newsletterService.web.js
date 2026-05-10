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
 * Allows up to RATE_LIMIT_MAX calls per RATE_LIMIT_WINDOW_MS per key.
 * Fails open (allows) if the DB check itself errors, to avoid blocking
 * legitimate users on infrastructure issues.
 *
 * @param {string} key - Normalized identifier (email).
 * @param {Object} [opts]
 * @param {number} [opts.now] - Timestamp override for testing.
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
export async function _checkRateLimit(key, opts = {}) {
  const now = (opts && opts.now != null) ? opts.now : Date.now();
  try {
    const cleanKey = sanitize(key, 254).toLowerCase();

    const existing = await wixData.query('NewsletterRateLimit')
      .eq('key', cleanKey)
      .limit(1)
      .find();

    if (existing.items.length === 0) {
      await wixData.insert('NewsletterRateLimit', {
        key: cleanKey,
        count: 1,
        windowStart: new Date(now),
      });
      return { allowed: true };
    }

    const record = existing.items[0];
    const windowAge = now - new Date(record.windowStart).getTime();

    if (windowAge > RATE_LIMIT_WINDOW_MS) {
      // Window expired — reset counter
      await wixData.update('NewsletterRateLimit', {
        ...record,
        count: 1,
        windowStart: new Date(now),
      });
      return { allowed: true };
    }

    if (record.count >= RATE_LIMIT_MAX) {
      return { allowed: false, reason: 'rate_limited' };
    }

    await wixData.update('NewsletterRateLimit', {
      ...record,
      count: record.count + 1,
    });
    return { allowed: true };
  } catch (err) {
    console.warn('[newsletterService] Rate limit check failed, allowing request:', err.message);
    return { allowed: true }; // Fail open — don't block on DB errors
  }
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
    console.error('ESP sync error:', err);
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
      console.error('Newsletter subscription error:', err);
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

/**
 * Capture an exit-intent email and queue the welcome series into EmailQueue.
 * Deduplicates — skips queueing if the email is already a subscriber.
 *
 * @function captureExitIntentEmail
 * @param {string} email - Visitor email from exit-intent popup
 * @returns {Promise<{success: boolean, discountCode?: string, queued?: number}>}
 * @permission Anyone — captures from anonymous visitors.
 */
export const captureExitIntentEmail = webMethod(
  Permissions.Anyone,
  async (email, options = {}) => {
    try {
      if (!email || typeof email !== 'string' || !email.trim()) {
        return { success: false, message: 'Email is required' };
      }

      // Honeypot — silent success for bots
      if (options && options.honeypot) {
        return { success: true, discountCode: DISCOUNT_CODE, queued: 0 };
      }

      const cleaned = sanitize(email, 254).toLowerCase().trim();
      if (!validateEmail(cleaned)) {
        return { success: false, message: 'Invalid email format' };
      }

      // Dedup against EmailQueue (not NewsletterSubscribers, since subscribeToNewsletter
      // inserts there first in the submitExitCapture flow).
      // Checked before rate limit so repeat submissions from already-queued emails
      // don't consume rate limit quota.
      const alreadyQueued = await wixData.query('EmailQueue')
        .eq('recipientEmail', cleaned)
        .eq('sequenceType', 'welcome')
        .eq('sequenceStep', 1)
        .find();

      if (alreadyQueued.items.length > 0) {
        return { success: true, discountCode: DISCOUNT_CODE, queued: 0 };
      }

      // Rate limit: max 3 submissions per email per hour
      // NOTE: do NOT forward `options` here — callers can inject { now: 0 } to bypass (CF-xz8y)
      const rateCheck = await _checkRateLimit(cleaned);
      if (!rateCheck.allowed) {
        return { success: false, message: 'Too many requests. Please try again later.' };
      }

      // cf-trm0: resolve contactId once before queueing the welcome
      // series. Stage3-velo's exitIntentCapture.js still calls this entry
      // point (cfutons routes through subscribeToNewsletter → resolveContactId
      // post-cf-3l0d, but stage3 hasn't caught up yet). Helper returns null
      // on validation/CRM upstream failure — surface as the same caller-
      // facing failure shape so the popup can retry/show error.
      const exitContactId = await _resolveContactIdInternal(cleaned);
      if (!exitContactId) {
        console.error('[newsletterService] captureExitIntentEmail: resolveContactId returned null for', cleaned);
        return { success: false, message: 'Failed to resolve CRM contact for welcome email' };
      }

      // Queue all 3 welcome series steps into EmailQueue
      const now = new Date();
      for (const step of WELCOME_STEPS) {
        const scheduledFor = new Date(now.getTime() + step.delayHours * 60 * 60 * 1000);
        await wixData.insert('EmailQueue', {
          templateId: step.templateId,
          recipientEmail: cleaned,
          recipientContactId: exitContactId,
          variables: {
            discountCode: DISCOUNT_CODE,
            email: cleaned,
          },
          sequenceType: 'welcome',
          sequenceStep: step.step,
          status: 'pending',
          scheduledFor,
          sentAt: null,
          attempt: 0,
          lastError: '',
          createdAt: now,
        });
      }

      logAuditEvent('EmailQueue', 'exit_intent_capture', cleaned, { queued: WELCOME_STEPS.length });
      return { success: true, discountCode: DISCOUNT_CODE, queued: WELCOME_STEPS.length };
    } catch (err) {
      console.error('Exit intent email capture error:', err);
      return { success: false, message: 'Capture failed. Please try again.' };
    }
  }
);
