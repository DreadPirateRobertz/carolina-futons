// Getting It Home.js — White-glove delivery options, coverage map, and scheduling CTA.
// URL: /getting-it-home
// cf-z8sj

import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { announce } from 'public/a11yHelpers';
import { initPageSeo } from 'public/pageSeo.js';
import {
  WHITE_GLOVE_CHECKLIST,
  DELIVERY_FAQ,
  buildDeliveryComparisonRows,
  getSchedulingCtaUrl,
  getCoverageDescription,
} from 'public/gettingItHomeHelpers.js';

$w.onReady(function () {
  initBackToTop($w);
  initPageSeo('getting-it-home');
  initHero();
  initDeliveryComparison();
  initWhiteGloveChecklist();
  initCoverageMap();
  initFaq();
  initSchedulingCta();
  trackEvent('page_view', { page: 'getting-it-home' });
});

// ── Hero ────────────────────────────────────────────────────────────

function initHero() {
  try { $w('#heroTitle').text = 'We Bring It Home — Professional Delivery & Setup'; } catch (e) {}
  try {
    $w('#heroSubtitle').text =
      'From curbside shipping to full white-glove delivery with assembly and debris removal — ' +
      'we have an option for every home and budget.';
  } catch (e) {}
}

// ── Delivery Comparison Table ─────────────────────────────────────────

function initDeliveryComparison() {
  try {
    const rows = buildDeliveryComparisonRows();
    const repeater = $w('#deliveryOptionsRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      try { $item('#optionName').text = itemData.option; } catch (e) {}
      try { $item('#optionPrice').text = itemData.priceLabel; } catch (e) {}
      try { $item('#optionDetails').text = itemData.details; } catch (e) {}
      try { $item('#optionTimeframe').text = itemData.timeframe; } catch (e) {}
      if (itemData.whiteGlove) {
        try { $item('#whiteGloveBadge').show(); } catch (e) {}
      }
    });
    repeater.data = rows;
  } catch (e) {}
}

// ── White Glove Checklist ─────────────────────────────────────────────

function initWhiteGloveChecklist() {
  try {
    const repeater = $w('#checklistRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      try { $item('#checklistItem').text = itemData.text; } catch (e) {}
    });
    repeater.data = WHITE_GLOVE_CHECKLIST.map((item, i) => ({ _id: String(i), text: item }));
  } catch (e) {}
}

// ── Coverage Map ──────────────────────────────────────────────────────

function initCoverageMap() {
  try {
    $w('#localZoneLabel').text = 'Local Zone (25-mile radius)';
    $w('#localZoneDesc').text = getCoverageDescription('local');
  } catch (e) {}
  try {
    $w('#regionalZoneLabel').text = 'Regional Zone (25–100 miles)';
    $w('#regionalZoneDesc').text = getCoverageDescription('regional');
  } catch (e) {}
}

// ── FAQ ───────────────────────────────────────────────────────────────

function initFaq() {
  try {
    const repeater = $w('#deliveryFaqRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      try {
        $item('#faqQuestion').text = itemData.q;
        $item('#faqAnswer').text = itemData.a;
        $item('#faqAnswer').collapse();

        $item('#faqQuestion').onClick(() => {
          try {
            const collapsed = $item('#faqAnswer').collapsed;
            if (collapsed) {
              $item('#faqAnswer').expand();
              announce($w, `${itemData.q} — expanded`);
            } else {
              $item('#faqAnswer').collapse();
            }
            trackEvent('delivery_faq_toggled', { question: itemData.q.slice(0, 50) });
          } catch (e) {}
        });
      } catch (e) {}
    });
    repeater.data = DELIVERY_FAQ.map((faq, i) => ({ _id: String(i), q: faq.q, a: faq.a }));
  } catch (e) {}
}

// ── Scheduling CTA ────────────────────────────────────────────────────

function initSchedulingCta() {
  try {
    $w('#scheduleCtaTitle').text = 'Ready for White Glove Delivery?';
    $w('#scheduleCtaSubtitle').text =
      "Contact us to schedule your white-glove delivery window. " +
      "We'll confirm coverage for your address and lock in a time that works for you.";
  } catch (e) {}

  try {
    const btn = $w('#scheduleCtaBtn');
    if (!btn) return;
    btn.label = 'Schedule White Glove Delivery';
    btn.link = getSchedulingCtaUrl();
    btn.onClick(() => {
      trackEvent('delivery_schedule_cta_clicked', { source: 'getting-it-home' });
    });
  } catch (e) {}
}
