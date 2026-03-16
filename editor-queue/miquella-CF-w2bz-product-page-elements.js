/**
 * CF-w2bz (P0): Product Page — productDataset + 14 missing elements
 * Priority: P0 (ALL products show "Not Found" without productDataset)
 * Assigned: miquella (code) → melania (editor)
 *
 * === CRITICAL: #productDataset ===
 * Without this, $w('#productDataset').onReady() never fires and every
 * product page shows "Product Not Found".
 *
 * Steps:
 * 1. Navigate to Product Page in editor
 * 2. Add a Wix Stores Dataset component (Add → Database → Stores/Products)
 * 3. Set its Velo nickname to "productDataset" (Properties panel → ID)
 * 4. Connect it to the Products collection
 * 5. Set mode to "Read" with page size appropriate for single product
 *
 * === ADDITIONAL ELEMENTS TO CREATE ===
 *
 * Group 1: Product Description (for "not found" fallback)
 * - #productDescription — RichText element
 *   Place near product name area. Shows "Sorry, this product is no longer
 *   available" when product lookup fails.
 *
 * Group 2: Variant Stock Display (3 elements)
 * - #variantStockRepeater — Repeater (small, below options area)
 * - #variantStockLabel — Text inside repeater (variant name)
 * - #variantStockStatus — Text inside repeater (stock status)
 *
 * Group 3: Remind Me Popup (8 elements — browse abandonment)
 * Create a Box (lightbox/popup style), hidden by default:
 * - #remindMePopup — Box container (overlay style, hidden default)
 *   Inside the popup box:
 *   - #remindMeTitle — Text (H3): "Still deciding?"
 *   - #remindMeSubtitle — Text: "Get a reminder when this goes on sale"
 *   - #remindMeEmailInput — Input (email type)
 *   - #remindMeSubmit — Button: "Remind Me"
 *   - #remindMeClose — Button: "X" (icon, top-right)
 *   - #remindMeError — Text (hidden default, red)
 *   - #remindMeSuccess — Text (hidden default, green)
 *
 * === VERIFICATION ===
 * After adding all elements:
 * 1. Preview the Product Page with a real product URL
 * 2. Product name, price, image should load (proves #productDataset works)
 * 3. Check console for "[ProductPage]" errors — should be clean
 */
(function verifyProductPageElements() {
  const ds = window.documentServices || window.editorAPI?.dsRead;
  if (!ds) {
    console.error('documentServices not available');
    return;
  }

  const required = [
    'productDataset', 'productDescription',
    'variantStockRepeater', 'variantStockLabel', 'variantStockStatus',
    'remindMePopup', 'remindMeTitle', 'remindMeSubtitle',
    'remindMeEmailInput', 'remindMeSubmit', 'remindMeClose',
    'remindMeError', 'remindMeSuccess'
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

    console.log('=== Product Page Element Audit ===');
    let missing = 0;
    required.forEach(id => {
      const found = nicknames.has(id);
      console.log(`${found ? 'OK' : 'MISSING'}: #${id}`);
      if (!found) missing++;
    });
    console.log(`\nResult: ${missing} missing of ${required.length} required`);
  } catch (e) {
    console.error('Audit error:', e.message);
  }
})();
