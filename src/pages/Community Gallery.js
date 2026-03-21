// Community Gallery Page — /gallery
// Browse approved customer photos by room type.
// Hero → room type filter tabs → masonry photo grid → lightbox on click → load more.

import {
  getGalleryPhotos,
  getGalleryRoomTypes,
  GALLERY_ROOM_TYPES,
} from 'backend/communityGalleryService.web';
import wixLocationFrontend from 'wix-location-frontend';
import { announce } from 'public/a11yHelpers';
import { prioritizeSections } from 'public/performanceHelpers.js';
import { trackEvent } from 'public/engagementTracker';

const GALLERY_PAGE_SIZE = 12;

let _currentRoomType = null; // null = 'all'
let _currentPage = 1;
let _hasMore = false;

$w.onReady(async function () {
  trackEvent('page_view', { page: 'community-gallery' });

  // Read ?roomType query param for deep-link support
  try {
    const params = wixLocationFrontend.query;
    if (params && params.roomType && GALLERY_ROOM_TYPES.includes(params.roomType)) {
      _currentRoomType = params.roomType;
    }
  } catch (e) {}

  const sections = [
    { name: 'galleryFilters', init: initFilters, critical: true },
    { name: 'galleryGrid',    init: loadPhotos,  critical: true },
    { name: 'galleryLoadMore', init: initLoadMore, critical: false },
  ];

  try {
    await prioritizeSections(sections, {
      onError: (section, reason) => {
        console.error(`[Community Gallery] Section ${section} failed:`, reason);
      },
    });
  } catch (err) {
    console.error('[Community Gallery] prioritizeSections failed:', err);
  }
});

// ── Room type filter tabs ────────────────────────────────────────────────

async function initFilters() {
  try {
    const result = await getGalleryRoomTypes();
    if (!result || !result.success) return;

    const allOption = { slug: 'all', label: 'All Rooms' };
    const roomTypes = [allOption, ...(result.roomTypes || [])];

    const repeater = $w('#galleryFilterRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      try {
        $item('#filterTabLabel').text = itemData.label;
        const isActive = itemData.slug === (_currentRoomType ?? 'all');
        try { $item('#filterTab').style.backgroundColor = isActive ? '#222' : ''; } catch (e) {}
        $item('#filterTab').onClick(async () => {
          _currentRoomType = itemData.slug === 'all' ? null : itemData.slug;
          _currentPage = 1;
          await loadPhotos();
          // Update active state
          try { repeater.forEachItem(($i, d) => {
            try { $i('#filterTab').style.backgroundColor = d.slug === (itemData.slug) ? '#222' : ''; } catch (e) {}
          }); } catch (e) {}
          announce(`Showing ${itemData.label}`);
        });
      } catch (e) {}
    });

    repeater.data = roomTypes.map((rt, i) => ({ ...rt, _id: `filter-${i}` }));
  } catch (err) {
    console.error('[Community Gallery] initFilters failed:', err);
  }
}

// ── Photo grid ───────────────────────────────────────────────────────────

async function loadPhotos() {
  try {
    try { $w('#galleryLoadingSpinner').show(); } catch (e) {}
    try { $w('#galleryEmptyState').hide(); } catch (e) {}

    const result = await getGalleryPhotos(_currentRoomType, _currentPage, GALLERY_PAGE_SIZE);

    try { $w('#galleryLoadingSpinner').hide(); } catch (e) {}

    if (!result || !result.success) {
      showEmptyState();
      return;
    }

    const photos = result.photos || [];
    if (photos.length === 0 && _currentPage === 1) {
      showEmptyState();
      return;
    }

    _hasMore = result.hasMore || false;

    const repeater = $w('#galleryMasonryRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      try { $item('#galleryPhotoImg').src = itemData.photoUrl; } catch (e) {}
      try {
        $item('#galleryPhotoImg').alt =
          `${itemData.customerName}'s ${itemData.roomType} — ${itemData.photoCaption || 'Customer photo'}`;
      } catch (e) {}
      try { $item('#galleryCustomerName').text = itemData.customerName; } catch (e) {}
      try { $item('#galleryRoomTypeBadge').text = itemData.roomType || ''; } catch (e) {}
      try {
        if (itemData.productName) {
          $item('#galleryProductLink').text = itemData.productName;
          $item('#galleryProductLink').onClick(() => {
            if (itemData.productSlug) {
              wixLocationFrontend.to(`/product-page/${itemData.productSlug}`);
            }
          });
        } else {
          try { $item('#galleryProductLink').hide(); } catch (e2) {}
        }
      } catch (e) {}
      if (itemData.isFeatured) {
        try { $item('#galleryFeaturedBadge').show(); } catch (e) {}
      }

      // Click → lightbox
      try {
        $item('#galleryPhotoCard').onClick(() => {
          openLightbox(itemData);
        });
      } catch (e) {}
    });

    if (_currentPage === 1) {
      repeater.data = photos.map(p => ({ ...p, _id: p.id }));
    } else {
      // Append for load-more
      repeater.data = [...(repeater.data || []), ...photos.map(p => ({ ...p, _id: p.id }))];
    }

    // Update load-more button visibility
    try {
      if (_hasMore) {
        $w('#galleryLoadMoreBtn').show();
      } else {
        $w('#galleryLoadMoreBtn').hide();
      }
    } catch (e) {}

    try {
      const total = result.total || photos.length;
      $w('#galleryPhotoCount').text = `${total} photo${total !== 1 ? 's' : ''}`;
    } catch (e) {}
  } catch (err) {
    console.error('[Community Gallery] loadPhotos failed:', err);
    showEmptyState();
  }
}

// ── Load more ────────────────────────────────────────────────────────────

function initLoadMore() {
  try {
    $w('#galleryLoadMoreBtn').onClick(async () => {
      if (!_hasMore) return;
      _currentPage += 1;
      await loadPhotos();
      trackEvent('gallery_load_more', { page: _currentPage, roomType: _currentRoomType });
    });
    // Hide initially — loadPhotos will reveal when needed
    try { $w('#galleryLoadMoreBtn').hide(); } catch (e) {}
  } catch (err) {
    console.error('[Community Gallery] initLoadMore failed:', err);
  }
}

// ── Lightbox ─────────────────────────────────────────────────────────────

function openLightbox(photo) {
  try {
    $w('#galleryLightboxImage').src = photo.photoUrl;
    try {
      $w('#galleryLightboxImage').alt =
        `${photo.customerName}'s ${photo.roomType} — ${photo.photoCaption || 'Customer photo'}`;
    } catch (e) {}
    try { $w('#galleryLightboxCaption').text = photo.photoCaption || ''; } catch (e) {}
    try { $w('#galleryLightboxCustomer').text = photo.customerName || ''; } catch (e) {}
    try {
      if (photo.productName && photo.productSlug) {
        $w('#galleryLightboxProductLink').text = photo.productName;
        $w('#galleryLightboxProductLink').onClick(() => {
          wixLocationFrontend.to(`/product-page/${photo.productSlug}`);
          closeLightbox();
        });
      }
    } catch (e) {}

    $w('#galleryLightbox').expand();
    announce(`Photo by ${photo.customerName}`);

    // Close handlers
    try {
      $w('#galleryLightboxClose').onClick(closeLightbox);
    } catch (e) {}
    try {
      $w('#galleryLightboxOverlay').onClick(closeLightbox);
    } catch (e) {}

    trackEvent('gallery_lightbox_open', { photoId: photo.id, roomType: photo.roomType });
  } catch (err) {
    console.error('[Community Gallery] openLightbox failed:', err);
  }
}

function closeLightbox() {
  try { $w('#galleryLightbox').collapse(); } catch (e) {}
}

// ── Empty state ──────────────────────────────────────────────────────────

function showEmptyState() {
  try {
    const label = _currentRoomType || 'this room type';
    $w('#galleryEmptyState').show();
    try {
      $w('#galleryEmptyStateText').text =
        _currentRoomType
          ? `No photos yet for ${label}. Be the first to share!`
          : 'No approved photos yet. Check back soon!';
    } catch (e) {}
    try { $w('#galleryLoadMoreBtn').hide(); } catch (e) {}
  } catch (err) {
    console.error('[Community Gallery] showEmptyState failed:', err);
  }
}
