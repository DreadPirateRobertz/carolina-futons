// Backend web module for promotional lightbox system
// Queries the Promotions CMS collection for active campaigns
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

// Get the currently active promotion (if any)
// Returns the first active promotion whose date range includes today, or null
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
        const ids = promo.productIds.split(',').map(id => id.trim()).filter(Boolean);
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
