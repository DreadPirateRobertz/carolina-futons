// Assembly Guides.js - Step-by-step assembly instructions with video tutorials
// Lists all product assembly guides by category, with search, video embeds,
// PDF downloads, estimated times, care tips, and HowTo SEO schema
import { listAssemblyGuides, getAssemblyGuide, getCareTips } from 'backend/assemblyGuides.web';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { announce, makeClickable } from 'public/a11yHelpers';
import {
  getGuideCategories,
  groupGuidesByCategory,
  filterGuides,
  buildVideoEmbedUrl,
  formatEstimatedTime,
  buildHowToSchema,
  getCategoryLabel,
  getCategoryIcon,
} from 'public/assemblyGuideHelpers.js';
import { initPageSeo } from 'public/pageSeo.js';

let allGuides = [];
let currentCategory = null;
let currentQuery = '';
let activeGuideId = null;

$w.onReady(async function () {
  initBackToTop($w);
  initPageSeo('assemblyGuides');
  initCategoryFilters();
  initSearch();
  initGuideList();
  initGuideDetail();
  initCareTips();
  await loadGuides();
  trackEvent('page_view', { page: 'assembly-guides' });
});

// ── Load Guides ───────────────────────────────────────────────────────

async function loadGuides() {
  try {
    showLoading(true);
    allGuides = await listAssemblyGuides();
    renderGuideList(allGuides);
    showLoading(false);
    announce($w, `${allGuides.length} assembly guide${allGuides.length !== 1 ? 's' : ''} available`);
  } catch (err) {
    console.error('Error loading assembly guides:', err);
    showLoading(false);
    showEmpty('Unable to load assembly guides. Please try again later.');
  }
}

// ── Category Filters ──────────────────────────────────────────────────

function initCategoryFilters() {
  try {
    const catRepeater = $w('#guideCategoryRepeater');
    if (!catRepeater) return;

    const categories = getGuideCategories();
    const allOption = { _id: 'cat-all', id: '', label: 'All Guides', description: 'Show all assembly guides', icon: '\u{1F4CB}' };
    const catData = [allOption, ...categories.map(c => ({ ...c, _id: `cat-${c.id}` }))];

    try { catRepeater.accessibility.ariaLabel = 'Assembly guide category filters'; } catch (e) {}

    catRepeater.onItemReady(($item, itemData) => {
      try { $item('#catLabel').text = `${itemData.icon || ''} ${itemData.label}`; } catch (e) {}
      try { $item('#catLabel').accessibility.ariaLabel = `Filter: ${itemData.label}`; } catch (e) {}
      try { $item('#catLabel').accessibility.tabIndex = 0; } catch (e) {}

      const selectCategory = () => {
        currentCategory = itemData.id || null;
        applyFilters();
        trackEvent('assembly_guide_category', { category: itemData.label });
        announce($w, `Showing ${itemData.label}`);
      };

      $item('#catLabel').onClick(selectCategory);
      try {
        $item('#catLabel').onKeyPress((event) => {
          if (event.key === 'Enter' || event.key === ' ') selectCategory();
        });
      } catch (e) {}
    });
    catRepeater.data = catData;
  } catch (e) {}
}

// ── Search ────────────────────────────────────────────────────────────

function initSearch() {
  try {
    const searchInput = $w('#guideSearchInput');
    if (!searchInput) return;

    try { searchInput.accessibility.ariaLabel = 'Search assembly guides'; } catch (e) {}

    let debounceTimer;
    searchInput.onKeyPress(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentQuery = searchInput.value?.trim() || '';
        applyFilters();
        if (currentQuery) {
          trackEvent('assembly_guide_search', { query: currentQuery });
        }
      }, 300);
    });
  } catch (e) {}
}

function applyFilters() {
  const filtered = filterGuides(allGuides, currentCategory, currentQuery);
  renderGuideList(filtered);

  if (filtered.length === 0) {
    const msg = currentQuery
      ? `No guides match "${currentQuery}". Try a different search term.`
      : 'No assembly guides in this category.';
    showEmpty(msg);
  } else {
    hideEmpty();
    announce($w, `${filtered.length} guide${filtered.length !== 1 ? 's' : ''} found`);
  }
}

// ── Guide List ────────────────────────────────────────────────────────

function initGuideList() {
  try {
    const repeater = $w('#guideListRepeater');
    if (!repeater) return;

    try { repeater.accessibility.ariaLabel = 'Assembly guides list'; } catch (e) {}

    repeater.onItemReady(($item, itemData) => {
      try { $item('#guideTitle').text = itemData.title; } catch (e) {}
      try { $item('#guideCategory').text = `${getCategoryIcon(itemData.category)} ${getCategoryLabel(itemData.category)}`; } catch (e) {}
      try {
        const time = formatEstimatedTime(itemData.estimatedTime);
        $item('#guideTime').text = time ? `\u{23F1}\uFE0F ${time}` : '';
      } catch (e) {}
      try { $item('#guidePdfBadge').text = itemData.hasPdf ? '\u{1F4C4} PDF' : ''; } catch (e) {}
      try { $item('#guideVideoBadge').text = itemData.hasVideo ? '\u{1F3AC} Video' : ''; } catch (e) {}

      // Accessibility
      try {
        $item('#guideTitle').accessibility.ariaLabel = `View assembly guide: ${itemData.title}`;
        $item('#guideTitle').accessibility.tabIndex = 0;
      } catch (e) {}

      const openGuide = () => {
        activeGuideId = itemData._id;
        loadGuideDetail(itemData.sku, itemData.category);
        trackEvent('assembly_guide_view', { sku: itemData.sku, title: itemData.title });
      };

      try { makeClickable($item('#guideTitle'), openGuide); } catch (e) {}
      try { makeClickable($item('#guideViewBtn'), openGuide, { ariaLabel: `View assembly guide: ${itemData.title}` }); } catch (e) {}
    });
  } catch (e) {}
}

function renderGuideList(guides) {
  try {
    const repeater = $w('#guideListRepeater');
    if (!repeater) return;
    repeater.data = guides.map(g => ({ ...g, _id: g._id || g.sku }));
  } catch (e) {}
}

// ── Guide Detail View ─────────────────────────────────────────────────

function initGuideDetail() {
  try {
    // Back button returns to list
    const backBtn = $w('#guideBackBtn');
    if (backBtn) {
      makeClickable(backBtn, () => {
        hideDetail();
        trackEvent('assembly_guide_back', {});
      }, { ariaLabel: 'Back to guides list' });
    }
  } catch (e) {}
}

async function loadGuideDetail(sku, category) {
  try {
    showDetail();
    showDetailLoading(true);

    const [guide, careTips] = await Promise.allSettled([
      getAssemblyGuide(sku),
      getCareTips(category),
    ]);

    const guideData = guide.status === 'fulfilled' ? guide.value : null;
    const tips = careTips.status === 'fulfilled' ? careTips.value : [];

    if (!guideData) {
      showDetailError('Guide not found. Please try again.');
      showDetailLoading(false);
      return;
    }

    renderGuideDetail(guideData);
    renderCareTipsSection(tips);
    injectHowToSchema(guideData);
    showDetailLoading(false);
    announce($w, `Viewing ${guideData.title}`);
  } catch (err) {
    console.error('Error loading guide detail:', err);
    showDetailError('Unable to load guide. Please try again.');
    showDetailLoading(false);
  }
}

function renderGuideDetail(guide) {
  try { $w('#detailTitle').text = guide.title; } catch (e) {}
  try { $w('#detailCategory').text = `${getCategoryIcon(guide.category)} ${getCategoryLabel(guide.category)}`; } catch (e) {}
  try {
    const time = formatEstimatedTime(guide.estimatedTime);
    $w('#detailTime').text = time ? `Estimated time: ${time}` : '';
  } catch (e) {}

  // Steps (rich text)
  try {
    if (guide.steps) {
      $w('#detailSteps').html = guide.steps;
      $w('#detailStepsSection').expand();
    } else {
      $w('#detailStepsSection').collapse();
    }
  } catch (e) {}

  // Tips
  try {
    if (guide.tips) {
      $w('#detailTips').text = guide.tips;
      $w('#detailTipsSection').expand();
    } else {
      $w('#detailTipsSection').collapse();
    }
  } catch (e) {}

  // Video
  try {
    if (guide.videoUrl) {
      const embedUrl = buildVideoEmbedUrl(guide.videoUrl);
      if (embedUrl) {
        $w('#detailVideo').src = embedUrl;
        $w('#detailVideoSection').expand();
        try { $w('#detailVideo').accessibility.ariaLabel = `Video tutorial: ${guide.title}`; } catch (e) {}
      }
    } else {
      $w('#detailVideoSection').collapse();
    }
  } catch (e) {}

  // PDF download
  try {
    if (guide.pdfUrl) {
      $w('#detailPdfBtn').link = guide.pdfUrl;
      $w('#detailPdfBtn').target = '_blank';
      $w('#detailPdfSection').expand();
      try { $w('#detailPdfBtn').accessibility.ariaLabel = `Download PDF: ${guide.title}`; } catch (e) {}
    } else {
      $w('#detailPdfSection').collapse();
    }
  } catch (e) {}
}

// ── Care Tips Section ─────────────────────────────────────────────────

function initCareTips() {
  try {
    const repeater = $w('#careTipsRepeater');
    if (!repeater) return;

    try { repeater.accessibility.ariaLabel = 'Product care tips'; } catch (e) {}

    repeater.onItemReady(($item, itemData) => {
      try { $item('#careTipTitle').text = itemData.title; } catch (e) {}
      try { $item('#careTipText').text = itemData.tip; } catch (e) {}
    });
  } catch (e) {}
}

function renderCareTipsSection(tips) {
  try {
    if (tips && tips.length > 0) {
      $w('#careTipsRepeater').data = tips.map((t, i) => ({ ...t, _id: `tip-${i}` }));
      $w('#careTipsSection').expand();
    } else {
      $w('#careTipsSection').collapse();
    }
  } catch (e) {}
}

// ── SEO Schema ────────────────────────────────────────────────────────

function injectHowToSchema(guide) {
  try {
    const schema = buildHowToSchema(guide);
    if (schema) {
      $w('#guideSchemaHtml').postMessage(JSON.stringify(schema));
    }
  } catch (e) {}
}

// ── UI State Helpers ──────────────────────────────────────────────────

function showLoading(show) {
  try {
    if (show) {
      $w('#guideLoading').expand();
      $w('#guideListRepeater').collapse();
    } else {
      $w('#guideLoading').collapse();
      $w('#guideListRepeater').expand();
    }
  } catch (e) {}
}

function showEmpty(message) {
  try {
    $w('#guideNoResults').text = message;
    $w('#guideNoResults').expand();
  } catch (e) {}
}

function hideEmpty() {
  try { $w('#guideNoResults').collapse(); } catch (e) {}
}

function showDetail() {
  try {
    $w('#guideListSection').collapse();
    $w('#guideDetailSection').expand();
    try { $w('#guideDetailSection').scrollTo(); } catch (e) {}
  } catch (e) {}
}

function hideDetail() {
  try {
    $w('#guideDetailSection').collapse();
    $w('#guideListSection').expand();
    activeGuideId = null;
  } catch (e) {}
}

function showDetailLoading(show) {
  try {
    if (show) {
      $w('#detailLoading').expand();
      $w('#detailContent').collapse();
    } else {
      $w('#detailLoading').collapse();
      $w('#detailContent').expand();
    }
  } catch (e) {}
}

function showDetailError(message) {
  try {
    $w('#detailError').text = message;
    $w('#detailError').expand();
  } catch (e) {}
}
