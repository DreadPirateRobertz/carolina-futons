/** @module faqHelpers - Testable helpers for the FAQ page.
 *
 * Contains the complete FAQ dataset organized by category (products, shipping,
 * returns, financing, showroom), plus pure functions for category filtering,
 * case-insensitive search, and FAQ schema data generation for SEO structured data.
 *
 * FAQ content is hardcoded here rather than fetched from CMS because it rarely
 * changes and this avoids a network round-trip on page load.
 */

const CATEGORIES = [
  { id: 'products', label: 'Products', description: 'Questions about futons, mattresses, frames, and Murphy beds' },
  { id: 'shipping', label: 'Shipping & Delivery', description: 'Shipping rates, delivery options, and timelines' },
  { id: 'returns', label: 'Returns & Warranty', description: 'Return policy, exchanges, and warranty coverage' },
  { id: 'financing', label: 'Financing', description: 'Payment plans, financing options, and pricing' },
  { id: 'showroom', label: 'Showroom', description: 'Visiting our Hendersonville showroom and hours' },
];

const FAQ_DATA = [
  // ── Products ────────────────────────────────────────────────────────
  {
    _id: 'p1',
    category: 'products',
    question: 'What is a futon?',
    answer: 'A futon is actually comprised of three separate components: a frame, a futon mattress, and a removable cover. Together they create a versatile piece of furniture that converts from a sofa to a bed.',
  },
  {
    _id: 'p2',
    category: 'products',
    question: 'What is the difference between a front-loading futon and a wall hugger?',
    answer: 'Front-loading futons (like Night & Day\'s MoonGlider) fold down from the front, requiring space behind to open into a bed. Wall Hugger futons by Strata Furniture use a patented mechanism that allows conversion without pulling the frame away from the wall — the deck slides forward and down while the back stays in place.',
  },
  {
    _id: 'p3',
    category: 'products',
    question: 'What are the advantages of Otis Bed futon mattresses?',
    answer: 'Otis Bed mattresses are hypoallergenic, cottonless, and made with high-density foam (1.8+ lb/cu ft). Unlike cotton futons, they don\'t require regular turning, won\'t develop a permanent crease, and are significantly lighter. They\'re also CertiPUR-US certified and last 10-15 years.',
  },
  {
    _id: 'p4',
    category: 'products',
    question: 'What sizes do your futons come in?',
    answer: 'Most of our futon frames and mattresses are available in Full and Queen sizes. Some models may also be available in Twin. Check individual product pages for specific size availability.',
  },
  {
    _id: 'p5',
    category: 'products',
    question: 'How does a Murphy Cabinet Bed work?',
    answer: 'Unlike traditional Murphy beds that mount to the wall, our Night & Day Murphy Cabinet Beds are freestanding furniture pieces. The bed folds out of a cabinet in under two minutes — no wall installation required. When closed, it looks like an attractive cabinet.',
  },
  {
    _id: 'p6',
    category: 'products',
    question: 'Are KD Frames really made in the USA?',
    answer: 'Yes! KD Frames are manufactured in Athens, Georgia using kiln-dried Tulip Poplar harvested from responsibly managed forests in Virginia. No chemicals are applied in their factory, and the wood is smooth and unfinished so you can stain or paint it to match your decor.',
  },
  {
    _id: 'p7',
    category: 'products',
    question: 'Do your futon mattresses work with memory foam?',
    answer: 'Our KD Frames platform beds feature 2.8-inch slat spacing specifically designed to properly support Memory Foam and Latex mattresses, keeping body weight evenly distributed. Otis Bed\'s Pulsar model is their dedicated memory foam futon mattress option.',
  },
  // ── Shipping & Delivery ─────────────────────────────────────────────
  {
    _id: 's1',
    category: 'shipping',
    question: 'What is your shipping policy?',
    answer: 'We offer shipping across the United States. Orders over $999 qualify for free shipping. For specific shipping information, delivery timelines, and regional details, please visit our Shipping Policy page or contact us directly.',
  },
  {
    _id: 's2',
    category: 'shipping',
    question: 'Do you offer white-glove delivery?',
    answer: 'Yes! We offer white-glove delivery and setup. Local delivery within the Hendersonville area is $149, regional delivery is $249, and orders over $1,999 qualify for free white-glove delivery. Our team handles all setup and packaging removal.',
  },
  {
    _id: 's3',
    category: 'shipping',
    question: 'How long does delivery take?',
    answer: 'In-stock items typically ship within 3-5 business days. Local white-glove delivery is scheduled Wednesday through Saturday. For specific timelines or to check availability, contact us or visit the Shipping Policy page.',
  },
  // ── Returns & Warranty ──────────────────────────────────────────────
  {
    _id: 'r1',
    category: 'returns',
    question: 'What is your return policy?',
    answer: 'We want you to love your purchase. If you\'re not satisfied, contact us within 30 days of delivery. Items must be in original condition. Custom-order covers and mattresses that have been used are not eligible for return. See our full Refund Policy page for details.',
  },
  {
    _id: 'r2',
    category: 'returns',
    question: 'Do your products come with a warranty?',
    answer: 'Yes! Most of our frames carry a manufacturer warranty. Night & Day Furniture offers a 10-year limited warranty on frames. Otis Bed mattresses carry a 10-year warranty. KD Frames are backed by a lifetime warranty against manufacturing defects. Warranty details vary by brand — ask us for specifics.',
  },
  {
    _id: 'r3',
    category: 'returns',
    question: 'What if my order arrives damaged?',
    answer: 'Contact us immediately if your order arrives damaged. Take photos of the damage and packaging. We\'ll arrange a replacement or refund at no additional cost. For white-glove deliveries, our team inspects items before setup.',
  },
  // ── Financing ───────────────────────────────────────────────────────
  {
    _id: 'f1',
    category: 'financing',
    question: 'Do you offer financing or payment plans?',
    answer: 'Yes! We offer financing through our in-store and online financing partners. Qualified buyers can spread payments over 6, 12, or 18 months. Visit our showroom or contact us to learn about current financing offers.',
  },
  {
    _id: 'f2',
    category: 'financing',
    question: 'Do you accept gift cards or promotional codes?',
    answer: 'Yes! We offer Carolina Futons gift cards in any denomination. Promotional codes can be applied at checkout. Gift cards never expire and can be used on any product, including custom orders.',
  },
  // ── Showroom ────────────────────────────────────────────────────────
  {
    _id: 'v1',
    category: 'showroom',
    question: 'Can I visit your showroom?',
    answer: 'We\'d love to see you! Visit us at 824 Locust St, Suite 200, Hendersonville, NC 28792. We\'re open Wednesday through Saturday, 10 AM to 5 PM. Come see over 700 fabric swatches, try out our frames, and feel the difference of an Otis mattress in person.',
  },
  {
    _id: 'v2',
    category: 'showroom',
    question: 'Do you offer fabric swatches?',
    answer: 'Yes! We have over 700 swatches of premium fabric lines available in our showroom for choosing a custom futon cover. Visit us in person to browse the full selection.',
  },
  {
    _id: 'v3',
    category: 'showroom',
    question: 'Can I book a showroom appointment?',
    answer: 'Appointments are welcome but not required. Walk-ins are always greeted warmly. If you\'d like dedicated time with our team, book an appointment through our Contact page or call (828) 252-9449. We offer general tours, sleep consultations, and design consultations.',
  },
];

/**
 * Returns the list of FAQ categories.
 * @returns {Array<{id: string, label: string, description: string}>}
 */
export function getFaqCategories() {
  return CATEGORIES;
}

/**
 * Returns all FAQ items with category assignments.
 * @returns {Array<{_id: string, question: string, answer: string, category: string}>}
 */
export function getFaqData() {
  return FAQ_DATA;
}

/**
 * Filters FAQs by category. Returns all if category is falsy.
 * @param {Array} faqs
 * @param {string|null|undefined} categoryId
 * @returns {Array}
 */
export function filterFaqsByCategory(faqs, categoryId) {
  if (!faqs || !Array.isArray(faqs)) return [];
  if (!categoryId) return faqs;
  return faqs.filter(f => f.category === categoryId);
}

/**
 * Searches FAQs by query against question and answer text. Case-insensitive.
 * Returns all if query is falsy or whitespace-only.
 * @param {Array} faqs
 * @param {string|null|undefined} query
 * @returns {Array}
 */
export function searchFaqs(faqs, query) {
  if (!faqs || !Array.isArray(faqs)) return [];
  const q = (query || '').trim().toLowerCase();
  if (!q) return faqs;
  return faqs.filter(
    f => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
  );
}

/**
 * Builds FAQ schema data (question/answer pairs) for SEO structured data.
 * Strips internal fields (_id, category).
 * @param {Array} faqs
 * @returns {Array<{question: string, answer: string}>}
 */
export function buildFaqSchemaData(faqs) {
  if (!faqs || !Array.isArray(faqs)) return [];
  return faqs.map(f => ({ question: f.question, answer: f.answer }));
}
