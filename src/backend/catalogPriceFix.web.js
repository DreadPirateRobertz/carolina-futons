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
