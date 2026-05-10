/**
 * @module errorMonitoring
 * @description Centralized error logging — `logError` accepts errors from any
 * page or backend module, deduplicates by message+context group key, and
 * persists to ErrorLogs / ErrorGroups CMS collections. Plus the
 * `createErrorBoundaryLogger` factory, which wraps logError for use inside
 * React-style error boundaries (auto-flags checkout/payment as critical).
 *
 * cf-4x7e Pass 2 chunk 9 retired the dashboard / alerting surface that
 * used to live here (getErrorDashboard, getErrorDetails,
 * updateErrorGroupStatus, checkErrorRateSpike, getErrorFrequency,
 * configureAlert, getAlertRules, checkAlertConditions). All 8 had zero
 * callers in cfutons monorepo, stage3-velo, or cfw — admin tooling
 * built but never wired. Refer to git history for the dashboard
 * implementation if revived.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend (logError reads userId, no role-gating)
 *
 * @setup
 * Requires CMS collections:
 *
 *   ErrorLogs:
 *     errorGroup (Text)  — Hash key for grouping similar errors
 *     message (Text)     — Error message
 *     stack (Text)       — Stack trace
 *     page (Text)        — Page where error occurred
 *     context (Text)     — Module/function context
 *     userId (Text)      — Current member ID if available
 *     userAgent (Text)   — Browser user agent
 *     severity (Text)    — "error" | "warning" | "critical"
 *     metadata (Text/JSON) — Additional context as JSON string
 *     _createdDate (DateTime) — Auto
 *
 *   ErrorGroups:
 *     groupKey (Text)         — Unique hash for error grouping
 *     message (Text)          — Representative error message
 *     firstSeen (DateTime)    — When this error first occurred
 *     lastSeen (DateTime)     — Most recent occurrence
 *     occurrenceCount (Number) — Total times this error has occurred
 *     status (Text)           — "active" | "resolved" | "ignored"
 *     affectedPages (Text/JSON) — JSON array of pages affected
 *     sampleStack (Text)      — Representative stack trace
 *     resolvedBy (Text)       — Who resolved it (admin only; not currently set)
 *     resolvedDate (DateTime) — When it was resolved
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';

const ERROR_LOGS_COLLECTION = 'ErrorLogs';
const ERROR_GROUPS_COLLECTION = 'ErrorGroups';

// ── Error group key generation ──────────────────────────────────────

function generateGroupKey(message, context) {
  // Simple but effective: normalize the message and combine with context
  const normalizedMessage = (message || '')
    .replace(/\d+/g, 'N')        // Replace numbers with N
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .replace(/["'][^"']*["']/g, 'S') // Replace quoted strings
    .trim()
    .slice(0, 200);
  const normalizedContext = (context || '').trim().slice(0, 100);
  return `${normalizedContext}::${normalizedMessage}`;
}

// ── logError (public, called from any page/module) ──────────────────

export const logError = webMethod(
  Permissions.Anyone,
  async (errorData = {}) => {
    try {
      const {
        message,
        stack,
        page,
        context,
        userId,
        userAgent,
        severity = 'error',
        metadata,
      } = errorData;

      const cleanMessage = sanitize(message, 2000);
      const cleanStack = sanitize(stack, 5000);
      const cleanPage = sanitize(page, 200);
      const cleanContext = sanitize(context, 200);
      const cleanUserId = sanitize(userId, 50);
      const cleanUserAgent = sanitize(userAgent, 500);
      const cleanSeverity = ['error', 'warning', 'critical'].includes(severity)
        ? severity : 'error';
      const cleanMetadata = metadata
        ? sanitize(typeof metadata === 'string' ? metadata : JSON.stringify(metadata), 2000)
        : '';

      const groupKey = generateGroupKey(cleanMessage, cleanContext);

      const rateLimitKey = cleanUserId || cleanPage || 'anon';
      const rateLimitMax = rateLimitKey === 'anon' ? 200 : 30;
      const { allowed } = await checkRateLimit('ErrorLogRateLimit', rateLimitKey, { max: rateLimitMax, windowMs: 60_000 });
      if (!allowed) {
        console.warn(`[errorMonitoring] Error flood throttled for key=${rateLimitKey}`);
        return { success: true, throttled: true };
      }

      // Insert the error log entry
      await wixData.insert(ERROR_LOGS_COLLECTION, {
        errorGroup: groupKey,
        message: cleanMessage,
        stack: cleanStack,
        page: cleanPage,
        context: cleanContext,
        userId: cleanUserId,
        userAgent: cleanUserAgent,
        severity: cleanSeverity,
        metadata: cleanMetadata,
      });

      // Update or create the error group
      const existingGroup = await wixData.query(ERROR_GROUPS_COLLECTION)
        .eq('groupKey', groupKey)
        .find();

      if (existingGroup.items.length > 0) {
        const group = existingGroup.items[0];
        group.lastSeen = new Date();
        group.occurrenceCount = (group.occurrenceCount || 0) + 1;

        // Track affected pages
        let pages = [];
        try { pages = JSON.parse(group.affectedPages || '[]'); } catch (e) { pages = []; }
        if (cleanPage && !pages.includes(cleanPage)) {
          pages.push(cleanPage);
          group.affectedPages = JSON.stringify(pages);
        }

        // If it was resolved, re-open on new occurrence
        if (group.status === 'resolved') {
          group.status = 'active';
        }

        await wixData.update(ERROR_GROUPS_COLLECTION, group);
      } else {
        await wixData.insert(ERROR_GROUPS_COLLECTION, {
          groupKey,
          message: cleanMessage,
          firstSeen: new Date(),
          lastSeen: new Date(),
          occurrenceCount: 1,
          status: 'active',
          affectedPages: cleanPage ? JSON.stringify([cleanPage]) : '[]',
          sampleStack: cleanStack,
        });
      }

      return { success: true, groupKey };
    } catch (err) {
      // Logging itself must never crash the page
      console.error('Error logging failed (silent):', err?.message);
      return { success: false };
    }
  }
);

// ── createErrorBoundaryLogger ──────────────────────────────────────

const CRITICAL_CONTEXTS = ['checkout', 'payment'];

/**
 * Factory: creates a logger function for use in error boundaries.
 * Auto-assigns "critical" severity for checkout/payment contexts.
 * Never throws — safe to call from error handlers.
 *
 * @param {string} context - Component context (e.g. "checkout", "cart", "product")
 * @returns {(error: Error|string|null, metadata?: Object) => Promise<{success: boolean}>}
 */
export function createErrorBoundaryLogger(context) {
  const safeContext = typeof context === 'string' ? context : String(context || 'unknown');
  return async (error, metadata = {}) => {
    try {
      const lowerContext = safeContext.toLowerCase();
      const isCritical = CRITICAL_CONTEXTS.some(c => lowerContext.includes(c));

      let message = 'Unknown error';
      let stack = '';

      if (error instanceof Error) {
        message = error.message || 'Unknown error';
        stack = error.stack || '';
      } else if (typeof error === 'string') {
        message = error;
      }

      return logError({
        message,
        stack,
        context: safeContext,
        severity: isCritical ? 'critical' : 'error',
        metadata,
      });
    } catch (loggingErr) {
      console.error(`[errorBoundaryLogger] Failed to log for context="${safeContext}":`, loggingErr);
      return { success: false, error: 'Error boundary logging failed' };
    }
  };
}
