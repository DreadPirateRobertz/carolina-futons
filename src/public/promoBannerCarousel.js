/**
 * @module promoBannerCarousel
 * @description Rotating promotional banner carousel for the homepage.
 * Ported from mobile PromoBannerCarousel.tsx — provides promo data,
 * HTML builder for HtmlComponent injection, and auto-rotation logic.
 *
 * Each banner has a title, subtitle, CTA, accent color, and emoji icon.
 * Auto-rotates every 5 seconds; pauses when user interacts.
 */
import { colors } from 'public/sharedTokens';

// ── Promo Item Registry ─────────────────────────────────────────────

/**
 * @typedef {Object} PromoBannerItem
 * @property {string} id - Unique identifier
 * @property {string} title - Banner headline
 * @property {string} subtitle - Supporting text
 * @property {string} ctaText - Call-to-action button label
 * @property {string} ctaHref - CTA link target (web URL path)
 * @property {string} emoji - Decorative emoji icon
 * @property {string} accentColor - Hex color for icon bg and CTA
 */

const DEFAULT_PROMOS = [
  {
    id: 'promo-free-shipping',
    title: 'Free Shipping',
    subtitle: 'On all orders over $299 — no code needed',
    ctaText: 'Shop Now',
    ctaHref: '/shop-main',
    emoji: '\u{1F69A}',
    accentColor: colors.mountainBlue,
  },
  {
    id: 'promo-cf-plus',
    title: 'Try CF+ Free',
    subtitle: '30-day trial — room planning tools, free shipping & more',
    ctaText: 'Start Trial',
    ctaHref: '/membership',
    emoji: '\u{2728}',
    accentColor: colors.sunsetCoral,
  },
  {
    id: 'promo-new-collection',
    title: 'Spring Collection',
    subtitle: 'Handcrafted pieces inspired by the Blue Ridge',
    ctaText: 'Explore',
    ctaHref: '/collections/spring-2026',
    emoji: '\u{1F33F}',
    accentColor: '#6B8E5A',
  },
];

const AUTO_ROTATE_MS = 5000;

// ── Style Tokens ────────────────────────────────────────────────────

const STYLES = {
  fontFamily: "'Avenir', 'Helvetica Neue', sans-serif",
  containerBg: colors.offWhite || '#FAF7F2',
  titleColor: colors.espresso || '#3A2518',
  subtitleColor: '#5C4033',
  ctaTextColor: '#FFFFFF',
  dotInactive: '#C4B5A6',
  dotActive: colors.sunsetCoral,
  borderRadius: '8px',
};

// ── Public API ──────────────────────────────────────────────────────

/**
 * Get the default promo banner items.
 * @returns {PromoBannerItem[]} Defensive copy of default promos
 */
export function getDefaultPromos() {
  return DEFAULT_PROMOS.map(p => ({ ...p }));
}

/**
 * Validate a promo banner item has all required fields.
 * @param {*} item
 * @returns {boolean}
 */
export function isValidPromoItem(item) {
  if (!item || typeof item !== 'object') return false;
  return (
    typeof item.id === 'string' && item.id.length > 0 &&
    typeof item.title === 'string' && item.title.length > 0 &&
    typeof item.ctaText === 'string' && item.ctaText.length > 0 &&
    typeof item.ctaHref === 'string' && item.ctaHref.length > 0
  );
}

/**
 * Build complete HTML for a single promo banner card.
 * @param {PromoBannerItem} item
 * @returns {string} HTML string
 */
export function buildPromoBannerHtml(item) {
  if (!isValidPromoItem(item)) return '';

  const accent = escapeAttr(item.accentColor || colors.mountainBlue);
  const emoji = escapeHtml(item.emoji || '');
  const title = escapeHtml(item.title);
  const subtitle = escapeHtml(item.subtitle || '');
  const ctaText = escapeHtml(item.ctaText);
  const ctaHref = escapeAttr(item.ctaHref);

  return `<div style="display:flex;align-items:center;gap:12px;padding:16px;background:${STYLES.containerBg};border-radius:${STYLES.borderRadius};font-family:${STYLES.fontFamily};" role="region" aria-label="${escapeAttr(item.title)}">
  <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:${accent};border-radius:10px;flex-shrink:0;" aria-hidden="true">
    <span style="font-size:22px;">${emoji}</span>
  </div>
  <div style="flex:1;min-width:0;">
    <div style="font-size:16px;font-weight:700;color:${STYLES.titleColor};margin-bottom:2px;">${title}</div>
    <div style="font-size:12px;color:${STYLES.subtitleColor};line-height:1.4;">${subtitle}</div>
  </div>
  <a href="${ctaHref}" style="display:inline-block;padding:6px 12px;background:${accent};color:${STYLES.ctaTextColor};border-radius:6px;text-decoration:none;font-size:12px;font-weight:700;white-space:nowrap;" aria-label="${escapeAttr(item.ctaText)}">${ctaText}</a>
</div>`;
}

/**
 * Build HTML for a complete carousel with all banners and dot indicators.
 * Only the active banner is visible; includes inline JS for auto-rotation.
 * @param {PromoBannerItem[]} [items] - Defaults to DEFAULT_PROMOS
 * @param {Object} [options]
 * @param {number} [options.rotateMs=5000] - Auto-rotate interval in ms
 * @returns {string} Full carousel HTML with embedded script
 */
export function buildCarouselHtml(items, options = {}) {
  if (Array.isArray(items) && items.length === 0) return '';
  const promos = Array.isArray(items) && items.length > 0 ? items : DEFAULT_PROMOS;
  const validPromos = promos.filter(isValidPromoItem);
  if (validPromos.length === 0) return '';

  const rotateMs = Math.max(1000, Number(options.rotateMs) || AUTO_ROTATE_MS);

  const bannerSlides = validPromos.map((item, i) => {
    const display = i === 0 ? 'flex' : 'none';
    return `<div class="promo-slide" data-index="${i}" style="display:${display};width:100%;">${buildPromoBannerHtml(item)}</div>`;
  }).join('\n  ');

  const dots = validPromos.length > 1
    ? validPromos.map((_, i) => {
      const bg = i === 0 ? STYLES.dotActive : STYLES.dotInactive;
      const w = i === 0 ? '20px' : '8px';
      return `<span class="promo-dot" data-index="${i}" style="display:inline-block;height:8px;width:${w};border-radius:99px;background:${bg};opacity:0.8;transition:width 0.3s,background 0.3s;cursor:pointer;"></span>`;
    }).join('\n    ')
    : '';

  const dotsSection = dots
    ? `<div style="display:flex;justify-content:center;align-items:center;gap:6px;margin-top:12px;">\n    ${dots}\n  </div>`
    : '';

  const script = validPromos.length > 1
    ? `<script>
(function(){
  var slides=document.querySelectorAll('.promo-slide');
  var dots=document.querySelectorAll('.promo-dot');
  var active=0,total=slides.length,paused=false,timer;
  var ACTIVE_COLOR='${STYLES.dotActive}',INACTIVE_COLOR='${STYLES.dotInactive}';
  function show(idx){
    for(var i=0;i<total;i++){
      slides[i].style.display=i===idx?'flex':'none';
      if(dots[i]){dots[i].style.background=i===idx?ACTIVE_COLOR:INACTIVE_COLOR;dots[i].style.width=i===idx?'20px':'8px';}
    }
    active=idx;
  }
  function next(){if(!paused)show((active+1)%total);}
  timer=setInterval(next,${rotateMs});
  document.addEventListener('click',function(e){
    var dot=e.target.closest('.promo-dot');
    if(dot){paused=true;show(Number(dot.dataset.index));clearInterval(timer);timer=setInterval(function(){paused=false;next();},${rotateMs});}
  });
})();
</script>`
    : '';

  return `<div style="width:100%;font-family:${STYLES.fontFamily};" role="region" aria-label="Promotional banners" aria-roledescription="carousel">
  ${bannerSlides}
  ${dotsSection}
  ${script}
</div>`;
}

/**
 * Get the auto-rotation interval in milliseconds.
 * @returns {number}
 */
export function getAutoRotateMs() {
  return AUTO_ROTATE_MS;
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
