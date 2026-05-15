/**
 * @module catalogPriceFix
 * @description Fix call-for-price products that use $1.00 placeholder.
 *
 * Native Wix gallery widgets (Pro Gallery) render prices directly from catalog
 * data. Products with price=$1.00 show "$1.00" in these widgets instead of
 * "Call for Pricing". Setting price to $0 triggers Wix's built-in "Price
 * unavailable" behavior in native widgets, while our custom Velo code already
 * handles price <= $1 via isCallForPrice().
 *
 * CF-azrt: Native Wix gallery price audit
 *
 * ## ⚠ V1↔V3 sync caveats (cf-3pwy F1 / cf-8c2f)
 *
 * This module writes via the Wix Stores **V1** SDK (`wix-stores-backend` →
 * `products.updateProductFields`). The Next.js front-end (`carolina-futons-web`)
 * reads through the **V3** SDK (`@wix/auto_sdk_stores_products` → `actualPriceRange`,
 * `compareAtPriceRange`, `priceData`). Wix synchronizes V1 writes to V3 reads
 * internally, but two specific gaps apply when this migration runs:
 *
 *   1. **price=0 surfaces differently across SDKs.** V1 `price=0` is a number;
 *      native Wix Pro Gallery shows "Price unavailable". V3 `actualPriceRange`
 *      may surface as `Out of stock` rather than as `$0.00` display, depending
 *      on the storefront component. Verified safe in cfutons Velo widgets;
 *      **NOT verified post-cutover in cfw V3 widgets.** Re-spot-check after
 *      DNS flip if any call-for-price products still have price=$1 to migrate.
 *
 *   2. **Per-variant prices stay frozen.** `products.updateProductFields(id, {price: 0})`
 *      writes only the parent product price. Variants inherit pricing unless
 *      they have their own override. If any call-for-price product has variant-level
 *      prices set in V1, those overrides will continue to surface in V3 reads.
 *      As of audit date (2026-05-10) no call-for-price product in the catalog
 *      has variant-level price overrides, but verify before re-running.
 *
 * **Pre-cutover guidance**: do not schedule this migration in the cf-3qt.8 cutover
 * window. Run it well before or well after — never in the same hour as the DNS flip,
 * to avoid amplifying any V1↔V3 sync lag during the transition.
 *
 * @requires wix-web-module
 * @requires wix-stores-backend
 */
import { Permissions, webMethod } from 'wix-web-module';
import { products } from 'wix-stores-backend';

/**
 * Find all products with price exactly $1.00 (call-for-price placeholder).
 * @returns {Promise<{success: boolean, products: Array<{_id: string, name: string, price: number, slug: string}>}>}
 */
export const findCallForPriceProducts = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const result = await products.queryProducts()
        .le('price', 1)
        .gt('price', 0)
        .find();

      const items = result.items.map(p => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        slug: p.slug,
      }));

      return { success: true, products: items };
    } catch (err) {
      console.error('[catalogPriceFix] findCallForPriceProducts failed:', err?.message);
      return { success: false, products: [], error: err?.message };
    }
  }
);

/**
 * Update call-for-price products from $1.00 to $0.
 * This makes native Wix gallery widgets show "Price unavailable" instead of "$1.00".
 * Our custom Velo code already handles price <= $1 via isCallForPrice().
 *
 * @param {boolean} [dryRun=true] - When true, only reports what would change
 * @returns {Promise<{success: boolean, updated: string[], skipped: string[], dryRun: boolean}>}
 */
export const fixCallForPricePlaceholders = webMethod(
  Permissions.Admin,
  async (dryRun = true) => {
    try {
      const result = await products.queryProducts()
        .le('price', 1)
        .gt('price', 0)
        .find();

      const updated = [];
      const skipped = [];

      for (const product of result.items) {
        const label = `${product.name} (${product._id}, price=${product.price})`;

        if (dryRun) {
          updated.push(`[DRY RUN] Would update: ${label} → price=0`);
          continue;
        }

        try {
          // cf-3pwy F1 / cf-8c2f: V1 write — see module-level caveats. The
          // V1↔V3 sync should propagate `price=0` to the Headless reader,
          // but per-variant overrides will NOT update from this call.
          await products.updateProductFields(product._id, { price: 0 });
          updated.push(`Updated: ${label} → price=0`);
        } catch (err) {
          skipped.push(`Failed: ${label} — ${err?.message}`);
        }
      }

      return { success: true, updated, skipped, dryRun };
    } catch (err) {
      console.error('[catalogPriceFix] fixCallForPricePlaceholders failed:', err?.message);
      return { success: false, updated: [], skipped: [], dryRun, error: err?.message };
    }
  }
);
