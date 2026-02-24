/**
 * @module errorMonitoring
 * @description Centralized error logging and monitoring dashboard backend.
 * Logs errors to ErrorLogs CMS collection, groups similar errors, tracks
 * frequency, and alerts on rate spikes.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection "ErrorLogs" with fields:
 * - errorGroup (Text) - Hash key for grouping similar errors
 * - message (Text) - Error message
 * - stack (Text) - Stack trace
 * - page (Text) - Page where error occurred
 * - context (Text) - Module/function context
 * - userId (Text) - Current member ID if available
 * - userAgent (Text) - Browser user agent
 * - severity (Text) - "error" | "warning" | "critical"
 * - metadata (Text/JSON) - Additional context as JSON string
 * - _createdDate (DateTime) - Auto
 *
 * Create CMS collection "ErrorGroups" with fields:
 * - groupKey (Text) - Unique hash for error grouping
 * - message (Text) - Representative error message
 * - firstSeen (DateTime) - When this error first occurred
 * - lastSeen (DateTime) - Most recent occurrence
 * - occurrenceCount (Number) - Total times this error has occurred
 * - status (Text) - "active" | "resolved" | "ignored"
 * - affectedPages (Text/JSON) - JSON array of pages affected
 * - sampleStack (Text) - Representative stack trace
 * - resolvedBy (Text) - Who resolved it
 * - resolvedDate (DateTime) - When it was resolved
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';

const ERROR_LOGS_COLLECTION = 'ErrorLogs';
const ERROR_GROUPS_COLLECTION = 'ErrorGroups';
const ALERT_THRESHOLD_MULTIPLIER = 10;
const BASELINE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const SPIKE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ── Admin check ─────────────────────────────────────────────────────

async function requireAdmin() {
  const member = await currentMember.getMember();
  if (!member || !member._id) {
    throw new Error('Authentication required.');
  }
  const roles = await currentMember.getRoles();
  const isAdmin = roles.some(r => r.title === 'Admin' || r._id === 'admin');
  if (!isAdmin) {
    throw new Error('Admin access required.');
  }
  return member._id;
}

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

// ── getErrorDashboard ───────────────────────────────────────────────

export const getErrorDashboard = webMethod(
  Permissions.SiteMember,
  async (options = {}) => {
    try {
      await requireAdmin();

      const { days = 7, limit = 50 } = options;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get active error groups sorted by occurrence count
      const groups = await wixData.query(ERROR_GROUPS_COLLECTION)
        .ne('status', 'ignored')
        .ge('lastSeen', cutoff)
        .descending('occurrenceCount')
        .limit(limit)
        .find();

      // Get total error count for the period
      const totalLogs = await wixData.query(ERROR_LOGS_COLLECTION)
        .ge('_createdDate', cutoff)
        .count();

      // Get error count by severity
      const criticalCount = await wixData.query(ERROR_LOGS_COLLECTION)
        .ge('_createdDate', cutoff)
        .eq('severity', 'critical')
        .count();

      const warningCount = await wixData.query(ERROR_LOGS_COLLECTION)
        .ge('_createdDate', cutoff)
        .eq('severity', 'warning')
        .count();

      return {
        success: true,
        summary: {
          totalErrors: totalLogs,
          criticalErrors: criticalCount,
          warnings: warningCount,
          activeGroups: groups.items.filter(g => g.status === 'active').length,
          resolvedGroups: groups.items.filter(g => g.status === 'resolved').length,
          period: `${days} days`,
        },
        topErrors: groups.items.map(g => ({
          _id: g._id,
          groupKey: g.groupKey,
          message: g.message,
          occurrenceCount: g.occurrenceCount,
          firstSeen: g.firstSeen,
          lastSeen: g.lastSeen,
          status: g.status,
          affectedPages: safeParseJSON(g.affectedPages, []),
          sampleStack: g.sampleStack,
        })),
      };
    } catch (err) {
      console.error('getErrorDashboard error:', err);
      return { success: false, error: 'Unable to load error dashboard' };
    }
  }
);

// ── getErrorDetails ─────────────────────────────────────────────────

export const getErrorDetails = webMethod(
  Permissions.SiteMember,
  async (groupKey) => {
    try {
      await requireAdmin();

      const cleanKey = sanitize(groupKey, 500);
      if (!cleanKey) return { success: false, error: 'Group key required' };

      // Get the error group
      const groupResult = await wixData.query(ERROR_GROUPS_COLLECTION)
        .eq('groupKey', cleanKey)
        .find();

      if (groupResult.items.length === 0) {
        return { success: false, error: 'Error group not found' };
      }

      const group = groupResult.items[0];

      // Get recent individual log entries for this group
      const logs = await wixData.query(ERROR_LOGS_COLLECTION)
        .eq('errorGroup', cleanKey)
        .descending('_createdDate')
        .limit(50)
        .find();

      return {
        success: true,
        group: {
          _id: group._id,
          groupKey: group.groupKey,
          message: group.message,
          occurrenceCount: group.occurrenceCount,
          firstSeen: group.firstSeen,
          lastSeen: group.lastSeen,
          status: group.status,
          affectedPages: safeParseJSON(group.affectedPages, []),
          sampleStack: group.sampleStack,
          resolvedBy: group.resolvedBy || null,
          resolvedDate: group.resolvedDate || null,
        },
        recentLogs: logs.items.map(log => ({
          _id: log._id,
          message: log.message,
          stack: log.stack,
          page: log.page,
          context: log.context,
          userId: log.userId,
          userAgent: log.userAgent,
          severity: log.severity,
          metadata: safeParseJSON(log.metadata, {}),
          createdDate: log._createdDate,
        })),
      };
    } catch (err) {
      console.error('getErrorDetails error:', err);
      return { success: false, error: 'Unable to load error details' };
    }
  }
);

// ── updateErrorGroupStatus ──────────────────────────────────────────

export const updateErrorGroupStatus = webMethod(
  Permissions.SiteMember,
  async (groupId, newStatus) => {
    try {
      const adminId = await requireAdmin();

      const cleanId = sanitize(groupId, 50);
      if (!cleanId) return { success: false, error: 'Group ID required' };

      const validStatuses = ['active', 'resolved', 'ignored'];
      if (!validStatuses.includes(newStatus)) {
        return { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
      }

      const group = await wixData.get(ERROR_GROUPS_COLLECTION, cleanId);
      if (!group) {
        return { success: false, error: 'Error group not found' };
      }

      group.status = newStatus;
      if (newStatus === 'resolved') {
        group.resolvedBy = adminId;
        group.resolvedDate = new Date();
      }

      await wixData.update(ERROR_GROUPS_COLLECTION, group);

      return { success: true, status: newStatus };
    } catch (err) {
      console.error('updateErrorGroupStatus error:', err);
      return { success: false, error: 'Unable to update error group status' };
    }
  }
);

// ── checkErrorRateSpike ─────────────────────────────────────────────

export const checkErrorRateSpike = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      await requireAdmin();

      const now = Date.now();
      const baselineCutoff = new Date(now - BASELINE_WINDOW_MS);
      const spikeCutoff = new Date(now - SPIKE_WINDOW_MS);

      // Count errors in the last 24 hours for baseline
      const baselineCount = await wixData.query(ERROR_LOGS_COLLECTION)
        .ge('_createdDate', baselineCutoff)
        .count();

      // Count errors in the last hour
      const spikeCount = await wixData.query(ERROR_LOGS_COLLECTION)
        .ge('_createdDate', spikeCutoff)
        .count();

      // Calculate hourly baseline rate (24h / 24 = avg errors per hour)
      const hourlyBaseline = baselineCount / 24;
      const isSpike = hourlyBaseline > 0 && spikeCount >= hourlyBaseline * ALERT_THRESHOLD_MULTIPLIER;

      return {
        success: true,
        isSpike,
        currentHourCount: spikeCount,
        hourlyBaseline: Math.round(hourlyBaseline * 100) / 100,
        threshold: Math.round(hourlyBaseline * ALERT_THRESHOLD_MULTIPLIER),
        baselinePeriod: '24 hours',
        spikePeriod: '1 hour',
      };
    } catch (err) {
      console.error('checkErrorRateSpike error:', err);
      return { success: false, error: 'Unable to check error rate' };
    }
  }
);

// ── getErrorFrequency ───────────────────────────────────────────────

export const getErrorFrequency = webMethod(
  Permissions.SiteMember,
  async (days = 7) => {
    try {
      await requireAdmin();

      const safeDays = Math.min(Math.max(1, days), 90);
      const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

      // Get all error logs in the period
      const logs = await wixData.query(ERROR_LOGS_COLLECTION)
        .ge('_createdDate', cutoff)
        .descending('_createdDate')
        .limit(1000)
        .find();

      // Group by date for frequency chart
      const byDate = {};
      const bySeverity = { error: 0, warning: 0, critical: 0 };
      const byPage = {};

      for (const log of logs.items) {
        // By date
        const date = log._createdDate
          ? new Date(log._createdDate).toISOString().split('T')[0]
          : 'unknown';
        byDate[date] = (byDate[date] || 0) + 1;

        // By severity
        const sev = log.severity || 'error';
        bySeverity[sev] = (bySeverity[sev] || 0) + 1;

        // By page
        if (log.page) {
          byPage[log.page] = (byPage[log.page] || 0) + 1;
        }
      }

      // Convert to sorted array
      const frequency = Object.entries(byDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const topPages = Object.entries(byPage)
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        success: true,
        period: `${safeDays} days`,
        totalErrors: logs.items.length,
        frequency,
        bySeverity,
        topPages,
      };
    } catch (err) {
      console.error('getErrorFrequency error:', err);
      return { success: false, error: 'Unable to load error frequency' };
    }
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function safeParseJSON(str, fallback) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}
