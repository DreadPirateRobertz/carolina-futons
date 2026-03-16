// TARGET: Side Cart (global component)
// DESCRIPTION: Add 3 missing elements — cart badge, qty minus/plus buttons
// AUTHOR: godfrey
// DEPENDS: none
// PRIORITY: P1 — Velo code + 38 tests ready, waiting for editor elements
// BEAD: CF-0y0w
//
// CONTEXT:
// Side Cart.js references 3 element IDs not in the build spec.
// The #sideCartRepeater item template has quantity text (#sideItemQty)
// but is missing the +/- control buttons. The cart icon badge is also missing.
//
// MANUAL STEPS (for melania in editor):
//
// 1. Open the Side Cart component in editor
//
// 2. Add cart badge to cart icon:
//    - Find the cart icon element (should be in header/nav)
//    - Add a small Text element overlaying the cart icon
//    - Set ID to: cartBadge
//    - Style: small circle, Coral (#E8845C) background, white text
//    - Initially hidden (Velo shows when cart has items)
//    - Velo sets ARIA: role="status", ariaLive="polite"
//
// 3. Inside #sideCartRepeater item template, add qty controls:
//
//    a) Button/Text element → ID: sideQtyMinus
//       - Purpose: Decrease quantity button (displays "−")
//       - Place LEFT of #sideItemQty
//       - Style: Mountain Blue (#5B8FA8) text
//       - Velo sets ARIA label: "Decrease quantity of {product name}"
//
//    b) Button/Text element → ID: sideQtyPlus
//       - Purpose: Increase quantity button (displays "+")
//       - Place RIGHT of #sideItemQty
//       - Style: Mountain Blue (#5B8FA8) text
//       - Velo sets ARIA label: "Increase quantity of {product name}"
//
// 4. Layout: qty controls should be inline: [−] [qty] [+]
//    Make sure they're inside the repeater item template, not at page level.
//
// The Velo code will automatically:
// - Style buttons with mountain blue
// - Set ARIA labels with product name
// - Handle click: decrement/increment with MIN/MAX bounds
// - Announce changes to screen readers
// - Refresh side cart after quantity change

console.log('[godfrey] Side Cart missing elements: MANUAL EDITOR TASK');
console.log('See script comments for step-by-step instructions.');
