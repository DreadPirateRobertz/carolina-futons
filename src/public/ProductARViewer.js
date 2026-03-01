// ProductARViewer — 3D product visualization using <model-viewer> in Wix HtmlComponent.
// Lazy loads on user interaction. Graceful degradation if AR unavailable.

import { getModel3DForProduct } from 'public/models3d.js';
import { isProductAREnabled } from 'public/arSupport.js';

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

  // Guard: no product or AR not supported
  if (!state.product || !isProductAREnabled(state.product)) {
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

  // On click: expand viewer and send model data
  btn.onClick(() => {
    container.expand();
    viewer.postMessage({
      type: 'loadModel',
      glbUrl: model.glbUrl,
      usdzUrl: model.usdzUrl,
      title: state.product.name,
      dimensions: model.dimensions,
    });
  });

  return {
    destroy() {
      container.collapse();
    },
  };
}
