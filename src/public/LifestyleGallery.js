// LifestyleGallery.js - "See It In Your Room" lifestyle photography section
// Renders curated room-staged scenes on the Product Page.
// Wix Velo compatible — uses $w selectors and Repeater API.

import { getLifestyleScenes, getLifestyleOverlay } from 'public/lifestyleImages.js';
import { trackEvent } from 'public/engagementTracker';

/**
 * Initialize the lifestyle gallery section on the Product Page.
 * Shows room-staged photography for the product's primary category.
 * @param {Function} $w - Wix $w selector function
 * @param {Object} state - Page state with product data
 * @param {Object} state.product - Product object
 * @param {string} state.product._id - Product ID
 * @param {string} state.product.name - Product display name
 * @param {string[]} state.product.collections - Category slugs
 */
export function initLifestyleGallery($w, state) {
  try {
    const section = $w('#lifestyleSection');
    const product = state?.product;

    if (!product || !product.collections || product.collections.length === 0) {
      try { section.collapse(); } catch (e) { /* element may not exist */ }
      return;
    }

    const category = product.collections[0];
    const scenes = getLifestyleScenes(category, 4);

    // Section title and subtitle
    try { $w('#lifestyleTitle').text = 'See It In Your Room'; } catch (e) { /* optional element */ }
    try { $w('#lifestyleSubtitle').text = `Imagine the ${product.name} in your space`; } catch (e) { /* optional element */ }

    // Populate repeater with scene data
    const repeater = $w('#lifestyleRepeater');
    repeater.data = scenes.map((scene, i) => ({
      _id: `scene-${i}`,
      ...scene,
    }));

    // Render each repeater item
    repeater.onItemReady(($item, itemData) => {
      try { $item('#lifestyleImage').src = itemData.url; } catch (e) { /* optional */ }
      try { $item('#lifestyleImage').alt = itemData.alt; } catch (e) { /* optional */ }
      try {
        const roomLabel = itemData.room.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        $item('#lifestyleRoomLabel').text = roomLabel;
      } catch (e) { /* optional */ }
      try { $item('#lifestyleStyleLabel').text = itemData.style; } catch (e) { /* optional */ }
    });

    // Accessibility
    try {
      section.accessibility = section.accessibility || {};
      section.accessibility.ariaLabel = 'Lifestyle room-staged product photography gallery';
    } catch (e) { /* optional */ }

    // Show section
    try { section.expand(); } catch (e) { /* optional */ }

    // Track view
    trackEvent('lifestyle_gallery_view', {
      productId: product._id,
      category,
      sceneCount: scenes.length,
    });
  } catch (e) {
    // Graceful degradation — hide section on any unhandled error
    try { $w('#lifestyleSection').collapse(); } catch (e2) { /* nothing */ }
  }
}
