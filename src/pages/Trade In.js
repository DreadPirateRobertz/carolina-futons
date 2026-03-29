/**
 * @page Trade In
 * @url /trade-in
 * @description Trade-in / Trade-up page. Customers submit a trade-in request
 * online to get a store-credit estimate, then bring the item in-store for
 * staff confirmation and credit issuance.
 *
 * Multi-step flow:
 *   Step 1: Item details (type + condition) → live credit estimate
 *   Step 2: Contact info + optional photos
 *   Step 3: Confirmation / thank-you
 *
 * Editor hookup required:
 *   #tradeInStep1          — container for step 1
 *   #tradeInStep2          — container for step 2
 *   #tradeInStep3          — container for step 3 (thank-you)
 *   #itemTypeDropdown      — dropdown: 'frame' | 'mattress'
 *   #conditionDropdown     — dropdown: 'good' | 'fair' | 'poor'
 *   #estimateBox           — container shown when estimate is available
 *   #estimateText          — text: "$X–$Y estimated credit"
 *   #eligibilityError      — text: ineligibility message
 *   #firstNameInput        — text input
 *   #lastNameInput         — text input
 *   #emailInput            — text input
 *   #phoneInput            — text input
 *   #itemAgeInput          — text input (numeric)
 *   #photosUpload          — upload button (optional)
 *   #nextStep1Btn          — advance from step 1 to 2
 *   #submitBtn             — submit the request
 *   #backBtn               — go back to step 1
 *   #confirmationRequest   — text: confirmation request ID
 *   #confirmationEstimate  — text: confirmed credit estimate
 *   #validationError       — text: form validation error
 *   #loadingIndicator      — loading spinner
 */
import { getTradeInValuation, submitTradeInRequest } from 'backend/tradeInService.web';
import { announce } from 'public/a11yHelpers';

// ── Module state ──────────────────────────────────────────────────

let _itemType    = '';
let _condition   = '';
let _valuation   = null;   // { creditMin, creditMax, eligible }
let _photoUrls   = [];
let _loading     = false;

// ── $w.onReady ────────────────────────────────────────────────────

$w.onReady(async function () {
  _showStep(1);
  _bindDropdowns();
  _bindButtons();
  _bindUpload();
});

// ── Step navigation ───────────────────────────────────────────────

function _showStep(step) {
  try { $w('#tradeInStep1')[step === 1 ? 'show' : 'hide'](); } catch (_) { /* */ }
  try { $w('#tradeInStep2')[step === 2 ? 'show' : 'hide'](); } catch (_) { /* */ }
  try { $w('#tradeInStep3')[step === 3 ? 'show' : 'hide'](); } catch (_) { /* */ }

  // Reset errors on step change
  try { $w('#validationError').text = ''; $w('#validationError').hide(); } catch (_) { /* */ }
  try { $w('#eligibilityError').text = ''; $w('#eligibilityError').hide(); } catch (_) { /* */ }
}

// ── Dropdown bindings ─────────────────────────────────────────────

function _bindDropdowns() {
  try {
    $w('#itemTypeDropdown').onChange(() => {
      _itemType  = $w('#itemTypeDropdown').value;
      _condition = $w('#conditionDropdown').value;
      _refreshEstimate();
    });
  } catch (_) { /* */ }

  try {
    $w('#conditionDropdown').onChange(() => {
      _itemType  = $w('#itemTypeDropdown').value;
      _condition = $w('#conditionDropdown').value;
      _refreshEstimate();
    });
  } catch (_) { /* */ }
}

async function _refreshEstimate() {
  if (!_itemType || !_condition) return;

  try { $w('#estimateBox').hide(); } catch (_) { /* */ }
  try { $w('#eligibilityError').hide(); } catch (_) { /* */ }

  const result = await getTradeInValuation(_itemType, _condition);

  if (!result.success) {
    try { $w('#eligibilityError').text = result.message || 'Unable to calculate estimate.'; $w('#eligibilityError').show(); } catch (_) { /* */ }
    _valuation = null;
    return;
  }

  if (!result.eligible) {
    try { $w('#eligibilityError').text = result.message; $w('#eligibilityError').show(); } catch (_) { /* */ }
    _valuation = null;
    return;
  }

  _valuation = result;
  try {
    $w('#estimateText').text = `Estimated credit: $${result.creditMin}–$${result.creditMax}`;
    $w('#estimateBox').show('fade', { duration: 250 });
  } catch (_) { /* */ }
}

// ── Button bindings ───────────────────────────────────────────────

function _bindButtons() {
  try {
    $w('#nextStep1Btn').onClick(() => {
      if (!_valuation || !_valuation.eligible) {
        _showError('Please select an eligible item type and condition to continue.');
        return;
      }
      _showStep(2);
    });
  } catch (_) { /* */ }

  try {
    $w('#backBtn').onClick(() => _showStep(1));
  } catch (_) { /* */ }

  try {
    $w('#submitBtn').onClick(() => _handleSubmit());
  } catch (_) { /* */ }
}

// ── Upload binding ────────────────────────────────────────────────

function _bindUpload() {
  try {
    $w('#photosUpload').onChange(() => {
      const files = $w('#photosUpload').value;
      _photoUrls = Array.isArray(files) ? files.map(f => f.url || f).filter(Boolean) : [];
    });
  } catch (_) { /* */ }
}

// ── Form submission ───────────────────────────────────────────────

async function _handleSubmit() {
  if (_loading) return;

  const firstName = _getInputValue('#firstNameInput');
  const lastName  = _getInputValue('#lastNameInput');
  const email     = _getInputValue('#emailInput');
  const phone     = _getInputValue('#phoneInput');
  const itemAge   = Number(_getInputValue('#itemAgeInput')) || 0;

  if (!firstName) { _showError('First name is required.'); return; }
  if (!lastName)  { _showError('Last name is required.'); return; }
  if (!email)     { _showError('Email address is required.'); return; }

  _setLoading(true);
  try {
    const result = await submitTradeInRequest({
      firstName,
      lastName,
      email,
      phone,
      itemType: _itemType,
      submittedCondition: _condition,
      itemAge,
      photoUrls: _photoUrls,
    });

    if (!result.success) {
      _showError(result.message || 'Submission failed. Please try again.');
      return;
    }

    // Show confirmation step
    try { $w('#confirmationRequest').text = `Request ID: ${result.requestId}`; } catch (_) { /* */ }
    try { $w('#confirmationEstimate').text = `Estimated credit: $${result.creditMin}–$${result.creditMax}`; } catch (_) { /* */ }
    _showStep(3);
    announce('Trade-in request submitted successfully.');

  } catch (err) {
    console.error('[tradeInPage] Submission error:', err);
    _showError('An unexpected error occurred. Please try again.');
  } finally {
    _setLoading(false);
  }
}

// ── Internal helpers ──────────────────────────────────────────────

function _getInputValue(selector) {
  try { return ($w(selector).value || '').trim(); } catch (_) { return ''; }
}

function _showError(msg) {
  try {
    $w('#validationError').text = msg;
    $w('#validationError').show();
  } catch (_) { /* */ }
  announce(msg);
}

function _setLoading(on) {
  _loading = on;
  try { on ? $w('#loadingIndicator').show() : $w('#loadingIndicator').hide(); } catch (_) { /* */ }
  try { $w('#submitBtn').disable(); } catch (_) { /* */ }
  if (!on) {
    try { $w('#submitBtn').enable(); } catch (_) { /* */ }
  }
}
