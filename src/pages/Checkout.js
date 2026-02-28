// Checkout.js - Checkout Page
// Trust signals, order notes, payment options, address validation,
// shipping selection, engagement tracking, delivery estimate
import { trackCheckoutStart } from 'public/engagementTracker';
import { fireInitiateCheckout } from 'public/ga4Tracking';
import { getCurrentCart, FREE_SHIPPING_THRESHOLD, getShippingProgress } from 'public/cartService';
import { announce, makeClickable } from 'public/a11yHelpers.js';
import { getCheckoutPaymentSummary } from 'backend/paymentOptions.web';
import { validateShippingAddress, getShippingOptions, getDeliveryEstimate } from 'backend/checkoutOptimization.web';

$w.onReady(async function () {
  const sections = [
    { name: 'trustSignals', init: initTrustSignals },
    { name: 'orderNotes', init: initOrderNotes },
    { name: 'checkoutSummary', init: initCheckoutSummary },
    { name: 'deliveryEstimate', init: initDeliveryEstimate },
  ];

  const results = await Promise.allSettled(sections.map(s => s.init()));
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[Checkout] Section "${sections[i].name}" failed:`, result.reason);
    }
  });
});

// ── Trust Signals ───────────────────────────────────────────────────
// Display trust badges and reassurance messaging during checkout

function initTrustSignals() {
  const trustMessages = [
    { icon: 'lock', text: 'Secure SSL Checkout' },
    { icon: 'shield', text: '30-Day Money-Back Guarantee' },
    { icon: 'credit-card', text: 'Secure Payment' },
    { icon: 'truck', text: 'Free shipping on orders $999+' },
    { icon: 'phone', text: 'Questions? Call (828) 252-9449' },
  ];

  try {
    const repeater = $w('#trustRepeater');
    if (!repeater) return;

    repeater.data = trustMessages.map((msg, i) => ({
      _id: String(i),
      ...msg,
    }));

    repeater.onItemReady(($item, itemData) => {
      $item('#trustText').text = itemData.text;
      try { $item('#trustIcon').alt = itemData.text; } catch (e) {}
      try { $item('#trustIcon').accessibility.ariaHidden = true; } catch (e) {}
    });
  } catch (e) {}
}

// ── Order Notes ─────────────────────────────────────────────────────
// Allow customers to add special instructions

function initOrderNotes() {
  try {
    const notesToggle = $w('#orderNotesToggle');
    const notesField = $w('#orderNotesField');

    if (notesToggle && notesField) {
      notesField.collapse();
      try { notesToggle.accessibility.ariaLabel = 'Toggle order notes'; } catch (e) {}
      try { notesToggle.accessibility.ariaExpanded = false; } catch (e) {}
      try { notesField.accessibility.ariaLabel = 'Special delivery instructions'; } catch (e) {}
      notesToggle.onClick(() => {
        if (notesField.collapsed) {
          notesField.expand();
          notesToggle.text = 'Hide order notes';
          try { notesToggle.accessibility.ariaExpanded = true; } catch (e) {}
        } else {
          notesField.collapse();
          notesToggle.text = 'Add order notes';
          try { notesToggle.accessibility.ariaExpanded = false; } catch (e) {}
        }
      });
    }
  } catch (e) {}
}

// ── Checkout Summary Enhancement ─────────────────────────────────────
// Shows free shipping status, payment options, and tracks checkout funnel

async function initCheckoutSummary() {
  try {
    const cart = await getCurrentCart();
    if (!cart) return;

    const subtotal = cart.totals?.subtotal || 0;
    const lineItems = Array.isArray(cart.lineItems) ? cart.lineItems : [];
    const itemCount = lineItems.reduce((s, i) => s + (i.quantity || 0), 0);

    // Empty cart — redirect to cart page instead of showing blank checkout
    if (itemCount === 0) {
      const { to } = await import('wix-location-frontend');
      to('/cart');
      return;
    }

    // Track checkout start in engagement funnel + GA4/Meta Pixel
    trackCheckoutStart(subtotal, itemCount);
    fireInitiateCheckout(lineItems, subtotal);

    // Show free shipping badge if qualifying
    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
      try {
        $w('#checkoutFreeShipping').text = 'Your order qualifies for FREE shipping!';
        try { $w('#checkoutFreeShipping').accessibility.role = 'status'; } catch (e) {}
        $w('#checkoutFreeShipping').show();
      } catch (e) {}
    } else {
      // Show shipping progress toward free threshold
      try {
        const { remaining } = getShippingProgress(subtotal);
        $w('#checkoutFreeShipping').text = `Add $${remaining.toFixed(2)} more for free shipping`;
        $w('#checkoutFreeShipping').show();
      } catch (e) {}
    }

    // Show item count summary
    try {
      $w('#checkoutItemCount').text = `${itemCount} item${itemCount !== 1 ? 's' : ''} in your order`;
    } catch (e) {}

    // Load payment options and shipping options in parallel
    await Promise.allSettled([
      initPaymentOptions(subtotal),
      initShippingOptions(subtotal),
      initAddressValidation(),
    ]);
  } catch (e) {}
}

// ── Payment Options Display ──────────────────────────────────────────
// Shows available payment methods with icons: credit card, Apple Pay,
// Google Pay, Afterpay — sourced from paymentOptions.web.js

async function initPaymentOptions(subtotal) {
  try {
    const result = await getCheckoutPaymentSummary(subtotal);
    if (!result.success) return;

    const { summary } = result;

    // Populate payment method repeater (credit card, Apple Pay, Google Pay)
    try {
      const repeater = $w('#paymentMethodsRepeater');
      if (repeater) {
        repeater.data = summary.payNow.methods.map(m => ({
          _id: m.id,
          ...m,
        }));
        repeater.onItemReady(($item, method) => {
          try { $item('#paymentMethodName').text = method.name; } catch (e) {}
          try { $item('#paymentMethodIcon').alt = method.name; } catch (e) {}
          try { $item('#paymentMethodIcon').accessibility.ariaHidden = true; } catch (e) {}
          // Show card brands for credit card
          if (method.id === 'credit-card' && method.brands) {
            try {
              $item('#paymentBrands').text = method.brands.join(' · ');
              $item('#paymentBrands').show();
            } catch (e) {}
          }
        });
      }
    } catch (e) {}

    // Afterpay section (separate from pay-now methods)
    try {
      const afterpaySection = $w('#checkoutAfterpay');
      if (afterpaySection && summary.afterpay) {
        try {
          $w('#afterpayMessage').text = summary.afterpay.message;
          $w('#afterpayInstallment').text = `4 payments of $${summary.afterpay.installmentAmount.toFixed(2)}`;
          afterpaySection.expand();
        } catch (e) {}
      } else if (afterpaySection) {
        afterpaySection.collapse();
      }
    } catch (e) {}

    // Financing section
    try {
      const financingSection = $w('#checkoutFinancing');
      if (financingSection && summary.financing) {
        try {
          $w('#financingMessage').text = summary.financing.message;
          financingSection.expand();
        } catch (e) {}
      } else if (financingSection) {
        financingSection.collapse();
      }
    } catch (e) {}

    // Shipping message
    try {
      const shippingMsg = $w('#checkoutShippingMessage');
      if (shippingMsg && summary.shippingMessage) {
        shippingMsg.text = summary.shippingMessage;
        try { shippingMsg.accessibility.role = 'status'; } catch (e) {}
      }
    } catch (e) {}
  } catch (e) {
    console.error('[Checkout] Error loading payment options:', e);
  }
}

// ── Shipping Options Selection ───────────────────────────────────────
// Displays shipping method choices with estimated delivery dates

async function initShippingOptions(subtotal) {
  try {
    const result = await getShippingOptions(subtotal);
    if (!result.success) return;

    const repeater = $w('#shippingOptionsRepeater');
    if (!repeater) return;

    repeater.data = result.options.map(o => ({
      _id: o.id,
      ...o,
    }));

    repeater.onItemReady(($item, option) => {
      try { $item('#shippingOptionLabel').text = option.label; } catch (e) {}
      try { $item('#shippingOptionPrice').text = option.price > 0 ? `$${option.price.toFixed(2)}` : 'FREE'; } catch (e) {}
      try { $item('#shippingOptionDesc').text = option.description; } catch (e) {}
      try {
        const days = option.estimatedDays;
        $item('#shippingOptionDays').text = `${days.min}–${days.max} business days`;
      } catch (e) {}
      try {
        $item('#shippingOptionRadio').accessibility.ariaLabel = `${option.label} - ${option.description}`;
      } catch (e) {}

      // Shipping method selection
      try {
        $item('#shippingOptionRadio').onClick(async () => {
          try {
            const estimate = await getDeliveryEstimate(option.id);
            if (estimate.success) {
              $w('#checkoutDeliveryEstimate').text = `Estimated delivery: ${estimate.data.label}`;
              try { $w('#checkoutDeliveryEstimate').accessibility.ariaLabel = `Estimated delivery: ${estimate.data.label}`; } catch (e) {}
            }
          } catch (e) {}
          announce($w, `${option.label} selected`);
        });
      } catch (e) {}
    });
  } catch (e) {
    console.error('[Checkout] Error loading shipping options:', e);
  }
}

// ── Address Validation ───────────────────────────────────────────────
// Real-time validation feedback on shipping address fields

async function initAddressValidation() {
  try {
    const validateBtn = $w('#validateAddressBtn');
    if (!validateBtn) return;

    // ARIA labels for form fields
    const fields = [
      { id: '#addressFullName', label: 'Full name' },
      { id: '#addressLine1', label: 'Street address' },
      { id: '#addressCity', label: 'City' },
      { id: '#addressState', label: 'State (2-letter code)' },
      { id: '#addressZip', label: 'ZIP code' },
    ];
    fields.forEach(field => {
      try {
        $w(field.id).accessibility.ariaLabel = field.label;
        $w(field.id).accessibility.ariaRequired = true;
      } catch (e) {}
    });

    validateBtn.onClick(async () => {
      try {
        const address = {
          fullName: $w('#addressFullName').value || '',
          addressLine1: $w('#addressLine1').value || '',
          city: $w('#addressCity').value || '',
          state: $w('#addressState').value || '',
          zip: $w('#addressZip').value || '',
        };

        const result = await validateShippingAddress(address);

        if (result.valid) {
          try {
            $w('#addressErrors').hide();
            $w('#addressSuccess').text = 'Address verified';
            $w('#addressSuccess').show('fade', { duration: 200 });
            try { $w('#addressSuccess').accessibility.role = 'status'; } catch (e) {}
            announce($w, 'Shipping address verified');
          } catch (e) {}
        } else {
          try {
            $w('#addressSuccess').hide();
            const errorText = result.errors ? result.errors.join('\n') : 'Please check your address.';
            $w('#addressErrors').text = errorText;
            $w('#addressErrors').show('fade', { duration: 200 });
            try { $w('#addressErrors').accessibility.role = 'alert'; } catch (e) {}
            announce($w, `Address validation errors: ${errorText}`);
          } catch (e) {}
        }
      } catch (err) {
        console.error('[Checkout] Address validation error:', err);
      }
    });
  } catch (e) {}
}

// ── Delivery Estimate ────────────────────────────────────────────────
// Shows estimated delivery window on checkout page

function initDeliveryEstimate() {
  try {
    const estimateEl = $w('#checkoutDeliveryEstimate');
    if (!estimateEl) return;

    const today = new Date();
    const minDays = 5;
    const maxDays = 10;

    const minDate = addBusinessDays(today, minDays);
    const maxDate = addBusinessDays(today, maxDays);
    const opts = { month: 'short', day: 'numeric' };

    estimateEl.text =
      `Estimated delivery: ${minDate.toLocaleDateString('en-US', opts)} – ${maxDate.toLocaleDateString('en-US', opts)}`;
    try { estimateEl.accessibility.ariaLabel = estimateEl.text; } catch (e) {}
    try { estimateEl.accessibility.role = 'status'; } catch (e) {}
    estimateEl.show();
  } catch (e) {}
}

function addBusinessDays(startDate, days) {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}
