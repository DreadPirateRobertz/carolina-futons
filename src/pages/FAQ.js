// FAQ.js - Frequently Asked Questions
// Accordion-style FAQ with category filters, search, SEO schema markup, and engagement tracking
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { announce } from 'public/a11yHelpers';
import { injectFaqSeo } from 'public/faqSeo.js';
import {
  getFaqData,
  getFaqCategories,
  filterFaqsByCategory,
  searchFaqs,
} from 'public/faqHelpers.js';

let currentCategory = null;
let currentQuery = '';

$w.onReady(async function () {
  initBackToTop($w);
  initCategoryFilters();
  initFaqAccordion();
  initFaqSearch();
  await injectFaqSeo();
  trackEvent('page_view', { page: 'faq' });
});

// ── Category Filters ─────────────────────────────────────────────────

function initCategoryFilters() {
  try {
    const catRepeater = $w('#faqCategoryRepeater');
    if (!catRepeater) return;

    const categories = getFaqCategories();
    const allOption = { _id: 'cat-all', id: '', label: 'All', description: 'Show all FAQs' };
    const catData = [allOption, ...categories.map(c => ({ ...c, _id: `cat-${c.id}` }))];

    try { catRepeater.accessibility.ariaLabel = 'FAQ category filters'; } catch (e) {}
    try { catRepeater.accessibility.role = 'tablist'; } catch (e) {}

    catRepeater.onItemReady(($item, itemData) => {
      $item('#categoryLabel').text = itemData.label;
      try { $item('#categoryLabel').accessibility.role = 'tab'; } catch (e) {}
      try { $item('#categoryLabel').accessibility.ariaLabel = `Filter FAQs: ${itemData.label}`; } catch (e) {}
      try { $item('#categoryLabel').accessibility.tabIndex = 0; } catch (e) {}

      const selectCategory = () => {
        currentCategory = itemData.id || null;
        applyFilters();
        trackEvent('faq_category', { category: itemData.label });
        announce($w, `Showing ${itemData.label} FAQs`);
      };

      $item('#categoryLabel').onClick(selectCategory);
      try {
        $item('#categoryLabel').onKeyPress((event) => {
          if (event.key === 'Enter' || event.key === ' ') selectCategory();
        });
      } catch (e) {}
    });
    catRepeater.data = catData;
  } catch (e) {}
}

// ── FAQ Accordion ───────────────────────────────────────────────────

function initFaqAccordion() {
  try {
    const repeater = $w('#faqRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      $item('#faqQuestion').text = itemData.question;
      $item('#faqAnswer').text = itemData.answer;

      // Start collapsed
      $item('#faqAnswer').collapse();
      $item('#faqToggle').text = '+';

      // ARIA for accordion
      try { $item('#faqQuestion').accessibility.role = 'button'; } catch (e) {}
      try { $item('#faqQuestion').accessibility.ariaLabel = `Toggle answer: ${itemData.question}`; } catch (e) {}
      try { $item('#faqToggle').accessibility.ariaLabel = `Toggle answer: ${itemData.question}`; } catch (e) {}
      try { $item('#faqToggle').accessibility.ariaExpanded = false; } catch (e) {}

      // Toggle on click and keyboard (Enter/Space)
      const toggle = () => toggleFaqItem($item, itemData.question);
      $item('#faqQuestion').onClick(toggle);
      $item('#faqToggle').onClick(toggle);
      try {
        $item('#faqQuestion').onKeyPress((event) => {
          if (event.key === 'Enter' || event.key === ' ') toggle();
        });
        $item('#faqQuestion').accessibility.tabIndex = 0;
      } catch (e) {}
      try {
        $item('#faqToggle').onKeyPress((event) => {
          if (event.key === 'Enter' || event.key === ' ') toggle();
        });
        $item('#faqToggle').accessibility.tabIndex = 0;
      } catch (e) {}
    });
    repeater.data = getFaqData();
  } catch (e) {}
}

function toggleFaqItem($item, question) {
  try {
    if ($item('#faqAnswer').collapsed) {
      $item('#faqAnswer').expand();
      $item('#faqToggle').text = '\u2212';
      try { $item('#faqToggle').accessibility.ariaExpanded = true; } catch (e) {}
      if (question) trackEvent('faq_expand', { question });
    } else {
      $item('#faqAnswer').collapse();
      $item('#faqToggle').text = '+';
      try { $item('#faqToggle').accessibility.ariaExpanded = false; } catch (e) {}
    }
  } catch (e) {}
}

// ── FAQ Search / Filter ────────────────────────────────────────────

function initFaqSearch() {
  try {
    const searchInput = $w('#faqSearchInput');
    if (!searchInput) return;

    try { searchInput.accessibility.ariaLabel = 'Search frequently asked questions'; } catch (e) {}

    let debounceTimer;
    searchInput.onKeyPress(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentQuery = searchInput.value?.trim().toLowerCase() || '';
        applyFilters();
      }, 300);
    });
  } catch (e) {}
}

function applyFilters() {
  try {
    const repeater = $w('#faqRepeater');
    if (!repeater) return;

    let filtered = getFaqData();
    filtered = filterFaqsByCategory(filtered, currentCategory);
    filtered = searchFaqs(filtered, currentQuery);

    if (filtered.length === 0) {
      try {
        const msg = currentQuery
          ? `No FAQs match "${currentQuery}". Try a different search or contact us!`
          : 'No FAQs in this category.';
        $w('#faqNoResults').text = msg;
        $w('#faqNoResults').expand();
      } catch (e) {}
      announce($w, `No FAQs found`);
    } else {
      try { $w('#faqNoResults').collapse(); } catch (e) {}
      announce($w, `${filtered.length} FAQ${filtered.length !== 1 ? 's' : ''} found`);
    }

    repeater.data = filtered;
    if (currentQuery) {
      trackEvent('faq_search', { query: currentQuery, resultCount: filtered.length });
    }
  } catch (e) {}
}

