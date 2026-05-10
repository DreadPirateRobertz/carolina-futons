# Mobile viewport smoke — 2026-05-10

**Bead:** cf-pjdb (P2)
**Target:** https://carolina-futons-web.vercel.app
**Viewport:** 390 × 844 (iPhone 14)
**Driver:** Playwright @ chromium, BASE_URL → carolina-futons-web.vercel.app
**Spec:** `e2e/mobile-smoke-cf-pjdb.spec.ts` (cfw repo, branch cf-01z3 — held local per cf-ukc6 until next merge window)
**Run time:** 2026-05-10 ~02:38 ET, 21.2s wall, 2 workers

## Result: 10 / 10 PASS

Each test loads the page at 390×844, waits for `networkidle`, takes a full-page screenshot, then runs a smoke assertion. Screenshots in cfw repo at `e2e-screenshots/mobile-smoke-2026-05-10/<slug>.png`.

| # | Path | Smoke assertion | Status | Notes |
|---|---|---|---|---|
| 01 | `/` | site-header visible + hamburger trigger present | ✅ | bears backdrop renders edge-to-edge; hamburger surfaces over chrome |
| 02 | `/shop/futon-frames` | ≥ 1 `[data-slot="product-card"]` rendered | ✅ | grid responsive — 2-col on 390 |
| 03 | `/products/kingston-futon-frame` | "Add to cart" button visible | ✅ | PDP gallery + buy box stack OK; CTA visible above the fold |
| 04 | `/about` | h1 visible | ✅ | content + illustration scenes render |
| 05 | `/visit` | h1 + "Hendersonville" body copy visible | ✅ | address strip surfaces |
| 06 | `/contact` | visible `input[type="email"]` in a `<form>` | ⚠️ | initial assertion `form input:visible` matched a hidden RSC action input + failed; tightened selector to `input[type="email"]` and re-ran green. Page itself rendered OK on first run; *test* needed the precision. |
| 07 | `/gift-cards` | h1 visible | ✅ | content + redeem-note panel render |
| 08 | `/guides` | h1 visible | ✅ | listing renders |
| 09 | `/reviews` | h1 visible | ✅ | content renders |
| 10 | `/getting-it-home` | ZIP input visible (label match) | ✅ | address-check form first-paint OK |

## Visual review (per-screenshot)

I can't post images in the doc but here's the byte-size sanity (a near-empty page would be < 100 KB; full content with imagery is 200 KB+):

| File | Bytes | Implication |
|---|---|---|
| `01-home.png` | 2.06 MB | full bears + hero copy + nav rendered (cf-jo07 chrome live) |
| `02-shop-futon-frames.png` | 0.80 MB | product cards + photos rendered |
| `03-pdp-kingston.png` | 0.89 MB | PDP gallery + below-fold sections rendered |
| `04-about.png` | 0.49 MB | hero + scroll-story content rendered |
| `05-visit.png` | 0.30 MB | content + map area rendered |
| `06-contact.png` | 0.34 MB | form fields + page chrome rendered |
| `07-gift-cards.png` | 0.20 MB | content rendered (smaller — fewer imagery surfaces) |
| `08-guides.png` | 0.62 MB | listing + reading scene rendered |
| `09-reviews.png` | 0.26 MB | reviews + filter rendered |
| `10-getting-it-home.png` | 0.28 MB | form + content rendered |

## Findings

**No blocker visual regressions** at 390 × 844 against the production deployment.

One process note (not a bug):
- The `/contact` page has TWO forms server-rendered (newsletter signup + appointment booking). Each begins with several React Server Action `<input type="hidden">` fields. A naïve `form input:visible:first` selector was matching one of the hidden RSC fields (which Playwright treats as not-visible by definition) and failing the smoke. Tightened to `input[type="email"]:visible` for the actual user-facing field. **Both forms render correctly** on the page itself — only the assertion needed adjustment. Nothing for the cfw codebase to do.

## Out of scope (not asserted here)

The smoke confirms each page renders + has its anchor element visible. It does NOT cover:
- Interaction flows (form submission, cart add, ZIP-zone resolution)
- Visual-regression pixel diffing (this is a baseline capture; future runs can diff against these screenshots)
- Performance / Lighthouse on mobile — covered separately in `lighthouse-baseline-2026-05-10.md`
- Dark mode — wave 2 audit (`docs/qa/dark-mode-wave2-audit-2026-05-10.md`) is its own track

## Re-run command

```bash
cd /Users/hal/gt/cf-01z3                  # or whichever cfw worktree has the spec
BASE_URL=https://carolina-futons-web.vercel.app \
  pnpm exec playwright test e2e/mobile-smoke-cf-pjdb.spec.ts --workers=2
```

Add `-g "<slug>"` to scope to a single page (e.g. `-g "06-contact"`).

---

## Refs

- Bead: cf-pjdb
- Convoy: hq-cv-ctdgo
- Sibling baselines: `lighthouse-baseline-2026-05-10.md`, `e2e-checkout-smoke-2026-05-10.md`, `velo-smoke-2026-05-10.md`
- Standing order: cf-ukc6 (drove the held-local cfw spec convention)
