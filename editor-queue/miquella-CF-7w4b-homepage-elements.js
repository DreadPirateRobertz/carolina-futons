/**
 * CF-7w4b (P1): Homepage element hookup — 43 missing Velo nicknames
 * Priority: P1 (many homepage features non-functional without these)
 * Assigned: miquella (code) → melania (editor)
 *
 * ITERATE 5x: Create elements, preview, fix, repeat.
 * Group by visual section for easier editor workflow.
 *
 * === SECTION 1: Hero (1 element) ===
 * - #heroOverlay — Box over hero image, semi-transparent (rgba(58,37,24,0.6))
 *   Purpose: text readability overlay on hero background
 *
 * === SECTION 2: Featured Products (6 elements inside #featuredRepeater) ===
 * - #featuredTitle — Text (H2): "Our Favorite Finds" (above repeater)
 * - #featuredSubtitle — Text: subtitle (above repeater)
 * Inside each repeater item:
 * - #featuredRibbon — Text: badge ribbon (Featured/New/Clearance)
 * - #featuredColorText — Text: "X finishes available"
 * - #featuredSwatchContainer — Box: color swatch circles container
 * - #featuredQuickViewBtn — Button: "Quick View"
 *
 * === SECTION 3: Featured Quick View Modal (7 elements) ===
 * Create as a Box (hidden by default, overlay/modal style):
 * - #featuredQuickViewModal — Box container (z-index high, centered, hidden)
 *   Inside:
 *   - #featuredQvImage — Image
 *   - #featuredQvName — Text (product name)
 *   - #featuredQvPrice — Text (price)
 *   - #featuredQvViewFull — Button: "View Full Details"
 *   - #featuredQvAddToCart — Button: "Add to Cart"
 *   - #featuredQvClose — Button: "X" (top-right)
 *
 * === SECTION 4: Category Showcase (4 elements) ===
 * Inside #categoryRepeater:
 * - #categoryCardImage — Image: category card image
 * - #categoryCard — Box: card container (for hover effects)
 * Static cards (same row/grid):
 * - #categoryWallHuggers — Box: Wall Huggers category card
 * - #categoryUnfinished — Box: Unfinished Wood category card
 *
 * === SECTION 5: Recently Viewed (1 element) ===
 * - #recentRepeater — Repeater: set ID on existing repeater in section
 *
 * === SECTION 6: Trust Bar (15 elements) ===
 * Inside #trustBar container, create 5 trust signal groups:
 * For i = 1..5:
 * - #trustItem{i} — Box: container for one trust signal
 * - #trustIcon{i} — Text/Image: icon (checkmark, shield, truck, etc.)
 * - #trustText{i} — Text: label ("Free Shipping", "Made in USA", etc.)
 *
 * === SECTION 7: Testimonials (4 elements) ===
 * - #testimonialSection — Section container (wrap existing testimonials)
 * Inside #testimonialRepeater:
 * - #testimonialPhoto — Image: customer photo
 * - #testimonialRating — Text: star rating display
 * Outside repeater:
 * - #testimonialSchemaScript — HtmlComponent (hidden, for JSON-LD)
 *
 * === SECTION 8: Video Showcase (3 elements) ===
 * - #videoThumb1 — Image/Box: first video thumbnail
 * - #videoThumb2 — Image/Box: second video thumbnail
 * - #videoThumb3 — Image/Box: third video thumbnail
 *
 * === SECTION 9: Swatch Promo Section (4 elements) ===
 * Create new section:
 * - #swatchPromoSection — Section/Strip container
 * - #swatchPromoTitle — Text (H2): "Free Fabric Swatches"
 * - #swatchPromoSubtitle — Text: "Feel before you buy"
 * - #swatchPromoCTA — Button: "Request Free Fabric Swatches"
 *
 * === SECTION 10: Newsletter Section (7 elements) ===
 * Create new section:
 * - #newsletterSection — Section/Strip container
 * - #newsletterTitle — Text (H2): "Stay in the Loop"
 * - #newsletterSubtitle — Text: "Deals and design tips"
 * - #newsletterEmail — Input (email type)
 * - #newsletterSubmit — Button: "Subscribe"
 * - #newsletterSuccess — Text (hidden): "Thanks for subscribing!"
 * - #newsletterError — Text (hidden, red): error message
 *
 * === SECTION 11: Decorative + Scroll (5 elements) ===
 * - #ridgelineHeader — Image/SVG: mountain ridgeline decoration
 * Scroll anchor buttons (can be invisible/offscreen):
 * - #scrollToFeatured — Button/Anchor
 * - #scrollToCategories — Button/Anchor
 * - #scrollToSale — Button/Anchor
 * - #scrollToReviews — Button/Anchor
 *
 * === TOTAL: 43 elements ===
 *
 * === VERIFICATION SCRIPT ===
 */
(function verifyHomepageElements() {
  const ds = window.documentServices || window.editorAPI?.dsRead;
  if (!ds) {
    console.error('documentServices not available');
    return;
  }

  const required = [
    // Hero
    'heroOverlay',
    // Featured Products
    'featuredTitle', 'featuredSubtitle', 'featuredRibbon',
    'featuredColorText', 'featuredSwatchContainer', 'featuredQuickViewBtn',
    // Quick View Modal
    'featuredQuickViewModal', 'featuredQvImage', 'featuredQvName',
    'featuredQvPrice', 'featuredQvViewFull', 'featuredQvAddToCart', 'featuredQvClose',
    // Category
    'categoryCardImage', 'categoryCard', 'categoryWallHuggers', 'categoryUnfinished',
    // Recently Viewed
    'recentRepeater',
    // Trust Bar (15)
    'trustItem1', 'trustItem2', 'trustItem3', 'trustItem4', 'trustItem5',
    'trustIcon1', 'trustIcon2', 'trustIcon3', 'trustIcon4', 'trustIcon5',
    'trustText1', 'trustText2', 'trustText3', 'trustText4', 'trustText5',
    // Testimonials
    'testimonialSection', 'testimonialPhoto', 'testimonialRating', 'testimonialSchemaScript',
    // Video
    'videoThumb1', 'videoThumb2', 'videoThumb3',
    // Swatch Promo
    'swatchPromoSection', 'swatchPromoTitle', 'swatchPromoSubtitle', 'swatchPromoCTA',
    // Newsletter
    'newsletterSection', 'newsletterTitle', 'newsletterSubtitle',
    'newsletterEmail', 'newsletterSubmit', 'newsletterSuccess', 'newsletterError',
    // Decorative + Scroll
    'ridgelineHeader',
    'scrollToFeatured', 'scrollToCategories', 'scrollToSale', 'scrollToReviews',
  ];

  try {
    const pageRef = ds.pages.getCurrentPage();
    const children = ds.components.getChildren(pageRef, true);
    const nicknames = new Set();

    children.forEach(ref => {
      try {
        const nn = ds.components.getNickname?.(ref) || '';
        if (nn) nicknames.add(nn);
      } catch (e) {}
    });

    console.log('=== Homepage Element Audit ===');
    let missing = 0;
    required.forEach(id => {
      const found = nicknames.has(id);
      if (!found) {
        console.log(`MISSING: #${id}`);
        missing++;
      }
    });
    console.log(`\nResult: ${missing} missing of ${required.length} required`);
    if (missing === 0) console.log('ALL ELEMENTS PRESENT');
  } catch (e) {
    console.error('Audit error:', e.message);
  }
})();
