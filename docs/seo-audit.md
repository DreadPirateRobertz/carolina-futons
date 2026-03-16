# SEO Structured Data Audit — CF-qocr

**Date:** 2026-03-16
**Auditor:** rennala (crew)
**Scope:** All JSON-LD schemas (Product, LocalBusiness, Blog Article, BreadcrumbList, FAQ) vs catalog-MASTER.json

---

## Summary

Audited 10 source files across backend/public layers. Found **3 bugs**, all fixed in place. All 9 catalog categories now have complete coverage across every category-aware function.

## Bugs Found & Fixed

### 1. Blog Canonical URL Mismatch (CRITICAL)

**File:** `src/backend/seoHelpers.web.js` ~line 1066
**Issue:** `getCanonicalUrl('blogPost', slug)` produced `/post/${slug}` but `getBlogArticleSchema` set `mainEntityOfPage` to `/blog/${slug}`. Google would see two different canonical signals for blog posts.
**Fix:** Changed canonical path from `/post/` to `/blog/` to match the article schema and actual Wix blog routes.

### 2. Product Price Falsy-Zero Edge Case (MODERATE)

**File:** `src/backend/seoHelpers.web.js` ~line 88
**Issue:** `offers.price` used `product.discountedPrice || product.price` — if `discountedPrice` is `0` (free item / 100% discount), the `||` operator treats `0` as falsy and falls back to full price. Google would index the wrong price.
**Fix:** Changed to `product.discountedPrice != null ? product.discountedPrice : product.price` to correctly handle zero prices.

### 3. Missing Catalog Categories in SEO Functions (MODERATE)

**Files:** `src/backend/seoHelpers.web.js`, `src/public/product/productSchema.js`
**Issue:** catalog-MASTER.json has 9 categories but several SEO functions only mapped 5-6. Missing categories: `covers`, `outdoor-furniture`, `pillows-702`, `log-frames`. Products in these categories would get generic fallback labels instead of keyword-rich category text.
**Functions updated:**
- `getCategoryLabel()` — added 4 categories
- `getCategoryMetaDescription()` — added 4 entries
- `getCategoryMetaDescriptionSync()` — added 4 entries
- `CATEGORY_TITLES` map — added 4 entries
- `getCategoryOgTags()` titles — added 4 entries
- `detectProductCategory()` (productSchema.js) — added 4 categories
- `getCategoryFromCollections()` (productSchema.js) — added 4 entries with correct URL paths

## Schemas Verified Correct (No Changes Needed)

| Schema | File | Status |
|--------|------|--------|
| Product (JSON-LD) | seoHelpers.web.js `getProductSchema` | Correct — all required fields present, proper AggregateRating/Offer structure |
| LocalBusiness / FurnitureStore | seoHelpers.web.js `getBusinessSchema` | Correct — address, hours, geo coords match business data |
| WebSite | seoHelpers.web.js `getWebSiteSchema` | Correct — SearchAction with proper potentialAction |
| BreadcrumbList | seoHelpers.web.js `getBreadcrumbSchema` | Correct — 3-level hierarchy, proper ListItem structure |
| FAQPage | seoHelpers.web.js `getFaqSchema` / `getProductFaqSchema` | Correct — Question/Answer pairs properly formed |
| Blog Article | seoHelpers.web.js `getBlogArticleSchema` | Correct — author, datePublished, image, mainEntityOfPage |
| Blog FAQ | seoHelpers.web.js `getBlogFaqSchema` | Correct |
| Collection/Category | seoHelpers.web.js `getCollectionSchema` | Correct |
| Pinterest Rich Pins | pinterestRichPins.web.js | Correct — product:price, og:type, availability mapping |

## Files Audited

- `src/backend/seoHelpers.web.js` — central SEO module (3 fixes)
- `src/public/product/productSchema.js` — product schema injection (2 function updates)
- `src/public/localBusinessSeo.js` — LocalBusiness delegation (clean)
- `src/public/faqSeo.js` — FAQ schema injection (clean)
- `src/public/faqHelpers.js` — 20 FAQs, 5 categories (clean)
- `src/public/pageSeo.js` — shared page SEO utilities (clean)
- `src/backend/blogContent.js` — blog post data (clean)
- `src/backend/pinterestRichPins.web.js` — Pinterest meta (clean)
- `content/catalog-MASTER.json` — 88 products, 9 categories (reference)
- `tests/seoHelpers*.test.js` — 2 test assertions updated for blog URL fix

## Test Impact

- Updated 2 test assertions in `tests/seoHelpers.test.js` and `tests/seoHelpersDeep.test.js`
- All 23,367 tests pass (551 test files)
