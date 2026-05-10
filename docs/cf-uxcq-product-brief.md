# Product Brief — Expose `/_functions/ltlRate` for cfw pre-checkout rates?

> **Bead:** cf-uxcq (cf-ph3g.p3a) · **Audience:** Stilgar / mayor (decision) · **Author:** miquella · **Date:** 2026-05-10
>
> Ask: implement a Velo HTTP wrapper around `getLTLRates` so the cfw PDP can show real dollar amounts pre-checkout, or keep the current heuristic copy?

---

## What's true today

**On the cfw PDP** (`PdpShippingEstimate.tsx`): customer enters ZIP → cfw runs a client-side heuristic (`getShippingZone` + `getShippingTier`) → renders a tier label ("LTL freight delivery") and a business-day window ("3–5 business days"). **No dollar amount.** No network call. Heuristic only.

**Inside Wix checkout**: real LTL rates *do* compute via `wwex-freight.web.js::getLTLRates`, used by the checkout SPI. Customer sees the actual number once they're on the cart/checkout page.

**The gap**: `getLTLRates` has no `/_functions/<name>` HTTP wrapper. cfw cannot reach it from a PDP without engaging the Wix Headless cart-create + getShippingRates dance — too heavy for "show a number on PDP."

## The decision

**Should the PDP show a real LTL dollar amount before the customer adds to cart?**

Three options:

### Option A — ship `/_functions/ltlRate` and surface dollars on PDP
- Add a single dispatcher entry in `http-functions.js` calling `getLTLRates` with `(originZip, destZip, packages)`.
- `Permissions.Anyone` + zip-pair rate-limit (e.g. 30/hour, same shape as `post_sampleRequests`).
- cfw `PdpShippingEstimate` is wired to call it on ZIP submit; tier label gets a "$XX–XX" range appended.
- **Estimate:** ~4–6 hr Velo work + ~2–3 hr cfw integration + tests on both sides.

### Option B — keep heuristic copy as-is
- No dollar amount on PDP. Customer sees the real number once at checkout.
- **Effort:** zero.

### Option C — hybrid: ship the wrapper but gate by cart value / weight
- Real rates only above a threshold (e.g. weight > 70 lb where heuristic is least informative); otherwise keep the tier label.
- Cuts API call volume + sticker-shock surface area while answering the "is this a $50 rate or $300?" question for the heaviest items.
- **Effort:** same Velo work as A; gating logic on cfw side ~1 hr.

## Tradeoffs

| Concern | Option A | Option B | Option C |
|---|---|---|---|
| **Conversion lift** | Highest — kills "what'll shipping cost?" abandonment. Esp. for >$2k freight orders where customers want a number before committing. | None over baseline. | Captures the high-AOV win without the noise. |
| **Sticker shock risk** | Highest — a customer in CA seeing $480 freight on a $799 frame may bounce. | None — only sees rates after committing to checkout. | Limited — only seen on items where a real number actually matters. |
| **API cost / abuse surface** | New public endpoint. WWEX usage cost + a rate-limited public endpoint to defend. | None added. | Same endpoint as A; lower volume due to gate. |
| **Implementation complexity** | Single dispatcher + cfw wiring. Standard. | Zero. | A + a guard. |
| **Time-to-checkout truthfulness** | Pre-checkout number = checkout number. No reconcile drift. | Pre-checkout label vs checkout dollars — small WTF moment for some customers. | Selective truthfulness. |
| **Caching opportunity** | Edge-cache by zip-pair + weight bucket; rates change rarely. | n/a | Same. |
| **Long-term direction** | Aligns with the cf-3qt headless migration — cfw owns more of checkout copy. | Defers the migration. | Same direction as A, smaller blast. |

## Open questions worth answering before deciding

1. **Do we have abandonment data on PDP-with-LTL-tier?** If "shipping unknown" is a leading bounce reason for >70 lb items, A pays for itself. Stilgar — does the analytics store have this segment?
2. **What's the WWEX per-quote cost?** Sub-cent → A is free. Pennies → C. If it's >$0.05 per quote we're rate-limit-by-default before the conversion math even starts.
3. **Caching tier:** are LTL rates stable enough (same ZIP-pair, ~same weight) that 24-hour edge caching is acceptable, or do they shift intra-day? If stable: A's variable cost drops to near zero.
4. **WWEX API SLA:** if the upstream goes down, what's the customer experience? Today the heuristic doesn't care; a wired endpoint becomes a partial outage on PDPs. Worth a fallback-to-heuristic strategy in the cfw integration.

## Recommendation

**Option C — hybrid**, contingent on (2) and (3) coming back favorable.

The reason: the per-product reality at Carolina Futons is that **most products are parcel or white-glove** (free), where the heuristic copy is already accurate-enough. The LTL band is the small middle tier (mid-weight frames + mattresses to far-zip destinations) where customers have the most "is this $40 or $400?" anxiety. Wiring real rates *only there* gets us most of A's conversion benefit at a fraction of the call volume + sticker-shock surface.

If (2) shows WWEX cost is sub-cent and (3) shows rates are stable enough to cache: **escalate to A**. The marginal effort to drop the gate is one cfw config change.

If we can't get (2) data this week: ship B for now, file a follow-up bead to revisit once cf-3qt phase 8 is done and we have headless analytics on PDP bounce reasons.

## What this brief unblocks

Stilgar / mayor can now decide A / B / C and either:
- Sling implementation as a polecat task (Option A or C — ~1 dev-day total)
- Close cf-uxcq with verdict "Option B / defer" if conversion lift unjustified

## Refs
- Audit: [`docs/cf-ph3g-velo-shipping-api-audit-2026-05-10.md`](./cf-ph3g-velo-shipping-api-audit-2026-05-10.md) §(b) LTL
- Today's heuristic: `cfw/src/components/product/PdpShippingEstimate.tsx`
- Internal API: `cfutons/src/backend/wwex-freight.web.js::getLTLRates`
- Parent bead: cf-ph3g (Velo APIs audit)
