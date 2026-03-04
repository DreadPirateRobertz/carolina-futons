/**
 * @module sustainabilityHelpers
 * @description Frontend helpers for the Sustainability showcase page.
 * Static content, formatting, and display utilities for eco-friendly
 * materials, certifications, carbon offset, and trade-in program.
 */

// Credit ranges matching backend sustainability.web.js
const CREDIT_RANGES = {
  excellent: { min: 100, max: 200 },
  good: { min: 75, max: 150 },
  fair: { min: 50, max: 100 },
  poor: { min: 25, max: 50 },
};

/**
 * Get static content for sustainability page sections.
 * @returns {{ hero: Object, materials: Object, certifications: Object, tradeIn: Object }}
 */
export function getSustainabilityPageContent() {
  return {
    hero: {
      heading: 'Furniture That Cares for the Planet',
      subheading: 'Our Sustainability Promise',
      intro: 'At Carolina Futons, sustainability isn\'t a buzzword — it\'s how we build. From responsibly sourced wood to eco-friendly finishes, every piece is crafted to last decades, not seasons.',
    },
    materials: {
      heading: 'Responsibly Sourced Materials',
      description: 'We partner with suppliers who share our commitment to the environment, choosing materials that are renewable, durable, and low-impact.',
    },
    certifications: {
      heading: 'Certifications & Standards',
      description: 'Our products meet rigorous third-party environmental and safety standards.',
    },
    tradeIn: {
      heading: 'Trade-In Program',
      description: 'Give your old futon a second life. Trade in your used furniture for store credit toward a new piece — we\'ll handle the pickup and responsible recycling.',
    },
  };
}

/**
 * Get material sourcing highlights for display.
 * @returns {Array<{ title: string, description: string, icon: string }>}
 */
export function getMaterialHighlights() {
  return [
    {
      title: 'Sustainably Sourced Wood',
      description: 'Our frames use plantation-grown rubberwood and responsibly harvested hardwoods — never old-growth timber.',
      icon: 'tree',
    },
    {
      title: 'Eco-Friendly Finishes',
      description: 'Water-based stains and low-VOC finishes protect indoor air quality and reduce environmental impact.',
      icon: 'droplet',
    },
    {
      title: 'Natural Fabrics',
      description: 'Organic cotton, linen, and recycled polyester covers that are better for you and the planet.',
      icon: 'fabric',
    },
    {
      title: 'Durable by Design',
      description: 'Built to last 15–20 years of daily use, reducing waste from disposable furniture.',
      icon: 'shield',
    },
  ];
}

/**
 * Get certifications list for display.
 * @returns {Array<{ name: string, description: string, icon: string }>}
 */
export function getCertificationsList() {
  return [
    {
      name: 'FSC Certified',
      description: 'Forest Stewardship Council certification ensures wood comes from responsibly managed forests.',
      icon: 'certificate',
    },
    {
      name: 'GREENGUARD Gold',
      description: 'Meets strict chemical emissions limits for healthier indoor air quality.',
      icon: 'shield-check',
    },
    {
      name: 'CertiPUR-US',
      description: 'Foam meets rigorous standards for content, emissions, and durability — no harmful chemicals.',
      icon: 'check-circle',
    },
  ];
}

/**
 * Get badge definitions for sustainability showcase.
 * Mirrors backend BADGE_DEFS from sustainability.web.js.
 * @returns {Array<{ slug: string, label: string, icon: string, description: string }>}
 */
export function getBadgeDefinitions() {
  return [
    { slug: 'eco-material', label: 'Eco-Friendly Materials', icon: 'leaf', description: 'Made from sustainably sourced materials' },
    { slug: 'long-lasting', label: 'Built to Last', icon: 'shield', description: 'Designed for 15+ years of daily use' },
    { slug: 'recyclable', label: 'Recyclable', icon: 'recycle', description: 'Materials can be recycled at end of life' },
    { slug: 'low-carbon', label: 'Low Carbon', icon: 'globe', description: 'Below-average carbon footprint for its category' },
    { slug: 'certified', label: 'Certified Sustainable', icon: 'badge', description: 'Third-party sustainability certification' },
    { slug: 'trade-in-eligible', label: 'Trade-In Eligible', icon: 'refresh', description: 'Eligible for our trade-in credit program' },
  ];
}

/**
 * Get trade-in condition options for the form dropdown.
 * @returns {Array<{ value: string, label: string, creditRange: { min: number, max: number } }>}
 */
export function getConditionOptions() {
  return [
    { value: 'excellent', label: 'Excellent — Like new, minimal wear', creditRange: CREDIT_RANGES.excellent },
    { value: 'good', label: 'Good — Normal wear, fully functional', creditRange: CREDIT_RANGES.good },
    { value: 'fair', label: 'Fair — Visible wear, still usable', creditRange: CREDIT_RANGES.fair },
    { value: 'poor', label: 'Poor — Heavy wear, needs repair', creditRange: CREDIT_RANGES.poor },
  ];
}

/**
 * Format carbon offset data for human-readable display.
 * @param {Object|null} data - Carbon offset data from calculateCarbonOffset.
 * @returns {{ carbonText: string, costText: string, treesText: string }|null}
 */
export function formatCarbonData(data) {
  if (!data) return null;

  return {
    carbonText: `${data.totalCarbonKg} kg CO₂`,
    costText: `$${data.offsetCost.toFixed(2)}`,
    treesText: `${data.treesEquivalent} trees per year`,
  };
}

/**
 * Format trade-in request status to human-readable label.
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function formatTradeInStatus(status) {
  if (!status) return '';

  const labels = {
    submitted: 'Submitted — Pending Review',
    reviewing: 'Under Review',
    approved: 'Approved — Ready to Ship',
    shipped: 'Shipped — In Transit',
    received: 'Received — Being Inspected',
    credited: 'Credit Issued to Your Account',
    rejected: 'Not Eligible for Trade-In',
  };

  return labels[status] || status;
}

/**
 * Get the trade-in process steps for display.
 * @returns {Array<{ number: number, title: string, description: string }>}
 */
export function getTradeInSteps() {
  return [
    { number: 1, title: 'Submit Your Item', description: 'Tell us about your furniture — type, condition, and photos. We\'ll give you an instant credit estimate.' },
    { number: 2, title: 'We Pick It Up', description: 'Once approved, we\'ll schedule a free pickup from your home at a time that works for you.' },
    { number: 3, title: 'Get Store Credit', description: 'Your credit is applied to your account within 48 hours of receiving your item. Use it on anything in store.' },
  ];
}

/**
 * Estimate credit range for a given condition.
 * @param {string|null} condition - 'excellent'|'good'|'fair'|'poor'
 * @returns {{ min: number, max: number, estimated: number }|null}
 */
export function estimateCreditRange(condition) {
  if (!condition || !CREDIT_RANGES[condition]) return null;

  const range = CREDIT_RANGES[condition];
  return {
    min: range.min,
    max: range.max,
    estimated: Math.round((range.min + range.max) / 2),
  };
}
