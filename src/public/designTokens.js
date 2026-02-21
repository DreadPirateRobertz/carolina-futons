// Carolina Futons Design System - Tokens & Constants
// Reference: Blue Ridge Mountain Illustrative aesthetic
// These tokens guide both Velo code and Wix Studio editor styling
//
// Brand tokens (colors, spacing, radii, shadows, etc.) are sourced from
// sharedTokens.js — the cross-platform single source of truth.
// Web-specific config (SEO, typography scales, grid, categories) lives here.

import {
  colors as sharedColors,
  fontFamilies,
  spacing as sharedSpacing,
  borderRadius as sharedRadius,
  shadows as sharedShadows,
  transitions as sharedTransitions,
  breakpoints as sharedBreakpoints,
  shadowToCSS,
  spacingPx,
} from './sharedTokens.js';

// Re-export colors directly — same values, same keys
export const colors = sharedColors;

export const typography = {
  headingFamily: fontFamilies.heading,
  bodyFamily: fontFamilies.body,

  // Scale (desktop) — web-specific sizes
  heroTitle: { size: '56px', weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' },
  h1: { size: '42px', weight: 700, lineHeight: 1.15, letterSpacing: '-0.01em' },
  h2: { size: '32px', weight: 700, lineHeight: 1.2, letterSpacing: '0' },
  h3: { size: '24px', weight: 600, lineHeight: 1.3, letterSpacing: '0' },
  h4: { size: '20px', weight: 600, lineHeight: 1.35, letterSpacing: '0' },
  bodyLarge: { size: '18px', weight: 400, lineHeight: 1.6, letterSpacing: '0' },
  body: { size: '16px', weight: 400, lineHeight: 1.6, letterSpacing: '0' },
  bodySmall: { size: '14px', weight: 400, lineHeight: 1.5, letterSpacing: '0' },
  caption: { size: '12px', weight: 500, lineHeight: 1.4, letterSpacing: '0.02em' },
  navLink: { size: '14px', weight: 600, lineHeight: 1, letterSpacing: '0.04em' },
  price: { size: '20px', weight: 700, lineHeight: 1, letterSpacing: '0' },
  priceStrike: { size: '16px', weight: 400, lineHeight: 1, letterSpacing: '0' },
  button: { size: '15px', weight: 600, lineHeight: 1, letterSpacing: '0.04em' },
};

// Spacing: shared values as CSS strings + web-specific layout tokens
export const spacing = {
  xs: spacingPx('xs'),
  sm: spacingPx('sm'),
  md: spacingPx('md'),
  lg: spacingPx('lg'),
  xl: spacingPx('xl'),
  xxl: spacingPx('xxl'),
  xxxl: spacingPx('xxxl'),
  section: '80px',
  pagePadding: '24px',
  pagePaddingDesktop: '80px',
  maxWidth: '1280px',
  gridGap: '24px',
};

// Border radius: shared values as CSS strings + web aliases
export const borderRadius = {
  sm: `${sharedRadius.sm}px`,
  md: `${sharedRadius.md}px`,
  lg: `${sharedRadius.lg}px`,
  xl: `${sharedRadius.xl}px`,
  pill: `${sharedRadius.pill}px`,
  card: '12px',
  button: '8px',
  image: '8px',
};

// Shadows: shared structured values as CSS strings
export const shadows = {
  card: shadowToCSS(sharedShadows.card),
  cardHover: shadowToCSS(sharedShadows.cardHover),
  nav: shadowToCSS(sharedShadows.nav),
  modal: shadowToCSS(sharedShadows.modal),
  button: shadowToCSS(sharedShadows.button),
};

// Transitions: shared durations as CSS strings
export const transitions = {
  fast: `${sharedTransitions.fast}ms ease`,
  medium: `${sharedTransitions.medium}ms ease`,
  slow: `${sharedTransitions.slow}ms ease`,
  cardHover: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
};

// Product grid configurations (web-specific)
export const grid = {
  desktop: { columns: 3, gap: '24px' },
  tablet: { columns: 2, gap: '20px' },
  mobile: { columns: 1, gap: '16px' },
  featured: { columns: 4, gap: '24px' },
};

// Breakpoints (for reference - Wix Studio handles responsively)
export const breakpoints = sharedBreakpoints;

// SEO defaults (web-specific)
export const seo = {
  siteName: 'Carolina Futons',
  titleSuffix: ' | Carolina Futons - Hendersonville, NC',
  defaultDescription: 'The largest selection of quality futon furniture in the Carolinas. Futon frames, mattresses, Murphy cabinet beds, and platform beds. Family-owned in Hendersonville, NC since 1991.',
  locale: 'en_US',
  businessAddress: {
    street: '824 Locust St, Ste 200',
    city: 'Hendersonville',
    state: 'NC',
    zip: '28792',
    phone: '(828) 252-9449',
    hours: 'Wed-Sat 10am-5pm',
  },
  categoryTitles: {
    'futon-frames': 'Futon Frames - Solid Wood Frames from Night & Day, Strata & KD Frames',
    'mattresses': 'Futon Mattresses - Otis Bed Hypoallergenic Foam Mattresses',
    'murphy-cabinet-beds': 'Murphy Cabinet Beds - Freestanding, No Wall Mount Needed',
    'platform-beds': 'Platform Beds - Solid Wood by Night & Day Furniture & KD Frames',
    'casegoods-accessories': 'Bedroom Furniture & Accessories - Night & Day Furniture',
    'wall-huggers': 'Wall Hugger Futon Frames - Strata Furniture Patented Design',
    'unfinished-wood': 'Unfinished Wood Futon Frames - KD Frames Made in USA',
  },
  categoryKeywords: {
    'futon-frames': 'futon frames, solid wood futon frame, hardwood futon frame, night and day furniture, front loading futon, nesting futon, full size futon frame, queen futon frame',
    'mattresses': 'futon mattress, otis bed mattress, hypoallergenic futon mattress, foam futon mattress, CertiPUR-US mattress, full futon mattress, queen futon mattress',
    'murphy-cabinet-beds': 'murphy cabinet bed, freestanding murphy bed, cabinet bed, no wall mount murphy bed, night and day murphy bed, guest bed solution',
    'platform-beds': 'platform bed, solid wood platform bed, low profile bed frame, bed frame for memory foam, kd frames platform bed, night and day platform bed',
    'casegoods-accessories': 'bedroom furniture, nightstand, dresser, futon accessories, matching bedroom set, night and day furniture casegoods',
    'wall-huggers': 'wall hugger futon, strata furniture, space saving futon, futon for small rooms, wall hugger futon frame',
    'unfinished-wood': 'unfinished futon frame, kd frames, unfinished wood furniture, paintable futon frame, DIY futon frame, made in usa futon',
  },
  keywords: {
    primary: 'futons, futon frames, futon mattresses, murphy beds, murphy cabinet beds, platform beds',
    geographic: 'hendersonville nc furniture, asheville furniture store, western nc furniture, carolina futons',
    brand: 'night and day furniture, otis bed, strata furniture, kd frames, arizona mattress',
    intent: 'buy futon online, futon store near me, best futon mattress, convertible furniture, space saving bed',
  },
  og: {
    type: 'website',
    siteName: 'Carolina Futons',
    locale: 'en_US',
    defaultImage: 'https://www.carolinafutons.com/og-image.jpg',
  },
};

// Product category configuration (web-specific)
export const categories = {
  futonFrames: {
    slug: 'futon-frames',
    title: 'Futon Frames',
    subcategories: [
      { slug: 'front-loading-nesting', title: 'Front Loading & Nesting', brand: 'Night & Day Furniture' },
      { slug: 'wall-huggers', title: 'Wall Huggers', brand: 'Strata Furniture' },
      { slug: 'unfinished-wood', title: 'Unfinished Wood', brand: 'KD Frames' },
      { slug: 'rustic-log-frames', title: 'Rustic Log Frames', brand: 'Night & Day Furniture' },
    ],
  },
  mattresses: {
    slug: 'mattresses',
    title: 'Futon Mattresses',
    subcategories: [
      { slug: 'otis-bed', title: 'Otis Bed Mattresses', brand: 'Otis Bed' },
      { slug: 'arizona', title: 'Arizona Boutique Line', brand: 'Arizona', inStoreOnly: true },
    ],
  },
  murphyBeds: {
    slug: 'murphy-cabinet-beds',
    title: 'Murphy Cabinet Beds',
    brand: 'Night & Day Furniture',
  },
  platformBeds: {
    slug: 'platform-beds',
    title: 'Platform Beds',
    subcategories: [
      { slug: 'night-day-platform', title: 'Night & Day Platform Beds', brand: 'Night & Day Furniture' },
      { slug: 'kd-frames-platform', title: 'KD Frames Platform Beds', brand: 'KD Frames' },
    ],
  },
  casegoods: {
    slug: 'casegoods-accessories',
    title: 'Casegoods & Accessories',
    brand: 'Night & Day Furniture',
  },
};

// Cross-sell relationship map
export const crossSellMap = {
  'futon-frames': ['mattresses', 'casegoods-accessories'],
  'mattresses': ['futon-frames'],
  'murphy-cabinet-beds': ['casegoods-accessories', 'platform-beds'],
  'platform-beds': ['casegoods-accessories', 'mattresses'],
  'casegoods-accessories': ['platform-beds', 'futon-frames'],
  'wall-huggers': ['mattresses', 'casegoods-accessories'],
  'unfinished-wood': ['mattresses', 'casegoods-accessories'],
};

// "Complete Your Futon" bundle suggestion config
export const bundleSuggestions = {
  frame: { suggestNext: 'mattress', label: 'Add a Mattress' },
  mattress: { suggestNext: 'cover', label: 'Choose a Cover' },
  cover: { suggestNext: null, label: null },
  murphyBed: { suggestNext: 'casegoods', label: 'Add Matching Furniture' },
  platformBed: { suggestNext: 'casegoods', label: 'Complete the Bedroom' },
};
