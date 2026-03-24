/**
 * @module gamificationFeedback
 * @description In-page toast/animation when gamification events are received.
 * Provides buildFeedbackText (pure) and showGamificationFeedback (side-effecting).
 * Call showGamificationFeedback after any receiveGamificationEvent() response
 * to surface the dopamine moment without a page reload.
 *
 * CF-p1v2
 */

/**
 * Build the display text for a gamification event result.
 * Priority order: milestone > tier change > badge unlock > points earned.
 *
 * @param {{ success: boolean, pointsEarned?: number, tierChanged?: boolean,
 *           newTier?: string, badgeUnlocked?: string|null,
 *           milestoneUnlocked?: boolean }|null} result
 * @returns {string|null} text to display, or null when nothing is worth showing
 */
export function buildFeedbackText(result) {
  if (!result?.success) return null;

  const pts = result.pointsEarned ?? 0;

  if (result.milestoneUnlocked) {
    return pts > 0 ? `+${pts} pts · Milestone unlocked!` : 'Milestone unlocked!';
  }

  if (result.tierChanged && result.newTier) {
    return `Tier up! You're now ${result.newTier}`;
  }

  if (result.badgeUnlocked) {
    return pts > 0 ? `+${pts} pts · New badge unlocked!` : 'New badge unlocked!';
  }

  if (pts > 0) return `+${pts} pts earned`;

  return null;
}

/**
 * Show an in-page toast when a gamification event has something to display.
 * No-ops gracefully when $w is null, result is unsuccessful, there is nothing
 * to show, or the toast elements are absent from the current page.
 *
 * @param {Function|null} $w - Wix selector function
 * @param {Object|null} result - Return value from receiveGamificationEvent
 * @param {Object} [options]
 * @param {string}  [options.toastId='#gamificationToast']
 * @param {string}  [options.toastTextId='#gamificationToastText']
 * @param {boolean} [options.reducedMotion=false]
 * @param {number}  [options.autoDismissMs] - Defaults to 5000ms for milestones, 3000ms otherwise
 */
export function showGamificationFeedback($w, result, options = {}) {
  if (!$w || !result?.success) return;

  const text = buildFeedbackText(result);
  if (!text) return;

  const {
    toastId = '#gamificationToast',
    toastTextId = '#gamificationToastText',
    reducedMotion = false,
  } = options;
  const autoDismissMs = options.autoDismissMs ?? (result.milestoneUnlocked ? 5000 : 3000);

  try {
    const $toast = $w(toastId);
    const $text = $w(toastTextId);
    if (!$toast || !$text) return;

    $text.text = text;

    if (!reducedMotion) {
      $toast.show('slide', { duration: 300, direction: 'bottom' });
    } else {
      $toast.show();
    }

    setTimeout(() => {
      try { $toast.hide(); } catch (_) {}
    }, autoDismissMs);
  } catch (e) {
    console.error('[gamificationFeedback] showGamificationFeedback failed:', e);
  }
}
