# Desktop viewport smoke — 2026-05-10

**Bead:** cf-ljsy (P2, companion to cf-pjdb mobile smoke)
**Target:** https://carolina-futons-web.vercel.app
**Viewport:** 1280 × 800 (desktop)
**Driver:** Playwright @ chromium, BASE_URL → carolina-futons-web.vercel.app
**Spec:** `e2e/desktop-smoke-cf-ljsy.spec.ts` (cfw repo, branch cf-01z3 — held local per cf-ukc6 until next merge window)
**Run time:** 2026-05-10 ~02:51 ET, 20.9s wall, 2 workers

## Result: 10 / 10 PASS

Full-page screenshot captured per page in cfw at `e2e-screenshots/desktop-smoke-2026-05-10/<slug>.png`.

| # | Path | Smoke assertion | Status |
|---|---|---|---|
| 01 | `/` | site-header visible + primary nav "Futons" link visible | ✅ |
| 02 | `/shop/futon-frames` | ≥ 1 `[data-slot="product-card"]` rendered | ✅ |
| 03 | `/products/kingston-futon-frame` | "Add to cart" button visible | ✅ |
| 04 | `/about` | h1 visible | ✅ |
| 05 | `/visit` | h1 + "Hendersonville" body copy visible | ✅ |
| 06 | `/contact` | visible `input[type="email"]` in a `<form>` | ✅ |
| 07 | `/gift-cards` | h1 visible | ✅ |
| 08 | `/guides` | h1 visible | ✅ |
| 09 | `/reviews` | h1 visible | ✅ |
| 10 | `/getting-it-home` | ZIP input visible (label match) | ✅ |

## Visual sanity (per-screenshot byte size)

| File | Bytes | Implication |
|---|---|---|
| `01-home.png` | 3.98 MB | full bears + 4-col category grid + hero copy + nav rendered |
| `02-shop-futon-frames.png` | 2.03 MB | PLP at 4-col grid w/ product imagery |
| `03-pdp-kingston.png` | 1.36 MB | gallery + buy-box + below-fold sections rendered |
| `04-about.png` | 1.62 MB | scroll-story content + scenes rendered |
| `05-visit.png` | 0.78 MB | content + map rendered |
| `06-contact.png` | 1.05 MB | both forms (newsletter + appointment) rendered |
| `07-gift-cards.png` | 0.39 MB | content rendered |
| `08-guides.png` | 1.02 MB | listing + reading scene rendered |
| `09-reviews.png` | 0.65 MB | reviews + filter rendered |
| `10-getting-it-home.png` | 0.47 MB | form + content rendered |

## Findings

**No blocker desktop layout regressions** at 1280 × 800 against the production deployment. Pairs cleanly with the mobile pass in `mobile-smoke-2026-05-10.md` — the cutover-gate visual baseline now covers both phone-first and desktop-first viewports.

## Differences from cf-pjdb (mobile spec)

- Home assertion: hamburger trigger (mobile) → primary nav "Futons" link (desktop). The hamburger has `md:hidden`, primary nav `md:flex`, so the test selector flips at the md breakpoint.
- All other assertions are viewport-agnostic and reuse the cf-pjdb shape verbatim.

## Re-run command

```bash
cd /Users/hal/gt/cf-01z3                  # or whichever cfw worktree has the spec
BASE_URL=https://carolina-futons-web.vercel.app \
  pnpm exec playwright test e2e/desktop-smoke-cf-ljsy.spec.ts --workers=2
```

---

## Refs

- Bead: cf-ljsy (companion to cf-pjdb)
- Sibling: `mobile-smoke-2026-05-10.md`, `lighthouse-baseline-2026-05-10.md`, `e2e-checkout-smoke-2026-05-10.md`, `velo-smoke-2026-05-10.md`
- Standing order: cf-ukc6 (drove the held-local cfw spec convention)
