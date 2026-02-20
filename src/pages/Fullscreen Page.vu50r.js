// Fullscreen Page.vu50r.js - Product Videos / Gallery Fullscreen View
// Full-screen product video and image gallery with engagement features
import { getRelatedProducts } from 'backend/productRecommendations.web';

$w.onReady(function () {
  initVideoGallery();
  initProductVideoGrid();
});

// ── Product Video Gallery ───────────────────────────────────────────
// Full-screen video player with product info overlay

function initVideoGallery() {
  try {
    const videoPlayer = $w('#videoPlayer');
    if (!videoPlayer) return;

    // Auto-play on visibility
    videoPlayer.onPlay(() => {
      try { $w('#videoOverlay').hide('fade', { duration: 300 }); } catch (e) {}
    });

    videoPlayer.onPause(() => {
      try { $w('#videoOverlay').show('fade', { duration: 300 }); } catch (e) {}
    });

    videoPlayer.onEnded(() => {
      try {
        $w('#videoOverlay').show('fade', { duration: 300 });
        // Show "shop this product" CTA after video ends
        $w('#videoShopCTA').show('fade', { duration: 400 });
      } catch (e) {}
    });
  } catch (e) {}
}

// ── Product Video Grid ──────────────────────────────────────────────
// Grid of product demo videos organized by category

function initProductVideoGrid() {
  try {
    const videosRepeater = $w('#videosRepeater');
    if (!videosRepeater) return;

    videosRepeater.onItemReady(($item, itemData) => {
      // Video thumbnail
      if (itemData.thumbnail) {
        $item('#videoThumb').src = itemData.thumbnail;
        $item('#videoThumb').alt = `${itemData.title} product demo video - Carolina Futons`;
      }

      $item('#videoTitle').text = itemData.title;

      if (itemData.duration) {
        try { $item('#videoDuration').text = itemData.duration; } catch (e) {}
      }

      // Category badge
      if (itemData.category) {
        try {
          $item('#videoCategoryBadge').text = itemData.category;
          $item('#videoCategoryBadge').show();
        } catch (e) {}
      }

      // Click to play
      $item('#videoThumb').onClick(() => {
        playVideo(itemData);
      });
    });

    // Category filter for videos
    initVideoFilters();
  } catch (e) {}
}

function initVideoFilters() {
  try {
    const filterBtns = {
      '#videoFilterAll': '',
      '#videoFilterFutons': 'futon',
      '#videoFilterMurphy': 'murphy',
      '#videoFilterPlatform': 'platform',
    };

    Object.entries(filterBtns).forEach(([btnId, category]) => {
      try {
        $w(btnId).onClick(() => {
          filterVideosByCategory(category);
          // Highlight active filter
          Object.keys(filterBtns).forEach(id => {
            try { $w(id).style.fontWeight = id === btnId ? '700' : '400'; } catch (e) {}
          });
        });
      } catch (e) {}
    });
  } catch (e) {}
}

function filterVideosByCategory(category) {
  try {
    const dataset = $w('#videosDataset');
    if (!dataset) return;

    if (!category) {
      dataset.setFilter(null);
    } else {
      const wixData = require('wix-data');
      dataset.setFilter(wixData.filter().contains('category', category));
    }
  } catch (e) {}
}

function playVideo(videoData) {
  try {
    const player = $w('#videoPlayer');
    if (player && videoData.videoUrl) {
      player.src = videoData.videoUrl;
      player.play();

      // Show product link
      if (videoData.productSlug) {
        $w('#videoProductLink').onClick(() => {
          import('wix-location').then(({ to }) => {
            to(`/product-page/${videoData.productSlug}`);
          });
        });
        $w('#videoProductLink').show();
      }
    }
  } catch (e) {}
}
