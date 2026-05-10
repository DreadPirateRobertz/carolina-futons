# Dark-mode visual smoke — 2026-05-10

**Bead:** cf-9mm0 (P2)
**Target:** https://carolina-futons-web.vercel.app
**Viewport:** 390 × 844, `colorScheme: 'dark'` + seeded `cf-theme=dark` localStorage
**Driver:** Playwright @ chromium, BASE_URL → carolina-futons-web.vercel.app
**Spec:** `e2e/dark-smoke-cf-9mm0.spec.ts` (cfw repo, branch cf-01z3 — held local per cf-ukc6)
**Run time:** 2026-05-10 ~02:58 ET, 25.5s wall, 2 workers

## Result: 10 / 10 PASS

This is the live runtime confirmation that the cf-ax24 (wave 1) and cf-yq3h (wave 2) dark-mode surface fixes actually render correctly on the production deployment. Static audits caught the broken classes; this gate proves the merged fixes paint.

Per-page invariant (asserted in addition to the existing light-mode smoke):
> `<html>` carries the `dark` class on every page.

If the `THEME_INIT_SCRIPT` in `layout.tsx` ever stops applying the class before paint, this assertion fails — every dark-mode surface depends on `.dark` ancestor selectors compiled by Tailwind, so a missing class would silently render every page forced-light against the dark color-scheme.

| # | Path | dark class | Page assertion | Status | Bytes |
|---|---|---|---|---|---|
| 01 | `/` | ✅ | site-header + hamburger visible | ✅ | 2.02 MB |
| 02 | `/shop/futon-frames` | ✅ | ≥1 product card | ✅ | 0.78 MB |
| 03 | `/products/kingston-futon-frame` | ✅ | Add-to-cart visible | ✅ | 0.88 MB |
| 04 | `/about` | ✅ | h1 visible | ✅ | 0.47 MB |
| 05 | `/visit` | ✅ | h1 + Hendersonville | ✅ | 0.28 MB |
| 06 | `/contact` | ✅ | email input visible | ✅ | 0.31 MB |
| 07 | `/gift-cards` | ✅ | h1 visible | ✅ | 0.18 MB |
| 08 | `/guides` | ✅ | h1 visible | ✅ | 0.56 MB |
| 09 | `/reviews` | ✅ | h1 visible | ✅ | 0.24 MB |
| 10 | `/getting-it-home` | ✅ | ZIP input visible | ✅ | 0.23 MB |

Screenshots in cfw at `e2e-screenshots/dark-smoke-2026-05-10/<slug>.png`.

## Findings

**No blocker dark-mode regressions** at 390×844. The dark surfaces wired across the cf-ax24/cf-yq3h waves render with the expected token mapping (cf-sand backgrounds, cf-cream + cf-ink text, cf-cream borders, etc.). Header backdrop bears continue showing through the dark chrome.

Byte-size sidecar sanity: dark-mode home is 2.02 MB vs light-mode 2.06 MB — same order of magnitude, no missing-asset signature. Other pages drop slightly under dark mode (smaller imagery footprint where dark gradients replace lighter photos), all within reasonable interpolation.

## What this DOESN'T cover

- **Multi-viewport dark coverage** — only 390×844 here. A tablet/desktop dark sweep would be a follow-up bead if Stilgar requests; the surfaces are viewport-agnostic per the cf-ax24 token table.
- **Pixel-diff regression** — first capture; future runs can diff against these for visual drift.
- **Hover/focus/disabled states under dark** — first-render only.
- **Manual theme toggle path** — this seeds `cf-theme=dark` in localStorage to bypass the toggle. A separate flow that drives the in-page ThemeToggle button could surface bugs in the toggle path itself.

## Re-run command

```bash
cd /Users/hal/gt/cf-01z3                  # or whichever cfw worktree has the spec
BASE_URL=https://carolina-futons-web.vercel.app \
  pnpm exec playwright test e2e/dark-smoke-cf-9mm0.spec.ts --workers=2
```

---

## Refs

- Bead: cf-9mm0
- Implementation: cf-ax24 (wave 1) + cf-yq3h (wave 2)
- Static audits: `dark-mode-wave1` (cf-rn4j), `docs/qa/dark-mode-wave2-audit-2026-05-10.md`
- Sibling baselines: `mobile-smoke-2026-05-10.md`, `tablet-smoke-2026-05-10.md`, `desktop-smoke-2026-05-10.md`, `lighthouse-baseline-2026-05-10.md`
- Standing order: cf-ukc6
