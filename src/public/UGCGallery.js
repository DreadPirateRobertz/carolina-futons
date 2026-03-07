/**
 * UGC Gallery — User-Generated Content Photo Gallery
 *
 * Renders customer-submitted photos in a filterable, sortable gallery.
 * Includes photo cards with voting, room-type filter tabs, sort controls,
 * and a before/after comparison slider.
 *
 * @module public/UGCGallery
 */

import { colors, spacing, borderRadius, shadows, transitions } from 'public/designTokens.js';
import { trackEvent, trackGalleryInteraction } from 'public/engagementTracker.js';
import { announce, makeClickable } from 'public/a11yHelpers.js';
import { isMobile } from 'public/mobileHelpers.js';
import { initImageLightbox } from 'public/galleryHelpers.js';

// ── Data Mapping ─────────────────────────────────────────────────────

/**
 * Map a backend UGCPhotos record to the field names expected by the frontend.
 * Backend uses CMS field names (photoUrl, voteCount, memberDisplayName);
 * frontend rendering expects (imageUrl, votes, submittedBy).
 *
 * @param {Object|null} photo - Backend photo record
 * @returns {Object} Mapped photo with frontend field names
 */
export function mapPhotoForDisplay(photo) {
  if (!photo || typeof photo !== 'object') return {};
  return {
    ...photo,
    imageUrl: photo.photoUrl || '',
    votes: photo.voteCount != null ? photo.voteCount : 0,
    submittedBy: photo.memberDisplayName || '',
    caption: photo.caption || '',
  };
}

// ── Filter Tab Definitions ────────────────────────────────────────────

const FILTER_TABS = [
  { id: '#filterTabAll', roomType: null, label: 'All' },
  { id: '#filterTabLivingRoom', roomType: 'living room', label: 'Living Room' },
  { id: '#filterTabBedroom', roomType: 'bedroom', label: 'Bedroom' },
  { id: '#filterTabOffice', roomType: 'office', label: 'Office' },
  { id: '#filterTabDorm', roomType: 'dorm', label: 'Dorm' },
  { id: '#filterTabPorch', roomType: 'porch', label: 'Porch' },
];

// ── renderPhotoCards ──────────────────────────────────────────────────

/**
 * Render photos into the UGC gallery repeater.
 * Sets onItemReady handler and populates repeater data.
 *
 * @param {Function} $w - Wix selector function
 * @param {Array|null|undefined} photos - Array of photo objects to render
 * @param {Object} [opts={}] - Options
 * @param {string} [opts.repeaterId='#ugcRepeater'] - Repeater element ID
 * @param {string} [opts.sectionId='#ugcSection'] - Section wrapper element ID
 * @param {string} [opts.emptyStateId='#ugcEmptyState'] - Empty state element ID
 */
export function renderPhotoCards($w, photos, opts = {}) {
  const repeaterId = (opts && opts.repeaterId) || '#ugcRepeater';
  const sectionId = (opts && opts.sectionId) || '#ugcSection';
  const emptyStateId = (opts && opts.emptyStateId) || '#ugcEmptyState';

  try {
    // Handle empty/null/undefined photos
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      try { $w(sectionId).collapse(); } catch (e) { /* element may not exist */ }
      try { $w(emptyStateId).expand(); } catch (e) { /* element may not exist */ }
      try { $w(emptyStateId).show(); } catch (e) { /* element may not exist */ }
      return;
    }

    const repeater = $w(repeaterId);

    // Set up onItemReady handler
    repeater.onItemReady(($item, itemData) => {
      try {
        // Set image source
        try {
          $item('#ugcImage').src = itemData.imageUrl || '';
        } catch (e) { /* element may not exist */ }

        // Set caption text
        try {
          $item('#ugcCaption').text = itemData.caption || '';
        } catch (e) { /* element may not exist */ }

        // Set vote count
        try {
          const votes = itemData.votes != null ? itemData.votes : 0;
          $item('#ugcVoteCount').text = String(votes);
        } catch (e) { /* element may not exist */ }

        // Set product name if available
        try {
          if (itemData.productName) {
            $item('#ugcProductName').text = itemData.productName;
          }
        } catch (e) { /* element may not exist */ }

        // Set submitter name if available
        try {
          if (itemData.submittedBy) {
            $item('#ugcSubmittedBy').text = itemData.submittedBy;
          }
        } catch (e) { /* element may not exist */ }

        // Accessibility: image alt text / aria label
        try {
          const altText = itemData.caption
            ? `Customer photo: ${itemData.caption}`
            : `Customer photo of ${itemData.productName || 'futon'}`;
          const imgEl = $item('#ugcImage');
          imgEl.alt = altText;
          imgEl.accessibility.ariaLabel = altText;
        } catch (e) { /* element may not exist */ }

        // Accessibility: vote button aria label
        try {
          const voteBtn = $item('#ugcVoteButton');
          const votes = itemData.votes != null ? itemData.votes : 0;
          voteBtn.accessibility.ariaLabel = `Vote for this photo, currently ${votes} votes`;
          voteBtn.label = `Vote (${votes})`;
        } catch (e) { /* element may not exist */ }

        // Wire vote button click
        try {
          $item('#ugcVoteButton').onClick(() => {
            try {
              trackGalleryInteraction('ugc_vote', { photoId: itemData._id });
            } catch (e) { /* tracker may fail */ }
          });
        } catch (e) { /* element may not exist */ }

        // Wire image click for lightbox
        try {
          $item('#ugcImage').onClick(() => {
            try {
              trackGalleryInteraction('ugc_photo_view', { photoId: itemData._id });
            } catch (e) { /* tracker may fail */ }
          });
        } catch (e) { /* element may not exist */ }
      } catch (e) {
        // Catch-all for onItemReady errors
      }
    });

    // Set repeater data
    repeater.data = photos;

    // Expand the section
    try { $w(sectionId).expand(); } catch (e) { /* element may not exist */ }
    try { $w(emptyStateId).collapse(); } catch (e) { /* element may not exist */ }

    try {
      trackEvent('ugc_gallery_rendered', { photoCount: photos.length });
    } catch (e) { /* tracker may fail */ }
  } catch (e) {
    // Catch-all: collapse section on failure
    try { $w(sectionId).collapse(); } catch (ex) { /* element may not exist */ }
  }
}

// ── initFilterTabs ────────────────────────────────────────────────────

/**
 * Initialize room-type filter tabs for the UGC gallery.
 * Wires click handlers and highlights the active tab.
 *
 * @param {Function} $w - Wix selector function
 * @param {Function|null|undefined} onFilterChange - Callback invoked with roomType string or null
 */
export function initFilterTabs($w, onFilterChange) {
  let activeTabId = '#filterTabAll';

  /**
   * Highlight the active tab and reset others.
   * @param {string} selectedId - Element ID of the selected tab
   */
  function setActiveTab(selectedId) {
    for (const tab of FILTER_TABS) {
      try {
        const el = $w(tab.id);
        if (tab.id === selectedId) {
          el.style.backgroundColor = colors.sunsetCoral || '#E8845C';
          el.style.color = colors.espresso || '#3A2518';
          el.style.borderColor = colors.sunsetCoral || '#E8845C';
        } else {
          el.style.backgroundColor = colors.sandLight || '#F2E8D5';
          el.style.color = colors.espresso || '#3A2518';
          el.style.borderColor = colors.sandBase || '#E8D5B7';
        }
      } catch (e) {
        // Tab element may not exist on this page
      }
    }
    activeTabId = selectedId;
  }

  // Wire click handlers on each tab
  for (const tab of FILTER_TABS) {
    try {
      const el = $w(tab.id);
      el.onClick(() => {
        setActiveTab(tab.id);
        if (typeof onFilterChange === 'function') {
          onFilterChange(tab.roomType);
        }
        try {
          trackEvent('ugc_filter', { roomType: tab.roomType || 'all' });
        } catch (e) { /* tracker may fail */ }
        try {
          announce($w, `Showing ${tab.label} photos`);
        } catch (e) { /* a11y helper may fail */ }
      });
    } catch (e) {
      // Tab element may not exist on this page
    }
  }

  // Set initial active state
  setActiveTab('#filterTabAll');
}

// ── initSortControls ──────────────────────────────────────────────────

/**
 * Initialize sort dropdown for the UGC gallery.
 * Wires onChange handler and sets default sort to "recent".
 *
 * @param {Function} $w - Wix selector function
 * @param {Function|null|undefined} onSortChange - Callback invoked with sort value string
 */
export function initSortControls($w, onSortChange) {
  try {
    const dropdown = $w('#ugcSortDropdown');

    // Set default sort value
    dropdown.value = 'recent';

    // Wire onChange handler
    dropdown.onChange((event) => {
      const value = event && event.target ? event.target.value : 'recent';
      if (typeof onSortChange === 'function') {
        onSortChange(value);
      }
      try {
        trackEvent('ugc_sort', { sortBy: value });
      } catch (e) { /* tracker may fail */ }
      try {
        announce($w, `Sorted by ${value}`);
      } catch (e) { /* a11y helper may fail */ }
    });
  } catch (e) {
    // Dropdown element may not exist on this page
  }
}

// ── buildBeforeAfterSlider ────────────────────────────────────────────

/**
 * Build a before/after comparison slider for room makeover photos.
 * Sets image sources and ARIA labels for both comparison images.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object|null|undefined} beforePhoto - Before photo object with imageUrl and alt
 * @param {Object|null|undefined} afterPhoto - After photo object with imageUrl and alt
 */
export function buildBeforeAfterSlider($w, beforePhoto, afterPhoto) {
  try {
    // If either photo is missing, collapse the section
    if (!beforePhoto || !afterPhoto) {
      try { $w('#beforeAfterSection').collapse(); } catch (e) { /* element may not exist */ }
      return;
    }

    // Set before image
    try {
      const beforeImg = $w('#beforeImage');
      beforeImg.src = beforePhoto.imageUrl || '';
      const beforeAlt = beforePhoto.alt || 'Before photo';
      beforeImg.alt = beforeAlt;
      beforeImg.accessibility.ariaLabel = beforeAlt;
    } catch (e) { /* element may not exist */ }

    // Set after image
    try {
      const afterImg = $w('#afterImage');
      afterImg.src = afterPhoto.imageUrl || '';
      const afterAlt = afterPhoto.alt || 'After photo';
      afterImg.alt = afterAlt;
      afterImg.accessibility.ariaLabel = afterAlt;
    } catch (e) { /* element may not exist */ }

    // Set labels
    try { $w('#beforeLabel').text = 'Before'; } catch (e) { /* element may not exist */ }
    try { $w('#afterLabel').text = 'After'; } catch (e) { /* element may not exist */ }

    // Expand the section
    try { $w('#beforeAfterSection').expand(); } catch (e) { /* element may not exist */ }

    // Wire slider handle interaction
    try {
      const handle = $w('#sliderHandle');
      try {
        makeClickable(handle, () => {
          try {
            trackGalleryInteraction('before_after_slider', {
              beforeId: beforePhoto._id,
              afterId: afterPhoto._id,
            });
          } catch (e) { /* tracker may fail */ }
        });
      } catch (e) { /* a11y helper may fail */ }
    } catch (e) { /* element may not exist */ }

    try {
      trackEvent('before_after_rendered', {
        beforeId: beforePhoto._id,
        afterId: afterPhoto._id,
      });
    } catch (e) { /* tracker may fail */ }
  } catch (e) {
    // Catch-all: try to collapse on failure
    try { $w('#beforeAfterSection').collapse(); } catch (ex) { /* element may not exist */ }
  }
}

// ── initUGCGallery ────────────────────────────────────────────────────

/**
 * Initialize the full UGC gallery section.
 * Orchestrates photo cards, filter tabs, sort controls, and before/after slider.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object|null|undefined} [opts={}] - Initialization options
 * @param {Array} [opts.photos] - Array of photo objects to render
 * @param {Object} [opts.beforePhoto] - Before photo for comparison slider
 * @param {Object} [opts.afterPhoto] - After photo for comparison slider
 * @param {Function} [opts.onFilterChange] - Custom filter change callback
 * @param {Function} [opts.onSortChange] - Custom sort change callback
 */
export function initUGCGallery($w, opts) {
  const safeOpts = opts || {};

  try {
    const photos = safeOpts.photos || [];

    // Expand or collapse section based on photos availability
    if (photos.length > 0) {
      try { $w('#ugcSection').expand(); } catch (e) { /* element may not exist */ }
    }

    // Render photo cards
    try {
      renderPhotoCards($w, photos, safeOpts);
    } catch (e) { /* renderPhotoCards handles its own errors */ }

    // Initialize filter tabs
    try {
      const onFilterChange = safeOpts.onFilterChange || ((roomType) => {
        try {
          const filtered = roomType
            ? photos.filter((p) => p.roomType && p.roomType.toLowerCase() === roomType.toLowerCase())
            : photos;
          renderPhotoCards($w, filtered, safeOpts);
        } catch (e) { /* re-render may fail */ }
      });
      initFilterTabs($w, onFilterChange);
    } catch (e) { /* initFilterTabs handles its own errors */ }

    // Initialize sort controls
    try {
      const onSortChange = safeOpts.onSortChange || ((sortBy) => {
        try {
          const sorted = [...photos];
          if (sortBy === 'votes') {
            sorted.sort((a, b) => (b.votes || 0) - (a.votes || 0));
          } else if (sortBy === 'featured') {
            sorted.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
          }
          // 'recent' is default order
          renderPhotoCards($w, sorted, safeOpts);
        } catch (e) { /* re-render may fail */ }
      });
      initSortControls($w, onSortChange);
    } catch (e) { /* initSortControls handles its own errors */ }

    // Build before/after slider if photos provided
    if (safeOpts.beforePhoto || safeOpts.afterPhoto) {
      try {
        buildBeforeAfterSlider($w, safeOpts.beforePhoto, safeOpts.afterPhoto);
      } catch (e) { /* buildBeforeAfterSlider handles its own errors */ }
    }

    // Initialize lightbox for gallery images
    try {
      initImageLightbox($w, { containerId: '#ugcSection' });
    } catch (e) { /* lightbox init may fail */ }

    try {
      trackEvent('ugc_gallery_init', { photoCount: photos.length });
    } catch (e) { /* tracker may fail */ }
  } catch (e) {
    // Catch-all: try to collapse section on catastrophic failure
    try { $w('#ugcSection').collapse(); } catch (ex) { /* element may not exist */ }
  }
}
