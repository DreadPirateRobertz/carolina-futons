/**
 * @module SpinWheelIntegration
 * @description Wires bonus spin grants to loyalty thresholds on the member dashboard.
 * Email capture gate: first-time spinners must enter a valid email before spinning.
 *
 * Elements:
 *   #bonusSpinCTA        — CTA shown when member has bonus spins available
 *   #spinWheelLightbox   — Spin wheel modal container
 *   #spinWheelCloseBtn   — Hides the lightbox on click
 *   #spinEmailGate       — Email capture container (shown before spin)
 *   #spinEmailInput      — Email text input
 *   #spinEmailSubmitBtn  — Submit email button
 *   #spinEmailError      — Inline error message for invalid email
 *
 * CF-qjnv, CF-4tal
 */

import { getBonusSpinsAvailable as _defaultGetBonusSpins, captureSpinEmail as _defaultCaptureEmail } from 'backend/spinWheel.web';
import { validateEmail } from 'public/validators.js';

const SPIN_EMAIL_KEY = 'cf_spin_email_captured';

/**
 * Initialise the spin wheel CTA and lightbox wiring.
 *
 * @param {string}   memberId  Member ID to check spin eligibility for
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w] Wix element selector (defaults to globalThis.$w)
 * @param {Function} [opts.getBonusSpinsAvailable] Defaults to backend getBonusSpinsAvailable
 * @param {Function} [opts.captureSpinEmail] Defaults to backend captureSpinEmail
 * @param {Function} [opts.validateEmail] Defaults to validators.validateEmail
 * @param {Object}   [opts.storage] localStorage-compatible (defaults to globalThis.localStorage)
 */
export async function initSpinWheel(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getBonusSpinsAvailable = opts.getBonusSpinsAvailable ?? ((id) => _defaultGetBonusSpins(id));
  const captureEmail = opts.captureSpinEmail ?? ((email) => _defaultCaptureEmail(email));
  const isValidEmail = opts.validateEmail ?? validateEmail;
  const storage = opts.storage ?? globalThis.localStorage;

  let spins;
  try {
    spins = await getBonusSpinsAvailable(memberId);
  } catch (e) {
    try { $w('#bonusSpinCTA').hide(); } catch (_) {}
    return;
  }

  if (spins > 0) {
    const label = spins === 1 ? 'You have 1 bonus spin!' : `You have ${spins} bonus spins!`;
    try { $w('#bonusSpinCTA').text = label; } catch (_) {}
    try { $w('#bonusSpinCTA').show(); } catch (_) {}

    // Check if email already captured this session
    const alreadyCaptured = _hasEmailCaptured(storage);

    try {
      $w('#bonusSpinCTA').onClick(() => {
        if (alreadyCaptured) {
          try { $w('#spinWheelLightbox').show(); } catch (_) {}
        } else {
          try { $w('#spinEmailGate').show(); } catch (_) {}
        }
      });
    } catch (_) {}

    // Email gate submit handler
    try {
      $w('#spinEmailSubmitBtn').onClick(async () => {
        try { $w('#spinEmailError').hide(); } catch (_) {}
        const email = $w('#spinEmailInput').value?.trim() || '';

        if (!isValidEmail(email)) {
          try { $w('#spinEmailError').text = 'Please enter a valid email address.'; } catch (_) {}
          try { $w('#spinEmailError').show(); } catch (_) {}
          return;
        }

        try {
          const result = await captureEmail(email);
          if (result?.success) {
            _markEmailCaptured(storage);
            try { $w('#spinEmailGate').hide(); } catch (_) {}
            try { $w('#spinWheelLightbox').show(); } catch (_) {}
          } else {
            try { $w('#spinEmailError').text = 'Something went wrong. Please try again.'; } catch (_) {}
            try { $w('#spinEmailError').show(); } catch (_) {}
          }
        } catch (e) {
          try { $w('#spinEmailError').text = 'Something went wrong. Please try again.'; } catch (_) {}
          try { $w('#spinEmailError').show(); } catch (_) {}
        }
      });
    } catch (_) {}

    try {
      $w('#spinWheelCloseBtn').onClick(() => {
        try { $w('#spinWheelLightbox').hide(); } catch (_) {}
      });
    } catch (_) {}
  } else {
    try { $w('#bonusSpinCTA').hide(); } catch (_) {}
  }
}

/**
 * Returns true when the member has at least one bonus spin available.
 *
 * @param {string}   memberId
 * @param {Object}   [opts]
 * @param {Function} [opts.getBonusSpinsAvailable]
 * @returns {Promise<boolean>}
 */
export async function hasBonusSpins(memberId, opts = {}) {
  const getBonusSpinsAvailable = opts.getBonusSpinsAvailable ?? ((id) => _defaultGetBonusSpins(id));
  try {
    const spins = await getBonusSpinsAvailable(memberId);
    return spins > 0;
  } catch (e) {
    return false;
  }
}

function _hasEmailCaptured(storage) {
  try { return storage.getItem(SPIN_EMAIL_KEY) === 'true'; } catch (e) { return false; }
}

function _markEmailCaptured(storage) {
  try { storage.setItem(SPIN_EMAIL_KEY, 'true'); } catch (e) {}
}
