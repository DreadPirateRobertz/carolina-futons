/**
 * @module roomPlannerCTA
 * @description Room Planner CTA on the Product Detail Page.
 * Wires the #plannerCTA button to navigate to /room-planner
 * with the current product preloaded via URL query params.
 *
 * Editor elements (Product Page):
 *   #plannerCTA (Button) — "Visualize in Room Planner" CTA
 *   #plannerCTASection (Box) — container, collapsed when product has no dimensions
 *
 * URL schema: /room-planner?productId=<id>&productName=<name>&width=<w>&depth=<d>
 *
 * CF-uits: Room Planner S6 — Product Page integration
 */

export const PLANNER_PATH = '/room-planner';

/**
 * Build the room planner URL with product pre-load params.
 *
 * @param {Object} product - Wix product object from state
 * @param {string} [baseUrl='/room-planner'] - Room planner page path
 * @returns {string} Full URL with query params
 */
export function buildPlannerUrl(product, baseUrl = PLANNER_PATH) {
  if (!product?._id) return baseUrl;

  const params = new URLSearchParams();
  params.set('productId', product._id);
  if (product.name) params.set('productName', product.name);

  // Prefer dedicated planner dimensions if present, fall back to product dimensions
  const width = product.plannerWidth ?? product.width ?? null;
  const depth = product.plannerDepth ?? product.depth ?? null;
  if (width != null) params.set('width', String(Math.round(width)));
  if (depth != null) params.set('depth', String(Math.round(depth)));

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Parse room planner URL params to preloaded product data.
 * Inverse of buildPlannerUrl.
 *
 * @param {string} search - URL query string (e.g. window.location.search)
 * @returns {{ productId: string|null, productName: string|null, width: number|null, depth: number|null }}
 */
export function parsePlannerParams(search) {
  try {
    const params = new URLSearchParams(search);
    const widthRaw = params.get('width');
    const depthRaw = params.get('depth');
    const width = widthRaw != null ? Number(widthRaw) : null;
    const depth = depthRaw != null ? Number(depthRaw) : null;
    return {
      productId: params.get('productId') ?? null,
      productName: params.get('productName') ?? null,
      // Coerce NaN (e.g. from '?width=abc') to null — downstream guards expect number|null
      width: width !== null && isFinite(width) ? width : null,
      depth: depth !== null && isFinite(depth) ? depth : null,
    };
  } catch (e) {
    console.error('[roomPlannerCTA] parsePlannerParams:', e);
    return { productId: null, productName: null, width: null, depth: null };
  }
}

/**
 * Determine whether to show the planner CTA for a product.
 * Returns true when the product has enough dimension data to be useful.
 *
 * @param {Object} product
 * @returns {boolean}
 */
export function shouldShowPlannerCTA(product) {
  if (!product?._id) return false;
  const width = product.plannerWidth ?? product.width ?? null;
  const depth = product.plannerDepth ?? product.depth ?? null;
  return width != null && depth != null && width > 0 && depth > 0;
}

/**
 * Initialize the Room Planner CTA on the Product Detail Page.
 * Collapses the CTA section if the product lacks planner dimensions.
 *
 * @param {Function} $w - Wix selector
 * @param {{ product: Object }} state
 */
export function initRoomPlannerCTA($w, state) {
  const product = state?.product;

  if (!shouldShowPlannerCTA(product)) {
    try { $w('#plannerCTASection').collapse(); } catch (_) {}
    return;
  }

  try { $w('#plannerCTASection').expand(); } catch (_) {}

  const url = buildPlannerUrl(product);

  try {
    $w('#plannerCTA').onClick(() => {
      import('wix-location-frontend').then(({ to }) => {
        to(url);
      }).catch((e) => console.error('[roomPlannerCTA] navigate:', e));
    });
  } catch (e) {
    console.error('[roomPlannerCTA] initRoomPlannerCTA #plannerCTA:', e);
  }
}
