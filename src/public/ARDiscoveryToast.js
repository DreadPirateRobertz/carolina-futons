/**
 * @module ARDiscoveryToast
 * @description Toast notification shown when a member uses AR for the first time.
 * Awards discovery points (25 pts) and displays a congratulatory message.
 *
 * Elements:
 *   #arDiscoveryToast — Toast container (show/hide)
 *   #arDiscoveryText  — Message text
 *   #arDiscoveryDismiss — Dismiss button
 *
 * CF-0gly
 */

import { receiveGamificationEvent as _defaultReceiveEvent } from 'backend/gamificationEventReceiver.web';

const STORAGE_KEY = 'ar_discovery_awarded';

/**
 * Call after a member completes their first AR session.
 * Awards points (if not already awarded) and shows a toast.
 *
 * @param {string} memberId
 * @param {Object} [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.receiveGamificationEvent]
 * @param {Object} [opts.storage] — localStorage-like object for testing
 */
export async function showARDiscoveryToast(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const receiveEvent = opts.receiveGamificationEvent ?? _defaultReceiveEvent;
  const storage = opts.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);

  // Check local suppression — prevent redundant backend calls
  if (storage?.getItem(STORAGE_KEY)) {
    return { awarded: false, reason: 'already_shown' };
  }

  let result;
  try {
    result = await receiveEvent('gamification_ar_discovery', {}, memberId);
  } catch (err) {
    console.error('[ARDiscoveryToast] failed to award points', err);
    return { awarded: false, reason: 'error' };
  }

  // Mark as shown regardless of points earned (prevent repeated calls)
  if (storage) {
    try { storage.setItem(STORAGE_KEY, '1'); } catch {}
  }

  const pointsEarned = result?.pointsEarned ?? 0;

  if (pointsEarned > 0) {
    try { $w('#arDiscoveryText').text = `You just earned ${pointsEarned} points for trying AR!`; } catch {}
    try { $w('#arDiscoveryToast').show(); } catch {}
    try {
      $w('#arDiscoveryDismiss').onClick(() => {
        try { $w('#arDiscoveryToast').hide(); } catch {}
      });
    } catch {}

    return { awarded: true, pointsEarned };
  }

  return { awarded: false, reason: 'already_earned' };
}
