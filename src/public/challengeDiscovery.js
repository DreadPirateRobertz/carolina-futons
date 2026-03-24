/**
 * @module challengeDiscovery
 * @description Challenge discovery chip for product and catalog pages.
 *
 * Renders an ambient "challenge in progress" chip that shows the member
 * which active challenge they are contributing to as they browse.
 * The chip is shown only when the member has at least one active, incomplete
 * challenge whose conditionType matches the current page context.
 *
 * Exports:
 *   initChallengeDiscoveryChip(elements, memberId, getActiveChallengesFn, context)
 *
 * CF-fh5
 */

/**
 * @typedef {Object} ChallengeChipElements
 * @property {Object} $chip        - Wix container element for the chip
 * @property {Object} $chipTitle   - Wix text element for challenge title
 * @property {Object} $chipProg    - Wix text element for "N / M" progress text
 */

/**
 * @typedef {'add_to_cart'|'purchase'|'page_view'} ChipContext
 * Context describing what action triggers earning on this page.
 */

/** Condition types that match each chip context. */
const CONTEXT_CONDITIONS = {
  add_to_cart: ['add_to_cart', 'gamification_add_to_cart'],
  purchase:    ['purchase', 'gamification_purchase'],
  page_view:   ['page_view', 'gamification_page_view'],
};

/**
 * Initialise the challenge discovery chip on a page.
 *
 * Fetches the member's active challenges, picks the first incomplete one whose
 * conditionType matches the page context, then shows the chip with title and
 * progress. Hides the chip if there are no matching incomplete challenges.
 *
 * @param {ChallengeChipElements} elements
 * @param {string|null} memberId
 * @param {Function} getActiveChallengesFn - async () => { challenges: Array }
 * @param {ChipContext} context
 * @returns {Promise<void>}
 */
export async function initChallengeDiscoveryChip(elements, memberId, getActiveChallengesFn, context) {
  const { $chip, $chipTitle, $chipProg } = elements;
  if (!memberId) {
    _hideChip($chip);
    return;
  }

  try {
    const result = await getActiveChallengesFn(memberId);
    const challenges = result?.challenges ?? [];

    const allowedConditions = CONTEXT_CONDITIONS[context] ?? [];
    const match = challenges.find(c =>
      allowedConditions.includes(c.conditionType) &&
      !c.completedAt
    );

    if (!match) {
      _hideChip($chip);
      return;
    }

    _showChip($chip, $chipTitle, $chipProg, match);
  } catch {
    _hideChip($chip);
  }
}

function _hideChip($chip) {
  try { $chip.hide(); } catch { /* element may not exist on this page */ }
}

function _showChip($chip, $chipTitle, $chipProg, challenge) {
  try {
    $chipTitle.text = challenge.title;
    $chipProg.text = `${challenge.progressValue} / ${challenge.targetCount}`;
    $chip.show();
  } catch {
    _hideChip($chip);
  }
}
