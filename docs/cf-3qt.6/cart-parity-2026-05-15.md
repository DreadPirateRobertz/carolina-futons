# Cart parity — cfw vs Wix Studio (2026-05-15)

**Bead:** cf-wsrr (P1)
**Parent:** cf-3qt.6 (cart + content parity for cutover)
**Convoy:** hq-cv-n3abi
**Sibling:** cf-4i44 (policy pages parity — closed)

## TL;DR

cfw cart implements the four core ops (add / remove / update / get) and a clean checkout handoff to Wix-hosted payment via the headless SDK. **The one material gap vs Wix Studio is in-cart coupon entry** — cfw users must enter their promo code on the Wix-hosted checkout page after the redirect, not in the cart drawer/page. The Wix SDK exposes `appliedDiscounts[].coupon.code` on `currentCart.updateCurrentCart()`, so closing the gap is a UI-side feature, not a backend dependency.

Recommendation: ship coupon entry in the cart drawer pre-cutover. Email-driven coupon campaigns are the highest-frequency promo channel; users hitting "Apply code" missing in the cart is the kind of "broken" perception that produces support tickets even when checkout itself works fine.

## Per-operation parity matrix

| Op | cfw | Wix Studio | Parity verdict |
|---|---|---|---|
| Add to cart | `addToCart(items)` → `client.currentCart.addToCurrentCart` (`src/lib/wix/cart.ts:63-79`). Variant + option support via `toCatalogReference`. Optimistic client-side line via `CartProvider`. Fixture-mode short-circuit for E2E. | Standard Wix Stores add-to-cart | ✅ parity |
| Remove line item | `removeFromCart(lineItemIds)` → `client.currentCart.removeLineItemsFromCurrentCart` (`src/lib/wix/cart.ts:81-89`). Wired into CartDrawer `Remove` link (`src/components/cart/CartDrawer.tsx:147`). | Standard | ✅ parity |
| Update quantity | `updateLineItemQuantity(lineItemId, quantity)` → `client.currentCart.updateCurrentCartLineItemQuantity` (`src/lib/wix/cart.ts:91-100`). Wired into CartDrawer ± buttons (`CartDrawer.tsx:286`, `:301`). | Standard | ✅ parity |
| Get current cart | `getCurrentCart()` → `client.currentCart.getCurrentCart` (`src/lib/wix/cart.ts:44-61`). `OWNED_CART_NOT_FOUND` → null (treats no-cart as empty). cf-p7la session-token race-condition fix via `getExistingVisitorCartClient`. | Standard | ✅ parity |
| Estimate totals (subtotal / tax / shipping) | `estimateCartTotals()` → `client.currentCart.estimateCurrentCartTotals` (`src/lib/wix/cart.ts:102-105`). Used by CartDrawer subtotal line. | Wix renders pre-checkout totals in its cart UI | ✅ parity on the API; ⚠️ on display granularity — cfw shows subtotal only in the drawer; Wix Studio shows subtotal + estimated shipping + estimated tax with a ZIP probe. See **F1 below**. |
| Apply coupon / promo code | ❌ **not surfaced** — no UI, no `applyCoupon` call. SDK exposes `appliedDiscounts[].coupon.code` field on `updateCurrentCart`, so technically possible to wire. | Wix Studio cart page has a "Promo code" input that calls the same SDK field server-side. Discount is reflected in subtotal before checkout. | ❌ **gap — F2 (P1 if pre-cutover)** |
| Gift card balance application | ❌ not surfaced | Wix Studio cart supports gift-card redemption | ❌ gap — but no live carolinafutons coupon codes use gift-card flow; lower priority than F2. **F3 (P3).** |
| Order notes / special instructions | ❌ not surfaced | Wix Studio has a "Add note" textarea on cart page | ❌ minor gap — **F4 (P3)**. Most carolinafutons custom-order conversations happen via `/contact` form or phone today; cart-side notes are a "nice to have." |
| Estimated delivery date in cart | ❌ not surfaced | Wix Studio shows generic "Ships in X-Y business days" copy per item | ❌ gap — but covered out-of-band by the dedicated `/getting-it-home` page + the PDP shipping-estimate block (cf-mr3.0 ZIP-aware widget). **Acceptable trade-off**, not a finding. |
| Checkout entry (cart → payment) | `GET /checkout` route (`src/app/checkout/route.ts`) → `initCheckout()` → `currentCart.createCheckoutFromCurrentCart` → `redirects.createRedirectSession` → 307 to `redirectSession.fullUrl` (Wix-hosted page). Fixture mode short-circuits to `/order-confirmation?orderId=fixture-test-order`. | Wix Studio "Checkout" button goes to the same Wix-hosted checkout page. | ✅ parity at the destination. The cfw redirect handoff is correct + adds `cartPageUrl` and `postFlowUrl` callback URLs for the Wix flow to return to. |
| Cart cookie / session persistence | Visitor cookie set by `getVisitorCartClient` (write path) and `getExistingVisitorCartClient` (read path). cf-p7la fix prevents Set-Cookie races between concurrent hydrate + add. | Wix manages session natively | ✅ parity. The cf-p7la fix is a notable cfw-side win — pure Wix Studio doesn't have this class of bug because there's only one server. |
| Optimistic UI for add-to-cart | `CartProvider` reducer applies the line client-side immediately; server reconciles via `hydrateCartAction`. Rollback on server failure (`cf-3qt.2.3` cart-state contract). | Wix Studio re-renders cart page after server round-trip; no client optimism | ✅ parity (cfw better) — cfw add-to-cart feels faster because it doesn't await the server. |
| Cart abandonment tracking | `CartAbandonmentTracker` component fires telemetry on add then no-checkout. Drives the Velo cart-recovery email flow (cf-ox0h.1 P1 gate already closed). | Wix Studio has built-in abandoned-cart recovery | ✅ parity — different mechanism but same outcome. |

## Findings

### F1 (P3) — pre-checkout totals: cfw shows subtotal only

**Symptom:** cfw cart drawer shows `Subtotal: $X` and links to `/checkout`. Wix Studio shows subtotal + estimated shipping + estimated tax with a ZIP-driven probe.

**Cause:** `estimateCurrentCartTotals` is wired (`src/lib/wix/cart.ts:102`) but the CartDrawer only reads subtotal from it. Shipping + tax breakdown is available on the same response object — needs UI surfacing.

**Impact:** the user's ~total at checkout entry is higher than the cart-drawer subtotal led them to expect. Sticker-shock on the Wix-hosted payment page. For furniture pricing where shipping is non-trivial ($50-$300 white-glove), this materially affects perceived honesty of the cart.

**Fix scope:** UI-only. Render shipping + tax lines below subtotal in CartDrawer when `estimateCurrentCartTotals` returns them. The cf-mr3.0 ZIP-aware widget already runs on PDP; cart drawer could re-use the same store value.

**Recommendation:** P3 unless cutover surveys flag confusion. The Wix-hosted checkout page is one click away and breaks down the totals; users get the full picture before they enter payment.

### F2 (P1 — pre-cutover) — coupon entry missing from cfw cart

**Symptom:** the cfw cart drawer + `/cart` page have no "Apply promo code" input. Users with a discount code from an email campaign / sale URL / referral can only enter it on the Wix-hosted checkout page after clicking "Checkout."

**Cause:** intentional cfw v1 scope — no `applyCoupon` UI shipped. The Wix `currentCart.updateCurrentCart()` SDK call supports `appliedDiscounts[].coupon.code` (verified in `node_modules/@wix/auto_sdk_ecom_current-cart/build/internal/cjs/index.d.ts`), so the backend hook exists.

**Impact:** users running a 15%-off email campaign click through, fill cart, see no coupon field → assume the code doesn't work → bounce. Higher cart-abandonment on every email-driven sale. Conservative estimate: 5-15% of coupon-campaign cart traffic affected on the first sale post-cutover.

**Fix scope:** UI + thin server-action wrapper. Estimated ~2 days for cfw frontend (drawer input + server action + estimateTotals refresh) + ~1 day test coverage.

**Recommendation:** **P1 pre-cutover** if any coupon-driven email campaign launches within the 2 weeks post-cutover. If the next campaign is 30+ days out, P2 and ship the cart-coupon feature in a Phase 2 polish wave.

This is the single most-impactful parity gap in cf-wsrr's audit scope.

### F3 (P3) — gift card balance application

Wix Studio cart accepts gift-card redemption. cfw cart doesn't. The carolinafutons gift-card product is sold on cfw (`/gift-cards` page), but redemption today goes through the Wix-hosted checkout. Like F2, the SDK has the hook (`updateCurrentCart` supports gift-card balance fields), and same fix shape applies.

Lower priority than F2 because gift-card holders are a narrower cohort and the redemption-on-checkout flow is more forgivable UX than coupon-on-checkout. **P3 polish.**

### F4 (P3) — order notes / "add a note to your order"

Most carolinafutons custom-order conversations happen via `/contact` form or phone today. Cart-side notes are a nice-to-have, not a parity blocker.

## Findings NOT shipped as gaps

- **Optimistic cart UI** — cfw better than Wix Studio (no parity gap to close).
- **Cart-recovery email flow** — different mechanism (Velo + cf-ox0h.1 P1 gate already closed), same outcome.
- **Cookie / session persistence** — cfw on par + the cf-p7la fix prevents a class of race condition that pure-Wix doesn't have.

## What this DOESN'T cover

- **Real-world coupon-redemption test** — the audit reads from code + SDK. A live test (apply known-good Wix coupon code → verify discount applies at checkout) is gated on staging access (same blocker as cf-w1u1 email triggers). Recommend running this after F2 ships.
- **A/B comparison of conversion rates** — out of scope for a code audit. Recommend Stilgar pull Wix Analytics for coupon-campaign conversion before vs after cutover once F2 lands.
- **Mobile cart UX** — the cf-pjdb mobile smoke covers cart-drawer accessibility on mobile viewport; the cart-coupon UX would need to work on iOS Safari + Chrome Android first-class. Out of this audit's scope; would be its own beadlet during F2 implementation.
- **Estimated tax accuracy** — out of scope, this is a Wix tax-engine integration question.

## Acceptance

- [x] All Wix `currentCart.*` SDK calls cfw uses are catalogued
- [x] Coupon / discount surface gap identified, severity-rated, and scoped
- [x] Checkout-entry handoff path documented
- [x] Per-op parity verdict against Wix Studio reference behavior
- [x] No cfw code change required for this bead (audit deliverable). F2 fix is the next bead.

## Refs

- Bead: cf-wsrr
- Parent: cf-3qt.6
- Convoy: hq-cv-n3abi
- Sibling: cf-4i44 (policy parity) — closed
- Related code:
  - `src/lib/wix/cart.ts` — cart ops wrapper
  - `src/lib/wix/checkout.ts` — checkout init
  - `src/components/cart/CartDrawer.tsx` — drawer UI
  - `src/components/cart/CartProvider.tsx` — client-side state + optimistic UI
  - `src/lib/cart/cart-state.ts` — pure reducer
  - `src/app/checkout/route.ts` — redirect handler
  - `src/app/cart/page.tsx` — standalone cart page
- Cart-recovery: cf-ox0h.1 (closed)
- Cart cookie race: cf-p7la (closed)
- Standing order: cf-ukc6 — doc-only deliverable, credit-freeze respected
