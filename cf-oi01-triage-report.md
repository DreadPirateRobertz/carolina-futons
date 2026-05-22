# cf-oi01 Triage Report — 2026-05-22

**Author:** miquella
**Status:** BLOCKED on Wix-side configuration (NOT a cfw code issue)

## TL;DR

The Path A premise ("pull UPS creds into Vercel → Wix-hosted checkout calls UPS internally → drive E2E") is **broken at the Wix side**, not the cfw side. The cfw `/checkout` route correctly creates a Wix checkout and redirects to the Wix-hosted page. But the **Wix-hosted checkout page is unusable**:

- **"We can't accept online payments"** banner displayed (no payment provider connected on Wix headless site)
- **Delivery: Free** — UPS shipping integration is NOT wired on the Wix side

UPS creds in Vercel env are not yet consumed by anything in the live request path. Stripe/PayPal creds are irrelevant until Wix can accept payments.

## What I ran

```
CF_E2E_REAL_SHIPPING=1 \
BASE_URL=https://carolina-futons-l3lga935d-dreadpiraterobertzs-projects.vercel.app \
npx playwright test e2e/checkout-real-shipping-payments.spec.ts --project=chromium
```

Result: **3 passed, 6 failed, 11 skipped** (20 tests total)

## What worked

- **All 3 UPS env vars + WWEX freight creds** are already in Vercel for Production, Preview, Development (18 days old; bead stage 1 effectively complete)
- **Vercel deployment** `l3lga935d-...` is the live Production target (verified via `vercel inspect`)
- **PDP loads + add-to-cart** for LTL / freight-whiteglove / freight-far bands (all 3 stage-1 tests passed — cart screenshots in `e2e-screenshots/cf-oi01/`)
- **cfw `/checkout` route** correctly issues 307 redirect to Wix-hosted checkout host `chrisdealglass.wixstudio.com/my-site/__ecom/checkout?checkoutId=...` (verified via manual Playwright MCP browse)

## What broke

### Issue 1: Wix-hosted checkout shows "We can't accept online payments"

Screenshot: `cf-oi01-working-checkout.png` (in miquella worktree)

The Wix headless site (`chrisdealglass.wixstudio.com`, `metaSiteId=3af610bf-06fb-410d-a406-c1258fa84372`, `headlessClientId=6b4d4894-c6be-4ecc-bf59-9eb4d10b9210`) renders the checkout page UI but no payment form. Banner reads:

> "We can't accept online payments. Contact us for help with your order."

Payment provider needs to be connected on the Wix dashboard for the headless site. This is a **Wix admin task**, not code.

### Issue 2: Delivery shows "Free" — no UPS rate

Order Summary on Wix-hosted checkout shows `Delivery: Free` regardless of cart contents (tested with a $2,978 Ranchero Murphy Cabinet Bed — should trigger LTL/freight rate, not free). UPS shipping connector is **not wired on the Wix headless site**.

The spec docblock (`checkout-real-shipping-payments.spec.ts:18`) assumes:

> "UPS rates fire on the wix.com domain post-redirect, NOT on cfw `/api/...shipping`"

This is no longer accurate (or never was). UPS rates are not rendering on the Wix-hosted page. The UPS env vars in Vercel are not yet consumed by any cfw code path I could find (`grep "process.env.UPS\|env.UPS" src/**/*.ts` returns nothing in non-test files).

### Issue 3: Test race condition (separate, minor)

The 6 stage-2/3 test failures are `page.waitForURL(WIX_CHECKOUT_HOST_RE)` timeouts. Root cause: the test calls `page.goto("/checkout")` immediately after seeing `cart-line-price` (optimistic UI), before the server-side Wix cart write has committed. When `/checkout` hits, `createCheckoutFromCurrentCart` returns no checkoutId → bounces to `/cart?checkout_error=1`.

Reproduced manually: with ~10s wait between add-to-cart and `/checkout`, the redirect succeeds.

**Fix (for when Wix-side is configured):** wait for the addToCart server-action response or for the header cart counter to update via a Wix-side hydration signal rather than the optimistic line price.

### Issue 4: Parcel band slug not in catalog

`PARCEL.slug = "trundle-pad-cover"` is not in `/sitemap.xml`. All 5 parcel-band tests skipped via the G6 pre-flight. Pick a real parcel slug from the catalog (e.g. `leg-length-options-charleston` or one of the swatch products) when the suite is re-run.

## Recommended next steps

In order:

1. **Wix admin (Stilgar/Melania)**: Connect a payment provider (Stripe/PayPal) on the Wix headless site's dashboard. Without this, **no payment can be tested at all** regardless of what creds we put in Vercel.
2. **Wix admin**: Configure UPS shipping connector on the Wix headless site so rate rows actually populate. The Vercel-side UPS env vars are not load-bearing for the current Path A flow.
3. **Re-confirm Path A premise**: Per the new evidence, the cfw `/checkout` → Wix-hosted page handoff works, but the Wix page itself is not configured for either shipping or payments. Either (a) configure Wix to handle both, or (b) switch to Path B — wire UPS + Stripe directly in cfw and skip the Wix redirect.
4. **After Wix is configured**: fix the test race condition (Issue 3) and override the parcel slug (Issue 4), then re-run the suite.

## Bead stage status

- [x] Stage 1: Pull secrets from Wix staging → Vercel env (UPS done 18d ago, WWEX too)
- [x] Stage 2: Trigger redeploy (l3lga935d-... is live)
- [ ] Stage 3: Drive cart → checkout — **BLOCKED**: cart+checkout-redirect works, but Wix-hosted checkout page lacks payment + shipping config
- [ ] Stage 4: Verify Stripe webhook — N/A until Stage 3
- [ ] Stage 5: Screenshots + network logs — partial (cart screenshots captured for 3 bands; checkout screenshot shows Wix-side block)

## Files

- `cf-oi01-working-checkout.png` — Wix-hosted checkout screenshot showing the "can't accept online payments" banner + Free delivery
- `carolina-futons-web/e2e-screenshots/cf-oi01/*.png` — cart screenshots for LTL / freight-whiteglove / freight-far stage 1
- `carolina-futons-web/test-results/checkout-real-shipping-pay-*/error-context.md` — failure traces for stage 2/3 timeouts
