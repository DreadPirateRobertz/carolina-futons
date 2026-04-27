/**
 * HeroPorchWix.js — Wix glue for the v3 porch hero HtmlComponent.
 *
 * Shows #heroPorchFrame, hides the static hero elements, then feeds
 * window.scrollY to the iframe on each scroll tick so the parallax
 * layers move relative to page scroll.
 *
 * Editor setup required: add HtmlComponent #heroPorchFrame to the hero
 * section with src = v3-porch-hero.html (set via Properties panel).
 *
 * cf-e5de
 */

export function initHeroPorch($w) {
  try { $w('#heroPorchFrame').show(); } catch (_) {}
  try { $w('#heroBg').hide(); } catch (_) {}
  try { $w('#heroOverlay').hide(); } catch (_) {}

  if (typeof window === 'undefined') return;

  const sendScroll = () => {
    try {
      $w('#heroPorchFrame').postMessage({ type: 'scroll', scrollY: window.scrollY || 0 });
    } catch (_) {}
  };

  sendScroll();
  window.addEventListener('scroll', sendScroll, { passive: true });
}
