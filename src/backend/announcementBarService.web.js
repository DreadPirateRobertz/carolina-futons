/**
 * announcementBarService.web.js
 *
 * Backend webMethod for reading active promotions from the AnnouncementBars
 * CMS collection. Returns active bars sorted by priority (descending) with
 * date-range filtering applied.
 *
 * CMS collection: AnnouncementBars (fields: message, linkUrl, backgroundColor,
 * textColor, active, priority, startDate, endDate).
 *
 * Dependencies: wix-web-module, wix-data, backend/utils/errorHandler.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';

/**
 * Fetch all active announcement bars whose date range includes now,
 * sorted by priority descending (highest priority first).
 *
 * @returns {Promise<Array<{message: string, linkUrl: string|null, backgroundColor: string|null, textColor: string|null, priority: number}>>}
 *   Array of active bars, or empty array on error.
 * @permission Anyone
 */
export const getActiveAnnouncementBars = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const now = new Date();
      const results = await wixData.query('AnnouncementBars')
        .eq('active', true)
        .le('startDate', now)
        .ge('endDate', now)
        .descending('priority')
        .limit(10)
        .find();

      return results.items.map(bar => ({
        message: bar.message || '',
        linkUrl: bar.linkUrl || null,
        backgroundColor: bar.backgroundColor || null,
        textColor: bar.textColor || null,
        priority: bar.priority || 0,
      }));
    } catch (e) {
      logError('announcementBarService.getActiveAnnouncementBars', e);
      return [];
    }
  }
);
