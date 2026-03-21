// Topic Cluster.js — Cluster overview page at /guides/{slug}
// Renders pillar article content, spoke page card grid, related cluster nav,
// breadcrumbs, internal links sidebar, and SEO schema for topic cluster pages.
import { getTopicClusterPage } from 'backend/topicClusters.web';
import wixLocationFrontend from 'wix-location-frontend';
import wixSeo from 'wix-seo';
import { initBackToTop } from 'public/mobileHelpers';
import { announce, makeClickable } from 'public/a11yHelpers';
import {
  buildClusterBreadcrumbs,
  buildSpokeCards,
} from 'public/topicClusterHelpers';

$w.onReady(async function () {
  initBackToTop($w);

  try {
    const path = wixLocationFrontend.path;
    const slug = path && path.length > 0 ? path[path.length - 1] : null;

    if (!slug) {
      showNotFound();
      return;
    }

    const result = await getTopicClusterPage(slug);

    if (!result.success || !result.page) {
      showNotFound();
      return;
    }

    const { page } = result;

    initSeo(page);
    initBreadcrumbs(page.cluster.pillarTitle);
    initPillarContent(page.pillarContent);
    initSpokeCards(page.cluster.spokePages);
    initRelatedNav(page.relatedClusters);
    initInternalLinksSidebar(page.internalLinks);
    announce(`Loaded ${page.cluster.pillarTitle}`);
  } catch (err) {
    console.error('Topic Cluster page init error:', err);
    showNotFound();
  }
});

// ── SEO ────────────────────────────────────────────────────────────────

function initSeo(page) {
  try {
    wixSeo.setTitle(page.metaTitle);
    wixSeo.setDescription(page.metaDescription);
    wixSeo.setLinks([{ rel: 'canonical', href: page.canonicalUrl }]);
  } catch (e) {
    console.error('Topic Cluster SEO init error:', e);
  }
}

// ── Breadcrumbs ────────────────────────────────────────────────────────

function initBreadcrumbs(clusterTitle) {
  try {
    const crumbs = buildClusterBreadcrumbs(clusterTitle);
    const breadcrumbRepeater = $w('#breadcrumbRepeater');
    if (!breadcrumbRepeater) return;

    breadcrumbRepeater.onItemReady(($item, itemData) => {
      try { $item('#breadcrumbLabel').text = itemData.label; } catch (e) {}
      if (!itemData.isLast && itemData.url) {
        try {
          makeClickable($item('#breadcrumbLabel'), () => {
            wixLocationFrontend.to(itemData.url);
          }, { ariaLabel: `Go to ${itemData.label}` });
        } catch (e) {}
      }
    });
    breadcrumbRepeater.data = crumbs.map((c, i) => ({ ...c, _id: `crumb-${i}` }));
  } catch (e) {}
}

// ── Pillar Article Content ─────────────────────────────────────────────

function initPillarContent(content) {
  try {
    if (!content) return;

    try { $w('#pillarIntro').text = content.intro || ''; } catch (e) {}

    // Render content sections into a repeater
    const sections = Array.isArray(content.sections) ? content.sections : [];
    const sectionRepeater = $w('#contentSectionRepeater');
    if (sectionRepeater && sections.length > 0) {
      sectionRepeater.onItemReady(($item, itemData) => {
        try { $item('#sectionHeading').text = itemData.heading || ''; } catch (e) {}
        try { $item('#sectionBody').text = itemData.body || ''; } catch (e) {}
      });
      sectionRepeater.data = sections.map((s, i) => ({ ...s, _id: `section-${i}` }));
    }

    // Render FAQs
    const faqs = Array.isArray(content.faqs) ? content.faqs : [];
    const faqRepeater = $w('#faqRepeater');
    if (faqRepeater && faqs.length > 0) {
      faqRepeater.onItemReady(($item, itemData) => {
        try { $item('#faqQuestion').text = itemData.question || ''; } catch (e) {}
        try { $item('#faqAnswer').text = itemData.answer || ''; } catch (e) {}
      });
      faqRepeater.data = faqs.map((f, i) => ({ ...f, _id: `faq-${i}` }));
    }
  } catch (e) {}
}

// ── Spoke Page Cards ────────────────────────────────────────────────────

function initSpokeCards(spokePages) {
  try {
    const cards = buildSpokeCards(spokePages);
    const spokeRepeater = $w('#spokeCardRepeater');
    if (!spokeRepeater || cards.length === 0) return;

    spokeRepeater.onItemReady(($item, itemData) => {
      try { $item('#spokeTitle').text = itemData.title; } catch (e) {}
      try { $item('#spokeTypeLabel').text = itemData.typeLabel; } catch (e) {}
      try {
        makeClickable($item('#spokeCardLink'), () => {
          wixLocationFrontend.to(itemData.url);
        }, { ariaLabel: `Read: ${itemData.title}` });
      } catch (e) {}
    });
    spokeRepeater.data = cards;
  } catch (e) {}
}

// ── Related Cluster Nav ─────────────────────────────────────────────────

function initRelatedNav(relatedClusters) {
  try {
    const navItems = Array.isArray(relatedClusters) ? relatedClusters : [];
    const navRepeater = $w('#relatedClusterRepeater');
    if (!navRepeater || navItems.length === 0) return;

    navRepeater.onItemReady(($item, itemData) => {
      try { $item('#relatedClusterTitle').text = itemData.title; } catch (e) {}
      try {
        makeClickable($item('#relatedClusterLink'), () => {
          wixLocationFrontend.to(itemData.url);
        }, { ariaLabel: `Go to ${itemData.title}` });
      } catch (e) {}
    });
    navRepeater.data = navItems.map((item, i) => ({ ...item, _id: `nav-${i}` }));
  } catch (e) {}
}

// ── Internal Links Section ─────────────────────────────────────────────
// Renders inline-context (pillar-to-spoke) links. Cross-cluster sidebar
// links (context:'sidebar') are shown via initRelatedNav above.

function initInternalLinksSidebar(links) {
  try {
    const inlineLinks = Array.isArray(links)
      ? links.filter(l => l.context === 'inline')
      : [];
    const linksRepeater = $w('#internalLinksRepeater');
    if (!linksRepeater || inlineLinks.length === 0) return;

    linksRepeater.onItemReady(($item, itemData) => {
      try { $item('#linkAnchorText').text = itemData.anchorText; } catch (e) {}
      try {
        makeClickable($item('#linkItem'), () => {
          wixLocationFrontend.to(itemData.targetUrl);
        }, { ariaLabel: `Read: ${itemData.anchorText}` });
      } catch (e) {}
    });
    linksRepeater.data = inlineLinks.map((l, i) => ({ ...l, _id: `link-${i}` }));
  } catch (e) {}
}

// ── Not Found ───────────────────────────────────────────────────────────

function showNotFound() {
  try { $w('#clusterContent').hide(); } catch (e) {}
  try { $w('#notFoundMessage').show(); } catch (e) {}
}
