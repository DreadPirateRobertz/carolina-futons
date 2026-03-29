/**
 * Trade In.js — Customer-facing Trade-In / Trade-Up page.
 *
 * Flow:
 * 1. Customer selects product type + condition → live estimate shown
 * 2. Customer fills contact info + optional description + photo upload
 * 3. Submit → confirmation panel with request ID shown
 * 4. Status lookup by request ID + email
 *
 * Wix elements:
 *   #tradeInTitle, #tradeInSubtitle
 *   #productTypeDropdown, #conditionDropdown
 *   #estimateSection, #estimateText, #estimateRange
 *   #nameInput, #emailInput, #phoneInput, #descriptionInput
 *   #photoUpload
 *   #submitTradeInBtn
 *   #errorText
 *   #confirmationSection, #confirmationRequestId, #confirmationEstimate
 *   #statusSection, #statusRequestIdInput, #statusEmailInput, #checkStatusBtn
 *   #statusResult
 */

import { estimateTradeIn, submitTradeInRequest, getTradeInRequest } from 'backend/tradeInService.web';
import { buildConditionOptions, formatEstimateText } from 'public/TradeInWidget.js';
import { announce } from 'public/a11yHelpers.js';
import { trackEvent } from 'public/engagementTracker';
import { sanitizeText } from 'public/validators';

let _submitting = false;

$w.onReady(async function () {
  initPage();
  initEstimateForm();
  initSubmitForm();
  initStatusLookup();
  prefillFromQueryParams();
  trackEvent('page_view', { page: 'trade_in' });
});

// ── Initialization ───────────────────────────────────────────────────

function initPage() {
  try { $w('#tradeInTitle').text = 'Trade In & Trade Up'; } catch (_) {}
  try {
    $w('#tradeInSubtitle').text =
      'Bring your old futon, mattress, or cabinet bed to our Hendersonville showroom ' +
      'and put its value toward something new. Get an instant credit estimate below.';
  } catch (_) {}

  try { $w('#estimateSection').hide(); } catch (_) {}
  try { $w('#confirmationSection').hide(); } catch (_) {}
  try { $w('#errorText').hide(); } catch (_) {}
}

function initEstimateForm() {
  const conditions = buildConditionOptions();

  try {
    $w('#productTypeDropdown').options = [
      { label: 'Futon Frame', value: 'futon-frame' },
      { label: 'Futon Mattress', value: 'futon-mattress' },
      { label: 'Murphy Cabinet Bed', value: 'murphy-bed' },
      { label: 'Platform Bed', value: 'platform-bed' },
      { label: 'Sofa', value: 'sofa' },
    ];
    $w('#productTypeDropdown').placeholder = 'Select item type…';
    $w('#productTypeDropdown').accessibility.ariaLabel = 'Type of item to trade in';
  } catch (_) {}

  try {
    $w('#conditionDropdown').options = conditions.map(c => ({ label: c.label, value: c.value }));
    $w('#conditionDropdown').placeholder = 'Select condition…';
    $w('#conditionDropdown').accessibility.ariaLabel = 'Condition of item to trade in';
  } catch (_) {}

  try {
    $w('#productTypeDropdown').onChange(() => fetchEstimate());
    $w('#conditionDropdown').onChange(() => fetchEstimate());
  } catch (_) {}
}

function initSubmitForm() {
  try { $w('#nameInput').accessibility.ariaLabel = 'Your name'; } catch (_) {}
  try { $w('#emailInput').accessibility.ariaLabel = 'Your email address'; } catch (_) {}
  try { $w('#phoneInput').accessibility.ariaLabel = 'Your phone number (optional)'; } catch (_) {}
  try {
    $w('#descriptionInput').accessibility.ariaLabel =
      'Describe your item — brand, age, any known issues';
  } catch (_) {}

  try {
    $w('#submitTradeInBtn').onClick(() => handleSubmit());
    $w('#submitTradeInBtn').label = 'Submit Trade-In Request';
  } catch (_) {}
}

function initStatusLookup() {
  try { $w('#statusRequestIdInput').accessibility.ariaLabel = 'Trade-in request ID (e.g. TI-ABCD1234)'; } catch (_) {}
  try { $w('#statusEmailInput').accessibility.ariaLabel = 'Email address used in your request'; } catch (_) {}
  try { $w('#checkStatusBtn').onClick(() => handleStatusLookup()); } catch (_) {}
  try { $w('#statusSection').hide(); } catch (_) {}

  try {
    $w('#showStatusLookupBtn').onClick(() => {
      try { $w('#statusSection').show(); } catch (_) {}
    });
  } catch (_) {}
}

function prefillFromQueryParams() {
  try {
    const { query } = wixLocation;
    if (query?.type) {
      try { $w('#productTypeDropdown').value = query.type; } catch (_) {}
    }
    if (query?.condition) {
      try { $w('#conditionDropdown').value = query.condition; } catch (_) {}
    }
    if (query?.type && query?.condition) fetchEstimate();
  } catch (_) {}
}

// ── Live Estimate ────────────────────────────────────────────────────

async function fetchEstimate() {
  let productType, condition;
  try {
    productType = $w('#productTypeDropdown').value;
    condition = $w('#conditionDropdown').value;
  } catch (_) { return; }

  if (!productType || !condition) return;

  try { $w('#estimateSection').show(); } catch (_) {}
  try { $w('#estimateText').text = 'Calculating…'; } catch (_) {}
  try { $w('#estimateRange').hide(); } catch (_) {}

  try {
    const result = await estimateTradeIn(productType, condition);

    if (!result.eligible) {
      try { $w('#estimateText').text = 'This item type is not eligible for trade-in.'; } catch (_) {}
      return;
    }

    const rangeText = formatEstimateText(result);
    try { $w('#estimateText').text = rangeText; } catch (_) {}
    try { $w('#estimateRange').show(); } catch (_) {}
    announce(rangeText);
    trackEvent('trade_in_estimate_viewed', { productType, condition, min: result.min, max: result.max });
  } catch (err) {
    try { $w('#estimateText').text = 'Could not load estimate — please try again.'; } catch (_) {}
  }
}

// ── Form Submission ──────────────────────────────────────────────────

async function handleSubmit() {
  if (_submitting) return;

  let name, email, phone, description;
  try {
    name = sanitizeText($w('#nameInput').value || '');
    email = sanitizeText($w('#emailInput').value || '');
    phone = sanitizeText($w('#phoneInput').value || '');
    description = sanitizeText($w('#descriptionInput').value || '');
  } catch (_) { return; }

  // Client-side validation
  if (!name.trim()) {
    showError('Please enter your name.');
    try { $w('#nameInput').focus(); } catch (_) {}
    return;
  }
  if (!email.trim() || !email.includes('@')) {
    showError('Please enter a valid email address.');
    try { $w('#emailInput').focus(); } catch (_) {}
    return;
  }

  let productType, condition;
  try {
    productType = $w('#productTypeDropdown').value;
    condition = $w('#conditionDropdown').value;
  } catch (_) {}

  if (!productType) {
    showError('Please select the type of item you want to trade in.');
    return;
  }
  if (!condition) {
    showError('Please select the condition of your item.');
    return;
  }

  // Collect photo URLs if uploader present
  let photoUrls = [];
  try {
    const files = $w('#photoUpload').value;
    if (Array.isArray(files)) {
      photoUrls = files
        .map(f => f.fileUrl || f.url || '')
        .filter(Boolean)
        .slice(0, 5);
    }
  } catch (_) {}

  _submitting = true;
  try { $w('#submitTradeInBtn').disable(); } catch (_) {}
  try { $w('#submitTradeInBtn').label = 'Submitting…'; } catch (_) {}
  hideError();

  try {
    const result = await submitTradeInRequest({
      name, email, phone, productType, condition, description, photoUrls,
    });

    if (!result.success) {
      const messages = {
        name_required:        'Please enter your name.',
        invalid_email:        'Please enter a valid email address.',
        invalid_product_type: 'Please select a valid item type.',
        invalid_condition:    'Please select a valid condition.',
        rate_limited:         'Too many requests — please wait 24 hours before submitting again.',
        submission_failed:    'Submission failed — please try again.',
      };
      showError(messages[result.error] || 'Something went wrong. Please try again.');
      return;
    }

    showConfirmation(result);
    trackEvent('trade_in_submitted', {
      productType,
      condition,
      estimatedCredit: result.estimatedCredit,
      requestId: result.requestId,
    });
  } catch (err) {
    showError('Submission failed — please try again.');
  } finally {
    _submitting = false;
    try { $w('#submitTradeInBtn').enable(); } catch (_) {}
    try { $w('#submitTradeInBtn').label = 'Submit Trade-In Request'; } catch (_) {}
  }
}

// ── Status Lookup ────────────────────────────────────────────────────

async function handleStatusLookup() {
  let requestId, email;
  try {
    requestId = ($w('#statusRequestIdInput').value || '').trim().toUpperCase();
    email = ($w('#statusEmailInput').value || '').trim();
  } catch (_) { return; }

  if (!requestId || !email) {
    try { $w('#statusResult').text = 'Please enter your request ID and email.'; } catch (_) {}
    return;
  }

  try { $w('#statusResult').text = 'Looking up…'; } catch (_) {}

  try {
    const result = await getTradeInRequest(requestId, email);
    if (!result.success) {
      const msg = result.error === 'not_found'
        ? 'No request found for that ID and email.'
        : 'Lookup failed — please try again.';
      try { $w('#statusResult').text = msg; } catch (_) {}
      return;
    }

    const { request } = result;
    const statusLabels = {
      pending:   'Pending — bring your item to our showroom at 824 Locust St, Hendersonville.',
      confirmed: `Confirmed — $${request.estimatedMin ?? 0}–$${request.estimatedMax ?? 0} store credit issued.`,
      declined:  'Declined — item did not meet trade-in criteria.',
      expired:   'Expired — request is older than 30 days.',
    };
    const statusText = statusLabels[request.status] || request.status;
    try { $w('#statusResult').text = statusText; } catch (_) {}
    announce(statusText);
  } catch (err) {
    try { $w('#statusResult').text = 'Lookup failed — please try again.'; } catch (_) {}
  }
}

// ── UI Helpers ───────────────────────────────────────────────────────

function showConfirmation(result) {
  try { $w('#tradeInForm').hide(); } catch (_) {}
  try { $w('#estimateSection').hide(); } catch (_) {}

  try {
    $w('#confirmationSection').show();
    $w('#confirmationRequestId').text = `Your request ID: ${result.requestId}`;
    const rangeText = result.estimatedMin !== undefined && result.estimatedMax !== undefined
      ? `$${result.estimatedMin}–$${result.estimatedMax}`
      : `$${result.estimatedCredit}`;
    $w('#confirmationEstimate').text =
      `Estimated credit: ${rangeText} (confirmed in-store upon item inspection).`;
  } catch (_) {}

  announce(`Trade-in request submitted. Your request ID is ${result.requestId}.`);
}

function showError(message) {
  try {
    $w('#errorText').text = message;
    $w('#errorText').show();
  } catch (_) {}
  announce(message);
}

function hideError() {
  try { $w('#errorText').hide(); } catch (_) {}
}
