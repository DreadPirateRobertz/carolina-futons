// RoomGallery.js — Customer Room Gallery (UGC) for /rooms page
//
// Element nicknames:
//   roomGallerySection      — container section (expand/collapse)
//   roomGalleryEmptyState   — shown when no photos
//   roomGalleryRepeater     — photo repeater
//   roomGalleryImage        — per-item: photo image
//   roomGalleryCaption      — per-item: caption text
//   roomGallerySubmitter    — per-item: member display name
//   roomGalleryLikeBtn      — per-item: like/vote button
//   roomGalleryLikeCount    — per-item: vote count text
//   roomFilterAll           — filter tab: all
//   roomFilterLivingRoom    — filter tab: living-room
//   roomFilterBedroom       — filter tab: bedroom
//   roomFilterOffice        — filter tab: office
//   roomFilterDorm          — filter tab: dorm
//   roomFilterPorch         — filter tab: porch
//   roomSubmitBtn           — UGC submission form submit button
//   roomPhotoUpload         — UGC submission: photo upload
//   roomCaptionInput        — UGC submission: caption text input
//   roomRoomTypeDropdown    — UGC submission: room type dropdown
//   roomSubmitStatus        — UGC submission: status message

import { voteForPhoto, submitUGCPhoto, getApprovedPhotos } from 'backend/ugcService.web';
import { logError } from 'backend/errorMonitoring.web';
import { trackEvent } from 'public/engagementTracker';

const FILTER_TABS = [
  { id: '#roomFilterAll',        roomType: null },
  { id: '#roomFilterLivingRoom', roomType: 'living-room' },
  { id: '#roomFilterBedroom',    roomType: 'bedroom' },
  { id: '#roomFilterOffice',     roomType: 'office' },
  { id: '#roomFilterDorm',       roomType: 'dorm' },
  { id: '#roomFilterPorch',      roomType: 'porch' },
];

// ── renderRoomPhotos ──────────────────────────────────────────────────

/**
 * Render the photo repeater. Expands/collapses gallery section based on
 * whether photos are present. Does NOT register onItemReady — that must be
 * done once via initRoomGallery to avoid Wix Velo handler stacking.
 *
 * @param {Function} $w
 * @param {Array|null} photos
 */
export function renderRoomPhotos($w, photos) {
  const list = Array.isArray(photos) && photos.length > 0 ? photos : null;

  if (!list) {
    $w('#roomGallerySection').collapse();
    $w('#roomGalleryEmptyState').expand();
    $w('#roomGalleryRepeater').data = [];
    return;
  }

  $w('#roomGalleryEmptyState').collapse();
  $w('#roomGalleryRepeater').data = list;
  $w('#roomGallerySection').expand();
}

// ── initRoomFilter ────────────────────────────────────────────────────

/**
 * Wire filter tab click handlers.
 *
 * @param {Function} $w
 * @param {Function|null} onFilterChange - called with roomType string or null
 */
export function initRoomFilter($w, onFilterChange) {
  for (const { id, roomType } of FILTER_TABS) {
    $w(id).onClick(() => {
      if (typeof onFilterChange === 'function') {
        return onFilterChange(roomType);
      }
    });
  }
}

// ── initRoomSubmitForm ────────────────────────────────────────────────

/**
 * Wire the UGC photo submission form.
 *
 * @param {Function} $w
 */
export function initRoomSubmitForm($w) {
  $w('#roomSubmitBtn').onClick(async () => {
    const photoUrl = $w('#roomPhotoUpload').value;
    const caption  = $w('#roomCaptionInput').value;
    const roomType = $w('#roomRoomTypeDropdown').value;

    if (!photoUrl) {
      $w('#roomSubmitStatus').text = 'Please upload a photo.';
      return;
    }
    if (!caption) {
      $w('#roomSubmitStatus').text = 'Please add a caption.';
      return;
    }
    if (!roomType) {
      $w('#roomSubmitStatus').text = 'Please select a room type.';
      return;
    }

    $w('#roomSubmitBtn').disable();
    try {
      const result = await submitUGCPhoto({ photoUrl, caption, roomType });
      if (result && result.success) {
        $w('#roomSubmitStatus').text = 'Thank you! Your photo has been submitted.';
      } else {
        const msg = (result && result.error) ? result.error : 'Submission failed.';
        $w('#roomSubmitStatus').text = msg;
      }
    } catch (err) {
      logError({ message: '[RoomGallery] submitUGCPhoto failed', stack: err?.stack, context: 'roomGallery.submitUGCPhoto' });
      $w('#roomSubmitStatus').text = 'An error occurred. Please try again.';
    } finally {
      $w('#roomSubmitBtn').enable();
    }
  });
}

// ── initRoomGallery ───────────────────────────────────────────────────

/**
 * Orchestrate the full Room Gallery section.
 *
 * Registers onItemReady ONCE so that repeated renderRoomPhotos calls (e.g. on
 * filter change) never stack duplicate handlers in Wix Velo.
 *
 * @param {Function} $w
 * @param {{ photos?: Array }} opts
 */
export function initRoomGallery($w, opts = {}) {
  const { photos = [] } = opts ?? {};

  // Register the repeater item handler exactly once. Wix Velo stacks handlers
  // rather than replacing them, so this must not be called on re-renders.
  $w('#roomGalleryRepeater').onItemReady(($item, itemData) => {
    $item('#roomGalleryImage').src = itemData.photoUrl || '';
    $item('#roomGalleryImage').alt = itemData.caption || 'Customer room photo';
    $item('#roomGalleryCaption').text = itemData.caption || '';
    $item('#roomGallerySubmitter').text = itemData.memberDisplayName || '';

    const originalCount = String(itemData.voteCount ?? 0);
    $item('#roomGalleryLikeCount').text = originalCount;
    $item('#roomGalleryLikeBtn').accessibility.ariaPressed = false;
    $item('#roomGalleryLikeBtn').accessibility.ariaLabel = `Like photo by ${itemData.memberDisplayName || 'member'}`;

    $item('#roomGalleryLikeBtn').onClick(async () => {
      try {
        const result = await voteForPhoto(itemData._id);
        if (result && result.success) {
          $item('#roomGalleryLikeCount').text = String(result.voteCount ?? 0);
          $item('#roomGalleryLikeBtn').accessibility.ariaPressed = !!result.voted;
        }
      } catch (err) {
        logError({ message: '[RoomGallery] voteForPhoto failed', stack: err?.stack, context: 'roomGallery.voteForPhoto' });
        $item('#roomGalleryLikeCount').text = originalCount;
      }
    });
  });

  renderRoomPhotos($w, photos);

  initRoomFilter($w, async (roomType) => {
    try {
      const result = await getApprovedPhotos(roomType ? { roomType } : {});
      const filtered = (result && Array.isArray(result.photos)) ? result.photos : [];
      renderRoomPhotos($w, filtered);
    } catch (err) {
      logError({ message: '[RoomGallery] filter re-query failed', stack: err?.stack, context: 'roomGallery.filter' });
    }
  });

  initRoomSubmitForm($w);
}
