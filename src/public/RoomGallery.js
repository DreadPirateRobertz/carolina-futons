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

import { voteForPhoto, submitUGCPhoto } from 'backend/ugcService.web';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers.js';

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
 * whether photos are present.
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

  $w('#roomGalleryRepeater').onItemReady(($item, itemData) => {
    $item('#roomGalleryImage').src = itemData.photoUrl || '';
    $item('#roomGalleryImage').alt = itemData.caption || 'Customer room photo';
    $item('#roomGalleryCaption').text = itemData.caption || '';
    $item('#roomGallerySubmitter').text = itemData.memberDisplayName || '';
    $item('#roomGalleryLikeCount').text = String(itemData.voteCount ?? 0);

    $item('#roomGalleryLikeBtn').onClick(async () => {
      try {
        const result = await voteForPhoto(itemData._id);
        if (result && result.success) {
          $item('#roomGalleryLikeCount').text = String(result.voteCount ?? 0);
        }
      } catch (err) {
        console.error('[RoomGallery] voteForPhoto failed:', err);
      }
    });
  });

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
        onFilterChange(roomType);
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
      console.error('[RoomGallery] submitUGCPhoto failed:', err);
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
 * @param {Function} $w
 * @param {{ photos?: Array }} opts
 */
export function initRoomGallery($w, opts = {}) {
  const { photos = [] } = opts ?? {};

  renderRoomPhotos($w, photos);

  initRoomFilter($w, (roomType) => {
    // Filter callback — re-render with filtered photos when implemented.
    // Noop here; caller provides onFilterChange via initRoomFilter if needed.
  });

  initRoomSubmitForm($w);
}
