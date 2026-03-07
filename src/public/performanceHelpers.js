/** @module performanceHelpers - Performance optimization utilities.
 *
 * Provides deferred initialization (requestIdleCallback with setTimeout fallback),
 * critical/deferred section prioritization for faster Largest Contentful Paint (LCP),
 * IntersectionObserver-based image lazy loading, explicit image dimension setting
 * to prevent Cumulative Layout Shift (CLS), and recommended dimension lookups
 * by usage context.
 */

// ── deferInit ────────────────────────────────────────────────────────
// Schedule non-critical initialization for idle time.
// Uses requestIdleCallback when available, falls back to setTimeout.

/**
 * Schedule a non-critical initialization function for idle time.
 * Uses requestIdleCallback when available; falls back to setTimeout.
 * Wraps the callback in try/catch so deferred failures never crash the page.
 * @param {Function} fn - Initialization function to defer
 * @param {Object} [opts] - Options
 * @param {number} [opts.fallbackDelay=1] - setTimeout delay in ms when requestIdleCallback is unavailable
 * @returns {void}
 */
export function deferInit(fn, opts = {}) {
  if (typeof fn !== 'function') return;
  const { fallbackDelay = 1 } = opts;

  const safeFn = () => {
    try { fn(); } catch (e) {
      console.error('[performanceHelpers] deferred init error:', e);
    }
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(safeFn);
  } else {
    setTimeout(safeFn, fallbackDelay);
  }
}

// ── prioritizeSections ───────────────────────────────────────────────
// Split page sections into critical (load immediately) and deferred
// (load during idle time). Critical sections are awaited; deferred
// sections are fire-and-forget so they don't block LCP.

/**
 * Split page sections into critical (awaited) and deferred (fire-and-forget).
 * Critical sections run first and block — they affect LCP. Deferred sections
 * run afterward without blocking, so $w.onReady returns as soon as critical
 * content paints. Failures are logged; deferred failures also invoke onError.
 * @param {Array<{name: string, critical: boolean, init: Function}>} sections - Section descriptors
 * @param {Object} [opts] - Options
 * @param {Function} [opts.onError] - Callback invoked on deferred section failure: (section, reason)
 * @returns {Promise<{critical: Array<PromiseSettledResult>}>} Results of critical section initialization
 */
export async function prioritizeSections(sections, opts = {}) {
  if (!sections || sections.length === 0) {
    return { critical: [] };
  }

  const { onError } = opts;
  const critical = sections.filter(s => s.critical);
  const deferred = sections.filter(s => !s.critical);

  // Run critical sections first — these affect LCP
  const criticalResults = await Promise.allSettled(
    critical.map(s => s.init())
  );

  // Log critical failures
  criticalResults.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[perf] Critical section "${critical[i].name}" failed:`, result.reason);
    }
  });

  // Fire-and-forget deferred sections — do NOT await.
  // This lets onReady return after critical content paints.
  if (deferred.length > 0) {
    Promise.allSettled(deferred.map(s => s.init()))
      .then(results => {
        results.forEach((result, i) => {
          if (result.status === 'rejected') {
            console.error(`[perf] Deferred section "${deferred[i].name}" failed:`, result.reason);
            if (typeof onError === 'function') {
              try { onError(deferred[i], result.reason); } catch (e) {}
            }
          }
        });
      });
  }

  return { critical: criticalResults };
}

// ── createImageObserver ──────────────────────────────────────────────
// IntersectionObserver-based lazy loading for images.
// Watches elements and calls onVisible when they enter the viewport.

/**
 * Create an IntersectionObserver-based lazy loader for images.
 * Automatically unobserves each element after it enters the viewport.
 * Returns null in environments where IntersectionObserver is unavailable.
 * @param {Object} [opts] - Options
 * @param {string} [opts.rootMargin='200px 0px'] - Viewport margin for early loading
 * @param {number} [opts.threshold=0.01] - Intersection ratio to trigger visibility
 * @param {Function} [opts.onVisible] - Callback when element enters viewport: (element)
 * @returns {{observe: Function, disconnect: Function}|null} Observer controller or null
 */
export function createImageObserver(opts = {}) {
  if (typeof IntersectionObserver === 'undefined') return null;

  const {
    rootMargin = '200px 0px',
    threshold = 0.01,
    onVisible = null,
  } = opts;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      obs.unobserve(entry.target);

      if (typeof onVisible === 'function') {
        onVisible(entry.target);
      }
    });
  }, { rootMargin, threshold });

  return {
    observe: (el) => observer.observe(el),
    disconnect: () => observer.disconnect(),
  };
}

// ── lazyLoadImage ────────────────────────────────────────────────────
// Wix Velo-compatible lazy loading using onViewportEnter.
// Defers image src assignment until the element scrolls into view.

/**
 * Lazy-load an image by deferring src assignment until viewport entry.
 * Uses Wix Velo's onViewportEnter for $w elements. Falls back to
 * immediate src assignment if onViewportEnter is unavailable.
 * @param {Object} el - Wix $w image element
 * @param {string} src - Image URL to load
 * @param {Object} [opts] - Options
 * @param {string} [opts.alt] - Alt text to set immediately (before lazy load)
 * @returns {void}
 */
export function lazyLoadImage(el, src, opts = {}) {
  if (!el || !src) return;

  if (opts.alt) {
    el.alt = opts.alt;
  }

  try {
    if (typeof el.onViewportEnter === 'function') {
      let loaded = false;
      el.onViewportEnter(() => {
        if (!loaded) {
          loaded = true;
          el.src = src;
        }
      });
      return;
    }
  } catch (e) {
    // onViewportEnter failed — fall through to immediate load
  }

  el.src = src;
}

// ── setImageDimensions ──────────────────────────────────────────────
// Set explicit dimensions on an image element to prevent CLS.

/**
 * Set explicit width, height, and aspect-ratio on an image element to prevent CLS.
 * Silently fails if the element's style property is read-only.
 * @param {Object} el - DOM or Wix element with a .style property
 * @param {number} width - Width in pixels
 * @param {number} height - Height in pixels
 * @returns {void}
 */
export function setImageDimensions(el, width, height) {
  if (!el || !el.style) return;

  try {
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.aspectRatio = `${width} / ${height}`;
  } catch (e) {
    // Style property may not be writable in all contexts
  }
}

// ── getImageDimensionsForCategory ────────────────────────────────────
// Returns recommended image dimensions by usage context to prevent CLS.

const IMAGE_DIMENSIONS = {
  'product-grid': { width: 350, height: 350 },
  'hero': { width: 1440, height: 600 },
  'category-card': { width: 400, height: 300 },
  'thumbnail': { width: 80, height: 80 },
  'gallery-main': { width: 600, height: 600 },
  'recently-viewed': { width: 200, height: 200 },
  'sale-card': { width: 300, height: 300 },
};

const DEFAULT_DIMENSIONS = { width: 400, height: 400 };

/**
 * Get recommended image dimensions by usage context to prevent CLS.
 * Supported contexts: 'product-grid', 'hero', 'category-card', 'thumbnail',
 * 'gallery-main', 'recently-viewed', 'sale-card'. Returns 400x400 default.
 * @param {string} category - Usage context key
 * @returns {{width: number, height: number}} Recommended dimensions
 */
export function getImageDimensionsForCategory(category) {
  if (!category) return DEFAULT_DIMENSIONS;
  return IMAGE_DIMENSIONS[category] || DEFAULT_DIMENSIONS;
}

// ── sharePromise ─────────────────────────────────────────────────────
// Deduplicates concurrent calls to the same async function.
// While a call is in-flight, subsequent calls return the same promise.
// After the promise settles, the next call triggers a fresh invocation.

/**
 * Wrap an async function so concurrent calls share one in-flight promise.
 * After the promise settles (resolve or reject), the next call starts fresh.
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function that deduplicates concurrent calls
 */
export function sharePromise(fn) {
  let pending = null;
  return (...args) => {
    if (!pending) {
      pending = fn(...args).finally(() => { pending = null; });
    }
    return pending;
  };
}
