// Sustainability.js - Sustainability Showcase Page
// Eco-friendly materials, certifications, carbon offset,
// and trade-in program with local SEO signals
import { getBusinessSchema } from 'backend/seoHelpers.web';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { makeClickable } from 'public/a11yHelpers.js';
import {
  getSustainabilityPageContent,
  getMaterialHighlights,
  getCertificationsList,
  getBadgeDefinitions,
  getConditionOptions,
  getTradeInSteps,
  formatCarbonData,
  estimateCreditRange,
} from 'public/sustainabilityHelpers.js';

$w.onReady(async function () {
  initBackToTop($w);
  initHero();
  initMaterials();
  initCertifications();
  initBadgesShowcase();
  initCarbonOffset();
  initTradeIn();
  initTradeInSteps();
  await injectSchema();
  trackEvent('page_view', { page: 'sustainability' });
});

// ── Hero Section ────────────────────────────────────────────────────

function initHero() {
  try {
    const content = getSustainabilityPageContent();
    try { $w('#sustainHeroHeading').text = content.hero.heading; } catch (e) {}
    try { $w('#sustainHeroSubheading').text = content.hero.subheading; } catch (e) {}
    try { $w('#sustainHeroIntro').text = content.hero.intro; } catch (e) {}
  } catch (e) {}
}

// ── Materials Section ───────────────────────────────────────────────

function initMaterials() {
  try {
    const repeater = $w('#materialsRepeater');
    if (!repeater) return;

    const content = getSustainabilityPageContent();
    try { $w('#materialsHeading').text = content.materials.heading; } catch (e) {}
    try { $w('#materialsDescription').text = content.materials.description; } catch (e) {}

    const highlights = getMaterialHighlights();
    try { repeater.accessibility.ariaLabel = 'Sustainably sourced materials'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      try { $item('#materialTitle').text = itemData.title; } catch (e) {}
      try { $item('#materialDesc').text = itemData.description; } catch (e) {}
    });
    repeater.data = highlights.map((h, i) => ({ ...h, _id: `material-${i}` }));
  } catch (e) {}
}

// ── Certifications Section ──────────────────────────────────────────

function initCertifications() {
  try {
    const repeater = $w('#certificationsRepeater');
    if (!repeater) return;

    const content = getSustainabilityPageContent();
    try { $w('#certificationsHeading').text = content.certifications.heading; } catch (e) {}

    const certs = getCertificationsList();
    try { repeater.accessibility.ariaLabel = 'Environmental certifications'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      try { $item('#certName').text = itemData.name; } catch (e) {}
      try { $item('#certDesc').text = itemData.description; } catch (e) {}
    });
    repeater.data = certs.map((c, i) => ({ ...c, _id: `cert-${i}` }));
  } catch (e) {}
}

// ── Badges Showcase ─────────────────────────────────────────────────

function initBadgesShowcase() {
  try {
    const repeater = $w('#badgesRepeater');
    if (!repeater) return;

    const badges = getBadgeDefinitions();
    try { repeater.accessibility.ariaLabel = 'Sustainability badges'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      try { $item('#badgeLabel').text = itemData.label; } catch (e) {}
      try { $item('#badgeDesc').text = itemData.description; } catch (e) {}
    });
    repeater.data = badges.map((b, i) => ({ ...b, _id: `badge-${i}` }));
  } catch (e) {}
}

// ── Carbon Offset Section ───────────────────────────────────────────

function initCarbonOffset() {
  try {
    const section = $w('#carbonOffsetSection');
    if (!section) return;

    try { $w('#carbonHeading').text = 'Carbon Offset at Checkout'; } catch (e) {}
    try {
      $w('#carbonDescription').text = 'Add a small contribution at checkout to offset the carbon footprint of your purchase. We partner with verified reforestation programs.';
    } catch (e) {}
  } catch (e) {}
}

// ── Trade-In Section ────────────────────────────────────────────────

function initTradeIn() {
  try {
    const content = getSustainabilityPageContent();
    try { $w('#tradeInHeading').text = content.tradeIn.heading; } catch (e) {}
    try { $w('#tradeInDescription').text = content.tradeIn.description; } catch (e) {}

    // Condition dropdown
    const dropdown = $w('#tradeInCondition');
    if (dropdown) {
      const options = getConditionOptions();
      try {
        dropdown.options = options.map(o => ({ value: o.value, label: o.label }));
      } catch (e) {}

      // Show credit estimate on selection
      try {
        dropdown.onChange(() => {
          const selected = dropdown.value;
          const range = estimateCreditRange(selected);
          if (range) {
            try {
              $w('#tradeInEstimate').text = `Estimated credit: $${range.min}–$${range.max}`;
            } catch (e) {}
          }
        });
      } catch (e) {}
    }
  } catch (e) {}
}

// ── Trade-In Steps ──────────────────────────────────────────────────

function initTradeInSteps() {
  try {
    const repeater = $w('#tradeInStepsRepeater');
    if (!repeater) return;

    const steps = getTradeInSteps();
    try { repeater.accessibility.ariaLabel = 'Trade-in process steps'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      try { $item('#stepNumber').text = String(itemData.number); } catch (e) {}
      try { $item('#stepTitle').text = itemData.title; } catch (e) {}
      try { $item('#stepDesc').text = itemData.description; } catch (e) {}
    });
    repeater.data = steps.map((s, i) => ({ ...s, _id: `step-${i}` }));
  } catch (e) {}
}

// ── SEO Schema ──────────────────────────────────────────────────────

async function injectSchema() {
  try {
    const schema = await getBusinessSchema();
    if (schema) {
      $w('#sustainSchemaHtml').postMessage(schema);
    }
  } catch (e) {}
}
