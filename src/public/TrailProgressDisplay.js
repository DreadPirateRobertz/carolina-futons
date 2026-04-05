/**
 * TrailProgressDisplay.js — Pure frontend functions for the Trail Progress UI.
 * No Wix imports — operates on injected $element objects for testability.
 * CF-mcyh.3
 */

const PERK_LABELS = {
  'perk-free-shipping': 'Free Shipping',
  'perk-early-access': 'Early Access',
  'perk-styling-call': 'Free Styling Call',
};

/**
 * Formats a perkId to a human-readable label.
 * Falls back to the raw perkId if not found.
 * @param {string} perkId
 * @returns {string}
 */
export function formatPerkLabel(perkId) {
  return PERK_LABELS[perkId] || perkId;
}

/**
 * Formats trail completion status as "X / Y challenges".
 * @param {string[]} completedChallengeIds
 * @param {string[]} challengeIds
 * @returns {string}
 */
export function formatTrailProgress(completedChallengeIds, challengeIds) {
  return `${completedChallengeIds.length} / ${challengeIds.length} challenges`;
}

/**
 * Formats a Date or ISO string to a short "Apr 1" display.
 * @param {Date|string|null} date
 * @returns {string}
 */
export function formatCompletedAt(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Populates a single repeater item card with trail data.
 *
 * @param {{ $trailName, $trailTheme, $progressBar, $progressLabel, $perkLabel, $completedBadge, $completedAtLabel }} elements
 * @param {{ trailId, name, season, theme, challengeIds, perkId, completedChallengeIds, isComplete, completedAt }} trail
 */
export function renderTrailCard(elements, trail) {
  const { $trailName, $trailTheme, $progressBar, $progressLabel, $perkLabel, $completedBadge, $completedAtLabel } = elements;
  const { name, theme, challengeIds, perkId, completedChallengeIds, isComplete, completedAt } = trail;

  $trailName.text = name;
  $trailTheme.text = theme;
  $progressLabel.text = formatTrailProgress(completedChallengeIds, challengeIds);
  $progressBar.value = challengeIds.length > 0
    ? (completedChallengeIds.length / challengeIds.length) * 100
    : 0;
  $perkLabel.text = formatPerkLabel(perkId);

  if (isComplete) {
    $completedBadge.show();
    $completedAtLabel.text = completedAt ? `Completed ${formatCompletedAt(completedAt)}` : 'Completed';
  } else {
    $completedBadge.hide();
    $completedAtLabel.text = '';
  }
}

/**
 * Binds trail data to the repeater and wires onItemReady.
 * @param {Object} $trailsList  - Wix Repeater element
 * @param {Array}  trails       - From getTrailProgress() response
 */
export function renderTrailsRail($trailsList, trails) {
  $trailsList.data = trails.map(t => ({ _id: t.trailId, ...t }));

  $trailsList.onItemReady(($item, itemData) => {
    renderTrailCard(
      {
        $trailName: $item('#trailName'),
        $trailTheme: $item('#trailTheme'),
        $progressBar: $item('#trailProgressBar'),
        $progressLabel: $item('#trailProgressLabel'),
        $perkLabel: $item('#trailPerkLabel'),
        $completedBadge: $item('#trailCompletedBadge'),
        $completedAtLabel: $item('#trailCompletedAtLabel'),
      },
      itemData
    );
  });
}

/**
 * Initializes the trail progress display section on page load.
 * Calls getTrailProgressFn (no args — memberId derived server-side),
 * hides section if no trails returned, renders rail otherwise.
 *
 * @param {Function} getTrailProgressFn  - webMethod reference (injected for testability)
 * @param {Object}   $trailsSection      - Outer container Box
 * @param {Object}   $trailsList         - Repeater element
 * @returns {Promise<void>}
 */
export async function initTrailsDisplay(getTrailProgressFn, $trailsSection, $trailsList) {
  try {
    const response = await getTrailProgressFn();
    const trails = response.trails || [];

    if (trails.length === 0) {
      $trailsSection.hide();
      return;
    }

    $trailsSection.show();
    renderTrailsRail($trailsList, trails);
  } catch (err) {
    // Non-critical — hide section on error
    $trailsSection.hide();
  }
}
