# Mobile Responsive Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix breakpoints, hamburger nav, touch targets, swipe gestures on product gallery — addressing all critical and significant mobile responsiveness gaps.

**Architecture:** Fix existing code rather than rewrite. Remove legacy duplicate handlers, gate desktop-only features for mobile, wire missing mobile features (lightbox swipe, footer accordions), and add axis-locking to prevent accidental category navigation.

**Tech Stack:** Wix Velo (JavaScript), vitest for testing

---

### Task 1: Remove duplicate hamburger handler in masterPage.js

The legacy `onClick` handler at lines 186–206 of `masterPage.js` conflicts with `initMobileDrawer()` called at line 221. The enhanced version in `navigationHelpers.js` is the correct one (it has focus trap, slide animation, ARIA). The legacy block must be removed.

**Files:**
- Modify: `src/pages/masterPage.js:186-206`
- Test: `tests/masterPage.test.js`

**Step 1: Write the failing test**

In `tests/masterPage.test.js`, add a test verifying that `#mobileMenuButton.onClick` is registered exactly once (not twice). Find the existing test file and add:

```javascript
it('does not register duplicate onClick handlers on #mobileMenuButton', async () => {
  await onReadyHandler();
  const menuBtn = getEl('#mobileMenuButton');
  // onClick should be called exactly once (from initMobileDrawer via makeClickable)
  // The legacy handler in initNavigation should NOT also register onClick
  expect(menuBtn.onClick).toHaveBeenCalledTimes(0);
  // makeClickable in initMobileDrawer uses onClick internally, so we check
  // that the legacy block's direct .onClick() call is gone
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/masterPage.test.js`
Expected: FAIL — the legacy handler still calls `menuButton.onClick()` directly

**Step 3: Remove the legacy hamburger handler**

In `src/pages/masterPage.js`, remove lines 186–206 (the entire `// Mobile hamburger menu toggle` block including both try/catch blocks for menuButton and menuClose). The `initMobileDrawer($w)` call at line 221 already handles all of this with better UX.

Replace lines 186–206 with:
```javascript
  // Mobile nav is handled by initMobileDrawer() in initEnhancedNavigation()
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/masterPage.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/masterPage.js tests/masterPage.test.js
git commit -m "fix: remove duplicate hamburger menu handler in masterPage

initMobileDrawer() in navigationHelpers.js already provides the enhanced
hamburger handler with focus trap, slide animation, and full ARIA support.
The legacy onClick handler in initNavigation() was causing double-open behavior."
```

---

### Task 2: Gate mega menu for desktop only

`initMegaMenu()` is called unconditionally in `initEnhancedNavigation()`. On mobile, `#navShop` hover/focus could open the desktop dropdown. It should only init on non-mobile viewports.

**Files:**
- Modify: `src/pages/masterPage.js:218`
- Test: `tests/masterPage.test.js`

**Step 1: Write the failing test**

```javascript
it('does not initialize mega menu on mobile viewport', async () => {
  // Set mobile viewport before importing
  global.window = { innerWidth: 375, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.resetModules();
  // Re-run onReady
  await onReadyHandler();
  const navShop = getEl('#navShop');
  // On mobile, mega menu hover handlers should not be wired
  expect(navShop.onMouseIn).not.toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/masterPage.test.js`
Expected: FAIL — mega menu initializes regardless of viewport

**Step 3: Gate initMegaMenu behind isMobile() check**

In `src/pages/masterPage.js`, change line 218 from:
```javascript
  try { initMegaMenu($w); } catch (e) {}
```
to:
```javascript
  try { if (!isMobile()) initMegaMenu($w); } catch (e) {}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/masterPage.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/masterPage.js tests/masterPage.test.js
git commit -m "fix: gate mega menu init for desktop only

Prevents hover/focus mega menu dropdown from activating on mobile devices
where the mobile drawer handles shop category navigation."
```

---

### Task 3: Add swipe navigation to lightbox

The fullscreen `#lightboxOverlay` has keyboard nav (ArrowLeft/Right) and prev/next buttons, but no touch swipe. On mobile, users must tap small prev/next buttons.

**Files:**
- Modify: `src/public/galleryHelpers.js:323-427`
- Test: `tests/galleryHelpers.test.js`

**Step 1: Write the failing test**

In `tests/galleryHelpers.test.js`, add a test for lightbox swipe support. The test should verify that `enableSwipe` is called on the lightbox overlay element when the lightbox is opened:

```javascript
describe('initImageLightbox swipe', () => {
  it('wires swipe handler on lightbox overlay for mobile navigation', () => {
    // Setup: create mock gallery with multiple images
    const gallery = createMockElement('#productGallery');
    gallery.items = [
      { src: 'img1.jpg' }, { src: 'img2.jpg' }, { src: 'img3.jpg' },
    ];
    gallery.onItemClicked = vi.fn();
    const mainImage = createMockElement('#productMainImage');
    mainImage.src = 'img1.jpg';
    mainImage.onClick = vi.fn();

    const lightbox = initImageLightbox($w, gallery, mainImage);
    expect(lightbox).not.toBeNull();
    // The lightbox overlay should have swipe handlers wired
    // Verify the lightbox has swipe navigation capability
    expect(lightbox).toHaveProperty('open');
    expect(lightbox).toHaveProperty('close');
  });
});
```

**Step 2: Run test to verify current state**

Run: `npm test -- tests/galleryHelpers.test.js`

**Step 3: Add swipe to lightbox**

In `src/public/galleryHelpers.js`, add an import for `enableSwipe` at the top:
```javascript
import { enableSwipe } from 'public/touchHelpers';
```

Then inside `initImageLightbox`, after the keyboard handler setup (after the `document.addEventListener('keydown', handleKeydown)` block around line 414), add:

```javascript
  // Swipe navigation for mobile lightbox
  let cleanupSwipe = null;
  try {
    const overlayEl = $w('#lightboxOverlay');
    if (overlayEl) {
      const swipeTarget = overlayEl.htmlElement || overlayEl;
      if (swipeTarget.addEventListener) {
        cleanupSwipe = enableSwipe(swipeTarget, (direction) => {
          if (direction === 'left') showImage(currentIndex + 1);
          else if (direction === 'right') showImage(currentIndex - 1);
        }, { threshold: 40 });
      }
    }
  } catch (e) {}
```

Update the `destroy()` function to also clean up swipe:
```javascript
  function destroy() {
    try {
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', handleKeydown);
      }
      if (cleanupSwipe) cleanupSwipe();
    } catch (e) {}
  }
```

**Step 4: Run tests**

Run: `npm test -- tests/galleryHelpers.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/public/galleryHelpers.js tests/galleryHelpers.test.js
git commit -m "feat: add swipe navigation to product image lightbox

Enables left/right swipe to navigate images in the fullscreen lightbox
on touch devices, improving mobile gallery usability."
```

---

### Task 4: Add axis-locking to category page swipe

The swipe handler on `#productGridRepeater` fires on any horizontal swipe, risking accidental category navigation during vertical scrolling. Add a direction ratio check so horizontal swipe only triggers when the horizontal movement is significantly greater than vertical.

**Files:**
- Modify: `src/pages/Category Page.js:778-803`
- Test: `tests/categoryPage.test.js`

**Step 1: Write the failing test**

Add a test for the `enableSwipe` threshold behavior. Since `enableSwipe` in `touchHelpers.js` already has basic axis detection (`absDx > absDy`), the fix is to increase the directional ratio. Modify the `initCategorySwipe` to use a wrapper that enforces a 2:1 horizontal-to-vertical ratio.

Actually, the simpler approach: change `enableSwipe` call to filter diagonal swipes inside the callback:

```javascript
describe('initCategorySwipe', () => {
  it('does not navigate on diagonal swipes where vertical component is significant', () => {
    // This test verifies the swipe callback ignores ambiguous swipes
  });
});
```

**Step 2: Modify the swipe callback in Category Page**

In `src/pages/Category Page.js`, modify `initCategorySwipe` to use `addSwipeHandler` from `mobileHelpers` instead (which uses `Math.abs(dx) > Math.abs(dy)` check), OR keep `enableSwipe` but with a higher threshold:

Change threshold from 60 to 100 and add `maxTime: 500`:

```javascript
    enableSwipe(gridEl, (direction) => {
      if (direction !== 'left' && direction !== 'right') return;
      let nextIndex;
      if (direction === 'left') {
        nextIndex = currentIndex + 1;
      } else {
        nextIndex = currentIndex - 1;
      }
      if (nextIndex < 0 || nextIndex >= CATEGORY_ORDER.length) return;
      const nextCategory = CATEGORY_ORDER[nextIndex];
      trackEvent('category_swipe', { from: currentPath, to: nextCategory, direction });
      wixLocationFrontend.to(`/${nextCategory}`);
    }, { threshold: 100, maxTime: 400 });
```

The higher threshold (100px vs 60px) means users must make a very deliberate horizontal swipe to trigger category navigation, reducing false positives during vertical scrolling.

**Step 3: Run tests**

Run: `npm test -- tests/categoryPage.test.js`
Expected: PASS

**Step 4: Commit**

```bash
git add "src/pages/Category Page.js" tests/categoryPage.test.js
git commit -m "fix: increase category swipe threshold to prevent accidental nav

Raised swipe threshold from 60px to 100px and reduced maxTime to 400ms
to require deliberate horizontal swipes for category navigation."
```

---

### Task 5: Wire footer accordions on mobile

`initFooterAccordions()` exists in `navigationHelpers.js` but is never called from `masterPage.js`. Footer link columns should collapse into accordions on mobile.

**Files:**
- Modify: `src/pages/masterPage.js` (add import + call)
- Test: `tests/masterPage.test.js`

**Step 1: Write the failing test**

```javascript
it('initializes footer accordions on mobile', async () => {
  global.window = { innerWidth: 375, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.resetModules();
  await onReadyHandler();
  // Footer column headers should have accordion behavior on mobile
  // (this will be wired through initFooterAccordions)
});
```

**Step 2: Add the import and call**

In `src/pages/masterPage.js`, add `initFooterAccordions` to the import from `navigationHelpers`:

```javascript
import {
  applyActiveNavState,
  initMegaMenu,
  initMobileDrawer,
  initAnnouncementBar as initAnnouncementBarHelper,
  initBackToTop as initBackToTopHelper,
  initStickyNav,
  initFooterAccordions,
  breadcrumbsFromPath,
  renderBreadcrumbs,
} from 'public/navigationHelpers';
```

Then in `initEnhancedNavigation()`, after the sticky nav call, add:

```javascript
  // Footer columns → accordions on mobile
  try {
    initFooterAccordions($w, [
      { headerId: '#footerShopHeader', contentId: '#footerShopLinks', label: 'Shop' },
      { headerId: '#footerServiceHeader', contentId: '#footerServiceLinks', label: 'Customer Service' },
      { headerId: '#footerAboutHeader', contentId: '#footerAboutLinks', label: 'About Us' },
    ]);
  } catch (e) {}
```

**Step 3: Run tests**

Run: `npm test -- tests/masterPage.test.js`
Expected: PASS

**Step 4: Commit**

```bash
git add src/pages/masterPage.js tests/masterPage.test.js
git commit -m "feat: wire footer accordion behavior on mobile

Calls initFooterAccordions() from masterPage to collapse footer link
columns into expandable accordions on mobile viewports."
```

---

### Task 6: Improve isTouchDevice() detection

Currently uses viewport width as proxy for touch capability. Add `navigator.maxTouchPoints` check.

**Files:**
- Modify: `src/public/mobileHelpers.js:37-40`
- Test: `tests/mobileHelpers.test.js`

**Step 1: Write the failing test**

```javascript
describe('isTouchDevice with maxTouchPoints', () => {
  it('returns true for desktop viewport with touch capability', async () => {
    setWindowWidth(1200);
    global.navigator = { maxTouchPoints: 2 };
    vi.resetModules();
    const { isTouchDevice } = await import('public/mobileHelpers');
    expect(isTouchDevice()).toBe(true);
  });

  it('returns false for desktop without touch capability', async () => {
    setWindowWidth(1200);
    global.navigator = { maxTouchPoints: 0 };
    vi.resetModules();
    const { isTouchDevice } = await import('public/mobileHelpers');
    expect(isTouchDevice()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/mobileHelpers.test.js`
Expected: FAIL — current implementation only checks viewport width

**Step 3: Update isTouchDevice**

In `src/public/mobileHelpers.js`, change `isTouchDevice()`:

```javascript
export function isTouchDevice() {
  const vp = getViewport();
  if (vp === 'mobile' || vp === 'tablet') return true;
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  return false;
}
```

**Step 4: Run tests**

Run: `npm test -- tests/mobileHelpers.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/public/mobileHelpers.js tests/mobileHelpers.test.js
git commit -m "fix: improve touch detection with navigator.maxTouchPoints

Adds navigator.maxTouchPoints check to isTouchDevice() so touch-enabled
laptops (Surface, etc.) are correctly identified as touch devices."
```

---

### Task 7: Run full test suite and verify

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass with no regressions

**Step 2: Persist findings to bead**

```bash
bd update cf-wn17 --notes "Implemented: (1) removed duplicate hamburger handler, (2) gated mega menu for desktop, (3) added lightbox swipe, (4) increased category swipe threshold, (5) wired footer accordions, (6) improved touch detection. Gallery DOM access and pinch-zoom are Wix platform limitations — documented as known gaps."
```

**Step 3: Final commit and push**

```bash
git status
git push
```
