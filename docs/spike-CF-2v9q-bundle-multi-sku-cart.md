# Spike: Bundle Builder Multi-SKU Cart Representation
**Bead:** CF-2v9q
**Author:** cfutons/crew/miquella
**Date:** 2026-03-22
**Status:** Complete — findings ready for sprint planning

---

## Executive Summary

The existing `bundleService.web.js` implementation (S1) adds frame+mattress+cover as 3 tagged
line items using `customTextFields`. **This approach is unvalidated against the real Wix ecom
API and the tags likely get silently dropped.** The proven pattern for bundle discounting in
this codebase is coupon-code-based (`bundleDeals.web.js`). The sprint should adopt that pattern
and address cohesion tracking separately.

---

## What Already Exists

| Module | Approach | Cart API | Bundle Discount | Cohesion Tag |
|--------|----------|----------|-----------------|--------------|
| `bundleService.web.js` | 3 tagged line items | `wix-ecom-backend` | CMS `bundlePrice` (NOT applied) | `customTextFields` bundleTag |
| `bundleDeals.web.js` | N tagged line items | `wix-ecom-backend` | Coupon code from CMS (APPLIED) | None |
| `cartService.js` (frontend) | Single item | `wix-stores-frontend` | — | — |

The bundle infrastructure is substantial: `bundleHelpers.js` (pure grouping utils),
`bundleBuilder.web.js` (CMS-driven recommendations), `bundleAnalytics.web.js` (tracking),
60 tests passing across bundleService + bundleHelpers.

---

## Critical Risk: `customTextFields` in the Ecom API

`customTextFields` is a **`wix-stores-frontend` concept** (legacy Stores API).

In the ecom API (`wix-ecom-backend`), `cart.addProducts` line items take:
```js
{ catalogReference: { catalogItemId, appId, options }, quantity }
```
There is no `customTextFields` field in this interface. The current `bundleService.addBundle`
passes `customTextFields: [{ title: 'bundleTag', value: 'bundle:<id>' }]` — this is almost
certainly silently dropped by the API.

**Evidence:** The tests pass because the mock (`tests/__mocks__/wix-ecom-backend.js`) accepts
any input shape without validation. The mock is not a reliable proxy for API field acceptance.

**Consequence:** Bundle cohesion detection via `validateBundleCohesion` (which reads
`customTextFields` from cart items) would always return `valid: true` — broken bundles would
go undetected.

---

## Discount Pricing Gap

`bundleService.addBundle` adds 3 items at **catalog prices**, not bundle price. The CMS has
`bundlePrice` and `savings` but neither is applied. The cart would show 3 separate full-price
items with no visible discount.

`bundleDeals.addBundleToCart` solves this correctly: it auto-applies a coupon code from CMS
after adding products, giving the customer an immediate cart discount.

---

## What Frontend Uses Bundle Tags

**Zero frontend modules read `customTextFields`** to display bundle grouping:
- `miniCartDrawer.js` — no bundle tag handling
- Cart page — no bundle tag handling
- `AddToCart.js` — uses a different pathway (`productRecommendations.getBundleSuggestion`),
  not `bundleService.addBundle`

The `bundleHelpers.extractBundleTag` / `groupBundleItems` utilities exist but have no caller
outside tests.

---

## Recommended Approach for Sprint

### Cart Representation: Follow `bundleDeals` Pattern

Add all 3 products in a single `ecomCart.addProducts` call with just `{ productId, quantity }`.
Apply a bundle-specific coupon code from CMS to give the discount. This is already proven
to work in production via `bundleDeals`.

```js
// Proven pattern (bundleDeals)
const lineItems = [
  { productId: bundle.frameProductId, quantity: 1 },
  { productId: bundle.mattressProductId, quantity: 1 },
  { productId: bundle.coverProductId, quantity: 1 },
];
await ecomCart.addProducts(lineItems);
if (bundle.couponCode) await ecomCart.applyCoupon(bundle.couponCode);
```

This requires each bundle in the `Bundles` CMS collection to have a `couponCode` field
(create matching coupons in Wix Marketing dashboard).

### Bundle Cohesion: Server-Side Session Tracking

Since `customTextFields` tagging is unreliable, track bundle membership server-side:

**Option A (recommended for S2):** After `addBundle` succeeds, write a record to a `UserBundleCart`
CMS collection: `{ memberId, sessionId, bundleId, addedAt }`. On `validateBundleCohesion`,
query this collection + cross-reference against current cart. No dependency on cart API metadata.

**Option B (acceptable for S1):** Accept that cohesion is informational-only and fire a
`bundle_component_removed` analytics event when cart change listener detects an item whose
product ID matches a known bundle component. Display a dismissible warning in the cart UI.
Lower fidelity but zero infrastructure cost.

### Cart UI Grouping

Display grouped bundles using the bundle record from CMS, not cart metadata:
1. After `addBundle`, return `{ bundleId, bundleTag, components: [...] }` to the frontend
2. Frontend caches this in `state.activeBundles`
3. Cart page/mini-cart reads `state.activeBundles` to group items visually

This is resilient to API field limitations and works today.

---

## Sprint Readiness Checklist

- [ ] **Wix Marketing:** Create one coupon code per bundle in Wix dashboard, populate `couponCode`
  field in `Bundles` CMS collection
- [ ] **`bundleService.addBundle`:** Swap `customTextFields` tagging → coupon-code pattern
  (aligned with `bundleDeals`)
- [ ] **Cohesion approach:** Decision needed — Option A (CMS tracking) or Option B (analytics-only)
- [ ] **Cart UI:** Implement frontend bundle grouping via `state.activeBundles` (not cart metadata)
- [ ] **`validateBundleCohesion`:** Refactor to query `UserBundleCart` CMS (Option A) or
  deprecate in favor of cart change listener (Option B)
- [ ] **Live sandbox test:** Confirm `ecomCart.addProducts` + `ecomCart.applyCoupon` roundtrip
  before merging (mock ≠ real API)

---

## Scope Not Changed by This Spike

- `bundleHelpers.js` pure utils remain valid regardless of cart API approach
- `bundleBuilder.web.js` recommendations layer is unaffected
- `bundleAnalytics.web.js` tracking is unaffected
- 60 existing bundle tests remain green
