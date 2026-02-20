# Carolina Futons — Sprint Report

**Last Updated:** 2026-02-20 09:06 MST
**Sprint:** Full Stack Improvements (8-Hour Sprint)
**Status:** NEARING COMPLETION

---

## Overview

**372 tests passing** across **19 test files**. All major sprint items complete. Security audit committed. 6 new backend modules, 3 page updates, 3 feed endpoints, comprehensive documentation.

## Completed

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Security remediation | DONE | Sanitization utility, admin auth, rate limiting — 38 security tests |
| 2 | Test infrastructure fixes | DONE | 6 new Wix module mocks, vitest aliases, brand filter fix |
| 3 | Merge security to main | DONE | Rebased on remote, resolved conflicts, pushed |
| 4 | Loyalty program backend | DONE | `loyaltyService.web.js` — Bronze/Silver/Gold tiers, points, rewards (12 tests) |
| 5 | Marketing coupons backend | DONE | `couponsService.web.js` — Welcome, birthday, tier coupons (9 tests) |
| 6 | Abandoned cart recovery | DONE | `cartRecovery.web.js` — Event handlers, stats tracking (7 tests) |
| 7 | Delivery scheduling backend | DONE | `deliveryScheduling.web.js` — Slot-based Wed-Sat scheduling |
| 8 | Assembly guides backend | DONE | `assemblyGuides.web.js` — Per-SKU guides, category care tips |
| 9 | Gift card support | DONE | `giftCards.web.js` — Custom codes, balance, redemption |
| 10 | GA4 enhanced analytics | DONE | `analyticsHelpers.web.js` — ViewContent, AddToCart, Checkout, Purchase, Wishlist events |
| 11 | White-glove delivery tier | DONE | `shipping-rates-plugin.js` — $149 local, $249 regional, free over $1,999 |
| 12 | Facebook catalog feed | DONE | `http-functions.js` → `get_facebookCatalogFeed` (TSV format) |
| 13 | Pinterest product feed | DONE | `http-functions.js` → `get_pinterestProductFeed` (TSV format) |
| 14 | Open Graph / social meta | DONE | `seoHelpers.web.js` — OG, Pinterest Rich Pin, Twitter Card meta generators |
| 15 | Blog page | DONE | `Blog.js` — SEO schema, product sidebar, social share, newsletter |
| 16 | Wishlist sharing | DONE | `Member Page.js` — Share via copy link, Pinterest, Facebook, Email |
| 17 | Post-purchase care | DONE | `Thank You Page.js` — Care sequence enrollment, assembly guide links |
| 18 | Loyalty integration | DONE | `Member Page.js` — Live loyalty points + tier display |
| 19 | Plugin recommendations | DONE | `PLUGIN-RECOMMENDATIONS.md` — Must/Should/Nice-to-Have/Pure Velo |
| 20 | Social media strategy | DONE | `SOCIAL-MEDIA-STRATEGY.md` — Pinterest, Instagram, Facebook, TikTok playbook |
| 21 | Sprint report | DONE | `report_to_human.md` — This file |

## New Files Created This Sprint

| File | Type | Purpose |
|------|------|---------|
| `src/backend/loyaltyService.web.js` | Backend | Loyalty points, tiers, rewards |
| `src/backend/couponsService.web.js` | Backend | Marketing coupon generation |
| `src/backend/cartRecovery.web.js` | Backend | Abandoned cart event handlers |
| `src/backend/deliveryScheduling.web.js` | Backend | Delivery slot scheduling |
| `src/backend/assemblyGuides.web.js` | Backend | Assembly guides per SKU |
| `src/backend/giftCards.web.js` | Backend | Custom gift card system |
| `src/pages/Blog.js` | Page | Blog page enhancements |
| `tests/loyaltyService.test.js` | Test | 12 tests |
| `tests/couponsService.test.js` | Test | 9 tests |
| `tests/cartRecovery.test.js` | Test | 7 tests |
| `tests/__mocks__/wix-loyalty.v2.js` | Mock | Loyalty API mock |
| `tests/__mocks__/wix-marketing-backend.js` | Mock | Coupons API mock |
| `PLUGIN-RECOMMENDATIONS.md` | Doc | App Market plugin guide |
| `SOCIAL-MEDIA-STRATEGY.md` | Doc | Multi-platform social playbook |

## Updated Files This Sprint

| File | Changes |
|------|---------|
| `src/backend/analyticsHelpers.web.js` | Added 5 GA4 event builder functions |
| `src/backend/shipping-rates-plugin.js` | Added white-glove delivery tier |
| `src/backend/http-functions.js` | Added Facebook + Pinterest feed endpoints |
| `src/backend/seoHelpers.web.js` | Added OG, Rich Pin, Twitter Card meta |
| `src/pages/Member Page.js` | Wishlist sharing (4 channels), loyalty points display |
| `src/pages/Thank You Page.js` | Post-purchase care sequence, assembly guide link |
| `vitest.config.js` | New aliases for added modules |
| `tests/setup.js` | New mock resets |

## New CMS Collections Needed

| Collection | Purpose | Created By |
|------------|---------|------------|
| `ProductAnalytics` | View/cart/purchase counts | analyticsHelpers.web |
| `AbandonedCarts` | Abandoned checkout tracking | cartRecovery.web |
| `DeliverySchedule` | Scheduled delivery slots | deliveryScheduling.web |
| `AssemblyGuides` | Per-SKU assembly PDFs/videos | assemblyGuides.web |
| `GiftCards` | Gift card codes and balances | giftCards.web |
| `MemberPreferences` | Newsletter/alert preferences | Member Page |

## Feed Endpoints Ready to Connect

| Endpoint | Configure In | URL |
|----------|-------------|-----|
| `/_functions/googleShoppingFeed` | Google Merchant Center | Already built (previous sprint) |
| `/_functions/facebookCatalogFeed` | Facebook Commerce Manager → Catalogs | New |
| `/_functions/pinterestProductFeed` | Pinterest Business → Catalogs | New |
| `/_functions/productSitemap` | Google Search Console | Already built |

## Test Suite Summary

- **19 test files**, **372 tests passing**
- New tests: loyaltyService (12), couponsService (9), cartRecovery (7)
- All existing tests remain green

## Blockers

None. All items requiring Wix Dashboard access noted below.

## Requires Wix Dashboard Setup

These items are code-complete but need Dashboard configuration:
1. **CMS collections** — Create the 6 new collections listed above
2. **Feed connections** — Configure Facebook/Pinterest catalog data sources
3. **Pinterest Rich Pins** — Validate at developers.pinterest.com
4. **TikTok Pixel** — Add custom embed code via Wix Dashboard
5. **Loyalty program** — Enable in Wix Dashboard → Loyalty
6. **Wix Automations** — Configure email triggers for care sequence (Day 3, 7, 30)

---

*Report by Mayor. All code committed and pushed to `main` branch.*
