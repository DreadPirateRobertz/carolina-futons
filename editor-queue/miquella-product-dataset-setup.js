// TARGET: Product Page
// DESCRIPTION: P0 — Add productDataset CMS element + Tier 1 elements (hq-kgno)
// AUTHOR: miquella
// DEPENDS: none
// PRIORITY: P0 (product page is non-functional without this)
//
// The Product Page Velo code expects $w('#productDataset') — a Wix Stores dataset
// that provides the current product based on the URL slug. Without it, the page
// shows "Product Not Found" for every product.
//
// SETUP STEPS (in Wix Studio editor):
//
// 1. DATASET: Add a "Wix Stores" dataset to the Product Page
//    - In editor: Add Panel → Database → Wix Stores → Products
//    - Set nickname to: productDataset
//    - Mode: Read-only
//    - Filter: By URL slug (this is automatic for Product Pages in Wix)
//    - Items per page: 1
//
// 2. TIER 1 ELEMENTS (minimum viable product page):
//    These element IDs are referenced in src/pages/Product Page.js lines 57-68.
//    Add text/image/button elements and set their nicknames:
//
//    | Nickname            | Element Type     | Purpose                    |
//    |---------------------|-----------------|----------------------------|
//    | productName         | Text (h1)       | Product title              |
//    | productPrice        | Text            | Current price              |
//    | productMainImage    | Image           | Main product photo         |
//    | productDescription  | Text (rich)     | Product description        |
//    | addToCartButton     | Button          | Add to Cart action         |
//
// 3. CONNECT dataset to elements:
//    - productName → connect to Products > Name
//    - productPrice → connect to Products > Formatted Price
//    - productMainImage → connect to Products > Main Media
//    - productDescription → connect to Products > Description
//    - addToCartButton → connect to Products > Add to Cart action
//
// 4. OPTIONAL Tier 2 elements (Velo code handles missing ones gracefully via try/catch):
//    - productComparePrice (Text) — strike-through original price
//    - productGallery (Gallery) — all product images
//    - quantityInput (TextInput) — quantity number
//    - quantityMinus / quantityPlus (Buttons) — +/- quantity
//    - buyNowButton (Button) — Buy Now CTA
//    - productHeroSkyline (Container) — mountain SVG border
//
// VERIFICATION:
//    After setup, preview the page. Navigate to any product URL (e.g., /product-page/monterey-futon-frame).
//    You should see: product name, price, image, description, and working Add to Cart button.
//    If you see "Product Not Found" — the dataset filter isn't matching the URL slug.

(function(ds, doc) {
  // This is a manual setup — cannot be fully automated via documentServices.
  // The dataset must be added through the Wix Studio editor UI.
  //
  // After adding the dataset, verify with:
  //   const pageRef = ds.pages.getCurrentPage();
  //   const children = ds.components.getChildren({ id: pageRef.id, type: 'DESKTOP' });
  //   // Look for dataset component in children
  //
  // Verify nickname:
  //   ds.components.getType(datasetRef) should return 'wixapps.integration.WixDataDataset' or similar

  return { status: 'manual', note: 'Add Wix Stores dataset + Tier 1 elements per instructions above' };
})(ds, doc);
