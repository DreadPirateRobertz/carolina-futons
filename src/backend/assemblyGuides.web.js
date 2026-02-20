/**
 * @module assemblyGuides
 * @description Backend web module for serving assembly instructions
 * and care guides per product SKU. Links from Thank You page and
 * Member Page order history.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create 'AssemblyGuides' CMS collection with fields:
 *   sku (Text), title (Text), pdfUrl (URL), videoUrl (URL),
 *   estimatedTime (Text, e.g. "30 minutes"), category (Text),
 *   steps (Rich Text), tips (Rich Text)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

/**
 * Get assembly guide for a product by SKU.
 *
 * @function getAssemblyGuide
 * @param {string} sku - Product SKU
 * @returns {Promise<Object|null>} Guide with title, pdfUrl, videoUrl, steps, estimatedTime
 * @permission Anyone — post-purchase info, also useful pre-purchase
 */
export const getAssemblyGuide = webMethod(
  Permissions.Anyone,
  async (sku) => {
    try {
      if (!sku) return null;
      const cleanSku = sanitize(sku, 50);

      const result = await wixData.query('AssemblyGuides')
        .eq('sku', cleanSku)
        .find();

      if (result.items.length === 0) return null;

      const guide = result.items[0];
      return {
        _id: guide._id,
        sku: guide.sku,
        title: guide.title,
        pdfUrl: guide.pdfUrl || null,
        videoUrl: guide.videoUrl || null,
        estimatedTime: guide.estimatedTime || '',
        steps: guide.steps || '',
        tips: guide.tips || '',
        category: guide.category || '',
      };
    } catch (err) {
      console.error('Error getting assembly guide:', err);
      return null;
    }
  }
);

/**
 * Get care tips for a product category.
 *
 * @function getCareTips
 * @param {string} category - Product category (e.g. 'futon-frames', 'mattresses')
 * @returns {Promise<Array>} List of care tips for the category
 * @permission Anyone
 */
export const getCareTips = webMethod(
  Permissions.Anyone,
  async (category) => {
    try {
      if (!category) return getDefaultCareTips();
      const cleanCategory = sanitize(category, 50);

      // Category-specific care tips
      const tips = {
        'futon-frames': [
          { title: 'Wood Care', tip: 'Dust regularly with a soft cloth. Apply furniture polish every 3-6 months.' },
          { title: 'Tightening', tip: 'Check and tighten all bolts every 6 months to prevent loosening.' },
          { title: 'Sun Protection', tip: 'Avoid direct sunlight to prevent fading. Use curtains or blinds.' },
          { title: 'Weight Limits', tip: 'Respect the weight limit noted in your assembly guide. Distribute weight evenly.' },
        ],
        'mattresses': [
          { title: 'Rotation', tip: 'Rotate your mattress 180 degrees every 2-3 months for even wear.' },
          { title: 'Cleaning', tip: 'Vacuum the surface monthly. Spot clean with mild detergent.' },
          { title: 'Protection', tip: 'Use a mattress protector to guard against spills and allergens.' },
          { title: 'Airing', tip: 'Remove covers and air out your mattress every few months.' },
        ],
        'murphy-cabinet-beds': [
          { title: 'Mechanism', tip: 'Lubricate the lift mechanism annually with silicone spray.' },
          { title: 'Leveling', tip: 'Ensure the cabinet is level on the floor for smooth operation.' },
          { title: 'Weight', tip: 'Only use bedding specified for Murphy beds — heavy comforters can strain the mechanism.' },
        ],
        'platform-beds': [
          { title: 'Slats', tip: 'Check slat spacing and tightness every 6 months.' },
          { title: 'Wood Care', tip: 'Clean with a damp cloth and dry immediately. Avoid harsh chemicals.' },
          { title: 'Floor Protection', tip: 'Use felt pads under legs to protect flooring.' },
        ],
      };

      return tips[cleanCategory] || getDefaultCareTips();
    } catch (err) {
      console.error('Error getting care tips:', err);
      return getDefaultCareTips();
    }
  }
);

/**
 * Get all assembly guides (for admin/listing purposes).
 *
 * @function listAssemblyGuides
 * @returns {Promise<Array>} All guides with basic info
 * @permission Anyone
 */
export const listAssemblyGuides = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await wixData.query('AssemblyGuides')
        .ascending('category')
        .ascending('title')
        .find();

      return (result.items || []).map(g => ({
        _id: g._id,
        sku: g.sku,
        title: g.title,
        category: g.category,
        estimatedTime: g.estimatedTime,
        hasPdf: !!g.pdfUrl,
        hasVideo: !!g.videoUrl,
      }));
    } catch (err) {
      console.error('Error listing assembly guides:', err);
      return [];
    }
  }
);

// ── Internal helpers ──────────────────────────────────────────────────

function getDefaultCareTips() {
  return [
    { title: 'General Care', tip: 'Dust and clean regularly with appropriate products for the material.' },
    { title: 'Avoid Moisture', tip: 'Keep furniture away from direct moisture sources.' },
    { title: 'Sun Protection', tip: 'Minimize direct sunlight exposure to prevent fading.' },
  ];
}
