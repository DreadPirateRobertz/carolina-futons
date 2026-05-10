# Discovery Brief — WWEX freight booking automation feasibility

> **Bead:** cf-38bi (cf-ph3g.p3b) · **Audience:** Stilgar / ops / mayor (decision) · **Author:** miquella · **Date:** 2026-05-10
>
> Ask: do we automate any part of the WWEX freight booking handoff, or stay manual? Discovery doc — no implementation.

---

## What's true today

The WWEX integration is **rate-quote-only**. Booking a freight shipment after an order lands is a manual ops step:

1. Customer checks out → sees an LTL rate from `wwex-freight.web::getLTLRates` via the checkout SPI.
2. Order is placed with that rate; payment captured.
3. **Manual:** ops staff log into the WWEX SpeedFreight dashboard, book the shipment by hand, paste the returned PRO number into the Wix order's Fulfillment record.
4. Wix's standard fulfillment events fire from there — *once* the partial-fulfillment handler from cf-ph3g §(c) lands.

There is no inbound webhook from WWEX → Wix to confirm booking, and no outbound call from Wix → WWEX to create the shipment. Both directions are open.

## The decision

**Should any part of this round-trip be automated?**

Three options:

### Option A — Outbound automation (Wix → WWEX): auto-book on order approve
- New Velo handler on `wixEcom_onOrderApproved` (or a new `onLtlOrderApproved` filter) that calls WWEX's "create shipment" SOAP endpoint with shipping address + line items + chosen rate.
- WWEX returns a PRO number → write it into Fulfillment.trackingInfo programmatically → Wix shipped-email + cfw tracking link surface automatically.
- **Effort:** ~1.5–2 days (SOAP wrapper, error/retry, Fulfillment writer, audit log entry, tests).

### Option B — Inbound webhook (WWEX → Wix): keep manual booking, automate the writeback
- WWEX SpeedFreight pushes a status webhook → `/_functions/wwexFreightWebhook` Velo HTTP endpoint → upsert PRO + tracking onto the matching Wix Fulfillment.
- Ops still books in the WWEX dashboard, but skips the "paste the PRO into Wix" step.
- Requires WWEX-side webhook setup (Stilgar/ops to configure with WWEX support) + URL allowlist + signature verification.
- **Effort:** ~1 day Velo + ~half-day WWEX-portal setup.

### Option C — Status quo: keep both directions manual
- No automation. Continue current flow.
- **Effort:** zero. Cost is the recurring ops minutes per order.

## Tradeoffs

| Concern | Option A (outbound) | Option B (inbound webhook) | Option C (manual) |
|---|---|---|---|
| **Ops time saved** | ~5 min/order: full elimination of the WWEX-dashboard step | ~1 min/order: only the PRO paste step | None |
| **Customer-visible fix** | Faster shipped-notification (no ops latency) | Same as today; PRO appears in Wix faster but customer flow unchanged | Same as today |
| **Failure mode** | Auto-book on a wrong/edge-case order (custom freight class, hold-for-pickup, returns) — needs explicit "do not auto-book" flags + ops escape hatch | Webhook missed → ops still has the dashboard fallback; degrades gracefully to today's flow | n/a |
| **Bidirectional confidence** | High — Wix is the source of truth for the booking attempt | Medium — ops still drives, Wix just listens | High — ops drives both |
| **Implementation risk** | Higher — SOAP create-shipment surface is broader + has irreversible side effects on a third-party (booked freight, billable to CF) | Lower — receive-only, idempotent upsert | Zero |
| **WWEX setup burden** | Modest — credential scope check; same SOAP we already call read-side | Higher — WWEX support ticket to register webhook URL + signature secret | None |
| **Audit / reconcile** | Need a "did Wix book this?" reconcile cron in case the SOAP call goes through but Wix-side write fails | Low — webhook either arrives or doesn't, no torn state | Low — single source of truth (ops + their notebook) |

## Volume reality check (must answer before deciding)

**~5 freight orders/week** is the volume melania cited in the cf-ph3g audit. At that rate:

| Option | Yearly ops minutes saved | Implementation cost (one-time) | Payback (assuming $50/hr ops time) |
|---|---:|---:|---:|
| A | ~22 hr/yr | ~16 hr | <1 yr if WWEX SOAP is well-behaved |
| B | ~4 hr/yr | ~12 hr | ~3 yr |
| C | 0 | 0 | n/a |

**A pays back fast; B doesn't.** Volume would have to >2x for B to be a clear win on its own.

## Open questions

1. **Is 5/week steady, or growing?** If freight is forecast to scale (more LTL-tier products, more far-zip customers), A's payback shortens further.
2. **What does WWEX charge per booking attempt that fails?** SOAP-create can incur fees on retry; A needs careful idempotency. Stilgar/ops to confirm with WWEX rep.
3. **Hold-for-pickup, special handling, and returns** — what fraction of freight orders need ops eyeballs anyway? If >30%, A's value drops because ops is already in the dashboard for those.
4. **Webhook signature scheme** — does WWEX SpeedFreight support HMAC-signed callbacks? If yes, B is straightforward. If no, B needs IP-allowlist or IP-block protection.
5. **Wix Fulfillment writeback API surface** — confirmed available via `wixEcom.fulfillments.update` (used elsewhere in cfutons), so neither A nor B needs new Wix integration plumbing.

## Recommendation

**Defer A; defer B; revisit at 10+ freight orders/week.**

At today's volume the implementation cost (especially A's third-party SOAP risk) outweighs the ops savings. The cf-ph3g audit's P1 (`events.js: wire onFulfillmentCreated + onFulfillmentUpdated`) is the higher-value freight-area unlock — it fixes the partial-shipment notification gap that affects every multi-line-item freight order today. Land that first.

If freight volume crosses ~10/week (or if Stilgar wants the customer-visible "shipped within minutes of payment" UX win), revisit with **Option A**. Option B alone is rarely worth shipping — the partial-shipment work + manual paste is already the bottleneck, and B doesn't address the partial-shipment gap.

## What this brief unblocks

Stilgar / ops can either:
- Close cf-38bi as "defer until volume justifies" (recommended)
- Sling Option A as a polecat task (~2 dev-days) if customer-shipped-notification latency is hurting NPS
- Sling Option B alone (less compelling — see math above)

## Refs
- Audit: [`docs/cf-ph3g-velo-shipping-api-audit-2026-05-10.md`](./cf-ph3g-velo-shipping-api-audit-2026-05-10.md) §(d)
- Sibling brief (LTL pre-checkout rates): [`docs/cf-uxcq-product-brief.md`](./cf-uxcq-product-brief.md)
- Internal API used today: `src/backend/wwex-freight.web.js::getLTLRates`
- Parent bead: cf-ph3g (Velo shipping APIs audit)
- The high-value sibling: cf-ph3g.p2 (`onFulfillmentCreated/Updated` wiring) — recommended to land before any of A/B/C
