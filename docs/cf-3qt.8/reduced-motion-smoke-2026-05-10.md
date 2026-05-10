# Reduced-motion visual smoke — 2026-05-10

**Bead:** cf-5nmb (P2)
**Target:** https://carolina-futons-web.vercel.app
**Viewport:** 390 × 844
**Fixture:** `reducedMotion: 'reduce'` + explicit `page.emulateMedia({ reducedMotion: 'reduce' })` per test
**Driver:** Playwright @ chromium
**Spec:** `e2e/reduced-motion-smoke-cf-5nmb.spec.ts` (cfw repo, branch cf-01z3 — held local per cf-ukc6)
**Run time:** 2026-05-10 ~03:55 ET, 19.8s wall, 2 workers

## Result: 10 / 10 PASS

Live runtime confirmation that the WCAG 2.3.3 `@media (prefers-reduced-motion: reduce)` rule in `src/app/globals.css` actually applies on the production deployment. Several beads (cf-h85f scroll-shrink, ProductCard hover, MascotCategoryCard, the medallion peck/tilt animations, the cf-row-highlight target flash) explicitly gate animation on this preference; this smoke is the runtime sanity that the global override fires for every page.

Per-page invariants asserted in addition to visibility:
> 1. `window.matchMedia('(prefers-reduced-motion: reduce)').matches === true`
> 2. `<body>` computed `transition-duration` matches `/^(0s|0\.01(s|ms)|0\.00001s|1e-05s)$/` — any of the equivalent forms Chrome may normalize the override to.

| # | Path | matchMedia true | body t-dur ≤ 0.01ms | Visibility | Status |
|---|---|---|---|---|---|
| 01 | `/` | ✅ | ✅ | site-header + hamburger | ✅ |
| 02 | `/shop/futon-frames` | ✅ | ✅ | ≥1 product card | ✅ |
| 03 | `/products/kingston-futon-frame` | ✅ | ✅ | Add-to-cart visible | ✅ |
| 04 | `/about` | ✅ | ✅ | h1 visible | ✅ |
| 05 | `/visit` | ✅ | ✅ | h1 + Hendersonville | ✅ |
| 06 | `/contact` | ✅ | ✅ | email input visible | ✅ |
| 07 | `/gift-cards` | ✅ | ✅ | h1 visible | ✅ |
| 08 | `/guides` | ✅ | ✅ | h1 visible | ✅ |
| 09 | `/reviews` | ✅ | ✅ | h1 visible | ✅ |
| 10 | `/getting-it-home` | ✅ | ✅ | ZIP input visible | ✅ |

Screenshots in cfw at `e2e-screenshots/reduced-motion-smoke-2026-05-10/<slug>.png`.

## Findings

**No blocker reduced-motion regressions.** Every page surfaces the prefers-reduced-motion match + zeroes body transition-duration via the global override. Vestibular-sensitive users get a static rendering across the entire smoke surface.

## Surprise during authoring

Initial test.use({ reducedMotion: 'reduce' }) was returning `matches === false` — Playwright's spread of `...devices["Desktop Chrome"]` in the `chromium` project of `playwright.config.ts` overwrites the test-level `reducedMotion` fixture with the device default. Resolved by adding an explicit `page.emulateMedia({ reducedMotion: 'reduce' })` at the top of each test. Documented in the spec's header comment so a future debugger doesn't repeat the same hour. Filing a follow-up beadlet would tighten the playwright.config to preserve test-use overrides — out of scope for this gate.

Chrome normalized the computed `transition-duration` to `"1e-05s"` (scientific notation for 0.00001s = 0.01ms) instead of the plain `0.01ms` that the CSS declares. Regex updated to accept either form.

## What this DOESN'T cover

- **Animation completeness** — only checks transition-duration is zero; animation-iteration-count + scroll-behavior gates aren't separately asserted (CSS rule applies to all three under the same `@media` block; if one zeroed correctly, the others should too).
- **JS-side reduced-motion paths** (`useReducedMotion()` from framer-motion in MascotFooterDivider, ProductCard, etc) — those gate via the same matchMedia query and component-local logic; covered by unit tests, not this smoke.
- **Real iOS / macOS reduce-motion accessibility setting** — Playwright emulates the matchMedia, not the OS-level toggle path. For real-device verification, hand-test on a Mac with System Settings → Accessibility → Display → Reduce Motion ON.

## Re-run command

```bash
cd /Users/hal/gt/cf-01z3                  # or whichever cfw worktree has the spec
BASE_URL=https://carolina-futons-web.vercel.app \
  pnpm exec playwright test e2e/reduced-motion-smoke-cf-5nmb.spec.ts --workers=2
```

---

## Refs

- Bead: cf-5nmb
- Source override: `src/app/globals.css` `@media (prefers-reduced-motion: reduce)` block
- Sibling baselines: `mobile-smoke-2026-05-10.md`, `tablet-smoke-2026-05-10.md`, `desktop-smoke-2026-05-10.md`, `dark-smoke-2026-05-10.md`, `seo-smoke-2026-05-10.md`, `lighthouse-baseline-2026-05-10.md`
- Standing order: cf-ukc6
