// ProductARViewer — 3D product visualization using <model-viewer> in Wix HtmlComponent.
// Lazy loads on user interaction. Graceful degradation if AR unavailable.

import { getModel3DForProduct } from 'public/models3d.js';
import { checkWebARSupport, isProductAREnabled } from 'public/arSupport.js';

/** Strip HTML tags from a string for safe postMessage payload */
function safeText(str) {
  return String(str || '').replace(/<[^>]*>/g, '').trim().slice(0, 200);
}

/**
 * Initialize the AR product viewer on the product page.
 * Follows Wix Velo init pattern: receives $w and state, returns { destroy }.
 *
 * Required Wix Studio elements:
 * - #viewInRoomBtn: Button — "View in Room" CTA
 * - #arViewerContainer: Box — wrapper (starts collapsed)
 * - #productARViewer: HtmlComponent — embeds <model-viewer>
 */
export async function initProductARViewer($w, state) {
  const btn = $w('#viewInRoomBtn');
  const container = $w('#arViewerContainer');
  const viewer = $w('#productARViewer');

  // Guard: no product, browser can't render, or product not AR-eligible
  if (!checkWebARSupport() || !state.product || !isProductAREnabled(state.product)) {
    btn.hide();
    container.collapse();
    return { destroy() {} };
  }

  const model = getModel3DForProduct(state.product._id);
  if (!model) {
    btn.hide();
    container.collapse();
    return { destroy() {} };
  }

  // Show the "View in Room" button
  btn.show();

  // Track mounted state to prevent stale click handlers on re-init
  let mounted = true;

  // On click: expand viewer and send model data
  btn.onClick(() => {
    if (!mounted) return;
    container.expand();
    viewer.postMessage({
      type: 'loadModel',
      glbUrl: model.glbUrl,
      usdzUrl: model.usdzUrl,
      title: safeText(state.product.name),
      dimensions: model.dimensions,
    });
  });

  return {
    destroy() {
      mounted = false;
      container.collapse();
    },
  };
}
