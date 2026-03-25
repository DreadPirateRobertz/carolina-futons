/**
 * @module StyleQuizRegistrationGate
 * @description Shows a registration prompt after Style Quiz completion for
 * non-logged-in visitors. Prompts account creation to save style profile
 * and earn 100 bonus points. Skips silently for logged-in members.
 *
 * Elements:
 *   #quizRegistrationGate   — Container (collapsed by default, expanded for visitors)
 *   #quizRegCta             — "Create Free Account" button
 *   #quizRegDismiss         — "No thanks" dismiss link
 *
 * CF-009p
 */

const BONUS_POINTS = 100;

/**
 * Show registration gate after quiz completion if visitor is not logged in.
 * Logged-in members see nothing — the gate is skipped.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getMember]       — injectable member fetch
 * @param {Function} [opts.promptLogin]     — injectable login prompt
 * @param {Function} [opts.onRegistered]    — callback after successful login (receives memberId)
 * @returns {Promise<void>}
 */
export async function initStyleQuizRegistrationGate(opts = {}) {
  const $w = opts.$w ?? globalThis.$w;

  // Check login state
  let member = null;
  if (opts.getMember) {
    try { member = await opts.getMember(); } catch (_) {}
  } else {
    try {
      const { currentMember } = await import('wix-members-frontend');
      member = await currentMember.getMember();
    } catch (_) {}
  }

  // Already logged in — skip gate
  if (member?._id) return;

  // Show registration gate
  try { $w('#quizRegistrationGate').expand(); } catch (_) { return; }

  try {
    $w('#quizRegistrationGate').text =
      `Save your style profile \u2014 create a free account to unlock personalized recommendations + ${BONUS_POINTS} bonus points.`;
  } catch (_) {}

  // Wire CTA button
  try {
    $w('#quizRegCta').onClick(async () => {
      if (opts.promptLogin) {
        await opts.promptLogin();
      } else {
        try {
          const { authentication } = await import('wix-members-frontend');
          await authentication.promptLogin();
        } catch (_) {}
      }

      // After login attempt, check if user is now logged in
      let newMember = null;
      if (opts.getMember) {
        try { newMember = await opts.getMember(); } catch (_) {}
      } else {
        try {
          const { currentMember } = await import('wix-members-frontend');
          newMember = await currentMember.getMember();
        } catch (_) {}
      }

      if (newMember?._id) {
        try { $w('#quizRegistrationGate').collapse(); } catch (_) {}
        if (opts.onRegistered) {
          try { await opts.onRegistered(newMember._id); } catch (_) {}
        }
      }
    });
  } catch (_) {}

  // Wire dismiss
  try {
    $w('#quizRegDismiss').onClick(() => {
      try { $w('#quizRegistrationGate').collapse(); } catch (_) {}
    });
  } catch (_) {}
}
