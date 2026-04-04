/**
 * @module buyingGuideOgCards
 * @description Auto-generates Open Graph social card specs and SVG markup for
 * all 8 buying guides. Each card is derived entirely from the guide's static
 * data — title, category, meta description, publication date — so cards are
 * always in sync with guide content.
 *
 * The SVG output (1200×630) is designed for server-side rendering to JPEG by
 * a CDN edge function or build script, producing the
 * /og-images/buying-guides/<slug>-social.jpg assets that all 8 guides
 * reference as their ogImage URL.
 *
 * @requires wix-web-module
 *
 * @setup
 * No CMS collections required — all data is derived from the GUIDES constant
 * in buyingGuides.web.js via getBuyingGuide / getBuyingGuideSlugs web methods.
 *
 * cf-jdgq
 */
import { Permissions, webMethod } from 'wix-web-module';
import { getBuyingGuide, getBuyingGuideSlugs } from 'backend/buyingGuides.web';

// ── Design constants ──────────────────────────────────────────────────��───────

export const OG_WIDTH  = 1200;
export const OG_HEIGHT = 630;

const BG_COLOR     = '#1E3A5F';   // espresso navy (brand primary)
const BRAND_COLOR  = '#5B8FA8';   // mountainBlue
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_MUTED   = '#A8CCD8';   // mountainBlueLight
const TITLE_WRAP   = 38;          // max characters per title line

/**
 * Per-category accent color for the sidebar stripe, category badge,
 * and divider line on each card.
 */
export const CATEGORY_COLORS = {
  'futon-frames':  '#5B8FA8',  // mountainBlue
  'mattresses':    '#7A9E7E',  // sage
  'covers':        '#8F7AB8',  // soft violet
  'pillows':       '#B87878',  // muted coral
  'storage':       '#7A8FA8',  // steel blue
  'outdoor':       '#5B9E78',  // forest green
  'accessories':   '#A8965B',  // warm gold
  'bundle-deals':  '#C8960C',  // badgeGold
};

// ── Pure helpers ───────────────────────────────────────────────────���──────────

/**
 * Split a title string into lines no longer than maxLen characters,
 * breaking only at word boundaries.
 *
 * @param {string} title
 * @param {number} [maxLen=38] - Max characters per line
 * @returns {string[]} Array of line strings (at least one element)
 */
export function wrapTitle(title, maxLen = TITLE_WRAP) {
  if (!title) return [''];
  const words = String(title).split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLen) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/**
 * Escape characters that are special in XML/SVG text content.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Truncate a description to at most maxLen characters, breaking at the
 * last word boundary and appending an ellipsis.
 *
 * @param {string} desc
 * @param {number} [maxLen=90]
 * @returns {string}
 */
export function truncateDescription(desc, maxLen = 90) {
  if (!desc) return '';
  if (desc.length <= maxLen) return desc;
  const cut = desc.lastIndexOf(' ', maxLen);
  return (cut > 0 ? desc.slice(0, cut) : desc.slice(0, maxLen)) + '\u2026';
}

/**
 * Format a YYYY-MM-DD publish date for card footer display.
 * '2026-02-20' → 'Feb 2026'
 *
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted month-year, or empty string for invalid input
 */
export function formatPublishDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Compute reading time in minutes from a guide's sections array.
 * Uses 200 words per minute; minimum 1 minute when content exists.
 *
 * @param {{ sections?: Array<{heading?: string, body?: string}> }} guide
 * @returns {number}
 */
export function computeReadingTime(guide) {
  let wordCount = 0;
  if (guide && Array.isArray(guide.sections)) {
    for (const s of guide.sections) {
      if (s.body)    wordCount += s.body.trim().split(/\s+/).filter(Boolean).length;
      if (s.heading) wordCount += s.heading.trim().split(/\s+/).filter(Boolean).length;
    }
  }
  return wordCount > 0 ? Math.max(1, Math.round(wordCount / 200)) : 0;
}

// ── generateOgCardSvg ───────────────────────���─────────────────────────────────

/**
 * Generate an SVG string for a buying guide Open Graph card (1200×630).
 *
 * Layout:
 *  - Dark navy background
 *  - 10px accent-color stripe on left edge
 *  - "BUYING GUIDE" label top-left
 *  - Category name in rounded badge
 *  - Guide title (up to 2 wrapped lines at 52px bold)
 *  - Truncated meta description
 *  - Thin divider line
 *  - Footer: "Carolina Futons" brand name + reading time + publication date
 *
 * All user-supplied strings are XML-escaped before insertion.
 *
 * @param {Object|null} spec - OG card spec from getOgCardSpec
 * @returns {string} SVG markup string, or '' when spec is null/undefined
 */
export function generateOgCardSvg(spec) {
  if (!spec) return '';

  const bg     = spec.bgColor     || BG_COLOR;
  const accent = spec.accentColor || BRAND_COLOR;
  const title  = spec.title       || '';
  const cat    = spec.categoryLabel || '';
  const desc   = truncateDescription(spec.metaDescription);
  const rt     = spec.readingTime ?? 0;
  const date   = formatPublishDate(spec.publishDate);
  const footer = rt > 0
    ? `${rt} min read${date ? ' \u00b7 ' + date : ''}`
    : (date || '');

  const titleLines = wrapTitle(title);
  const line1 = escapeXml(titleLines[0] || '');
  const line2 = titleLines[1] ? escapeXml(titleLines[1]) : null;

  // Vertical positioning adapts to 1 vs 2 title lines
  const titleY1 = line2 ? 235 : 280;
  const titleY2 = titleY1 + 72;
  const descY   = line2 ? 405 : 370;

  // Category badge width: ~10px per char + 36px padding (minimum 100px)
  const badgeW  = Math.max(100, cat.length * 10 + 36);
  const badgeCx = 50 + badgeW / 2;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">`,
    `  <!-- background -->`,
    `  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${bg}"/>`,
    `  <!-- accent stripe -->`,
    `  <rect x="0" y="0" width="10" height="${OG_HEIGHT}" fill="${accent}"/>`,
    `  <!-- "BUYING GUIDE" label -->`,
    `  <text x="50" y="64" font-family="Georgia, serif" font-size="16" fill="${TEXT_MUTED}" letter-spacing="4">BUYING GUIDE</text>`,
    `  <!-- category badge -->`,
    `  <rect x="50" y="82" width="${badgeW}" height="36" rx="18" fill="${accent}" opacity="0.9"/>`,
    `  <text x="${badgeCx}" y="105" font-family="Georgia, serif" font-size="15" fill="${TEXT_PRIMARY}" text-anchor="middle">${escapeXml(cat)}</text>`,
    `  <!-- title line 1 -->`,
    `  <text x="50" y="${titleY1}" font-family="Georgia, serif" font-size="52" font-weight="700" fill="${TEXT_PRIMARY}">${line1}</text>`,
  ];

  if (line2) {
    parts.push(
      `  <!-- title line 2 -->`,
      `  <text x="50" y="${titleY2}" font-family="Georgia, serif" font-size="52" font-weight="700" fill="${TEXT_PRIMARY}">${line2}</text>`,
    );
  } else {
    parts.push(`  <!-- title fits on one line -->`);
  }

  parts.push(
    `  <!-- description -->`,
    `  <text x="50" y="${descY}" font-family="Georgia, serif" font-size="22" fill="${TEXT_MUTED}">${escapeXml(desc)}</text>`,
    `  <!-- divider -->`,
    `  <line x1="50" y1="548" x2="${OG_WIDTH - 50}" y2="548" stroke="${accent}" stroke-width="1" opacity="0.5"/>`,
    `  <!-- footer brand -->`,
    `  <text x="50" y="592" font-family="Georgia, serif" font-size="20" font-weight="700" fill="${BRAND_COLOR}">Carolina Futons</text>`,
  );

  if (footer) {
    parts.push(
      `  <!-- footer meta -->`,
      `  <text x="${OG_WIDTH - 50}" y="592" font-family="Georgia, serif" font-size="18" fill="${TEXT_MUTED}" text-anchor="end">${escapeXml(footer)}</text>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join('\n');
}

// ── getOgCardSpec ────────────────────────────────────��────────────────────────

/**
 * Return the full spec object needed to render an OG social card for the
 * given buying guide slug.
 *
 * @param {string} slug - Buying guide slug (e.g. 'futon-frames')
 * @returns {Promise<{success: boolean, spec?: Object, error?: string}>}
 *   spec fields: slug, title, categoryLabel, metaDescription, ogImageUrl,
 *                bgColor, accentColor, publishDate, readingTime, width, height
 * @permission Permissions.Anyone
 */
export const getOgCardSpec = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const guideResult = await getBuyingGuide(slug);
      if (!guideResult.success) {
        return { success: false, error: guideResult.error || 'Guide not found.' };
      }
      if (guideResult.guide?.comingSoon) {
        return { success: false, error: `No OG card available for coming-soon guide: ${slug}.` };
      }

      const guide       = guideResult.guide;
      const readingTime = computeReadingTime(guide);
      const accentColor = CATEGORY_COLORS[guide.slug] || BRAND_COLOR;

      return {
        success: true,
        spec: {
          slug:            guide.slug,
          title:           guide.title,
          categoryLabel:   guide.categoryLabel,
          metaDescription: guide.metaDescription,
          ogImageUrl:      guide.ogImage,
          bgColor:         BG_COLOR,
          accentColor,
          publishDate:     guide.publishDate,
          readingTime,
          width:           OG_WIDTH,
          height:          OG_HEIGHT,
        },
      };
    } catch (err) {
      console.error('[buyingGuideOgCards] getOgCardSpec error:', err);
      return { success: false, error: 'Failed to generate OG card spec.' };
    }
  }
);

// ── getAllOgCardSpecs ─────────────────────────────────────────────────────────

/**
 * Return specs for all 8 buying guides in one call.
 * Designed for build-time batch generation of all social card images.
 * Guides that fail to load (e.g. coming-soon stubs) are silently omitted.
 *
 * @returns {Promise<{success: boolean, specs?: Object[], error?: string}>}
 * @permission Permissions.Anyone
 */
export const getAllOgCardSpecs = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const { success, slugs } = await getBuyingGuideSlugs();
      if (!success) return { success: false, error: 'Could not load guide slugs.' };

      const results = await Promise.all(
        slugs.map(slug => getOgCardSpec(slug).catch(() => null))
      );

      const specs = results
        .filter(r => r && r.success)
        .map(r => r.spec);

      return { success: true, specs };
    } catch (err) {
      console.error('[buyingGuideOgCards] getAllOgCardSpecs error:', err);
      return { success: false, error: 'Failed to generate OG card specs.' };
    }
  }
);
