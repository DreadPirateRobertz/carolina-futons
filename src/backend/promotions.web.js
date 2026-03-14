/** @module promotions - Backend module for promotional campaigns and flash sales.
 *
 * Queries the Promotions CMS collection for active campaigns (date-range filtered).
 * Supports standard promotions (with enriched product data) and flash sales
 * (time-limited, optionally category-scoped, sorted by urgency).
 *
 * CMS collection: Promotions (fields: isActive, type, startDate, endDate,
 * title, subtitle, theme, heroImage, discountCode, discountPercent,
 * productIds, categoryScope, urgencyThreshold, bannerMessage, ctaUrl, ctaText).
 *
 * Dependencies: wix-web-module, wix-data, backend/utils/sanitize.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { validateSlug } from 'backend/utils/sanitize';

/**
 * Get the currently active promotion, if any.
 * Returns the most recently started active promotion whose date range includes today.
 * Enriches the result with full product data (up to 50 products) by resolving
 * the comma-separated productIds field against the Stores/Products collection.
 * @returns {Promise<{_id: string, title: string, subtitle: string, theme: string, heroImage: string, startDate: Date, endDate: Date, discountCode: string, discountPercent: number, ctaUrl: string, ctaText: string, products: Array<Object>}|null>} Promotion object or null
 * @permission Anyone
 */
export const getActivePromotion = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const now = new Date();

      const results = await wixData.query('Promotions')
        .eq('isActive', true)
        .le('startDate', now)
        .ge('endDate', now)
        .descending('startDate')
        .limit(1)
        .find();

      if (results.items.length === 0) return null;

      const promo = results.items[0];

      // Parse comma-separated product IDs and fetch product details
      let products = [];
      if (promo.productIds) {
        const ids = promo.productIds.split(',').map(id => id.trim()).filter(Boolean).slice(0, 50);
        if (ids.length > 0) {
          const productResults = await wixData.query('Stores/Products')
            .hasSome('_id', ids)
            .limit(ids.length)
            .find();

          products = productResults.items.map(item => ({
            _id: item._id,
            name: item.name,
            slug: item.slug,
            price: item.price,
            formattedPrice: item.formattedPrice,
            discountedPrice: item.discountedPrice,
            formattedDiscountedPrice: item.formattedDiscountedPrice,
            mainMedia: item.mainMedia,
          }));
        }
      }

      return {
        _id: promo._id,
        title: promo.title,
        subtitle: promo.subtitle,
        theme: promo.theme,
        heroImage: promo.heroImage,
        startDate: promo.startDate,
        endDate: promo.endDate,
        discountCode: promo.discountCode,
        discountPercent: promo.discountPercent,
        bannerMessage: promo.bannerMessage,
        ctaUrl: promo.ctaUrl,
        ctaText: promo.ctaText,
        products,
      };
    } catch (err) {
      console.error('Error fetching active promotion:', err);
      return null;
    }
  }
);

/**
 * Get active flash sale promotions, optionally filtered by category.
 * Returns deals sorted by endDate ascending (soonest ending first).
 * @param {string} [categorySlug] - Optional category slug to filter by.
 * @returns {Promise<Array<{_id: string, title: string, subtitle: string, type: string, startDate: Date, endDate: Date, discountCode: string, discountPercent: number, bannerMessage: string, categoryScope: string, urgencyThreshold: number, ctaUrl: string, ctaText: string}>>}
 */
export const getFlashSales = webMethod(
  Permissions.Anyone,
  async (categorySlug) => {
    try {
      const now = new Date();

      let query = wixData.query('Promotions')
        .eq('isActive', true)
        .eq('type', 'flash_sale')
        .le('startDate', now)
        .ge('endDate', now)
        .ascending('endDate')
        .limit(10);

      const results = await query.find();

      let items = results.items;

      // Filter by category if provided
      if (categorySlug) {
        const cleanSlug = validateSlug(categorySlug);
        if (!cleanSlug) return [];
        items = items.filter(item =>
          !item.categoryScope || item.categoryScope === cleanSlug
        );
      }

      return items.map(promo => ({
        _id: promo._id,
        title: promo.title,
        subtitle: promo.subtitle,
        type: promo.type,
        startDate: promo.startDate,
        endDate: promo.endDate,
        discountCode: promo.discountCode,
        discountPercent: promo.discountPercent,
        bannerMessage: promo.bannerMessage,
        categoryScope: promo.categoryScope,
        urgencyThreshold: promo.urgencyThreshold,
        ctaUrl: promo.ctaUrl,
        ctaText: promo.ctaText,
      }));
    } catch (err) {
      console.error('Error fetching flash sales:', err);
      return [];
    }
  }
);
