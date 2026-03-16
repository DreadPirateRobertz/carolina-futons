# CF-38cl SPIKE: Pricing Plans

**Date**: 2026-03-16
**Author**: miquella
**Status**: Complete

## Executive Summary

Custom subscription and pricing infrastructure is **already built** — no Wix Pricing Plans API used.
The system implements recurring delivery subscriptions, fabric customization pricing, tiered
subscriber discounts, and order tracking with UPS integration.

## Existing Code Inventory

### Backend Services (~1,300 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `subscriptionService.web.js` | 497 | 10 exports: CRUD subscriptions, frequency management, pause/resume/skip/cancel, tiered discounts (10%/15%) |
| `customizationService.web.js` | 195 | 5 exports: fabric swatch pricing, tiered surcharges (standard/premium/luxury), saved configurations |
| `orderTracking.web.js` | 318 | 4 exports: order lookup, UPS tracking timeline, shipping notifications |
| `newsletterService.web.js` | 293 | 4 exports: newsletter subscription, ESP sync (Klaviyo/Mailchimp) |

### Key Features
- **4 subscription frequencies**: weekly (7d), biweekly (14d), monthly (30d), quarterly (90d)
- **Tiered discounts**: 10% base, 15% for 3+ active subscriptions
- **Fabric pricing**: percent-based or flat-rate surcharges per tier
- **UPS integration**: Real-time tracking with visual timeline
- **Max skip protection**: 3 consecutive skips, max 10 quantity per delivery

### Test Coverage: 317 tests, 3,814 lines

| Test File | Tests | Lines |
|-----------|-------|-------|
| subscriptionService.test.js | 64 | 649 |
| orderTracking.test.js | 60 | 599 |
| orderTrackingPage.test.js | 64 | 918 |
| newsletterService.test.js | 54 | 546 |
| customizationService.test.js | 28 | 347 |
| customizationBuilder.test.js | 47 | 755 |

## Gaps
- No Wix native Pricing Plans API integration (custom CMS approach instead)
- Dashboard configuration needed for subscription management UI

## Recommendation
**No new code work needed.** Custom subscription system is comprehensive.
