// Buying Guides.js — Hub page listing all 8 category buying guides
// Renders guide cards in a grid, breadcrumbs, SEO schema, and category filters
import { getAllBuyingGuides } from 'backend/buyingGuides.web';
import { getContentHub } from 'backend/seoContentHub.web';
import { getPageTitle, getCanonicalUrl, getPageMetaDescription } from 'backend/seoHelpers.web';
import wixLocationFrontend from 'wix-location-frontend';
import { initBackToTop } from 'public/mobileHelpers';
import { trackEvent } from 'public/engagementTracker';
import { announce, makeClickable } from 'public/a11yHelpers';
import {
  buildBreadcrumbs,
  buildHubCardData,
  formatGuideDate,
  getCategoryIcon,
  getGuideCategories,
  filterGuidesByCategory,
} from 'public/buyingGuidesHelpers';

$w.onReady(async function () {
  initBackToTop($w);
  trackEvent('page_view', { page: 'buying_guides_hub' });

  try {
    const [guidesResult, hubResult] = await Promise.allSettled([
      getAllBuyingGuides(),
      getContentHub(),
    ]);

    const guides = guidesResult.status === 'fulfilled' && guidesResult.value.success
      ? guidesResult.value.guides
      : [];
    const hub = hubResult.status === 'fulfilled' && hubResult.value.success
      ? hubResult.value.hub
      : null;

    initBreadcrumbs();
    initCategoryFilters(guides);
    initGuideGrid(guides);
    initHubSeo(hub);
    initHubMeta();
  } catch (err) {
    console.error('Buying Guides hub init error:', err);
  }
});

// ── Breadcrumbs ───────────────────────────────────────────────────────

function initBreadcrumbs() {
  try {
    const crumbs = buildBreadcrumbs();
    const breadcrumbRepeater = $w('#breadcrumbRepeater');
    if (!breadcrumbRepeater) return;

    breadcrumbRepeater.data = crumbs.map((c, i) => ({ ...c, _id: `crumb-${i}` }));
    breadcrumbRepeater.onItemReady(($item, itemData, index) => {
      try { $item('#breadcrumbLabel').text = itemData.label; } catch (e) {}
      try { $item('#breadcrumbSeparator').text = index < crumbs.length - 1 ? '›' : ''; } catch (e) {}

      if (index < crumbs.length - 1) {
        try {
          $item('#breadcrumbLabel').onClick(() => {
            wixLocationFrontend.to(itemData.url);
          });
        } catch (e) {}
      }
    });
  } catch (e) {}
}

// ── Category Filters ─────────────────────────────────────────────────

let allGuides = [];
let activeCategory = 'all';

function initCategoryFilters(guides) {
  allGuides = guides;

  try {
    const filterRepeater = $w('#categoryFilterRepeater');
    if (!filterRepeater) return;

    const categories = getGuideCategories();
    const filterItems = [
      { _id: 'filter-all', slug: 'all', label: 'All Guides' },
      ...categories.map(c => ({ _id: `filter-${c.slug}`, slug: c.slug, label: c.label })),
    ];

    filterRepeater.data = filterItems;
    filterRepeater.onItemReady(($item, itemData) => {
      try { $item('#filterLabel').text = itemData.label; } catch (e) {}
      try {
        $item('#filterButton').label = itemData.label;
        $item('#filterButton').onClick(() => {
          activeCategory = itemData.slug;
          const filtered = filterGuidesByCategory(allGuides, activeCategory);
          initGuideGrid(filtered);
          trackEvent('guide_category_filter', { category: itemData.slug });
          announce($w, `Showing ${filtered.length} guides for ${itemData.label}`);
        });
      } catch (e) {}
    });
  } catch (e) {}
}

// ── Guide Grid ────────────────────────────────────────────────────────

function initGuideGrid(guides) {
  try {
    const gridRepeater = $w('#guidesRepeater');
    if (!gridRepeater) return;

    const cards = buildHubCardData(guides);
    if (!cards.length) {
      try { $w('#emptyStateBox').show(); } catch (e) {}
      try { gridRepeater.hide(); } catch (e) {}
      return;
    }

    try { $w('#emptyStateBox').hide(); } catch (e) {}
    try { gridRepeater.show(); } catch (e) {}
    gridRepeater.data = cards;

    gridRepeater.onItemReady(($item, itemData) => {
      try { $item('#guideTitle').text = itemData.title; } catch (e) {}
      try { $item('#guideDescription').text = itemData.description; } catch (e) {}
      try { $item('#guideCategoryLabel').text = itemData.categoryLabel; } catch (e) {}
      try { $item('#guideDate').text = formatGuideDate(itemData.publishDate); } catch (e) {}
      try {
        if (itemData.readingTime) {
          $item('#guideReadTime').text = `${itemData.readingTime} min read`;
        }
      } catch (e) {}
      try { $item('#guideHeroImage').src = itemData.heroImage; } catch (e) {}
      try { $item('#guideHeroImage').alt = `${itemData.title} hero image`; } catch (e) {}

      // Card click → navigate to guide detail
      const navigateToGuide = () => {
        trackEvent('guide_card_click', { slug: itemData.slug });
        wixLocationFrontend.to(itemData.url);
      };

      try { $item('#guideCardBox').onClick(navigateToGuide); } catch (e) {}
      try {
        makeClickable($item('#guideCardBox'), navigateToGuide, `Read ${itemData.title}`);
      } catch (e) {}

      // Read Guide CTA button
      try {
        $item('#readGuideButton').label = 'Read Guide';
        $item('#readGuideButton').onClick(navigateToGuide);
      } catch (e) {}
    });

    try { $w('#guideCountText').text = `${cards.length} Expert Buying Guides`; } catch (e) {}
  } catch (e) {
    console.error('Guide grid init error:', e);
  }
}

// ── SEO Schema ────────────────────────────────────────────────────────

function initHubSeo(hub) {
  if (!hub) return;
  try {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: hub.title,
      description: hub.metaDescription,
      url: hub.url,
      numberOfItems: hub.guideCount,
    };
    const schemaScript = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
    try { $w('#hubSeoSchema').postMessage(schemaScript); } catch (e) {}
  } catch (e) {}
}

// ── Meta Tags ─────────────────────────────────────────────────────────

async function initHubMeta() {
  try {
    const [title, description, canonical] = await Promise.all([
      getPageTitle('buyingGuides', {}),
      getPageMetaDescription('buyingGuides', {}),
      getCanonicalUrl('buyingGuides'),
    ]);
    try {
      $w('#hubMetaHtml').postMessage(JSON.stringify({ title, description, canonical }));
    } catch (e) {}
  } catch (e) {}
}
