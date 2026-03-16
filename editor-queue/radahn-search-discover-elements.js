// TARGET: Search Results page
// DESCRIPTION: Discover all components and their current nicknames, then identify missing Velo IDs
// AUTHOR: radahn
// DEPENDS: none
// NOTE: Run this FIRST to get a component inventory

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

  // Required Velo nicknames for Search Results page (36 unique IDs from page code)
  const required = [
    'categoryFilter', 'chipLabel', 'clearFiltersBtn', 'colorFilter',
    'filterBadge', 'filterSidebar', 'filterToggleBtn',
    'loadingIndicator', 'loadMoreBtn', 'materialFilter',
    'noResultsBox', 'noResultsText', 'priceFilter', 'resultCount',
    'searchAddBtn', 'searchBtn', 'searchChipsRepeater', 'searchDesc',
    'searchImage', 'searchInput', 'searchName', 'searchOrigPrice',
    'searchPrice', 'searchQuery', 'searchRepeater', 'searchRibbon',
    'searchSwatchDot1', 'searchSwatchDot2', 'searchSwatchDot3',
    'searchSwatchDot4', 'searchSwatchPreview', 'sortDropdown',
    'suggestionsBox', 'suggestionsRepeater', 'suggestionText', 'suggestionType',
  ];

  const existingNicknames = new Set(inventory.filter(c => c.nickname).map(c => c.nickname));
  const missing = required.filter(n => !existingNicknames.has(n));
  const found = required.filter(n => existingNicknames.has(n));

  console.log('=== SEARCH RESULTS PAGE ELEMENT INVENTORY ===');
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
