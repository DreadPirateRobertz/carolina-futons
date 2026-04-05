/**
 * @module customerRoomPhotos
 * @description Real Rooms UGC photo service for the CustomerRoomPhotos
 * collection. Cross-platform schema agreed with dallas (cfutons_mobile).
 *
 * Scope note: ugcService.web.js (CF-rr8d) manages the older UGCPhotos
 * collection with voting, reporting, and before/after pairs for the standalone
 * UGC Gallery page. This module covers the agreed cross-platform
 * CustomerRoomPhotos schema used by the PDP gallery and Real Rooms page —
 * simpler surface, no vote toggle, one-way likes deduped via RoomPhotoLikes.
 *
 * Web methods:
 *   submitRoomPhoto      — SiteMember  — submit photo for moderation
 *   getProductRoomPhotos — Anyone      — approved photos for a product (PDP)
 *   getAllRoomPhotos      — Anyone      — paginated gallery (Real Rooms page)
 *   likeRoomPhoto        — SiteMember  — one-way like, deduped via RoomPhotoLikes
 *   moderateRoomPhoto    — Admin       — approve / reject
 *
 * @setup
 * Create `CustomerRoomPhotos` CMS collection:
 *   _id (auto), memberId (Text, indexed), memberDisplayName (Text),
 *   memberEmail (Text),
 *   photoUrl (Text), caption (Text, max 200),
 *   productId (Text, indexed, nullable), productName (Text),
 *   roomType (Text, indexed),
 *   status (Text, indexed) — pending|approved|rejected|featured,
 *   submittedAt (DateTime, indexed), approvedAt (DateTime, nullable),
 *   moderatorNotes (Text), likes (Number),
 *   slug (Text, unique, indexed)
 *
 * Create `RoomPhotoLikes` CMS collection:
 *   memberId (Text, indexed), photoId (Text, indexed), createdAt (DateTime)
 *   REQUIRED: unique constraint on (memberId, photoId) to prevent duplicate
 *   likes under concurrent requests (TOCTOU).
 *
 * CF-rw9i
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, isWixMediaUrl } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';
import { logAuditEvent } from 'backend/utils/auditLog';
import { checkRateLimit } from 'backend/utils/rateLimit';

// ── Constants ─────────────────────────────────────────────────────────────────

const COLLECTION        = 'CustomerRoomPhotos';
const LIKES_COLLECTION  = 'RoomPhotoLikes';
const VALID_ROOM_TYPES  = ['living-room', 'bedroom', 'office', 'dorm', 'porch', 'other'];
const APPROVED_STATUSES = ['approved', 'featured'];
const MAX_CAPTION_LENGTH = 200;
const GALLERY_MAX_LIMIT  = 50;

// ── submitRoomPhoto ───────────────────────────────────────────────────────────

/**
 * Submit a room photo for moderation.
 *
 * @param {Object} data
 * @param {string} data.photoUrl      - Wix media URL of uploaded photo
 * @param {string} data.caption       - Optional caption (max 200 chars)
 * @param {string|null} data.productId   - Associated product ID (nullable)
 * @param {string|null} data.productName - Associated product name (nullable)
 * @param {string} data.roomType      - One of VALID_ROOM_TYPES
 * @param {string} memberId           - Authenticated member ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const submitRoomPhoto = webMethod(
  Permissions.SiteMember,
  async (data, memberId) => {
    try {
      if (!memberId) {
        return { success: false, error: 'Authentication required.' };
      }

      // CF-rr8d: Validate BEFORE sanitize — sanitize() strips HTML tags which
      // could transform a crafted URL (e.g. javascript: URI) into one that
      // passes a post-sanitize check.
      const rawPhotoUrl = ((data && data.photoUrl) || '').trim();
      if (!rawPhotoUrl) {
        return { success: false, error: 'Photo URL is required.' };
      }
      if (!isWixMediaUrl(rawPhotoUrl)) {
        return { success: false, error: 'Photo must be uploaded through the site upload form.' };
      }
      const cleanPhotoUrl = sanitize(rawPhotoUrl, 500);

      const roomType = sanitize((data && data.roomType) || '', 50);
      if (!VALID_ROOM_TYPES.includes(roomType)) {
        return { success: false, error: `Invalid room type. Must be one of: ${VALID_ROOM_TYPES.join(', ')}.` };
      }

      const caption     = sanitize((data && data.caption) || '', MAX_CAPTION_LENGTH);
      const productId   = (data && data.productId)   ? sanitize(data.productId, 50)   : null;
      const productName = (data && data.productName)  ? sanitize(data.productName, 200) : null;

      // Rate limit: 5 submissions per day per member
      const { allowed } = await checkRateLimit('CustomerRoomPhotosRateLimit', memberId, {
        max: 5, windowMs: 24 * 60 * 60 * 1000,
      });
      if (!allowed) {
        return { success: false, error: 'Submission limit reached. Please try again tomorrow.' };
      }

      // Resolve member display name and email
      let memberDisplayName = 'Customer';
      let memberEmail = '';
      try {
        const { currentMember } = await import('wix-members-backend');
        const member = await currentMember.getMember();
        if (member?.contactDetails?.firstName) {
          const last = (member.contactDetails.lastName || '').charAt(0);
          memberDisplayName = last
            ? `${member.contactDetails.firstName} ${last}.`
            : member.contactDetails.firstName;
        }
        if (member?.loginEmail) {
          memberEmail = member.loginEmail;
        }
      } catch (memberErr) {
        logError('customerRoomPhotos.submitRoomPhoto.getMember', memberErr);
      }

      // Generate slug: roomType + productName (if any) + base36 timestamp
      const slugBase = [roomType, productName]
        .filter(Boolean)
        .join('-')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
      const slug = `${slugBase}-${Date.now().toString(36)}`;

      const photo = await wixData.insert(COLLECTION, {
        memberId,
        memberDisplayName: sanitize(memberDisplayName, 100),
        memberEmail:       sanitize(memberEmail, 200),
        photoUrl:          cleanPhotoUrl,
        caption,
        productId,
        productName,
        roomType,
        status:            'pending',
        submittedAt:       new Date(),
        approvedAt:        null,
        moderatorNotes:    '',
        likes:             0,
        slug,
      }, { suppressAuth: true });

      logAuditEvent(COLLECTION, 'submit', memberId, {
        photoId: photo._id,
        roomType,
        productId,
      });

      return {
        success: true,
        data: {
          _id:    photo._id,
          slug,
          status: 'pending',
        },
      };
    } catch (err) {
      logError('customerRoomPhotos.submitRoomPhoto', err);
      return { success: false, error: 'Failed to submit photo.' };
    }
  }
);

// ── getProductRoomPhotos ──────────────────────────────────────────────────────

/**
 * Get approved/featured photos for a specific product (used by PDP gallery).
 *
 * @param {string} productId
 * @param {Object} [opts]
 * @param {number} [opts.limit=20]
 * @param {number} [opts.skip=0]
 * @returns {Promise<{success: boolean, photos: Object[], total: number}>}
 */
export const getProductRoomPhotos = webMethod(
  Permissions.Anyone,
  async (productId, { limit = 20, skip = 0 } = {}) => {
    try {
      const cleanId = sanitize(productId || '', 50);
      if (!cleanId) return { success: false, photos: [], total: 0 };

      const safeLimit = Math.min(Math.max(1, limit), GALLERY_MAX_LIMIT);
      const safeSkip  = Math.max(0, skip);

      const result = await wixData.query(COLLECTION)
        .eq('productId', cleanId)
        .hasSome('status', APPROVED_STATUSES)
        .descending('submittedAt')
        .limit(safeLimit)
        .skip(safeSkip)
        .find({ suppressAuth: true });

      return {
        success: true,
        photos:  result.items.map(toPublicPhoto),
        total:   result.totalCount,
      };
    } catch (err) {
      logError('customerRoomPhotos.getProductRoomPhotos', err);
      return { success: false, photos: [], total: 0 };
    }
  }
);

// ── getAllRoomPhotos ───────────────────────────────────────────────────────────

/**
 * Get approved/featured photos across all products (gallery page).
 *
 * @param {Object} [opts]
 * @param {number} [opts.limit=20]
 * @param {number} [opts.skip=0]
 * @param {string} [opts.roomType] - Optional room type filter
 * @returns {Promise<{success: boolean, photos: Object[], total: number}>}
 */
export const getAllRoomPhotos = webMethod(
  Permissions.Anyone,
  async ({ limit = 20, skip = 0, roomType } = {}) => {
    try {
      const safeLimit = Math.min(Math.max(1, limit), GALLERY_MAX_LIMIT);
      const safeSkip  = Math.max(0, skip);

      let query = wixData.query(COLLECTION)
        .hasSome('status', APPROVED_STATUSES)
        .descending('submittedAt')
        .limit(safeLimit)
        .skip(safeSkip);

      if (roomType && VALID_ROOM_TYPES.includes(roomType)) {
        query = query.eq('roomType', roomType);
      }

      const result = await query.find({ suppressAuth: true });

      return {
        success: true,
        photos:  result.items.map(toPublicPhoto),
        total:   result.totalCount,
      };
    } catch (err) {
      logError('customerRoomPhotos.getAllRoomPhotos', err);
      return { success: false, photos: [], total: 0 };
    }
  }
);

// ── likeRoomPhoto ─────────────────────────────────────────────────────────────

/**
 * Like an approved/featured photo. One like per member per photo.
 * Deduplication is enforced via the RoomPhotoLikes collection (unique
 * constraint on memberId+photoId). A duplicate insert error from a concurrent
 * request is treated as "already liked" rather than a failure (TOCTOU guard).
 *
 * @param {string} photoId
 * @returns {Promise<{success: boolean, likes?: number, alreadyLiked?: boolean, error?: string}>}
 */
export const likeRoomPhoto = webMethod(
  Permissions.SiteMember,
  async (photoId) => {
    try {
      const { currentMember } = await import('wix-members-backend');
      const member = await currentMember.getMember();
      if (!member) {
        return { success: false, error: 'Authentication required.' };
      }

      const cleanId = sanitize(photoId || '', 50);
      if (!cleanId) {
        return { success: false, error: 'Valid photo ID is required.' };
      }
      const photo = await wixData.get(COLLECTION, cleanId, { suppressAuth: true });
      if (!photo) {
        return { success: false, error: 'Photo not found.' };
      }
      if (!APPROVED_STATUSES.includes(photo.status)) {
        return { success: false, error: 'Photo is not available for liking.' };
      }

      // Pre-check: return early with alreadyLiked if record exists
      const existing = await wixData.query(LIKES_COLLECTION)
        .eq('memberId', member._id)
        .eq('photoId', cleanId)
        .find({ suppressAuth: true });

      if (existing.items.length > 0) {
        return { success: true, alreadyLiked: true, likes: Number(photo.likes) || 0 };
      }

      // Insert like record — unique constraint catches concurrent duplicate inserts
      try {
        await wixData.insert(LIKES_COLLECTION, {
          memberId:  member._id,
          photoId:   cleanId,
          createdAt: new Date(),
        }, { suppressAuth: true });
      } catch (dupErr) {
        const msg = dupErr?.message || '';
        if (msg.includes('duplicate') || msg.includes('unique')) {
          return { success: true, alreadyLiked: true, likes: Number(photo.likes) || 0 };
        }
        throw dupErr;
      }

      const newLikes = (Number(photo.likes) || 0) + 1;
      await wixData.update(COLLECTION, { ...photo, likes: newLikes }, { suppressAuth: true });

      return { success: true, alreadyLiked: false, likes: newLikes };
    } catch (err) {
      logError('customerRoomPhotos.likeRoomPhoto', err);
      return { success: false, error: 'Failed to like photo.' };
    }
  }
);

// ── moderateRoomPhoto ─────────────────────────────────────────────────────────

/**
 * Approve or reject a pending room photo (admin only).
 *
 * @param {string} photoId
 * @param {'approve'|'reject'} action
 * @param {string} [notes] - Optional moderator notes
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const moderateRoomPhoto = webMethod(
  Permissions.Admin,
  async (photoId, action, notes = '') => {
    try {
      const VALID_ACTIONS = ['approve', 'reject'];
      if (!VALID_ACTIONS.includes(action)) {
        return { success: false, error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}.` };
      }

      const cleanId = sanitize(photoId || '', 50);
      if (!cleanId) {
        return { success: false, error: 'Valid photo ID is required.' };
      }
      const photo = await wixData.get(COLLECTION, cleanId, { suppressAuth: true });
      if (!photo) {
        return { success: false, error: 'Photo not found.' };
      }
      if (photo.status !== 'pending') {
        return { success: false, error: `Photo is already ${photo.status}.` };
      }

      const targetStatus = action === 'approve' ? 'approved' : 'rejected';

      await wixData.update(COLLECTION, {
        ...photo,
        status:         targetStatus,
        approvedAt:     action === 'approve' ? new Date() : null,
        moderatorNotes: sanitize(notes || '', 500),
      }, { suppressAuth: true });

      // Resolve actual moderator identity for audit trail
      let moderatorId = 'admin';
      try {
        const { currentMember } = await import('wix-members-backend');
        const mod = await currentMember.getMember();
        if (mod?._id) moderatorId = mod._id;
      } catch (modErr) {
        logError('customerRoomPhotos.moderateRoomPhoto.getMember', modErr);
      }

      logAuditEvent(COLLECTION, action, moderatorId, { photoId: cleanId, memberId: photo.memberId });
      return { success: true };
    } catch (err) {
      logError('customerRoomPhotos.moderateRoomPhoto', err);
      return { success: false, error: 'Failed to moderate photo.' };
    }
  }
);

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Strip private fields (memberId, memberEmail) before returning to public callers.
 */
function toPublicPhoto(item) {
  return {
    _id:               item._id,
    photoUrl:          item.photoUrl,
    caption:           item.caption,
    productId:         item.productId,
    productName:       item.productName,
    roomType:          item.roomType,
    memberDisplayName: item.memberDisplayName,
    status:            item.status,
    submittedAt:       item.submittedAt,
    likes:             item.likes || 0,
    slug:              item.slug,
  };
}

// ── Test exports ──────────────────────────────────────────────────────────────

export const _COLLECTION        = COLLECTION;
export const _LIKES_COLLECTION  = LIKES_COLLECTION;
export const _VALID_ROOM_TYPES  = VALID_ROOM_TYPES;
export const _MAX_CAPTION_LENGTH = MAX_CAPTION_LENGTH;
