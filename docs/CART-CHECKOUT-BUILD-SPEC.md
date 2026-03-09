# Cart Page + Side Cart + Checkout — Wix Studio Element Build Spec

> **For**: radahn (Playwright executor)
> **From**: godfrey (element architect)
> **Target**: My Site 2 (metaSiteId: `49cd75b0-92f1-4978-93e2-f5b5da531142`)
> **Source**: `src/pages/Cart Page.js`, `Side Cart.js`, `Checkout.js` + public helpers

---

## How to Use This Spec

Each element has: **Wix ID** (what to set in Properties panel), **Type** (Wix Studio element type), **Parent** (containing element), and **Notes** (styling/config hints).

In Wix Studio:
1. Navigate to the target page
2. Add each element using the type specified
3. Set the element ID in Properties panel (right-click → Properties → ID field)
4. Parent relationships indicate nesting — add child elements inside their parent container/repeater

---

## PAGE 1: Cart Page (`Cart Page.js`)

### Page-Level Setup
- Create page named "Cart Page" at route `/cart-page`
- Page background: Off-White `#FAF7F2`
- Attach `Cart Page.js` as page code

### Section 1: Cart Dataset (hidden)

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `cartDataset` | Dataset | Page | Connect to Wix Stores Cart. Hidden element. |

### Section 2: Empty Cart State

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `emptyCartSection` | Container/Box | Page | Initially collapsed. Shows when cart is empty. BG: Sand Light `#F2E8D5` |
| `emptyCartTitle` | Text | emptyCartSection | Heading text. Font: Playfair Display, color: Espresso `#3A2518` |
| `emptyCartMessage` | Text | emptyCartSection | Body text. Font: Source Sans 3, color: Espresso Light `#5C4033` |
| `continueShoppingBtn` | Button | emptyCartSection | CTA button. BG: Coral `#E8845C`, text: white. Label: "Continue Shopping" |

### Section 3: Shipping Progress Bar

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `shippingProgressBar` | Progress Bar | Page | Track: Sand Dark `#D4BC96`, fill: Mountain Blue `#5B8FA8` |
| `shippingProgressText` | Text | Page | Status text below bar. ARIA: role=status, ariaLive=polite |
| `shippingProgressIcon` | Image/Icon | Page | Checkmark icon. Initially hidden. Shows when threshold met. |

### Section 4: Tier Discount Progress Bar

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `tierProgressBar` | Progress Bar | Page | Track: Sand Dark, fill: Coral `#E8845C` |
| `tierProgressText` | Text | Page | Tier label text. ARIA: role=status, ariaLive=polite |

### Section 5: Cart Items Repeater

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `cartItemsRepeater` | Repeater | Page | Main cart items list |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `cartItemName` | Text | cartItemsRepeater item | Product name. Color: Espresso `#3A2518` |
| `cartItemPrice` | Text | cartItemsRepeater item | Price. Color: Espresso Light `#5C4033` |
| `qtyMinus` | Button | cartItemsRepeater item | "−" button. Color: Mountain Blue `#5B8FA8` |
| `qtyInput` | Text Input | cartItemsRepeater item | Quantity field. ARIA: role=spinbutton |
| `qtyPlus` | Button | cartItemsRepeater item | "+" button. Color: Mountain Blue `#5B8FA8` |
| `removeItem` | Button/Icon | cartItemsRepeater item | Remove "×" button. Color: Coral `#E8845C` |
| `saveForLaterBtn` | Button | cartItemsRepeater item | "Save for Later" link/button. Optional — may not exist in all layouts. |

### Section 6: Coupon Code Input

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `couponSection` | Container/Box | Page | Coupon input area |
| `couponInput` | Text Input | couponSection | Placeholder: "Enter coupon code". ARIA label: "Enter coupon code" |
| `couponApplyBtn` | Button | couponSection | Label: "Apply". CTA style. |
| `couponRemoveBtn` | Button | couponSection | Label: "Remove". Initially hidden. |
| `couponError` | Text | couponSection | Error message. Initially hidden. ARIA: role=alert, ariaLive=assertive |
| `couponErrorText` | Text | couponSection | Error message text content |
| `couponSuccess` | Text | couponSection | Success message. Initially hidden. ARIA: ariaLive=polite |
| `couponSuccessText` | Text | couponSection | Success text content |
| `couponLoadingIcon` | Image/Icon | couponSection | Loading spinner. Initially hidden. |

### Section 7: Delivery Estimate

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `cartDeliverySection` | Container/Box | Page | Delivery estimate area. Initially collapsed. |
| `cartDeliveryEstimate` | Text | cartDeliverySection | Delivery date range text. ARIA: role=status, ariaLive=polite |
| `cartDeliveryIcon` | Image/Icon | cartDeliverySection | Truck/delivery icon. Initially hidden. |

### Section 8: Cart Totals

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `cartSubtotal` | Text | Page | Subtotal amount. ARIA: role=status, ariaLive=polite |
| `cartShipping` | Text | Page | Shipping amount or "Calculated at checkout" |
| `cartTotal` | Text | Page | Order total. Bold. ARIA: role=status, ariaLive=polite |

### Section 9: Financing

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `cartFinancingSection` | Container/Box | Page | Financing options. Collapsed on mobile. |
| `financingThreshold` | Text | cartFinancingSection | Threshold message. Initially hidden. |
| `cartFinancingTeaser` | Text | cartFinancingSection | Monthly payment teaser. Initially hidden. |
| `cartAfterpayMessage` | Text | cartFinancingSection | Afterpay message. Initially hidden. |

### Section 10: Cross-Sell Suggestions ("Complete the Room")

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `suggestionsSection` | Container/Box | Page | Cross-sell area. Collapsed when no suggestions. |
| `suggestionsHeading` | Text | suggestionsSection | "Complete the Room" heading |
| `suggestionsSubheading` | Text | suggestionsSection | Subheading text |
| `sugSavingsBadge` | Text/Badge | suggestionsSection | Bundle savings badge |
| `suggestionsRepeater` | Repeater | suggestionsSection | Product suggestion cards |
| `sugBundlePrice` | Text | suggestionsSection | Bundle price |
| `sugOriginalPrice` | Text | suggestionsSection | Original price (strikethrough) |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `sugImage` | Image | suggestionsRepeater item | Product image |
| `sugName` | Text | suggestionsRepeater item | Product name |
| `sugPrice` | Text | suggestionsRepeater item | Product price |
| `sugAddBtn` | Button | suggestionsRepeater item | "Add to Cart" button. Coral CTA. |

### Section 11: Recently Viewed

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `cartRecentSection` | Container/Box | Page | Recently viewed section. Collapsed on mobile & when empty. |
| `cartRecentRepeater` | Repeater | cartRecentSection | Horizontal scroll of recently viewed products |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `cartRecentImage` | Image | cartRecentRepeater item | Product image. Clickable. |
| `cartRecentName` | Text | cartRecentRepeater item | Product name. Clickable. |
| `cartRecentPrice` | Text | cartRecentRepeater item | Product price |

---

## PAGE 2: Side Cart (`Side Cart.js`)

### Page-Level Setup
- This is a **lightbox/panel** element on the Master Page, not a standalone page
- Attach `Side Cart.js` as page code
- The side cart slides in from the right

### Global Elements (on Master Page)

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `cartIcon` | Button/Icon | Master Page header | Cart icon in nav. Clicking opens side cart. |
| `cartBadge` | Text | cartIcon area | Item count badge. ARIA: role=status, ariaLive=polite. Initially hidden. |

### Side Cart Panel

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `sideCartOverlay` | Container/Box | Master Page | Dark overlay behind panel. Clicking closes cart. BG: rgba(0,0,0,0.5) |
| `sideCartPanel` | Container/Box | Master Page | Slide-out panel. ARIA: role=dialog, ariaModal=true, ariaLabel="Shopping cart". BG: Off-White `#FAF7F2`. Width ~400px, full height, right-anchored. |
| `sideCartTitle` | Text | sideCartPanel | "Your Cart" heading. Color: Espresso `#3A2518` |
| `sideCartClose` | Button/Icon | sideCartPanel | "×" close button. ARIA label: "Close cart" |
| `sideCartEmpty` | Container/Box | sideCartPanel | Empty state message. Initially hidden. |
| `sideCartItems` | Container/Box | sideCartPanel | Items container. |
| `sideCartFooter` | Container/Box | sideCartPanel | Footer with totals + buttons. |

### Side Cart Items Repeater

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `sideCartRepeater` | Repeater | sideCartItems | Cart line items |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `sideItemImage` | Image | sideCartRepeater item | Product thumbnail |
| `sideItemName` | Text | sideCartRepeater item | Product name. Color: Espresso |
| `sideItemPrice` | Text | sideCartRepeater item | Unit price. Color: Espresso Light |
| `sideItemQty` | Text | sideCartRepeater item | Quantity display. ARIA: role=status, ariaLive=polite |
| `sideQtyMinus` | Button | sideCartRepeater item | "−" button. Color: Mountain Blue |
| `sideQtyPlus` | Button | sideCartRepeater item | "+" button. Color: Mountain Blue |
| `sideItemLineTotal` | Text | sideCartRepeater item | Line total (price × qty) |
| `sideItemVariant` | Text | sideCartRepeater item | Variant details ("Size: Queen · Finish: Honey Oak"). Initially hidden. |
| `sideItemRemove` | Button/Icon | sideCartRepeater item | Remove button. Color: Coral |
| `sideSaveForLater` | Button | sideCartRepeater item | "Save for Later" link. Optional. |

### Side Cart Progress Bars

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `sideShippingBar` | Progress Bar | sideCartFooter | Free shipping progress. Track: Sand Dark, fill: Mountain Blue |
| `sideShippingText` | Text | sideCartFooter | Shipping progress text. ARIA: role=status, ariaLive=polite |
| `sideTierBar` | Progress Bar | sideCartFooter | Tier discount progress. Track: Sand Dark, fill: Coral |
| `sideTierText` | Text | sideCartFooter | Tier progress text. ARIA: role=status, ariaLive=polite |

### Side Cart Footer

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `sideCartSubtotal` | Text | sideCartFooter | Subtotal. ARIA: role=status, ariaLive=polite |
| `sideCartCheckout` | Button | sideCartFooter | "Checkout" CTA. BG: Coral `#E8845C`, text: white |
| `viewFullCart` | Button/Link | sideCartFooter | "View Full Cart" link. Color: Mountain Blue `#5B8FA8` |

### Side Cart Cross-Sell

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `sideCartSuggestion` | Container/Box | sideCartPanel | Cross-sell section. Collapsed on mobile & when empty. |
| `sideSugLabel` | Text | sideCartSuggestion | "Complete the Room" heading |
| `sideSugSubheading` | Text | sideCartSuggestion | Subheading |
| `sideSugSavingsBadge` | Text/Badge | sideCartSuggestion | Savings badge |
| `sideSugRepeater` | Repeater | sideCartSuggestion | Suggestion cards |
| `sideSugBundlePrice` | Text | sideCartSuggestion | Bundle price |
| `sideSugOriginalPrice` | Text | sideCartSuggestion | Original price (strikethrough) |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `sideSugImage` | Image | sideSugRepeater item | Product image |
| `sideSugName` | Text | sideSugRepeater item | Product name |
| `sideSugPrice` | Text | sideSugRepeater item | Product price |
| `sideSugAdd` | Button | sideSugRepeater item | "Add" button. Coral CTA. |

---

## PAGE 3: Checkout (`Checkout.js`)

### Page-Level Setup
- Create page named "Checkout" at route `/checkout`
- Page background: Off-White `#FAF7F2`
- Attach `Checkout.js` as page code
- Layout: 2-column on desktop (main content left, order summary sidebar right)

### Section 1: Checkout Progress Indicator

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `checkoutProgressNav` | Container/Box | Page | Progress bar container. ARIA: role=navigation, ariaLabel="Checkout progress" |
| `checkoutProgressRepeater` | Repeater | checkoutProgressNav | 4 steps: Information → Shipping → Payment → Review |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `progressStepContainer` | Container/Box | checkoutProgressRepeater item | Step wrapper. Carries ariaCurrent for active step. |
| `progressStepDot` | Shape/Circle | progressStepContainer | Step indicator dot. Active: Mountain Blue, completed: green, pending: Sand Dark |
| `progressStepNumber` | Text | progressStepContainer | Step number ("1", "2", etc.) |
| `progressStepCheck` | Image/Icon | progressStepContainer | Checkmark icon for completed steps. Initially hidden. |
| `progressStepLabel` | Text | progressStepContainer | Step name ("Information", "Shipping", etc.) Active: bold Mountain Blue. |

### Section 2: Trust Signals

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `trustRepeater` | Repeater | Page | Horizontal row of trust badges (4 items) |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `trustIcon` | Image | trustRepeater item | Lock/shield/card/phone icon. ARIA: ariaHidden=true |
| `trustText` | Text | trustRepeater item | "Secure SSL Checkout", "30-Day Money-Back Guarantee", etc. |

### Section 3: Order Notes

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `orderNotesToggle` | Button/Link | Page | "Add order notes" toggle. ARIA: ariaExpanded=false |
| `orderNotesField` | Text Input (multiline) | Page | Initially collapsed. ARIA label: "Special delivery instructions" |

### Section 4: Checkout Summary Info

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `checkoutFreeShipping` | Text | Page | Free shipping status. Initially hidden. ARIA: role=status |
| `checkoutItemCount` | Text | Page | "X items in your order" |

### Section 5: Payment Methods

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `paymentMethodsRepeater` | Repeater | Page | Payment method options (credit card, Apple Pay, Google Pay) |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `paymentMethodIcon` | Image | paymentMethodsRepeater item | Payment method icon. ARIA: ariaHidden=true |
| `paymentMethodName` | Text | paymentMethodsRepeater item | Method name |
| `paymentBrands` | Text | paymentMethodsRepeater item | Card brands ("Visa · Mastercard · Amex"). Initially hidden. |

### Section 6: Afterpay & Financing

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `checkoutAfterpay` | Container/Box | Page | Afterpay section. Initially collapsed. |
| `afterpayMessage` | Text | checkoutAfterpay | Afterpay description |
| `afterpayInstallment` | Text | checkoutAfterpay | "4 payments of $X.XX" |
| `checkoutFinancing` | Container/Box | Page | Financing section. Initially collapsed. Collapsed on mobile. |
| `financingMessage` | Text | checkoutFinancing | Financing message |
| `checkoutShippingMessage` | Text | Page | Shipping method message. ARIA: role=status |

### Section 7: Shipping Options

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `shippingOptionsRepeater` | Repeater | Page | Shipping method choices |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `shippingOptionRadio` | Radio Button | shippingOptionsRepeater item | Selection control. Apply focus ring. |
| `shippingOptionLabel` | Text | shippingOptionsRepeater item | Method name ("Standard", "Express", etc.) |
| `shippingOptionPrice` | Text | shippingOptionsRepeater item | Price or "FREE" |
| `shippingOptionDesc` | Text | shippingOptionsRepeater item | Description |
| `shippingOptionDays` | Text | shippingOptionsRepeater item | "5–10 business days" |

### Section 8: Address Validation

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `addressFullName` | Text Input | Page | ARIA label: "Full name", ariaRequired=true |
| `addressFullNameError` | Text | Page | Inline error. Initially hidden. ARIA: role=alert, ariaLive=assertive |
| `addressLine1` | Text Input | Page | ARIA label: "Street address", ariaRequired=true |
| `addressLine1Error` | Text | Page | Inline error. Initially hidden. |
| `addressCity` | Text Input | Page | ARIA label: "City", ariaRequired=true |
| `addressCityError` | Text | Page | Inline error. Initially hidden. |
| `addressState` | Text Input | Page | ARIA label: "State (2-letter code)", ariaRequired=true |
| `addressStateError` | Text | Page | Inline error. Initially hidden. |
| `addressZip` | Text Input | Page | ARIA label: "ZIP code", ariaRequired=true |
| `addressZipError` | Text | Page | Inline error. Initially hidden. |
| `validateAddressBtn` | Button | Page | "Verify Address" CTA. BG: Coral `#E8845C`, text: white |
| `addressErrors` | Text | Page | General error message. Initially hidden. ARIA: role=alert |
| `addressSuccess` | Text | Page | "Address verified" message. Initially hidden. ARIA: role=status |

### Section 9: Delivery Estimate

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `checkoutDeliveryEstimate` | Text | Page | "Estimated delivery: Mar 15 – Mar 22". ARIA: role=status, ariaLive=polite |

### Section 10: Order Summary Sidebar

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `orderSummarySidebar` | Container/Box | Page | Right column sidebar. Initially hidden until cart loads. ARIA label: "Order summary" |
| `orderSummaryItemsRepeater` | Repeater | orderSummarySidebar | Line items list |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `summaryItemName` | Text | orderSummaryItemsRepeater item | Item name |
| `summaryItemQty` | Text | orderSummaryItemsRepeater item | "×2" |
| `summaryItemPrice` | Text | orderSummaryItemsRepeater item | Line total |

**Summary totals:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `orderSummarySubtotal` | Text | orderSummarySidebar | Subtotal amount |
| `orderSummaryShipping` | Text | orderSummarySidebar | Shipping amount or "FREE" |
| `orderSummaryTax` | Text | orderSummarySidebar | Tax amount |
| `orderSummaryTotal` | Text | orderSummarySidebar | Order total. Bold. |
| `orderSummarySavings` | Text | orderSummarySidebar | Savings message. Initially hidden. |
| `orderSummaryStoreCredit` | Text | orderSummarySidebar | Store credit deduction. Initially hidden. |
| `orderSummaryStoreCreditRow` | Container/Box | orderSummarySidebar | Store credit row. Initially hidden. |
| `orderSummaryGiftCard` | Text | orderSummarySidebar | Gift card deduction. Initially hidden. |
| `orderSummaryGiftCardRow` | Container/Box | orderSummarySidebar | Gift card row. Initially hidden. |

### Section 11: Store Credit

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `storeCreditSection` | Container/Box | Page | Store credit display (Member Page context). Initially hidden. |
| `storeCreditBalance` | Text | storeCreditSection | Current balance |
| `storeCreditExpirationWarning` | Text | storeCreditSection | Expiration warning. Initially hidden. |
| `storeCreditCheckoutSection` | Container/Box | Page | Checkout-specific credit section. Initially hidden. |
| `storeCreditAvailable` | Text | storeCreditCheckoutSection | Available credit text |
| `storeCreditApplyAmount` | Text | storeCreditCheckoutSection | Amount to apply |
| `storeCreditApplyBtn` | Button | storeCreditCheckoutSection | "Apply Store Credit" button |
| `storeCreditAppliedSection` | Container/Box | Page | Applied confirmation. Initially hidden. |
| `storeCreditAppliedAmount` | Text | storeCreditAppliedSection | Applied amount text |

### Section 12: Gift Card

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `giftCardCheckoutSection` | Container/Box | Page | Gift card input area. Initially hidden. |
| `giftCardCodeInput` | Text Input | giftCardCheckoutSection | ARIA label: "Enter gift card code" |
| `giftCardApplyBtn` | Button | giftCardCheckoutSection | "Apply" button |
| `giftCardCheckoutError` | Text | giftCardCheckoutSection | Error message. Initially hidden. |
| `giftCardAppliedSection` | Container/Box | Page | Applied confirmation. Initially hidden. |
| `giftCardAppliedAmount` | Text | giftCardAppliedSection | Applied amount text |

### Section 13: Protection Plan Upsell

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `protectionPlanSection` | Container/Box | Page | Protection plans area. Initially hidden. ARIA: role=region, ariaLabel="Furniture protection plans" |
| `protectionPlanTitle` | Text | protectionPlanSection | "Protect Your Furniture" heading |
| `protectionPlanSubtitle` | Text | protectionPlanSection | Description text |
| `protectionPlanRepeater` | Repeater | protectionPlanSection | Per-product protection options |

**Repeater item children (product level):**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `protPlanProductName` | Text | protectionPlanRepeater item | Product name |
| `protPlanProductPrice` | Text | protectionPlanRepeater item | Product price |
| `protPlanTierRepeater` | Repeater | protectionPlanRepeater item | Nested repeater for tier options (Basic/Standard/Premium) |
| `protPlanDecline` | Button/Link | protectionPlanRepeater item | "No thanks" decline link |

**Nested tier repeater children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `tierCard` | Container/Box | protPlanTierRepeater item | Tier card. Border: Sand Dark (default), Mountain Blue (selected) |
| `tierName` | Text | tierCard | Tier name ("Basic", "Standard", "Premium") |
| `tierPrice` | Text | tierCard | "+$XX.XX" |
| `tierDuration` | Text | tierCard | "X-year coverage" |
| `tierCoverage` | Text | tierCard | Coverage details joined by " · " |
| `tierSelectBtn` | Button | tierCard | "Add Protection" / "Selected". Default BG: Coral, Selected BG: Mountain Blue |

### Section 14: Express Checkout

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `expressCheckoutSection` | Container/Box | Page | Express checkout area. Collapsed on mobile. |
| `expressCheckoutBtn` | Button | expressCheckoutSection | "Express Checkout" CTA. BG: Coral. Initially disabled (until address validated). |
| `expressSummarySection` | Container/Box | Page | Express summary confirmation. Initially hidden. |
| `expressSummaryTotal` | Text | expressSummarySection | "Total: $X.XX" |
| `expressSummaryShipping` | Text | expressSummarySection | Shipping cost or "Free Shipping" |
| `expressSummaryAddress` | Text | expressSummarySection | Formatted address |

---

## Element Count Summary

| Page | Elements | Repeaters | Nested Repeaters |
|------|----------|-----------|------------------|
| Cart Page | 35 | 3 (cartItems, suggestions, recentlyViewed) | 0 |
| Side Cart | 30 | 2 (sideCart, sideSuggestions) | 0 |
| Checkout | 62 | 6 (progress, trust, payment, shipping, orderSummary, protectionPlan) | 1 (tierRepeater inside protectionPlan) |
| **Total** | **127** | **11** | **1** |

---

## Design Token Quick Reference

| Token | Hex | Usage |
|-------|-----|-------|
| Sand | `#E8D5B7` | Backgrounds |
| Sand Light | `#F2E8D5` | Card backgrounds |
| Sand Dark | `#D4BC96` | Borders, progress bar tracks |
| Off-White | `#FAF7F2` | Page background |
| Espresso | `#3A2518` | Primary text, headings |
| Espresso Light | `#5C4033` | Secondary text |
| Mountain Blue | `#5B8FA8` | Links, qty buttons, active progress |
| Coral | `#E8845C` | **ALL CTA buttons**, remove buttons, sale badges |
| Coral Dark | `#C96B44` | CTA hover state |
| White | `#FFFFFF` | CTA button text, modal BG |

---

## Build Order Recommendation

1. **Cart Page** — Start here (simplest, standalone page)
   - Empty cart section first (quick win)
   - Cart items repeater (core functionality)
   - Totals + progress bars
   - Cross-sell + recently viewed (nice-to-have sections)
   - Coupon + financing (enhancement sections)

2. **Side Cart** — Second (depends on Master Page cart icon)
   - Panel + overlay on Master Page
   - Items repeater
   - Footer with totals + CTA buttons
   - Progress bars + cross-sell

3. **Checkout** — Last (most complex, 62 elements)
   - Progress indicator + trust signals
   - Address form (5 inputs + 5 error texts + validate button)
   - Shipping options repeater
   - Order summary sidebar
   - Payment methods + Afterpay/financing
   - Store credit + gift card sections
   - Protection plan (nested repeater — most complex)
   - Express checkout
