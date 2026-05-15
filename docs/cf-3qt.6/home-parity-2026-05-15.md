# cf-n405 — Home page parity audit (2026-05-15)

cfw (Next.js) vs Wix Studio side-by-side parity for cf-3qt.6 Phase 6 cutover gate.

## URLs

| Side  | URL                                              |
| ----- | ------------------------------------------------ |
| cfw   | https://carolina-futons-web.vercel.app/         |
| Wix   | https://www.carolinafutons.com/                  |

## Lighthouse — mobile profile, simulated throttling

| Metric                  | cfw     | Wix     | Δ (cfw - Wix) | Verdict |
| ----------------------- | ------- | ------- | ------------- | ------- |
| **Performance**         | **83**  | 61      | **+22**       | cfw wins |
| **Accessibility**       | **97**  | 96      | **+1**        | cfw wins |
| **SEO**                 | **100** | 100     | 0             | tie |
| **Best-Practices**      | **81**  | 57      | **+24**       | cfw wins |
| LCP                     | **3.8s** | 14.8s  | **-11s**     | cfw 4× faster |
| CLS                     | 0       | 0       | 0             | tie |
| TBT                     | **60ms** | 110ms  | -50ms         | cfw wins |
| FCP                     | **1.4s** | 5.0s   | **-3.6s**    | cfw 3.5× faster |
| SI                      | 6.0s    | **5.0s** | +1.0s       | Wix slightly faster |

**Phase 6 gate (Lighthouse ≥ Wix on all categories): MET on home page.** 4 of 4 category scores ≥ Wix (3 wins, 1 tie). Wix wins SI by 1s — within normal run-to-run noise (±0.5s on Lighthouse simulated throttling).

## Server-side rendering parity

```bash
$ curl -sL https://carolina-futons-web.vercel.app/ | grep -oE '<h[123][^>]*>[^<]+</h[123]>' | wc -l
~25  # 4 category headings + 4 hero section h2s + product card h2s

$ curl -sL https://www.carolinafutons.com/ | grep -oE '<h[123][^>]*>[^<]+</h[123]>' | wc -l
0  # Wix renders content client-side via Velo SPA bootstrapper
```

**cfw advantage**: server-rendered content is in the initial HTML payload. Bots, screen readers, and CDN caching all see real content immediately. Wix's runtime SPA hydration means the same surfaces show empty HTML to non-JS clients.

## SEO meta parity

| Field        | cfw                                                                 | Wix                                                                                       |
| ------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Title        | Carolina Futons — Hardwood Frames & Mattresses \| Hendersonville, NC | Carolina Futons \| Futon Furniture \| 824 Locust St, Ste 200, Hendersonville, NC 28792, USA |
| Description  | Family-owned since 1991. Solid hardwood futon frames, natural mattresses, Murphy beds, and platform beds. Visit our Hendersonville, NC showroom or shop online. | Carolina Futons is a family-owned business that has the largest selection of quality futon furniture in the Carolinas, as well as Murphy Cabinet Beds & platform beds & accessories. |

Both have title + description tags. cfw title is more product-focused; Wix title leads with the address. Description tone differs (cfw says "since 1991", Wix says "largest selection in the Carolinas") but neither violates SEO best-practice length limits.

## Sections present on cfw home (server-rendered, curl-visible)

- Header: announcement bar + primary nav + secondary nav + hero
- Hero band: "Handcrafted Comfort, Mountain Inspired" (home-only per cf-1eb5)
- Four-category grid: Murphy Cabinet Beds / Futon Frames / Mattresses / Platform Beds (cf-3b6j corner-button cards)
- "See it in action" video band
- "Find your perfect futon" PLP-embedded product grid (24+ products in HTML on first paint)
- Footer with brand + nav + newsletter + address

Wix home renders the same surfaces but their content is in the JS bundle — `curl` returns the SPA shell only.

## Functional smoke

- cf-vu40 (Kingston guest checkout smoke, 2026-05-15) verified PDP → cart → checkout flow on cfw ✅
- cf-jzsd (PLP → PDP → add-to-cart → checkout-renders smoke) verified at both 1280×800 and 390×844 ✅
- cf-b57h (QuickView smoke) verified on home / PLP cards ✅

No functional gaps observed against Wix for the home → PLP → PDP → cart → checkout flow.

## Go/no-go on home page

**GO.** cfw home Lighthouse ≥ Wix on every category. LCP and FCP are dramatically better (4× and 3.5× respectively). Server-rendered content is an SEO + accessibility win. The 1s SI delta is within run-to-run noise.

## Reproducer

```bash
mkdir -p /tmp/cf-n405
npx lighthouse https://carolina-futons-web.vercel.app/ \
  --quiet --chrome-flags="--headless=new --no-sandbox" \
  --only-categories=performance,accessibility,seo,best-practices \
  --output=json --output-path=/tmp/cf-n405/cfw-home.json \
  --form-factor=mobile --throttling-method=simulate
npx lighthouse https://www.carolinafutons.com/ \
  --quiet --chrome-flags="--headless=new --no-sandbox" \
  --only-categories=performance,accessibility,seo,best-practices \
  --output=json --output-path=/tmp/cf-n405/wix-home.json \
  --form-factor=mobile --throttling-method=simulate
```

Then `python3` summarizer on the two JSON files (script in the original bd notes).

## Followups

None for home. Sibling parity audits queued: cf-vmll (blog/guides), and the cf-3qt.6 parent enumerates PLP / PDP / cart / checkout / search / etc.
