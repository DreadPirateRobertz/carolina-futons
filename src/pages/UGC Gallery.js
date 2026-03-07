// UGC Gallery Page — Customer Room Photos, Before/After, Voting
// "See How Our Customers Style Their Spaces"
// Gallery grid, filter tabs, sorting, featured carousel, photo submission

import { getApprovedPhotos, getBeforeAfterPairs, getUGCStats } from 'backend/ugcService.web';
import { initUGCGallery, renderPhotoCards, buildBeforeAfterSlider } from 'public/UGCGallery.js';
import { initVoting, handleVoteClick, isVotedByUser, getVotedPhotoIds } from 'public/ugcVoting.js';
import { isMobile, collapseOnMobile, initBackToTop, limitForViewport, onViewportChange } from 'public/mobileHelpers';
import { trackEvent } from 'public/engagementTracker';
import { announce, makeClickable, setupAccessibleDialog } from 'public/a11yHelpers';
import { colors, spacing } from 'public/designTokens.js';
import { prioritizeSections } from 'public/performanceHelpers.js';

let _currentRoomType = null;
let _currentSort = 'recent';
let _allPhotos = [];

$w.onReady(async function () {
  trackEvent('page_view', { page: 'ugc-gallery' });

  const sections = [
    { name: 'ugcStats', init: loadStats, critical: true },
    { name: 'ugcGallery', init: loadGallery, critical: true },
    { name: 'ugcBeforeAfter', init: loadBeforeAfter, critical: false },
    { name: 'ugcSubmitCTA', init: initSubmitCTA, critical: false },
  ];

  try {
    await prioritizeSections(sections, {
      onError: (section, reason) => {
        console.error(`[UGC Gallery] Section ${section} failed:`, reason);
      },
    });
  } catch (err) {
    console.error('[UGC Gallery] prioritizeSections failed:', err);
  }

  // Mobile-specific: collapse non-critical sections, add back-to-top
  try {
    collapseOnMobile($w, ['#ugcBeforeAfterSection', '#ugcSubmitSection']);
    initBackToTop($w);

    // Re-render gallery when viewport changes (e.g. device rotation)
    onViewportChange(() => {
      try { loadGallery(); } catch (e) {}
    });
  } catch (e) { /* mobile helpers may fail */ }
});

/**
 * Load and display gallery statistics (total photos, contributors).
 */
async function loadStats() {
  try {
    const result = await getUGCStats();
    if (!result || !result.success || !result.stats) return;

    const { total, featured } = result.stats;

    try { $w('#ugcTotalCount').text = `${total} Customer Photos`; } catch (e) {}
    try { $w('#ugcFeaturedCount').text = `${featured} Featured`; } catch (e) {}
  } catch (err) {
    console.error('[UGC Gallery] loadStats failed:', err);
  }
}

/**
 * Load gallery photos and initialize the interactive gallery.
 */
async function loadGallery() {
  try {
    // Show skeleton
    try { $w('#ugcGallerySkeleton').show(); } catch (e) {}

    const limit = limitForViewport(_allPhotos, { mobile: 12, tablet: 18, desktop: 24 }) || 24;

    const result = await getApprovedPhotos({
      roomType: _currentRoomType,
      sort: _currentSort,
      limit: typeof limit === 'number' ? limit : 24,
    });

    if (!result || !result.success) {
      try { $w('#ugcGallerySkeleton').hide('fade', { duration: 300 }); } catch (e) {}
      try { $w('#ugcEmptyState').expand(); } catch (e) {}
      return;
    }

    _allPhotos = result.photos || [];

    // Initialize the full gallery with filter/sort callbacks
    initUGCGallery($w, {
      photos: _allPhotos,
      onFilterChange: async (roomType) => {
        _currentRoomType = roomType;
        await refreshGallery();
      },
      onSortChange: async (sort) => {
        _currentSort = sort;
        await refreshGallery();
      },
    });

    // Initialize voting on the gallery
    initVoting($w);

    try { $w('#ugcGallerySkeleton').hide('fade', { duration: 300 }); } catch (e) {}
  } catch (err) {
    console.error('[UGC Gallery] loadGallery failed:', err);
    try { $w('#ugcGallerySkeleton').hide('fade', { duration: 300 }); } catch (e) {}
  }
}

/**
 * Refresh gallery photos based on current filter/sort state.
 */
async function refreshGallery() {
  try {
    const result = await getApprovedPhotos({
      roomType: _currentRoomType,
      sort: _currentSort,
      limit: isMobile() ? 12 : 24,
    });

    if (result && result.success) {
      _allPhotos = result.photos || [];
      renderPhotoCards($w, _allPhotos);
    }
  } catch (err) {
    console.error('[UGC Gallery] refreshGallery failed:', err);
  }
}

/**
 * Load before/after transformation pairs.
 */
async function loadBeforeAfter() {
  try {
    const result = await getBeforeAfterPairs({});

    if (!result || !result.success || !result.pairs || result.pairs.length === 0) {
      try { $w('#ugcBeforeAfterSection').collapse(); } catch (e) {}
      return;
    }

    // Show the first pair in the slider
    const firstPair = result.pairs[0];
    buildBeforeAfterSlider($w, firstPair.before, firstPair.after);

    try { $w('#ugcBeforeAfterSection').expand(); } catch (e) {}

    trackEvent('before_after_loaded', { pairCount: result.pairs.length });
  } catch (err) {
    console.error('[UGC Gallery] loadBeforeAfter failed:', err);
    try { $w('#ugcBeforeAfterSection').collapse(); } catch (e) {}
  }
}

/**
 * Initialize the "Share Your Setup" CTA section.
 */
async function initSubmitCTA() {
  try {
    // Submit photo button — opens modal for members, login prompt for visitors
    try {
      const submitBtn = $w('#ugcSubmitPhotoBtn');
      submitBtn.accessibility.ariaLabel = 'Share your futon setup photo';
      submitBtn.onClick(async () => {
        trackEvent('ugc_submit_click', { source: 'gallery_page' });
        try {
          const { to } = await import('wix-location-frontend');
          to('/member/submit-photo');
        } catch (e) {
          // Fallback: try to show inline modal
          try {
            const dialog = setupAccessibleDialog($w, {
              panelId: '#ugcSubmitModal',
              closeId: '#ugcSubmitModalClose',
              titleId: '#ugcSubmitModalTitle',
              onClose: () => {},
            });
            dialog.open();
          } catch (ex) {}
        }
      });
    } catch (e) {}

    try { $w('#ugcSubmitSection').expand(); } catch (e) {}
  } catch (err) {
    console.error('[UGC Gallery] initSubmitCTA failed:', err);
  }
}
