# Story: Mobile Responsive Pass — Extend mobileHelpers to All Pages

**Author**: caesar
**Priority**: P1
**Status**: draft

## Problem

Only 5 of 21 pages (Home, Product, Category, Cart, masterPage) import `mobileHelpers.js`. The remaining 16 pages have no mobile-specific behaviors — no `initBackToTop`, no `collapseOnMobile`, no `limitForViewport`. Interactive pages like Member Page, Blog, FAQ, and Search Results serve the same data volume and layout on mobile as desktop.

## Approach

Add targeted mobile optimizations to pages that benefit most. Not every page needs every helper — policy pages just need `initBackToTop`, while data-heavy pages need `limitForViewport` and `collapseOnMobile`.

**Tier 1 — High-impact interactive pages:**
- Member Page: `collapseOnMobile` for order history/wishlist, `initBackToTop`
- Blog: `limitForViewport` for sidebar products, `initBackToTop`
- Thank You Page: `limitForViewport` for product suggestions, `initBackToTop`
- Search Results: `limitForViewport` for results grid, `initBackToTop`
- FAQ: `collapseOnMobile` for long answer sections, `initBackToTop`

**Tier 2 — Content pages:**
- Contact, About, Shipping Policy: `initBackToTop`
- Fullscreen Page: `limitForViewport` for video grid

**Tier 3 — Short/minimal pages (skip):**
- Privacy Policy, Refund Policy, Terms & Conditions, Accessibility Statement, Side Cart, Search Suggestions Box, Checkout — too short or already modal-based

## Acceptance Criteria

- [ ] Member Page uses collapseOnMobile + initBackToTop
- [ ] Blog uses limitForViewport + initBackToTop
- [ ] Thank You Page uses limitForViewport + initBackToTop
- [ ] Search Results uses limitForViewport + initBackToTop
- [ ] FAQ uses initBackToTop
- [ ] Contact, About, Shipping Policy use initBackToTop
- [ ] Fullscreen Page uses limitForViewport
- [ ] All tests pass
