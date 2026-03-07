/** @module mobileHelpers - Mobile-first responsive utilities for Wix Velo pages.
 *
 * Provides viewport detection (mobile/tablet/desktop/wide), touch-capability checks,
 * debounced viewport-change listeners, swipe gesture handlers, adaptive data loading
 * (limitForViewport), "show more" progressive disclosure, mobile section collapsing,
 * smooth scrolling, and a "back to top" button initializer.
 *
 * Works alongside Wix Studio's CSS responsive layout system — this module handles
 * runtime JS behavior, not CSS breakpoints.
 *
 * Dependencies: designTokens (breakpoints), wix-window-frontend (scroll events, lazy-loaded).
 */
import { breakpoints, grid } from 'public/designTokens';

// ── Viewport Detection ───────────────────────────────────────────────

let _cachedViewport = null;
let _resizeListeners = [];

/**
 * Get current viewport category based on window width.
 * Returns all 6 breakpoint categories for granular responsive behavior.
 * @returns {'mobile'|'mobileLarge'|'tablet'|'desktop'|'wide'|'ultraWide'} Current viewport
 */
export function getViewport() {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < breakpoints.mobileLarge) return 'mobile';
  if (w < breakpoints.tablet) return 'mobileLarge';
  if (w < breakpoints.desktop) return 'tablet';
  if (w < breakpoints.wide) return 'desktop';
  if (w < breakpoints.ultraWide) return 'wide';
  return 'ultraWide';
}

/**
 * Check if current viewport is mobile (< tablet breakpoint, includes mobileLarge).
 * @returns {boolean}
 */
export function isMobile() {
  const vp = getViewport();
  return vp === 'mobile' || vp === 'mobileLarge';
}

/**
 * Check if current viewport is tablet or smaller.
 * @returns {boolean}
 */
export function isTabletOrBelow() {
  const vp = getViewport();
  return vp === 'mobile' || vp === 'mobileLarge' || vp === 'tablet';
}

/**
 * Check if current viewport is touch-capable (mobile or tablet).
 * @returns {boolean}
 */
export function isTouchDevice() {
  const vp = getViewport();
  if (vp === 'mobile' || vp === 'mobileLarge' || vp === 'tablet') return true;
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  return false;
}

/**
 * Register a callback for viewport changes. Debounced at 150ms.
 * @param {Function} callback - Receives new viewport string
 * @returns {Function} Unsubscribe function
 */
export function onViewportChange(callback) {
  if (typeof window === 'undefined') return () => {};

  const handler = debounce(() => {
    const newVp = getViewport();
    if (newVp !== _cachedViewport) {
      _cachedViewport = newVp;
      callback(newVp);
    }
  }, 150);

  _resizeListeners.push(handler);
  if (_resizeListeners.length === 1) {
    window.addEventListener('resize', _handleResize);
  }
  _cachedViewport = getViewport();

  return () => {
    _resizeListeners = _resizeListeners.filter(h => h !== handler);
    if (_resizeListeners.length === 0 && typeof window !== 'undefined') {
      window.removeEventListener('resize', _handleResize);
    }
  };
}

function _handleResize() {
  _resizeListeners.forEach(fn => fn());
}

// ── Touch Gestures ───────────────────────────────────────────────────

/**
 * Add swipe detection to a Wix element. Calls onSwipe with direction.
 * Useful for image galleries and carousels on touch devices.
 * @param {Object} element - Wix $w element
 * @param {Object} handlers - { onLeft, onRight, onUp, onDown }
 * @param {number} [threshold=50] - Minimum swipe distance in px
 */
export function addSwipeHandler(element, handlers, threshold = 50) {
  if (!element || typeof window === 'undefined') return;

  let startX = 0;
  let startY = 0;

  // Wix elements expose onMouseIn/onMouseOut but not touch events directly.
  // Use the underlying DOM element if accessible via Wix's htmlElement property,
  // otherwise fall back to Wix's onClick for basic interaction.
  try {
    const el = element.htmlElement || element;
    if (!el.addEventListener) return;

    el.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        if (dx > 0 && handlers.onRight) handlers.onRight();
        if (dx < 0 && handlers.onLeft) handlers.onLeft();
      } else if (Math.abs(dy) > threshold) {
        if (dy > 0 && handlers.onDown) handlers.onDown();
        if (dy < 0 && handlers.onUp) handlers.onUp();
      }
    }, { passive: true });
  } catch (e) {
    // Touch handling is enhancement-only — never break the page
  }
}

// ── Mobile UI Helpers ────────────────────────────────────────────────

/**
 * Adapt a repeater grid for mobile — collapses to fewer columns.
 * Wix Studio handles CSS layout, but this controls data loading
 * (e.g., showing fewer items on mobile for performance).
 * Supports all 6 breakpoints with fallback: mobileLarge→mobile, wide/ultraWide→desktop.
 * @param {Array} items - Full item array
 * @param {Object} [limits] - { mobile: 4, mobileLarge: 6, tablet: 6, desktop: 8, wide: 10, ultraWide: 12 }
 * @returns {Array} Sliced items for current viewport
 */
export function limitForViewport(items, limits = {}) {
  if (!Array.isArray(items)) return [];
  const defaults = { mobile: 4, tablet: 6, desktop: 12 };
  const merged = { ...defaults, ...limits };
  const limit = getResponsiveValue(merged);
  return items.slice(0, limit);
}

/**
 * Get a value adapted to the current viewport from a breakpoint map.
 * Falls back gracefully: mobileLarge→mobile, wide→desktop, ultraWide→wide→desktop.
 * @param {Object} values - Map of viewport→value (e.g., { mobile: 1, tablet: 2, desktop: 3 })
 * @returns {*} The value for the current viewport
 */
export function getResponsiveValue(values) {
  const vp = getViewport();
  if (values[vp] !== undefined) return values[vp];
  // Fallback chain
  if (vp === 'mobileLarge') return values.mobile;
  if (vp === 'wide') return values.desktop;
  if (vp === 'ultraWide') return values.wide !== undefined ? values.wide : values.desktop;
  return values.desktop;
}

/**
 * Get responsive spacing values for the current viewport.
 * @returns {{ pagePadding: string, sectionGap: string, gridGap: string }}
 */
export function getResponsiveSpacing() {
  return {
    pagePadding: getResponsiveValue({ mobile: '16px', tablet: '24px', desktop: '80px' }),
    sectionGap: getResponsiveValue({ mobile: '48px', tablet: '64px', desktop: '80px' }),
    gridGap: getResponsiveValue({ mobile: grid.mobile.gap, tablet: grid.tablet.gap, desktop: grid.desktop.gap }),
  };
}

/**
 * Get responsive typography sizes for the current viewport.
 * Scales down headings on mobile/tablet while keeping body text readable.
 * @returns {{ heroTitle: string, h1: string, h2: string, h3: string, h4: string, body: string, bodySmall: string }}
 */
export function getResponsiveTypography() {
  return {
    heroTitle: getResponsiveValue({ mobile: '32px', tablet: '42px', desktop: '56px' }),
    h1: getResponsiveValue({ mobile: '28px', tablet: '34px', desktop: '42px' }),
    h2: getResponsiveValue({ mobile: '24px', tablet: '28px', desktop: '32px' }),
    h3: getResponsiveValue({ mobile: '20px', tablet: '22px', desktop: '24px' }),
    h4: getResponsiveValue({ mobile: '18px', tablet: '19px', desktop: '20px' }),
    body: getResponsiveValue({ mobile: '16px', tablet: '16px', desktop: '16px' }),
    bodySmall: getResponsiveValue({ mobile: '14px', tablet: '14px', desktop: '14px' }),
  };
}

/**
 * Get the number of grid columns for the current viewport.
 * @returns {number}
 */
export function getResponsiveColumns() {
  return getResponsiveValue({
    mobile: Number(grid.mobile.columns),
    tablet: Number(grid.tablet.columns),
    desktop: Number(grid.desktop.columns),
  });
}

/**
 * Configure a "show more" / "load more" pattern for mobile.
 * Initially shows a limited set, with a button to reveal the rest.
 * @param {Object} $w - Wix selector function
 * @param {string} repeaterId - Repeater element ID
 * @param {string} buttonId - "Show More" button element ID
 * @param {Array} allItems - Complete item array
 * @param {number} [initialCount=4] - Items to show initially on mobile
 */
export function initShowMore($w, repeaterId, buttonId, allItems, initialCount = 4) {
  if (!isMobile() || allItems.length <= initialCount) {
    try { $w(buttonId).hide(); } catch (e) {}
    return;
  }

  try {
    const repeater = $w(repeaterId);
    const button = $w(buttonId);

    // Show initial subset
    repeater.data = allItems.slice(0, initialCount);

    button.label = `Show All (${allItems.length})`;
    button.show();

    button.onClick(() => {
      repeater.data = allItems;
      button.hide();
    });
  } catch (e) {}
}

/**
 * Smooth scroll to an element — works on both mobile and desktop.
 * @param {Object} element - Wix $w element to scroll to
 */
export function smoothScrollTo(element) {
  try {
    if (element && element.scrollTo) {
      element.scrollTo();
    }
  } catch (e) {}
}

/**
 * Collapse non-essential sections on mobile for faster paint.
 * Sections are revealed on demand via "expand" buttons.
 * @param {Object} $w - Wix selector function
 * @param {Array<string>} sectionIds - Element IDs to initially collapse on mobile
 */
export function collapseOnMobile($w, sectionIds) {
  if (!isMobile()) return;

  sectionIds.forEach(id => {
    try { $w(id).collapse(); } catch (e) {}
  });
}

/**
 * Set up "back to top" button that appears after scrolling.
 * @param {Object} $w - Wix selector function
 * @param {string} [buttonId='#backToTop'] - Back to top button element ID
 */
export function initBackToTop($w, buttonId = '#backToTop') {
  try {
    const btn = $w(buttonId);
    if (!btn) return;

    btn.hide();

    // Wix doesn't expose scroll events on $w directly, but the
    // wix-window-frontend module provides onScroll in some contexts
    import('wix-window-frontend').then(({ onScroll }) => {
      if (onScroll) {
        onScroll((event) => {
          if (event.scrollY > 600) {
            btn.show('fade', { duration: 200 });
          } else {
            btn.hide('fade', { duration: 200 });
          }
        });
      }
    }).catch(err => console.error('[mobileHelpers] Back-to-top scroll listener failed:', err.message));

    btn.onClick(() => {
      import('wix-window-frontend').then(({ scrollTo }) => {
        if (scrollTo) scrollTo(0, 0, { scrollAnimation: true });
      }).catch(err => console.error('[mobileHelpers] scrollTo failed:', err.message));
    });
  } catch (e) {}
}

// ── Internal Utilities ───────────────────────────────────────────────

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
