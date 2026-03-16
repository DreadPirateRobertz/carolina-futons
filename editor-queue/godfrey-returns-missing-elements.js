// TARGET: Returns Page
// DESCRIPTION: Add 51 elements across 7 sections — entire page needs to be CREATED first
// AUTHOR: godfrey
// DEPENDS: godfrey-create-returns-tracking-pages.mjs (creates the page)
// PRIORITY: P1 — Velo code + tests ready, waiting for editor elements
// BEAD: CF-0y0w
//
// CONTEXT:
// Returns.js has 51 element IDs. The Returns page does NOT exist in the editor yet.
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
//    a) Text → ID: returnsTitle
//       - Velo sets: "Returns & Exchanges"
//       - Style: heading, Espresso (#3A2518)
//
//    b) Text → ID: returnsSubtitle
//       - Velo sets: "Start a return, exchange, or check the status..."
//       - Style: body text, Espresso (#3A2518)
//
//    c) TextInput → ID: returnOrderNumberInput
//       - Placeholder: "Order number"
//       - Velo sets ariaLabel: "Order number"
//       - Supports onKeyPress (Enter submits)
//
//    d) TextInput → ID: returnEmailInput
//       - Placeholder: "Email address"
//       - Velo sets ariaLabel: "Email address used for this order"
//       - Supports onKeyPress (Enter submits)
//
//    e) Button → ID: lookupReturnBtn
//       - Label: "Look Up Order"
//       - Velo sets ariaLabel: "Look up order for return"
//       - Velo handles: disable during lookup, label → "Looking up..."
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 2: RMA Tracker (2 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 2. Below the lookup form, add RMA tracking:
//
//    a) TextInput → ID: rmaInput
//       - Placeholder: "RMA number"
//       - Velo sets ariaLabel: "RMA number"
//       - Supports onKeyPress (Enter submits)
//
//    b) Button → ID: trackRmaBtn
//       - Label: "Track Return"
//       - Velo sets ariaLabel: "Track return by RMA number"
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 3: Results Section (4 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 3. Add a collapsible Box for order results:
//    - Set ID to: returnResultsSection
//    - Initially collapsed (Velo expands after successful lookup)
//
// 4. Inside #returnResultsSection:
//
//    a) Text → ID: returnOrderNumber
//       - Velo sets: "Order #12345"
//       - Style: heading
//
//    b) Text → ID: returnOrderDate
//       - Velo sets: order date string
//       - Style: body text
//
//    c) Text → ID: returnOrderTotal
//       - Velo sets: "$XXX.XX"
//       - Style: body text
//
//    d) Text → ID: returnWindowStatus
//       - Velo sets: return window message
//       - Velo colors: green (eligible) or red (expired)
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 4: Existing Returns Repeater (9 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 5. Add a collapsible Box:
//    - Set ID to: existingReturnsSection
//    - Initially collapsed
//
// 6. Inside #existingReturnsSection, add a Repeater:
//    - Set ID to: existingReturnsRepeater
//
// 7. Inside repeater item template:
//
//    a) Text → ID: existingRma
//       - Velo sets: RMA number
//
//    b) Text → ID: existingReturnDate
//       - Velo sets: return date
//
//    c) Text → ID: existingReturnType
//       - Velo sets: "Return" or "Exchange"
//
//    d) Text → ID: existingReturnReason
//       - Velo sets: reason text
//
//    e) Text → ID: existingReturnStatus
//       - Velo sets: formatted status text
//       - Velo colors: status-based (via getStatusColor)
//       - Velo sets ariaLabel: "Return status: {status}"
//
//    f) Text → ID: existingReturnTimeline
//       - Velo sets: timeline steps (✓/●/○ markers)
//       - Velo sets ARIA: role="list", ariaLabel="Return progress timeline"
//
//    g) Text → ID: existingTrackingNumber
//       - Initially hidden
//       - Velo shows: "Tracking: XXXXX" when tracking exists
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 5: Return Form (12 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 8. Add a collapsible Box:
//    - Set ID to: returnFormSection
//    - Initially collapsed (Velo expands when no existing returns)
//
// 9. Inside #returnFormSection:
//
//    a) Dropdown → ID: returnReasonSelect
//       - Velo populates options from backend getReturnReasons()
//       - Velo sets ariaLabel: "Select return reason"
//
//    b) Dropdown → ID: returnTypeSelect
//       - Velo sets options: "Return (refund)" / "Exchange"
//       - Velo sets ariaLabel: "Return or exchange"
//
//    c) Repeater → ID: returnItemsSelector
//       - Displays order line items with selection checkboxes
//
//    d-i) Inside #returnItemsSelector item template (6 elements):
//
//       d) Text → ID: selectItemName
//          - Velo sets: item name
//
//       e) Text → ID: selectItemQty
//          - Velo sets: "Qty: X"
//
//       f) Text → ID: selectItemPrice
//          - Velo sets: "$XX.XX"
//
//       g) Image → ID: selectItemImage
//          - Velo sets: src + alt text
//
//       h) Checkbox → ID: selectItemCheckbox
//          - Velo sets ariaLabel: "Select {name} for return"
//          - Velo disables if item not returnable
//
//       i) Text → ID: selectItemBlockReason
//          - Initially hidden
//          - Velo shows: reason why item can't be returned
//
//    j) TextBox (multiline) → ID: returnDetailsTextbox
//       - Placeholder: "Additional details (optional)"
//       - Velo sets ariaLabel: "Additional return details"
//
//    k) Button → ID: submitGuestReturnBtn
//       - Label: "Submit Return"
//       - Velo sets ariaLabel: "Submit return request"
//       - Velo handles: disable during submit, label → "Submitting..."
//
//    l) Button → ID: cancelReturnFormBtn
//       - Label: "Cancel"
//       - Velo sets ariaLabel: "Cancel return"
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 6: RMA Status (12 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 10. Add a collapsible Box:
//     - Set ID to: rmaResultsSection
//     - Initially collapsed (Velo expands after RMA lookup)
//
// 11. Inside #rmaResultsSection:
//
//     a) Text → ID: rmaStatusNumber
//        - Velo sets: "RMA: XXXXX"
//
//     b) Text → ID: rmaStatusLabel
//        - Velo sets: formatted status
//        - Velo colors: status-based
//        - Velo sets ariaLabel: "Return status: {status}"
//
//     c) Text → ID: rmaTimeline
//        - Velo sets: timeline steps (✓/●/○ markers)
//        - Velo sets ARIA: role="list", ariaLabel="Return progress timeline"
//
//     d) Box → ID: rmaTrackingSection
//        - Initially collapsed (Velo expands when tracking exists)
//
//     e) Text → ID: rmaTrackingNumber
//        - Velo sets: "Tracking: XXXXX"
//
//     f) Text → ID: rmaTrackingStatus
//        - Velo sets: tracking status text
//
//     g) Repeater → ID: rmaActivityRepeater
//        - Displays tracking activity log
//
//     h-j) Inside #rmaActivityRepeater item template (3 elements):
//
//        h) Text → ID: rmaActivityStatus
//           - Velo sets: activity status text
//
//        i) Text → ID: rmaActivityLocation
//           - Velo sets: activity location
//
//        j) Text → ID: rmaActivityDate
//           - Velo sets: formatted date (e.g., "Mar 14")
//
//     k) Text → ID: rmaNoTracking
//        - Initially hidden
//        - Velo shows: message when no tracking available
//
// ═══════════════════════════════════════════════════════════════════
// SECTION 7: UI States (5 elements)
// ═══════════════════════════════════════════════════════════════════
//
// 12. Add UI state elements (outside collapsible sections):
//
//     a) Text → ID: returnSuccessMessage
//        - Initially hidden
//        - Velo shows: success message with RMA number
//        - Velo sets ARIA: role="status"
//        - Style: success color
//
//     b) Text → ID: returnError
//        - Initially hidden
//        - Velo shows with error text
//        - Velo sets ARIA: role="alert", ariaLive="assertive"
//        - Style: error color
//
//     c) Text → ID: returnFormError
//        - Initially hidden
//        - Velo shows: form-specific errors
//        - Velo sets ARIA: role="alert", ariaLive="assertive"
//        - Style: error color
//
//     d) Loading indicator → ID: returnLoader
//        - Initially hidden
//        - Velo shows/hides during API calls
//
//     e) Button → ID: newReturnSearchBtn
//        - Label: "New Search"
//        - Velo sets ariaLabel: "Start a new return lookup"
//        - Resets form and collapses results
//
// ═══════════════════════════════════════════════════════════════════
// LAYOUT NOTES
// ═══════════════════════════════════════════════════════════════════
//
// - Lookup form + RMA tracker: side by side or stacked, top of page
// - Results section: full width below form
// - Existing returns: card layout in repeater
// - Return form: standard form layout with item selection grid
// - RMA status: card with timeline visualization
// - All sections responsive (collapse on mobile handled by Velo)
// - Page SEO: Velo calls initPageSeo('returns')
//
// The Velo code will automatically:
// - Set all text content and ARIA labels
// - Apply status-based colors (success/error/blue)
// - Populate dropdowns from backend data
// - Handle form submission with validation
// - Show/hide sections based on lookup results
// - Support URL prefill (?order=XXX&email=YYY or ?rma=XXX)

console.log('[godfrey] Returns page elements: MANUAL EDITOR TASK');
console.log('See script comments for 51 elements across 7 sections.');
