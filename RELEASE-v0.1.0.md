# Carolina Futons v0.1.0

**Release Date:** 2026-03-08
**Tagged by:** melania (Production Manager)
**Repository:** DreadPirateRobertz/carolina-futons
**Production Repo:** DreadPirateRobertz/carolina_futons_velO

---

## Overview

Second release of the Carolina Futons e-commerce platform. Builds on v0.0.0 with SEO infrastructure, performance optimizations, accessibility compliance, and e-commerce UX improvements. Full velO sync — all 251 source files at this release.

## By The Numbers

| Metric | Count | Delta from v0.0.0 |
|--------|-------|--------------------|
| Pages | 39 | — |
| Public Helpers | 113 | +4 |
| Backend Modules | 100 | — |
| Test Files | 299 | +9 |
| Tests Passing | 11,482 | +415 |
| Test Pass Rate | 100% | — |
| Source Files | 252 | +1 |
| PRs Merged | 45+ | +15 |
| Security Vulnerabilities | 0 | — |

## What's New in v0.1.0

### SEO Infrastructure (CF-cf8)
- `pageSeo.js` helper wired to 32 pages with canonical URLs, Open Graph, Twitter Cards
- 6 new page types: buyingGuide, buyingGuides, assemblyGuides, giftCards, financing, newsletter
- Proper meta tag management for all page routes

### Performance (CF-by4, CF-2np, CF-7zl)
- **Category Page**: Filter debounce (300ms) and grid batching prevent UI jank
- **Product Page**: CLS prevention with explicit image dimensions, responsive srcset
- **Product Page**: Non-critical tracking JS deferred (GA4, engagement tracker)
- **Home Page**: Below-fold image lazy loading

### Accessibility (CF-8e5)
- CTA color contrast audit — all interactive elements now WCAG AA compliant
- Cart ARIA live regions improved with real assertions (CF-xe8a)

### E-Commerce UX
- **Cart coupon code input** (CF-cbw): validation, error states, loading feedback
- **Cart delivery estimates** (CF-85c): estimated delivery date display
- **Checkout autofill** (CF-xmv): browser autofill hints on address fields
- **Gift card flow** (CF-ic6o): email delivery, checkout integration, member dashboard
- **Exit-intent popup** (CF-h18h): mobile bottom sheet variant, scoped listeners
- **Financing calculator** (CF-nomi): migrated to financingCalc.web with Afterpay
- **Size guide modal** (CF-u0ko): lazy-loaded components
- **Q&A search** (CF-6t4z): product Q&A section search functionality
- **Social proof toasts** (CF-vnk2): review count notifications
- **UGC gallery** (CF-gfbz): backend-to-frontend field mapping

### Testing & CI
- Full test suite reorganization (CF-3mkd): consistent paths, no relative imports
- Vitest coverage thresholds configured (CF-2f4)
- E2E verification of all 5 Velo MCP tools (CF-cloc)
- Cart ARIA test quality — tautological tests replaced with real assertions (CF-xe8a)

### Velo MCP Server
- All 5 tools merged and tested: velo_status, velo_sync, velo_diff, velo_preview, velo_publish
- MCP server wired, README complete
- Separate repo: DreadPirateRobertz/wix-velo-mcp

## Known Issues
- **Hookup spec coverage**: 58% of element IDs documented in BUILD-SPEC (307 IDs pending)
- **Illustration warmth**: 2 SVGs need color temperature adjustment (CF-3qt, CF-6ds)
- **CI billing**: GitHub Actions billing intermittently fails runs (not code-related)
- **Dead code**: 1 unused function (`initTrackingButton` in Admin Returns), 7 unused imports
- **Wix dev**: Token renewal blocked — overseer working on fix

## What's Next (Post v0.1.0)
- Open PR reviews: #231 (alt text), #233 (SSR tests), #234 (test paths)
- Illustration migration: comfort cards, empty states, cart/onboarding scenes
- Figma Draw pipeline: full migration from programmatic SVG
- Wix Studio hookup: connect codebase to live site
- Marketing launch: paid acquisition, organic SEO, conversion optimization

---

*Carolina Futons — Handcrafted comfort, mountain-inspired design.*
*Built by the cfutons crew: miquella, radahn, rennala, godfrey*
*Managed by melania (Production Manager)*
