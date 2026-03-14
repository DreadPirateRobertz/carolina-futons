// ProductAssemblyGuide.js - Assembly guide link section for Product Page
// Fetches assembly guide by SKU and wires download/video buttons.

/**
 * Initialize the assembly guide section on a product page.
 * Fetches guide by product SKU, shows PDF and video links if available.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} state - Product page state with state.product
 */
export async function initProductAssemblyGuide($w, state) {
  try {
    if (!state?.product) return;

    const sku = state.product.sku;
    if (!sku) {
      try { $w('#assemblyGuideSection').collapse(); } catch (e) {}
      return;
    }

    const { getAssemblyGuide } = await import('backend/assemblyGuides.web');
    const guide = await getAssemblyGuide(sku);

    if (!guide) {
      try { $w('#assemblyGuideSection').collapse(); } catch (e) {}
      return;
    }

    // Section title
    try { $w('#assemblyGuideTitle').text = 'Assembly & Care Guide'; } catch (e) {}

    // Estimated time
    if (guide.estimatedTime) {
      try { $w('#assemblyGuideTime').text = `Estimated time: ${guide.estimatedTime}`; } catch (e) {}
    }

    // PDF download link
    if (guide.pdfUrl) {
      try {
        $w('#assemblyGuideLink').link = guide.pdfUrl;
        $w('#assemblyGuideLink').target = '_blank';
        try { $w('#assemblyGuideLink').accessibility.ariaLabel = `Download ${guide.title} PDF`; } catch (e) {}
      } catch (e) {}
    } else {
      try { $w('#assemblyGuideLink').hide(); } catch (e) {}
    }

    // Video link
    if (guide.videoUrl) {
      try {
        $w('#assemblyGuideVideoLink').link = guide.videoUrl;
        $w('#assemblyGuideVideoLink').target = '_blank';
        try { $w('#assemblyGuideVideoLink').accessibility.ariaLabel = `Watch ${guide.title} video`; } catch (e) {}
      } catch (e) {}
    } else {
      try { $w('#assemblyGuideVideoLink').hide(); } catch (e) {}
    }

    // Button opens PDF or navigates to guide page
    try {
      try { $w('#assemblyGuideBtn').accessibility.ariaLabel = 'View assembly guide'; } catch (e) {}
      $w('#assemblyGuideBtn').onClick(() => {
        if (guide.pdfUrl) {
          import('wix-window-frontend').then(({ openUrl }) => {
            openUrl(guide.pdfUrl);
          });
        }
      });
    } catch (e) {}

    try { $w('#assemblyGuideSection').expand(); } catch (e) {}
  } catch (e) {
    // Assembly guide is non-critical — collapse section on error
    try { $w('#assemblyGuideSection').collapse(); } catch (e2) {}
  }
}
