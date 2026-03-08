// Buying Guide.js — Individual buying guide detail page
// Renders guide content sections, comparison table, FAQs, social share,
// related products sidebar, breadcrumbs, TOC, and SEO schema
import {
  getBuyingGuide,
  getBuyingGuideSchema,
  getGuideComparisonTable,
  getGuideFaqs,
  getSocialShareLinks,
} from 'backend/buyingGuides.web';
import { getPillarGuide } from 'backend/seoContentHub.web';
import { getPageTitle, getCanonicalUrl, getPageMetaDescription } from 'backend/seoHelpers.web';
import { initPageSeo } from 'public/pageSeo.js';
import wixLocationFrontend from 'wix-location-frontend';
import { initBackToTop, isMobile } from 'public/mobileHelpers';
import { trackEvent } from 'public/engagementTracker';
import { announce, makeClickable } from 'public/a11yHelpers';
import {
  buildBreadcrumbs,
  buildTableOfContents,
  buildComparisonRows,
  buildFaqAccordionData,
  buildShareLinks,
  getRelatedGuideCards,
  getReadingTime,
  formatGuideDate,
} from 'public/buyingGuidesHelpers';

$w.onReady(async function () {
  initBackToTop($w);

  try {
    const path = wixLocationFrontend.path;
    const slug = path && path.length > 0 ? path[path.length - 1] : null;
    if (!slug) return;

    trackEvent('page_view', { page: 'buying_guide', slug });

    // Fetch all guide data in parallel
    const [guideResult, schemaResult, tableResult, faqResult, pillarResult] =
      await Promise.allSettled([
        getBuyingGuide(slug),
        getBuyingGuideSchema(slug),
        getGuideComparisonTable(slug),
        getGuideFaqs(slug),
        getPillarGuide(slug),
      ]);

    const guide = guideResult.status === 'fulfilled' && guideResult.value.success
      ? guideResult.value.guide
      : null;

    if (!guide) {
      showNotFound();
      return;
    }

    if (guide.comingSoon) {
      showComingSoon(guide);
      return;
    }

    const schemas = schemaResult.status === 'fulfilled' && schemaResult.value.success
      ? schemaResult.value
      : {};
    const table = tableResult.status === 'fulfilled' && tableResult.value.success
      ? tableResult.value.table
      : null;
    const faqs = faqResult.status === 'fulfilled' && faqResult.value.success
      ? faqResult.value.faqs
      : null;
    const pillar = pillarResult.status === 'fulfilled' && pillarResult.value.success
      ? pillarResult.value
      : null;

    initBreadcrumbs(guide.slug, guide.categoryLabel);
    initGuideHeader(guide);
    initTableOfContents(guide.sections);
    initGuideSections(guide.sections);
    initComparisonTable(table);
    initFaqSection(faqs);
    initShareButtons(guide.slug, guide.title);
    initRelatedProducts(guide.relatedProducts);
    initRelatedGuides(pillar);
    initGuideSchema(schemas);
    initGuideMeta(slug, guide.title);
    initPageSeo('buyingGuide', { name: guide.title, slug });
  } catch (err) {
    console.error('Buying Guide page init error:', err);
  }
});

// ── Not Found / Coming Soon ───────────────────────────────────────────

function showNotFound() {
  try { $w('#guideContent').hide(); } catch (e) {}
  try { $w('#notFoundBox').show(); } catch (e) {}
}

function showComingSoon(guide) {
  try { $w('#guideContent').hide(); } catch (e) {}
  try { $w('#comingSoonBox').show(); } catch (e) {}
  try { $w('#comingSoonTitle').text = guide.title; } catch (e) {}
  try { $w('#comingSoonMessage').text = guide.message; } catch (e) {}
}

// ── Breadcrumbs ───────────────────────────────────────────────────────

function initBreadcrumbs(slug, label) {
  try {
    const crumbs = buildBreadcrumbs(slug, label);
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

// ── Guide Header ──────────────────────────────────────────────────────

function initGuideHeader(guide) {
  try { $w('#guideTitle').text = guide.title; } catch (e) {}
  try { $w('#guideCategoryLabel').text = guide.categoryLabel; } catch (e) {}
  try { $w('#guideDate').text = `Updated ${formatGuideDate(guide.updatedDate)}`; } catch (e) {}
  try {
    const readTime = getReadingTime(guide.sections);
    $w('#guideReadTime').text = `${readTime} min read`;
  } catch (e) {}
  try {
    $w('#guideHeroImage').src = guide.heroImage;
    $w('#guideHeroImage').alt = `${guide.title} hero image`;
  } catch (e) {}
}

// ── Table of Contents ─────────────────────────────────────────────────

function initTableOfContents(sections) {
  try {
    const toc = buildTableOfContents(sections);
    const tocRepeater = $w('#tocRepeater');
    if (!tocRepeater || !toc.length) return;

    tocRepeater.data = toc.map(item => ({ ...item, _id: `toc-${item.id}` }));
    tocRepeater.onItemReady(($item, itemData) => {
      try { $item('#tocLabel').text = itemData.label; } catch (e) {}
      try {
        const scrollToSection = () => {
          try { $w(`#section-${itemData.id}`).scrollTo(); } catch (e) {}
          trackEvent('guide_toc_click', { section: itemData.id });
        };
        $item('#tocLabel').onClick(scrollToSection);
        makeClickable($item('#tocLabel'), scrollToSection, `Jump to ${itemData.label}`);
      } catch (e) {}
    });

    // Collapse TOC on mobile by default
    if (isMobile()) {
      try { $w('#tocContainer').collapse(); } catch (e) {}
      try {
        $w('#tocToggle').onClick(() => {
          try {
            const container = $w('#tocContainer');
            if (container.collapsed) {
              container.expand();
              announce($w, 'Table of contents expanded');
            } else {
              container.collapse();
              announce($w, 'Table of contents collapsed');
            }
          } catch (e) {}
        });
      } catch (e) {}
    }
  } catch (e) {}
}

// ── Guide Sections ────────────────────────────────────────────────────

function initGuideSections(sections) {
  try {
    const sectionRepeater = $w('#sectionRepeater');
    if (!sectionRepeater || !sections || !sections.length) return;

    const sectionData = sections.map((s, i) => {
      const id = s.heading.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      return {
        _id: `section-${id}`,
        heading: s.heading,
        body: s.body,
        index: i,
      };
    });

    sectionRepeater.data = sectionData;
    sectionRepeater.onItemReady(($item, itemData) => {
      try { $item('#sectionHeading').text = itemData.heading; } catch (e) {}
      try { $item('#sectionBody').text = itemData.body; } catch (e) {}
    });
  } catch (e) {}
}

// ── Comparison Table ──────────────────────────────────────────────────

function initComparisonTable(table) {
  if (!table) {
    try { $w('#comparisonBox').collapse(); } catch (e) {}
    return;
  }

  try { $w('#comparisonTitle').text = table.title; } catch (e) {}

  // Render headers
  try {
    const headerRepeater = $w('#comparisonHeaderRepeater');
    if (headerRepeater) {
      headerRepeater.data = table.headers.map((h, i) => ({ _id: `hdr-${i}`, label: h }));
      headerRepeater.onItemReady(($item, itemData) => {
        try { $item('#headerLabel').text = itemData.label; } catch (e) {}
      });
    }
  } catch (e) {}

  // Render rows
  try {
    const rows = buildComparisonRows(table);
    const rowRepeater = $w('#comparisonRowRepeater');
    if (rowRepeater && rows.length) {
      rowRepeater.data = rows;
      rowRepeater.onItemReady(($item, itemData) => {
        try { $item('#featureLabel').text = itemData.feature; } catch (e) {}
        // Render value cells
        try {
          const valueRepeater = $item('#valueCellRepeater');
          if (valueRepeater) {
            valueRepeater.data = itemData.values.map((v, i) => ({ _id: `val-${i}`, value: v }));
            valueRepeater.onItemReady(($cell, cellData) => {
              try { $cell('#cellValue').text = cellData.value; } catch (e) {}
            });
          }
        } catch (e) {}
      });
    }
  } catch (e) {}

  try { $w('#comparisonBox').expand(); } catch (e) {}
  trackEvent('guide_comparison_view', { title: table.title });
}

// ── FAQ Section ───────────────────────────────────────────────────────

function initFaqSection(faqs) {
  if (!faqs || !faqs.length) {
    try { $w('#faqBox').collapse(); } catch (e) {}
    return;
  }

  try {
    const faqData = buildFaqAccordionData(faqs);
    const faqRepeater = $w('#guideFaqRepeater');
    if (!faqRepeater) return;

    faqRepeater.data = faqData;
    faqRepeater.onItemReady(($item, itemData) => {
      try { $item('#faqQuestion').text = itemData.question; } catch (e) {}
      try { $item('#faqAnswer').text = itemData.answer; } catch (e) {}
      try { $item('#faqAnswer').collapse(); } catch (e) {}

      // Accordion toggle
      try {
        const toggleFaq = () => {
          try {
            const answer = $item('#faqAnswer');
            if (answer.collapsed) {
              answer.expand();
              announce($w, `Answer: ${itemData.answer.substring(0, 100)}`);
              trackEvent('guide_faq_expand', { question: itemData.question });
            } else {
              answer.collapse();
            }
          } catch (e) {}
        };
        $item('#faqQuestion').onClick(toggleFaq);
        makeClickable($item('#faqQuestion'), toggleFaq, `Toggle answer for: ${itemData.question}`);
      } catch (e) {}
    });

    try { $w('#faqBox').expand(); } catch (e) {}
  } catch (e) {}
}

// ── Share Buttons ─────────────────────────────────────────────────────

function initShareButtons(slug, title) {
  try {
    const links = buildShareLinks(slug, title);
    if (!links.facebook) return;

    try {
      $w('#shareFacebook').onClick(() => {
        trackEvent('guide_share', { platform: 'facebook', slug });
        wixLocationFrontend.to(links.facebook);
      });
    } catch (e) {}
    try {
      $w('#shareTwitter').onClick(() => {
        trackEvent('guide_share', { platform: 'twitter', slug });
        wixLocationFrontend.to(links.twitter);
      });
    } catch (e) {}
    try {
      $w('#sharePinterest').onClick(() => {
        trackEvent('guide_share', { platform: 'pinterest', slug });
        wixLocationFrontend.to(links.pinterest);
      });
    } catch (e) {}
    try {
      $w('#shareEmail').onClick(() => {
        trackEvent('guide_share', { platform: 'email', slug });
        wixLocationFrontend.to(links.email);
      });
    } catch (e) {}
  } catch (e) {}
}

// ── Related Products Sidebar ──────────────────────────────────────────

function initRelatedProducts(products) {
  if (!products || !products.length) {
    try { $w('#relatedProductsBox').collapse(); } catch (e) {}
    return;
  }

  try {
    const productRepeater = $w('#relatedProductRepeater');
    if (!productRepeater) return;

    productRepeater.data = products.map(p => ({ ...p, _id: p._id || `prod-${p.slug}` }));
    productRepeater.onItemReady(($item, itemData) => {
      try { $item('#productName').text = itemData.name; } catch (e) {}
      try { $item('#productPrice').text = itemData.formattedPrice; } catch (e) {}
      try {
        if (itemData.mainMedia) {
          $item('#productImage').src = itemData.mainMedia;
        }
      } catch (e) {}
      try {
        if (itemData.ribbon) {
          $item('#productRibbon').text = itemData.ribbon;
          $item('#productRibbon').show();
        } else {
          $item('#productRibbon').hide();
        }
      } catch (e) {}

      try {
        const goToProduct = () => {
          trackEvent('guide_product_click', { slug: itemData.slug });
          wixLocationFrontend.to(`/product-page/${itemData.slug}`);
        };
        $item('#productCardBox').onClick(goToProduct);
        makeClickable($item('#productCardBox'), goToProduct, `View ${itemData.name}`);
      } catch (e) {}
    });

    try { $w('#relatedProductsBox').expand(); } catch (e) {}
  } catch (e) {}
}

// ── Related Guides ────────────────────────────────────────────────────

function initRelatedGuides(pillar) {
  if (!pillar || !pillar.relatedGuides || !pillar.relatedGuides.length) {
    try { $w('#relatedGuidesBox').collapse(); } catch (e) {}
    return;
  }

  try {
    const cards = pillar.relatedGuides.map(g => ({
      _id: `related-${g.slug}`,
      slug: g.slug,
      title: g.shortTitle || g.title,
      description: g.description,
      url: `/buying-guides/${g.slug}`,
    }));

    const relatedRepeater = $w('#relatedGuideRepeater');
    if (!relatedRepeater) return;

    relatedRepeater.data = cards;
    relatedRepeater.onItemReady(($item, itemData) => {
      try { $item('#relatedGuideTitle').text = itemData.title; } catch (e) {}
      try { $item('#relatedGuideDescription').text = itemData.description; } catch (e) {}

      try {
        const goToGuide = () => {
          trackEvent('guide_related_click', { slug: itemData.slug });
          wixLocationFrontend.to(itemData.url);
        };
        $item('#relatedGuideBox').onClick(goToGuide);
        makeClickable($item('#relatedGuideBox'), goToGuide, `Read ${itemData.title} guide`);
      } catch (e) {}
    });

    try { $w('#relatedGuidesBox').expand(); } catch (e) {}
  } catch (e) {}
}

// ── SEO Schema ────────────────────────────────────────────────────────

function initGuideSchema(schemas) {
  try {
    const parts = [];
    if (schemas.articleSchema) {
      parts.push(`<script type="application/ld+json">${schemas.articleSchema}</script>`);
    }
    if (schemas.faqSchema) {
      parts.push(`<script type="application/ld+json">${schemas.faqSchema}</script>`);
    }
    if (parts.length > 0) {
      try { $w('#guideSeoSchema').postMessage(parts.join('\n')); } catch (e) {}
    }
  } catch (e) {}
}

// ── Meta Tags ─────────────────────────────────────────────────────────

async function initGuideMeta(slug, title) {
  try {
    const [pageTitle, description, canonical] = await Promise.all([
      getPageTitle('buyingGuide', { title }),
      getPageMetaDescription('buyingGuide', { title }),
      getCanonicalUrl('buyingGuide', slug),
    ]);
    try {
      $w('#guideMetaHtml').postMessage(JSON.stringify({
        title: pageTitle,
        description,
        canonical,
      }));
    } catch (e) {}
  } catch (e) {}
}
