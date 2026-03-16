// TARGET: Cart Page
// DESCRIPTION: Add 4 financing section elements missing from editor
// AUTHOR: godfrey
// DEPENDS: none
// PRIORITY: P1 — Velo code + 43 tests ready, waiting for editor elements
// BEAD: CF-0y0w
//
// CONTEXT:
// The Cart Page Velo code (Cart Page.js lines 344-389) references 4 element
// IDs for the financing section that don't exist in the editor yet.
// Tests in elementHookupCart.test.js confirm the code handles all states.
//
// MANUAL STEPS (for melania in editor):
//
// 1. Open Cart Page in editor
//
// 2. Find or create the financing section container:
//    - Add a Box element below the tier progress bar area
//    - Set ID to: cartFinancingSection
//    - Initially collapsed (Velo expands it when financing data loads)
//
// 3. Inside #cartFinancingSection, add these elements:
//
//    a) Text element → ID: financingThreshold
//       - Purpose: "Add $X more to unlock financing" threshold message
//       - Style: regular text, Espresso (#3A2518)
//       - Initially hidden (Velo shows when thresholdMessage exists)
//
//    b) Text element → ID: cartFinancingTeaser
//       - Purpose: Lowest monthly payment teaser (e.g., "$29/mo")
//       - Style: bold text, Mountain Blue (#5B8FA8)
//       - Initially hidden (Velo shows when lowestMonthly exists)
//
//    c) Text element → ID: cartAfterpayMessage
//       - Purpose: Afterpay message (e.g., "4 payments of $137.49")
//       - Style: regular text, Espresso (#3A2518)
//       - Initially hidden (Velo shows when afterpay is eligible)
//
// 4. Layout: Stack vertically with 8px spacing between elements
//    Desktop: full width of cart content area
//    Mobile: collapseOnMobile already handles this
//
// The Velo code will automatically:
// - Show/hide based on getCartFinancing() response
// - Set text content for each element
// - Collapse entire section when subtotal <= 0 or financing fails
//
// NO documentServices script needed — this is a visual editor task.

console.log('[godfrey] Cart financing elements: MANUAL EDITOR TASK');
console.log('See script comments for step-by-step instructions.');
