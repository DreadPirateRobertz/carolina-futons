// TARGET: Checkout Page
// DESCRIPTION: Add 25 missing elements across 5 sections
// AUTHOR: godfrey
// DEPENDS: none
// PRIORITY: P1 — Velo code + 62 tests ready, waiting for editor elements
// BEAD: CF-0y0w
//
// CONTEXT:
// Checkout.js has 25 element IDs not in the build spec, across 5 sections.
// This is the largest gap. Tests confirm all behavior works.
//
// MANUAL STEPS (for melania in editor):
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 1: Payment Methods (5 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 1. Add a Repeater for payment methods:
//    - Set ID to: paymentMethodsRepeater
//    - Place in the payment section of checkout
//
// 2. Inside repeater item template:
//    - Image element → ID: paymentMethodIcon
//      (displays payment method icon, aria-hidden)
//    - Text element → ID: paymentMethodName
//      (e.g., "Credit Card", "Apple Pay")
//    - Text element → ID: paymentBrands
//      (e.g., "Visa · Mastercard · Amex", hidden for non-card methods)
//
// 3. In the trust signals area (may already have #trustRepeater):
//    - Inside trust repeater item template, add:
//    - Image element → ID: trustIcon
//      (lock/shield/etc icon, aria-hidden)
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 2: Afterpay (3 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 4. Add a collapsible Box for afterpay:
//    - Set ID to: checkoutAfterpay
//    - Initially collapsed (Velo expands when afterpay available)
//
// 5. Inside #checkoutAfterpay:
//    - Text element → ID: afterpayMessage
//      (e.g., "Pay in 4 interest-free installments")
//    - Text element → ID: afterpayInstallment
//      (e.g., "4 payments of $137.50")
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 3: Financing (2 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 6. Add a collapsible Box for financing:
//    - Set ID to: checkoutFinancing
//    - Initially collapsed
//
// 7. Inside #checkoutFinancing:
//    - Text element → ID: financingMessage
//      (e.g., "As low as $29/mo with Affirm")
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 4: Shipping Options (7 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 8. Add a Text element for shipping message:
//    - Set ID to: checkoutShippingMessage
//    - Displays "Free curbside delivery on this order" or similar
//
// 9. Add a Repeater for shipping options:
//    - Set ID to: shippingOptionsRepeater
//
// 10. Inside repeater item template:
//     - Text → ID: shippingOptionLabel (e.g., "Standard Curbside")
//     - Text → ID: shippingOptionPrice (e.g., "FREE" or "$149.99")
//     - Text → ID: shippingOptionDesc (e.g., "Free curbside delivery")
//     - Text → ID: shippingOptionDays (e.g., "5–10 business days")
//     - RadioButton/Button → ID: shippingOptionRadio
//       (selects this shipping method)
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 5: Address Validation (8 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 11. Add address form inputs:
//     - TextInput → ID: addressFullName (label: "Full name")
//     - TextInput → ID: addressLine1 (label: "Street address")
//     - TextInput → ID: addressCity (label: "City")
//     - TextInput → ID: addressState (label: "State")
//     - TextInput → ID: addressZip (label: "ZIP code")
//     All inputs: ariaRequired=true, Velo sets ariaLabel
//
// 12. Add validate button:
//     - Button → ID: validateAddressBtn
//     - Style: Coral (#E8845C) background, white text
//
// 13. Add feedback elements:
//     - Text → ID: addressErrors (initially hidden, role="alert")
//     - Text → ID: addressSuccess (initially hidden, role="status")
//
// ═══════════════════════════════════════════════════════════════════
// LAYOUT NOTES
// ═══════════════════════════════════════════════════════════════════
//
// - Payment methods section: horizontal card layout (icons + names)
// - Afterpay/Financing: subtle cards below payment methods
// - Shipping options: vertical list with radio selection
// - Address form: standard form layout with inline validation
// - All sections responsive (collapse on mobile handled by Velo)

console.log('[godfrey] Checkout missing elements: MANUAL EDITOR TASK');
console.log('See script comments for 25 elements across 5 sections.');
