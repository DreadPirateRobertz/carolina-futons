// Performance optimization helpers
// Deferred loading, IntersectionObserver image lazy loading, CLS prevention

// ── deferInit ────────────────────────────────────────────────────────
// Schedule non-critical initialization for idle time.
// Uses requestIdleCallback when available, falls back to setTimeout.

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
// (load during idle time). Returns critical results for error handling.

export async function prioritizeSections(sections) {
  if (!sections || sections.length === 0) {
    return { critical: [], deferred: [] };
  }

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

  // Run deferred sections after critical content is rendered.
  // This ensures above-fold content paints before below-fold starts loading.
  const deferredResults = await Promise.allSettled(
    deferred.map(s => s.init())
  );

  deferredResults.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[perf] Deferred section "${deferred[i].name}" failed:`, result.reason);
    }
  });

  return { critical: criticalResults, deferred: deferredResults };
}

// ── createImageObserver ──────────────────────────────────────────────
// IntersectionObserver-based lazy loading for images.
// Watches elements and calls onVisible when they enter the viewport.

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

// ── setImageDimensions ──────────────────────────────────────────────
// Set explicit dimensions on an image element to prevent CLS.

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

export function getImageDimensionsForCategory(category) {
  if (!category) return DEFAULT_DIMENSIONS;
  return IMAGE_DIMENSIONS[category] || DEFAULT_DIMENSIONS;
}
