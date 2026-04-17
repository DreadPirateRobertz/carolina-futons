# docs/cf-3qt — migration audit docs

Canonical docs for the Wix Studio → Next.js cutover. Lives next to the
code in `parity/` and `scripts/`; the bead spec is `cf-3qt` and this
directory collects the paperwork for Phase 6 (parity) and Phase 7 (SEO).

## Layout

| File | Purpose |
|------|---------|
| `SCREENSHOT-GUIDE.md` | 90-cell visual parity sign-off log (30 pages × 3 breakpoints) |
| `DESIGN-INTENT-MATRIX.md` | Traces design vision + competitor research to per-page acceptance criteria |
| `INTENT-SURVEY-TEMPLATE.md` | 3-question sign-off template Stilgar uses per page |
| `FUNCTIONAL-PARITY-REPORT.md` | Rolling output of `npm run parity:functional` |
| `sign-offs/<page>.md` | Per-page Stilgar sign-offs, generated from the template |

## How this connects to `parity/`

```
parity/pages.json            ← single source of truth for pages + breakpoints
parity/screenshot-harness.js ← writes shots + gallery, reads pages.json
parity/visual-diff.spec.js   ← Playwright test version (CI-friendly, stricter)
parity/lighthouse-run.js     ← Lighthouse delta between LEGACY_BASE and NEXT_BASE
parity/functional/*.spec.js  ← commerce / account / content parity tests
scripts/gsc-url-pull.js      ← pulls GSC indexed URLs for 301 mapping (cf-3qt.7)
scripts/build-redirect-map.js← emits redirect-map.json from GSC + pages.json
```

## How to run

Baseline only (Next.js not yet ready — captures Wix for reference):
```
LEGACY_BASE=https://www.carolinafutons.com npm run parity:screenshots
```

Full parity (after Next.js preview exists):
```
LEGACY_BASE=https://www.carolinafutons.com \
NEXT_BASE=https://web-staging.carolinafutons.com \
npm run parity:screenshots
```

Functional suites (requires both bases + a parity test member):
```
PARITY_TEST_EMAIL=… PARITY_TEST_PASSWORD=… npm run parity:functional
```

## Acceptance gates (blocks cf-3qt.8)

- All 90 cells in SCREENSHOT-GUIDE reach 🟢 or 🟡 with signed-off notes
- Every `verdict` in DESIGN-INTENT-MATRIX is `ship` (no `block`)
- FUNCTIONAL-PARITY-REPORT shows zero critical regressions on the most
  recent daily run
- Stilgar signs off every page in `sign-offs/`
