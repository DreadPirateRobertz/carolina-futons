// Fullscreen Page.vu50r.js - Product Videos / Gallery Fullscreen View
// Full-screen product video and image gallery with engagement features
import wixData from 'wix-data';
import { trackEvent, trackGalleryInteraction } from 'public/engagementTracker';

$w.onReady(function () {
  initVideoGallery();
  initProductVideoGrid();
  trackEvent('page_view', { page: 'product_videos' });
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

    // Register product link handler once (slug updated via playVideo)
    try {
      $w('#videoProductLink').onClick(() => {
        if (currentVideoProductSlug) {
          import('wix-location-frontend').then(({ to }) => {
            to(`/product-page/${currentVideoProductSlug}`);
          });
        }
      });
    } catch (e) {}

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
      dataset.setFilter(wixData.filter());
    } else {
      dataset.setFilter(wixData.filter().contains('category', category));
    }
  } catch (e) {}
}

let currentVideoProductSlug = null;

function playVideo(videoData) {
  try {
    const player = $w('#videoPlayer');
    if (player && videoData.videoUrl) {
      player.src = videoData.videoUrl;
      player.play();
      trackGalleryInteraction('video_play');
      trackEvent('video_play', { title: videoData.title, category: videoData.category });

      // Update product link slug (handler registered once in initProductVideoGrid)
      if (videoData.productSlug) {
        currentVideoProductSlug = videoData.productSlug;
        $w('#videoProductLink').show();
      }
    }
  } catch (e) {}
}
