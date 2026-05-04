# Lighthouse Baseline: carolina-futons-web (Vercel Preview)

**Bead:** cf-3qt.8.7  
**Author:** godfrey  
**Date:** 2026-05-04  
**Tool:** Lighthouse 13.2.0 (mobile simulation)  
**Target:** https://carolina-futons-web.vercel.app/  

---

## Scores

| Page | URL | Perf | A11y | Best Practices | SEO |
|------|-----|------|------|----------------|-----|
| Home | `/` | 79 | 97 | 81 | 66 |
| Futon Frames PLP | `/shop/futon-frames` | 69 | 97 | 81 | 66 |
| Kingston PDP | `/products/kingston-futon-frame` | 74 | 97 | 81 | 58 |
| About | `/about` | 87 | 97 | 81 | 66 |
| Contact | `/contact` | 70 | 97 | 81 | 66 |

---

## Core Web Vitals

| Page | FCP | LCP | TBT | CLS | Speed Index | TTI |
|------|-----|-----|-----|-----|-------------|-----|
| Home | 1.4 s | 4.3 s | 60 ms | 0 | 6.9 s | 5.9 s |
| Futon Frames PLP | 2.7 s | 5.6 s | 0 ms | 0 | 6.6 s | 5.6 s |
| Kingston PDP | 1.3 s | 5.7 s | 50 ms | 0.036 | 5.8 s | 6.0 s |
| About | 1.3 s | 3.5 s | 20 ms | 0 | 5.0 s | 5.1 s |
| Contact | 2.6 s | 5.7 s | 10 ms | 0 | 6.0 s | 5.7 s |

LCP threshold: Good <2.5 s, Needs Improvement 2.5–4.0 s, Poor >4.0 s  
CLS threshold: Good <0.1, Needs Improvement 0.1–0.25, Poor >0.25

---

## Key Findings

### Accessibility — 97/100 on every page
Strong baseline. No issues identified across all five pages.

### SEO — 66/100 (58 on Kingston PDP)

**`is-crawlable` fails on every page.** This is expected and intentional: Vercel
automatically adds `X-Robots-Tag: noindex` on all preview deployment URLs to
prevent them from appearing in search results. This will resolve automatically
once the domain is pointed at production (carolinafutons.com). Not a bug.

**Kingston PDP also fails `meta-description`.** The `/products/[slug]` route does
not generate a meta description for the `kingston-futon-frame` product. This will
suppress the rich snippet on the live domain — needs a fix before cutover.

### Performance — 69–87/100

- **About page** is the best performer (87) — low JS weight, minimal images.
- **PLP and Contact** are weakest (69–70) — large LCP (5.6–5.7 s).
- **LCP is the primary drag across all pages** — 4.3–5.7 s, all in "Poor" territory.
  Likely cause: hero/product images not prioritized or sized for mobile viewport.
- **CLS on Kingston PDP = 0.036** — minor, in "Good" range, but non-zero.
  Likely a late-loading image without explicit dimensions.

### Best Practices — 81/100 on every page
Consistent across all pages. No variation; likely a shared dependency issue.

### Top Opportunity: Unused JavaScript (all pages)

Every page flags the same audit:

| Page | Est. JS savings | Est. time savings |
|------|----------------|-------------------|
| Home | 138 KiB | 610 ms |
| Futon Frames PLP | 136 KiB | 770 ms |
| Kingston PDP | 330 KiB | 1,510 ms |
| About | 138 KiB | 450 ms |
| Contact | 138 KiB | 750 ms |

Kingston PDP carries 330 KiB of unused JS — more than double any other page.
This is the single highest-impact optimization target.

---

## Recommended Pre-Cutover Fixes (Priority Order)

1. **Kingston PDP meta description** — `is-crawlable` will auto-fix on production,
   but the missing meta description will persist. Add dynamic `metadata` export
   to `/products/[slug]/page.tsx` to generate description from product data.

2. **LCP optimization** — All pages have LCP > 4 s on mobile. Add `priority` prop
   to the hero image on `/` and the first product image on `/shop/futon-frames`.
   Ensure explicit `width`/`height` on all above-the-fold images.

3. **Kingston PDP JS bundle** — 330 KiB unused JS (1.5 s savings) is significant.
   Audit lazy loading of PDP-specific components (variant picker, galleries,
   financing widgets).

4. **CLS on Kingston PDP** — Minor (0.036) but investigate which element shifts.
   Likely a product image missing explicit dimensions.

---

## Notes on Test Conditions

- All runs: Lighthouse 13.2.0, mobile simulation (Moto G Power emulation, 4× CPU throttle, Fast 4G)
- Vercel preview cold-start latency may inflate TTFB and LCP relative to production
- `force-dynamic` pages (`/search`) were not included in this baseline (not in scope)
- Re-run this report on the live `carolinafutons.com` domain post-cutover to establish
  the true production baseline (preview cold-starts and `noindex` artifacts will not apply)
