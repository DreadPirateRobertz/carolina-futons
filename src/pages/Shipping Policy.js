// Shipping Policy.js - "Getting It Home" / Delivery Experience
// Shipping calculator, delivery zones, assembly guides, care tips, delivery prep
import { getBusinessSchema } from 'backend/seoHelpers.web';
import { getAllAssemblyGuides, getDeliveryInstructions } from 'backend/deliveryExperience.web';
import { getProductGuides } from 'backend/postPurchaseCare.web';
import { getAvailableDeliverySlots } from 'backend/deliveryScheduling.web';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
import { initBackToTop } from 'public/mobileHelpers';
import { initPageSeo } from 'public/pageSeo.js';

$w.onReady(async function () {
  initBackToTop($w);
  initPageSeo('shippingPolicy');
  initShippingCalculator();
  initDeliveryInfo();

  // Load all sections in parallel — each handles its own errors
  await Promise.allSettled([
    initAssemblyGuides(),
    initCareTips(),
    initDeliveryPrep(),
    initDeliveryScheduling(),
    injectShippingSchema(),
  ]);

  trackEvent('page_view', { page: 'shipping_policy' });
});

// ── Shipping Cost Estimator ─────────────────────────────────────────

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

  try {
    $w('#assemblyTips').text =
      'Most of our furniture arrives ready to assemble with clear instructions and all hardware included. ' +
      'KD Frames products typically assemble in under an hour. Night & Day futon frames include illustrated ' +
      'step-by-step guides. Need help? Our local delivery team can handle assembly for you.';
  } catch (e) {}
}

// ── Assembly Guides Section ─────────────────────────────────────────

async function initAssemblyGuides() {
  try {
    const result = await getAllAssemblyGuides();
    if (!result?.success || !result.guides) return;

    const repeater = $w('#assemblyGuidesRepeater');
    if (!repeater) return;

    const guidesData = Object.entries(result.guides).map(([category, guide]) => ({
      _id: category,
      title: guide.title,
      estimatedTime: guide.estimatedTime,
      toolsNeeded: guide.toolsNeeded || [],
      steps: guide.steps || [],
      videoUrl: guide.videoUrl || '',
    }));

    repeater.onItemReady(($item, itemData) => {
      try { $item('#guideTitle').text = itemData.title; } catch (e) {}
      try { $item('#guideTime').text = `Estimated time: ${itemData.estimatedTime}`; } catch (e) {}
      try {
        $item('#guideTools').text = itemData.toolsNeeded.length > 0
          ? `Tools needed: ${itemData.toolsNeeded.join(', ')}`
          : 'No tools required';
      } catch (e) {}
      try {
        $item('#guideSteps').text = itemData.steps
          .map((step, i) => `${i + 1}. ${step}`)
          .join('\n');
      } catch (e) {}
      try {
        $item('#guideTitle').accessibility.ariaLabel = `Assembly guide: ${itemData.title}, ${itemData.estimatedTime}`;
      } catch (e) {}
      try {
        $item('#guideExpandBtn').onClick(() => {
          trackEvent('assembly_guide_view', { category: itemData._id });
        });
      } catch (e) {}
    });

    repeater.data = guidesData;
  } catch (e) {}
}

// ── Care Tips Section ───────────────────────────────────────────────

async function initCareTips() {
  try {
    try {
      $w('#careCategoryDropdown').accessibility.ariaLabel = 'Select product category for care guides';
    } catch (e) {}

    // Load default category
    await loadCareGuides('futon-frames');

    // Set up category switching
    try {
      $w('#careCategoryDropdown').onChange(async (event) => {
        const category = event.target.value;
        trackEvent('care_guide_category', { category });
        await loadCareGuides(category);
      });
    } catch (e) {}
  } catch (e) {}
}

async function loadCareGuides(category) {
  try {
    const result = await getProductGuides(category);
    if (!result?.success) return;

    const repeater = $w('#careTipsRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      try { $item('#careTipTitle').text = itemData.title; } catch (e) {}
      try { $item('#careTipSummary').text = itemData.summary; } catch (e) {}
      try {
        $item('#careTipSteps').text = (itemData.steps || [])
          .map((step, i) => `${i + 1}. ${step}`)
          .join('\n');
      } catch (e) {}
      try {
        if (itemData.videoUrl) {
          $item('#careTipVideoLink').show();
        } else {
          $item('#careTipVideoLink').hide();
        }
      } catch (e) {}
    });

    repeater.data = result.guides || [];
  } catch (e) {}
}

// ── Delivery Preparation Section ────────────────────────────────────

async function initDeliveryPrep() {
  try {
    try {
      $w('#deliveryTierDropdown').accessibility.ariaLabel = 'Select your delivery type for preparation tips';
    } catch (e) {}

    // Load default tier
    await loadDeliveryPrep('standard');

    // Set up tier switching
    try {
      $w('#deliveryTierDropdown').onChange(async (event) => {
        const tier = event.target.value;
        trackEvent('delivery_prep_tier', { tier });
        await loadDeliveryPrep(tier);
      });
    } catch (e) {}
  } catch (e) {}
}

async function loadDeliveryPrep(tier) {
  try {
    const result = await getDeliveryInstructions(tier);
    if (!result?.success || !result.data) return;

    const { instructions, tips } = result.data;

    try {
      $w('#deliveryPrepInstructions').text = instructions
        .map((inst, i) => `${i + 1}. ${inst}`)
        .join('\n');
    } catch (e) {}

    try {
      $w('#deliveryPrepTips').text = tips
        .map(tip => `• ${tip}`)
        .join('\n');
    } catch (e) {}
  } catch (e) {}
}

// ── Delivery Scheduling Section ─────────────────────────────────────

async function initDeliveryScheduling() {
  try {
    const result = await getAvailableDeliverySlots('white_glove_local');
    if (!result?.success) {
      try { $w('#nextAvailableSlot').text = 'Call (828) 252-9449 to schedule your delivery.'; } catch (e) {}
      return;
    }

    const slots = result.slots || [];
    const availableSlots = slots.filter(s => s.available);

    if (availableSlots.length === 0) {
      try { $w('#nextAvailableSlot').text = 'Call (828) 252-9449 to schedule your delivery.'; } catch (e) {}
    } else {
      const next = availableSlots[0];
      try {
        $w('#nextAvailableSlot').text = `Next available: ${next.dayOfWeek}, ${formatSlotDate(next.date)} — ${next.startTime} to ${next.endTime}`;
      } catch (e) {}
    }

    try {
      $w('#scheduleDeliveryBtn').onClick(() => {
        trackEvent('schedule_delivery_click', {});
      });
    } catch (e) {}
  } catch (e) {}
}

function formatSlotDate(dateStr) {
  try {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
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
