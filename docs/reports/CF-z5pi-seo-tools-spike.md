# CF-z5pi SPIKE: Wire SEO Tools

**Date**: 2026-03-16
**Author**: miquella
**Status**: Complete

## Executive Summary

SEO infrastructure is **already comprehensive** — no new code work needed.
The codebase has a production-grade SEO implementation covering JSON-LD structured data,
Open Graph tags, Twitter Cards, Pinterest Rich Pins, Google Shopping feed, robots.txt,
and XML sitemaps. The remaining work is **verification testing on social platforms**.

## Existing Code Inventory

### Backend SEO Modules (~2,900 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `seoHelpers.web.js` | 1,142 | 13 web methods: Product/Business/WebSite/Collection/Breadcrumb/FAQ/Blog JSON-LD, OG tags, meta tags, canonical URLs, page titles, alt text |
| `seoContentHub.web.js` | 403 | Pillar page architecture for 8 buying guides with hub/guide schemas and sitemap entries |
| `pinterestRichPins.web.js` | 282 | Pinterest Rich Pin support for products and articles |
| `storeLocatorService.web.js` | 200+ | LocalBusiness/FurnitureStore schema with hours, geo, accessibility |
| `googleMerchantFeed.web.js` | 200+ | Google Shopping feed with category taxonomy |

### Frontend SEO Modules (~400 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `pageSeo.js` | 51 | Shared `initPageSeo()` — title, meta, OG, Twitter Card for all page types |
| `faqSeo.js` | 47 | FAQ page JSON-LD injection via wix-seo-frontend |
| `localBusinessSeo.js` | 77 | Contact/Store Locator schema injection |
| `product/productSchema.js` | 222 | Product breadcrumbs, meta, Pinterest, alt text, category detection |

### HTTP Endpoints

| Endpoint | URL | Purpose |
|----------|-----|---------|
| `get_robots()` | `/_functions/robots` | Custom robots.txt with crawl rules, 24h cache |
| `get_productSitemap()` | `/_functions/productSitemap` | Product XML sitemap with lastmod/priority |
| `get_blogSitemap()` | `/_functions/blogSitemap` | Blog XML sitemap |

### JSON-LD Schema Types (8)

1. **Product** — offers, aggregateRating, reviews, brand, images, SKU, availability
2. **LocalBusiness/FurnitureStore** — address, phone, hours, geo-coordinates
3. **WebSite** — SearchAction (Google sitelinks searchbox)
4. **CollectionPage** — buying guides hub
5. **ItemList** — pillar guides, recommendations
6. **BreadcrumbList** — navigation trails
7. **FAQPage** — FAQ pages and product FAQs
8. **Article** — blog posts and buying guides

### Page Coverage

`initPageSeo()` called on **25+ pages** including: About, Accessibility, Assembly Guides,
Blog, Blog Post, Buying Guide, Buying Guides, Cart, Checkout, Compare, Contact, FAQ,
Financing, Getting It Home, Gift Cards, Home, Member Page, Newsletter, Order Tracking,
Price Match, Privacy Policy, Product Page, Referral, Refund Policy, Returns, Room Planner,
Sale, Search Results, Shipping Policy, Store Locator, Style Quiz, Sustainability,
Terms & Conditions, Thank You, UGC Gallery.

Only appropriate exceptions lack SEO init: Admin Returns, Side Cart, Search Suggestions Box
(UI components), masterPage (handles canonical globally), Category Page (has its own
comprehensive SEO implementation).

### Product Schema Details

- `aggregateRating` with `ratingValue` + `reviewCount`
- Individual `review` data
- Brand detection: Strata Furniture, KD Frames, Otis Bed, Arizona, Night & Day
- Out-of-stock products set to `robots:noindex`
- Pinterest Rich Pins with sale price support
- Google Shopping category mapping (furniture taxonomy IDs)

### Test Coverage: 2,675+ lines, 12+ test files

| File | Tests |
|------|-------|
| seoHelpers.test.js | 203 |
| seoContentHub.test.js | 63 |
| productSchema.test.js | 42 |
| pageSeo.test.js | 25 |
| pinterestRichPins.test.js | 30+ |
| + 6 integration test files | Various |

## Gaps Identified

1. **Social sharing verification** — OG tags are generated but not tested on actual
   platforms. Share a product URL in Facebook Debugger and Pinterest Rich Pin Validator
   to verify preview cards render correctly.
2. **og:image aspect ratio** — Should be 1.91:1 for optimal social sharing. Product
   images may not match this ratio. Worth verifying on a sample.
3. **ads.txt** — Available via Wix API but not implemented. Only needed if running
   Google AdSense or other ad networks. Low priority.
4. **Wix SEO Tags API (backend)** — `resolveItemSeoTags()` and `resolveStaticPageSeoTags()`
   exist in Wix SDK but are not used. Our custom implementation via `seoHelpers.web.js`
   is more comprehensive, so these aren't needed.

## Wix Platform vs Custom Code

| Feature | Platform (Automatic) | Our Custom Code |
|---------|---------------------|-----------------|
| Page title/meta | Basic defaults | Dynamic per-page type via `initPageSeo()` |
| OG tags | Basic defaults | Rich per-page with product data |
| Canonical URLs | Yes | Enhanced via masterPage.js |
| Product JSON-LD | Basic preset | Full with reviews, brand, gallery |
| Sitemap | Auto-generated | Custom product + blog sitemaps |
| robots.txt | Default | Custom with crawl rules |
| Pinterest | None | Full Rich Pin support |
| Google Shopping | None | Full merchant feed |

## Recommendation

**No new code work needed.** Action items for editor/dashboard:
1. Test social sharing by pasting product URLs into Facebook Debugger
2. Test Pinterest Rich Pin Validator
3. Verify og:image dimensions on sample product pages
4. (Optional) Implement ads.txt if ad network is configured
