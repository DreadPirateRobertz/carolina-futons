# JSON-LD structured-data smoke — 2026-05-10

**Bead:** cf-o9f6 (P2)
**Target:** https://carolina-futons-web.vercel.app
**Driver:** Playwright @ chromium
**Spec:** `e2e/jsonld-smoke-cf-o9f6.spec.ts` (cfw repo, branch cf-01z3 — held local per cf-ukc6)
**Run time:** 2026-05-10 ~04:25 ET, 16.5s wall, 2 workers

## Result: 6 / 6 PASS

Per-test assertions:

| # | Test | What it verifies |
|---|---|---|
| 01 | home | Organization (name + url) |
| 02 | PDP kingston | Product (name + image + offers.price + offers.priceCurrency + offers.availability) + BreadcrumbList (non-empty itemListElement) + Organization |
| 03 | PLP futon-frames | BreadcrumbList (non-empty) |
| 04 | about | Organization |
| 05 | visit | Organization |
| 06 | all key pages | every `<script type="application/ld+json">` block parses as valid JSON |

## Per-page block census (from test 06)

| # | Path | JSON-LD blocks (post-domcontentloaded) |
|---|---|---|
| 01 | `/` | 1 (Organization) |
| 02 | `/shop/futon-frames` | 2 (Organization + BreadcrumbList) |
| 03 | `/products/kingston-futon-frame` | 1 immediate (Organization), Product + BreadcrumbList stream in shortly after — see "Streaming" note below |
| 04 | `/about` | 2 |
| 05 | `/visit` | 2 |
| 06 | `/contact` | 1 |
| 07 | `/gift-cards` | 1 |
| 08 | `/guides` | 1 |
| 09 | `/reviews` | 1 |
| 10 | `/getting-it-home` | 1 |

## Findings

**No blocker JSON-LD regressions.** All structured-data blocks parse as valid JSON. PDP carries a complete Product offer (price string, currency, availability) — eligible for Google's product rich result. PLP + PDP carry BreadcrumbList — eligible for the Breadcrumb rich result. Organization is global (rendered in layout) and shows up on every page.

## Surprise during authoring

**PDP JSON-LD streams in.** Initial run with `waitUntil: 'domcontentloaded'` saw only the Organization block on `/products/kingston-futon-frame` — Product and Breadcrumb were absent at that snapshot. The PDP route is `force-dynamic` and the product-fetch Suspense boundary resolves after the initial DOM is committed; `<script type=application/ld+json>` for Product + Breadcrumb append once the boundary unblocks.

Resolved by a `page.waitForFunction(() => { ...has @type Product... })` step in the PDP test. Same script-injection timing affects any consumer that reads JSON-LD from a screenshot of the page mid-stream — Google's bot respects HTTP streaming so this isn't a real-world rich-result risk, but documenting it because the next debugger of this spec will hit the same gotcha.

The bulk validity test (#06) intentionally doesn't wait for streaming; it catches whatever blocks are present at domcontentloaded. The point of that test is to verify each block parses, not that all blocks are present at that moment.

## What this DOESN'T cover

- **All product pages** — only the kingston PDP is asserted in detail. Bulk product audit (per-SKU JSON-LD shape correctness, Wix priceData + variant offer accuracy) is a separate bead. The cf-cus PDP variant fix landed earlier should produce correct Product.offers across the catalog, but that's not verified per-SKU here.
- **AggregateRating** — reviews page might surface this if Wix Stores delivers review aggregate data; we don't gate on it because the data may be sparse and we don't want a flaky pass.
- **FAQPage** — guides/[slug] pages could carry FAQPage schema; not asserted.
- **Schema.org specification compliance** — we verify required fields are non-empty strings; we don't validate against the schema.org JSON-Schema-ish requirements (e.g., that `offers.availability` matches one of the documented enum URLs). For a strict audit, run Google's Rich Results Test on each page post-cutover.

## Re-run command

```bash
cd /Users/hal/gt/cf-01z3                  # or whichever cfw worktree has the spec
BASE_URL=https://carolina-futons-web.vercel.app \
  pnpm exec playwright test e2e/jsonld-smoke-cf-o9f6.spec.ts --workers=2
```

---

## Refs

- Bead: cf-o9f6
- Sibling baselines: `mobile-smoke-2026-05-10.md`, `tablet-smoke-2026-05-10.md`, `desktop-smoke-2026-05-10.md`, `dark-smoke-2026-05-10.md`, `seo-smoke-2026-05-10.md`, `reduced-motion-smoke-2026-05-10.md`, `meta-tags-smoke-2026-05-10.md`
- Related implementation: `src/components/seo/JsonLd.tsx`, `src/app/layout.tsx` (Organization), `src/app/products/[slug]/page.tsx` (Product + Breadcrumb), `src/app/shop/[category]/page.tsx` (PLP Breadcrumb)
- Standing order: cf-ukc6
