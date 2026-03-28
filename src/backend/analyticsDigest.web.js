/**
 * @module analyticsDigest
 * @description Weekly analytics digest — summarizes custom event data from the
 * AnalyticsEvents CMS collection and returns a structured report.
 *
 * Intended to run weekly (Monday 9am MT) via Wix scheduled job.
 * CF-w62s
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logAuditEvent } from 'backend/utils/auditLog';
import { CUSTOM_EVENTS } from 'backend/customEvents.web';
import { ANALYTICS_EVENTS_COLLECTION } from 'backend/utils/analyticsEvents';

/**
 * Generate a weekly analytics digest covering the last 7 days.
 *
 * @param {Object} [options]
 * @param {number} [options.days=7] - Number of days to look back
 * @returns {Promise<{success: boolean, digest: Object}>}
 * @permission Admin
 */
export const generateWeeklyDigest = webMethod(
  Permissions.Admin,
  async (options = {}) => {
    try {
      const days = options.days != null ? Math.min(Math.max(1, options.days), 90) : 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await wixData.query(ANALYTICS_EVENTS_COLLECTION)
        .ge('timestamp', since)
        .limit(1000)
        .find();

      const events = result.items;

      // Count by event type
      const eventCounts = {};
      const sourceCounts = {};
      const dailyCounts = {};

      for (const event of events) {
        const type = event.eventType || 'unknown';
        const source = event.source || 'unknown';
        const day = event.timestamp
          ? new Date(event.timestamp).toISOString().split('T')[0]
          : 'unknown';

        eventCounts[type] = (eventCounts[type] || 0) + 1;
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      }

      // Sort events by count (highest first)
      const topEvents = Object.entries(eventCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([event, count]) => {
          const def = CUSTOM_EVENTS[event];
          return {
            event,
            count,
            category: def ? def.category : 'other',
            description: def ? def.description : '',
          };
        });

      // Funnel metrics
      const funnelMetrics = {
        quiz: {
          started: eventCounts.quiz_started || 0,
          completed: eventCounts.quiz_completed || 0,
          leadsCapured: eventCounts.quiz_lead_captured || 0,
          completionRate: eventCounts.quiz_started
            ? Math.round(((eventCounts.quiz_completed || 0) / eventCounts.quiz_started) * 100)
            : 0,
        },
        spin: {
          played: eventCounts.spin_played || 0,
          won: eventCounts.spin_won || 0,
          converted: eventCounts.spin_converted || 0,
        },
        financing: {
          calculated: eventCounts.financing_calculated || 0,
          applied: eventCounts.financing_applied || 0,
        },
        roomPlanner: {
          used: eventCounts.room_planner_used || 0,
          toCart: eventCounts.room_planner_to_cart || 0,
        },
      };

      const digest = {
        generatedAt: new Date().toISOString(),
        period: { days, since: since.toISOString() },
        totalEvents: events.length,
        uniqueEventTypes: Object.keys(eventCounts).length,
        topEvents,
        funnelMetrics,
        dailyTrend: Object.entries(dailyCounts)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, count]) => ({ date, count })),
        bySource: Object.entries(sourceCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([source, count]) => ({ source, count })),
      };

      logAuditEvent('AnalyticsDigest', 'generate', 'system', {
        totalEvents: digest.totalEvents,
        period: days,
      });

      return { success: true, digest };
    } catch (err) {
      console.error('[analyticsDigest] Error generating digest:', err);
      return { success: false, error: 'Failed to generate analytics digest' };
    }
  }
);
