/**
 * @module pointsExpiryService
 * @description Points expiry policy: points expire after 18 months of inactivity,
 * with a 30-day warning window starting at 17 months.
 *
 * webMethod checkAndExpirePoints(memberId) (Permissions.SiteMember)
 *   - Verifies caller session matches memberId (IDOR guard); returns null on mismatch.
 *   - If lastActivityDate >= 18 months ago:
 *       Returns {expired: true, warningDue: false}.
 *       Additionally, if totalPoints > 0: sets totalPoints=0 and writes a PointsExpiryEvents record.
 *   - If lastActivityDate in warning window (17–18 months ago):
 *       Returns {expired: false, warningDue: true, expiryDate: <ISO string>}.
 *   - Otherwise: Returns {expired: false, warningDue: false}.
 *   - `expired` and `warningDue` are always present in non-null responses.
 *   - Invalid/missing memberId or missing member: Returns null.
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
import { currentMember } from 'wix-members-backend';
import { logError } from 'backend/utils/errorHandler';
import { validateId } from 'backend/utils/sanitize';

const EXPIRY_MONTHS = 18;
const WARNING_MONTHS = 17; // 30-day warning window starts here

/**
 * Add N calendar months to a Date.
 * Note: uses setMonth(), which clamps to month boundaries
 * (e.g. Jan 31 + 1 month = Mar 2/3, not Feb 28). Acceptable here
 * because lastActivityDate originates from event timestamps, not
 * synthetic end-of-month values.
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // setMonth overflows month-end days (e.g. Jan 31 + 1 = Mar 3, not Feb 28).
  // If the day shifted, we overflowed — clamp back to last day of target month.
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

/**
 * Fetch a single MemberPoints record by memberId.
 * @param {string} memberId
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
    const cleanId = validateId(memberId);
    if (!cleanId) return null;

    // Prevent IDOR: verify the caller is the member they claim to be.
    let session;
    try {
      session = await currentMember.getMember();
    } catch (e) {
      logError(`pointsExpiryService.checkAndExpirePoints.auth [member=${cleanId}]`, e);
      return null;
    }
    if (!session || session._id !== cleanId) return null;

    let record;
    try {
      record = await fetchMemberPoints(cleanId);
    } catch (e) {
      logError(`pointsExpiryService.checkAndExpirePoints.query [member=${cleanId}]`, e);
      return null;
    }

    if (!record) return null;
    if (!record.lastActivityDate) {
      logError(
        `pointsExpiryService.checkAndExpirePoints.missingActivityDate [member=${cleanId}]`,
        new Error('MemberPoints record has no lastActivityDate'),
      );
      return { expired: false, warningDue: false };
    }

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
          logError(`pointsExpiryService.checkAndExpirePoints.update [member=${cleanId}]`, e);
          return null;
        }
        try {
          await wixData.insert('PointsExpiryEvents', {
            memberId: cleanId,
            expiredAt:  now.toISOString(),
            pointsLost,
          }, { suppressAuth: true });
        } catch (e) {
          logError(`pointsExpiryService.checkAndExpirePoints.insertEvent [member=${cleanId}]`, e);
          // Non-fatal — expiry still happened. A failed insert means this
          // expiry has no audit record in PointsExpiryEvents; monitor logError
          // output to detect gaps.
        }
      }
      return { expired: true, warningDue: false };
    }

    // In warning window
    if (now >= warnDate) {
      return { expired: false, warningDue: true, expiryDate: expiryDate.toISOString() };
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
    const cleanId = validateId(memberId);
    if (!cleanId) return null;

    let record;
    try {
      record = await fetchMemberPoints(cleanId);
    } catch (e) {
      logError(`pointsExpiryService.getExpiryWarning.query [member=${cleanId}]`, e);
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
