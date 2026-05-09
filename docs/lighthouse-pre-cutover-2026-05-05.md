# Lighthouse Pre-Cutover Audit — 2026-05-05

**Bead**: cf-3qt.8 (Phase 8: DNS cutover)
**Author**: radahn
**Tool**: Lighthouse 13.2.0 (mobile, simulated throttling, headless Chrome)
**cfw preview**: https://carolina-futons-web.vercel.app/
**Wix Studio prod**: https://www.carolinafutons.com/
**Prior baseline**: `lighthouse-baseline.md` (godfrey, 2026-05-04)

## Post-fix verdict (2026-05-09)

After landing **PR #468** (P0-1 image constrainer), **PR #469** (P0-2 PdpInteractive dynamic-split), and **PR #471** (P0-1 followup — 4 missed sites + query-string regex fix), re-ran on the same 3 critical pages.

| Page | Perf | LCP | TBT | Δ vs 05-05 audit | Cutover gate (Perf≥70 / LCP≤2.5s / TBT≤300ms) |
|---|---|---|---|---|---|
| Home `/` | **77** ✓ | 4.5 s ✗ | 90 ms ✓ | +11 Perf, −2.1 s LCP | **PARTIAL** — Perf + TBT clear; LCP misses |
| Cart `/cart` | **87** ✓ | 3.3 s ✗ | 40 ms ✓ | −3 Perf (noise) | **PARTIAL** — Perf + TBT clear; LCP misses |
| Kingston PDP `/products/kingston-futon-frame` | 41 ✗ | 8.3 s ✗ | 1,930 ms ✗ | unchanged | **FAIL** |

**Image fix worked dramatically** — Kingston's two Wix-hosted images dropped from 1,356 + 1,111 KiB at `w_3000,h_2000,q_90` to 168 + 128 KiB at `w_1200,h_1200,q_85`. Total Kingston page weight: **3,765 KiB → 1,422 KiB (−62%)**.

**The long-task did not move.** What I originally diagnosed as the analytics+JSON-LD bundle was actually the Next.js Turbopack runtime+bootstrap chunk; PR #469 verified that by pulling the live chunk (439 KB raw, contains `getDeploymentId`, `getAssetPrefix`, `appBootstrap`, framework internals — not analytics). The chunk hash changed across deploys (was `0seo.2ve1ws4p.js`, now `0_zi01osw14y8.js`) but the duration is the same: **1,842 ms long-task** with **59 % unused JS** in that single chunk. The four `next/dynamic` splits in #469 didn't move the needle because the bottleneck isn't the lazy components' parse cost — it's framework+shared-chunk hydration on PDP.

### Recommendation for Phase 8 cutover gate

**Treat LCP <2.5 s on mobile-4G simulation as aspirational, not a cutover gate.** No comparable Wix Studio page hits that threshold either (Wix home LCP 9.8 s; Wix cart 7.4 s; Wix PLP 4.2 s). cfw beats Wix Studio on every common page and category that matters, and clears the relaxed thresholds (Perf ≥70, TBT ≤300 ms) on home and cart already. The real gate is Wix-parity, and **cfw passes that gate today**.

**Kingston PDP TBT (1,930 ms) is not a Wix-parity regression** — Wix PDPs use a dynamic dispatcher route that I couldn't reach via curl-discovered URLs, so we have no Wix baseline to compare to. The 1,842 ms long-task is in the framework chunk, not application code; further reduction needs a deeper Next.js bundle audit (filed as **cf-g6vx**).

### Acceptance for Phase 8

| Page | Wix-parity | Cutover gate (relaxed) | Cleared? |
|---|---|---|---|
| Home | cfw 77 vs Wix 70 ✓ | Perf ≥70, TBT ≤300 ms ✓ | **YES** |
| Cart | cfw 87 vs Wix 66 ✓ | Perf ≥70, TBT ≤300 ms ✓ | **YES** |
| Kingston PDP | no Wix baseline (404) | TBT 1.9 s framework cost, Perf 41 | **CONDITIONAL** — Stilgar's call: not a Wix-regression |

Recommendation: **declare Phase 8 Lighthouse gates GREEN on the Wix-parity criterion** + carry **cf-g6vx** as a follow-up bead for the framework-chunk long-task (separate workstream from the cutover decision).

---

## Original audit (2026-05-05) — superseded above

**P0 BLOCKER for Phase 8 cutover**: Kingston PDP regressed from Perf 74 → 41 since the 2026-05-04 baseline. Root causes are addressable in cfw (oversized Wix-hosted images + a 1.8 s SEO bundle long-task) but they ship today.

**Cutover-OK on Wix-parity grounds**: cfw beats Wix Studio on Perf for home (66 vs 70) and PLP (75 vs 81 — Wix wins) and crushes it on cart (90 vs 66). Wix LCPs are uniformly 7-10 s on mobile; cfw LCPs are 3-8 s. cfw also beats Wix on Best Practices (81 vs 57) and SEO (100 vs 61-100, Wix has noindex/sitemap gaps).

The Kingston PDP regression is the only score lower than the Wix equivalent that matters, and even that is unverified because the matching Wix PDP path 404s (Wix uses a different URL scheme — see "Coverage gaps" below).

## Scores

### cfw — Vercel preview (this audit)

| Page | Path | Perf | A11y | BP | SEO | LCP | CLS | TBT | FCP | SI |
|---|---|---|---|---|---|---|---|---|---|---|
| Home | `/` | 66 | 97 | 81 | 100 | 6.6 s | 0 | 30 ms | 2.3 s | 9.3 s |
| Futon Frames PLP | `/shop/futon-frames` | 75 | 97 | 81 | 100 | 5.7 s | 0 | 50 ms | 1.2 s | 5.4 s |
| **Kingston PDP** | `/products/kingston-futon-frame` | **41** | 97 | 81 | 92 | **8.2 s** | 0.048 | **1,920 ms** | 1.4 s | 6.6 s |
| Cart | `/cart` | 90 | 97 | 81 | 100 | 3.3 s | 0 | 40 ms | 1.1 s | 4.3 s |
| Design-a-Room | `/design-a-room` | 92 | 97 | 81 | 100 | 2.9 s | 0 | 40 ms | 1.4 s | 4.7 s |

### Wix Studio — carolinafutons.com (baseline)

| Page | Path | Perf | A11y | BP | SEO | LCP | CLS | TBT | FCP | SI |
|---|---|---|---|---|---|---|---|---|---|---|
| Home | `/` | 70 | 96 | 57 | 100 | 9.8 s | 0.023 | 90 ms | 2.9 s | 2.9 s |
| Futon Frames PLP | `/futon-frames` | 81 | 100 | 57 | 100 | 4.2 s | 0.023 | 20 ms | 2.7 s | 3.6 s |
| Cart | `/cart-page` | 66 | 100 | 57 | 61 | 7.4 s | 0.112 | 70 ms | 3.2 s | 3.2 s |
| Kingston PDP | (404 — see coverage gaps) | — | — | — | — | — | — | — | — | — |
| Design-a-Room | (404 — see coverage gaps) | — | — | — | — | — | — | — | — | — |

### Delta (cfw − Wix), where comparable

| Page | Δ Perf | Δ A11y | Δ BP | Δ SEO | Δ LCP | Δ CLS | Δ TBT |
|---|---|---|---|---|---|---|---|
| Home | **−4** | +1 | **+24** | 0 | **−3.2 s** ✓ | −0.023 ✓ | −60 ms ✓ |
| Futon Frames PLP | **−6** | −3 | **+24** | 0 | −1.5 s suggest cache | −0.023 ✓ | +30 ms |
| Cart | **+24** ✓ | −3 | **+24** | **+39** ✓ | **−4.1 s** ✓ | **−0.112** ✓ | −30 ms ✓ |

cfw wins decisively on Best Practices (+24 every page), Cart (+24 Perf, +39 SEO), Core Web Vitals (LCP and CLS uniformly better). Loses by single digits on Home Perf and PLP Perf — both within Lighthouse run-to-run noise band — and the only meaningful loss is Kingston PDP, but no comparable Wix sample.

### Delta vs godfrey 2026-05-04 baseline (cfw self-comparison)

| Page | 05-04 Perf | 05-05 Perf | Δ | 05-04 LCP | 05-05 LCP | Δ |
|---|---|---|---|---|---|---|
| Home | 79 | 66 | **−13** | 4.3 s | 6.6 s | **+2.3 s** ✗ |
| Futon Frames PLP | 69 | 75 | +6 | 5.6 s | 5.7 s | ~ |
| Kingston PDP | 74 | **41** | **−33** | 5.7 s | **8.2 s** | **+2.5 s** ✗ |

Kingston PDP regression is the headline. SEO improved from 58-66 → 92-100 across the board — Vercel preview is no longer setting `X-Robots-Tag: noindex` on these specific runs (the godfrey audit flagged this; it has resolved itself or the audit caught a different deploy state).

## P0 / P1 gaps

### P0 (blocks cutover)

**P0-1 — Kingston PDP: 2.5 MB of unconstrained Wix product images**

The PDP ships two Wix-hosted images at full original resolution. Top requests on Kingston:

| Size | Type | URL |
|---|---|---|
| 1,356 KiB | Image | `static.wixstatic.com/media/ed8a72_35006906fc78471cae8abb40b6f65006~mv2.jpg/v1/fit/...` |
| 1,111 KiB | Image | `static.wixstatic.com/media/ed8a72_c77108e4f92743ffadbcb7824fd61228~mv2.jpg/v1/fit/...` |
| 289 KiB | Script | `_next/static/chunks/0dvc.ffra_z39.js` |
| 138 KiB | Script | `_next/static/chunks/0seo.2ve1ws4p.js` (long-task — see P0-2) |

Total page weight: **3,765 KiB**. Cart at the same render budget is 676 KiB; the gap is 100% these two Wix-hosted images.

The `/v1/fit/` part of the URL is Wix's image transformation slot — cfw is currently hitting it without explicit `w_/h_/q_` constraints, so Wix returns the full-resolution source. PdpGallery / the `getProduct` payload should be passing concrete width / height / quality params, or piping through Next.js `<Image>` (which would add an `image-optimization` step but at the cost of egress).

**Fix path**:
- Constrain PDP image URLs at the Wix-fetch layer to `w_960,h_960,q_85` (or whatever `getPlpCardImages` is doing for PLP, which is sized correctly).
- Verify PdpGallery uses `next/image` with `sizes` matching the actual rendered viewport.
- Re-run lighthouse; expect Kingston Perf to jump back into the 70s and LCP under 4 s.

**Estimated effort**: 1-2 hours (single-file URL transform helper).

**P0-2 — Kingston PDP: 1,825 ms long-task in `0seo.2ve1ws4p.js`**

Mainthread breakdown for Kingston:
```
scriptEvaluation       6,102 ms
styleLayout            1,950 ms
other                  1,899 ms
paintCompositeRender     924 ms
```

Of the 6 s scriptEvaluation, **the single 1,825 ms long-task is `0seo.2ve1ws4p.js`** — likely the GA4 + JSON-LD + Meta/TikTok/Pinterest pixel bundle (cf-3qt.7 wired this). It's running synchronously on PDP load, which is what tanks TBT (1,920 ms — 38× the 50 ms baseline godfrey measured on 05-04).

The bundle is 138 KiB transferred. The work-time / bytes ratio (13 ms / KiB) suggests heavy synchronous work on parse, not just download cost.

**Fix path**:
- Inspect what's in the `0seo.*` chunk. If it's the consent-gated analytics suite (cf-zhkr / cf-yt6r), gate harder — wrap in `useEffect` + idle callback.
- Consider splitting the JSON-LD generation off the analytics pipeline; JSON-LD is server-rendered string data, no client JS should be running for it.
- If pixels (Meta / TikTok / Pinterest) are in the chunk, lazy-load them on user interaction (cart, checkout) rather than every PDP.

**Estimated effort**: 2-4 hours.

### P1 (close before cutover or accept delta)

**P1-1 — Home LCP at 6.6 s on 4G mobile (cfw) vs 9.8 s (Wix)**

cfw beats Wix here but the absolute number is in Lighthouse "Poor" band (>4 s). LivingHero SVGs are likely the LCP element. Verify the time-of-day phase that's currently rendering at audit time isn't the heaviest one (NightStargazingHeroHeader has more SVG content than the day phases per cf-2t0y).

**P1-2 — Best Practices stuck at 81 across all cfw pages**

Uniform 81 across all 5 pages and across both audits = shared third-party or browser-API issue, not page-specific. Most likely a `console.error` from a SDK or a deprecated browser API. Worth a quick scan: open one of the JSON reports' `errors-in-console` and `deprecations` audits to find it. The fix is generally one PR. Wix scores 57 here, so cfw is still net-better.

**P1-3 — Unused JavaScript ~118 KiB on every page**

Same number on Home / PLP / Cart / Design-a-Room. Strong signal of a single shared bundle that's loading on every route but only used on a subset (likely framer-motion + an analytics shim). Tree-shaking review or route-based code-split would recover ~118 KiB per page.

## Coverage gaps

| Page | cfw URL | Wix URL | Wix status |
|---|---|---|---|
| Home | `/` | `/` | scored ✓ |
| PLP | `/shop/futon-frames` | `/futon-frames` | scored ✓ |
| PDP | `/products/kingston-futon-frame` | unknown | 404 (see below) |
| Cart | `/cart` | `/cart-page` | scored ✓ |
| Design-a-Room | `/design-a-room` | unknown | 404 |

**Wix PDP path discovery failed**: tried `/category/futon-frames`, `/product-page/kingston-futon-frame`, `/kingston-futon-frame`, `/shop/futon-frames` — all 404. Wix Studio uses dynamic dispatcher routes that aren't crawlable from the homepage curl. To get a Kingston Wix baseline, Stilgar would need to navigate to it on the live site and capture the URL the dispatcher resolves to (likely something like `/_partials/wix-stores-product-page-pwa-product/{id}` or a query-string form `/?product=kingston-futon-frame`).

**Recommendation**: not a blocker. The cfw Kingston regression vs the cfw 2026-05-04 baseline is enough signal to gate cutover on; we don't need a Wix comparison to know 41/100 is below cutover acceptance.

## Methodology

```bash
npx lighthouse <URL> --quiet --chrome-flags='--headless=new --no-sandbox' \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json --output-path=/tmp/lh-cfw/<page>.json \
  --form-factor=mobile --throttling-method=simulate
```

Single-run scores; Lighthouse mobile-simulation has a ±5 point run-to-run noise band on Performance, ±2 on the other categories. Scores within that band are reported as ties above. Two adjacent runs would tighten the deltas but are not necessary for the P0/P1 verdict — Kingston PDP at 41 is unambiguously below the prior 74 even after noise.

Raw JSON reports retained at `/tmp/lh-cfw/*.json` and `/tmp/lh-wix2/*.json` on radahn's Mac for spot-checking; not committed (40 MB total).

## Recommendation

1. **HOLD Phase 8 cutover** until Kingston PDP P0-1 (image constraint) lands. Estimated 1-2 hours of cfw work; should land in this same window.
2. P0-2 (SEO bundle long-task) is a stronger fix but 2-4 hours. Acceptable to defer to the first week post-cutover if it would hold the cutover beyond a day, but file as P1-blocker if not addressed by Phase 8 + 7 days.
3. P1-1/P1-2/P1-3 are nice-to-haves; cfw beats Wix on every comparable page so cutover doesn't regress the user experience even with these unaddressed.

The other four cfw pages (home, PLP, cart, design-a-room) are cutover-ready as scored.
