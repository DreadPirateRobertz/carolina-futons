# Story: Social Feed & OG Meta Audit

**Author**: caesar
**Priority**: P1
**Status**: complete

## Problem

Three critical bugs found during social/marketing code audit:

1. **Facebook + Pinterest feeds output broken image URLs** — `http-functions.js` passes `p.mainMedia` directly to feeds, but Wix products may use `wix:image://v1/...` format. This makes both feeds useless for commerce platforms that need HTTPS image URLs. The Google feed correctly converts these (see `googleMerchantFeed.web.js:121-123`).

2. **Category meta tags output `[object Promise]` as description** — `getCategoryMetaTags` in `seoHelpers.web.js:652` calls the webMethod `getCategoryMetaDescription` (returns Promise) instead of `getCategoryMetaDescriptionSync`. Every category page's OG/Twitter description is broken.

3. **Product schema says all shipping is free** — `seoHelpers.web.js` hardcodes `shippingRate.value: 0` but free shipping threshold is $999. Google may penalize for misleading structured data.

Additional improvements:
4. Sitemap missing Wall Huggers, Unfinished Wood, and Blog static pages
5. Pinterest feed has non-standard `og:price:amount` tag (should be `product:price:amount` only)
6. Facebook feed missing `content_type` column (required by Meta)

## Approach

- Extract `wixImageToUrl()` helper from googleMerchantFeed.web.js into a shared utility
- Apply it to Facebook and Pinterest feed image outputs
- Fix getCategoryMetaTags to use sync version
- Conditional shipping rate in product schema based on price
- Add missing sitemap pages
- Fix Pinterest tag, add Facebook content_type

## Acceptance Criteria

- [ ] Facebook feed outputs HTTPS image URLs (not wix:image://)
- [ ] Pinterest feed outputs HTTPS image URLs
- [ ] Category page OG description is real text (not `[object Promise]`)
- [ ] Product schema shipping rate is conditional on price >= $999
- [ ] Sitemap includes all category pages
- [ ] All 479+ tests pass
- [ ] Commit and push to main
