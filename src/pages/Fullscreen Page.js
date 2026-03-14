// Fullscreen Page.js - Product Videos
// Video gallery showcasing CF product demos and conversion videos
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { announce, makeClickable } from 'public/a11yHelpers';
import { initPageSeo } from 'public/pageSeo.js';
import {
  getVideoData,
  getVideoCategories,
  filterVideosByCategory,
} from 'public/videoPageHelpers.js';

let currentCategory = null;
let allVideos = [];
let currentProductSlug = null;

$w.onReady(function () {
  initBackToTop($w);
  initPageHeading();
  initVideoGrid();
  initCategoryFilters();
  initPageSeo('product-videos');
  trackEvent('page_view', { page: 'product_videos' });
});

// ── Page Heading ────────────────────────────────────────────────────

function initPageHeading() {
  try { $w('#videoPageTitle').text = 'Product Videos'; } catch (e) {}
  try { $w('#videoPageSubtitle').text = 'Watch our futon frames, Murphy beds, and conversion mechanisms in action.'; } catch (e) {}
}

// ── Video Grid ──────────────────────────────────────────────────────

function initVideoGrid() {
  try {
    const repeater = $w('#videosRepeater');
    if (!repeater) return;

    allVideos = getVideoData();

    try { repeater.accessibility.ariaLabel = 'Product demo videos'; } catch (e) {}

    repeater.onItemReady(($item, itemData) => {
      $item('#videoTitle').text = itemData.title;

      try { $item('#videoDescription').text = itemData.description; } catch (e) {}

      if (itemData.posterUrl) {
        try {
          $item('#videoThumb').src = itemData.posterUrl;
          $item('#videoThumb').alt = `${itemData.title} product demo video`;
        } catch (e) {}
      }

      try {
        $item('#videoCategoryBadge').text = itemData.category === 'futon' ? 'Futon Frame'
          : itemData.category === 'conversion' ? 'Conversion Demo'
          : 'Overview';
      } catch (e) {}

      // Play button
      makeClickable($item('#videoThumb'), () => {
        playVideo(itemData);
      }, { ariaLabel: `Play ${itemData.title} video`, role: 'button' });
    });

    // Register product link handler once (slug updated via playVideo)
    try {
      makeClickable($w('#videoProductLink'), () => {
        if (currentProductSlug) {
          import('wix-location-frontend').then(({ to }) => {
            to(`/product-page/${currentProductSlug}`);
          });
        }
      }, { ariaLabel: 'Shop this product' });
    } catch (e) {}

    repeater.data = allVideos;
  } catch (e) {}
}

// ── Category Filters ─────────────────────────────────────────────────

function initCategoryFilters() {
  try {
    const catRepeater = $w('#videoCategoryRepeater');
    if (!catRepeater) return;

    const categories = getVideoCategories();
    const allOption = { _id: 'cat-all', id: '', label: 'All Videos' };
    const catData = [allOption, ...categories.map(c => ({ ...c, _id: `cat-${c.id}` }))];

    try { catRepeater.accessibility.ariaLabel = 'Video category filters'; } catch (e) {}
    try { catRepeater.accessibility.role = 'tablist'; } catch (e) {}

    catRepeater.onItemReady(($item, itemData) => {
      $item('#categoryLabel').text = itemData.label;
      try { $item('#categoryLabel').accessibility.role = 'tab'; } catch (e) {}
      try { $item('#categoryLabel').accessibility.ariaLabel = `Filter: ${itemData.label}`; } catch (e) {}
      try { $item('#categoryLabel').accessibility.tabIndex = 0; } catch (e) {}

      const selectCategory = () => {
        currentCategory = itemData.id != null && itemData.id !== '' ? itemData.id : null;
        applyFilter();
        trackEvent('video_filter', { category: itemData.label });
        announce($w, `Showing ${itemData.label.toLowerCase()}`);
      };

      $item('#categoryLabel').onClick(selectCategory);
      try {
        $item('#categoryLabel').onKeyPress((event) => {
          if (event.key === 'Enter' || event.key === ' ') selectCategory();
        });
      } catch (e) {}
    });
    catRepeater.data = catData;
  } catch (e) {}
}

function applyFilter() {
  try {
    const repeater = $w('#videosRepeater');
    if (!repeater) return;

    const filtered = filterVideosByCategory(allVideos, currentCategory);

    if (filtered.length === 0) {
      try {
        $w('#videoNoResults').text = 'No videos in this category.';
        $w('#videoNoResults').expand();
      } catch (e) {}
      announce($w, 'No videos found');
    } else {
      try { $w('#videoNoResults').collapse(); } catch (e) {}
      announce($w, `${filtered.length} video${filtered.length !== 1 ? 's' : ''} found`);
    }

    repeater.data = filtered;
  } catch (e) {}
}

// ── Video Player ────────────────────────────────────────────────────

function playVideo(videoData) {
  try {
    const player = $w('#videoPlayer');
    if (!player || !videoData.videoUrl) return;

    player.src = videoData.videoUrl;
    player.play();
    trackEvent('video_play', { title: videoData.title, category: videoData.category });
    announce($w, `Now playing: ${videoData.title}`);

    try { $w('#nowPlayingTitle').text = videoData.title; } catch (e) {}
    try { $w('#videoPlayerContainer').expand(); } catch (e) {}

    // Update product link (handler registered once in initVideoGrid)
    if (videoData.productSlug) {
      currentProductSlug = videoData.productSlug;
      try {
        $w('#videoProductLink').label = `Shop the ${videoData.title}`;
        $w('#videoProductLink').show();
      } catch (e) {}
    } else {
      currentProductSlug = null;
      try { $w('#videoProductLink').hide(); } catch (e) {}
    }
  } catch (e) {}
}
