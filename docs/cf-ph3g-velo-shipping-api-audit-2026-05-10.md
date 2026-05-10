# cf-ph3g — Velo APIs audit: Freight / LTL / partial-fulfillment readiness

**Bead:** cf-ph3g · P2
**Author:** godfrey · 2026-05-10
**Stilgar's question:** "Are the APIs ready for Freight/LTL/partial-fulfillment triggers?"
**Method:** static grep + read of every Velo backend module that touches WWEX, LTL, or fulfillment events.

## TL;DR

| Surface | Ready? | Notes |
|---|---|---|
| (a) **WWEX SpeedFreight rate-quote integration** | ✅ Ready | `wwex-freight.web.js` implements live SOAP-API rate quotes with NMFC class mapping, liftgate detection, and fallback rates. Wired into checkout via `shipping-rates-plugin.js`. Credentials in Wix Secrets Manager. |
| (b) **LTL rate quote endpoints** | ⚠️ Partial | Internal API (`getLTLRates`) works during Wix-driven checkout. **No HTTP `/_functions/ltlRate` exposed** — cfw can't get a quote pre-checkout (e.g., on a PDP "shipping estimate" widget). Build a wrapper if cfw needs this. |
| (c) **Partial-fulfillment events** | ❌ **GAP** | `events.js` exports `wixEcom_onOrderFulfilled` (full ship — all line items shipped). **No** `wixEcom_onFulfillmentCreated` / `wixEcom_onFulfillmentUpdated` handler. Multi-shipment orders silently miss intermediate "your first item shipped" notifications. |
| (d) Freight booking webhooks (status push from WWEX → Wix) | ❌ Not implemented | WWEX integration is rate-quote-only. There is no booked-shipment status callback path. |

**Recommended next:** file gap beads for (c) + (d), file enhancement bead for (b) if cfw needs a quote endpoint.

## (a) WWEX SpeedFreight integration — READY

**File:** `src/backend/wwex-freight.web.js` (260 lines)

**What it does:**
- Live LTL rate quotes against `https://api.wwex.com/SpeedFreight/RateQuote` (SOAP).
- Credentials read from Wix Secrets Manager (`WWEX_USERNAME`, `WWEX_PASSWORD`, `WWEX_ACCOUNT_NUMBER`).
- NMFC class mapping per CF product category (`murphy-bed=150`, `platform-bed=100`, `futon-frame=150`, `futon-mattress=200`, `accessory=250`, `casegoods=85`, `default=100`).
- Liftgate detection: required when total weight > 300 lbs OR any single package > 100 lbs.
- LTL eligibility: items > 150 lbs single weight OR > 108" longest dim, OR shipment > 100 lbs total.
- Fallback rates (`getLTLFallbackRates`) when WWEX API is unreachable — keeps checkout from breaking on a transient API outage.

**Wired to checkout:** `shipping-rates-plugin.js` (the Wix Shipping Rates SPI) imports `shouldUseLTL`, `getLTLRates`, `getLTLFallbackRates`, `requiresLiftgate` and uses them when `shouldUseLTL(packages)` returns true.

**Verdict:** Production-ready for the rate-quote use case. No gaps.

## (b) LTL rate quote endpoints — PARTIAL

**Internal API:** `getLTLRates(originZip, destZip, packages)` from `wwex-freight.web.js`. Used by:
- `shipping-rates-plugin.js` (Wix-driven checkout — works)
- `shippingIntelligence.web.js` (PDP shipping estimates — works inside Velo runtime)

**HTTP/cfw surface:** `grep -nE 'freight|wwex|LTL' src/backend/http-functions.js` → **zero matches**. No `/_functions/ltlRate` or `/_functions/freight*` endpoint exists.

**Implication for cfw:**
- Wix checkout SPI rates work (cfw uses Wix's own `getShippingRates` indirectly via the Headless API).
- A pre-checkout cfw widget that wants to display "estimated freight to your zip" without engaging the full checkout flow has **no Velo endpoint to call**. Today PDPs would need to engage Wix's Headless `cart/lineItems` + `getShippingRates` SPI dance.

**Recommended:** **file P3 enhancement bead** (`cf-* — POST /_functions/ltlRate wrapper for cfw pre-checkout estimates`). Single dispatcher entry calling `getLTLRates`. Permissions.Anyone with rate-limit (zip-pair key, e.g. 30/hour). Defer until product asks for it.

## (c) Partial-fulfillment events — REAL GAP

### Wix Velo event surface

Wix's eCommerce backend dispatches:
- `wixEcom_onOrderCreated` — order placed
- `wixEcom_onOrderApproved` — payment captured
- `wixEcom_onFulfillmentCreated` — **a fulfillment record is added** (one shipment of one OR multiple line items). Fires per-fulfillment.
- `wixEcom_onFulfillmentUpdated` — tracking number / status updated on an existing fulfillment.
- `wixEcom_onOrderFulfilled` — order's `fulfillmentStatus` flips to `FULFILLED` (ALL line items have been fulfilled). Fires once per order.
- `wixEcom_onOrderDelivered` / `wixEcom_onOrderCanceled`

### Current cfutons handlers (`src/backend/events.js`)

```js
export async function wixEcom_onOrderCreated(event)       // ✅ wired
export async function wixEcom_onOrderApproved(event)      // ✅ wired
export async function wixEcom_onOrderFulfilled(event)     // ✅ wired (full ship only)
export async function wixEcom_onOrderDelivered(event)     // ✅ wired
export async function wixEcom_onOrderCanceled(event)      // ✅ wired
// MISSING:
//   wixEcom_onFulfillmentCreated  ← partial-ship notifications
//   wixEcom_onFulfillmentUpdated  ← tracking update notifications
```

### What's broken in production today

Customer orders 3 items (e.g. murphy bed + 2 nightstands). Vendor dropships them separately:

1. Nightstand 1 ships → vendor creates `Fulfillment` record on the Wix order.
2. **Wix fires `wixEcom_onFulfillmentCreated`** → cfutons has no handler → notification silently dropped. Customer sees nothing.
3. Same for nightstand 2 a few days later.
4. Murphy bed ships (last item) → order's `fulfillmentStatus` → `FULFILLED` → `wixEcom_onOrderFulfilled` fires → customer gets ONE "your order has shipped" email referring to the LAST shipment's tracking number.

The UX is bad: customer waits weeks hearing nothing, then gets a single email about one tracking link when in reality 3 packages were already on their way.

### What should happen

`wixEcom_onFulfillmentCreated` handler in `events.js` that:
1. Reads `event.entity` (the new Fulfillment row): `fulfillmentId`, `lineItems` (subset of order), `trackingInfo`, `status`.
2. Loads the parent order to enrich: `orderNumber`, `buyerInfo.email`, `memberId`.
3. Dispatches a **per-fulfillment** notification via `notificationOrchestrator.handleOrderFulfilled` (already exists) with the fulfillment's tracking number — passing a `partial: true` flag so the email template can say "your first/next package has shipped" instead of "your order is on the way".
4. Idempotency guard: dedup by `fulfillmentId` so a re-fired event doesn't double-email.

`wixEcom_onFulfillmentUpdated` handler:
- Detect tracking-number change (added or updated) → re-send tracking-update email.
- Detect status change to DELIVERED → trigger per-package delivery confirmation (separate from the order-level delivery event which fires once).

### Recommended bead

**P1** (not P2 — every multi-shipment order today loses intermediate updates, which is the median freight order). Title: `events.js: wire wixEcom_onFulfillmentCreated + onFulfillmentUpdated for partial-shipment notifications`.

Acceptance:
- [ ] Handler files multi-line `Fulfillments` event tests (mock event with subset of line items)
- [ ] `partial: true` flag plumbed through `notificationOrchestrator.handleOrderFulfilled`
- [ ] Idempotency on `fulfillmentId`
- [ ] Email templates: `partial_shipment` triggered email registered (separate from `order_shipped`)
- [ ] Mobile push: same path — partial flag flows to `orderStatusWebhook.handleOrderStatusChange`

## (d) Freight booking status webhooks — NOT IMPLEMENTED

WWEX integration is rate-quote-only — there is no path for a *booked* freight shipment to push status/tracking back to Wix. The current flow is:

1. Customer checks out, sees an LTL rate from `shipping-rates-plugin`.
2. Order is placed with the chosen rate.
3. **Manual:** ops staff log into WWEX dashboard, book the shipment, paste the PRO number into the Wix order's Fulfillment record by hand.
4. From there, fulfillment events (a) fire normally — **once** the partial-fulfillment handler from (c) lands.

**Two possible automations** (both out of scope for this audit):
- **WWEX → Wix push:** WWEX SpeedFreight webhook → `/_functions/wwexFreightWebhook` Velo HTTP endpoint → updates Fulfillment.trackingInfo. Requires WWEX webhook setup on their side + URL allowlisting.
- **Wix → WWEX push:** when an order with LTL line items is approved, auto-call WWEX's "create shipment" SOAP endpoint with the address + product details. Returns PRO number and writes it into Fulfillment automatically.

Stilgar/ops decision needed before either is built. If the manual flow is ~5 freight orders/week, the automation cost-benefit is borderline. Document and defer.

## Recommended follow-up beads

| Bead | Priority | Scope |
|---|---|---|
| `events.js: wire onFulfillmentCreated + onFulfillmentUpdated` | **P1** | (c) above — fix partial-shipment notification gap. ~1 day work + tests. |
| `POST /_functions/ltlRate wrapper for cfw pre-checkout estimates` | P3 | (b) above — only if product asks for it. ~2 hours + dispatcher entry. |
| `Audit: WWEX → Wix freight booking automation feasibility` | P3 | (d) above — discovery doc, not impl. |
| `Audit: Wix → WWEX outbound freight booking feasibility` | P3 | (d) above — discovery doc, not impl. |

**File the P1 with melania immediately.** The other three can wait for product input.

## Linked beads

- cf-ph3g (this audit)
- cf-rtd7 (godfrey's prior shipping bead — same area)
- cf-66ne (morgott's dead-code audit — pruning related modules)
- cf-jmmk (email orchestration — partner for the partial-shipment handler)
