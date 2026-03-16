/**
 * CRITICAL: 2 broken hero images on homepage (cc389e_ prefix not loading)
 * Priority: HIGH (customer-facing broken visuals)
 *
 * Problem: Hero images with cc389e_ prefix are returning 404 from Wix Media Manager.
 * This could mean:
 * - Images were deleted from Media Manager
 * - Image IDs changed during a media reorganization
 * - CDN cache issue (unlikely for persistent 404)
 *
 * Steps (manual in Wix Editor):
 * 1. Go to Homepage in editor
 * 2. Find the 2 hero image components (likely in a strip/section at top)
 * 3. Check if they show broken image placeholders
 * 4. For each broken image:
 *    a. Click the image component
 *    b. Click "Change Image"
 *    c. Browse Media Manager for the correct hero image
 *    d. If original is missing, upload a replacement
 * 5. Save and publish
 *
 * To identify which images have cc389e_ prefix in editor console:
 */
(function findBrokenHeroImages() {
  const ds = window.documentServices || window.editorAPI?.dsRead;
  if (!ds) {
    console.error('documentServices not available - check images manually');
    return;
  }

  // Search for image components on the homepage with cc389e_ prefix
  try {
    const pageRef = ds.pages.getCurrentPage();
    const children = ds.components.getChildren(pageRef, true);
    children.forEach(ref => {
      try {
        const type = ds.components.getType(ref);
        if (type && type.includes('Image')) {
          const data = ds.components.data.get(ref);
          const uri = data?.uri || data?.src || '';
          if (uri.includes('cc389e')) {
            console.log('BROKEN IMAGE FOUND:', ref, 'uri:', uri);
            console.log('Component ID:', ds.components.getCompId?.(ref) || ref);
          }
        }
      } catch (e) {}
    });
  } catch (e) {
    console.error('Error scanning images:', e.message);
  }

  console.log('ACTION: Replace any cc389e_ images with correct hero images from Media Manager');
})();
