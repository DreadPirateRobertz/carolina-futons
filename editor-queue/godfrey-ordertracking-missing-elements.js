// TARGET: Order Tracking Page
// DESCRIPTION: Add 44 elements across 8 sections — entire page needs to be CREATED first
// AUTHOR: godfrey
// DEPENDS: godfrey-create-returns-tracking-pages.mjs (creates the page)
// PRIORITY: P1 — Velo code + tests ready, waiting for editor elements
// BEAD: CF-0y0w
//
// CONTEXT:
// Order Tracking.js has 44 element IDs. The audit shows all IDs are documented
// in spec, but the PAGE itself may not exist in the editor yet.
// Run godfrey-create-returns-tracking-pages.mjs FIRST to create the page,
// then add these elements manually.
//
// MANUAL STEPS (for melania in editor):
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 1: Lookup Form (5 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 1. At the top of the page, add the lookup form:
//
//    a) Text → ID: trackingTitle
//       - Velo sets: "Track Your Order"
//       - Style: heading, Espresso (#3A2518)
//
//    b) Text → ID: trackingSubtitle
//       - Velo sets: "Enter your order number and email..."
//       - Style: body text
//
//    c) TextInput → ID: orderNumberInput
//       - Placeholder: "Order number"
//       - Velo sets ariaLabel: "Order number"
//       - Supports onKeyPress (Enter submits)
//
//    d) TextInput → ID: emailInput
//       - Placeholder: "Email address"
//       - Velo sets ariaLabel: "Email address used for this order"
//       - Supports onKeyPress (Enter submits)
//
//    e) Button → ID: trackOrderBtn
//       - Label: "Track Order"
//       - Velo sets ariaLabel: "Track order"
//       - Velo handles: disable during lookup, label → "Looking up..."
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 2: Results Container (1 element)
// ═══════════════════════════════════════════════════════════════════
//
// 2. Add a collapsible Box for results:
//    - Set ID to: trackingResultsSection
//    - Initially collapsed (Velo expands after successful lookup)
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 3: Order Summary (4 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 3. Inside #trackingResultsSection, at the top:
//
//    a) Text → ID: resultOrderNumber
//       - Velo sets: "Order #12345"
//       - Style: heading
//
//    b) Text → ID: resultOrderDate
//       - Velo sets: "Placed March 14, 2026"
//       - Style: body text
//
//    c) Text → ID: resultStatus
//       - Velo sets: order status text
//       - Velo colors: status-based (green=delivered, blue=in-transit,
//         coral=exception, muted=pending)
//
//    d) Text → ID: resultStatusDescription
//       - Velo sets: status description text
//       - Style: body text
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 4: Tracking Timeline (up to 15 elements — dynamic)
// ═══════════════════════════════════════════════════════════════════
//
// 4. Inside #trackingResultsSection, add timeline container:
//    - Box → ID: trackingTimeline
//    - Velo sets ARIA: role="list", ariaLabel="Order tracking timeline"
//
// 5. Inside #trackingTimeline, add step elements (up to 5 steps):
//    For each step index (0-4):
//
//    a) Box → ID: timelineStep0, timelineStep1, timelineStep2, etc.
//       - Velo collapses/expands (on mobile, hides distant steps)
//
//    b) Element (circle/dot) → ID: timelineDot0, timelineDot1, etc.
//       - Velo sets backgroundColor:
//         - Green (#28a745) = completed
//         - Mountain Blue (#5B8FA8) = current (or Coral if exception)
//         - Muted = pending
//
//    c) Text → ID: timelineLabel0, timelineLabel1, etc.
//       - Velo sets: step label text
//       - Velo styles: bold + blue for current, green for completed,
//         muted brown for pending
//       - Velo sets ariaLabel: "Current step: X" / "Completed: X" / "Pending: X"
//
//    Create at least 5 sets (timelineStep0-4, timelineDot0-4, timelineLabel0-4)
//    = 15 elements total
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 5: Shipping Details (7 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 6. Add a collapsible Box:
//    - Set ID to: shippingDetailsSection
//    - Velo expands after lookup
//
// 7. Inside #shippingDetailsSection:
//
//    a) Text → ID: carrierName
//       - Velo sets: "UPS" or carrier name
//
//    b) Text → ID: serviceName
//       - Velo sets: shipping service name
//
//    c) Text → ID: trackingNumberText
//       - Velo sets: tracking number string
//
//    d) Text → ID: estimatedDelivery
//       - Velo sets: "Estimated delivery: Monday, March 16"
//
//    e) Text → ID: shippingDestination
//       - Velo sets: "Delivering to City, ST ZIP"
//
//    f) Button → ID: upsTrackingBtn
//       - Label: "View on UPS"
//       - Velo sets ariaLabel: "View on UPS website"
//       - Opens UPS tracking URL in new tab
//
//    g) Text → ID: noTrackingMessage
//       - Initially hidden
//       - Velo shows: "Your order is being prepared..."
//       - Shown when no tracking number yet
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 6: Line Items (8 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 8. Add a collapsible Box:
//    - Set ID to: lineItemsSection
//    - Initially collapsed
//
// 9. Inside #lineItemsSection, add a Repeater:
//    - Set ID to: trackingItemsRepeater
//
// 10. Inside repeater item template (5 elements):
//
//     a) Image → ID: itemImage
//        - Velo sets: src + alt text
//
//     b) Text → ID: itemName
//        - Velo sets: item name
//
//     c) Text → ID: itemQty
//        - Velo sets: "Qty: X"
//
//     d) Text → ID: itemPrice
//        - Velo sets: "$XX.XX"
//
//     e) Text → ID: itemSku
//        - Velo sets: "SKU: XXXXX" (or empty)
//
// 11. Add order totals (3 elements, below or beside repeater):
//
//     a) Text → ID: totalSubtotal
//        - Velo sets: "$XX.XX"
//
//     b) Text → ID: totalShipping
//        - Velo sets: "$XX.XX" or "Free"
//
//     c) Text → ID: totalAmount
//        - Velo sets: "$XX.XX"
//        - Style: bold (Velo sets fontWeight)
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 7: Activity Log (5 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 12. Add a collapsible Box:
//     - Set ID to: activitySection
//     - Initially collapsed
//
// 13. Inside #activitySection, add a Repeater:
//     - Set ID to: activityRepeater
//
// 14. Inside repeater item template (3 elements):
//
//     a) Text → ID: activityStatus
//        - Velo sets: activity status text
//
//     b) Text → ID: activityLocation
//        - Velo sets: location text
//
//     c) Text → ID: activityDateTime
//        - Velo sets: formatted date/time (e.g., "Mar 14 2:30 PM")
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 8: Notifications & UI States (7 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 15. Add notification section:
//
//     a) Box → ID: notificationSection
//        - Initially collapsed (Velo expands when tracking exists)
//
//     b) Toggle/Switch → ID: notificationToggle
//        - Velo sets ariaLabel: "Email notifications for shipment updates"
//        - Velo handles onChange: subscribe/unsubscribe
//
//     c) Text → ID: notificationLabel
//        - Velo sets: "Get email updates..." or "You'll receive..."
//
// 16. Add UI state elements:
//
//     d) Text → ID: trackingError
//        - Initially hidden
//        - Velo shows with error text
//        - Style: error color
//
//     e) Loading indicator → ID: trackingLoader
//        - Initially hidden
//
//     f) Button → ID: newSearchBtn
//        - Label: "Track Another Order"
//        - Velo sets ariaLabel: "Track a different order"
//
//     g) Button → ID: refreshTrackingBtn
//        - Label: "Refresh"
//        - Velo sets ariaLabel: "Refresh tracking status"
//
// ═══════════════════════════════════════════════════════════════════
// LAYOUT NOTES
// ═══════════════════════════════════════════════════════════════════
//
// - Lookup form: centered, top of page
// - Results: card layout below form
// - Timeline: horizontal step visualization with dots and labels
//   (vertical on mobile — Velo collapses distant steps)
// - Shipping details: info card with tracking link button
// - Line items: product list with images
// - Activity log: chronological list (most recent first)
// - Notification toggle: below activity log
// - Page SEO: Velo calls initPageSeo('orderTracking')
// - Auto-refresh: Velo refreshes tracking every 5 min for active shipments
// - URL prefill: supports ?order=XXX&email=YYY for auto-lookup
//
// The Velo code will automatically:
// - Set all text content and ARIA labels
// - Apply status-based colors
// - Handle form submission with validation
// - Show/hide sections based on lookup results
// - Auto-refresh tracking for in-transit orders
// - Support notification subscribe/unsubscribe
// - Handle mobile-responsive timeline

console.log('[godfrey] Order Tracking page elements: MANUAL EDITOR TASK');
console.log('See script comments for 44 elements across 8 sections.');
