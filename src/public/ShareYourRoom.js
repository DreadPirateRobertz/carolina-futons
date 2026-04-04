/**
 * ShareYourRoom.js — "Share your room" UGC photo submit CTA on the PDP.
 *
 * Wires a "Share your room" button on the Product Detail Page that expands an
 * inline photo-submission modal. Members upload a photo, pick a room type,
 * optionally add a caption, then submit — calling submitUGCPhoto from the
 * UGC service. Non-members see the modal in a disabled/sign-in-prompt state.
 *
 * Editor element IDs required on the Product Page:
 *   #shareYourRoomBtn          — CTA trigger button (visible to all)
 *   #shareYourRoomModal        — Container/box that wraps the modal (collapsed by default)
 *   #shareYourRoomOverlay      — Full-screen overlay behind modal (for click-to-close)
 *   #shareYourRoomClose        — Close (×) button inside modal
 *   #shareYourRoomUpload       — Wix UploadButton element (fileType = 'Image')
 *   #shareYourRoomPreview      — Image element (hidden until file chosen)
 *   #shareYourRoomRoomType     — Dropdown element for room type selection
 *   #shareYourRoomCaption      — TextInput for optional caption
 *   #shareYourRoomSubmitBtn    — Submit button
 *   #shareYourRoomForm         — Section containing form controls (collapsed on success)
 *   #shareYourRoomSuccess      — Success confirmation section (collapsed by default)
 *   #shareYourRoomValidation   — Text element for inline validation/error messages
 *   #shareYourRoomLoginPrompt  — Section shown to non-members (collapsed for members)
 *
 * @module public/ShareYourRoom
 * @requires backend/ugcService.web
 * @requires public/a11yHelpers
 * @requires public/engagementTracker
 */
import { submitUGCPhoto } from 'backend/ugcService.web';
import { announce } from 'public/a11yHelpers';
import { trackEvent } from 'public/engagementTracker';

const VALID_ROOM_TYPES = [
  { value: 'living-room', label: 'Living Room' },
  { value: 'bedroom',     label: 'Bedroom' },
  { value: 'office',      label: 'Office' },
  { value: 'dorm',        label: 'Dorm' },
  { value: 'porch',       label: 'Porch' },
];

// ── Module state ──────────────────────────────────────────────────────────────

let _uploadedFileUrl = null;  // Wix media URL after successful upload
let _isOpen = false;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Wire up the "Share your room" CTA on the Product Detail Page.
 *
 * @param {Function} $w - Wix element selector
 * @param {Object}   state - PDP state object
 * @param {Object}   [state.product] - Current product
 * @param {string}   [state.product._id] - Product ID (pre-fills submission)
 * @param {string}   [state.product.name] - Product name (pre-fills submission)
 * @param {boolean}  [state.isLoggedIn] - Whether the current visitor is a member
 */
export function initShareYourRoomCTA($w, state) {
  // Reset upload state on every PDP load
  _uploadedFileUrl = null;
  _isOpen = false;

  const product = (state && state.product) || {};

  // Populate room type dropdown options
  try {
    $w('#shareYourRoomRoomType').options = VALID_ROOM_TYPES.map(rt => ({
      label: rt.label,
      value: rt.value,
    }));
  } catch (e) { /* element may not exist yet */ }

  // Collapse modal + success sections on init
  try { $w('#shareYourRoomModal').collapse(); } catch (e) {}
  try { $w('#shareYourRoomSuccess').collapse(); } catch (e) {}
  try { $w('#shareYourRoomValidation').collapse(); } catch (e) {}
  try { $w('#shareYourRoomPreview').collapse(); } catch (e) {}
  try { $w('#shareYourRoomLoginPrompt').collapse(); } catch (e) {}
  try { $w('#shareYourRoomSubmitBtn').disable(); } catch (e) {}

  // CTA button → open modal
  try {
    $w('#shareYourRoomBtn').onClick(() => openModal($w, state));
  } catch (e) {
    console.warn('[ShareYourRoom] #shareYourRoomBtn not found');
  }

  // Close via overlay or × button
  try { $w('#shareYourRoomOverlay').onClick(() => closeModal($w)); } catch (e) {}
  try { $w('#shareYourRoomClose').onClick(() => closeModal($w)); } catch (e) {}

  // Upload button — handle file selection + upload
  try {
    $w('#shareYourRoomUpload').fileType = 'Image';
    $w('#shareYourRoomUpload').onChange(() => handleUploadChange($w));
  } catch (e) {
    console.warn('[ShareYourRoom] #shareYourRoomUpload not found');
  }

  // Room type dropdown — refresh submit button state
  try {
    $w('#shareYourRoomRoomType').onChange(() => refreshSubmitState($w));
  } catch (e) {}

  // Submit button
  try {
    $w('#shareYourRoomSubmitBtn').onClick(() =>
      handleSubmit($w, product)
    );
  } catch (e) {
    console.warn('[ShareYourRoom] #shareYourRoomSubmitBtn not found');
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function openModal($w, state) {
  _isOpen = true;
  _uploadedFileUrl = null;

  // Reset form to clean state
  try { $w('#shareYourRoomForm').expand(); } catch (e) {}
  try { $w('#shareYourRoomSuccess').collapse(); } catch (e) {}
  try { $w('#shareYourRoomValidation').collapse(); } catch (e) {}
  try { $w('#shareYourRoomPreview').collapse(); } catch (e) {}
  try { $w('#shareYourRoomCaption').value = ''; } catch (e) {}
  try { $w('#shareYourRoomRoomType').value = undefined; } catch (e) {}
  try { $w('#shareYourRoomSubmitBtn').disable(); } catch (e) {}

  // Show login prompt for non-members, hide for members
  const isLoggedIn = state && state.isLoggedIn;
  try {
    if (isLoggedIn) {
      $w('#shareYourRoomLoginPrompt').collapse();
    } else {
      $w('#shareYourRoomLoginPrompt').expand();
      try { $w('#shareYourRoomUpload').disable(); } catch (e2) {}
    }
  } catch (e) {}

  try { $w('#shareYourRoomModal').expand(); } catch (e) {}
  try { $w('#shareYourRoomOverlay').expand(); } catch (e) {}

  announce('Share your room photo dialog opened');
  trackEvent('ugc_modal_open', {
    productId: state && state.product && state.product._id,
  });
}

function closeModal($w) {
  _isOpen = false;
  try { $w('#shareYourRoomModal').collapse(); } catch (e) {}
  try { $w('#shareYourRoomOverlay').collapse(); } catch (e) {}
  announce('Share your room dialog closed');
}

async function handleUploadChange($w) {
  _uploadedFileUrl = null;
  refreshSubmitState($w);

  let files;
  try {
    files = $w('#shareYourRoomUpload').value;
  } catch (e) {
    return;
  }

  if (!files || files.length === 0) return;

  try {
    $w('#shareYourRoomSubmitBtn').disable();
    const uploaded = await $w('#shareYourRoomUpload').startUpload();
    if (uploaded && uploaded.url) {
      _uploadedFileUrl = uploaded.url;
      try {
        $w('#shareYourRoomPreview').src = uploaded.url;
        $w('#shareYourRoomPreview').expand();
      } catch (e2) {}
      refreshSubmitState($w);
    }
  } catch (err) {
    showValidation($w, 'Upload failed. Please try again.');
    console.error('[ShareYourRoom] Upload error:', err);
  }
}

function refreshSubmitState($w) {
  let roomTypeSelected = false;
  try {
    const val = $w('#shareYourRoomRoomType').value;
    roomTypeSelected = Boolean(val);
  } catch (e) {}

  const ready = Boolean(_uploadedFileUrl) && roomTypeSelected;
  try {
    if (ready) {
      $w('#shareYourRoomSubmitBtn').enable();
    } else {
      $w('#shareYourRoomSubmitBtn').disable();
    }
  } catch (e) {}
}

async function handleSubmit($w, product) {
  hideValidation($w);

  const roomType = getRoomType($w);
  if (!roomType) {
    showValidation($w, 'Please select a room type.');
    return;
  }

  if (!_uploadedFileUrl) {
    showValidation($w, 'Please upload a photo first.');
    return;
  }

  let caption = '';
  try { caption = ($w('#shareYourRoomCaption').value || '').trim(); } catch (e) {}

  try { $w('#shareYourRoomSubmitBtn').disable(); } catch (e) {}

  try {
    const result = await submitUGCPhoto({
      photoUrl:    _uploadedFileUrl,
      roomType,
      caption,
      productId:   product._id   || null,
      productName: product.name  || null,
    });

    if (result && result.success) {
      try { $w('#shareYourRoomForm').collapse(); } catch (e) {}
      try { $w('#shareYourRoomSuccess').expand(); } catch (e) {}
      announce('Photo submitted! It will appear in the gallery after review.');
      trackEvent('ugc_photo_submitted', {
        roomType,
        productId: product._id,
        hasCaption: Boolean(caption),
      });
    } else {
      const msg = (result && result.error) || 'Submission failed. Please try again.';
      showValidation($w, msg);
      try { $w('#shareYourRoomSubmitBtn').enable(); } catch (e) {}
    }
  } catch (err) {
    console.error('[ShareYourRoom] Submit error:', err);
    showValidation($w, 'An error occurred. Please try again.');
    try { $w('#shareYourRoomSubmitBtn').enable(); } catch (e) {}
  }
}

function getRoomType($w) {
  try {
    return $w('#shareYourRoomRoomType').value || null;
  } catch (e) {
    return null;
  }
}

function showValidation($w, message) {
  try {
    $w('#shareYourRoomValidation').text = message;
    $w('#shareYourRoomValidation').expand();
    announce(message);
  } catch (e) {}
}

function hideValidation($w) {
  try { $w('#shareYourRoomValidation').collapse(); } catch (e) {}
}

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Exposed for unit tests only. */
export const _VALID_ROOM_TYPES = VALID_ROOM_TYPES;
export { openModal as _openModal, closeModal as _closeModal };
export function _getUploadedUrl() { return _uploadedFileUrl; }
export function _setUploadedUrl(url) { _uploadedFileUrl = url; }
export function _isModalOpen() { return _isOpen; }
