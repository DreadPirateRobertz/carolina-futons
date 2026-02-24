/**
 * @module browseAbandonment
 * @description Browse abandonment tracking and recovery email sequences.
 * Tracks high-intent browse sessions (>2 min on product pages),
 * captures "Remind Me" email signups, triggers 3-step recovery
 * sequences for non-converting sessions, and provides analytics.
 *
 * CMS Collections:
 * - BrowseSessions: session-level browse data and recovery status
 * - BrowseRecoveryEmails: email queue for browse recovery sequences
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail, validateId } from 'backend/utils/sanitize';
import { safeParse } from 'backend/utils/safeParse';

const HIGH_INTENT_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const RECOVERY_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours
const MAX_PRODUCTS_TRACKED = 20;

// Recovery email sequence: delays from session end
const RECOVERY_SEQUENCE = [
  { step: 1, delayMs: 2 * 60 * 60 * 1000, templateId: 'browse_recovery_1', subject: 'Still thinking about it?' },
  { step: 2, delayMs: 24 * 60 * 60 * 1000, templateId: 'browse_recovery_2', subject: 'Your favorites are waiting' },
  { step: 3, delayMs: 48 * 60 * 60 * 1000, templateId: 'browse_recovery_3', subject: 'Last chance: items you viewed' },
];

// ─── trackBrowseSession ─────────────────────────────────────────

/**
 * Record or update a browse session with viewed products and duration.
 * Called from frontend when session ends or periodically during browsing.
 *
 * @param {Object} sessionData
 * @param {string} sessionData.sessionId - Unique session identifier
 * @param {Array} sessionData.productsViewed - Array of {productId, productName, price, viewDuration}
 * @param {number} sessionData.totalDuration - Total session duration in ms
 * @param {string} [sessionData.entryPage] - First page visited
 * @param {string} [sessionData.exitPage] - Last page visited
 * @returns {Promise<Object>} { success, isHighIntent }
 */
export const trackBrowseSession = webMethod(
  Permissions.Anyone,
  async (sessionData) => {
    try {
      if (!sessionData?.sessionId) {
        return { success: false, error: 'Session ID required' };
      }

      const sessionId = sanitize(sessionData.sessionId, 100);
      if (!sessionId) return { success: false, error: 'Invalid session ID' };

      const products = (sessionData.productsViewed || [])
        .slice(0, MAX_PRODUCTS_TRACKED)
        .map(p => ({
          productId: validateId(p.productId) || '',
          productName: sanitize(p.productName || '', 200),
          price: typeof p.price === 'number' ? p.price : 0,
          viewDuration: typeof p.viewDuration === 'number' ? p.viewDuration : 0,
        }))
        .filter(p => p.productId);

      const totalDuration = typeof sessionData.totalDuration === 'number'
        ? Math.max(0, sessionData.totalDuration)
        : 0;

      const isHighIntent = totalDuration >= HIGH_INTENT_THRESHOLD_MS && products.length > 0;

      // Check for existing session
      const existing = await wixData.query('BrowseSessions')
        .eq('sessionId', sessionId)
        .limit(1)
        .find();

      if (existing.items.length > 0) {
        // Update existing session
        const record = existing.items[0];
        record.productsViewed = JSON.stringify(products);
        record.productCount = products.length;
        record.totalDuration = totalDuration;
        record.isHighIntent = isHighIntent;
        record.exitPage = sanitize(sessionData.exitPage || '', 500);
        record.updatedAt = new Date();
        await wixData.update('BrowseSessions', record);
      } else {
        // Create new session record
        await wixData.insert('BrowseSessions', {
          sessionId,
          productsViewed: JSON.stringify(products),
          productCount: products.length,
          totalDuration,
          isHighIntent,
          entryPage: sanitize(sessionData.entryPage || '', 500),
          exitPage: sanitize(sessionData.exitPage || '', 500),
          hasEmail: false,
          visitorEmail: '',
          visitorName: '',
          converted: false,
          recoveryTriggered: false,
          recoveryStep: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      return { success: true, isHighIntent };
    } catch (err) {
      console.error('[browseAbandonment] Error tracking session:', err);
      return { success: false, error: 'Failed to track session' };
    }
  }
);

// ─── captureRemindMeRequest ─────────────────────────────────────

/**
 * Capture email from "Remind Me" popup shown on high-intent sessions.
 * Associates the email with the browse session for recovery targeting.
 *
 * @param {string} sessionId - Session to associate email with
 * @param {string} email - Visitor's email address
 * @param {string} [name] - Visitor's name
 * @returns {Promise<Object>} { success }
 */
export const captureRemindMeRequest = webMethod(
  Permissions.Anyone,
  async (sessionId, email, name) => {
    try {
      const cleanSessionId = sanitize(sessionId, 100);
      if (!cleanSessionId) return { success: false, error: 'Session ID required' };

      if (!validateEmail(email)) {
        return { success: false, error: 'Valid email required' };
      }

      const cleanEmail = sanitize(email, 254);
      const cleanName = sanitize(name || '', 100);

      // Check unsubscribes
      const unsub = await wixData.query('Unsubscribes')
        .eq('email', cleanEmail)
        .limit(1)
        .find();

      if (unsub.items.length > 0) {
        const record = unsub.items[0];
        if (record.sequenceType === 'all' || record.sequenceType === 'browse_recovery') {
          return { success: false, error: 'Email is unsubscribed' };
        }
      }

      // Update session with email
      const existing = await wixData.query('BrowseSessions')
        .eq('sessionId', cleanSessionId)
        .limit(1)
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];
        record.hasEmail = true;
        record.visitorEmail = cleanEmail;
        record.visitorName = cleanName;
        record.updatedAt = new Date();
        await wixData.update('BrowseSessions', record);
      } else {
        // Create session with email (in case session wasn't tracked yet)
        await wixData.insert('BrowseSessions', {
          sessionId: cleanSessionId,
          productsViewed: '[]',
          productCount: 0,
          totalDuration: 0,
          isHighIntent: false,
          entryPage: '',
          exitPage: '',
          hasEmail: true,
          visitorEmail: cleanEmail,
          visitorName: cleanName,
          converted: false,
          recoveryTriggered: false,
          recoveryStep: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      return { success: true };
    } catch (err) {
      console.error('[browseAbandonment] Error capturing remind-me:', err);
      return { success: false, error: 'Failed to capture email' };
    }
  }
);

// ─── triggerBrowseRecovery ──────────────────────────────────────

/**
 * Find high-intent sessions with emails that haven't converted
 * within the recovery window, and queue recovery emails.
 * Should be called periodically (every 30 min via scheduled job).
 *
 * @returns {Promise<Object>} { success, triggered, skipped }
 */
export const triggerBrowseRecovery = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const cutoff = new Date(Date.now() - RECOVERY_WINDOW_MS);

      // Find high-intent sessions with emails, not converted, not fully recovered
      const sessions = await wixData.query('BrowseSessions')
        .eq('isHighIntent', true)
        .eq('hasEmail', true)
        .eq('converted', false)
        .lt('recoveryStep', RECOVERY_SEQUENCE.length)
        .limit(50)
        .find();

      let triggered = 0;
      let skipped = 0;

      for (const session of sessions.items) {
        const nextStep = session.recoveryStep + 1;
        const stepConfig = RECOVERY_SEQUENCE.find(s => s.step === nextStep);
        if (!stepConfig) { skipped++; continue; }

        // Check if enough time has passed for next step
        const sessionAge = Date.now() - new Date(session.createdAt).getTime();
        if (sessionAge < stepConfig.delayMs) { skipped++; continue; }

        // Check unsubscribes
        const unsub = await wixData.query('Unsubscribes')
          .eq('email', session.visitorEmail)
          .limit(1)
          .find();

        if (unsub.items.length > 0) {
          const record = unsub.items[0];
          if (record.sequenceType === 'all' || record.sequenceType === 'browse_recovery') {
            skipped++;
            continue;
          }
        }

        // Parse products for email template
        let products = [];
        products = safeParse(session.productsViewed, [], 'browseAbandonment/productsViewed');
        const topProducts = products.slice(0, 3);

        // Queue recovery email
        await wixData.insert('BrowseRecoveryEmails', {
          sessionId: session.sessionId,
          recipientEmail: session.visitorEmail,
          recipientName: session.visitorName || '',
          step: nextStep,
          templateId: stepConfig.templateId,
          subject: stepConfig.subject,
          products: JSON.stringify(topProducts),
          status: 'pending',
          scheduledFor: new Date(),
          createdAt: new Date(),
        });

        // Update session recovery progress
        session.recoveryStep = nextStep;
        session.recoveryTriggered = true;
        session.updatedAt = new Date();
        await wixData.update('BrowseSessions', session);

        triggered++;
      }

      return { success: true, triggered, skipped };
    } catch (err) {
      console.error('[browseAbandonment] Error triggering recovery:', err);
      return { success: false, error: 'Failed to trigger recovery' };
    }
  }
);

// ─── getBrowseAbandonmentStats ──────────────────────────────────

/**
 * Get dashboard stats for browse abandonment and recovery.
 *
 * @param {number} [days=30] - Number of days to analyze
 * @returns {Promise<Object>} Abandonment stats
 */
export const getBrowseAbandonmentStats = webMethod(
  Permissions.Admin,
  async (days = 30) => {
    try {
      const safeDays = Math.min(Math.max(1, days), 365);
      const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

      // Total sessions
      const totalSessions = await wixData.query('BrowseSessions')
        .ge('createdAt', since)
        .count();

      // High-intent sessions
      const highIntentSessions = await wixData.query('BrowseSessions')
        .ge('createdAt', since)
        .eq('isHighIntent', true)
        .count();

      // Sessions with email captured
      const sessionsWithEmail = await wixData.query('BrowseSessions')
        .ge('createdAt', since)
        .eq('hasEmail', true)
        .count();

      // Recovery emails sent
      const recoverySent = await wixData.query('BrowseRecoveryEmails')
        .ge('createdAt', since)
        .count();

      // Converted sessions (browsed + later purchased)
      const convertedSessions = await wixData.query('BrowseSessions')
        .ge('createdAt', since)
        .eq('converted', true)
        .count();

      // Recovery-converted (had recovery email AND converted)
      const recoveryConverted = await wixData.query('BrowseSessions')
        .ge('createdAt', since)
        .eq('recoveryTriggered', true)
        .eq('converted', true)
        .count();

      return {
        success: true,
        period: `${safeDays} days`,
        totalSessions,
        highIntentSessions,
        highIntentRate: totalSessions > 0 ? Math.round((highIntentSessions / totalSessions) * 100) : 0,
        sessionsWithEmail,
        emailCaptureRate: highIntentSessions > 0 ? Math.round((sessionsWithEmail / highIntentSessions) * 100) : 0,
        recoverySent,
        convertedSessions,
        conversionRate: totalSessions > 0 ? Math.round((convertedSessions / totalSessions) * 100) : 0,
        recoveryConverted,
        recoveryRate: recoverySent > 0 ? Math.round((recoveryConverted / recoverySent) * 100) : 0,
      };
    } catch (err) {
      console.error('[browseAbandonment] Error fetching stats:', err);
      return { success: false, error: 'Failed to fetch stats' };
    }
  }
);

// ─── exportAbandonmentInsights ──────────────────────────────────

/**
 * Get product-level abandonment insights: which products are viewed
 * most but not purchased, enabling targeted marketing.
 *
 * @param {number} [limit=10] - Number of products to return
 * @returns {Promise<Object>} Product insights sorted by abandonment frequency
 */
export const exportAbandonmentInsights = webMethod(
  Permissions.Admin,
  async (limit = 10) => {
    try {
      const safeLimit = Math.min(Math.max(1, limit), 50);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Fetch recent high-intent, non-converted sessions
      const sessions = await wixData.query('BrowseSessions')
        .ge('createdAt', since)
        .eq('isHighIntent', true)
        .eq('converted', false)
        .limit(200)
        .find();

      // Aggregate products by frequency
      const productMap = {};
      for (const session of sessions.items) {
        let products = [];
        products = safeParse(session.productsViewed, [], 'browseAbandonment/productsViewed');

        for (const p of products) {
          if (!p.productId) continue;
          if (!productMap[p.productId]) {
            productMap[p.productId] = {
              productId: p.productId,
              productName: p.productName || '',
              price: p.price || 0,
              abandonedViews: 0,
              totalViewDuration: 0,
            };
          }
          productMap[p.productId].abandonedViews++;
          productMap[p.productId].totalViewDuration += (p.viewDuration || 0);
        }
      }

      // Sort by abandoned views descending
      const insights = Object.values(productMap)
        .sort((a, b) => b.abandonedViews - a.abandonedViews)
        .slice(0, safeLimit)
        .map(p => ({
          ...p,
          avgViewDuration: p.abandonedViews > 0
            ? Math.round(p.totalViewDuration / p.abandonedViews)
            : 0,
        }));

      return { success: true, insights };
    } catch (err) {
      console.error('[browseAbandonment] Error exporting insights:', err);
      return { success: false, error: 'Failed to export insights' };
    }
  }
);

// ─── markSessionConverted ───────────────────────────────────────

/**
 * Mark a browse session as converted (purchase completed).
 * Called from order confirmation flow.
 *
 * @param {string} sessionId - Session to mark as converted
 * @returns {Promise<boolean>}
 */
export const markSessionConverted = webMethod(
  Permissions.SiteMember,
  async (sessionId) => {
    try {
      const cleanId = sanitize(sessionId, 100);
      if (!cleanId) return false;

      const result = await wixData.query('BrowseSessions')
        .eq('sessionId', cleanId)
        .limit(1)
        .find();

      if (result.items.length > 0) {
        const record = result.items[0];
        record.converted = true;
        record.updatedAt = new Date();
        await wixData.update('BrowseSessions', record);

        // Cancel pending recovery emails
        const pending = await wixData.query('BrowseRecoveryEmails')
          .eq('sessionId', cleanId)
          .eq('status', 'pending')
          .find();

        for (const email of pending.items) {
          email.status = 'cancelled';
          await wixData.update('BrowseRecoveryEmails', email);
        }

        return true;
      }
      return false;
    } catch (err) {
      console.error('[browseAbandonment] Error marking converted:', err);
      return false;
    }
  }
);

// Exported for testing
export {
  HIGH_INTENT_THRESHOLD_MS,
  RECOVERY_WINDOW_MS,
  MAX_PRODUCTS_TRACKED,
  RECOVERY_SEQUENCE,
};
