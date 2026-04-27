/**
 * HeroV3Wix.js — Shared Wix glue for V3 bear hero HtmlComponents.
 *
 * Each page has a single hero frame element. This module shows it,
 * hides the static photo fallback, and feeds window.scrollY via postMessage
 * so the parallax layers inside the iframe drift on scroll.
 *
 * Editor setup per page:
 *   /about              → #heroV3Frame  src=v3-cabin-hero.html
 *   /collections/futon-frames → #heroV3Frame  src=v3-reading-hero.html
 *
 * cf-e5de
 */

export function initHeroV3($w, frameId = '#heroV3Frame') {
  try { $w(frameId).show(); } catch (_) {}
  try { $w('#heroBg').hide(); } catch (_) {}
  try { $w('#heroOverlay').hide(); } catch (_) {}
  try { $w('#heroImage').hide(); } catch (_) {}

  if (typeof window === 'undefined') return;

  const sendScroll = () => {
    try {
      $w(frameId).postMessage({ type: 'scroll', scrollY: window.scrollY || 0 });
    } catch (_) {}
  };

  sendScroll();
  window.addEventListener('scroll', sendScroll, { passive: true });
}
