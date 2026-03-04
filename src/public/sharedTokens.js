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
  offWhite: '#FAF7F2',
  white: '#FFFFFF',

  // Decorative
  skyGradientTop: '#B8D4E3',
  skyGradientBottom: '#F0C87A',
  overlay: 'rgba(58, 37, 24, 0.6)',

  // Semantic / status
  success: '#4A7C59',
  error: '#C0392B',
  muted: '#767676',
  mutedBrown: '#816D51',
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

// Supported currencies for multi-currency display
export const supportedCurrencies = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
};

export const defaultCurrency = 'USD';

// International shipping zones and rate multipliers
export const internationalShippingConfig = {
  zones: {
    canada: {
      countries: ['CA'],
      name: 'Canada',
      baseRate: 79.99,
      perPoundRate: 1.25,
      estimatedDays: '7-14',
    },
    europe: {
      countries: ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'SE', 'DK', 'FI', 'NO', 'CH'],
      name: 'Europe',
      baseRate: 149.99,
      perPoundRate: 2.50,
      estimatedDays: '14-21',
    },
    asia_pacific: {
      countries: ['JP', 'AU', 'NZ', 'KR', 'SG', 'HK', 'TW'],
      name: 'Asia Pacific',
      baseRate: 199.99,
      perPoundRate: 3.25,
      estimatedDays: '14-28',
    },
    other: {
      countries: [],
      name: 'International',
      baseRate: 249.99,
      perPoundRate: 4.00,
      estimatedDays: '21-35',
    },
  },
  // Countries we ship to (ISO 3166 alpha-2)
  restrictedCountries: ['CU', 'IR', 'KP', 'SY', 'SD'],
  freeInternationalThreshold: 2999,
};

// Customs / duties estimation config
export const customsConfig = {
  // HS code for furniture (9403 = other furniture and parts)
  defaultHSCode: '9403',
  // Typical duty rates by destination region (percentage of declared value)
  dutyRates: {
    CA: { rate: 0, description: 'Duty-free under USMCA for qualifying goods' },
    MX: { rate: 0, description: 'Duty-free under USMCA for qualifying goods' },
    GB: { rate: 0.02, description: '~2% duty + 20% VAT on furniture' },
    DE: { rate: 0.027, description: '~2.7% duty + 19% VAT on furniture' },
    FR: { rate: 0.027, description: '~2.7% duty + 20% VAT on furniture' },
    IT: { rate: 0.027, description: '~2.7% duty + 22% VAT on furniture' },
    ES: { rate: 0.027, description: '~2.7% duty + 21% VAT on furniture' },
    JP: { rate: 0, description: 'Generally duty-free for furniture' },
    AU: { rate: 0.05, description: '~5% duty + 10% GST on furniture' },
    NZ: { rate: 0.05, description: '~5% duty + 15% GST on furniture' },
  },
  // VAT/GST rates
  vatRates: {
    GB: 0.20, DE: 0.19, FR: 0.20, IT: 0.22, ES: 0.21,
    NL: 0.21, BE: 0.21, AT: 0.20, IE: 0.23, PT: 0.23,
    SE: 0.25, DK: 0.25, FI: 0.24, NO: 0.25, CH: 0.077,
    AU: 0.10, NZ: 0.15, JP: 0.10, KR: 0.10, SG: 0.09,
    CA: 0.05, HK: 0, TW: 0.05,
  },
  // De minimis thresholds (value below which no duty is charged, in local currency equivalent USD)
  deMinimisUSD: {
    CA: 150, GB: 135, DE: 150, FR: 150, AU: 1000, NZ: 1000, JP: 10000,
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
