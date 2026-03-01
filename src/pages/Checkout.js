// Checkout.js - Checkout Page
// Trust signals, order notes, payment options, address validation,
// shipping selection, engagement tracking, delivery estimate,
// progress indicator, real-time form validation, order summary sidebar,
// express checkout
import { trackCheckoutStart } from 'public/engagementTracker';
import { fireInitiateCheckout } from 'public/ga4Tracking';
import { getCurrentCart, FREE_SHIPPING_THRESHOLD, getShippingProgress } from 'public/cartService';
import { announce, makeClickable } from 'public/a11yHelpers.js';
import { colors } from 'public/sharedTokens.js';
import { getCheckoutSteps, getStepAriaAttributes } from 'public/checkoutProgress.js';
import { validateAddressField, getFieldValidationState } from 'public/checkoutValidation.js';
import { getCheckoutPaymentSummary } from 'backend/paymentOptions.web';
import {
  validateShippingAddress,
  getShippingOptions,
  getDeliveryEstimate,
  calculateOrderSummary,
  getExpressCheckoutSummary,
} from 'backend/checkoutOptimization.web';

// Shared state for cross-section communication
let _currentCart = null;
let _addressValid = false;
let _selectedShippingMethod = 'standard';

$w.onReady(async function () {
  const sections = [
    { name: 'checkoutProgress', init: initCheckoutProgress },
    { name: 'trustSignals', init: initTrustSignals },
    { name: 'orderNotes', init: initOrderNotes },
    { name: 'checkoutSummary', init: initCheckoutSummary },
    { name: 'orderSummarySidebar', init: initOrderSummarySidebar },
    { name: 'deliveryEstimate', init: initDeliveryEstimate },
    { name: 'expressCheckout', init: initExpressCheckout },
  ];

  const results = await Promise.allSettled(sections.map(s => s.init()));
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[Checkout] Section "${sections[i].name}" failed:`, result.reason);
    }
  });
});

// ── Checkout Progress Indicator ──────────────────────────────────────
// Multi-step progress bar: Information → Shipping → Payment → Review

function initCheckoutProgress() {
  try {
    const progressNav = $w('#checkoutProgressNav');
    if (!progressNav) return;

    const steps = getCheckoutSteps();
    const activeIndex = 0; // Start at Information step

    try { progressNav.accessibility.role = 'navigation'; } catch (e) {}
    try { progressNav.accessibility.ariaLabel = 'Checkout progress'; } catch (e) {}

    const repeater = $w('#checkoutProgressRepeater');
    if (!repeater) return;

    repeater.data = steps.map(s => ({
      _id: s.id,
      ...s,
    }));

    repeater.onItemReady(($item, stepData) => {
      const stepIndex = stepData.number - 1;
      const attrs = getStepAriaAttributes(stepIndex, activeIndex, stepData.label);

      try { $item('#progressStepLabel').text = stepData.label; } catch (e) {}
      try { $item('#progressStepNumber').text = String(stepData.number); } catch (e) {}

      // Visual state styling
      try {
        if (attrs.state === 'completed') {
          $item('#progressStepDot').style.backgroundColor = colors.success;
          $item('#progressStepLabel').style.color = colors.success;
          try { $item('#progressStepCheck').show(); } catch (e) {}
          try { $item('#progressStepNumber').hide(); } catch (e) {}
        } else if (attrs.state === 'active') {
          $item('#progressStepDot').style.backgroundColor = colors.mountainBlue;
          $item('#progressStepLabel').style.color = colors.mountainBlue;
          try { $item('#progressStepLabel').style.fontWeight = 'bold'; } catch (e) {}
        } else {
          $item('#progressStepDot').style.backgroundColor = colors.sandDark;
          $item('#progressStepLabel').style.color = colors.mutedBrown;
        }
      } catch (e) {}

      // ARIA attributes
      try {
        const container = $item('#progressStepContainer');
        container.accessibility.ariaLabel = attrs.ariaLabel;
        if (attrs.ariaCurrent) {
          container.accessibility.ariaCurrent = attrs.ariaCurrent;
        }
      } catch (e) {}
    });
  } catch (e) {}
}

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

    _currentCart = cart;
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
          _selectedShippingMethod = option.id;
          try {
            const estimate = await getDeliveryEstimate(option.id);
            if (estimate.success) {
              $w('#checkoutDeliveryEstimate').text = `Estimated delivery: ${estimate.data.label}`;
              try { $w('#checkoutDeliveryEstimate').accessibility.ariaLabel = `Estimated delivery: ${estimate.data.label}`; } catch (e) {}
            }
          } catch (e) {}
          // Update order summary sidebar with new shipping method
          try {
            const cart = _currentCart || await getCurrentCart();
            if (cart) {
              const lineItems = Array.isArray(cart.lineItems) ? cart.lineItems : [];
              const items = lineItems.map(item => ({
                price: Number(item.price) || 0,
                quantity: item.quantity || 1,
                name: item.name || item.productName || 'Item',
              }));
              updateOrderSummaryDisplay(items, 'NC', option.id);
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
// Real-time inline validation + button-triggered backend validation

async function initAddressValidation() {
  try {
    const validateBtn = $w('#validateAddressBtn');
    if (!validateBtn) return;

    // Field configuration with element IDs and validation field names
    const fields = [
      { id: '#addressFullName', errorId: '#addressFullNameError', name: 'fullName', label: 'Full name' },
      { id: '#addressLine1', errorId: '#addressLine1Error', name: 'addressLine1', label: 'Street address' },
      { id: '#addressCity', errorId: '#addressCityError', name: 'city', label: 'City' },
      { id: '#addressState', errorId: '#addressStateError', name: 'state', label: 'State (2-letter code)' },
      { id: '#addressZip', errorId: '#addressZipError', name: 'zip', label: 'ZIP code' },
    ];

    const touched = {};

    // Set ARIA labels and wire real-time validation
    fields.forEach(field => {
      try {
        const el = $w(field.id);
        el.accessibility.ariaLabel = field.label;
        el.accessibility.ariaRequired = true;

        // Hide inline error by default
        try { $w(field.errorId).hide(); } catch (e) {}
        try {
          $w(field.errorId).accessibility.role = 'alert';
          $w(field.errorId).accessibility.ariaLive = 'assertive';
        } catch (e) {}

        // Real-time validation on input change
        el.onInput(() => {
          touched[field.name] = true;
          validateFieldInline(field);
        });

        // Also validate on blur for fields not yet touched
        el.onBlur(() => {
          if (!touched[field.name]) {
            touched[field.name] = true;
            validateFieldInline(field);
          }
        });
      } catch (e) {}
    });

    // Button-triggered full backend validation
    validateBtn.onClick(async () => {
      try {
        const address = {
          fullName: $w('#addressFullName').value || '',
          addressLine1: $w('#addressLine1').value || '',
          city: $w('#addressCity').value || '',
          state: $w('#addressState').value || '',
          zip: $w('#addressZip').value || '',
        };

        // Run inline validation on all fields first
        fields.forEach(field => {
          touched[field.name] = true;
          validateFieldInline(field);
        });

        const result = await validateShippingAddress(address);

        if (result.valid) {
          _addressValid = true;
          try {
            $w('#addressErrors').hide();
            $w('#addressSuccess').text = 'Address verified';
            $w('#addressSuccess').show('fade', { duration: 200 });
            try { $w('#addressSuccess').accessibility.role = 'status'; } catch (e) {}
            announce($w, 'Shipping address verified');
          } catch (e) {}
          // Enable express checkout after address validation
          try { $w('#expressCheckoutBtn').enable(); } catch (e) {}
        } else {
          _addressValid = false;
          try {
            $w('#addressSuccess').hide();
            const errorText = result.errors ? result.errors.join('\n') : 'Please check your address.';
            $w('#addressErrors').text = errorText;
            $w('#addressErrors').show('fade', { duration: 200 });
            try { $w('#addressErrors').accessibility.role = 'alert'; } catch (e) {}
            announce($w, `Address validation errors: ${errorText}`);
          } catch (e) {}
          try { $w('#expressCheckoutBtn').disable(); } catch (e) {}
        }
      } catch (err) {
        console.error('[Checkout] Address validation error:', err);
      }
    });
  } catch (e) {}
}

/**
 * Validate a single field inline and show/hide its error element.
 * @param {{ id: string, errorId: string, name: string }} field
 */
function validateFieldInline(field) {
  try {
    const value = $w(field.id).value || '';
    const result = validateAddressField(field.name, value);
    const state = getFieldValidationState(value, true, result);

    if (state === 'error' && result.error) {
      $w(field.errorId).text = result.error;
      $w(field.errorId).show('fade', { duration: 150 });
      try { $w(field.id).style.borderColor = colors.error; } catch (e) {}
    } else if (state === 'valid') {
      $w(field.errorId).hide();
      try { $w(field.id).style.borderColor = colors.success; } catch (e) {}
    } else {
      $w(field.errorId).hide();
      try { $w(field.id).style.borderColor = colors.sandDark; } catch (e) {}
    }
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

// ── Order Summary Sidebar ───────────────────────────────────────────
// Persistent sidebar showing cart items, subtotal, shipping, tax, total

async function initOrderSummarySidebar() {
  try {
    const sidebar = $w('#orderSummarySidebar');
    if (!sidebar) return;

    const cart = _currentCart || await getCurrentCart();
    if (!cart) return;

    const lineItems = Array.isArray(cart.lineItems) ? cart.lineItems : [];
    const items = lineItems.map(item => ({
      price: Number(item.price) || 0,
      quantity: item.quantity || 1,
      name: item.name || item.productName || 'Item',
    }));

    if (items.length === 0) return;

    await updateOrderSummaryDisplay(items, 'NC', _selectedShippingMethod);
    sidebar.show();
  } catch (e) {
    console.error('[Checkout] Error loading order summary sidebar:', e);
  }
}

/**
 * Update the order summary sidebar display with current cart data.
 * @param {Array} items - Cart items with price, quantity, name
 * @param {string} state - 2-letter state code
 * @param {string} shippingMethod - Selected shipping method ID
 */
async function updateOrderSummaryDisplay(items, state, shippingMethod) {
  try {
    const result = calculateOrderSummary({ items, state, shippingMethod });
    if (!result.success) return;

    const { data } = result;

    // Item list repeater
    try {
      const repeater = $w('#orderSummaryItemsRepeater');
      if (repeater) {
        repeater.data = items.map((item, i) => ({
          _id: String(i),
          ...item,
          lineTotal: (item.price * item.quantity).toFixed(2),
        }));
        repeater.onItemReady(($item, itemData) => {
          try { $item('#summaryItemName').text = itemData.name; } catch (e) {}
          try { $item('#summaryItemQty').text = `×${itemData.quantity}`; } catch (e) {}
          try { $item('#summaryItemPrice').text = `$${itemData.lineTotal}`; } catch (e) {}
        });
      }
    } catch (e) {}

    // Summary totals
    try { $w('#orderSummarySubtotal').text = `$${data.subtotal.toFixed(2)}`; } catch (e) {}
    try {
      $w('#orderSummaryShipping').text = data.shipping.amount === 0
        ? 'FREE'
        : `$${data.shipping.amount.toFixed(2)}`;
    } catch (e) {}
    try { $w('#orderSummaryTax').text = `$${data.tax.toFixed(2)}`; } catch (e) {}
    try {
      $w('#orderSummaryTotal').text = `$${data.total.toFixed(2)}`;
      try { $w('#orderSummaryTotal').style.fontWeight = 'bold'; } catch (e) {}
    } catch (e) {}

    // Savings message
    try {
      if (data.savings > 0) {
        $w('#orderSummarySavings').text = `You're saving $${data.savings.toFixed(2)} on shipping!`;
        $w('#orderSummarySavings').show();
      } else {
        $w('#orderSummarySavings').hide();
      }
    } catch (e) {}

    // Accessibility
    try {
      $w('#orderSummarySidebar').accessibility.ariaLabel =
        `Order summary: ${data.itemCount} items, total $${data.total.toFixed(2)}`;
    } catch (e) {}
  } catch (e) {}
}

// ── Express Checkout ───────────────────────────────────────────────
// Quick checkout for customers with validated address

async function initExpressCheckout() {
  try {
    const section = $w('#expressCheckoutSection');
    if (!section) return;

    const btn = $w('#expressCheckoutBtn');
    if (!btn) return;

    // Disable by default until address is validated
    try { btn.disable(); } catch (e) {}
    try {
      btn.accessibility.ariaLabel = 'Express checkout — complete your order quickly';
    } catch (e) {}

    btn.onClick(async () => {
      if (!_addressValid) {
        announce($w, 'Please verify your shipping address first');
        return;
      }

      try {
        btn.disable();
        try { btn.label = 'Processing...'; } catch (e) {}

        const cart = _currentCart || await getCurrentCart();
        if (!cart) return;

        const lineItems = Array.isArray(cart.lineItems) ? cart.lineItems : [];
        const items = lineItems.map(item => ({
          price: Number(item.price) || 0,
          quantity: item.quantity || 1,
        }));

        const address = {
          fullName: $w('#addressFullName').value || '',
          addressLine1: $w('#addressLine1').value || '',
          city: $w('#addressCity').value || '',
          state: $w('#addressState').value || '',
          zip: $w('#addressZip').value || '',
        };

        const result = getExpressCheckoutSummary({ items, address });

        if (result.success) {
          // Show express summary
          try {
            $w('#expressSummaryTotal').text = `Total: $${result.data.total.toFixed(2)}`;
            $w('#expressSummaryShipping').text = result.data.shipping.amount === 0
              ? 'Free Shipping'
              : `Shipping: $${result.data.shipping.amount.toFixed(2)}`;
            $w('#expressSummaryAddress').text =
              `${result.data.shippingAddress.fullName}, ${result.data.shippingAddress.line1}, ${result.data.shippingAddress.city}, ${result.data.shippingAddress.state} ${result.data.shippingAddress.zip}`;
            $w('#expressSummarySection').show('fade', { duration: 200 });
          } catch (e) {}

          announce($w, `Express checkout ready. Total: $${result.data.total.toFixed(2)}`);
        } else {
          announce($w, 'Unable to prepare express checkout. Please use standard checkout.');
        }

        btn.enable();
        try { btn.label = 'Express Checkout'; } catch (e) {}
      } catch (err) {
        console.error('[Checkout] Express checkout error:', err);
        btn.enable();
        try { btn.label = 'Express Checkout'; } catch (e) {}
      }
    });

    section.show();
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
