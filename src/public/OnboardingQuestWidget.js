/**
 * @module OnboardingQuestWidget
 * @description Member dashboard widget showing 4-step onboarding quest chain
 * with progress indicator. Each step unlocks the next.
 *
 * Elements:
 *   #onboardingQuestSection   — Container (collapsed when all complete or on error)
 *   #onboardingQuestRepeater  — Repeater for quest steps
 *   #onboardingQuestProgress  — "N of 4 complete — X / Y pts earned"
 *   #onboardingQuestError     — Shown on fetch error
 *
 * Repeater item elements:
 *   #questStepTitle       — Step title
 *   #questStepDesc        — Step description
 *   #questStepPoints      — "+Npts"
 *   #questStepStatus      — Checkmark or lock icon text
 *
 * CF-ufn3
 */

import { getOnboardingProgress as _defaultGet } from 'backend/onboardingQuest.web';

/**
 * Initialize the onboarding quest widget.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getOnboardingProgress]
 * @returns {Promise<void>}
 */
export async function initOnboardingQuestWidget(opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getProgress = opts.getOnboardingProgress ?? _defaultGet;

  let data;
  try {
    data = await getProgress();
  } catch (err) {
    console.error('[OnboardingQuestWidget] failed to load progress', err);
    showError($w);
    return;
  }

  if (!data || data.error) {
    showError($w);
    return;
  }

  const { steps, totalPoints, earnedPoints } = data;
  const completedCount = steps.filter(s => s.completed).length;

  // All complete — collapse the section
  if (completedCount === steps.length) {
    try { $w('#onboardingQuestSection').collapse(); } catch (_) {}
    return;
  }

  // Show section
  try { $w('#onboardingQuestSection').expand(); } catch (_) {}
  try { $w('#onboardingQuestError').hide(); } catch (_) {}

  // Progress text
  try {
    $w('#onboardingQuestProgress').text =
      `${completedCount} of ${steps.length} complete — ${earnedPoints} / ${totalPoints} pts earned`;
  } catch (_) {}

  // Render steps
  try {
    const repeater = $w('#onboardingQuestRepeater');
    if (repeater) {
      repeater.onItemReady(($item, itemData) => {
        try { $item('#questStepTitle').text = itemData.title; } catch (_) {}
        try { $item('#questStepDesc').text = itemData.description; } catch (_) {}
        try { $item('#questStepPoints').text = `+${itemData.points}pts`; } catch (_) {}

        const isUnlocked = itemData.order === 0 || steps[itemData.order - 1]?.completed;
        if (itemData.completed) {
          try { $item('#questStepStatus').text = '\u2713'; } catch (_) {} // checkmark
        } else if (isUnlocked) {
          try { $item('#questStepStatus').text = '\u25CB'; } catch (_) {} // open circle
        } else {
          try { $item('#questStepStatus').text = '\uD83D\uDD12'; } catch (_) {} // lock
        }
      });

      repeater.data = steps.map(s => ({ ...s, _id: s.id }));
    }
  } catch (_) {}
}

function showError($w) {
  try { $w('#onboardingQuestError').show(); } catch (_) {}
  try { $w('#onboardingQuestSection').collapse(); } catch (_) {}
}
