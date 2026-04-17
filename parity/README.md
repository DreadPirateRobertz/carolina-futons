# Parity CI (cf-3qt Phase 6 prep)

Scaffold for the 7-day parallel-run parity audit comparing the legacy Wix Studio
site (`carolinafutons.com`) with the in-progress Next.js migration
(`web-staging.carolinafutons.com`).

**Status: PREP ONLY.** Phases 2–5 of the cf-3qt epic are not complete — the
Next.js app does not exist yet. This directory holds the tooling that will run
once a Vercel preview URL is available.

## Inventory

| File | Purpose |
| --- | --- |
| `pages.json` | The 30-page audit set. Each entry maps the legacy Wix URL path to the target Next.js route. Used by both Lighthouse and the visual-diff spec. |
| `lighthouse-run.js` | Runs Lighthouse against each page on both `LEGACY_BASE` and `NEXT_BASE`, emits JSON reports per page. |
| `visual-diff.spec.js` | Playwright test: screenshots each page on three breakpoints (mobile 390, tablet 768, desktop 1440) on both bases, diffs and flags anything above threshold. |
| `playwright.config.js` | Playwright config. Parallel workers, HTML + JSON reporters, trace on failure. |

## Activation (once Phase 5 ships)

1. Install peer deps at the repo root:
   ```
   npm i -D @playwright/test lighthouse chrome-launcher pixelmatch pngjs
   npx playwright install chromium
   ```
2. Set env:
   ```
   export LEGACY_BASE=https://www.carolinafutons.com
   export NEXT_BASE=https://web-staging.carolinafutons.com
   ```
3. Run:
   ```
   node parity/lighthouse-run.js
   npx playwright test --config parity/playwright.config.js
   ```
4. Reports land under `parity/reports/<YYYY-MM-DD>/`.

## Acceptance gates (from cf-3qt.6)

- Zero critical parity gaps (functional regressions)
- Lighthouse ≥ Wix Studio scores on all 30 pages
- Visual diff <5 % per page average
- 7-day orders on web-staging shadow ≥95 % parity (tracked separately by melania/mayor, not here)
