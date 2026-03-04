/**
 * @module ugcService
 * @description User-Generated Content gallery service for Carolina Futons.
 * Handles photo submissions, voting, reporting, moderation, before/after pairs,
 * and gallery statistics for customer-submitted room photos.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collections:
 *   `UGCPhotos` with fields:
 *     memberId (Text, indexed) - Submitter member ID
 *     memberDisplayName (Text) - Submitter display name
 *     photoUrl (Image) - Photo URL
 *     caption (Text) - Photo caption (max 300 chars)
 *     productId (Text) - Optional linked product ID
 *     productName (Text) - Optional product display name
 *     roomType (Text, indexed) - Room type: living-room|bedroom|office|dorm|porch
 *     tags (Tags) - Optional tags array
 *     socialSource (Text) - Optional social media source
 *     socialPostUrl (URL) - Optional social media post URL
 *     status (Text, indexed) - pending|approved|rejected|featured
 *     voteCount (Number) - Community vote count
 *     reportCount (Number) - Abuse report count
 *     submittedAt (Date, indexed) - Submission timestamp
 *     moderatedAt (Date) - Moderation timestamp
 *     beforeAfterId (Text, indexed) - Pair ID for before/after photos
 *     beforeAfterType (Text) - 'before' or 'after'
 *
 *   `UGCVotes` with fields:
 *     memberId (Text, indexed) - Voter member ID
 *     photoId (Text, indexed) - Photo being voted on
 *     createdAt (Date) - Vote timestamp
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

const VALID_ROOM_TYPES = ['living-room', 'bedroom', 'office', 'dorm', 'porch'];
const VALID_MODERATION_ACTIONS = ['approve', 'reject', 'feature'];
const ACTION_TO_STATUS = { approve: 'approved', reject: 'rejected', feature: 'featured' };

/**
 * Submit a user-generated photo for moderation.
 *
 * @param {Object} data - Photo submission data.
 * @param {string} data.photoUrl - Photo URL (required).
 * @param {string} data.caption - Photo caption (max 300 chars).
 * @param {string} data.roomType - Room type (living-room|bedroom|office|dorm|porch).
 * @param {string} [data.productId] - Optional product ID.
 * @param {string} [data.productName] - Optional product name.
 * @param {Array<string>} [data.tags] - Optional tags.
 * @param {string} [data.socialSource] - Optional social media source.
 * @param {string} [data.socialPostUrl] - Optional social post URL.
 * @param {string} [data.beforeAfterId] - Optional before/after pair ID.
 * @param {string} [data.beforeAfterType] - Optional 'before' or 'after'.
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const submitUGCPhoto = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Submission data is required.' };
      }

      const member = await currentMember.getMember();
      if (!member) {
        return { success: false, error: 'Authentication required.' };
      }

      const photoUrl = sanitize(data.photoUrl || '', 500);
      if (!photoUrl) {
        return { success: false, error: 'Photo URL is required.' };
      }

      const roomType = sanitize(data.roomType || '', 50);
      if (!VALID_ROOM_TYPES.includes(roomType)) {
        return { success: false, error: 'Invalid room type. Must be one of: ' + VALID_ROOM_TYPES.join(', ') };
      }

      const caption = sanitize(data.caption || '', 300);
      const memberDisplayName = sanitize(
        (member.contactDetails && member.contactDetails.firstName) || '',
        100
      );

      const record = {
        memberId: member._id,
        memberDisplayName,
        photoUrl,
        caption,
        productId: data.productId ? sanitize(data.productId, 100) : null,
        productName: data.productName ? sanitize(data.productName, 200) : null,
        tags: Array.isArray(data.tags) ? data.tags : [],
        socialSource: data.socialSource ? sanitize(data.socialSource, 50) : null,
        socialPostUrl: data.socialPostUrl ? sanitize(data.socialPostUrl, 500) : null,
        beforeAfterId: data.beforeAfterId ? sanitize(data.beforeAfterId, 100) : null,
        beforeAfterType: data.beforeAfterType ? sanitize(data.beforeAfterType, 20) : null,
        status: 'pending',
        voteCount: 0,
        reportCount: 0,
        submittedAt: new Date(),
        moderatedAt: null,
      };

      const inserted = await wixData.insert('UGCPhotos', record);
      return { success: true, data: inserted };
    } catch (err) {
      console.error('[ugcService] Error submitting UGC photo:', err);
      return { success: false, error: 'Failed to submit photo.' };
    }
  }
);

/**
 * Get approved and featured photos for gallery display.
 *
 * @param {Object} opts - Query options.
 * @param {string} [opts.roomType] - Filter by room type.
 * @param {Array<string>} [opts.tags] - Filter by tags (hasSome).
 * @param {string} [opts.sort='recent'] - Sort order: 'recent' or 'votes'.
 * @param {number} [opts.limit=20] - Max results (clamped 1-50).
 * @returns {Promise<{success: boolean, photos: Array, totalCount: number}>}
 */
export const getApprovedPhotos = webMethod(
  Permissions.Anyone,
  async (opts = {}) => {
    try {
      const options = opts || {};
      let query = wixData.query('UGCPhotos')
        .hasSome('status', ['approved', 'featured']);

      if (options.roomType) {
        const cleanRoom = sanitize(options.roomType, 50);
        if (cleanRoom) {
          query = query.eq('roomType', cleanRoom);
        }
      }

      if (Array.isArray(options.tags) && options.tags.length > 0) {
        query = query.hasSome('tags', options.tags);
      }

      const sortType = sanitize(options.sort || 'recent', 20);
      if (sortType === 'votes') {
        query = query.descending('voteCount');
      } else {
        query = query.descending('submittedAt');
      }

      const limit = Math.max(1, Math.min(50, Math.round(Number(options.limit) || 20)));
      const result = await query.limit(limit).find();

      return {
        success: true,
        photos: result.items,
        totalCount: result.totalCount,
      };
    } catch (err) {
      console.error('[ugcService] Error getting approved photos:', err);
      return { success: false, error: 'Failed to load photos.', photos: [], totalCount: 0 };
    }
  }
);

/**
 * Get before/after photo pairs for transformation gallery.
 *
 * @param {Object} opts - Query options.
 * @param {string} [opts.roomType] - Filter by room type.
 * @returns {Promise<{success: boolean, pairs: Array<{pairId: string, before: Object, after: Object}>}>}
 */
export const getBeforeAfterPairs = webMethod(
  Permissions.Anyone,
  async (opts = {}) => {
    try {
      const options = opts || {};
      let query = wixData.query('UGCPhotos')
        .hasSome('status', ['approved', 'featured'])
        .ne('beforeAfterType', null);

      if (options.roomType) {
        const cleanRoom = sanitize(options.roomType, 50);
        if (cleanRoom) {
          query = query.eq('roomType', cleanRoom);
        }
      }

      const result = await query.limit(200).find();
      const items = result.items;

      // Group by beforeAfterId
      const groups = {};
      for (const item of items) {
        if (!item.beforeAfterId) continue;
        if (!groups[item.beforeAfterId]) {
          groups[item.beforeAfterId] = {};
        }
        groups[item.beforeAfterId][item.beforeAfterType] = item;
      }

      // Only return complete pairs (both before and after exist)
      const pairs = [];
      for (const pairId of Object.keys(groups)) {
        const group = groups[pairId];
        if (group.before && group.after) {
          pairs.push({
            pairId,
            before: group.before,
            after: group.after,
          });
        }
      }

      return { success: true, pairs };
    } catch (err) {
      console.error('[ugcService] Error getting before/after pairs:', err);
      return { success: false, error: 'Failed to load before/after pairs.', pairs: [] };
    }
  }
);

/**
 * Toggle vote on a photo. Adds vote if not yet voted, removes if already voted.
 *
 * @param {string} photoId - ID of the photo to vote on.
 * @returns {Promise<{success: boolean, voted?: boolean, voteCount?: number, error?: string}>}
 */
export const voteForPhoto = webMethod(
  Permissions.SiteMember,
  async (photoId) => {
    try {
      const member = await currentMember.getMember();
      if (!member) {
        return { success: false, error: 'Authentication required.' };
      }

      const cleanId = validateId(photoId);
      if (!cleanId) {
        return { success: false, error: 'Valid photo ID is required.' };
      }

      const photo = await wixData.get('UGCPhotos', cleanId);
      if (!photo) {
        return { success: false, error: 'Photo not found.' };
      }

      // Check for existing vote
      const existingVotes = await wixData.query('UGCVotes')
        .eq('memberId', member._id)
        .eq('photoId', cleanId)
        .find();

      let voted;
      let voteCount;

      if (existingVotes.items.length > 0) {
        // Remove vote (toggle off)
        await wixData.remove('UGCVotes', existingVotes.items[0]._id);
        photo.voteCount = (photo.voteCount || 0) - 1;
        await wixData.update('UGCPhotos', photo);
        voted = false;
        voteCount = photo.voteCount;
      } else {
        // Add vote (toggle on)
        await wixData.insert('UGCVotes', {
          memberId: member._id,
          photoId: cleanId,
          createdAt: new Date(),
        });
        photo.voteCount = (photo.voteCount || 0) + 1;
        await wixData.update('UGCPhotos', photo);
        voted = true;
        voteCount = photo.voteCount;
      }

      return { success: true, voted, voteCount };
    } catch (err) {
      console.error('[ugcService] Error voting for photo:', err);
      return { success: false, error: 'Failed to process vote.' };
    }
  }
);

/**
 * Report a photo for inappropriate content.
 *
 * @param {string} photoId - ID of the photo to report.
 * @param {string} reason - Reason for the report (required, non-empty).
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const reportPhoto = webMethod(
  Permissions.SiteMember,
  async (photoId, reason) => {
    try {
      const member = await currentMember.getMember();
      if (!member) {
        return { success: false, error: 'Authentication required.' };
      }

      const cleanId = validateId(photoId);
      if (!cleanId) {
        return { success: false, error: 'Valid photo ID is required.' };
      }

      const cleanReason = sanitize(reason, 500);
      if (!cleanReason) {
        return { success: false, error: 'Report reason is required.' };
      }

      const photo = await wixData.get('UGCPhotos', cleanId);
      if (!photo) {
        return { success: false, error: 'Photo not found.' };
      }

      photo.reportCount = (photo.reportCount || 0) + 1;
      await wixData.update('UGCPhotos', photo);

      return { success: true };
    } catch (err) {
      console.error('[ugcService] Error reporting photo:', err);
      return { success: false, error: 'Failed to report photo.' };
    }
  }
);

/**
 * Moderate a photo (approve, reject, or feature). Admin only.
 *
 * @param {string} photoId - ID of the photo to moderate.
 * @param {string} action - Moderation action: 'approve'|'reject'|'feature'.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const moderatePhoto = webMethod(
  Permissions.Admin,
  async (photoId, action) => {
    try {
      const member = await currentMember.getMember();
      if (!member) {
        return { success: false, error: 'Authentication required.' };
      }

      // Check admin role
      const roles = await currentMember.getRoles();
      const isAdmin = Array.isArray(roles) && roles.some(
        (r) => r.title === 'Admin' || r._id === 'admin'
      );
      if (!isAdmin) {
        return { success: false, error: 'Admin access required.' };
      }

      const cleanId = validateId(photoId);
      if (!cleanId) {
        return { success: false, error: 'Valid photo ID is required.' };
      }

      const cleanAction = sanitize(action, 20);
      if (!VALID_MODERATION_ACTIONS.includes(cleanAction)) {
        return { success: false, error: 'Invalid action. Must be approve, reject, or feature.' };
      }

      const photo = await wixData.get('UGCPhotos', cleanId);
      if (!photo) {
        return { success: false, error: 'Photo not found.' };
      }

      photo.status = ACTION_TO_STATUS[cleanAction];
      photo.moderatedAt = new Date();
      await wixData.update('UGCPhotos', photo);

      return { success: true };
    } catch (err) {
      console.error('[ugcService] Error moderating photo:', err);
      return { success: false, error: 'Failed to moderate photo.' };
    }
  }
);

/**
 * Get UGC gallery statistics — total approved/featured count, featured count,
 * and breakdown by room type.
 *
 * @returns {Promise<{success: boolean, stats: {total: number, featured: number, byRoomType: Object}}>}
 */
export const getUGCStats = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await wixData.query('UGCPhotos')
        .hasSome('status', ['approved', 'featured'])
        .limit(1000)
        .find();

      const photos = result.items;
      const total = photos.length;
      const featured = photos.filter((p) => p.status === 'featured').length;

      const byRoomType = {};
      for (const photo of photos) {
        if (photo.roomType) {
          byRoomType[photo.roomType] = (byRoomType[photo.roomType] || 0) + 1;
        }
      }

      return {
        success: true,
        stats: { total, featured, byRoomType },
      };
    } catch (err) {
      console.error('[ugcService] Error getting UGC stats:', err);
      return {
        success: false,
        error: 'Failed to load stats.',
        stats: { total: 0, featured: 0, byRoomType: {} },
      };
    }
  }
);
