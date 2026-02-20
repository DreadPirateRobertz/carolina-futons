# STORY-009 Mobile App Strategy for Carolina Futons

## Problem
Carolina Futons has no dedicated mobile app experience. The Wix site is responsive but not optimized for mobile-first shopping patterns (touch gestures, offline browsing, push notifications, app-store presence). Furniture is a high-consideration purchase — customers browse on mobile, compare options over days, then buy. A mobile strategy should support this browsing-to-buying journey.

## Options Evaluated

### Option A: Wix Branded App (Lowest Effort)
- **What**: Wix's native app wrapper around the existing site
- **Pros**: Zero development effort, automatic sync with site changes, built-in push notifications, app store presence
- **Cons**: Limited customization, generic UX, $50/mo Wix plan upgrade, no offline support, poor performance for image-heavy catalog
- **Effort**: 1-2 days setup
- **Cost**: ~$600/year (Wix Business plan)

### Option B: PWA — Progressive Web App (Recommended)
- **What**: Add service worker, web manifest, and offline caching to existing Wix site
- **Pros**: Works within existing Wix Velo codebase, installable on home screen, offline product browsing, fast load times via caching, no app store fees, push notifications via Web Push API, shares codebase with desktop site
- **Cons**: No app store presence (discoverable via "Add to Home Screen"), iOS has limited PWA support (no push on older iOS), Wix Velo service worker support requires custom http-functions
- **Effort**: 2-3 weeks
- **Cost**: $0 additional (uses existing infrastructure)

### Option C: React Native App (Most Effort)
- **What**: Custom native app with its own codebase
- **Pros**: Full control over UX, native performance, app store presence, offline-first architecture, push notifications
- **Cons**: Separate codebase to maintain, duplicates all backend logic (or needs API layer), requires app store accounts ($99/year Apple + $25 Google), ongoing maintenance burden for a small team, 2-3 month build time
- **Effort**: 2-3 months
- **Cost**: $124/year store fees + significant dev time

## Recommendation: Option B (PWA)

For a small furniture store, PWA is the right balance of effort, cost, and user value:

1. **No duplicate codebase** — enhances existing Wix site, doesn't replace it
2. **Offline catalog browsing** — cache product pages, images, and swatch data for browsing without connectivity
3. **Home screen install** — "Add to Home Screen" prompt gives app-like experience
4. **Push notifications** — via Web Push API for cart recovery, sale alerts, delivery updates
5. **Fast repeat visits** — service worker caches static assets and API responses
6. **Zero app store friction** — customers don't need to find/download an app

## Acceptance Criteria (Phase 1 — Foundation)
- [ ] `src/backend/http-functions.js` — add `get_manifest()` endpoint returning web app manifest JSON
- [ ] `src/backend/http-functions.js` — add `get_serviceWorker()` endpoint returning service worker JS
- [ ] Web manifest includes: name, short_name, icons (192px + 512px), theme_color, start_url, display: standalone
- [ ] Service worker implements: install (cache shell), activate (clean old caches), fetch (cache-first for static, network-first for API)
- [ ] Offline fallback page for when network is unavailable
- [ ] `masterPage.js` — register service worker on page load
- [ ] Add "Install App" prompt banner for mobile users (beforeinstallprompt event)
- [ ] Tests for manifest endpoint and service worker registration

## Phase 2 (Future Stories)
- Offline product catalog with IndexedDB caching
- Push notification subscription and delivery update alerts
- Touch-optimized image gallery with swipe gestures
- Mobile-specific swatch comparison view
- Cart persistence across offline/online transitions

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|-------------|
| `src/backend/http-functions.js` | MODIFY | Add get_manifest(), get_serviceWorker() endpoints |
| `src/pages/masterPage.js` | MODIFY | Register service worker, install prompt |
| `src/public/pwaHelpers.js` | CREATE | Install prompt logic, registration helper |
| `tests/pwa.test.js` | CREATE | Tests for manifest, SW registration |

## Estimate
- Size: L (Phase 1: 1-2 weeks)
- Priority: P1
- Dependencies: none
