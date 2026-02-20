// Carolina Futons Design System - Tokens & Constants
// Reference: Blue Ridge Mountain Illustrative aesthetic
// These tokens guide both Velo code and Wix Studio editor styling

export const colors = {
  // Primary palette - extracted from design reference
  sandBase: '#E8D5B7',        // Warm cream/sand - page backgrounds
  sandLight: '#F2E8D5',       // Lighter sand - card backgrounds, alternating sections
  sandDark: '#D4BC96',        // Darker sand - borders, subtle dividers
  espresso: '#3A2518',        // Deep brown - primary text, headings
  espressoLight: '#5C4033',   // Lighter brown - secondary text, captions
  mountainBlue: '#5B8FA8',    // Smoky blue-teal - links, accents, CTA secondary
  mountainBlueDark: '#3D6B80', // Darker blue - hover states
  mountainBlueLight: '#A8CCD8', // Soft sky blue - subtle backgrounds, tags
  sunsetCoral: '#E8845C',     // Warm coral/orange - primary CTA, sale badges
  sunsetCoralDark: '#C96B44', // Darker coral - hover states for CTA
  sunsetCoralLight: '#F2A882', // Light coral - subtle accents
  mauve: '#C9A0A0',           // Soft mauve/pink - tertiary accent
  skyGradientTop: '#B8D4E3',  // Top of sky gradient in illustrations
  skyGradientBottom: '#F0C87A', // Bottom of sky gradient (sunset glow)
  white: '#FFFFFF',
  overlay: 'rgba(58, 37, 24, 0.6)', // Espresso overlay for modals
};

export const typography = {
  // Heading font - warm serif/slab for handcrafted feel
  // Recommended: "Playfair Display", "Lora", or "Libre Baskerville"
  headingFamily: '"Playfair Display", Georgia, serif',
  // Body font - clean sans-serif for readability
  // Recommended: "Source Sans 3", "Nunito Sans", or "Open Sans"
  bodyFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',

  // Scale (desktop)
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

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  xxxl: '64px',
  section: '80px',  // Between page sections
  pagePadding: '24px', // Mobile page padding
  pagePaddingDesktop: '80px',
  maxWidth: '1280px', // Content max-width
  gridGap: '24px',    // Product grid gap
};

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  pill: '9999px',
  card: '12px',     // Product cards
  button: '8px',    // Buttons
  image: '8px',     // Product images
};

export const shadows = {
  card: '0 2px 12px rgba(58, 37, 24, 0.08)',
  cardHover: '0 8px 24px rgba(58, 37, 24, 0.12)',
  nav: '0 2px 8px rgba(58, 37, 24, 0.06)',
  modal: '0 16px 48px rgba(58, 37, 24, 0.2)',
  button: '0 2px 8px rgba(232, 132, 92, 0.3)',
};

export const transitions = {
  fast: '150ms ease',
  medium: '250ms ease',
  slow: '400ms ease',
  cardHover: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
};

// Product grid configurations
export const grid = {
  // Desktop: 3-4 columns, Tablet: 2, Mobile: 1-2
  desktop: { columns: 3, gap: '24px' },
  tablet: { columns: 2, gap: '20px' },
  mobile: { columns: 1, gap: '16px' },
  // Featured/homepage grid
  featured: { columns: 4, gap: '24px' },
};

// Breakpoints (for reference - Wix Studio handles responsively)
export const breakpoints = {
  mobile: 320,
  mobileLarge: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
  ultraWide: 1440,
};

// SEO defaults
export const seo = {
  siteName: 'Carolina Futons',
  titleSuffix: ' | Carolina Futons - Hendersonville, NC',
  defaultDescription: 'The largest selection of quality futon furniture in the Carolinas. Futon frames, mattresses, Murphy cabinet beds, and platform beds. Family-owned in Hendersonville, NC since 1991.',
  defaultKeywords: 'futons, futon frames, futon mattresses, murphy beds, murphy cabinet beds, platform beds, hendersonville nc, asheville furniture, night and day furniture, otis bed, strata furniture, kd frames',
  locale: 'en_US',
  businessAddress: {
    street: '824 Locust St, Ste 200',
    city: 'Hendersonville',
    state: 'NC',
    zip: '28792',
    phone: '(828) 252-9449',
    hours: 'Wed-Sat 10am-5pm',
  },
};

// Product category configuration
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
// When viewing product in category A, suggest products from category B
export const crossSellMap = {
  'futon-frames': ['mattresses', 'casegoods-accessories'],
  'mattresses': ['futon-frames'],
  'murphy-cabinet-beds': ['casegoods-accessories', 'platform-beds'],
  'platform-beds': ['casegoods-accessories', 'mattresses'],
  'casegoods-accessories': ['platform-beds', 'futon-frames'],
};

// "Complete Your Futon" bundle suggestion config
export const bundleSuggestions = {
  frame: { suggestNext: 'mattress', label: 'Add a Mattress' },
  mattress: { suggestNext: 'cover', label: 'Choose a Cover' },
  cover: { suggestNext: null, label: null },
  murphyBed: { suggestNext: 'casegoods', label: 'Add Matching Furniture' },
  platformBed: { suggestNext: 'casegoods', label: 'Complete the Bedroom' },
};
