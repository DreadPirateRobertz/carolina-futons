/**
 * Survey.js — NPS/CSAT post-purchase survey page controller.
 * Displays an NPS score picker (0–10) and optional comment field.
 * Order ID is read from URL params or session storage.
 *
 * Elements:
 *   #surveyNpsSlider     — NPS score picker (0–10, slider or button group)
 *   #surveyNpsScore      — Text element displaying selected score
 *   #surveyComment       — Comment textarea (optional)
 *   #surveySubmitBtn     — Submit button
 *   #surveySuccessMsg    — Success container (collapsed by default)
 *   #surveyErrorMsg      — Error text element (collapsed by default)
 *   #surveyAlreadyDone   — Shown if survey already completed (collapsed by default)
 *   #surveyLoadingIndicator — Loading spinner
 *
 * URL params:
 *   orderId — the order to submit the survey for
 *
 * CF-1mlj
 */
import { submitSurveyResponse, getSurveyForOrder } from 'backend/surveyService.web';
import wixLocation from 'wix-location';
import { safeCall, safeCollapse, safeExpand, safeText } from 'public/safeInit';

let _selectedScore = null;

$w.onReady(async function () {
  await initSurveyPage($w);
});

/**
 * Initialize the NPS survey page.
 *
 * @param {Function} $w — Wix selector function
 */
export async function initSurveyPage($w) {
  _selectedScore = null; // reset on each page init
  const { orderId = '' } = wixLocation.query || {};

  safeCollapse($w, '#surveySuccessMsg');
  safeCollapse($w, '#surveyErrorMsg');
  safeCollapse($w, '#surveyAlreadyDone');
  safeCall(() => $w('#surveyLoadingIndicator').hide());

  if (!orderId) {
    _showError($w, 'No order ID found. Please use the link from your survey email.');
    return;
  }

  // Check if already completed
  safeCall(() => $w('#surveyLoadingIndicator').show());
  try {
    const statusResult = await getSurveyForOrder(orderId);
    safeCall(() => $w('#surveyLoadingIndicator').hide());

    if (statusResult.success && statusResult.survey?.isCompleted) {
      safeExpand($w, '#surveyAlreadyDone');
      return;
    }
  } catch (err) {
    console.warn('[Survey] getSurveyForOrder failed:', err);
    safeCall(() => $w('#surveyLoadingIndicator').hide());
  }

  // Wire NPS score selection
  safeCall(() => {
    $w('#surveyNpsSlider').onChange((event) => {
      _selectedScore = Number(event.target.value);
      safeText($w, '#surveyNpsScore', String(_selectedScore));
    });
  });

  // Wire submit button
  safeCall(() => {
    $w('#surveySubmitBtn').onClick(async () => {
      await _handleSubmit($w, orderId);
    });
  });
}

async function _handleSubmit($w, orderId) {
  safeCollapse($w, '#surveyErrorMsg');

  if (_selectedScore === null) {
    _showError($w, 'Please select a score (0–10) before submitting.');
    return;
  }

  let comment = '';
  safeCall(() => { comment = $w('#surveyComment')?.value || ''; });

  safeCall(() => $w('#surveySubmitBtn').disable());
  safeCall(() => $w('#surveyLoadingIndicator').show());

  try {
    const result = await submitSurveyResponse({
      orderId,
      npsScore: _selectedScore,
      comment: comment.trim() || null,
    });

    safeCall(() => $w('#surveyLoadingIndicator').hide());

    if (result.success) {
      safeExpand($w, '#surveySuccessMsg');
      safeCall(() => $w('#surveySubmitBtn').hide());
      safeCall(() => $w('#surveyNpsSlider').disable());
    } else {
      safeCall(() => $w('#surveySubmitBtn').enable());
      _showError($w, result.error || 'Submission failed. Please try again.');
    }
  } catch (err) {
    console.error('[Survey] submitSurveyResponse threw:', err);
    safeCall(() => $w('#surveyLoadingIndicator').hide());
    safeCall(() => $w('#surveySubmitBtn').enable());
    _showError($w, 'An unexpected error occurred. Please try again.');
  }
}

function _showError($w, message) {
  safeExpand($w, '#surveyErrorMsg');
  safeText($w, '#surveyErrorMsg', message);
}
