// Shipping Policy.js - "Getting It Home" / Shipping Info
// Shipping calculator, delivery zones, and FAQ
import { getBusinessSchema } from 'backend/seoHelpers.web';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
import { initBackToTop } from 'public/mobileHelpers';

$w.onReady(async function () {
  initBackToTop($w);
  initShippingCalculator();
  initDeliveryInfo();
  await injectShippingSchema();
  trackEvent('page_view', { page: 'shipping_policy' });
});

// ── Shipping Cost Estimator ─────────────────────────────────────────
// Let customers estimate shipping before checkout

function initShippingCalculator() {
  try {
    const zipInput = $w('#shippingZipInput');
    const calcBtn = $w('#shippingCalcBtn');
    const resultText = $w('#shippingResult');

    if (!zipInput || !calcBtn) return;

    try { zipInput.accessibility.ariaLabel = 'Enter your ZIP code for shipping estimate'; } catch (e) {}
    try { calcBtn.accessibility.ariaLabel = 'Calculate shipping cost'; } catch (e) {}

    calcBtn.onClick(() => {
      const zip = zipInput.value?.trim();
      if (!zip || !/^\d{5}$/.test(zip)) {
        try { resultText.text = 'Please enter a valid 5-digit ZIP code'; } catch (e) {}
        return;
      }

      // Determine shipping zone based on ZIP prefix
      const zone = getShippingZone(zip);
      trackEvent('shipping_calculator', { zip, zone: zone.zone });
      try {
        resultText.text = zone.message;
        resultText.show('fade', { duration: 200 });
        announce($w, zone.message);
      } catch (e) {}
    });
  } catch (e) {}
}

function getShippingZone(zip) {
  const prefix = parseInt(zip.substring(0, 3));

  // NC local area (Henderson County and surrounding)
  if (prefix >= 287 && prefix <= 289) {
    return {
      zone: 'local',
      message: 'Local delivery may be available! Contact us at (828) 252-9449 for details and scheduling. Free delivery on orders over $999.',
    };
  }

  // Southeast US
  if ((prefix >= 270 && prefix <= 289) || // NC (non-local)
      (prefix >= 290 && prefix <= 299) || // SC
      (prefix >= 300 && prefix <= 319) || // GA
      (prefix >= 320 && prefix <= 339) || // FL
      (prefix >= 350 && prefix <= 369) || // AL
      (prefix >= 370 && prefix <= 385)) { // TN
    return {
      zone: 'regional',
      message: 'Standard shipping to your area. Free shipping on orders over $999! Estimated delivery: 5-10 business days.',
    };
  }

  // Rest of US
  return {
    zone: 'national',
    message: 'We ship nationwide! Free shipping on orders over $999. Estimated delivery: 7-14 business days. Exact shipping calculated at checkout.',
  };
}

// ── Delivery Information ────────────────────────────────────────────

function initDeliveryInfo() {
  const deliveryMethods = [
    {
      _id: '1',
      title: 'Standard Shipping',
      description: 'Delivered to your door via common carrier. Most items ship within 3-5 business days.',
      icon: 'truck',
    },
    {
      _id: '2',
      title: 'Local Delivery',
      description: 'Available in the Hendersonville/Asheville area. We can set up your furniture for you!',
      icon: 'home',
    },
    {
      _id: '3',
      title: 'In-Store Pickup',
      description: 'Pick up from our showroom at 824 Locust St, Ste 200, Hendersonville, NC 28792.',
      icon: 'store',
    },
    {
      _id: '4',
      title: 'White Glove Delivery',
      description: 'Full assembly and placement in your home. Available in select areas — call for details.',
      icon: 'star',
    },
  ];

  try {
    const repeater = $w('#deliveryRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      $item('#deliveryTitle').text = itemData.title;
      $item('#deliveryDesc').text = itemData.description;
      try { $item('#deliveryTitle').accessibility.ariaLabel = `${itemData.title}: ${itemData.description}`; } catch (e) {}
    });
    repeater.data = deliveryMethods;
  } catch (e) {}

  // Assembly tips section
  try {
    $w('#assemblyTips').text =
      'Most of our furniture arrives ready to assemble with clear instructions and all hardware included. ' +
      'KD Frames products typically assemble in under an hour. Night & Day futon frames include illustrated ' +
      'step-by-step guides. Need help? Our local delivery team can handle assembly for you.';
  } catch (e) {}
}

// ── Schema Injection ────────────────────────────────────────────────

async function injectShippingSchema() {
  try {
    const schema = await getBusinessSchema();
    if (schema) {
      $w('#shippingSchemaHtml').postMessage(schema);
    }
  } catch (e) {}
}
