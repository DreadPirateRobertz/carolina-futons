# cf-3qt.8 Lighthouse perf baseline — 2026-05-16

**Bead:** cf-sd80 (P2)
**Target:** https://carolina-futons-web.vercel.app
**Driver:** Lighthouse 13.3.0 via `npx --yes lighthouse` (Chrome headless, no-sandbox)
**Mode:** default `lh` desktop emulation (3G slow throttle + 4× CPU)

## TL;DR

**4 of 5 pages: perf 88–89** (right at the green-yellow boundary of 90). **1 page (PDP kingston) at perf 68 with LCP 7.3s** — material concern, **P2 finding** for cutover-blocker review.

CLS is **0 across all 5 pages** — cf-h85f scroll-shrink + cf-r9r3 jitter fixes locked layout stability cleanly. TBT healthy across all 5 (≤ 110ms; threshold ≤ 200ms).

## Per-page results

| # | Path | Perf | LCP | CLS | TBT | FCP | SI |
|---|---|---:|---:|---:|---:|---:|---:|
| 01 | `/` (home) | 89 | 2.6 s | 0 | 110 ms | 1.4 s | 6.9 s |
| 02 | `/shop/futon-frames` | 89 | 3.6 s | 0 | 30 ms | 1.2 s | 3.7 s |
| 03 | `/products/kingston-futon-frame` | **68** ⚠️ | **7.3 s** ⚠️ | 0 | 60 ms | 1.2 s | **8.1 s** ⚠️ |
| 04 | `/about` | 88 | 3.9 s | 0 | 40 ms | 1.2 s | 2.3 s |
| 05 | `/contact` | 89 | 3.7 s | 0 | 30 ms | 1.3 s | 2.2 s |

**Lighthouse thresholds:** Perf ≥ 90 good / 50–89 needs-improvement / < 50 poor. LCP ≤ 2.5s / ≤ 4s / > 4s. CLS ≤ 0.1 / ≤ 0.25 / > 0.25. TBT ≤ 200ms / ≤ 600ms / > 600ms.

## Findings

### F1 (P2) — PDP kingston LCP 7.3s + perf 68 ⚠️

Threshold breach: LCP > 4s = "poor"; SI 8.1s also poor. Perf score 68 is the lowest of the 5 pages by 20+ points.

**Likely causes:**
1. PDP gallery loads multiple high-res Wix CDN images even for the LCP candidate. cf-pdp-lcp-fetchpriority marks the primary image as `priority`, but the LCP candidate may not be that image — could be a hero text block or a slow Wix-hosted JPEG.
2. Wix Stores SDK calls + product-variant fetches inflate JS timeline. SI 8.1s suggests visible content takes long to "settle" (lots of late-loaded async content).
3. `force-dynamic` on the PDP route means no static optimization — every page render hits the Wix backend.

**Next step:** open `/tmp/lh-products-kingston-futon-frame.json` in Chrome DevTools "View Trace" → inspect LCP-element identification + long-tasks list. Likely fixes:
- Verify the PDP's `<Image priority>` is on the LCP candidate.
- Defer non-critical PDP islands (PdpReviews, PdpRecentlyViewed, CustomerVideoReviewGrid) below the fold via `next/dynamic`.
- Server-render the variant picker's initial selection to avoid client-side hydration cost on the critical path.

File as separate impl bead — Stilgar to triage whether cutover blocker or post-cutover Phase 7 perf wave.

### F2 (P3) — home SI 6.9s

Slower-than-PLP Speed Index despite the same perf score. Likely due to `LivingHero` cross-fading 4 SVG phases — each SVG is heavyweight; the post-paint idle-callback mount may push content into the SI measurement window. cf-byms already moves inactive phases off the critical path, but the active phase's painting itself is expensive.

Worth a follow-up that converts the SVG hero phases to next/image-served raster snapshots for the FCP+SI window, with the SVG version hydrating post-idle for animation.

### F3 (informational) — CLS = 0 across the board ✓

cf-h85f + cf-r9r3 fixes locked layout stability. Even PDP (historically worst due to dynamic variant-image swaps) holds at 0. Maintain — any future CLS > 0 finding should block merge.

## What this DOESN'T cover

- **Mobile emulation** — Lighthouse default is desktop. Mobile perf typically 20-30 points lower; would expect /products/kingston to drop into the 40s on mobile. **Recommend mobile-perf baseline (cf-sd80.fu1) before cutover.**
- **Real-user metrics (RUM)** — Lighthouse is synthetic. Vercel Analytics + Sentry traces are the real signal for post-cutover Core Web Vitals. Both wired but no baseline-table doc exists.
- **3rd-party scripts** — GA4 / Sentry / Wix CDN aren't isolated.
- **Other PDPs** — only kingston tested. Structural-vs-product-specific question remains open.

## Re-run command

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" sh -c '
for path in / /shop/futon-frames /products/kingston-futon-frame /about /contact; do
  slug=$(echo "$path" | tr "/" "-" | sed "s/^-//")
  npx --yes lighthouse "https://carolina-futons-web.vercel.app${path}" \
    --only-categories=performance \
    --output=json --output-path="/tmp/lh-${slug}.json" \
    --chrome-flags="--headless --no-sandbox" --quiet
done
'
```

---

## Refs

- Bead: cf-sd80
- Sibling baselines (12): mobile / tablet / desktop / dark / seo / reduced-motion / meta-tags / jsonld / cache-headers / security-headers / image-health / cart-flow (cf-7utd)
- Related: cf-mu05 (image priority pins), cf-pdp-lcp-fetchpriority, cf-byms (LivingHero lazy-mount)
- Standing order: cf-ukc6
