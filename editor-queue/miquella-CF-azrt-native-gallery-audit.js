/**
 * CF-azrt: Native Wix Gallery Price Audit — Editor Tasks
 * Priority: P2
 * Assigned: melania (editor) — after code-side fixes are merged
 *
 * PROBLEM: The Tera template (#3563) uses Wix Pro Gallery (TPAWidget)
 * for two product display sections on the Home page. Pro Galleries
 * render product prices directly from catalog data — our Velo code
 * cannot intercept or customize the rendering. Call-for-price products
 * with $1.00 placeholder show "$1.00" instead of "Call for Pricing".
 *
 * CODE-SIDE FIX (already applied):
 * - catalogPriceFix.web.js — admin utility to change $1.00 → $0 in catalog
 * - Run fixCallForPricePlaceholders(false) from admin to apply
 * - Products with $0 show "Price unavailable" in native Wix widgets
 * - Our Velo code already handles price <= $1 via isCallForPrice()
 *
 * EDITOR-SIDE FIX (for melania — long-term):
 * Replace native Pro Gallery widgets with custom Repeaters that use
 * our formatCardPrice() / renderSimplePrice() helpers.
 *
 * === SECTION 6: Best Sellers (gridGallery1 → custom Repeater) ===
 *
 * Current: gridGallery1 (TPAWidget / Wix Pro Gallery)
 * Target: Replace with #featuredRepeater (Repeater element)
 *
 * Steps:
 * 1. Delete or hide gridGallery1 (the Pro Gallery widget)
 * 2. Add a Repeater element in the same section
 * 3. Set Velo nickname: featuredRepeater
 * 4. Inside repeater item, add these elements with exact nicknames:
 *    - #featuredCard — Box (card container)
 *    - #featuredImage — Image (product photo)
 *    - #featuredName — Text (product name)
 *    - #featuredPrice — Text (price)
 *    - #featuredOriginalPrice — Text (strikethrough price, hidden by default)
 *    - #featuredSaleBadge — Text (sale badge, hidden by default)
 *    - #featuredRibbon — Text (badge ribbon: Featured/New/Clearance)
 *    - #featuredColorText — Text ("X finishes")
 *    - #featuredSwatchContainer — Box (swatch container)
 *    - #featuredQuickViewBtn — Button ("Quick View")
 *
 * Layout: 4-column desktop, 2-column mobile
 * Style: white bg, 12px radius, card shadow (matches designTokens.js)
 *
 * === SECTION 8: New In (gridGallery2 → custom Repeater) ===
 *
 * Current: gridGallery2 (TPAWidget / Wix Pro Gallery)
 * Target: Replace with #newInRepeater (Repeater element) — OR reuse
 *         the existing saleRepeater pattern if "New In" = sale items.
 *
 * NOTE: Home.js currently does NOT have a "New In" section in Velo code.
 * The "New In" label comes from the Tera template's native section heading.
 * If we want "New In" as a separate section:
 * 1. Delete gridGallery2
 * 2. Add Repeater #newInRepeater
 * 3. Add matching Velo code in Home.js (similar to loadFeaturedProducts)
 * 4. Query products sorted by _createdDate descending
 *
 * OR: Simply relabel section 8 and reuse an existing pattern.
 *
 * === OTHER PAGES ===
 *
 * Category Page: Uses #productGridRepeater (custom Repeater) — already
 *   routes through formatCardPrice(). No native gallery widgets found.
 *
 * Product Page: Uses custom gallery for images (not product listings).
 *   Cross-sell sections use custom Repeaters. No native gallery widgets.
 *
 * Search Results: Uses #searchRepeater (custom). Already has isCallForPrice.
 *
 * CONCLUSION: Only Home page sections 6 and 8 have native Pro Gallery
 * widgets that bypass Velo price logic. All other pages use custom Repeaters.
 */

// This is an editor task document, not executable code.
// Run catalogPriceFix.web.js for the immediate data-level fix.
