/**
 * @module chatbotContext
 * @description Builds system prompt and product context for the anonymous pre-sale chatbot.
 *
 * Pure functions only — no Wix API calls. This keeps the module testable without mocks.
 */

/** Maximum number of products to include in the system prompt catalog summary. */
export const MAX_CATALOG_PRODUCTS = 15;

/** Maximum character length of each product entry in the catalog summary. */
const PRODUCT_LINE_MAX = 120;

/** Store facts injected into every system prompt. */
const STORE_FACTS = `Store: Carolina Futons — 824 Locust St, Hendersonville, NC 28792.
Phone: (828) 693-1935.
Hours: Mon–Fri 10am–6pm ET, Sat 10am–5pm ET, Sun closed.
Delivery: Western NC, Upstate SC, and parts of East TN (call for exact ZIP).
Returns: 30-day returns on unopened/unused items with receipt. Custom orders are final sale.
Financing: 0% APR options available — ask for details in store or on the website.`;

/**
 * Build the full system prompt for Claude, injecting optional catalog context.
 *
 * @param {string} [catalogSummary=''] - Formatted product list string from buildCatalogSummary().
 * @returns {string}
 */
export function buildSystemPrompt(catalogSummary = '') {
  const catalogSection = catalogSummary.trim()
    ? `\n\nCurrent product catalog (excerpt):\n${catalogSummary.trim()}`
    : '';

  return `You are the Carolina Futons pre-sale assistant — a friendly, knowledgeable helper \
for carolinafutons.com, a family-owned furniture store in Hendersonville, NC specializing in \
futons, murphy cabinet beds, platform beds, and mattresses.

You help visitors find the right furniture before they buy: answering questions about sizing, \
materials, delivery, pricing, and policies. You are warm, direct, and concise. You do not make up \
product details — if you are unsure, say so and invite the visitor to call or visit the store.

${STORE_FACTS}${catalogSection}

Behavior rules:
- Keep replies under 150 words unless the visitor explicitly asks for detail.
- When recommending a product, mention its name and one key feature.
- If the visitor's question cannot be answered from the information above, say so and offer the \
store phone number or a link to the contact form (/contact).
- Never invent prices, dimensions, or stock levels not listed above.
- Never collect or repeat personal information (name, address, payment details).`;
}

/**
 * Format a product array into a compact catalog summary string for the system prompt.
 * Each line: "Product Name — $price — short description" (truncated to PRODUCT_LINE_MAX chars).
 *
 * @param {Array<{name: string, price?: number, description?: string}>} products
 * @returns {string}
 */
export function buildCatalogSummary(products) {
  if (!Array.isArray(products) || products.length === 0) return '';
  return products
    .slice(0, MAX_CATALOG_PRODUCTS)
    .map(p => {
      const name = (p.name || 'Unknown').trim();
      const price = typeof p.price === 'number' && p.price > 0
        ? `$${p.price.toFixed(0)}`
        : null;
      const desc = typeof p.description === 'string'
        ? p.description.replace(/\s+/g, ' ').trim().slice(0, 80)
        : '';
      const line = [name, price, desc].filter(Boolean).join(' — ');
      return line.slice(0, PRODUCT_LINE_MAX);
    })
    .join('\n');
}

/**
 * Extract simple keyword tokens from a user message for product search.
 * Lowercases, strips punctuation, deduplicates, and filters stopwords.
 *
 * @param {string} message
 * @returns {string[]}  Array of unique lowercase keyword tokens (max 10).
 */
const STOPWORDS = new Set([
  'a','an','the','i','is','it','in','on','at','to','do','be','of','for',
  'and','or','but','my','me','we','you','he','she','they','what','how',
  'can','will','with','this','that','have','has','are','was','were',
  'not','no','so','if','your','our','their',
]);

export function extractProductKeywords(message) {
  if (typeof message !== 'string' || !message.trim()) return [];
  return [
    ...new Set(
      message
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !STOPWORDS.has(w))
    ),
  ].slice(0, 10);
}

/**
 * Score and return the most relevant products for a user message.
 * Each keyword match against the product name or description adds 1 point.
 * Returns up to `limit` products sorted by score descending.
 *
 * @param {Array<{name: string, description?: string, slug?: string, price?: number}>} products
 * @param {string} userMessage
 * @param {number} [limit=3]
 * @returns {Array<{name: string, slug?: string, price?: number}>}
 */
export function findSuggestedProducts(products, userMessage, limit = 3) {
  if (!Array.isArray(products) || products.length === 0) return [];
  const keywords = extractProductKeywords(userMessage);
  if (keywords.length === 0) return [];

  const scored = products.map(p => {
    const haystack = [p.name || '', p.description || ''].join(' ').toLowerCase();
    const score = keywords.reduce((acc, kw) => acc + (haystack.includes(kw) ? 1 : 0), 0);
    return { product: p, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({
      name: s.product.name,
      slug: s.product.slug ?? null,
      price: typeof s.product.price === 'number' ? s.product.price : null,
    }));
}
