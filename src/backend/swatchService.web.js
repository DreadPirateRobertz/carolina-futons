// Backend web module for fabric swatch queries
// Queries FabricSwatches CMS collection for swatch data
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

// Get available swatches for a product, optionally filtered by color family
export const getProductSwatches = webMethod(
  Permissions.Anyone,
  async (productId, colorFamily = null, limit = 50) => {
    try {
      let query = wixData.query('FabricSwatches');

      // Filter to swatches available for this product or for all products
      query = query.or(
        wixData.query('FabricSwatches').contains('availableForProducts', productId),
        wixData.query('FabricSwatches').eq('availableForProducts', 'all')
      );

      if (colorFamily) {
        query = query.eq('colorFamily', colorFamily);
      }

      query = query.ascending('sortOrder').limit(limit);

      const results = await query.find();

      return results.items.map(item => ({
        _id: item._id,
        swatchId: item.swatchId,
        swatchName: item.swatchName,
        swatchImage: item.swatchImage,
        colorFamily: item.colorFamily,
        colorHex: item.colorHex,
        material: item.material,
        careInstructions: item.careInstructions,
      }));
    } catch (err) {
      console.error('Error fetching product swatches:', err);
      return [];
    }
  }
);

// Get distinct color families for the filter dropdown
export const getAllSwatchFamilies = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const results = await wixData.query('FabricSwatches')
        .distinct('colorFamily');

      return results.items || [];
    } catch (err) {
      console.error('Error fetching swatch families:', err);
      return [];
    }
  }
);

// Get total swatch count for a product (for "Showing X of Y" display)
export const getSwatchCount = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const results = await wixData.query('FabricSwatches')
        .or(
          wixData.query('FabricSwatches').contains('availableForProducts', productId),
          wixData.query('FabricSwatches').eq('availableForProducts', 'all')
        )
        .count();

      return results;
    } catch (err) {
      console.error('Error counting swatches:', err);
      return 0;
    }
  }
);

// Get swatch preview colors for category grid cards (3-4 color dots)
export const getSwatchPreviewColors = webMethod(
  Permissions.Anyone,
  async (productId, limit = 4) => {
    try {
      const results = await wixData.query('FabricSwatches')
        .or(
          wixData.query('FabricSwatches').contains('availableForProducts', productId),
          wixData.query('FabricSwatches').eq('availableForProducts', 'all')
        )
        .ascending('sortOrder')
        .limit(limit)
        .find();

      return results.items.map(item => ({
        colorHex: item.colorHex,
        swatchName: item.swatchName,
      }));
    } catch (err) {
      return [];
    }
  }
);
