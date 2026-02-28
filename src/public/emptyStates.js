/**
 * Empty States & Loading Skeletons — Mountain-Themed Branded Experience
 *
 * Provides consistent, branded empty states and loading skeleton behavior
 * for every page in the Carolina Futons site. Uses the Blue Ridge palette
 * and warm, friendly messaging that matches the brand voice.
 *
 * All functions accept $w selector and follow Wix Velo patterns.
 */

import { colors, transitions } from 'public/sharedTokens';
import { announce } from 'public/a11yHelpers';

// ── Empty State Content Registry ─────────────────────────────────────

/**
 * Centralized empty state content. Each key maps to a page/context
 * with headline, message, CTA label, CTA path, and alt text for illustration.
 */
export const EMPTY_STATE_CONTENT = {
  cart: {
    title: 'Your cart is as empty as a mountain trail at dawn',
    message: 'Looks like you haven\'t added anything yet. Explore our handcrafted futon frames, premium mattresses, and more.',
    ctaLabel: 'Start Shopping',
    ctaPath: '/shop-main',
    illustrationAlt: 'Illustrated mountain trail at sunrise with an empty path',
    ariaLabel: 'Empty shopping cart',
  },
  search: {
    title: 'We searched every peak and valley...',
    message: 'No results found. Try a different search term, or browse our popular categories below.',
    ctaLabel: 'Browse All Products',
    ctaPath: '/shop-main',
    illustrationAlt: 'Illustrated misty mountain scene with fog in the valley',
    ariaLabel: 'No search results found',
  },
  wishlist: {
    title: 'Start your mountain collection',
    message: 'Save your favorite pieces here. Tap the heart icon on any product to add it to your wishlist.',
    ctaLabel: 'Explore Products',
    ctaPath: '/shop-main',
    illustrationAlt: 'Illustrated notebook with a heart drawn on an open page',
    ariaLabel: 'Empty wishlist',
  },
  reviews: {
    title: 'Be the first to share your experience',
    message: 'Your review helps other families find the perfect piece. Share your story — we\'d love to hear from you.',
    ctaLabel: 'Write a Review',
    ctaPath: null, // handled by review form
    illustrationAlt: 'Illustrated pen and paper with mountain letterhead',
    ariaLabel: 'No reviews yet',
  },
  category: {
    title: 'No products found on this trail',
    message: 'We couldn\'t find products matching your filters. Try adjusting your search or clearing filters.',
    ctaLabel: 'Clear Filters',
    ctaPath: null, // handled by filter reset
    illustrationAlt: 'Illustrated empty mountain clearing with wildflowers',
    ariaLabel: 'No products match current filters',
  },
  error: {
    title: 'Oops — the trail washed out',
    message: 'Something went wrong on our end. Please try again, or head back to the homepage.',
    ctaLabel: 'Try Again',
    ctaPath: null, // handled by retry callback
    illustrationAlt: 'Illustrated broken wooden bridge over a mountain stream',
    ariaLabel: 'An error occurred',
  },
  notFound: {
    title: 'Lost on the mountain?',
    message: 'This page doesn\'t exist — but there\'s plenty more to explore. Search for what you need, or check out our popular categories.',
    ctaLabel: 'Go Home',
    ctaPath: '/',
    illustrationAlt: 'Illustrated hiker looking at a mountain trail map',
    ariaLabel: 'Page not found',
  },
  sideCart: {
    title: 'Your cart is empty',
    message: 'Add items to get started.',
    ctaLabel: 'Shop Now',
    ctaPath: '/shop-main',
    illustrationAlt: 'Empty shopping bag illustration',
    ariaLabel: 'Side cart is empty',
  },
};

// ── Render Empty State ──────────────────────────────────────────────

/**
 * Render an empty state into Wix elements.
 * Expects elements with IDs following the pattern:
 *   #<prefix>EmptySection, #<prefix>EmptyTitle, #<prefix>EmptyMessage,
 *   #<prefix>EmptyCta, #<prefix>EmptyIllustration
 *
 * @param {Function} $w - Wix selector
 * @param {string} stateKey - Key from EMPTY_STATE_CONTENT (e.g. 'cart', 'search')
 * @param {Object} [opts]
 * @param {string} [opts.prefix=''] - Element ID prefix (e.g. 'sideCart' → #sideCartEmptyTitle)
 * @param {Function} [opts.onCtaClick] - Custom CTA handler (overrides default navigation)
 * @param {string} [opts.customMessage] - Override the default message
 * @param {Array<string>} [opts.suggestions] - Search suggestions for search empty state
 */
export function renderEmptyState($w, stateKey, opts = {}) {
  const content = EMPTY_STATE_CONTENT[stateKey];
  if (!content) return;

  const prefix = opts.prefix || '';
  const sectionId = `#${prefix}EmptySection`;
  const titleId = `#${prefix}EmptyTitle`;
  const messageId = `#${prefix}EmptyMessage`;
  const ctaId = `#${prefix}EmptyCta`;
  const illustrationId = `#${prefix}EmptyIllustration`;

  // Show the empty state section
  try { $w(sectionId).show('fade', { duration: transitions.medium }); } catch (e) {}

  // Set title
  try {
    $w(titleId).text = content.title;
    try { $w(titleId).style.color = colors.espresso; } catch (e) {}
  } catch (e) {}

  // Set message
  try {
    $w(messageId).text = opts.customMessage || content.message;
    try { $w(messageId).style.color = colors.espressoLight; } catch (e) {}
  } catch (e) {}

  // Set illustration alt text
  try {
    $w(illustrationId).alt = content.illustrationAlt;
  } catch (e) {}

  // Set up CTA button
  try {
    const ctaBtn = $w(ctaId);
    if (ctaBtn) {
      ctaBtn.label = content.ctaLabel;
      try { ctaBtn.accessibility.ariaLabel = content.ctaLabel; } catch (e) {}

      if (opts.onCtaClick) {
        ctaBtn.onClick(opts.onCtaClick);
      } else if (content.ctaPath) {
        ctaBtn.onClick(() => {
          import('wix-location-frontend').then(({ to }) => to(content.ctaPath));
        });
      }
    }
  } catch (e) {}

  // Render search suggestions if provided
  if (stateKey === 'search' && opts.suggestions && opts.suggestions.length > 0) {
    try {
      $w('#searchSuggestionsList').text = 'Try: ' + opts.suggestions.join(', ');
      $w('#searchSuggestionsList').show();
    } catch (e) {}
  }

  // Set ARIA on section
  try {
    $w(sectionId).accessibility.role = 'status';
    $w(sectionId).accessibility.ariaLabel = content.ariaLabel;
  } catch (e) {}

  // Announce to screen readers
  announce($w, content.ariaLabel);
}

/**
 * Hide an empty state section.
 *
 * @param {Function} $w - Wix selector
 * @param {string} [prefix=''] - Element ID prefix
 */
export function hideEmptyState($w, prefix = '') {
  try {
    $w(`#${prefix}EmptySection`).hide('fade', { duration: transitions.fast });
  } catch (e) {}
}

// ── Loading Skeleton ────────────────────────────────────────────────

/**
 * Show loading skeleton elements.
 * Skeleton elements are pre-created in Wix Studio with Sand background
 * and shimmer animation. This function shows/hides them.
 *
 * @param {Function} $w - Wix selector
 * @param {Array<string>} skeletonIds - Element IDs for skeleton placeholders
 */
export function showSkeletons($w, skeletonIds) {
  if (!skeletonIds || skeletonIds.length === 0) return;
  skeletonIds.forEach(id => {
    try {
      $w(id).show('fade', { duration: transitions.fast });
      try { $w(id).accessibility.ariaHidden = true; } catch (e) {}
    } catch (e) {}
  });
  announce($w, 'Loading content');
}

/**
 * Hide loading skeleton elements.
 *
 * @param {Function} $w - Wix selector
 * @param {Array<string>} skeletonIds - Element IDs for skeleton placeholders
 */
export function hideSkeletons($w, skeletonIds) {
  if (!skeletonIds || skeletonIds.length === 0) return;
  skeletonIds.forEach(id => {
    try {
      $w(id).hide('fade', { duration: transitions.fast });
    } catch (e) {}
  });
}

/**
 * Show skeletons, run async loader, then hide skeletons.
 * If loader fails, renders error empty state.
 *
 * @param {Function} $w - Wix selector
 * @param {Array<string>} skeletonIds - Skeleton element IDs
 * @param {Function} loader - Async function that loads content
 * @param {Object} [opts]
 * @param {string} [opts.errorPrefix=''] - Prefix for error empty state elements
 * @param {Function} [opts.onError] - Custom error handler
 * @returns {Promise<*>} Result of the loader
 */
export async function withSkeleton($w, skeletonIds, loader, opts = {}) {
  showSkeletons($w, skeletonIds);
  try {
    const result = await loader();
    hideSkeletons($w, skeletonIds);
    return result;
  } catch (err) {
    hideSkeletons($w, skeletonIds);
    if (opts.onError) {
      opts.onError(err);
    } else {
      renderEmptyState($w, 'error', {
        prefix: opts.errorPrefix || '',
        onCtaClick: () => {
          // Retry by re-running withSkeleton
          withSkeleton($w, skeletonIds, loader, opts);
        },
      });
    }
    throw err;
  }
}

// ── Loading Spinner ─────────────────────────────────────────────────

/**
 * Show the custom mountain/sun loading spinner.
 * The spinner element is pre-built in Wix Studio.
 *
 * @param {Function} $w - Wix selector
 * @param {string} [spinnerId='#mountainSpinner'] - Spinner element ID
 */
export function showSpinner($w, spinnerId = '#mountainSpinner') {
  try {
    $w(spinnerId).show('fade', { duration: transitions.fast });
    try { $w(spinnerId).accessibility.ariaLabel = 'Loading, please wait'; } catch (e) {}
    try { $w(spinnerId).accessibility.role = 'progressbar'; } catch (e) {}
  } catch (e) {}
  announce($w, 'Loading');
}

/**
 * Hide the custom loading spinner.
 *
 * @param {Function} $w - Wix selector
 * @param {string} [spinnerId='#mountainSpinner'] - Spinner element ID
 */
export function hideSpinner($w, spinnerId = '#mountainSpinner') {
  try {
    $w(spinnerId).hide('fade', { duration: transitions.fast });
  } catch (e) {}
}

// ── Error State with Retry ──────────────────────────────────────────

/**
 * Show an error state with a retry button.
 *
 * @param {Function} $w - Wix selector
 * @param {Object} opts
 * @param {string} [opts.prefix=''] - Element ID prefix
 * @param {string} [opts.message] - Custom error message
 * @param {Function} [opts.onRetry] - Retry callback
 */
export function showErrorState($w, opts = {}) {
  renderEmptyState($w, 'error', {
    prefix: opts.prefix || '',
    customMessage: opts.message,
    onCtaClick: opts.onRetry || (() => {
      try {
        import('wix-location-frontend').then(({ to }) => to('/'));
      } catch (e) {}
    }),
  });
}
