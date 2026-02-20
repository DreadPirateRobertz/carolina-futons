# STORY-011 PWA Phase 2: Offline Catalog, Push Notifications, Touch UX

## Summary
Phase 2 of the PWA strategy builds on the manifest-only foundation (Phase 1) with features that work within Wix Velo's constraints. Since service worker registration is unreliable on Wix (see STORY-010), we focus on features that DON'T require a SW: localStorage catalog caching, third-party push notifications, and touch-optimized UX patterns.

## Features

### Feature A: Local Product Catalog Cache (No SW Required)
Cache recently viewed products in `localStorage` or `sessionStorage` for instant re-display. When the user navigates back to a previously viewed product, show cached data immediately while fetching fresh data in the background (stale-while-revalidate pattern in application code).

**Implementation:**
- `src/public/productCache.js` — `cacheProduct(product)`, `getCachedProduct(slug)`, `getRecentlyViewed(limit)`
- Product Page.js calls `cacheProduct()` on load, `getCachedProduct()` for instant render
- Category Page shows "Recently Viewed" section from cache
- Max 20 products cached, LRU eviction, 24-hour TTL

### Feature B: Push Notifications via Third-Party Service
Use Pushpad or OneSignal for browser push notifications. These services handle SW registration on their own domain, avoiding Wix SW limitations entirely.

**Use cases:**
- Cart recovery reminders (1 hour after abandonment)
- Sale/promotion alerts
- Back-in-stock notifications
- Delivery status updates

**Implementation:**
- Embed third-party SDK via Wix custom code
- `src/public/pushHelpers.js` — wrapper around third-party SDK
- Backend triggers via `src/backend/pushNotifications.web.js`

### Feature C: Touch-Optimized Product Gallery
Swipe gestures for product image gallery, pinch-to-zoom on product images, pull-to-refresh on category pages. All using standard touch events (no SW needed).

**Implementation:**
- `src/public/touchHelpers.js` — `enableSwipe(element, onSwipe)`, `enablePinchZoom(element)`
- Product Page gallery: swipe left/right between images
- Category Page: swipe between filter tabs

### Feature D: Mobile Install Banner
Custom "Add to Home Screen" banner for mobile users, shown after 2+ page views. Uses the `beforeinstallprompt` event already captured by `pwaHelpers.js`.

**Implementation:**
- Show banner in masterPage.js after sessionStorage tracks 2+ page views
- Dismissable, doesn't reappear for 7 days (stored in localStorage)
- Design matches site theme (green, clean, minimal)

## Acceptance Criteria
- [ ] `src/public/productCache.js` created with cache/get/recently-viewed functions
- [ ] `tests/productCache.test.js` with 8-10 tests
- [ ] Product Page.js caches product data on view
- [ ] Category Page shows "Recently Viewed" section (max 4 products)
- [ ] `src/public/touchHelpers.js` with swipe and pinch-zoom handlers
- [ ] `tests/touchHelpers.test.js` with 5-6 tests
- [ ] Mobile install banner logic in masterPage.js
- [ ] All existing tests still pass

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|-------------|
| `src/public/productCache.js` | CREATE | localStorage product cache with LRU + TTL |
| `tests/productCache.test.js` | CREATE | 8-10 tests for cache operations |
| `src/public/touchHelpers.js` | CREATE | Swipe, pinch-zoom touch event handlers |
| `tests/touchHelpers.test.js` | CREATE | 5-6 tests for touch helpers |
| `src/pages/Product Page.js` | MODIFY | Cache product on view |
| `src/pages/Category Page.js` | MODIFY | Show recently viewed section |
| `src/pages/masterPage.js` | MODIFY | Install banner after 2+ views |

## Technical Notes
- `localStorage` has 5-10MB limit per origin — sufficient for 20 product objects (~5KB each)
- Touch events work in all modern mobile browsers natively
- Push notification service selection (Pushpad vs OneSignal) deferred to separate story
- Feature B (push notifications) depends on third-party service account setup — may be P2
- `wix-storage-frontend` mock already exists for localStorage testing

## Estimate
- Size: L (Features A + C + D: 1-2 weeks; Feature B: separate story)
- Priority: P1
- Dependencies: STORY-009 Phase 1 (done), STORY-010 (pivot decision)
