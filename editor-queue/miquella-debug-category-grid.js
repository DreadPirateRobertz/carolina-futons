/**
 * CRITICAL: Category Page JS error — product grid init failing
 * Priority: HIGH (customer-facing broken product listing)
 *
 * Problem: initProductGrid() is failing on Category Page.
 * The Velo code at Category Page.js:530 expects #productGridRepeater to exist.
 * If the repeater isn't in the editor or isn't connected to a dataset, it fails.
 *
 * Root cause candidates:
 * 1. #productGridRepeater element missing from Category Page
 * 2. Repeater not connected to Stores/Products dataset
 * 3. Dataset not configured with correct collection
 *
 * Steps (manual in Wix Editor):
 * 1. Navigate to Category Page in editor
 * 2. Check that a Repeater component exists with ID "productGridRepeater"
 *    - If missing: add a Repeater, set ID to productGridRepeater
 * 3. Check that a Dataset component exists (Stores/Products or similar)
 *    - The repeater must be connected to this dataset
 * 4. Verify dataset is connected to the Products collection
 * 5. Check developer console for specific error messages
 *
 * Diagnostic script for editor console:
 */
(function debugCategoryGrid() {
  const ds = window.documentServices || window.editorAPI?.dsRead;
  if (!ds) {
    console.error('documentServices not available - check manually');
    return;
  }

  try {
    const pageRef = ds.pages.getCurrentPage();
    const children = ds.components.getChildren(pageRef, true);

    let foundRepeater = false;
    let foundDataset = false;

    children.forEach(ref => {
      try {
        const type = ds.components.getType(ref);
        const nickname = ds.components.getNickname?.(ref) || '';

        if (nickname === 'productGridRepeater' || (type && type.includes('Repeater'))) {
          console.log('REPEATER FOUND:', ref, 'type:', type, 'nickname:', nickname);
          foundRepeater = true;

          // Check connections
          const connections = ds.components.connections?.get?.(ref) || [];
          console.log('  Connections:', JSON.stringify(connections));
        }

        if (type && (type.includes('Dataset') || type.includes('dataset'))) {
          console.log('DATASET FOUND:', ref, 'type:', type, 'nickname:', nickname);
          foundDataset = true;

          const data = ds.components.data.get(ref);
          console.log('  Collection:', data?.collectionName || 'unknown');
        }
      } catch (e) {}
    });

    if (!foundRepeater) console.error('NO REPEATER with nickname "productGridRepeater" found on page!');
    if (!foundDataset) console.error('NO DATASET found on page!');
  } catch (e) {
    console.error('Diagnostic error:', e.message);
  }

  console.log('ACTION: Ensure #productGridRepeater exists and is connected to Products dataset');
})();
