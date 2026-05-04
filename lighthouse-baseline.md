# Lighthouse Baseline: carolina-futons-web (Vercel Preview)

**Bead:** cf-3qt.8.11  
**Author:** godfrey  
**Date:** 2026-05-04  
**Tool:** Lighthouse 13.2.0 (mobile simulation, `--headless`)  
**Preview URL:** https://carolina-futons-web.vercel.app/  

---

## Scores

| Page | Path | Perf | A11y | Best Practices | SEO |
|------|------|------|------|----------------|-----|
| Home | `/` | 79 | 97 | 81 | 66 |
| Shop index | `/shop` | 85 | 97 | 81 | 66 |
| Futon Frames PLP | `/shop/futon-frames` | 69 | 97 | 81 | 66 |
| Kingston PDP | `/products/kingston-futon-frame` | 74 | 97 | 81 | 58 |
| Contact | `/contact` | 70 | 97 | 81 | 66 |

---

## Core Web Vitals

| Page | FCP | LCP | TBT | CLS | Speed Index | TTI |
|------|-----|-----|-----|-----|-------------|-----|
| Home `/` | 1.4 s | 4.3 s | 60 ms | 0 | 6.9 s | 5.9 s |
| Shop `/shop` | 1.3 s | 3.6 s | 60 ms | 0 | 5.6 s | 5.1 s |
| Futon Frames PLP | 2.7 s | 5.6 s | 0 ms | 0 | 6.6 s | 5.6 s |
| Kingston PDP | 1.3 s | 5.7 s | 50 ms | 0.036 | 5.8 s | 6.0 s |
| Contact | 2.6 s | 5.7 s | 10 ms | 0 | 6.0 s | 5.7 s |

LCP thresholds: Good <2.5 s · Needs Improvement 2.5–4.0 s · Poor >4.0 s  
CLS thresholds: Good <0.1 · Needs Improvement 0.1–0.25 · Poor >0.25

---

## Key Findings

### Accessibility — 97/100 on every page
No issues. Clean baseline.

### SEO — 66/100 (58 on Kingston PDP)

**`is-crawlable` fails on every page.** Vercel preview deployments automatically
add `X-Robots-Tag: noindex` to prevent preview URLs from appearing in search
results. This is expected and will resolve automatically once carolinafutons.com
points to Vercel. Not a bug — do not attempt to fix on the preview.

**Kingston PDP also fails `meta-description`.** The `/products/[slug]` dynamic
route does not generate a meta description for this product. This will persist on
production and suppress rich snippets in Google Search. Fix before cutover.

### Performance — 69–85/100

Best: `/shop` index (85), About-equivalent static pages.  
Worst: `/shop/futon-frames` PLP (69) and `/contact` (70).

**LCP is the primary drag across all pages** — ranging 3.6–5.7 s, all in "Poor"
territory except `/shop` (3.6 s, "Needs Improvement"). Likely causes:
- Hero/product images not using `priority` prop on above-the-fold images
- Product images on the PLP served at full resolution before layout is known

**CLS on Kingston PDP = 0.036** — within "Good" range but non-zero. Likely a
product image or font load without reserved space.

### Best Practices — 81/100 on every page
Uniform across all pages — likely a shared third-party or browser API issue
rather than page-specific.

### Top Opportunity: Unused JavaScript (every page)

| Page | Est. savings |
|------|-------------|
| Home | 138 KiB / 610 ms |
| Shop index | 138 KiB |
| Futon Frames PLP | 136 KiB / 770 ms |
| Kingston PDP | 330 KiB / 1,510 ms |
| Contact | 138 KiB / 750 ms |

Kingston PDP carries 330 KiB of unused JS — more than double other pages.
This is the single largest perf improvement available.

---

## Pre-Cutover Action Items

| # | Issue | Page | Priority |
|---|-------|------|----------|
| 1 | Missing meta description | `/products/[slug]` | P1 — affects SEO day-1 |
| 2 | LCP > 4 s (hero images not prioritized) | Home, PLP, PDP, Contact | P1 — Core Web Vitals |
| 3 | 330 KiB unused JS | Kingston PDP | P2 — perf |
| 4 | CLS 0.036 | Kingston PDP | P3 — minor |

---

## Post-Cutover Retest Plan

Re-run this report against `https://carolinafutons.com` (not the preview URL)
after DNS propagation confirms. Expected changes:
- SEO scores should rise to 90+ (crawlable, structured data intact)
- LCP may improve with CDN edge caching vs preview cold-start latency
- Use same command: `npx lighthouse <url> --chrome-flags='--headless'`

---

## Raw Command

```bash
npx lighthouse <url> \
  --chrome-path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --chrome-flags="--headless" \
  --output=json --output-path=/tmp/lh-<page>.json \
  --only-categories=performance,accessibility,best-practices,seo \
  --quiet
```
