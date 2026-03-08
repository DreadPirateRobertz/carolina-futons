// Price Match Guarantee.js - Price Match Submission & Tracking Page
// Members can submit competitor price claims and track existing requests.
// Guest visitors see policy info and are prompted to log in.
import {
  submitPriceMatchRequest,
  getMyPriceMatches,
  getCompetitorSources,
} from 'backend/priceMatchService.web';
import { trackEvent } from 'public/engagementTracker';
import { colors } from 'public/designTokens.js';
import {
  validatePriceMatchFields,
  getCompetitorOptions,
  formatClaimStatus,
  getStatusColor,
  formatPrice,
  calculateSavings,
  getPriceMatchPolicy,
} from 'public/priceMatchHelpers.js';
import { initBackToTop } from 'public/mobileHelpers';
import { announce } from 'public/a11yHelpers.js';
import { sanitizeText } from 'public/validators';
import { initPageSeo } from 'public/pageSeo.js';

let _myRequests = [];

$w.onReady(async function () {
  initBackToTop($w);
  initPageSeo('priceMatch');
  initPolicySection();
  initFormSection();
  initRequestsSection();
  initErrorStates();

  await Promise.allSettled([
    loadMyRequests(),
    loadCompetitorSources(),
  ]);

  trackEvent('page_view', { page: 'price_match' });
});

// ── Policy Display ───────────────────────────────────────────────────

function initPolicySection() {
  try {
    const policy = getPriceMatchPolicy();
    try { $w('#priceMatchTitle').text = policy.title; } catch (e) {}
    try { $w('#priceMatchDescription').text = policy.description; } catch (e) {}

    // Policy rules repeater
    try {
      const rulesRepeater = $w('#policyRulesRepeater');
      if (rulesRepeater) {
        rulesRepeater.onItemReady(($item, itemData) => {
          try { $item('#policyRuleText').text = itemData.text; } catch (e) {}
        });
        rulesRepeater.data = policy.rules.map((r, i) => ({ _id: `rule-${i}`, text: r }));
      }
    } catch (e) {}

    // Exclusions repeater
    try {
      const exclusionsRepeater = $w('#policyExclusionsRepeater');
      if (exclusionsRepeater) {
        exclusionsRepeater.onItemReady(($item, itemData) => {
          try { $item('#exclusionText').text = itemData.text; } catch (e) {}
        });
        exclusionsRepeater.data = policy.exclusions.map((r, i) => ({ _id: `excl-${i}`, text: r }));
      }
    } catch (e) {}
  } catch (e) {}
}

// ── Submission Form ──────────────────────────────────────────────────

function initFormSection() {
  try {
    // ARIA labels
    try { $w('#pmProductName').accessibility.ariaLabel = 'Product name'; } catch (e) {}
    try { $w('#pmProductName').accessibility.ariaRequired = true; } catch (e) {}
    try { $w('#pmOurPrice').accessibility.ariaLabel = 'Our price for this product'; } catch (e) {}
    try { $w('#pmOurPrice').accessibility.ariaRequired = true; } catch (e) {}
    try { $w('#pmCompetitorSelect').accessibility.ariaLabel = 'Select competitor retailer'; } catch (e) {}
    try { $w('#pmCompetitorSelect').accessibility.ariaRequired = true; } catch (e) {}
    try { $w('#pmCompetitorPrice').accessibility.ariaLabel = 'Competitor price'; } catch (e) {}
    try { $w('#pmCompetitorPrice').accessibility.ariaRequired = true; } catch (e) {}
    try { $w('#pmCompetitorUrl').accessibility.ariaLabel = 'Link to competitor listing (optional)'; } catch (e) {}
    try { $w('#pmNotes').accessibility.ariaLabel = 'Additional notes (optional)'; } catch (e) {}
    try { $w('#pmSubmitBtn').accessibility.ariaLabel = 'Submit price match request'; } catch (e) {}

    // Populate competitor dropdown from static list
    try {
      const options = getCompetitorOptions();
      $w('#pmCompetitorSelect').options = options;
    } catch (e) {}

    // Live savings preview on price input changes
    try {
      $w('#pmOurPrice').onInput(() => updateSavingsPreview());
      $w('#pmCompetitorPrice').onInput(() => updateSavingsPreview());
    } catch (e) {}

    // Submit handler
    try {
      $w('#pmSubmitBtn').onClick(() => handleSubmit());
    } catch (e) {}
  } catch (e) {}
}

async function handleSubmit() {
  const productName = sanitizeText($w('#pmProductName').value, 200);
  const ourPrice = ($w('#pmOurPrice').value || '').toString().trim();
  const competitorName = getSelectedCompetitorName();
  const competitorPrice = ($w('#pmCompetitorPrice').value || '').toString().trim();
  const competitorUrl = sanitizeText($w('#pmCompetitorUrl').value, 500);
  const notes = sanitizeText($w('#pmNotes').value, 2000);

  hideAllErrors();

  const validation = validatePriceMatchFields({
    productName,
    ourPrice,
    competitorName,
    competitorPrice,
    competitorUrl,
    notes,
  });

  if (!validation.valid) {
    for (const err of validation.errors) {
      const errorMap = {
        productName: '#pmProductNameError',
        ourPrice: '#pmOurPriceError',
        competitorName: '#pmCompetitorError',
        competitorPrice: '#pmCompetitorPriceError',
        competitorUrl: '#pmCompetitorUrlError',
      };
      if (errorMap[err.field]) {
        showFieldError(errorMap[err.field], err.message);
      }
    }
    announce($w, 'Please fix the errors in the form');
    return;
  }

  try { $w('#pmSubmitBtn').disable(); } catch (e) {}
  try { $w('#pmSubmitBtn').label = 'Submitting...'; } catch (e) {}

  try {
    const result = await submitPriceMatchRequest({
      productId: getProductId(),
      productName,
      ourPrice: parseFloat(ourPrice),
      competitorName,
      competitorUrl,
      competitorPrice: parseFloat(competitorPrice),
      notes,
    });

    if (result.success) {
      try {
        $w('#pmSuccessMessage').text =
          `Your price match claim has been submitted! ` +
          `Claim number: ${result.request.claimNumber}. ` +
          `We'll review your request and respond within 2-3 business days.`;
        $w('#pmFormSection').hide('fade', { duration: 300 });
        $w('#pmSuccessSection').show('fade', { duration: 300 });
      } catch (e) {}

      announce($w, `Price match submitted. Claim number: ${result.request.claimNumber}`);
      trackEvent('price_match_submitted', {
        competitor: competitorName,
        savings: calculateSavings(parseFloat(ourPrice), parseFloat(competitorPrice)).amount,
      });

      await loadMyRequests();
    } else {
      showFormError(result.message || 'Unable to submit request. Please try again.');
    }
  } catch (err) {
    console.error('[PriceMatch] Submit error:', err);
    showFormError('Something went wrong. Please try again or call us at (828) 252-9449.');
  } finally {
    try { $w('#pmSubmitBtn').enable(); } catch (e) {}
    try { $w('#pmSubmitBtn').label = 'Submit Price Match'; } catch (e) {}
  }
}

function getSelectedCompetitorName() {
  try {
    const val = $w('#pmCompetitorSelect').value;
    if (!val) return '';
    const options = getCompetitorOptions();
    const match = options.find(o => o.value === val);
    return match ? match.label : val;
  } catch (e) {
    return '';
  }
}

function getProductId() {
  try {
    return $w('#pmProductId')?.value || 'manual-entry';
  } catch (e) {
    return 'manual-entry';
  }
}

function updateSavingsPreview() {
  try {
    const ourPrice = parseFloat($w('#pmOurPrice').value);
    const competitorPrice = parseFloat($w('#pmCompetitorPrice').value);
    const savings = calculateSavings(ourPrice, competitorPrice);

    if (savings.amount > 0) {
      $w('#pmSavingsPreview').text =
        `Potential savings: ${formatPrice(savings.amount)} (${savings.percentage}% off)`;
      $w('#pmSavingsPreview').style.color = colors.success || '#4A7C59';
      $w('#pmSavingsPreview').show();
    } else {
      $w('#pmSavingsPreview').hide();
    }
  } catch (e) {}
}

// ── Competitor Sources (from backend) ────────────────────────────────

async function loadCompetitorSources() {
  try {
    const { competitors } = await getCompetitorSources();
    if (competitors && competitors.length > 0) {
      // Backend may have updated competitor list — merge with static
      const backendOptions = competitors.map(c => ({ label: c.name, value: c.name.toLowerCase().replace(/\s+/g, '-') }));
      backendOptions.push({ label: 'Other', value: 'other' });
      $w('#pmCompetitorSelect').options = backendOptions;
    }
  } catch (e) {}
}

// ── My Requests ──────────────────────────────────────────────────────

function initRequestsSection() {
  try { $w('#pmRequestsSection').collapse(); } catch (e) {}

  // New request button (after successful submission)
  try {
    $w('#pmNewRequestBtn').onClick(() => {
      try { $w('#pmSuccessSection').hide(); } catch (e) {}
      try { $w('#pmFormSection').show('fade', { duration: 300 }); } catch (e) {}
      clearForm();
    });
    try { $w('#pmNewRequestBtn').accessibility.ariaLabel = 'Submit another price match request'; } catch (e) {}
  } catch (e) {}
}

async function loadMyRequests() {
  try {
    const { requests } = await getMyPriceMatches();
    _myRequests = requests || [];

    if (_myRequests.length === 0) {
      try { $w('#pmRequestsSection').collapse(); } catch (e) {}
      return;
    }

    try { $w('#pmRequestsSection').expand(); } catch (e) {}

    const repeater = $w('#pmRequestsRepeater');
    if (!repeater) return;

    repeater.data = _myRequests.map(r => ({ ...r, _id: r._id }));

    repeater.onItemReady(($item, itemData) => {
      try { $item('#pmReqClaimNumber').text = itemData.claimNumber; } catch (e) {}
      try { $item('#pmReqProductName').text = itemData.productName; } catch (e) {}
      try { $item('#pmReqOurPrice').text = formatPrice(itemData.ourPrice); } catch (e) {}
      try { $item('#pmReqCompetitorName').text = itemData.competitorName; } catch (e) {}
      try { $item('#pmReqCompetitorPrice').text = formatPrice(itemData.competitorPrice); } catch (e) {}
      try { $item('#pmReqSavings').text = formatPrice(itemData.priceDifference); } catch (e) {}

      // Status badge
      try {
        const statusText = formatClaimStatus(itemData.status);
        $item('#pmReqStatus').text = statusText;
        $item('#pmReqStatus').style.color = getStatusColor(itemData.status);
        try { $item('#pmReqStatus').accessibility.ariaLabel = `Claim status: ${statusText}`; } catch (e) {}
      } catch (e) {}

      // Credit amount (show only if approved/credited)
      try {
        if (itemData.creditAmount > 0) {
          $item('#pmReqCreditAmount').text = `Credit: ${formatPrice(itemData.creditAmount)}`;
          $item('#pmReqCreditAmount').show();
        } else {
          $item('#pmReqCreditAmount').hide();
        }
      } catch (e) {}

      // Admin notes (shown only for denied requests)
      try {
        if (itemData.adminNotes && itemData.status === 'denied') {
          $item('#pmReqAdminNotes').text = itemData.adminNotes;
          $item('#pmReqAdminNotes').show();
        } else {
          $item('#pmReqAdminNotes').hide();
        }
      } catch (e) {}

      // Date
      try {
        if (itemData._createdDate) {
          const d = new Date(itemData._createdDate);
          $item('#pmReqDate').text = d.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          });
        }
      } catch (e) {}
    });
  } catch (e) {}
}

// ── Error & UI Helpers ───────────────────────────────────────────────

function initErrorStates() {
  try { $w('#pmFormError').hide(); } catch (e) {}
  try { $w('#pmSuccessSection').hide(); } catch (e) {}
  try { $w('#pmSavingsPreview').hide(); } catch (e) {}
  hideAllErrors();
}

function showFieldError(elementId, message) {
  try {
    $w(elementId).text = message;
    $w(elementId).show();
    try { $w(elementId).accessibility.ariaLive = 'assertive'; } catch (e) {}
    try { $w(elementId).accessibility.role = 'alert'; } catch (e) {}
  } catch (e) {}
}

function hideAllErrors() {
  [
    '#pmProductNameError',
    '#pmOurPriceError',
    '#pmCompetitorError',
    '#pmCompetitorPriceError',
    '#pmCompetitorUrlError',
    '#pmFormError',
  ].forEach(id => {
    try { $w(id).hide(); } catch (e) {}
  });
}

function showFormError(message) {
  try {
    $w('#pmFormError').text = message;
    $w('#pmFormError').style.color = colors.error;
    try { $w('#pmFormError').accessibility.role = 'alert'; } catch (e) {}
    try { $w('#pmFormError').accessibility.ariaLive = 'assertive'; } catch (e) {}
    $w('#pmFormError').show('fade', { duration: 200 });
  } catch (e) {}
}

function clearForm() {
  try { $w('#pmProductName').value = ''; } catch (e) {}
  try { $w('#pmOurPrice').value = ''; } catch (e) {}
  try { $w('#pmCompetitorSelect').value = ''; } catch (e) {}
  try { $w('#pmCompetitorPrice').value = ''; } catch (e) {}
  try { $w('#pmCompetitorUrl').value = ''; } catch (e) {}
  try { $w('#pmNotes').value = ''; } catch (e) {}
  try { $w('#pmSavingsPreview').hide(); } catch (e) {}
  hideAllErrors();
}
