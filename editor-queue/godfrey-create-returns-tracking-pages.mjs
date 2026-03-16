/**
 * godfrey-create-returns-tracking-pages.mjs
 *
 * Creates the Returns and Order Tracking pages via Wix documentServices API.
 * Run this BEFORE adding elements from the element scripts.
 *
 * Usage: Run in Wix Studio dev console or via editor scripting interface.
 *
 * AUTHOR: godfrey
 * BEAD: CF-0y0w
 */

// documentServices is available in Wix Studio editor scripting context
// If running from a documentServices-enabled script:
//   import documentServices from 'document-services';

export function createReturnsAndTrackingPages(documentServices) {
  const pages = [
    {
      title: 'Returns',
      pageUriSEO: 'returns',
      pageDescription: 'Start a return, exchange, or track the status of an existing return.',
      pageTitleSEO: 'Returns & Exchanges | Carolina Futons',
      // The Velo page code file that will be associated
      veloFileName: 'Returns.js',
    },
    {
      title: 'Order Tracking',
      pageUriSEO: 'order-tracking',
      pageDescription: 'Track your order shipment status with real-time updates.',
      pageTitleSEO: 'Track Your Order | Carolina Futons',
      veloFileName: 'Order Tracking.js',
    },
  ];

  const results = [];

  for (const page of pages) {
    try {
      // Check if page already exists
      const allPages = documentServices.pages.getPagesList();
      const existing = allPages.find(
        p => p.pageUriSEO === page.pageUriSEO || p.title === page.title
      );

      if (existing) {
        console.log(`[godfrey] Page "${page.title}" already exists (id: ${existing.id}). Skipping creation.`);
        results.push({ title: page.title, status: 'exists', id: existing.id });
        continue;
      }

      // Create the page
      const pageId = documentServices.pages.add(page.title);
      console.log(`[godfrey] Created page "${page.title}" (id: ${pageId})`);

      // Set SEO properties
      try {
        documentServices.pages.setPageUriSEO(pageId, page.pageUriSEO);
      } catch (e) {
        console.warn(`[godfrey] Could not set URI for "${page.title}":`, e.message);
      }

      try {
        documentServices.pages.setPageTitleSEO(pageId, page.pageTitleSEO);
      } catch (e) {
        console.warn(`[godfrey] Could not set title SEO for "${page.title}":`, e.message);
      }

      try {
        documentServices.pages.setPageDescriptionSEO(pageId, page.pageDescription);
      } catch (e) {
        console.warn(`[godfrey] Could not set description for "${page.title}":`, e.message);
      }

      results.push({ title: page.title, status: 'created', id: pageId });
    } catch (err) {
      console.error(`[godfrey] Failed to create page "${page.title}":`, err);
      results.push({ title: page.title, status: 'error', error: err.message });
    }
  }

  console.log('[godfrey] Page creation results:', JSON.stringify(results, null, 2));
  return results;
}

// If this script is executed directly in the editor console:
// createReturnsAndTrackingPages(documentServices);

console.log('[godfrey] Returns + Order Tracking page creation script loaded.');
console.log('Call createReturnsAndTrackingPages(documentServices) to execute.');
