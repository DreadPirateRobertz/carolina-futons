# Mobile Drawer + Hamburger Menu Audit — cf-9big
**Date:** 2026-05-24  
**Auditor:** rennala  
**Viewport:** 390px (iPhone 14 Pro equivalent)  
**Code reference:** `src/public/navigationHelpers.js#initMobileDrawer`

---

## Audit Criteria (Stilgar mandate)

| Item | Status | Notes |
|------|--------|-------|
| Slide-in animation smoothness + duration | ✅ FIXED | Was `fade` on open; corrected to `slide left` 250ms (transitions.medium) |
| Backdrop opacity timing | ✅ OK | `#mobileMenuOverlay` fade animation on backdrop |
| Focus-trap behavior | ✅ OK | `createFocusTrap` called with close + search + nav IDs |
| Esc-to-close | ✅ OK | `addEscHandler` + `removeEscHandler` scoped to drawer lifecycle |
| Nav-item tap target ≥44px | ⚠️ UNVERIFIED | Not enforced in JS — CSS responsibility; follow-on filed (cf-374s) |
| Active-route indicator | ✅ FIXED | Color change already existed; `aria-current="page"` added in this PR |
| Submenu accordion transitions | ✅ OK | `initMobileAccordions` uses Wix `expand()`/`collapse()` with ARIA |
| Drawer close button affordance | ✅ OK | `#mobileMenuClose` wired via `makeClickable` with `ariaLabel` |

---

## Bug Fixes (this PR)

### 1. Open animation inconsistency — FIXED
**File:** `src/public/navigationHelpers.js:244`  
**Before:** `$w('#mobileMenuOverlay').show('fade', { duration: 250 })`  
**After:** `$w('#mobileMenuOverlay').show('slide', { direction: 'left', duration: 250 })`  
**Why:** Close was already `hide('slide', { direction: 'left' })`. Fade-in → slide-out creates jarring asymmetric motion. Both directions are now slide-left for a consistent drawer feel.

### 2. Missing `aria-current="page"` on active mobile nav link — FIXED
**File:** `src/public/navigationHelpers.js:324`  
**Before:** Only color change (`sunsetCoral`) for active link.  
**After:** Also sets `el.accessibility.ariaCurrent = 'page'` so screen readers announce the current page.  
**Standard:** WCAG 2.4.3, ARIA Authoring Practices Guide (navigation landmark, current page).

---

## Follow-on Beads Filed

| ID | Title | Priority |
|----|-------|----------|
| cf-gkb3 | mobile drawer: add swipe-to-close gesture (swipe left to dismiss) | P3 |
| cf-i1gy | mobile drawer: missing nav items (Blog, Product Videos, Free Swatches, Gift Cards) | P3 |
| cf-374s | mobile drawer: enforce 44px min tap targets on nav items (WCAG 2.5.5) | P4 |

**Note on cf-wkg1:** Style Quiz + Getting It Home are already tracked in cf-wkg1 — cf-i1gy does NOT include those items to avoid duplication.

---

## Additional Observations (not fixed in this PR)

### Backdrop onClick bubbling risk
`$w('#mobileMenuOverlay').onClick(() => close())` is attached to the overlay container that wraps all nav items. In Wix Velo, child element clicks may bubble to the parent — nav item taps could trigger both the nav item's own handler AND the overlay close. This is speculative (Wix event bubbling model is underdocumented) but worth monitoring on device. Not filed as a separate bead — low confidence without live testing.

### Animation duration
`transitions.medium` = 250ms. Standard iOS drawer animations are 300–350ms. At 390px viewport, 250ms is perceptible but not painful. No change made — existing token value is a design system decision.

### MOBILE_NAV_MAP coverage
Currently maps 10 items. NAV_LINKS has 15. Missing from mobile drawer:
- `#navBlog` → `/blog` (cf-i1gy)
- `#navProductVideos` → `/product-videos` (cf-i1gy)
- `#navFreeSwatches` → `/free-swatches` (cf-i1gy)
- `#navGiftCards` → `/gift-cards` (cf-i1gy)
- `#navGettingItHome` → `/getting-it-home` (cf-wkg1)
- `#navStyleQuiz` → `/style-quiz` (cf-wkg1)

---

## Test Coverage
Two new tests added to `tests/navigationHelpers.test.js`:
1. `open uses slide animation, not fade` — verifies `show('slide', { direction: 'left' })`
2. `active mobile nav link gets ariaCurrent="page"` — verifies ARIA attribute on active link
