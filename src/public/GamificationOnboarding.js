/**
 * @module GamificationOnboarding
 * @description First-visit tutorial overlay for the gamification system.
 *
 * Elements:
 *   #gamificationOnboardingOverlay — Modal overlay container
 *   #onboardingStepText            — Current step body text
 *   #onboardingStepIndicator       — "N / M" label
 *   #onboardingNextBtn             — Advance to next step (or close on last)
 *   #onboardingPrevBtn             — Go back to previous step
 *   #onboardingCloseBtn            — Dismiss overlay and mark seen
 *
 * CF-ekzr / CF-zgmv
 */

import { local as wixLocal } from 'wix-storage-frontend';

const STORAGE_KEY = 'gamification_onboarding_seen';

export const ONBOARDING_STEPS = [
  { id: 'earn_points',  text: 'Earn points every time you shop, write a review, or refer a friend.' },
  { id: 'write_review', text: 'Write a review after your purchase to earn bonus points and unlock badges.' },
  { id: 'keep_streak',  text: 'Keep your daily streak alive to multiply your points with every action.' },
];

/**
 * Returns true if the member has already seen the onboarding overlay.
 *
 * @param {Storage} [storage]  localStorage-compatible object (injectable for tests)
 * @returns {boolean}
 */
export function hasSeenOnboarding(storage = wixLocal) {
  return storage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Initialise the gamification onboarding overlay on first visit.
 * No-ops silently on repeat visits or when overlay element throws.
 *
 * @param {string}   memberId
 * @param {Object}   [opts]
 * @param {Function} [opts.$w]
 * @param {Storage}  [opts.storage]
 */
export async function initOnboarding(memberId, opts = {}) {
  const $w      = opts.$w ?? globalThis.$w;
  const storage = opts.storage ?? wixLocal;

  if (hasSeenOnboarding(storage)) return;

  let step = 0;
  const total = ONBOARDING_STEPS.length;

  function renderStep() {
    $w('#onboardingStepText').text      = ONBOARDING_STEPS[step].text;
    $w('#onboardingStepIndicator').text = `${step + 1} / ${total}`;
  }

  async function dismiss() {
    await $w('#gamificationOnboardingOverlay').hide();
    storage.setItem(STORAGE_KEY, 'true');
  }

  // Render first step text before showing (avoid flash of empty overlay)
  renderStep();

  // Show overlay — bail out entirely if this throws (user never saw it)
  try {
    await $w('#gamificationOnboardingOverlay').show();
  } catch (e) {
    return;
  }

  $w('#onboardingNextBtn').onClick(async () => {
    if (step === total - 1) {
      try { await dismiss(); } catch (e) {}
    } else {
      step++;
      renderStep();
    }
  });

  $w('#onboardingPrevBtn').onClick(() => {
    if (step > 0) {
      step--;
      renderStep();
    }
  });

  $w('#onboardingCloseBtn').onClick(async () => {
    try { await dismiss(); } catch (e) {}
  });
}
