/**
 * @module analyticsDigest
 * @description Weekly analytics digest — summarizes custom event data from the
 * AnalyticsEvents CMS collection and returns a structured report.
 *
 * Intended to run weekly (Monday 9am MT) via Wix scheduled job.
 * CF-w62s, CF-u30i
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logAuditEvent } from 'backend/utils/auditLog';
import { CUSTOM_EVENTS } from 'backend/customEvents.web';
import { ANALYTICS_EVENTS_COLLECTION } from 'backend/utils/analyticsEvents';

const ORDERS_COLLECTION = 'Stores/Orders';
const TOP_PRODUCTS_LIMIT = 5;

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

      // cf-u30i: orders, revenue, and top products for the same window
      const orderMetrics = await fetchOrderMetrics(since);

      const digest = {
        generatedAt: new Date().toISOString(),
        period: { days, since: since.toISOString() },
        totalEvents: events.length,
        uniqueEventTypes: Object.keys(eventCounts).length,
        topEvents,
        funnelMetrics,
        orderMetrics,
        dailyTrend: Object.entries(dailyCounts)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, count]) => ({ date, count })),
        bySource: Object.entries(sourceCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([source, count]) => ({ source, count })),
      };

      logAuditEvent('AnalyticsDigest', 'generate', 'system', {
        totalEvents: digest.totalEvents,
        orderCount: orderMetrics.orderCount,
        totalRevenue: orderMetrics.totalRevenue,
        period: days,
      });

      return { success: true, digest };
    } catch (err) {
      console.error('[analyticsDigest] Error generating digest:', err);
      return { success: false, error: 'Failed to generate analytics digest' };
    }
  }
);

const DIGEST_RECIPIENT = 'carolinafutons@gmail.com';

/**
 * Compile and send the weekly analytics digest email.
 * Aggregates data from the event digest, conversion funnel, and A/B tests.
 *
 * Intended for Monday 8am MT scheduled job.
 *
 * @param {Object} [options]
 * @param {string} [options.recipientEmail] - Override recipient (for testing)
 * @param {number} [options.days=7]
 * @returns {Promise<{success: boolean}>}
 * @permission Admin
 * CF-epnm
 */
export const sendWeeklyDigestEmail = webMethod(
  Permissions.Admin,
  async (options = {}) => {
    try {
      const days = options.days || 7;
      const recipient = options.recipientEmail || DIGEST_RECIPIENT;

      // Generate the digest
      const digestResult = await generateWeeklyDigest({ days });
      if (!digestResult.success) {
        return { success: false, error: 'Failed to generate digest' };
      }

      const digest = digestResult.digest;

      // Build email HTML
      const html = buildDigestEmailHtml(digest);
      const subject = `Weekly Analytics Digest — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      // Queue the email
      await wixData.insert('EmailQueue', {
        templateId: 'analytics_digest',
        recipientEmail: recipient,
        recipientContactId: '',
        variables: JSON.stringify({ subject, html }),
        sequenceType: 'analytics_digest',
        sequenceStep: 1,
        scheduledFor: new Date(),
        status: 'pending',
        createdAt: new Date(),
      });

      logAuditEvent('AnalyticsDigest', 'email_sent', 'system', {
        recipient, totalEvents: digest.totalEvents, period: days,
      });

      return { success: true };
    } catch (err) {
      console.error('[analyticsDigest] sendWeeklyDigestEmail error:', err);
      return { success: false, error: 'Failed to send digest email' };
    }
  }
);

// ── Order metrics (cf-u30i) ──────────────────────────────────────────

/**
 * Fetch order metrics for the digest period: revenue, order count, AOV,
 * and top products by revenue.
 *
 * @param {Date} since - Start of the window
 * @returns {Promise<{orderCount:number, totalRevenue:number, avgOrderValue:number, topProducts:Array}>}
 */
export async function fetchOrderMetrics(since) {
  try {
    const result = await wixData
      .query(ORDERS_COLLECTION)
      .ge('_createdDate', since)
      .limit(500)
      .find({ suppressAuth: true });

    const orders = result.items;

    let totalRevenue = 0;
    const productRevenue = {};  // productName -> { revenue, units }

    for (const order of orders) {
      const orderTotal = order.totals?.total || 0;
      totalRevenue += orderTotal;

      for (const li of order.lineItems || []) {
        const name = li.name || li.productName || 'Unknown';
        const lineTotal = (li.price || 0) * (li.quantity || 1);
        if (!productRevenue[name]) {
          productRevenue[name] = { revenue: 0, units: 0 };
        }
        productRevenue[name].revenue += lineTotal;
        productRevenue[name].units += li.quantity || 1;
      }
    }

    const orderCount = orders.length;
    const avgOrderValue = orderCount > 0
      ? Math.round((totalRevenue / orderCount) * 100) / 100
      : 0;

    const topProducts = Object.entries(productRevenue)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, TOP_PRODUCTS_LIMIT)
      .map(([name, stats]) => ({
        name,
        revenue: Math.round(stats.revenue * 100) / 100,
        units: stats.units,
      }));

    return { orderCount, totalRevenue: Math.round(totalRevenue * 100) / 100, avgOrderValue, topProducts };
  } catch (err) {
    console.error('[analyticsDigest] fetchOrderMetrics error:', err);
    return { orderCount: 0, totalRevenue: 0, avgOrderValue: 0, topProducts: [] };
  }
}

/**
 * Build HTML email body from digest data.
 * @param {Object} digest
 * @returns {string}
 */
function buildDigestEmailHtml(digest) {
  const topEvents = (digest.topEvents || []).slice(0, 10);
  const funnelMetrics = digest.funnelMetrics || {};
  const orderMetrics = digest.orderMetrics || {};
  const dailyTrend = (digest.dailyTrend || []).slice(-7);

  const quizFunnel = funnelMetrics.quiz || {};
  const spinFunnel = funnelMetrics.spin || {};

  // Revenue/orders summary row
  const revenueHtml = `
    <div style="background:#F0F4F8;padding:16px;border-radius:4px;margin:16px 0;">
      <h3 style="margin:0 0 8px;color:#1E3A5F;font-size:16px;">Revenue &amp; Orders</h3>
      <p style="margin:4px 0;font-size:14px;">Orders: <strong>${orderMetrics.orderCount || 0}</strong> &nbsp;|&nbsp; Revenue: <strong>$${(orderMetrics.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> &nbsp;|&nbsp; AOV: <strong>$${(orderMetrics.avgOrderValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
    </div>`;

  // Top products table
  const topProductRows = (orderMetrics.topProducts || []).map((p, i) =>
    `<tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'};">
       <td style="padding:5px 8px;font-family:Arial,sans-serif;font-size:13px;">${p.name}</td>
       <td style="padding:5px 8px;text-align:right;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;">$${p.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
       <td style="padding:5px 8px;text-align:right;font-family:Arial,sans-serif;font-size:12px;color:#666;">${p.units} unit${p.units !== 1 ? 's' : ''}</td>
     </tr>`
  ).join('');

  const topProductsHtml = topProductRows ? `
    <h3 style="color:#1E3A5F;font-size:15px;">Top Products</h3>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
      <tr style="background:#E8D5B7;">
        <th style="padding:6px 8px;text-align:left;font-size:12px;">Product</th>
        <th style="padding:6px 8px;text-align:right;font-size:12px;">Revenue</th>
        <th style="padding:6px 8px;text-align:right;font-size:12px;">Units</th>
      </tr>
      ${topProductRows}
    </table>` : '';

  const topEventsRows = topEvents.map(e =>
    `<tr><td style="padding:4px 8px;font-family:Arial,sans-serif;font-size:13px;">${e.event}</td>
     <td style="padding:4px 8px;text-align:right;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;">${e.count}</td>
     <td style="padding:4px 8px;font-family:Arial,sans-serif;font-size:12px;color:#666;">${e.category}</td></tr>`
  ).join('');

  const trendRows = dailyTrend.map(d =>
    `<tr><td style="padding:2px 6px;font-family:Arial,sans-serif;font-size:12px;">${d.date}</td>
     <td style="padding:2px 6px;text-align:right;font-family:Arial,sans-serif;font-size:12px;">${d.count}</td></tr>`
  ).join('');

  return `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
      <h2 style="color:#1E3A5F;font-family:Georgia,serif;">Weekly Analytics Digest</h2>
      <p style="color:#666;font-size:13px;">Period: ${digest.period?.days || 7} days | Generated: ${new Date().toLocaleDateString()}</p>

      ${revenueHtml}

      ${topProductsHtml}

      ${quizFunnel.started ? `
      <div style="margin:16px 0;">
        <h3 style="color:#1E3A5F;font-size:15px;">Style Quiz Funnel</h3>
        <p style="font-size:13px;">Started: ${quizFunnel.started} → Completed: ${quizFunnel.completed} → Leads: ${quizFunnel.leadsCapured || 0}</p>
        <p style="font-size:13px;">Completion rate: <strong>${quizFunnel.completionRate}%</strong></p>
      </div>` : ''}

      ${spinFunnel.played ? `
      <div style="margin:16px 0;">
        <h3 style="color:#1E3A5F;font-size:15px;">Spin Wheel</h3>
        <p style="font-size:13px;">Played: ${spinFunnel.played} → Won: ${spinFunnel.won} → Converted: ${spinFunnel.converted}</p>
      </div>` : ''}

      <h3 style="color:#1E3A5F;font-size:15px;">Traffic &amp; Engagement</h3>
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr style="background:#E8D5B7;">
          <th style="padding:6px 8px;text-align:left;font-size:12px;">Event</th>
          <th style="padding:6px 8px;text-align:right;font-size:12px;">Count</th>
          <th style="padding:6px 8px;text-align:left;font-size:12px;">Category</th>
        </tr>
        ${topEventsRows}
      </table>

      ${trendRows ? `
      <h3 style="color:#1E3A5F;font-size:15px;margin-top:16px;">Daily Traffic Trend</h3>
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        ${trendRows}
      </table>` : ''}

      <p style="margin-top:24px;font-size:11px;color:#999;">This is an automated digest from Carolina Futons analytics. To unsubscribe, contact your admin.</p>
    </div>`;
}
