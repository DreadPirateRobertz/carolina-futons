/**
 * LiveShowroomUI.js — "See It Live" showroom camera toggle on Product Page.
 *
 * CF-gt99: NOVEL — Live Showroom Camera
 *
 * Shows a live video feed of the product on the Hendersonville showroom floor.
 * Includes a "Reserve This Exact Piece" button with 5% discount and 30-min hold.
 *
 * Editor elements needed:
 * - #showroomToggle — Button: "See It Live 🔴" (on product page, near gallery)
 * - #showroomFeed — VideoPlayer or HtmlComponent: live stream embed
 * - #showroomLabel — Text: camera label ("Front Display — Hendersonville")
 * - #showroomBadge — Text: "LIVE IN SHOWROOM" badge (on product card)
 * - #reserveBtn — Button: "Reserve This Exact Piece — 5% Off"
 * - #reserveTimer — Text: countdown timer ("Hold expires in 28:45")
 * - #reserveCode — Text: discount code display
 * - #reserveSection — Box: reservation UI container
 */
import { getShowroomStatus, reserveShowroomPiece, checkReservation } from 'backend/liveShowroom.web';
import { announce } from 'public/a11yHelpers.js';
import { trackEvent } from 'public/engagementTracker';

let _countdownTimer = null;

/**
 * Initialize the Live Showroom feature on a product page.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} state - Product page state with state.product
 */
export async function initLiveShowroom($w, state) {
  try {
    const productId = state.product?._id;
    if (!productId) return;

    const status = await getShowroomStatus(productId);

    if (!status.onDisplay) {
      // Product not on showroom floor — hide all showroom UI
      try { $w('#showroomToggle').collapse(); } catch (e) {}
      try { $w('#showroomFeed').collapse(); } catch (e) {}
      try { $w('#showroomBadge').collapse(); } catch (e) {}
      try { $w('#reserveSection').collapse(); } catch (e) {}
      return;
    }

    // Show "LIVE IN SHOWROOM" badge
    try {
      $w('#showroomBadge').text = status.isLive ? '🔴 LIVE IN SHOWROOM' : 'ON DISPLAY IN SHOWROOM';
      $w('#showroomBadge').expand();
    } catch (e) {}

    // Show toggle button
    try {
      $w('#showroomToggle').label = status.isLive
        ? `See It Live — ${status.camera.label}`
        : `On Display — ${status.camera.label}`;
      $w('#showroomToggle').expand();
    } catch (e) {}

    // Toggle click → show/hide stream
    let feedVisible = false;
    try {
      $w('#showroomToggle').onClick(() => {
        feedVisible = !feedVisible;
        if (feedVisible && status.isLive && status.camera.streamUrl) {
          showStream($w, status.camera);
          trackEvent('showroom_stream_open', { productId, camera: status.camera.cameraId });
        } else {
          hideStream($w);
        }
      });
    } catch (e) {}

    // Reserve button
    initReserveButton($w, state);

  } catch (e) {
    console.warn('[LiveShowroom] Init failed:', e?.message);
  }
}

/**
 * Show the live stream in the video feed area.
 */
function showStream($w, camera) {
  try {
    const feed = $w('#showroomFeed');
    if (!feed) return;

    // For HLS streams, use HtmlComponent with video.js or native HLS
    if (camera.streamUrl.includes('.m3u8')) {
      feed.postMessage({
        type: 'loadStream',
        url: camera.streamUrl,
        label: camera.label,
      });
    } else {
      // Direct video URL or WebRTC
      try { feed.src = camera.streamUrl; } catch (e) {}
    }

    feed.expand();
    try {
      $w('#showroomLabel').text = `📍 ${camera.label} — Hendersonville, NC`;
      $w('#showroomLabel').expand();
    } catch (e) {}

    announce($w, `Live showroom feed opened: ${camera.label}`);
  } catch (e) {}
}

function hideStream($w) {
  try { $w('#showroomFeed').collapse(); } catch (e) {}
  try { $w('#showroomLabel').collapse(); } catch (e) {}
}

/**
 * Initialize the "Reserve This Exact Piece" button.
 */
function initReserveButton($w, state) {
  try {
    const reserveBtn = $w('#reserveBtn');
    if (!reserveBtn) return;

    reserveBtn.label = 'Reserve This Exact Piece — 5% Off';
    reserveBtn.expand();

    reserveBtn.onClick(async () => {
      const productId = state.product?._id;
      if (!productId) return;

      reserveBtn.disable();
      reserveBtn.label = 'Reserving...';

      try {
        const sessionId = getSessionId();
        const result = await reserveShowroomPiece(productId, sessionId);

        if (!result.success) {
          reserveBtn.label = result.error || 'Reservation failed';
          reserveBtn.enable();
          announce($w, result.error || 'Reservation failed');
          return;
        }

        // Show reservation details
        showReservation($w, result.reservation);
        trackEvent('showroom_reserve', {
          productId,
          productName: state.product?.name,
          discountCode: result.reservation.discountCode,
        });

        announce($w, `Piece reserved for ${result.reservation.minutesRemaining} minutes. Discount code: ${result.reservation.discountCode}`);
      } catch (e) {
        reserveBtn.label = 'Reserve This Exact Piece — 5% Off';
        reserveBtn.enable();
      }
    });
  } catch (e) {}
}

function showReservation($w, reservation) {
  try {
    $w('#reserveBtn').label = '✓ Reserved!';
    $w('#reserveBtn').disable();
  } catch (e) {}

  try {
    $w('#reserveCode').text = `Your code: ${reservation.discountCode} (${reservation.discountPercent}% off)`;
    $w('#reserveCode').expand();
  } catch (e) {}

  try { $w('#reserveSection').expand(); } catch (e) {}

  // Start countdown timer
  startCountdown($w, reservation.expiresAt);
}

function startCountdown($w, expiresAt) {
  if (_countdownTimer) clearInterval(_countdownTimer);

  const update = () => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      clearInterval(_countdownTimer);
      try { $w('#reserveTimer').text = 'Reservation expired'; } catch (e) {}
      try { $w('#reserveBtn').label = 'Reserve This Exact Piece — 5% Off'; } catch (e) {}
      try { $w('#reserveBtn').enable(); } catch (e) {}
      try { $w('#reserveCode').collapse(); } catch (e) {}
      return;
    }

    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    try {
      $w('#reserveTimer').text = `Hold expires in ${mins}:${String(secs).padStart(2, '0')}`;
      $w('#reserveTimer').expand();
    } catch (e) {}
  };

  update();
  _countdownTimer = setInterval(update, 1000);
}

function getSessionId() {
  try {
    const { session } = require('wix-storage-frontend');
    let id = session.getItem('cf_session_id');
    if (!id) {
      id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      session.setItem('cf_session_id', id);
    }
    return id;
  } catch {
    return `anon-${Date.now()}`;
  }
}

/**
 * Cleanup — call on page unload to clear countdown timer.
 */
export function cleanupLiveShowroom() {
  if (_countdownTimer) {
    clearInterval(_countdownTimer);
    _countdownTimer = null;
  }
}
