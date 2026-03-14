/**
 * @file wcagTouchMotion.test.js
 * @description TDD tests for hq-hnzj: 44px touch targets + prefers-reduced-motion.
 *
 * Verifies:
 * 1. All interactive elements at 480px have min-height: 44px (WCAG 2.5.5 AAA / 2.5.8 AA)
 * 2. A prefers-reduced-motion media query exists to disable/reduce animations
 * 3. Minimum font sizes are enforced (no sub-12px text)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const css = readFileSync('src/styles/global.css', 'utf-8');

// Extract the @media (max-width: 480px) block for touch target checks
function extractMobileBlock(cssText) {
  const marker = '@media (max-width: 480px)';
  const idx = cssText.indexOf(marker);
  if (idx === -1) return '';
  // Find the matching closing brace
  let depth = 0;
  let start = -1;
  for (let i = idx; i < cssText.length; i++) {
    if (cssText[i] === '{') {
      if (start === -1) start = i;
      depth++;
    } else if (cssText[i] === '}') {
      depth--;
      if (depth === 0) return cssText.slice(start + 1, i);
    }
  }
  return '';
}

const mobileBlock = extractMobileBlock(css);

// ── 1. Touch targets at 480px ───────────────────────────────────────

describe('WCAG: 44px touch targets at mobile breakpoint (480px)', () => {
  it('has a @media (max-width: 480px) block', () => {
    expect(mobileBlock.length).toBeGreaterThan(0);
  });

  const touchTargetSelectors = [
    { desc: 'nav links', pattern: /\.horizontal-menu__item-label[\s\S]*?min-height:\s*44px/ },
    { desc: 'footer links', pattern: /\.footer\s+a[\s\S]*?min-height:\s*44px/ },
    { desc: 'filter options', pattern: /\[data-hook="filter-(?:title|full-title)"\][\s\S]*?min-height:\s*44px/ },
    { desc: 'sort dropdown', pattern: /\[data-hook="sort-floating-dropdown"\][\s\S]*?min-height:\s*44px/ },
    { desc: 'cart icon', pattern: /\[data-hook="cart-icon-button"\][\s\S]*?min-height:\s*44px/ },
    { desc: 'search button', pattern: /\.search-button[\s\S]*?min-height:\s*44px/ },
    { desc: 'breadcrumb links', pattern: /\[data-hook="extended-gallery-breadcrumbs"\][\s\S]*?min-height:\s*44px/ },
    { desc: 'mobile menu links', pattern: /\.mobile-menu\s+a[\s\S]*?min-height:\s*44px/ },
  ];

  for (const { desc, pattern } of touchTargetSelectors) {
    it(`${desc} have min-height: 44px`, () => {
      expect(mobileBlock).toMatch(pattern);
    });
  }

  // Verify existing touch targets still present
  it('primary action buttons still have min-height: 44px', () => {
    expect(mobileBlock).toMatch(/\[data-hook="add-to-cart"\][\s\S]*?min-height:\s*44px/);
  });
});

// ── 2. prefers-reduced-motion ───────────────────────────────────────

describe('WCAG: prefers-reduced-motion media query', () => {
  it('has a @media (prefers-reduced-motion: reduce) block', () => {
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
  });

  it('reduces or disables transitions', () => {
    const motionBlock = extractReducedMotionBlock(css);
    expect(motionBlock).toMatch(/transition.*(?:none|0s)/i);
  });

  it('reduces or disables animations', () => {
    const motionBlock = extractReducedMotionBlock(css);
    expect(motionBlock).toMatch(/animation.*(?:none|0s)/i);
  });
});

function extractReducedMotionBlock(cssText) {
  const marker = 'prefers-reduced-motion';
  const idx = cssText.indexOf(marker);
  if (idx === -1) return '';
  let depth = 0;
  let start = -1;
  for (let i = idx; i < cssText.length; i++) {
    if (cssText[i] === '{') {
      if (start === -1) start = i;
      depth++;
    } else if (cssText[i] === '}') {
      depth--;
      if (depth === 0) return cssText.slice(start + 1, i);
    }
  }
  return '';
}

// ── 3. Minimum font sizes ───────────────────────────────────────────

describe('WCAG: minimum font sizes (no sub-12px interactive text)', () => {
  it('product ribbon font is at least 12px', () => {
    // [data-hook="product-item-ribbon"] should be >= 12px
    const ribbonMatch = css.match(/\[data-hook="product-item-ribbon"\][\s\S]*?font-size:\s*(\d+)px/);
    expect(ribbonMatch).not.toBeNull();
    expect(parseInt(ribbonMatch[1], 10)).toBeGreaterThanOrEqual(12);
  });
});
