/**
 * NpsSurveyWidget.js — Post-delivery NPS/CSAT survey widget.
 *
 * Shows a 1–10 satisfaction prompt and optional comment field when the
 * member's order status is 'delivered'.  Collapses for non-delivered orders
 * and hides permanently after a successful submission.
 *
 * Required Wix Studio elements:
 *   #npsSurveySection   Box    — outer wrapper
 *   #npsScoreInput      NumberInput (or Slider) — 1–10 score
 *   #npsCommentInput    TextInput  — optional free-text comment
 *   #npsSubmitBtn       Button     — submit survey
 *   #npsSkipBtn         Button     — dismiss without scoring
 *   #npsSuccessMsg      Text       — shown after successful submission
 *   #npsErrorMsg        Text       — shown on submission error
 *
 * CF-c18
 */
import {
  submitNpsResponse as _defaultSubmitNpsResponse,
} from 'backend/npsSurveyService.web';

// ── Module init ───────────────────────────────────────────────────────────────

/**
 * Initialize the NPS survey widget.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.$w]                  — Wix selector
 * @param {Object}  [opts.state]                — { order: { _id, status } }
 * @param {Function} [opts.submitNpsResponse]   — backend webMethod
 * @returns {{ destroy: Function }}
 */
export function initNpsSurveyWidget(opts = {}) {
  const $w          = opts.$w    ?? globalThis.$w;
  const state       = opts.state ?? null;
  const submitNps   = opts.submitNpsResponse ?? _defaultSubmitNpsResponse;

  const order = state?.order ?? null;

  // Only show for delivered orders
  if (!order || order.status !== 'delivered') {
    try { $w('#npsSurveySection').collapse(); } catch (_) {}
    return { destroy() {} };
  }

  try { $w('#npsSurveySection').expand(); } catch (_) {}

  // Hide feedback banners initially
  try { $w('#npsSuccessMsg').hide(); } catch (_) {}
  try { $w('#npsErrorMsg').hide();   } catch (_) {}

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit() {
    const score   = $w('#npsScoreInput').value;
    const comment = $w('#npsCommentInput').value ?? '';

    const parsed = typeof score === 'string' ? parseInt(score, 10) : score;
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      try {
        $w('#npsErrorMsg').text = 'Please choose a score from 1 to 10.';
        $w('#npsErrorMsg').show();
      } catch (_) {}
      return;
    }

    try { $w('#npsErrorMsg').hide(); } catch (_) {}

    submitNps({ orderId: order._id, score: parsed, comment })
      .then((result) => {
        if (result.success) {
          try {
            $w('#npsSuccessMsg').text = 'Thank you for your feedback!';
            $w('#npsSuccessMsg').show();
            $w('#npsSurveySection').collapse();
          } catch (_) {}
        } else {
          try {
            $w('#npsErrorMsg').text = 'Unable to submit your response. Please try again.';
            $w('#npsErrorMsg').show();
          } catch (_) {}
        }
      })
      .catch(() => {
        try {
          $w('#npsErrorMsg').text = 'Unable to submit your response. Please try again.';
          $w('#npsErrorMsg').show();
        } catch (_) {}
      });
  }

  // ── Skip ───────────────────────────────────────────────────────────────────

  function handleSkip() {
    try { $w('#npsSurveySection').collapse(); } catch (_) {}
  }

  try { $w('#npsSubmitBtn').onClick(handleSubmit); } catch (_) {}
  try { $w('#npsSkipBtn').onClick(handleSkip);   } catch (_) {}

  return { destroy() {} };
}
