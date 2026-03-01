# Hookup Audit: Commerce Pages — Wix Studio Readiness

**Bead**: cf-zky8
**Date**: 2026-03-01
**Auditor**: Godfrey
**Pages**: Cart Page, Side Cart, Checkout, Member Page, Thank You Page, Order Tracking, Returns, Admin Returns

---

## Executive Summary

| Page | IDs in Code | Matched in Spec | Missing from Spec | Missing from Code | Backend OK? | Dead Code |
|------|-------------|-----------------|-------------------|-------------------|-------------|-----------|
| Cart Page | 34 | 30 | **4** | 0 | Yes | 1 unused import |
| Side Cart | 31 | 27 | **3** | 0 | Yes | 2 unused imports |
| Checkout | 60 | 35 | **25** | 0 | Yes | 1 unused import |
| Member Page | 48 | 46 | **2** | 0 | Yes | 0 |
| Thank You Page | 46 | 34 | **12** | 0 | Yes | 0 |
| Order Tracking | 44 | 44 | **0** | 0 | Yes | 0 |
| Returns | 51 | 0 | **51** | N/A | Yes | 1 unused import |
| Admin Returns | 57 | 0 | **57** | N/A | Yes | 1 dead function + 3 unused imports |
| **TOTALS** | **371** | **216** | **154** | **0** | **All pass** | **9 items** |

**154 element IDs (42%) are in code but missing from the BUILD-SPEC.** A Wix Studio builder following only the spec would produce pages missing critical UI elements.

---

## Page-by-Page Findings

---

### 1. Cart Page (`Cart Page.js`)

**Matched: 30 | Missing from Spec: 4 | Missing from Code: 0**

#### IDs in Code but MISSING from Spec

| ID | Lines | Purpose |
|----|-------|---------|
| `#cartFinancingSection` | 77, 297, 300, 303, 305 | Financing options container |
| `#financingThreshold` | 309-314 | "Add $X more to unlock financing" |
| `#cartFinancingTeaser` | 320-326 | Lowest monthly payment teaser |
| `#cartAfterpayMessage` | 331-337 | Afterpay eligibility message |

> **Impact**: Entire financing feature (4 elements) has zero spec representation.

#### Unused Imports
- `isMobile` (line 18) — imported from `public/mobileHelpers` but never called

#### Backend/Public Imports — All Resolve
- `backend/productRecommendations.web` — exists
- `backend/financingCalc.web` — exists
- All 5 public imports verified

---

### 2. Side Cart (`Side Cart.js`)

**Matched: 27 | Missing from Spec: 3 | Missing from Code: 0**

#### IDs in Code but MISSING from Spec

| ID | Lines | Purpose |
|----|-------|---------|
| `#cartBadge` | 204, 217-218 | Cart item count badge on cart icon |
| `#sideQtyMinus` | 124-125 | Decrease quantity button (repeater child) |
| `#sideQtyPlus` | 141-142 | Increase quantity button (repeater child) |

> **Impact**: Spec lists `#sideItemQty` but not the +/- buttons. Builder would create quantity text with no controls. `#cartBadge` may belong in Master Page spec.

#### Unused Imports
- `clampQuantity` (line 13) — imported but never called
- `FREE_SHIPPING_THRESHOLD` (line 14) — imported but never called

#### Backend/Public Imports — All Resolve

---

### 3. Checkout (`Checkout.js`)

**Matched: 35 | Missing from Spec: 25 | Missing from Code: 0**

#### IDs in Code but MISSING from Spec

**Payment Methods Section (5 elements)**:
| ID | Purpose |
|----|---------|
| `#paymentMethodsRepeater` | Payment methods repeater |
| `#paymentMethodName` | Method name (repeater child) |
| `#paymentMethodIcon` | Method icon (repeater child) |
| `#paymentBrands` | Card brand list text (repeater child) |
| `#trustIcon` | Trust badge icon image (repeater child of `#trustRepeater`) |

**Afterpay Section (3 elements)**:
| ID | Purpose |
|----|---------|
| `#checkoutAfterpay` | Afterpay section container |
| `#afterpayMessage` | Afterpay promotional text |
| `#afterpayInstallment` | Afterpay installment amount |

**Financing Section (2 elements)**:
| ID | Purpose |
|----|---------|
| `#checkoutFinancing` | Financing section container |
| `#financingMessage` | Financing promotional text |

**Shipping Options Section (6 elements)**:
| ID | Purpose |
|----|---------|
| `#checkoutShippingMessage` | Shipping status message |
| `#shippingOptionsRepeater` | Shipping method selection repeater |
| `#shippingOptionLabel` | Method name (repeater child) |
| `#shippingOptionPrice` | Method price (repeater child) |
| `#shippingOptionDesc` | Method description (repeater child) |
| `#shippingOptionDays` | Estimated delivery days (repeater child) |
| `#shippingOptionRadio` | Selection radio (repeater child) |

**Address Validation Form (8 elements)**:
| ID | Purpose |
|----|---------|
| `#validateAddressBtn` | "Validate Address" button |
| `#addressFullName` | Full name input |
| `#addressLine1` | Street address input |
| `#addressCity` | City input |
| `#addressState` | State input |
| `#addressZip` | ZIP code input |
| `#addressErrors` | General address error text |
| `#addressSuccess` | Validation success text |

> **Impact**: 42% of Checkout IDs (25/60) are undocumented. The spec has error label elements but is missing the actual input fields and validate button. Entire Payment Methods, Afterpay, Financing, and Shipping Options sections are invisible to the builder.

#### Unused Imports
- `makeClickable` (line 9) — imported but never called

#### Backend/Public Imports — All Resolve
- `backend/paymentOptions.web` — exists
- `backend/checkoutOptimization.web` — exists (5 functions)
- All 7 public imports verified

---

### 4. Member Page (`Member Page.js`)

**Matched: 46 | Missing from Spec: 2 | Missing from Code: 0**

#### IDs in Code but MISSING from Spec

| ID | Lines | Purpose |
|----|-------|---------|
| `#wishlistEmpty` | 491 | Empty state when wishlist has 0 items |
| `#startReturnBtn` | 247 | Global returns button (clicked programmatically from per-order return handler) |

> **Impact**: `#startReturnBtn` is critical — without it, the "Start Return" button on each order silently fails (swallowed by try/catch). `#wishlistEmpty` is needed for UX.

#### Dead Code — None

#### Backend/Public Imports — All Resolve
- 3 backend (dynamic imports): `errorMonitoring.web`, `loyaltyService.web`, `notificationService.web` — all exist
- 6 public imports verified including `ReturnsPortal.js`

---

### 5. Thank You Page (`Thank You Page.js`)

**Matched: 34 | Missing from Spec: 12 | Missing from Code: 0**

#### IDs in Code but MISSING from Spec

**Testimonial Section (8 elements — entire section missing)**:
| ID | Purpose |
|----|---------|
| `#testimonialSection` | Section container |
| `#testimonialTitle` | "Share Your Experience" heading |
| `#testimonialPrompt` | Prompt text |
| `#testimonialNameInput` | Name input |
| `#testimonialStoryInput` | Story textarea |
| `#testimonialSubmitBtn` | Submit button |
| `#testimonialError` | Error text |
| `#testimonialSuccess` | Success text |

**Delivery Timeline Steps (4 elements)**:
| ID | Purpose |
|----|---------|
| `#step1` | "Order confirmed" |
| `#step2` | "Preparing your items" |
| `#step3` | "Shipped with tracking" |
| `#step4` | "Delivered to your door" |

> **Impact**: The entire Testimonial Submission feature (8 elements) is fully implemented in code but has zero spec presence. The 4 delivery timeline step texts are also missing — spec only defines the container.

#### Dead Code — None

#### Backend/Public Imports — All Resolve
- 5 backend files verified (including dynamic imports)
- 6 public imports verified

---

### 6. Order Tracking (`Order Tracking.js`)

**Matched: 44 | Missing from Spec: 0 | Missing from Code: 0**

> **FULLY READY** — Perfect 1:1 match between code and spec. All 44 element IDs are documented. All backend and public imports resolve. No dead code.

---

### 7. Returns (`Returns.js`)

**Matched: 0 | Missing from Spec: 51 | No Spec Section Exists**

> **CRITICAL**: The Returns page has NO section in WIX-STUDIO-BUILD-SPEC.md. All 51 element IDs are undocumented. A builder would not know this page exists.

#### Complete Element List (all 51 need spec entries)

**Lookup Form**: `#returnsTitle`, `#returnsSubtitle`, `#returnOrderNumberInput`, `#returnEmailInput`, `#lookupReturnBtn`

**RMA Tracker**: `#rmaInput`, `#trackRmaBtn`

**Results Section**: `#returnResultsSection`, `#returnOrderNumber`, `#returnOrderDate`, `#returnOrderTotal`, `#returnWindowStatus`

**Existing Returns Repeater** (`#existingReturnsRepeater`): `#existingReturnsSection`, `#existingRma`, `#existingReturnDate`, `#existingReturnType`, `#existingReturnReason`, `#existingReturnStatus`, `#existingReturnTimeline`, `#existingTrackingNumber`

**Return Form**: `#returnFormSection`, `#returnReasonSelect`, `#returnTypeSelect`, `#returnItemsSelector` (repeater), `#selectItemName`, `#selectItemQty`, `#selectItemPrice`, `#selectItemImage`, `#selectItemCheckbox`, `#selectItemBlockReason`, `#returnDetailsTextbox`, `#submitGuestReturnBtn`, `#cancelReturnFormBtn`

**RMA Status**: `#rmaResultsSection`, `#rmaStatusNumber`, `#rmaStatusLabel`, `#rmaTimeline`, `#rmaTrackingSection`, `#rmaTrackingNumber`, `#rmaTrackingStatus`, `#rmaActivityRepeater`, `#rmaActivityStatus`, `#rmaActivityLocation`, `#rmaActivityDate`, `#rmaNoTracking`

**UI States**: `#returnSuccessMessage`, `#returnError`, `#returnFormError`, `#returnLoader`, `#newReturnSearchBtn`

#### Unused Imports
- `isItemReturnable` (line 7) — imported but never called (used internally by `getReturnableItems`)

#### Backend/Public Imports — All Resolve

---

### 8. Admin Returns (`Admin Returns.js`)

**Matched: 0 | Missing from Spec: 57 | No Spec Section Exists**

> **CRITICAL**: The Admin Returns page has NO section in WIX-STUDIO-BUILD-SPEC.md. All 57 element IDs are undocumented.

#### Complete Element List (all 57 need spec entries)

**Stats Cards**: `#statTotal`, `#statTotalLabel`, `#statActionRequired`, `#statActionLabel`, `#statInProgress`, `#statProgressLabel`, `#statCompleted`, `#statCompletedLabel`

**Filter/Refresh**: `#statusFilterDropdown`, `#refreshBtn`

**Returns Repeater** (`#returnsRepeater`): `#rmaNumber`, `#orderNumber`, `#customerName`, `#returnType`, `#returnDate`, `#returnReason`, `#statusBadge`, `#actionDot`, `#itemCount`, `#viewDetailsBtn`

**Detail Panel** (`#detailPanel`): `#closeDetailBtn`, `#detailRma`, `#detailStatus`, `#detailCustomer`, `#detailEmail`, `#detailOrder`, `#detailDate`, `#detailType`, `#detailReason`, `#detailDescription`, `#detailNotes`, `#trackingSection`, `#detailTracking`, `#detailRefundAmount`

**Status Actions** (`#statusActionsSection`): `#approveBtn`, `#denyBtn`, `#markShippedBtn`, `#markReceivedBtn`

**Label/Tracking**: `#generateLabelBtn`, `#trackShipmentBtn`, `#trackingStatus`, `#trackingEta`

**Refund Modal** (`#refundModal`): `#cancelRefundBtn`, `#confirmRefundBtn`, `#processRefundBtn`, `#refundRmaLabel`, `#refundCustomerLabel`, `#refundAmountInput`, `#refundNotesInput`, `#refundError`

**UI States**: `#emptyState`, `#dashboardLoader`, `#dashboardError`

#### Dead Code
- **`initTrackingButton()` (line 397)** — function defined but NEVER CALLED. Wires up `#trackShipmentBtn`, `#trackingStatus`, and `#trackingEta` but these handlers never execute at runtime. Should be called from `initDetailPanel()` or `renderDetail()`.
- `isValidTransition` (line 7) — imported but never called
- `getAdminStatusColor` (line 7) — imported but never called (pre-computed by `formatAdminReturnRow`)
- `typography` (line 6) — imported but never used

#### Backend/Public Imports — All Resolve

---

## Wix Studio Editor Elements Needed

### Elements to ADD to BUILD-SPEC

| Page | Section to Add | Element Count |
|------|----------------|---------------|
| Cart Page | Financing Options table | 4 |
| Side Cart | +/- buttons + badge | 3 |
| Checkout | Payment Methods, Afterpay, Financing, Shipping Options, Address Form | 25 |
| Member Page | Wishlist empty state, returns button | 2 |
| Thank You | Testimonial section, timeline steps, newsletter error | 12 |
| Returns | **Entire new page section** | 51 |
| Admin Returns | **Entire new page section** | 57 |
| **TOTAL** | | **154** |

---

## Code Cleanup Recommendations

### Unused Imports (remove from import statements)

| File | Import | Line |
|------|--------|------|
| Cart Page.js | `isMobile` | 18 |
| Side Cart.js | `clampQuantity` | 13 |
| Side Cart.js | `FREE_SHIPPING_THRESHOLD` | 14 |
| Checkout.js | `makeClickable` | 9 |
| Returns.js | `isItemReturnable` | 7 |
| Admin Returns.js | `isValidTransition` | 7 |
| Admin Returns.js | `getAdminStatusColor` | 7 |
| Admin Returns.js | `typography` | 6 |

### Dead Function

| File | Function | Line | Action |
|------|----------|------|--------|
| Admin Returns.js | `initTrackingButton()` | 397 | Either call from `initDetailPanel()` or remove entirely |

---

## Verification Checklist

- [x] All 8 page files read and audited
- [x] Every `$w('#id')` and `$item('#id')` extracted
- [x] Cross-referenced against WIX-STUDIO-BUILD-SPEC.md element tables
- [x] All backend imports verified (files exist on disk)
- [x] All public imports verified (files exist on disk)
- [x] Dead code identified
- [x] No IDs in spec that are missing from code (0 gaps in that direction)
