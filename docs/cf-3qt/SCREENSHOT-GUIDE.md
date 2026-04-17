# cf-3qt.6.1 Screenshot Guide

Canonical per-page parity log for the Wix Studio → Next.js migration.
30 pages × 3 breakpoints = **90 cells**. Each cell is signed off by radahn
first, then countersigned by melania before the page is cleared for
DNS cutover (cf-3qt.8).

## How to update this guide

1. Run `npm run parity:screenshots` with `LEGACY_BASE` and (when available)
   `NEXT_BASE` set.
2. Open `/tmp/cf-3qt-parity/index.html` to review the run.
3. For each cell below, drop the diff %, paste the intent/notes, and flip
   the status from `☐` to `☑` when satisfied.
4. Rerun on every radahn push so the most recent diff % is always current.

## Status legend

| Mark | Meaning |
|------|---------|
| ☐    | Not captured yet (no Next.js target, or harness not run) |
| ⚪    | Captured, awaiting review |
| 🟡   | Diff above 1% but below 5% — reviewed, accepted with notes |
| 🟢   | Diff ≤ 1% — accepted |
| 🔴   | Diff > 5% — blocks cutover until fixed |
| ✅    | Signed off by melania |

## Breakpoints

| id      | width × height |
|---------|---------------|
| mobile  | 375 × 812     |
| tablet  | 768 × 1024    |
| desktop | 1440 × 900    |

## Sign-off table

Each row is one (page, breakpoint) cell. `Diff %` is the pixelmatch
percentage from the last harness run. `Intent` is one sentence from
DESIGN-INTENT-MATRIX.md describing the page's brand goal; `Notes` records
the parity judgment.

### Phase 2 — Commerce (10 pages × 3 = 30 cells)

| # | Page | BP | Diff % | Intent | Notes | radahn | melania |
|---|------|----|--------|--------|-------|--------|---------|
| 1 | home | mobile | — | Warm North Carolina welcome, headline offer above the fold | | ☐ | ☐ |
| 2 | home | tablet | — | " | | ☐ | ☐ |
| 3 | home | desktop | — | " | | ☐ | ☐ |
| 4 | plp-futons | mobile | — | Dense scannable grid, clear price anchors | | ☐ | ☐ |
| 5 | plp-futons | tablet | — | " | | ☐ | ☐ |
| 6 | plp-futons | desktop | — | " | | ☐ | ☐ |
| 7 | plp-mattresses | mobile | — | Comfort-first copy, firm/medium/plush signaling | | ☐ | ☐ |
| 8 | plp-mattresses | tablet | — | " | | ☐ | ☐ |
| 9 | plp-mattresses | desktop | — | " | | ☐ | ☐ |
| 10 | plp-frames | mobile | — | Wood/finish hero, filter-forward | | ☐ | ☐ |
| 11 | plp-frames | tablet | — | " | | ☐ | ☐ |
| 12 | plp-frames | desktop | — | " | | ☐ | ☐ |
| 13 | plp-covers | mobile | — | Color/texture grid, size picker prominent | | ☐ | ☐ |
| 14 | plp-covers | tablet | — | " | | ☐ | ☐ |
| 15 | plp-covers | desktop | — | " | | ☐ | ☐ |
| 16 | plp-accessories | mobile | — | Small-ticket cross-sell, bundle call-outs | | ☐ | ☐ |
| 17 | plp-accessories | tablet | — | " | | ☐ | ☐ |
| 18 | plp-accessories | desktop | — | " | | ☐ | ☐ |
| 19 | pdp-eureka | mobile | — | Hero gallery → spec strip → CTA → reviews; single clear buy path | | ☐ | ☐ |
| 20 | pdp-eureka | tablet | — | " | | ☐ | ☐ |
| 21 | pdp-eureka | desktop | — | " | | ☐ | ☐ |
| 22 | cart | mobile | — | Low-friction summary, shipping/tax estimate visible | | ☐ | ☐ |
| 23 | cart | tablet | — | " | | ☐ | ☐ |
| 24 | cart | desktop | — | " | | ☐ | ☐ |
| 25 | checkout | mobile | auth | Guest + member paths, trust badges, no surprises | | ☐ | ☐ |
| 26 | checkout | tablet | auth | " | | ☐ | ☐ |
| 27 | checkout | desktop | auth | " | | ☐ | ☐ |
| 28 | order-conf | mobile | auth | Warm thank-you, order ID, next-step expectations | | ☐ | ☐ |
| 29 | order-conf | tablet | auth | " | | ☐ | ☐ |
| 30 | order-conf | desktop | auth | " | | ☐ | ☐ |

### Phase 3 — Account (4 pages × 3 = 12 cells)

| # | Page | BP | Diff % | Intent | Notes | radahn | melania |
|---|------|----|--------|--------|-------|--------|---------|
| 31 | account-login | mobile | — | Single-field focus, magic-link-friendly | | ☐ | ☐ |
| 32 | account-login | tablet | — | " | | ☐ | ☐ |
| 33 | account-login | desktop | — | " | | ☐ | ☐ |
| 34 | account-dashboard | mobile | auth | Orders + wishlist + prefs at a glance | | ☐ | ☐ |
| 35 | account-dashboard | tablet | auth | " | | ☐ | ☐ |
| 36 | account-dashboard | desktop | auth | " | | ☐ | ☐ |
| 37 | account-orders | mobile | auth | Reorderable rows, status chips, receipt link | | ☐ | ☐ |
| 38 | account-orders | tablet | auth | " | | ☐ | ☐ |
| 39 | account-orders | desktop | auth | " | | ☐ | ☐ |
| 40 | account-wishlist | mobile | auth | Product thumbs, move-to-cart per row | | ☐ | ☐ |
| 41 | account-wishlist | tablet | auth | " | | ☐ | ☐ |
| 42 | account-wishlist | desktop | auth | " | | ☐ | ☐ |

### Phase 4 — Content (9 pages × 3 = 27 cells)

| # | Page | BP | Diff % | Intent | Notes | radahn | melania |
|---|------|----|--------|--------|-------|--------|---------|
| 43 | about | mobile | — | Family-owned NC story, showroom photos | | ☐ | ☐ |
| 44 | about | tablet | — | " | | ☐ | ☐ |
| 45 | about | desktop | — | " | | ☐ | ☐ |
| 46 | faq | mobile | — | Accordion, most-asked pinned | | ☐ | ☐ |
| 47 | faq | tablet | — | " | | ☐ | ☐ |
| 48 | faq | desktop | — | " | | ☐ | ☐ |
| 49 | contact | mobile | — | Name/email/message, map, showroom hours | | ☐ | ☐ |
| 50 | contact | tablet | — | " | | ☐ | ☐ |
| 51 | contact | desktop | — | " | | ☐ | ☐ |
| 52 | grow-in-home | mobile | — | Financing positioning, application CTA | | ☐ | ☐ |
| 53 | grow-in-home | tablet | — | " | | ☐ | ☐ |
| 54 | grow-in-home | desktop | — | " | | ☐ | ☐ |
| 55 | compare | mobile | — | Side-by-side matrix, sticky header | | ☐ | ☐ |
| 56 | compare | tablet | — | " | | ☐ | ☐ |
| 57 | compare | desktop | — | " | | ☐ | ☐ |
| 58 | videos | mobile | — | Embed grid, editorial thumbs | | ☐ | ☐ |
| 59 | videos | tablet | — | " | | ☐ | ☐ |
| 60 | videos | desktop | — | " | | ☐ | ☐ |
| 61 | blog-index | mobile | — | Editorial feel, clear read times | | ☐ | ☐ |
| 62 | blog-index | tablet | — | " | | ☐ | ☐ |
| 63 | blog-index | desktop | — | " | | ☐ | ☐ |
| 64 | blog-post-sample | mobile | — | Long-form readability, related posts footer | | ☐ | ☐ |
| 65 | blog-post-sample | tablet | — | " | | ☐ | ☐ |
| 66 | blog-post-sample | desktop | — | " | | ☐ | ☐ |
| 67 | returns-policy | mobile | — | Plain-English summary up top, legal below | | ☐ | ☐ |
| 68 | returns-policy | tablet | — | " | | ☐ | ☐ |
| 69 | returns-policy | desktop | — | " | | ☐ | ☐ |

### Phase 5 — Landing / utility (7 pages × 3 = 21 cells)

| # | Page | BP | Diff % | Intent | Notes | radahn | melania |
|---|------|----|--------|--------|-------|--------|---------|
| 70 | landing-students | mobile | — | Dorm + move-out messaging, bundled prices | | ☐ | ☐ |
| 71 | landing-students | tablet | — | " | | ☐ | ☐ |
| 72 | landing-students | desktop | — | " | | ☐ | ☐ |
| 73 | landing-apartments | mobile | — | Studio-friendly layouts, compact frames | | ☐ | ☐ |
| 74 | landing-apartments | tablet | — | " | | ☐ | ☐ |
| 75 | landing-apartments | desktop | — | " | | ☐ | ☐ |
| 76 | landing-guest-room | mobile | — | Occasional-use pitch, comfort-first copy | | ☐ | ☐ |
| 77 | landing-guest-room | tablet | — | " | | ☐ | ☐ |
| 78 | landing-guest-room | desktop | — | " | | ☐ | ☐ |
| 79 | landing-rv | mobile | — | Size-constrained fits, travel-friendly | | ☐ | ☐ |
| 80 | landing-rv | tablet | — | " | | ☐ | ☐ |
| 81 | landing-rv | desktop | — | " | | ☐ | ☐ |
| 82 | search | mobile | — | Result density, facet visibility | | ☐ | ☐ |
| 83 | search | tablet | — | " | | ☐ | ☐ |
| 84 | search | desktop | — | " | | ☐ | ☐ |
| 85 | sitemap | mobile | — | Flat list, machine-friendly | | ☐ | ☐ |
| 86 | sitemap | tablet | — | " | | ☐ | ☐ |
| 87 | sitemap | desktop | — | " | | ☐ | ☐ |
| 88 | not-found | mobile | — | On-brand 404, quick paths back in | | ☐ | ☐ |
| 89 | not-found | tablet | — | " | | ☐ | ☐ |
| 90 | not-found | desktop | — | " | | ☐ | ☐ |

## Acceptance (blocks cf-3qt.8 cutover)

- All 90 cells reach 🟢 or 🟡 with a signed-off note
- Zero 🔴 remaining
- melania countersign in the last column of every row
