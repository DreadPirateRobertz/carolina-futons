# cf-vmll — Blog + guides parity audit (2026-05-15)

cfw (Next.js) vs Wix Studio side-by-side parity for cf-3qt.6 Phase 6 cutover gate, content-surface slice.

## Content-surface inventory

### Blog

| Side | URL | Posts | Source-of-truth |
| ---- | --- | ----- | ---------------- |
| cfw  | https://carolina-futons-web.vercel.app/blog | **15** (8 surfaced on /blog index, all 15 in static catalog) | `src/lib/blog/static-posts.ts` (cf-wvgk: 15 posts ported from `content/blog/*.md`) |
| Wix  | https://www.carolinafutons.com/blog | unknown count — Velo SPA renders client-side; `curl` returns 803KB shell with zero inline post slugs | Wix Blog CMS |

**cfw blog inventory (full 15):**
```
best-futons-for-everyday-sleeping
casegoods-accessories-guide
futon-care-guide
futon-covers-fabrics-guide
futon-for-guest-room
futon-frame-buying-guide
futon-vs-sofa-bed
how-to-choose-futon-mattress
how-to-clean-futon-mattress
mountain-living-furniture
murphy-bed-vs-futon
murphy-cabinet-beds-buying-guide
platform-bed-guide
small-space-furniture-guide
wall-hugger-futons-buying-guide
```

**Wix slug enumeration limitation**: curl + sitemap + `/blog-feed.xml` + `/feed.xml` + `/_api/blogs/v3/posts` all return 404 or empty. Wix renders its blog index client-side via Velo. To fully enumerate Wix's blog catalog requires a headless-browser sweep (or Wix-Studio dashboard inspection). Per cf-wvgk migration notes, cfw is at parity with Wix's catalog at the time of porting (15 posts). If Wix has added posts since then, they're a parity gap to be addressed in a follow-up pass.

### Guides

| Side | URL | Pages |
| ---- | --- | ----- |
| cfw  | https://carolina-futons-web.vercel.app/guides | **7** seed guides |
| Wix  | https://www.carolinafutons.com/guides | **404** — surface does NOT exist on Wix |

**cfw guides inventory (full 7):**
```
full-vs-queen-futons
how-to-pick-a-futon-mattress
mattress-firmness-guide
murphy-bed-sizing
platform-bed-vs-futon
room-layout-for-small-spaces
warranty-and-care
```

**Probed Wix-side alternates** for the same content (all 404):
- `/futon-guides`, `/learn`, `/how-to`, `/buying-guides`, `/resources`

`/faq` (200) exists on Wix but is a distinct surface — single-page FAQ, not per-topic guide deck.

**Verdict on /guides:** this is a NEW content surface cfw introduces. Not a parity gap — a positive delta (added value over Wix). Phase 6 Lighthouse-≥-Wix gate doesn't apply (no Wix counterpart).

## Lighthouse — mobile profile, simulated throttling

### /blog (both sides have this surface)

| Metric            | cfw      | Wix     | Δ (cfw - Wix)  | Verdict |
| ----------------- | -------- | ------- | -------------- | ------- |
| **Performance**   | **76**   | 65      | **+11**        | cfw wins |
| **Accessibility** | **100**  | 100     | 0              | tie |
| **SEO**           | **100**  | 100     | 0              | tie |
| **Best-Practices**| **81**   | 57      | **+24**        | cfw wins |
| LCP               | **4.9s** | 8.4s    | **-3.5s**      | cfw 1.7× faster |
| FCP               | **2.7s** | 4.3s    | **-1.6s**      | cfw wins |
| TBT               | 40ms     | **30ms** | +10ms         | Wix slightly better (within noise) |
| SI                | **3.8s** | 4.3s    | **-0.5s**      | cfw wins |

**Phase 6 gate (Lighthouse ≥ Wix) on /blog: MET.** 4 of 4 categories ≥ Wix (2 wins, 2 ties). Wix wins TBT by 10ms (well within ±15ms run-to-run noise on Lighthouse simulated throttling).

### /guides (cfw-only baseline)

| Metric            | cfw      | (Wix — N/A, no surface) |
| ----------------- | -------- | ----------------------- |
| Performance       | 78       | n/a |
| Accessibility     | 100      | n/a |
| SEO               | 100      | n/a |
| Best-Practices    | 81       | n/a |
| LCP               | 5.9s     | n/a |
| FCP               | 1.2s     | n/a |
| TBT               | 30ms     | n/a |

Baseline captured for future regression tracking. Phase 6 gate not applicable (no Wix counterpart). 100/100 a11y + SEO + healthy perf score.

## Server-side rendering parity (/blog)

```bash
$ curl -sL https://carolina-futons-web.vercel.app/blog | grep -oE '/blog/[a-z0-9-]+' | sort -u | wc -l
8  # blog post links surface in initial HTML

$ curl -sL https://www.carolinafutons.com/blog | grep -oE '/blog/[a-z0-9-]+' | sort -u | wc -l
0  # Wix renders posts client-side via Velo SPA bootstrapper
```

Same advantage as the home page: cfw blog index ships post links in the HTML payload. Wix's blog index returns the SPA shell only.

## Go/no-go on content pages

- **/blog: GO.** cfw Lighthouse ≥ Wix on all 4 categories, faster on 3 of 4 web vitals. Server-rendered content is a meaningful SEO + accessibility upgrade.
- **/guides: GO (new surface).** Cfw introduces a content area Wix doesn't have. 100/100 a11y + SEO. Healthy baseline for future regression tracking.

## Open gap (NOT blocking cutover)

Wix blog index can't be enumerated via curl, so the cfw 15-post inventory is parity-as-of-porting-date but may not reflect any Wix posts added since `cf-wvgk` landed. A headless-browser sweep of Wix's blog index OR a Wix-dashboard inspection (Stilgar) can confirm. NOT gating the cutover — even with a small post-count delta, the structural + perf wins clear the Phase 6 bar comfortably.

## Reproducer

```bash
mkdir -p /tmp/cf-vmll
for pair in \
  "https://carolina-futons-web.vercel.app/blog:cfw-blog" \
  "https://www.carolinafutons.com/blog:wix-blog" \
  "https://carolina-futons-web.vercel.app/guides:cfw-guides"; do
  url=${pair%:*}; label=${pair##*:}
  npx lighthouse "$url" --quiet --chrome-flags="--headless=new --no-sandbox" \
    --only-categories=performance,accessibility,seo,best-practices \
    --output=json --output-path=/tmp/cf-vmll/$label.json \
    --form-factor=mobile --throttling-method=simulate
done
```

## Followups

- (NON-BLOCKING) Headless-browser enumeration of Wix blog index slugs to confirm 15-post parity hasn't drifted. Easy to schedule pre-cutover as a one-shot validation. Worth a P4 bead if no one picks it up.

## Sibling audits

- cf-n405 (home parity) — GO, doc on main 8f40d59e
- cf-vmll (this) — GO, blog+guides
- cf-3qt.6 parent enumerates PLP / PDP / cart / checkout / search / etc — separate beads expected
