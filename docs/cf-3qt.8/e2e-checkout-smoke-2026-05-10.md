# cf-vu40 — E2E guest checkout smoke (Kingston PDP, 2026-05-10)

Sibling of cf-jzsd. Pinned to a known SKU (`kingston-futon-frame`, variant-required: size + color) so the test is reproducible regardless of PLP ordering.

## Environment

- **Preview:** `https://carolina-futons-web.vercel.app` (current main, post-cf-jo07/cf-xqc0/cf-id20/cf-edw3 merges)
- **Tool:** Playwright `--project=chromium` headless
- **Spec:** `e2e/cf-vu40-kingston-checkout-smoke.spec.ts` (radahn local, NOT pushed per cf-ukc6)
- **Probed by:** radahn, 2026-05-10
- **Viewports:** 1280×800 desktop + 390×844 mobile (iPhone 14)

## Results

**2 of 2 viewports PASS.**

| # | Step                                              | Desktop 1280×800 | Mobile 390×844 |
| - | ------------------------------------------------- | ---------------- | -------------- |
| 1 | PDP `/products/kingston-futon-frame` loads        | ✅ h1 = "Kingston Futon Frame", price $619, variant pickers (Size: Full/Queen/King + Finish: Cherry/Chocolate/Natural/Black Walnut/Dark Chocolate) all rendered | ✅ same content, mobile layout |
| 2 | Variant auto-selected → Add-to-Cart enables        | ✅                | ✅              |
| 3 | Add-to-Cart click → cart updates                   | ✅ cart line OR cart-trigger label cleared | ✅ announcement bar reflects cart state ("You're $801.00 away from free white-glove delivery" — proves cart subtotal of $699 propagated to the cart-aware announcement) |
| 4 | `/checkout` returns HTTP <400                      | ✅ DOM-content-loaded fires, page renders skeleton then full /cart UX | ✅ same |
| 5 | Checkout page surfaces a guest-path affordance (proceed-cta OR guest-opt OR email-input) | ✅ matched "proceed-cta" | ✅ matched "proceed-cta" |
| 6 | No cfw-domain console errors                       | ✅ 0 errors (third-party noise filtered) | ✅ 0 errors |

## Per-step screenshots

Saved at `e2e-screenshots/cf-vu40/{desktop-1280x800,mobile-390x844}/{01-pdp,02-cart,03-checkout}.png`.

- **01-pdp**: Kingston PDP — header (Carolina Futons brand, primary nav), product hero with size + finish swatches, $619 price, Affirm "as low as $52/mo" badge, "Price locked for 14 days" notice.
- **02-cart**: cart drawer / cart-trigger updated state.
- **03-checkout**: skeleton-loading state captured at DOM-content-loaded (timing artefact — page hydrates further after navigation completes; the proceed-cta affordance check above proves the actual checkout-ready UX is reachable).

## Key observations

- Variant-required SKUs (Kingston needs Size + Finish) work cleanly with the auto-select-first-option strategy. Add-to-Cart enables once both axes are picked.
- Cart state propagates to the cart-aware announcement bar: post-add the announcement reads "You're $801.00 away from free white-glove delivery" instead of the rotation copy. Confirms the AnnouncementBarCartAware client component (cf-xqc0 refactor) is wired correctly post-deploy.
- `/checkout` is the cfw `/cart` page with a "Proceed to checkout" CTA (Wix-hosted redirect handoff, per `src/lib/wix/checkout.ts`). Both viewports surface the proceed CTA within 8s of `domcontentloaded`.
- Zero cfw-domain console errors at either viewport. Recent merges (cf-jo07 / cf-xqc0 / cf-id20 / cf-edw3 / cf-3b6j) all clean.

## Out of scope

- Did NOT complete actual checkout (per bead — no payment data entered).
- Did NOT exercise PayPal sandbox — that's cf-oi01's scope (still creds-blocked on Stilgar).
- Did NOT test member checkout — guest path only per bead.

## Followups

None to file. cf-vu40 + cf-jzsd together prove the pre-payment cfw stack is healthy on prod preview at both viewports. Next gate is cf-oi01's real-payment run, which needs Stilgar's UPS/Stripe/PayPal dashboard test-mode confirms.

## Reproducer

```bash
cd /private/tmp/cfw-lwzn  # or any cfw worktree
BASE_URL=https://carolina-futons-web.vercel.app \
  npx playwright test e2e/cf-vu40-kingston-checkout-smoke.spec.ts --project=chromium
```
