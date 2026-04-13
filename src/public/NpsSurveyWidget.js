/**
 * @module NpsSurveyWidget
 * @description Post-delivery NPS/CSAT satisfaction survey widget.
 * Shown in-app when an order's status is 'delivered'. Presents a 0–10
 * likelihood-to-recommend prompt plus an optional open-text comment field.
 * Automatically detects prior submission and shows a thank-you state instead
 * of re-prompting.
 *
 * Required Wix Studio elements:
 *   #npsSurveySection  Box      — outer wrapper (hidden for guests / non-delivered orders)
 *   #npsTitle          Text     — survey prompt text
 *   #npsScoreGroup     RadioButtonGroup — 0–10 rating buttons
 *   #npsComment        TextInput / TextArea — optional free-text comment
 *   #npsSubmitBtn      Button   — "Submit" primary CTA
 *   #npsSkipBtn        Button   — "Skip" secondary action
 *   #npsThankYouMsg    Text     — confirmation copy (hidden by default)
 *   #npsStatusMsg      Text     — inline error / loading indicator
 *
 * CF-c18
 */

import {
  submitSurveyResponse as _defaultSubmitSurveyResponse,
  getSurveyForOrder   as _defaultGetSurveyForOrder,
} from 'backend/surveyService.web';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safely read the value of a Wix element, returning null on any error.
 * @param {Function} $w
 * @param {string}   id  Element id including '#'
 * @returns {*}
 */
function safeGet($w, id, prop = 'value') {
  try { return $w(id)[prop] ?? null; } catch (_) { return null; }
}

/**
 * Safely set a property on a Wix element; silently ignores absent elements.
 * @param {Function} $w
 * @param {string}   id
 * @param {string}   prop
 * @param {*}        value
 */
function safeSet($w, id, prop, value) {
  try { $w(id)[prop] = value; } catch (_) {}
}

/**
 * Safely call a method on a Wix element; ignores absent elements.
 * @param {Function} $w
 * @param {string}   id
 * @param {string}   method
 */
function safeCall($w, id, method) {
  try { $w(id)[method](); } catch (_) {}
}

/**
 * Show the thank-you / already-completed state and hide the rating form.
 * @param {Function} $w
 * @param {string}   [msg]  Optional override message text
 */
function showThankYou($w, msg) {
  safeSet($w, '#npsThankYouMsg', 'text', msg ?? 'Thanks for your feedback!');
  safeCall($w, '#npsThankYouMsg', 'show');
  safeCall($w, '#npsTitle', 'hide');
  safeCall($w, '#npsScoreGroup', 'hide');
  safeCall($w, '#npsComment', 'hide');
  safeCall($w, '#npsSubmitBtn', 'hide');
  safeCall($w, '#npsSkipBtn', 'hide');
  safeCall($w, '#npsStatusMsg', 'hide');
}

/**
 * Show an inline status / error message.
 * @param {Function} $w
 * @param {string}   msg
 */
function showStatus($w, msg) {
  safeSet($w, '#npsStatusMsg', 'text', msg);
  safeCall($w, '#npsStatusMsg', 'show');
}

/**
 * Clear the inline status message.
 * @param {Function} $w
 */
function clearStatus($w) {
  safeCall($w, '#npsStatusMsg', 'hide');
  safeSet($w, '#npsStatusMsg', 'text', '');
}

// ── Module init ───────────────────────────────────────────────────────────────

/**
 * Initialise the NPS survey widget for a given order.
 *
 * Guards:
 * - Guests see nothing (no member session → section stays hidden).
 * - Orders not in 'delivered' status get no survey prompt.
 * - Already-completed surveys show a static thank-you message instead of
 *   re-prompting. WHY: members who saw the thank-you on a previous visit
 *   should not be asked again — surveying twice would pollute the dataset
 *   and frustrate users who already gave feedback. (CF-c18)
 *
 * @param {Object}   opts
 * @param {Function} [opts.$w]                    — Wix selector
 * @param {Function} [opts.getCurrentMember]      — returns member or null
 * @param {string}   [opts.orderId]               — order to survey
 * @param {string}   [opts.orderStatus]           — current order status
 * @param {Function} [opts.getSurveyForOrder]     — backend lookup
 * @param {Function} [opts.submitSurveyResponse]  — backend submit
 * @returns {Promise<void>}
 */
export async function initNpsSurveyWidget(opts = {}) {
  const $w                  = opts.$w ?? globalThis.$w;
  const getCurrentMember    = opts.getCurrentMember
    ?? (() => import('wix-members-frontend').then(m => m.currentMember.getMember()));
  const orderId             = opts.orderId ?? null;
  const orderStatus         = opts.orderStatus ?? null;
  const getSurveyForOrder   = opts.getSurveyForOrder   ?? _defaultGetSurveyForOrder;
  const submitSurveyResponse = opts.submitSurveyResponse ?? _defaultSubmitSurveyResponse;

  // Gate 1: only survey for delivered orders
  if (orderStatus !== 'delivered' || !orderId) return;

  // Gate 2: only authenticated members get the survey
  let member = null;
  try {
    member = await getCurrentMember();
  } catch (_) {}
  if (!member?._id) return;

  // Gate 3: skip if already completed — no double-prompting.
  // WHY: the survey record is created server-side when the order is delivered;
  // completedAt is null until the member submits. Checking here prevents the
  // client from re-rendering the form when the member revisits their order
  // history after already responding. (CF-c18)
  let alreadyCompleted = false;
  try {
    const check = await getSurveyForOrder(orderId);
    if (check?.survey?.isCompleted) alreadyCompleted = true;
  } catch (_) {}

  // Reveal the section — all gates passed
  safeCall($w, '#npsSurveySection', 'show');
  safeSet($w, '#npsSurveySection', 'accessibility', { role: 'region', ariaLabel: 'Satisfaction survey' });

  if (alreadyCompleted) {
    showThankYou($w, 'You\'ve already shared your feedback. Thank you!');
    return;
  }

  // ── Wire the rating form ──────────────────────────────────────────────────

  safeSet($w, '#npsTitle', 'text', 'How likely are you to recommend us to a friend? (0 = not at all, 10 = definitely)');
  safeCall($w, '#npsTitle', 'show');
  safeCall($w, '#npsScoreGroup', 'show');
  safeCall($w, '#npsComment', 'show');
  safeCall($w, '#npsSubmitBtn', 'show');
  safeCall($w, '#npsSkipBtn', 'show');
  safeCall($w, '#npsThankYouMsg', 'hide');
  clearStatus($w);

  // Skip / dismiss — hides the widget without recording anything
  try {
    $w('#npsSkipBtn').onClick(() => {
      safeCall($w, '#npsSurveySection', 'hide');
    });
  } catch (_) {}

  // Submit — validate score, call backend, show confirmation
  try {
    $w('#npsSubmitBtn').onClick(async () => {
      clearStatus($w);

      const rawScore = safeGet($w, '#npsScoreGroup', 'value');
      const score    = rawScore != null ? Number(rawScore) : NaN;

      if (!Number.isInteger(score) || score < 0 || score > 10) {
        showStatus($w, 'Please select a score from 0 to 10.');
        return;
      }

      const comment = safeGet($w, '#npsComment', 'value');

      safeSet($w, '#npsSubmitBtn', 'disabled', true);

      let result;
      try {
        result = await submitSurveyResponse({ orderId, npsScore: score, comment: comment ?? undefined });
      } catch (err) {
        safeSet($w, '#npsSubmitBtn', 'disabled', false);
        showStatus($w, 'Something went wrong. Please try again.');
        return;
      }

      if (!result?.success) {
        safeSet($w, '#npsSubmitBtn', 'disabled', false);
        // Map known server errors to friendly copy
        if (result?.error === 'Survey already completed') {
          showThankYou($w, 'You\'ve already shared your feedback. Thank you!');
        } else if (result?.error === 'Authentication required') {
          showStatus($w, 'Please sign in to submit your feedback.');
        } else {
          showStatus($w, result?.error ?? 'Submission failed. Please try again.');
        }
        return;
      }

      showThankYou($w);
    });
  } catch (_) {}
}
