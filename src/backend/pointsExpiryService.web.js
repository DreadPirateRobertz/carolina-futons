/**
 * @module pointsExpiryService
 * @description Points expiry policy: points expire after 18 months of inactivity,
 * with a 30-day warning window starting at 17 months.
 *
 * webMethod checkAndExpirePoints(memberId) (Permissions.SiteMember)
 *   - If lastActivityDate > 18 months ago AND totalPoints > 0:
 *       sets totalPoints=0, writes PointsExpiryEvents record.
 *       Returns {expired: true}.
 *   - If lastActivityDate in warning window (17–18 months ago):
 *       Returns {warningDue: true, expiryDate: <ISO string>}.
 *   - Otherwise: Returns {expired: false, warningDue: false}.
 *   - Missing member: Returns null.
 *
 * webMethod getExpiryWarning(memberId) (Permissions.Anyone)
 *   - Returns {daysUntilExpiry, totalPoints} if member is in warning window.
 *   - Returns null if not in warning window or member not found.
 *
 * CMS collections:
 *   MemberPoints (read/write)     — memberId, totalPoints, lastActivityDate
 *   PointsExpiryEvents (write)    — memberId, expiredAt, pointsLost
 *
 * CF-zjtn
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { webMethod, Permissions } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';

const EXPIRY_MONTHS = 18;
const WARNING_MONTHS = 17; // 30-day warning window starts here

/**
 * Add N calendar months to a Date.
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Fetch a single MemberPoints record by memberId.
 * @returns {Promise<object|null>}
 */
async function fetchMemberPoints(memberId) {
  const result = await wixData
    .query('MemberPoints')
    .eq('memberId', memberId)
    .limit(1)
    .find({ suppressAuth: true });
  return result.items[0] ?? null;
}

/**
 * Check and expire points for a member if they have been inactive for 18+ months.
 * @param {string} memberId
 * @returns {Promise<{expired:boolean, warningDue:boolean, expiryDate?:string}|null>}
 */
export const checkAndExpirePoints = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    let record;
    try {
      record = await fetchMemberPoints(memberId);
    } catch (e) {
      logError('pointsExpiryService.checkAndExpirePoints.query', e);
      return null;
    }

    if (!record) return null;
    if (!record.lastActivityDate) return { expired: false, warningDue: false };

    const lastActivity = new Date(record.lastActivityDate);
    const expiryDate   = addMonths(lastActivity, EXPIRY_MONTHS);
    const warnDate     = addMonths(lastActivity, WARNING_MONTHS);
    const now          = new Date();

    // Already expired — zero out points
    if (now >= expiryDate) {
      if ((record.totalPoints ?? 0) > 0) {
        const pointsLost = record.totalPoints;
        try {
          await wixData.update('MemberPoints', { ...record, totalPoints: 0 }, { suppressAuth: true });
        } catch (e) {
          logError('pointsExpiryService.checkAndExpirePoints.update', e);
          return null;
        }
        try {
          await wixData.insert('PointsExpiryEvents', {
            memberId,
            expiredAt:  now.toISOString(),
            pointsLost,
          }, { suppressAuth: true });
        } catch (e) {
          logError('pointsExpiryService.checkAndExpirePoints.insertEvent', e);
          // Non-fatal — expiry still happened
        }
      }
      return { expired: true };
    }

    // In warning window
    if (now >= warnDate) {
      return { warningDue: true, expiryDate: expiryDate.toISOString() };
    }

    return { expired: false, warningDue: false };
  }
);

/**
 * Returns expiry warning info if the member is in the 30-day warning window.
 * @param {string} memberId
 * @returns {Promise<{daysUntilExpiry: number, totalPoints: number}|null>}
 */
export const getExpiryWarning = webMethod(
  Permissions.Anyone,
  async (memberId) => {
    let record;
    try {
      record = await fetchMemberPoints(memberId);
    } catch (e) {
      logError('pointsExpiryService.getExpiryWarning.query', e);
      return null;
    }

    if (!record || !record.lastActivityDate) return null;

    const lastActivity = new Date(record.lastActivityDate);
    const expiryDate   = addMonths(lastActivity, EXPIRY_MONTHS);
    const warnDate     = addMonths(lastActivity, WARNING_MONTHS);
    const now          = new Date();

    if (now >= warnDate && now < expiryDate) {
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysUntilExpiry = Math.ceil((expiryDate - now) / msPerDay);
      return { daysUntilExpiry, totalPoints: record.totalPoints ?? 0 };
    }

    return null;
  }
);
