/**
 * SVG Extraction — Renders all illustration SVGs to /tmp/cf-svgs.json
 * Run: npx vitest run tests/extract-svgs.test.js
 */
import { writeFileSync } from 'node:fs';
import { getComfortSvg } from '../src/public/comfortIllustrations.js';
import { ILLUSTRATION_SVGS } from '../src/public/emptyStateIllustrations.js';
import { ONBOARDING_SVGS } from '../src/public/onboardingIllustrations.js';
import { generateMountainSVG } from '../src/public/MountainSkyline.js';

describe('SVG Extraction', () => {
  it('extracts all SVGs to /tmp/cf-svgs.json', () => {
    const svgs = {};

    // Comfort illustrations
    ['plush', 'medium', 'firm'].forEach(slug => {
      svgs[`comfort-${slug}`] = getComfortSvg(slug);
    });

    // Empty state illustrations
    Object.entries(ILLUSTRATION_SVGS).forEach(([key, val]) => {
      svgs[`empty-${key}`] = typeof val === 'function' ? val() : val;
    });

    // Onboarding illustrations
    Object.entries(ONBOARDING_SVGS).forEach(([key, val]) => {
      svgs[`onboarding-${key}`] = typeof val === 'function' ? val() : val;
    });

    // Mountain skyline variants
    svgs['skyline-default'] = generateMountainSVG({});
    svgs['skyline-sunrise'] = generateMountainSVG({ variant: 'sunrise' });
    svgs['skyline-sunset'] = generateMountainSVG({ variant: 'sunset' });

    writeFileSync('/tmp/cf-svgs.json', JSON.stringify(svgs, null, 2));
    expect(Object.keys(svgs).length).toBeGreaterThan(0);
    console.log(`Extracted ${Object.keys(svgs).length} SVGs to /tmp/cf-svgs.json`);
  });
});
