/**
 * ChallengesDisplay.js — Pure frontend functions for the Challenges/Missions UI.
 * No Wix imports — operates on injected $element objects for testability.
 * CF-phase4-challenges
 */

/**
 * Formats an ISO UTC date string to a short month+day display.
 * e.g. "2026-04-01T00:00:00Z" → "Apr 1"
 * @param {string} isoString
 * @returns {string}
 */
function formatExpiresAt(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Returns a human-readable expiry label for a challenge.
 * - If expired: ''
 * - If < 1 hour remaining: '< 1h left'
 * - If < 24 hours remaining: 'Xh Ym left'
 * - If >= 24 hours remaining: 'Expires Apr 1'
 *
 * @param {string|null|undefined} isoString  ISO UTC expiry date
 * @param {number} [nowMs]  Current time in ms (defaults to Date.now())
 * @returns {string}
 */
export function formatCountdown(isoString, nowMs) {
  if (!isoString) return '';
  const now = nowMs !== undefined ? nowMs : Date.now();
  const expiresMs = new Date(isoString).getTime();
  const msLeft = expiresMs - now;
  if (msLeft <= 0) return '';
  const hoursLeft = msLeft / (1000 * 60 * 60);
  if (hoursLeft < 1) return '< 1h left';
  if (hoursLeft < 24) {
    const h = Math.floor(hoursLeft);
    const m = Math.floor((msLeft - h * 3600000) / 60000);
    return `${h}h ${m}m left`;
  }
  return `Expires ${formatExpiresAt(isoString)}`;
}

/**
 * Populates a single repeater item card with challenge data.
 * Uses countdown format (e.g. "3h 30m left") when < 24h remain; otherwise "Expires Apr 1".
 *
 * @param {{ $title, $description, $progressBar, $progressLabel, $rewardLabel, $expiresLabel, $completedBadge }} elements
 * @param {{ title, description, progressValue, targetCount, rewardPoints, expiresAt, completedAt }} challenge
 * @param {number} [nowMs]  Current time override for testability (defaults to Date.now())
 */
export function renderChallengeCard(elements, challenge, nowMs) {
  const { $title, $description, $progressBar, $progressLabel, $rewardLabel, $expiresLabel, $completedBadge } = elements;
  const { title, description, progressValue, targetCount, rewardPoints, expiresAt, completedAt } = challenge;

  $title.text = title;
  $description.text = description || '';
  $progressBar.value = targetCount > 0 ? (progressValue / targetCount) * 100 : 0;
  $progressLabel.text = `${progressValue} / ${targetCount}`;
  $rewardLabel.text = `+${rewardPoints} pts`;
  $expiresLabel.text = formatCountdown(expiresAt, nowMs);

  if (completedAt) {
    $completedBadge.show();
  } else {
    $completedBadge.hide();
  }
}

/**
 * Binds challenges data to the repeater and wires onItemReady.
 * @param {Object} $challengesList  - Wix Repeater element
 * @param {Array}  challenges       - From getActiveChallenges() response
 */
export function renderChallengesRail($challengesList, challenges) {
  $challengesList.data = challenges.map(c => ({ _id: c.challengeId, ...c }));

  $challengesList.onItemReady(($item, itemData) => {
    renderChallengeCard(
      {
        $title: $item('#challengeTitle'),
        $description: $item('#challengeDescription'),
        $progressBar: $item('#challengeProgressBar'),
        $progressLabel: $item('#challengeProgressLabel'),
        $rewardLabel: $item('#challengeRewardLabel'),
        $expiresLabel: $item('#challengeExpiresLabel'),
        $completedBadge: $item('#challengeCompletedBadge'),
      },
      itemData
    );
  });
}

/**
 * Shows the challenge completion toast for 4 seconds, then hides it.
 * Plays Bear Clapping Lottie animation unless reduced motion is requested.
 * @param {Object}  $toast          - Box element wrapping the toast
 * @param {{ title: string, rewardPoints: number }} challenge
 * @param {boolean} reducedMotion
 * @returns {Promise<void>}
 */
export async function showCompletionToast($toast, challenge, reducedMotion = false) {
  const { title, rewardPoints } = challenge;

  if ($toast.$toastTitle) $toast.$toastTitle.text = title;
  if ($toast.$toastPoints) $toast.$toastPoints.text = `+${rewardPoints} pts`;

  $toast.show();

  if (reducedMotion) {
    // Instantly show completion state; no animation, no auto-hide (caller decides when to dismiss)
    return;
  }

  // Lottie animation (Bear Clapping) is wired in Member Page.js — not imported here
  await new Promise(resolve => setTimeout(resolve, 4000));
  $toast.hide();
}

/**
 * Pure data helper: returns a progress result object for UI update.
 * Called by Member Page.js when a point-earning event response includes challengeProgress.
 * @param {string}  challengeId
 * @param {number}  progressValue
 * @param {number}  targetCount
 * @param {boolean} justCompleted
 * @returns {{ challengeId, progressValue, targetCount, justCompleted }}
 */
export function updateChallengeProgress(challengeId, progressValue, targetCount, justCompleted) {
  return { challengeId, progressValue, targetCount, justCompleted };
}

/**
 * Initializes the challenges display section on page load.
 * Calls getActiveChallenges, hides section if empty, renders rail if challenges returned.
 * Wired in Member Page.js — not called directly from this module.
 *
 * @param {string}   memberId
 * @param {Function} getActiveChallengesFn  - webMethod reference (injected for testability)
 * @param {Object}   $challengesSection     - Outer container Box
 * @param {Object}   $challengesList        - Repeater element
 * @returns {Promise<void>}
 */
export async function initChallengesDisplay(memberId, getActiveChallengesFn, $challengesSection, $challengesList) {
  try {
    const response = await getActiveChallengesFn(memberId);
    const challenges = response.challenges || [];

    if (challenges.length === 0) {
      $challengesSection.hide();
      return;
    }

    $challengesSection.show();
    renderChallengesRail($challengesList, challenges);
  } catch (err) {
    // Non-critical — hide section on error
    $challengesSection.hide();
  }
}
