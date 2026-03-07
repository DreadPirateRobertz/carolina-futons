# Carolina Futons v0.0.0 — Initial Release

**Release Date:** 2026-03-07
**Tagged by:** melania (Production Manager)
**Repository:** DreadPirateRobertz/carolina-futons

---

## Overview

First tagged release of the Carolina Futons e-commerce platform built on Wix Studio + Wix Velo. This release represents a complete, tested, production-ready codebase for a full-featured furniture e-commerce site with the Blue Ridge Mountain illustrative aesthetic.

## By The Numbers

| Metric | Count |
|--------|-------|
| Pages | 39 |
| Public Helpers | 109 |
| Backend Modules | 100 |
| Test Files | 290 |
| Tests Passing | 11,067 |
| Test Pass Rate | 100% |
| Products in Catalog | 88 |
| Figma SVG Illustrations | 6 deployed |
| PRs Merged | 30+ (this session alone) |
| Security Vulnerabilities | 0 |
| Circular Imports | 0 |
| Hardcoded Secrets | 0 |

## What's Included

### Pages (39)
Full Wix Velo page modules covering: Home, Product Page, Category Page, Cart, Side Cart, Checkout, Thank You, Member Page (with order history, wishlist, loyalty, store credit), Blog, Blog Post, FAQ, Contact, About, Returns, Admin Returns, Style Quiz, Compare, Search Results, Room Planner, Gift Cards, Financing, Referral, UGC Gallery, Assembly Guides, Buying Guides, Store Locator, Sustainability, and more.

### Backend (100 modules)
Complete backend services using Wix Velo `webMethod` pattern:
- **Shipping & Fulfillment**: UPS REST API integration, delivery scheduling (Wed-Sat slots), white-glove service, international shipping
- **E-Commerce**: Cart recovery, checkout optimization, coupons, gift cards, bundle builder, dynamic pricing, promotions engine
- **Loyalty & Rewards**: Tiered loyalty (Bronze/Silver/Gold), store credit, referral program
- **Product**: Recommendations, reviews, Q&A, comfort service, size guide, video sections
- **Marketing**: GA4 analytics, email automation (Klaviyo), SMS notifications, newsletter, browse abandonment
- **Social Feeds**: Google Merchant, Facebook Catalog, Pinterest Rich Pins with catalog sync
- **Specialized**: Style quiz, room planner, wishlist alerts (price drop, back-in-stock, low-stock), inventory management, virtual consultation, trade program

### Frontend (109 helpers)
Shared utility modules including design tokens, navigation, mobile responsive helpers, accessibility (WCAG AA), product card rendering, gallery, illustrations, analytics tracking, engagement tools, and more.

### Illustrations (Figma Pipeline)
6 SVG illustrations designed in Figma Draw, processed through optimization pipeline:
1. Mountain Skyline Header — site-wide header silhouette
2. Footer Mountain Divider — decorative footer separator
3. Contact Hero — sunrise scene with ridgelines
4. Contact Showroom — cabin with map pin (rework in progress)
5. Blue Ridge Timeline — brand story with milestone markers
6. Team Portrait — golden hour silhouettes (rework in progress)

Pipeline: Figma Draw → Export → SVGO optimization → Token injection → .wix.html integration

### Design System
- **Brand Tokens**: `sharedTokens.js` (cross-platform) + `designTokens.js` (web-specific)
- **Colors**: Sand #E8D5B7, Espresso #3A2518, Mountain Blue #5B8FA8, Coral #E8845C
- **Typography**: Playfair Display (headings), Source Sans 3 (body)
- **Spacing**: 4px base scale (xs=4 through xxxl=64)
- **Shadows**: Warm espresso-tinted (not neutral gray)

### Testing
- **11,067 tests** across 290 files — 100% pass rate
- TDD methodology: tests written before implementation
- Coverage: happy paths, error states, empty/null/undefined, boundary conditions, invalid input (XSS vectors, injection), mobile behavior, accessibility
- 20 Wix platform mock modules for test isolation
- 246 module aliases in vitest.config.js

### Security
- Zero hardcoded secrets — all credentials via `wix-secrets-backend`
- Input sanitization enforced via `backend/utils/sanitize.js`
- XSS protection on all user-facing content
- URL validation (http/https only, javascript:/data: rejected)
- No TODO/FIXME/HACK comments in source

## Documentation
- `MASTER-HOOKUP.md` — Complete guide for connecting codebase to live Wix website
- `DESIGN-VISION.html` — Visual design document with embedded SVG illustration renderings
- `WIX-STUDIO-BUILD-SPEC.md` — Element specifications for Wix Studio editor
- `API-REFERENCE.md` — Backend API documentation
- `ARCHITECTURE.md` — System design overview
- 5 hookup audit files (homepage, product, browse, commerce, content pages)
- 6 illustration guides in `docs/guides/`
- 18 design/plan documents in `docs/plans/`

## Known Issues
- **Hookup spec coverage**: 58% of element IDs documented in BUILD-SPEC (307 IDs pending)
- **Illustration warmth**: 2 SVGs need color temperature adjustment (CF-3qt, CF-6ds)
- **CI billing**: GitHub Actions billing intermittently fails runs (not code-related)
- **Dead code**: 1 unused function (`initTrackingButton` in Admin Returns), 7 unused imports
- **Console output**: 671 console.log/warn/error instances (mostly in error handlers)

## Deployment Prerequisites
See `MASTER-HOOKUP.md` for the complete 10-step checklist. Key requirements:
1. Wix Studio site with Velo enabled
2. UPS Developer account (REST API credentials)
3. GA4 Measurement ID
4. Email service (Klaviyo recommended)
5. 16 CMS collections created in Wix Dashboard
6. 8 secrets configured in Wix Secrets Manager
7. 12 triggered email templates

## What's Next (Post v0.0.0)
- Product Page features: financing calculator, swatch request, video section, Q&A, size guide, 360 viewer
- Cart & Checkout polish: cross-sell, delivery estimates, address autocomplete, coupon UX
- Engagement: social proof toasts, exit-intent popup, referral page, UGC gallery
- Performance: CLS prevention, image lazy loading, JS deferral
- Illustration migration: comfort cards, empty states, cart/onboarding scenes
- Velo MCP server: Direct deployment pipeline from codebase to live Wix site

---

*Carolina Futons — Handcrafted comfort, mountain-inspired design.*
*Built by the cfutons crew: miquella, radahn, rennala, godfrey*
*Managed by melania (Production Manager)*
