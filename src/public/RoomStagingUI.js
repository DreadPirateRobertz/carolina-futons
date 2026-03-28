/**
 * RoomStagingUI.js — "See It In Your Room" AI visualization feature.
 *
 * Provides upload → generate → display flow for AI room staging.
 * Renders in a modal overlay on the Product Page.
 *
 * CF-s22f: NOVEL — AI Room Staging
 *
 * Editor elements needed:
 * - #roomStagingBtn — Button: "See It In Your Room" (on product page)
 * - #roomStagingModal — Box: modal overlay container (hidden by default)
 * - #roomStagingUpload — UploadButton: room photo upload
 * - #roomStagingPreview — Image: preview of uploaded room photo
 * - #roomStagingResult — Image: AI-generated staged room
 * - #roomStagingSpinner — Box/Image: loading indicator
 * - #roomStagingError — Text: error message (hidden by default)
 * - #roomStagingClose — Button: close modal
 * - #roomStagingRetry — Button: try different placement
 * - #roomStagingPlacement — Dropdown: center/left/right/replace
 * - #roomStagingShare — Button: share/save result
 */
import { generateStagedRoom, getCachedStaging } from 'backend/roomStaging.web';
import { announce } from 'public/a11yHelpers.js';
import { trackEvent } from 'public/engagementTracker';

/** @type {string|null} Current room image URL after upload */
let _roomImageUrl = null;

/** @type {string|null} Current product ID */
let _productId = null;

/**
 * Initialize the "See It In Your Room" feature on a product page.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} state - Product page state with state.product
 */
export function initRoomStaging($w, state) {
  try {
    const btn = $w('#roomStagingBtn');
    if (!btn) return;

    _productId = state.product?._id;
    if (!_productId) {
      try { btn.collapse(); } catch (e) {}
      return;
    }

    // Show the button
    try {
      btn.label = 'See It In Your Room';
      btn.expand();
    } catch (e) {}

    // Button click → open modal
    btn.onClick(() => {
      trackEvent('room_staging_open', { productId: _productId, productName: state.product?.name });
      openStagingModal($w);
    });

    // Wire modal controls
    initModalControls($w, state);
  } catch (e) {
    console.warn('[RoomStaging] Init failed:', e?.message);
  }
}

/**
 * Open the room staging modal.
 */
function openStagingModal($w) {
  try {
    $w('#roomStagingModal').show('fade', { duration: 200 });
    announce($w, 'Room staging tool opened. Upload a photo of your room.');

    // Reset state
    _roomImageUrl = null;
    try { $w('#roomStagingPreview').collapse(); } catch (e) {}
    try { $w('#roomStagingResult').collapse(); } catch (e) {}
    try { $w('#roomStagingError').collapse(); } catch (e) {}
    try { $w('#roomStagingSpinner').collapse(); } catch (e) {}
    try { $w('#roomStagingRetry').collapse(); } catch (e) {}
    try { $w('#roomStagingShare').collapse(); } catch (e) {}
    try { $w('#roomStagingUpload').expand(); } catch (e) {}
  } catch (e) {}
}

/**
 * Wire modal close, upload, generate, and retry controls.
 */
function initModalControls($w, state) {
  // Close button
  try {
    $w('#roomStagingClose').onClick(() => {
      $w('#roomStagingModal').hide('fade', { duration: 200 });
      announce($w, 'Room staging closed');
    });
  } catch (e) {}

  // Placement dropdown
  try {
    const dropdown = $w('#roomStagingPlacement');
    if (dropdown) {
      dropdown.options = [
        { label: 'Center of room', value: 'center' },
        { label: 'Left side', value: 'left' },
        { label: 'Right side', value: 'right' },
        { label: 'Replace existing furniture', value: 'replace' },
      ];
      dropdown.value = 'replace';
    }
  } catch (e) {}

  // Upload handler
  try {
    $w('#roomStagingUpload').onChange(async () => {
      try {
        const files = await $w('#roomStagingUpload').startUpload();
        if (!files || !files.url) {
          showError($w, 'Upload failed. Please try again.');
          return;
        }

        _roomImageUrl = files.url;
        trackEvent('room_staging_upload', { productId: _productId });

        // Show preview
        try {
          $w('#roomStagingPreview').src = _roomImageUrl;
          $w('#roomStagingPreview').expand();
        } catch (e) {}

        // Auto-generate
        await generateStaging($w, state);
      } catch (e) {
        showError($w, 'Upload failed. Please try a different photo.');
      }
    });
  } catch (e) {}

  // Retry with different placement
  try {
    $w('#roomStagingRetry').onClick(async () => {
      if (!_roomImageUrl) {
        showError($w, 'Please upload a room photo first.');
        return;
      }
      await generateStaging($w, state);
    });
  } catch (e) {}

  // Share/save result
  try {
    $w('#roomStagingShare').onClick(() => {
      try {
        const resultSrc = $w('#roomStagingResult').src;
        if (resultSrc) {
          // Copy URL to clipboard or open share dialog
          import('wix-window-frontend').then(({ copyToClipboard }) => {
            copyToClipboard(resultSrc);
            announce($w, 'Image link copied to clipboard');
          }).catch(() => {});
        }
      } catch (e) {}
    });
  } catch (e) {}
}

/**
 * Generate the AI-staged room image.
 */
async function generateStaging($w, state) {
  if (!_roomImageUrl || !_productId) return;

  const placement = (() => {
    try { return $w('#roomStagingPlacement').value || 'replace'; } catch { return 'replace'; }
  })();

  // Show loading state
  try { $w('#roomStagingSpinner').expand(); } catch (e) {}
  try { $w('#roomStagingResult').collapse(); } catch (e) {}
  try { $w('#roomStagingError').collapse(); } catch (e) {}
  try { $w('#roomStagingRetry').collapse(); } catch (e) {}
  try { $w('#roomStagingShare').collapse(); } catch (e) {}
  announce($w, 'Generating your room visualization. This may take 15-30 seconds.');

  try {
    // Check cache first
    const cached = await getCachedStaging(_roomImageUrl, _productId);
    if (cached.cached && cached.stagedImageUrl) {
      showResult($w, cached.stagedImageUrl, state);
      trackEvent('room_staging_cached', { productId: _productId });
      return;
    }

    // Generate new staging
    const result = await generateStagedRoom(_roomImageUrl, _productId, { placement });

    if (!result.success) {
      showError($w, result.error || 'Generation failed. Please try again.');
      trackEvent('room_staging_error', { productId: _productId, error: result.error });
      return;
    }

    showResult($w, result.stagedImageUrl, state);
    trackEvent('room_staging_success', { productId: _productId, placement });
  } catch (e) {
    showError($w, 'Something went wrong. Please try again.');
    trackEvent('room_staging_error', { productId: _productId, error: e?.message });
  }
}

function showResult($w, imageUrl, state) {
  try { $w('#roomStagingSpinner').collapse(); } catch (e) {}
  try {
    $w('#roomStagingResult').src = imageUrl;
    $w('#roomStagingResult').alt = `${state.product?.name || 'Product'} staged in your room`;
    $w('#roomStagingResult').expand();
  } catch (e) {}
  try { $w('#roomStagingRetry').expand(); } catch (e) {}
  try { $w('#roomStagingShare').expand(); } catch (e) {}
  announce($w, 'Room visualization complete! See how it looks in your space.');
}

function showError($w, message) {
  try { $w('#roomStagingSpinner').collapse(); } catch (e) {}
  try {
    $w('#roomStagingError').text = message;
    $w('#roomStagingError').expand();
  } catch (e) {}
  try { $w('#roomStagingRetry').expand(); } catch (e) {}
}
