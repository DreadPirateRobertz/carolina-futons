// Carolina Futons — Shared Design Tokens (Platform-Agnostic)
// These tokens are the single source of truth for brand identity across web and mobile.
// Web: imported by designTokens.js (adds web-specific config)
// Mobile: consumed via design-tokens.json (generated from this file)
//
// Reference: Blue Ridge Mountain Illustrative aesthetic

export const brand = {
  name: 'Carolina Futons',
  shortName: 'CF Futons',
  foundedYear: 1991,
};

export const colors = {
  // Primary palette
  sandBase: '#E8D5B7',
  sandLight: '#F2E8D5',
  sandDark: '#D4BC96',
  espresso: '#3A2518',
  espressoLight: '#5C4033',
  mountainBlue: '#5B8FA8',
  mountainBlueDark: '#3D6B80',
  mountainBlueLight: '#A8CCD8',
  sunsetCoral: '#E8845C',
  sunsetCoralDark: '#C96B44',
  sunsetCoralLight: '#F2A882',
  mauve: '#C9A0A0',
  offWhite: '#FAF7F2',
  white: '#FFFFFF',

  // Decorative
  skyGradientTop: '#B8D4E3',
  skyGradientBottom: '#F0C87A',
  overlay: 'rgba(58, 37, 24, 0.6)',

  // Semantic / status
  success: '#4A7C59',
  error: '#E8845C',
  muted: '#999999',
  mutedBrown: '#8B7355',
};

export const fontFamilies = {
  heading: '"Playfair Display", Georgia, serif',
  body: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
};

export const shadows = {
  card: { x: 0, y: 2, blur: 12, color: 'rgba(58, 37, 24, 0.08)' },
  cardHover: { x: 0, y: 8, blur: 24, color: 'rgba(58, 37, 24, 0.12)' },
  nav: { x: 0, y: 2, blur: 8, color: 'rgba(58, 37, 24, 0.06)' },
  modal: { x: 0, y: 16, blur: 48, color: 'rgba(58, 37, 24, 0.2)' },
  button: { x: 0, y: 2, blur: 8, color: 'rgba(232, 132, 92, 0.3)' },
};

export const transitions = {
  fast: 150,
  medium: 250,
  slow: 400,
};

export const breakpoints = {
  mobile: 320,
  mobileLarge: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
  ultraWide: 1440,
};

// Business contact — single source of truth for all platforms
export const business = {
  phone: '(828) 252-9449',
  phoneE164: '+18282529449',
  phoneDigits: '8282529449',
  baseUrl: 'https://www.carolinafutons.com',
  address: {
    street: '824 Locust St, Ste 200',
    city: 'Hendersonville',
    state: 'NC',
    zip: '28792',
  },
  hours: 'Wed-Sat 10am-5pm',
  deliveryDays: [3, 4, 5, 6], // Wed=3, Thu=4, Fri=5, Sat=6
};

// Shipping configuration
export const shippingConfig = {
  freeThreshold: 999,
  whiteGlove: {
    freeThreshold: 1999,
    localPrice: 149,
    regionalPrice: 249,
  },
  zones: {
    local: { prefixMin: 287, prefixMax: 289, name: 'WNC' },
    regional: { prefixMin: 270, prefixMax: 399, name: 'Southeast' },
  },
};

// Helper: format shadow for CSS (web consumers)
export function shadowToCSS(shadow) {
  return `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.color}`;
}

// Helper: format spacing for CSS (web consumers)
export function spacingPx(key) {
  return `${spacing[key]}px`;
}
