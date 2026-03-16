/**
 * @module collectionCardBuilder
 * @description Builds editorial "Shop the Look" collection cards for web pages.
 * Ported from mobile CollectionCard.tsx and collections.ts — provides collection
 * data, card HTML builder, and repeater-compatible data formatting.
 *
 * Each card shows a hero image with mood tag pills, title, subtitle, and item count.
 * Designed for use in Wix repeaters and HtmlComponent injection.
 */
import { colors } from 'public/sharedTokens';

// ── Collection Data ─────────────────────────────────────────────────

/**
 * @typedef {Object} CollectionHeroImage
 * @property {string} uri - Image URL
 * @property {string} alt - Alt text for accessibility
 */

/**
 * @typedef {Object} EditorialCollection
 * @property {string} id - Unique identifier
 * @property {string} slug - URL-safe slug
 * @property {string} title - Collection title
 * @property {string} subtitle - Short description
 * @property {string} description - Full description
 * @property {CollectionHeroImage} heroImage - Hero image data
 * @property {string[]} mood - Mood tags (e.g. "cozy", "rustic", "warm")
 * @property {string} [season] - Seasonal relevance
 * @property {boolean} featured - Whether to show on homepage
 * @property {boolean} [earlyAccess] - CF+ members only
 * @property {string[]} productIds - Associated product IDs
 */

const COLLECTIONS = [
  {
    id: 'col-mountain-lodge',
    slug: 'mountain-lodge-living',
    title: 'Mountain Lodge Living',
    subtitle: 'Warm tones, solid wood, peak comfort',
    description: 'Inspired by the cozy lodges of the Blue Ridge, this collection pairs our bestselling hardwood futons with rich earth-toned covers and handcrafted accessories.',
    heroImage: { uri: 'https://placeholder.co/800x500/5C4033/F2E8D5?text=Mountain+Lodge+Living', alt: 'A cozy mountain lodge living room with a futon and warm lighting' },
    mood: ['cozy', 'rustic', 'warm'],
    season: 'fall',
    featured: true,
    productIds: ['prod-asheville-full', 'prod-mountain-cover-full', 'prod-premium-innerspring', 'prod-hardwood-frame', 'prod-arm-pillows', 'prod-furniture-polish'],
  },
  {
    id: 'col-modern-minimalist',
    slug: 'modern-minimalist',
    title: 'Modern Minimalist',
    subtitle: 'Clean lines, maximum function',
    description: 'Our Modern Minimalist collection highlights space-saving Murphy beds and sleek futon designs that disappear when not in use.',
    heroImage: { uri: 'https://placeholder.co/800x500/A8CCD8/3A2518?text=Modern+Minimalist', alt: 'A minimalist room with a Murphy bed and clean white walls' },
    mood: ['clean', 'modern', 'sleek'],
    featured: false,
    productIds: ['prod-murphy-queen-desk', 'prod-murphy-queen-vertical', 'prod-pisgah-twin', 'prod-memory-foam', 'prod-grip-strips'],
  },
  {
    id: 'col-studio-essentials',
    slug: 'studio-apartment-essentials',
    title: 'Studio Apartment Essentials',
    subtitle: 'Everything for small-space living',
    description: 'Studio living demands furniture that works double duty. This collection brings together our most compact, convertible pieces.',
    heroImage: { uri: 'https://placeholder.co/800x500/E8845C/FFFFFF?text=Studio+Essentials', alt: 'A bright studio apartment with convertible furniture' },
    mood: ['compact', 'versatile', 'bright'],
    featured: false,
    productIds: ['prod-pisgah-twin', 'prod-murphy-twin-cabinet', 'prod-sunset-cover-queen', 'prod-memory-foam', 'prod-arm-pillows', 'prod-grip-strips'],
  },
  {
    id: 'col-guest-room',
    slug: 'guest-room-ready',
    title: 'Guest Room Ready',
    subtitle: 'Impress every overnight visitor',
    description: 'Turn any spare room into a five-star guest suite with queen-size futons, Murphy beds, and premium mattresses.',
    heroImage: { uri: 'https://placeholder.co/800x500/C9A0A0/3A2518?text=Guest+Room+Ready', alt: 'An inviting guest room with a queen futon and decorative pillows' },
    mood: ['welcoming', 'luxe', 'comfortable'],
    season: 'all-year',
    featured: true,
    productIds: ['prod-blue-ridge-queen', 'prod-murphy-queen-bookcase', 'prod-premium-innerspring', 'prod-sunset-cover-queen', 'prod-arm-pillows'],
  },
  {
    id: 'col-reading-nook',
    slug: 'reading-nook-retreat',
    title: 'Reading Nook Retreat',
    subtitle: 'Your perfect cozy corner',
    description: 'Carve out a quiet corner for yourself with the Biltmore loveseat, cloud-soft pillows, and a warm cover.',
    heroImage: { uri: 'https://placeholder.co/800x500/E8D5B7/5C4033?text=Reading+Nook', alt: 'A cozy reading nook with a loveseat and soft throw pillows' },
    mood: ['cozy', 'intimate', 'quiet'],
    featured: false,
    productIds: ['prod-biltmore-loveseat', 'prod-mountain-cover-full', 'prod-arm-pillows', 'prod-furniture-polish'],
  },
  {
    id: 'col-spring-preview',
    slug: 'spring-2026-preview',
    title: 'Spring 2026 Preview',
    subtitle: 'First look — CF+ members only',
    description: 'Get an exclusive first look at our Spring 2026 line. New organic fabrics, refreshed colorways, and a brand-new daybed design.',
    heroImage: { uri: 'https://placeholder.co/800x500/B8D8BA/3A2518?text=Spring+2026+Preview', alt: 'A bright living room with new spring collection furniture' },
    mood: ['fresh', 'exclusive', 'seasonal'],
    season: 'spring',
    featured: true,
    earlyAccess: true,
    productIds: ['prod-asheville-full', 'prod-blue-ridge-queen', 'prod-sunset-cover-queen', 'prod-memory-foam'],
  },
];

// ── Style Tokens ────────────────────────────────────────────────────

const STYLES = {
  fontFamily: "'Avenir', 'Helvetica Neue', sans-serif",
  cardBorderRadius: '12px',
  moodBg: 'rgba(255,255,255,0.2)',
  moodColor: 'rgba(255,255,255,0.9)',
  overlayBg: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)',
  titleColor: '#FFFFFF',
  subtitleColor: 'rgba(255,255,255,0.85)',
  countColor: 'rgba(255,255,255,0.6)',
};

// ── Public API ──────────────────────────────────────────────────────

/**
 * Get all editorial collections.
 * @returns {EditorialCollection[]} Defensive copies
 */
export function getCollections() {
  return COLLECTIONS.map(c => ({
    ...c,
    heroImage: { ...c.heroImage },
    mood: [...c.mood],
    productIds: [...c.productIds],
  }));
}

/**
 * Get only featured collections (for homepage).
 * @returns {EditorialCollection[]}
 */
export function getFeaturedCollections() {
  return getCollections().filter(c => c.featured);
}

/**
 * Find a collection by slug.
 * @param {string} slug
 * @returns {EditorialCollection|null}
 */
export function getCollectionBySlug(slug) {
  if (typeof slug !== 'string' || slug.length === 0) return null;
  const found = COLLECTIONS.find(c => c.slug === slug);
  if (!found) return null;
  return {
    ...found,
    heroImage: { ...found.heroImage },
    mood: [...found.mood],
    productIds: [...found.productIds],
  };
}

/**
 * Validate a collection object has required fields.
 * @param {*} collection
 * @returns {boolean}
 */
export function isValidCollection(collection) {
  if (!collection || typeof collection !== 'object') return false;
  return (
    typeof collection.id === 'string' && collection.id.length > 0 &&
    typeof collection.slug === 'string' && collection.slug.length > 0 &&
    typeof collection.title === 'string' && collection.title.length > 0 &&
    collection.heroImage != null && typeof collection.heroImage === 'object' &&
    typeof collection.heroImage.uri === 'string' && collection.heroImage.uri.length > 0 &&
    Array.isArray(collection.mood) &&
    Array.isArray(collection.productIds)
  );
}

/**
 * Build HTML for a single collection card.
 * @param {EditorialCollection} collection
 * @param {Object} [options]
 * @param {'featured'|'compact'} [options.variant='featured']
 * @param {number} [options.height] - Card height in px (default: 220 featured, 140 compact)
 * @returns {string} HTML string or empty string if invalid
 */
export function buildCollectionCardHtml(collection, options = {}) {
  if (!isValidCollection(collection)) return '';

  const variant = options.variant === 'compact' ? 'compact' : 'featured';
  const height = Number(options.height) || (variant === 'compact' ? 140 : 220);

  const title = escapeHtml(collection.title);
  const subtitle = escapeHtml(collection.subtitle || '');
  const alt = escapeAttr(collection.heroImage.alt || collection.title);
  const uri = escapeAttr(collection.heroImage.uri);
  const itemCount = Array.isArray(collection.productIds) ? collection.productIds.length : 0;
  const slug = encodeURIComponent(collection.slug || '');

  const moodTags = (collection.mood || []).slice(0, 3).map(tag =>
    `<span style="display:inline-block;padding:2px 8px;background:${STYLES.moodBg};border-radius:99px;color:${STYLES.moodColor};font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(tag)}</span>`
  ).join('\n      ');

  const subtitleBlock = variant === 'featured'
    ? `<div style="color:${STYLES.subtitleColor};font-size:14px;margin-top:4px;line-height:1.4;">${subtitle}</div>`
    : '';

  const earlyAccessBadge = collection.earlyAccess
    ? `<span style="display:inline-block;padding:2px 8px;background:${colors.sunsetCoral};border-radius:99px;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;margin-left:6px;">CF+ Early Access</span>`
    : '';

  return `<a href="/collections/${slug}" style="display:block;position:relative;height:${height}px;border-radius:${STYLES.cardBorderRadius};overflow:hidden;text-decoration:none;font-family:${STYLES.fontFamily};" aria-label="${escapeAttr(collection.title)}: ${escapeAttr(collection.subtitle || '')}">
  <img src="${uri}" alt="${alt}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" loading="lazy" />
  <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:${STYLES.overlayBg};display:flex;flex-direction:column;justify-content:flex-end;padding:16px;">
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
      ${moodTags}
      ${earlyAccessBadge}
    </div>
    <div style="font-size:${variant === 'compact' ? '16px' : '22px'};font-weight:700;color:${STYLES.titleColor};line-height:1.3;">${title}</div>
    ${subtitleBlock}
    <div style="color:${STYLES.countColor};font-size:12px;margin-top:4px;">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
  </div>
</a>`;
}

/**
 * Build HTML for a grid of collection cards.
 * @param {EditorialCollection[]} [collections] - Defaults to featured collections
 * @param {Object} [options]
 * @param {'featured'|'compact'} [options.variant='featured']
 * @param {number} [options.columns=2] - Grid columns
 * @returns {string} Grid HTML
 */
export function buildCollectionGridHtml(collections, options = {}) {
  if (Array.isArray(collections) && collections.length === 0) return '';
  const items = Array.isArray(collections) && collections.length > 0
    ? collections
    : COLLECTIONS.filter(c => c.featured);
  const valid = items.filter(isValidCollection);
  if (valid.length === 0) return '';

  const rawCols = options.columns != null ? Number(options.columns) : 2;
  const cols = Math.max(1, Math.min(4, Number.isFinite(rawCols) ? rawCols : 2));
  const variant = options.variant || 'featured';

  const cards = valid.map(c => buildCollectionCardHtml(c, { variant })).join('\n  ');

  return `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:16px;font-family:${STYLES.fontFamily};" role="list" aria-label="Editorial collections">
  ${cards}
</div>`;
}

// ── Internal Helpers ────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
