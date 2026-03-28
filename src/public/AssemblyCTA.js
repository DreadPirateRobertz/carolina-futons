// AssemblyCTA.js — 'Need help assembling?' CTA on PDP (CF-ke61)
// Shows assembly help options for Medium/Expert difficulty products.
// Options: White Glove Delivery, TaskRabbit, Watch Assembly Video.
// Tracks GA4 assembly_help_cta_click events (cf-zqz2 funnel taxonomy).

const WHITE_GLOVE_URL = '/getting-it-home';
// Hendersonville, NC zip used for TaskRabbit pre-fill fallback
const TASKRABBIT_FALLBACK = 'https://www.taskrabbit.com/m/featured/furniture-assembly?zip=28792&description=Assemble+Furniture';

// Both naming conventions (assemblyGuides: Medium/Expert/Easy; catalogContent: moderate/difficult/easy)
const SHOW_CTA_DIFFICULTIES = new Set(['medium', 'moderate', 'expert', 'difficult']);
const EXPERT_DIFFICULTIES = new Set(['expert', 'difficult']);

/**
 * Initialize the assembly help CTA section on a product page.
 * Hides for Easy-rated products; shows standard CTA for Medium;
 * shows "Professional assembly recommended" for Expert.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} state - Product page state (state.product required)
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
      try { $w('#assemblyCTASection').collapse(); } catch (e) {}
      return;
    }

    const isExpert = EXPERT_DIFFICULTIES.has(difficulty);

    try {
      $w('#assemblyCTATitle').text = isExpert
        ? 'Professional assembly recommended'
        : "Need help assembling? We've got you covered.";
    } catch (e) {}

    // White Glove Delivery
    try {
      $w('#btnWhiteGlove').link = WHITE_GLOVE_URL;
      $w('#btnWhiteGlove').onClick(() => {
        _trackClick(product._id, 'white_glove');
      });
    } catch (e) {}

    // TaskRabbit
    const taskRabbitUrl = await _getTaskRabbitUrl(product.name, category);
    try {
      $w('#btnTaskRabbit').link = taskRabbitUrl;
      $w('#btnTaskRabbit').target = '_blank';
      $w('#btnTaskRabbit').onClick(() => {
        _trackClick(product._id, 'taskrabbit');
      });
    } catch (e) {}

    // Assembly video (only if a guide with video exists for this SKU)
    const videoUrl = await _getAssemblyVideoUrl(product.sku);
    if (videoUrl) {
      try {
        $w('#btnAssemblyVideo').link = videoUrl;
        $w('#btnAssemblyVideo').target = '_blank';
        $w('#btnAssemblyVideo').onClick(() => {
          _trackClick(product._id, 'watch_video');
        });
        $w('#btnAssemblyVideo').show();
      } catch (e) {}
    } else {
      try { $w('#btnAssemblyVideo').hide(); } catch (e) {}
    }

    try { $w('#assemblyCTASection').expand(); } catch (e) {}

    try {
      $w('#assemblyCTASection').accessibility.ariaLabel = 'Assembly help options';
    } catch (e) {}

  } catch (err) {
    console.error('[AssemblyCTA] init error:', err);
    try { $w('#assemblyCTASection').collapse(); } catch (e) {}
  }
}

async function _getTaskRabbitUrl(productName, category) {
  try {
    const { getTaskRabbitLink } = await import('backend/assemblyGuides.web');
    const result = await getTaskRabbitLink(productName || 'Futon', '28792', category);
    if (result?.success && result.url) return result.url;
  } catch (e) { /* fall through to static fallback */ }
  return TASKRABBIT_FALLBACK;
}

async function _getAssemblyVideoUrl(sku) {
  if (!sku) return null;
  try {
    const { getAssemblyGuide } = await import('backend/assemblyGuides.web');
    const guide = await getAssemblyGuide(sku);
    return guide?.videoUrl || null;
  } catch (e) {
    return null;
  }
}

function _trackClick(productId, option) {
  import('public/engagementTracker').then(({ trackEvent }) => {
    trackEvent('assembly_help_cta_click', { productId, option });
  }).catch(() => {});
}
