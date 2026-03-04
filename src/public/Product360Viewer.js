// Product360Viewer.js — 360° drag-to-rotate product viewer
// Embeds an image-sequence spin viewer via Wix HtmlComponent.
// Graceful degradation: collapses if no 360 images are available.

import { get360Images, has360View } from 'public/product360Data.js';
import { announce } from 'public/a11yHelpers.js';

/**
 * Initialize the 360° product viewer on the product page.
 * Follows Wix Velo init pattern: receives $w and state, returns { destroy }.
 *
 * Required Wix Studio elements:
 * - #viewer360Section: Box — outer wrapper (starts collapsed)
 * - #viewer360Title: Text — section heading
 * - #view360Btn: Button — "View 360°" CTA
 * - #viewer360Container: Box — viewer wrapper (starts collapsed)
 * - #viewer360Embed: HtmlComponent — embeds canvas-based spin viewer
 * - #viewer360Hint: Text — "Drag to rotate" instruction
 *
 * @param {Function} $w - Wix selector
 * @param {Object} state - Product page state
 * @returns {Promise<{destroy: Function}>}
 */
export async function initProduct360Viewer($w, state) {
  let mounted = true;

  try {
    if (!state?.product) {
      try { $w('#viewer360Section').collapse(); } catch (e) {}
      try { $w('#view360Btn').hide(); } catch (e) {}
      return { destroy() {} };
    }

    const images = get360Images(state.product.slug || state.product._id);

    if (!images || images.length === 0) {
      try { $w('#viewer360Section').collapse(); } catch (e) {}
      try { $w('#view360Btn').hide(); } catch (e) {}
      return { destroy() {} };
    }

    const productName = state.product.name || 'Product';

    // Section setup
    try { $w('#viewer360Title').text = '360° View'; } catch (e) {}
    try { $w('#viewer360Hint').text = 'Drag to rotate'; } catch (e) {}
    try { $w('#viewer360Section').accessibility.role = 'region'; } catch (e) {}
    try { $w('#viewer360Section').accessibility.ariaLabel = '360 degree product view'; } catch (e) {}
    try { $w('#viewer360Section').expand(); } catch (e) {}

    // Button
    try { $w('#view360Btn').show(); } catch (e) {}
    try { $w('#view360Btn').accessibility.ariaLabel = `View ${productName} in 360 degrees`; } catch (e) {}

    try {
      $w('#view360Btn').onClick(() => {
        if (!mounted) return;
        try { $w('#viewer360Container').expand(); } catch (e) {}
        try {
          $w('#viewer360Embed').postMessage({
            type: 'load360',
            images,
            productName,
          });
        } catch (e) {}
        try { announce($w, `360 degree view of ${productName} loaded. Drag to rotate.`); } catch (e) {}
      });
    } catch (e) {}

    return {
      destroy() {
        mounted = false;
        try { $w('#viewer360Container').collapse(); } catch (e) {}
      },
    };
  } catch (e) {
    try { $w('#viewer360Section').collapse(); } catch (e2) {}
    try { $w('#view360Btn').hide(); } catch (e2) {}
    return { destroy() {} };
  }
}
