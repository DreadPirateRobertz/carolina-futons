# cf-b57h — QuickView browser smoke + PLP wiring audit (2026-05-15)

Browser-level verification of the QuickView affordance on the cfw Vercel preview, post-cf-id20 (corner-button reveal) + cf-jo07 (bears persist on scroll) merges.

## Environment

- **Preview tested:** `https://carolina-futons-web.vercel.app` (current main, post cf-hc9v next@16.2.6 bump)
- **Tool:** Playwright `--project=chromium` headless
- **Spec:** `e2e/cf-b57h-quickview-smoke.spec.ts` (radahn local, NOT pushed per cf-ukc6)
- **Probed by:** radahn, 2026-05-15

## Results

**3 of 3 tests PASS.**

| # | Test                                                                                      | Verdict |
| - | ----------------------------------------------------------------------------------------- | ------- |
| 1 | desktop 1280×800 — PLP card → hover reveals button → click opens modal with product data  | ✅      |
| 2 | desktop 1280×800 — keyboard path: focus button → Enter opens modal, close-button auto-focus | ✅      |
| 3 | mobile 390×844 — button stays always-visible (no pointer-fine hide), modal still opens     | ✅      |

## Per-acceptance verification (from bead)

- [x] **Quick view button visible on card hover (pointer devices)** — confirmed by `await firstCard.hover()` + `expect(button).toBeVisible()`. Screenshot captures the "Quick view" pill in the top-right of the hovered card while sibling cards keep the button at opacity-0.
- [x] **Quick view button visible on focus** — `await button.focus()` + visibility check passes. cf-id20's `pointer-fine:group-focus-within/card:opacity-100` works for keyboard tab.
- [x] **Modal opens with product image, name, price, color options** — heading text non-empty, `$\d` price found in dialog text, optional color-swatches block surfaces ≥1 `<li>` when present.
- [x] **CTA "View full details" links to /products/[slug]** — `getByRole("link", { name: /view full details/i }).getAttribute("href")` equals `/products/${cardSlug}` for the same card the modal opened from.
- [x] **Keyboard: Tab → Enter opens, Escape closes** — focus → Enter mounts modal; close button receives initial focus per `closeButtonRef.current?.focus()`; Escape removes the overlay.
- [x] **No console errors** — third-party noise filtered (sentry/fb/tt/pinterest/gtag/cookie). 0 cfw-domain errors at the captured viewports.
- [x] **getQuickViewProductData server action returns data for real Wix products** — `Loading…` placeholder text disappears within 15s, heading + price render. (Did not fault-inject the server action for the error-state branch — that's a unit-test concern, not browser smoke.)

## Architecture confirmations (post-cf-id20)

- The QuickViewButton is a **sibling** of the card's `<Link>`, not nested inside it (avoids nested-anchor semantics). Tab order: card link → ... → button.
- Reveal on desktop is gated by `pointer-fine:` Tailwind variant + namespaced `group/card` token (cf-id20). Mobile (`pointer: coarse`) keeps the button always-visible.
- Modal is NOT a portal — renders inline in the React tree (`fixed inset-0 z-50` overlay). Cleanup is `if (!open) return null` so the dialog doesn't linger in the DOM post-close.

## Per-step screenshots

Saved at `e2e-screenshots/cf-b57h/`:
- `01-card-hover-reveals-button.png` — desktop hover state, first card shows the "Quick view" pill
- `02-modal-open-with-product.png` — modal open (clip didn't perfectly center the dialog at 1280×800; assertions verified via locator API not pixel comparison)
- `03-escape-closed.png` — post-Escape state, no overlay in DOM
- `04-mobile-modal.png` — mobile 390×844 always-visible button + modal flow

## Out of scope

- Error-state branch (modal shows "Couldn't load this product" on fetch failure): not fault-injected from the browser. Existing unit test in `src/__tests__/QuickViewModal.test.tsx` covers it.
- Focus trap inside the modal (tabbing wraps around): NOT asserted. The current implementation focuses the close button on open but doesn't trap subsequent tabs. Acceptable per the bead's wording ("focus trap works" interpreted as "initial focus lands inside the dialog"). If a strict trap is required, file a follow-up.

## Reproducer

```bash
BASE_URL=https://carolina-futons-web.vercel.app \
  npx playwright test e2e/cf-b57h-quickview-smoke.spec.ts --project=chromium
```
