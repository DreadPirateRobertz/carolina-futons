// AssemblyCTA.js — 'Need help assembling?' CTA on PDP (CF-ke61)
// Shows assembly help options for Medium/Expert difficulty products.
// Options: White Glove Delivery, TaskRabbit, Watch Assembly Video.
// Tracks GA4 assembly_help_cta_click events (cf-zqz2 funnel taxonomy).

const WHITE_GLOVE_URL = '/getting-it-home';

// Zip 28792 = Hendersonville, NC (store location). All TaskRabbit calls use this zip.
// This is not a runtime fallback — it's the intentional default for all requests.
const HENDERSONVILLE_ZIP = '28792';
const TASKRABBIT_FALLBACK = `https://www.taskrabbit.com/m/featured/furniture-assembly?zip=${HENDERSONVILLE_ZIP}&description=Assemble+Furniture`;

// Both naming conventions:
//   assemblyGuides.web.js:  Medium / Expert / Easy (capitalized)
//   catalogContent.web.js:  moderate / difficult / easy (lowercase)
const SHOW_CTA_DIFFICULTIES = new Set(['medium', 'moderate', 'expert', 'difficult']);
const EXPERT_DIFFICULTIES = new Set(['expert', 'difficult']);

/**
 * Initialize the assembly help CTA section on a product page.
 * Hides for Easy-rated products; shows standard CTA for Medium;
 * shows "Professional assembly recommended" for Expert.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} state - Product page state. Requires state.product with:
 *   _id {string}, name {string}, sku {string}, collections {string[]}
 */
export async function initAssemblyCTA($w, state) {
  try {
    if (!state?.product) return;

    const product = state.product;
    const category = (product.collections?.[0] || '').toLowerCase();

    const { getAssemblyInfo } = await import('backend/assemblyGuides.web');
    const infoResult = await getAssemblyInfo(category);
    const difficulty = (infoResult?.info?.difficulty || '').toLowerCase();

    if (!SHOW_CTA_DIFFICULTIES.has(difficulty)) {
      try { $w('#assemblyCTASection').collapse(); } catch (e) {
        console.error('[AssemblyCTA] collapse failed:', e);
      }
      return;
    }

    const isExpert = EXPERT_DIFFICULTIES.has(difficulty);

    try {
      $w('#assemblyCTATitle').text = isExpert
        ? 'Professional assembly recommended'
        : "Need help assembling? We've got you covered.";
    } catch (e) {
      console.error('[AssemblyCTA] title text set failed:', e);
    }

    // White Glove Delivery
    try {
      $w('#btnWhiteGlove').link = WHITE_GLOVE_URL;
      $w('#btnWhiteGlove').onClick(() => {
        _trackClick(product._id, 'white_glove');
      });
    } catch (e) {
      console.error('[AssemblyCTA] btnWhiteGlove wiring failed:', e);
    }

    // TaskRabbit
    const taskRabbitUrl = await _getTaskRabbitUrl(product.name, category);
    try {
      $w('#btnTaskRabbit').link = taskRabbitUrl;
      $w('#btnTaskRabbit').target = '_blank';
      $w('#btnTaskRabbit').onClick(() => {
        _trackClick(product._id, 'taskrabbit');
      });
    } catch (e) {
      console.error('[AssemblyCTA] btnTaskRabbit wiring failed:', e);
    }

    // Assembly video — only shown if a guide with videoUrl exists for this SKU
    const videoUrl = await _getAssemblyVideoUrl(product.sku);
    if (videoUrl) {
      try {
        $w('#btnAssemblyVideo').link = videoUrl;
        $w('#btnAssemblyVideo').target = '_blank';
        $w('#btnAssemblyVideo').onClick(() => {
          _trackClick(product._id, 'watch_video');
        });
        $w('#btnAssemblyVideo').show();
      } catch (e) {
        console.error('[AssemblyCTA] btnAssemblyVideo wiring failed:', e);
      }
    } else {
      try { $w('#btnAssemblyVideo').hide(); } catch (e) {
        console.error('[AssemblyCTA] btnAssemblyVideo hide failed:', e);
      }
    }

    try { $w('#assemblyCTASection').expand(); } catch (e) {
      console.error('[AssemblyCTA] section expand failed:', e);
    }

    try {
      $w('#assemblyCTASection').accessibility.ariaLabel = 'Assembly help options';
    } catch (e) {
      console.error('[AssemblyCTA] ariaLabel set failed:', e);
    }

    // Announce to screen readers that assembly help options are now visible (WCAG 2.1 AA)
    try {
      const { announce } = await import('public/a11yHelpers');
      announce($w, 'Assembly help options available', 'polite');
    } catch (e) {
      console.error('[AssemblyCTA] announce failed:', e);
    }

  } catch (err) {
    console.error('[AssemblyCTA] init error:', err);
    try { $w('#assemblyCTASection').collapse(); } catch (e) {}
  }
}

async function _getTaskRabbitUrl(productName, category) {
  try {
    const { getTaskRabbitLink } = await import('backend/assemblyGuides.web');
    const result = await getTaskRabbitLink(productName || 'Futon', HENDERSONVILLE_ZIP, category);
    if (result?.success && result.url) return result.url;
  } catch (e) {
    console.error('[AssemblyCTA] getTaskRabbitLink failed, using static fallback:', e);
  }
  return TASKRABBIT_FALLBACK;
}

async function _getAssemblyVideoUrl(sku) {
  if (!sku) return null;
  try {
    const { getAssemblyGuide } = await import('backend/assemblyGuides.web');
    const guide = await getAssemblyGuide(sku);
    return guide?.videoUrl || null;
  } catch (e) {
    // Backend failure treated the same as no guide — video button hidden
    console.error('[AssemblyCTA] getAssemblyGuide failed:', e);
    return null;
  }
}

function _trackClick(productId, option) {
  import('public/engagementTracker').then(({ trackEvent }) => {
    trackEvent('assembly_help_cta_click', { productId, option });
  }).catch((e) => {
    console.error('[AssemblyCTA] trackEvent failed:', e);
  });
}
