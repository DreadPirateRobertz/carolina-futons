# Tablet viewport smoke — 2026-05-10

**Bead:** cf-vtoe (P2, companion to cf-pjdb mobile + cf-ljsy desktop smokes)
**Target:** https://carolina-futons-web.vercel.app
**Viewport:** 768 × 1024 (iPad portrait — Tailwind md breakpoint)
**Driver:** Playwright @ chromium, BASE_URL → carolina-futons-web.vercel.app
**Spec:** `e2e/tablet-smoke-cf-vtoe.spec.ts` (cfw repo, branch cf-01z3 — held local per cf-ukc6)
**Run time:** 2026-05-10 ~02:55 ET, 19.3s wall, 2 workers

## Result: 10 / 10 PASS

The cutover-gate visual baseline now covers all three breakpoint pairs:

| Companion | Viewport | Tailwind class | Status |
|---|---|---|---|
| cf-pjdb (mobile) | 390 × 844 | base | ✅ shipped |
| cf-vtoe (this — tablet) | 768 × 1024 | `md` | ✅ this doc |
| cf-ljsy (desktop) | 1280 × 800 | `lg`+ | ✅ shipped |

Full-page screenshot per page in cfw at `e2e-screenshots/tablet-smoke-2026-05-10/<slug>.png`.

| # | Path | Status | Bytes |
|---|---|---|---|
| 01 | `/` | ✅ | 2.80 MB |
| 02 | `/shop/futon-frames` | ✅ | 1.51 MB |
| 03 | `/products/kingston-futon-frame` | ✅ | 1.32 MB |
| 04 | `/about` | ✅ | 0.87 MB |
| 05 | `/visit` | ✅ | 0.73 MB |
| 06 | `/contact` | ✅ | 0.62 MB |
| 07 | `/gift-cards` | ✅ | 0.33 MB |
| 08 | `/guides` | ✅ | 0.87 MB |
| 09 | `/reviews` | ✅ | 0.52 MB |
| 10 | `/getting-it-home` | ✅ | 0.40 MB |

Smoke assertions are identical to cf-ljsy (desktop) — at 768px the layout has crossed `md:flex` so the primary nav surfaces and the hamburger is hidden, same as desktop. iPad sits comfortably above the breakpoint and reuses the desktop chrome shape.

## Findings

**No blocker tablet layout regressions** at 768 × 1024 against the production deployment. Sizes interpolate cleanly between mobile and desktop — home is 2.80 MB (between mobile 2.06 + desktop 3.98), PDP 1.32 MB (close to desktop), visit 0.73 (between 0.30 + 0.78). Nothing anomalous suggesting a layout break at the md threshold.

## Re-run command

```bash
cd /Users/hal/gt/cf-01z3                  # or whichever cfw worktree has the spec
BASE_URL=https://carolina-futons-web.vercel.app \
  pnpm exec playwright test e2e/tablet-smoke-cf-vtoe.spec.ts --workers=2
```

---

## Refs

- Bead: cf-vtoe
- Sibling baselines: `mobile-smoke-2026-05-10.md`, `desktop-smoke-2026-05-10.md`, `lighthouse-baseline-2026-05-10.md`, `e2e-checkout-smoke-2026-05-10.md`, `velo-smoke-2026-05-10.md`
- Standing order: cf-ukc6
