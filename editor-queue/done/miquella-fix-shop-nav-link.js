/**
 * CRITICAL: Fix Shop nav link — /category-page is 404
 * Priority: HIGH (customer-facing broken navigation)
 *
 * Problem: The Shop link in the site navigation points to /category-page which 404s.
 * The correct path is /shop-main (used consistently across all Velo code).
 *
 * Steps (manual in Wix Editor):
 * 1. Open the site header/navigation menu
 * 2. Find the "Shop" menu item
 * 3. Change its link from /category-page to /shop-main
 * 4. Save and publish
 *
 * Verification: Click Shop in nav -> should load the shop page, not 404
 *
 * If using documentServices API in editor console:
 */
(function fixShopNavLink() {
  const ds = window.documentServices || window.editorAPI?.dsRead;
  if (!ds) {
    console.error('documentServices not available - fix manually in editor');
    return;
  }

  // This script is a guide - the actual menu item link must be changed
  // through the Wix Editor's navigation settings panel:
  // 1. Click on the header/menu component
  // 2. Click "Manage Menu" or "Navigation"
  // 3. Find "Shop" entry
  // 4. Change link to /shop-main
  console.log('ACTION REQUIRED: Change Shop nav link from /category-page to /shop-main');
  console.log('Use: Site Menu > Manage Menu > Shop > Link > /shop-main');
})();
