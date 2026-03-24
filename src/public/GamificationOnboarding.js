/**
 * @module GamificationOnboarding
 * @description First-visit tutorial overlay for new members joining the
 * Carolina Futons gamification system. Shows a multi-step lightbox only once,
 * tracked via wixStorage.local. Accepts injectable storage for testing.
 */
import { local as wixLocal } from 'wix-storage-frontend';

const STORAGE_KEY = 'gamification_onboarding_seen';

/**
 * Tutorial steps shown in the overlay.
 * Each step has an id and the display text rendered in #onboardingStepText.
 */
export const ONBOARDING_STEPS = [
  {
    id: 'earn_points',
    text: 'Earn points on every purchase — 2pts per dollar',
  },
  {
    id: 'write_review',
    text: 'Write a review — earn 100pts',
  },
  {
    id: 'keep_streak',
    text: 'Keep your streak — 2x points at day 3, 3x at day 7',
  },
];

/**
 * Returns true if the current visitor has already seen the onboarding overlay.
 * @param {Object} [storage] - Injectable storage (default: wixStorage.local)
 * @returns {boolean}
 */
export function hasSeenOnboarding(storage = wixLocal) {
  return storage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Mark the onboarding as seen so it is not shown again.
 * @param {Object} [storage]
 */
function markSeen(storage) {
  storage.setItem(STORAGE_KEY, 'true');
}

/**
 * Render the current step's text into the overlay element.
 * @param {Function} $w - Wix element selector
 * @param {number}   stepIndex
 */
function renderStep($w, stepIndex) {
  const step = ONBOARDING_STEPS[stepIndex];
  if (!step) return;
  $w('#onboardingStepText').text = step.text;
  $w('#onboardingStepIndicator').text = `${stepIndex + 1} / ${ONBOARDING_STEPS.length}`;
}

/**
 * Initialise the gamification onboarding overlay.
 * Shows the overlay only on the first visit (flag not set in wixStorage.local).
 * Wires Next / Previous / Close buttons for multi-step navigation.
 *
 * @param {string} memberId  - Current member's Wix ID (used for future analytics)
 * @param {Object} [opts]
 * @param {Object} [opts.storage] - Injectable storage override (for tests)
 * @returns {Promise<void>}
 */
export async function initOnboarding(memberId, opts = {}) {
  const storage = opts.storage || wixLocal;

  if (hasSeenOnboarding(storage)) return;

  let currentStep = 0;

  try {
    renderStep($w, currentStep);
    await $w('#gamificationOnboardingOverlay').show();

    $w('#onboardingNextBtn').onClick(async () => {
      try {
        if (currentStep < ONBOARDING_STEPS.length - 1) {
          currentStep += 1;
          renderStep($w, currentStep);
        } else {
          // Last step — hide first, then mark seen so a hide() failure
          // does not permanently lock the user out of onboarding.
          await $w('#gamificationOnboardingOverlay').hide();
          markSeen(storage);
        }
      } catch (err) {
        console.warn('[GamificationOnboarding] Next handler failed:', err?.message);
      }
    });

    $w('#onboardingPrevBtn').onClick(() => {
      if (currentStep > 0) {
        currentStep -= 1;
        renderStep($w, currentStep);
      }
    });

    $w('#onboardingCloseBtn').onClick(async () => {
      try {
        // Hide first, then mark seen — same ordering as Next on last step.
        await $w('#gamificationOnboardingOverlay').hide();
        markSeen(storage);
      } catch (err) {
        console.warn('[GamificationOnboarding] Close handler failed:', err?.message);
      }
    });
  } catch (err) {
    console.warn('[GamificationOnboarding] initOnboarding failed gracefully:', err?.message);
  }
}
