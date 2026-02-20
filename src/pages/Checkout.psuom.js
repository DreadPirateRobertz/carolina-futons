// Checkout.psuom.js - Checkout Page
// Trust signals, order notes, engagement tracking, delivery estimate
import { trackCheckoutStart } from 'public/engagementTracker';
import { getCurrentCart, FREE_SHIPPING_THRESHOLD } from 'public/cartService';

$w.onReady(async function () {
  initTrustSignals();
  initOrderNotes();
  await initCheckoutSummary();
  initDeliveryEstimate();
});

// ── Trust Signals ───────────────────────────────────────────────────
// Display trust badges and reassurance messaging during checkout

function initTrustSignals() {
  const trustMessages = [
    { icon: 'lock', text: 'Secure SSL Checkout' },
    { icon: 'shield', text: 'Your information is protected' },
    { icon: 'truck', text: 'Free shipping on orders over $999' },
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
      notesToggle.onClick(() => {
        if (notesField.collapsed) {
          notesField.expand();
          notesToggle.text = 'Hide order notes';
        } else {
          notesField.collapse();
          notesToggle.text = 'Add order notes';
        }
      });
    }
  } catch (e) {}
}

// ── Checkout Summary Enhancement ─────────────────────────────────────
// Shows free shipping status and tracks checkout funnel event

async function initCheckoutSummary() {
  try {
    const cart = await getCurrentCart();
    if (!cart) return;

    const subtotal = cart.totals?.subtotal || 0;
    const itemCount = cart.lineItems?.reduce((s, i) => s + i.quantity, 0) || 0;

    // Track checkout start in engagement funnel
    trackCheckoutStart(subtotal, itemCount);

    // Show free shipping badge if qualifying
    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
      try {
        $w('#checkoutFreeShipping').text = 'Your order qualifies for FREE shipping!';
        $w('#checkoutFreeShipping').show();
      } catch (e) {}
    }

    // Show item count summary
    try {
      $w('#checkoutItemCount').text = `${itemCount} item${itemCount !== 1 ? 's' : ''} in your order`;
    } catch (e) {}
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
