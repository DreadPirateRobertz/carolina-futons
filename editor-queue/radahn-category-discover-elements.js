// TARGET: Category Page
// DESCRIPTION: Discover all components and their current nicknames, then set missing Velo IDs
// AUTHOR: radahn
// DEPENDS: none
// NOTE: Run this FIRST to get a component inventory, then run the setter script

// Phase 1: Discovery — list all components on the Category Page with their types and nicknames
(function(ds, doc) {
  const pageRef = ds.pages.getCurrentPage();
  const allComps = ds.components.get.byType('DESKTOP', pageRef);

  const inventory = [];
  for (const comp of allComps) {
    const nickname = ds.components.getNickname(comp) || '';
    const type = ds.components.getType(comp) || '';
    const data = ds.components.data.get(comp) || {};
    inventory.push({
      id: comp.id,
      type,
      nickname,
      text: (data.text || '').substring(0, 50),
      label: data.label || '',
    });
  }

  // Required Velo nicknames for Category Page (88 unique IDs from page code)
  const required = [
    'activeFilterChips', 'breadcrumbCurrent', 'breadcrumbHome',
    'categoryBreadcrumbSchemaHtml', 'categoryDataset', 'categoryHeroSection',
    'categoryHeroSkyline', 'categoryHeroSubtitle', 'categoryHeroTitle',
    'categoryOgHtml', 'categorySchemaHtml', 'chipLabel', 'chipRemove',
    'clearAllFilters', 'clearAllFiltersChip', 'clearFilters',
    'compareBar', 'compareName', 'comparePrice', 'compareRemove',
    'compareRepeater', 'compareThumb', 'compareViewBtn',
    'emptyStateIllustration', 'emptyStateMessage', 'emptyStateSection',
    'emptyStateTitle', 'filterBrand', 'filterCategory', 'filterChipRepeater',
    'filterChipsText', 'filterColor', 'filterComfortLevel', 'filterDepthMax',
    'filterDepthMin', 'filterDrawer', 'filterDrawerApply', 'filterDrawerOverlay',
    'filterFeatures', 'filterLoadingIndicator', 'filterMaterial', 'filterPrice',
    'filterPriceRange', 'filterResultCount', 'filterSize', 'filterToggleBtn',
    'filterWidthMax', 'filterWidthMin', 'flashSaleBanner',
    'gridBadge', 'gridBrand', 'gridCard', 'gridCompareBtn', 'gridFabricBadge',
    'gridImage', 'gridLifestyleBadge', 'gridName', 'gridOrigPrice', 'gridPrice',
    'gridRibbon', 'gridSaleBadge', 'gridSwatchPreview',
    'mobileSortBar', 'noMatchesMessage', 'noMatchesSection',
    'noMatchesSuggestion', 'noMatchesTitle', 'productGridRepeater',
    'quickViewBtn', 'quickViewModal', 'qvAddToCart', 'qvClose',
    'qvDescription', 'qvImage', 'qvName', 'qvPrice', 'qvSizeSelect', 'qvViewFull',
    'recentImage', 'recentlyViewedRepeater', 'recentlyViewedSection',
    'recentlyViewedTitle', 'recentName', 'recentPrice', 'resultCount',
    'sortDropdown', 'swatchDot1', 'swatchDot2', 'swatchDot3', 'swatchDot4',
  ];

  const existingNicknames = new Set(inventory.filter(c => c.nickname).map(c => c.nickname));
  const missing = required.filter(n => !existingNicknames.has(n));
  const found = required.filter(n => existingNicknames.has(n));

  console.log('=== CATEGORY PAGE ELEMENT INVENTORY ===');
  console.log(`Total components: ${inventory.length}`);
  console.log(`Required nicknames: ${required.length}`);
  console.log(`Already set: ${found.length}`);
  console.log(`Missing: ${missing.length}`);
  console.log('\n--- MISSING NICKNAMES ---');
  missing.forEach(n => console.log(`  - ${n}`));
  console.log('\n--- ALL COMPONENTS ---');
  inventory.forEach(c => console.log(`  ${c.id} | ${c.type} | nickname="${c.nickname}" | "${c.text || c.label}"`));

  return {
    status: 'discovery',
    totalComponents: inventory.length,
    required: required.length,
    found: found.length,
    missing,
    inventory,
  };
})(ds, doc);
