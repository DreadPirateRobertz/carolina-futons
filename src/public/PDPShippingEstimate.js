/**
 * @module PDPShippingEstimate
 * @description Product Page shipping estimate badge — surfaces delivery cost
 * early to reduce checkout surprise (the #1 cart abandonment driver for furniture).
 *
 * Shows "Estimated delivery: $X / Free" badge on the PDP. Uses stored ZIP
 * from shippingPrefs module, with inline ZIP input fallback if no ZIP is saved.
 *
 * Element IDs:
 *   #shippingEstimateBadge   — Container box (collapsed when no estimate)
 *   #shippingEstimateText    — Text element showing cost + timeframe
 *   #shippingEstimateZipForm — Box containing ZIP input (shown when no stored ZIP)
 *   #shippingZipInput        — Input field for ZIP code
 *   #shippingZipSubmit       — Button to submit ZIP
 *   #shippingChangeZip       — Link/button to change ZIP (shown when estimate is displayed)
 *
 * CF-vu9m
 */

import { getStoredZip, setStoredZip } from 'public/shippingPrefs';
import { estimateDelivery, getShippingZone } from 'public/DeliveryEstimator.js';
import { colors } from 'public/designTokens.js';
import { announce } from 'public/a11yHelpers.js';

/**
 * Initialize the PDP shipping estimate widget.
 * Called from Product Page.js after state.product is set.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} product - Current product from dataset
 */
export async function initPDPShippingEstimate($w, product) {
  if (!product) return;

  try {
    // Set up ZIP input form
    setupZipForm($w, product);

    // Try to show estimate from stored ZIP
    const storedZip = await getStoredZip();
    if (storedZip && /^\d{5}$/.test(storedZip)) {
      await showEstimate($w, product, storedZip);
    } else {
      showZipForm($w);
    }
  } catch (err) {
    // Non-critical — hide badge silently
    try { $w('#shippingEstimateBadge').collapse(); } catch (_) {}
  }
}

/**
 * Set up ZIP input form handlers.
 */
function setupZipForm($w, product) {
  try {
    const input = $w('#shippingZipInput');
    const submit = $w('#shippingZipSubmit');
    const changeLink = $w('#shippingChangeZip');

    // Style the submit button
    try {
      submit.style.backgroundColor = colors.mountainBlue;
      submit.style.color = colors.white;
    } catch (_) {}

    // Submit button click
    submit.onClick(async () => {
      const zip = (input.value || '').replace(/[^0-9]/g, '').slice(0, 5);
      if (zip.length !== 5) {
        try {
          input.style.borderColor = colors.error;
          announce($w, 'Please enter a valid 5-digit ZIP code');
        } catch (_) {}
        return;
      }

      try { input.style.borderColor = ''; } catch (_) {}

      // Save ZIP for reuse across pages
      setStoredZip(zip).catch(() => {});
      await showEstimate($w, product, zip);
    });

    // "Change ZIP" link click — re-show the form
    changeLink.onClick(() => {
      showZipForm($w);
    });

    // Enter key on input triggers submit
    input.onKeyPress((event) => {
      if (event.key === 'Enter') {
        submit.click();
      }
    });

    // ARIA labels
    try {
      input.accessibility.ariaLabel = 'Enter your ZIP code for shipping estimate';
      submit.accessibility.ariaLabel = 'Get shipping estimate';
    } catch (_) {}
  } catch (_) {}
}

/**
 * Show the ZIP input form (no stored ZIP available).
 */
function showZipForm($w) {
  try {
    $w('#shippingEstimateBadge').expand();
    $w('#shippingEstimateText').collapse();
    $w('#shippingChangeZip').collapse();
    $w('#shippingEstimateZipForm').expand();
  } catch (_) {}
}

/**
 * Show the shipping estimate badge with cost + timeframe.
 */
async function showEstimate($w, product, zip) {
  try {
    const result = await estimateDelivery(zip, product);
    if (!result.success) {
      showZipForm($w);
      return;
    }

    const badge = $w('#shippingEstimateText');
    badge.text = formatBadgeText(result, zip);

    // Style based on free vs paid
    try {
      if (result.shippingCost === 0) {
        badge.style.color = colors.success;
      } else {
        badge.style.color = colors.espresso;
      }
    } catch (_) {}

    // Set ARIA
    try {
      badge.accessibility.role = 'status';
      badge.accessibility.ariaLabel = `Shipping to ${zip}: ${result.shippingText}. ${result.deliveryText}`;
    } catch (_) {}

    // Show estimate, hide form
    $w('#shippingEstimateBadge').expand();
    $w('#shippingEstimateText').expand();
    $w('#shippingEstimateZipForm').collapse();
    $w('#shippingChangeZip').expand();

    // Show white-glove option if available
    try {
      if (result.whiteGlove) {
        $w('#shippingChangeZip').text = `Change ZIP (${zip})`;
      } else {
        $w('#shippingChangeZip').text = `Change ZIP (${zip})`;
      }
    } catch (_) {}

    announce($w, `Shipping estimate updated: ${result.shippingText}`);
  } catch (err) {
    showZipForm($w);
  }
}

/**
 * Format the badge text for display.
 * @param {Object} result - estimateDelivery result
 * @param {string} zip - ZIP code
 * @returns {string} Formatted badge text
 */
function formatBadgeText(result, zip) {
  if (result.shippingCost === 0) {
    return `FREE shipping to ${zip} \u2022 ${result.estimatedDays}`;
  }
  return `$${result.shippingCost.toFixed(2)} shipping to ${zip} \u2022 ${result.estimatedDays}`;
}
