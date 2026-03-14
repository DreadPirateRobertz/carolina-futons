/**
 * @module sharedTokens
 * @description Platform-agnostic brand design tokens for Carolina Futons.
 *
 * This is the SINGLE SOURCE OF TRUTH for brand identity across all platforms.
 * Every color, spacing value, shadow, and business constant originates here.
 *
 * Consumers:
 *  - Web: imported by `designTokens.js` which adds web-specific config (CSS strings, SEO, grid)
 *  - Mobile: consumed via `design-tokens.json` (generated from this file by the build pipeline)
 *
 * Aesthetic: Clean blue/white CF branding for UI chrome. Illustrations retain
 * the warm Blue Ridge Mountain palette independently.
 *
 * IMPORTANT: Never hardcode color hex values in consuming code. Always import
 * from this module (or from designTokens.js for web) to keep the brand
 * consistent and updatable from one place.
 */

/**
 * Brand identity metadata used in structured data, emails, and app manifests.
 * @type {{ name: string, shortName: string, foundedYear: number }}
 */
export const brand = {
  name: 'Carolina Futons',
  /** Abbreviated name for mobile home screens and tight UI spaces */
  shortName: 'CF Futons',
  /** Year the business was founded — used in "Since 1991" taglines */
  foundedYear: 1991,
};

/**
 * Brand color palette — clean blue/white CF branding.
 *
 * Organized into three groups:
 *  - **Primary** — the core brand colors used for backgrounds, text, accents, and CTAs
 *  - **Decorative** — gradient endpoints and overlays (warm tones for illustrations)
 *  - **Semantic** — status feedback colors (success, error) and muted/disabled tones
 *
 * Each primary color has light/dark variants for hover states and contrast needs.
 *
 * @type {Object<string, string>}
 */
export const colors = {
  // ── Primary palette ────────────────────────────────────────────
  /** Light blue-gray — primary background surface */
  sandBase: '#F0F4F8',
  /** Near-white — secondary backgrounds, card fills, alternating rows */
  sandLight: '#F8FAFC',
  /** Cool border gray — hover state for backgrounds, subtle borders */
  sandDark: '#E2E8F0',
  /** Dark navy — primary text color, headings, high-contrast elements */
  espresso: '#1E3A5F',
  /** Medium navy — secondary text, placeholder text, subtle UI elements */
  espressoLight: '#3D5A80',
  /** CF brand blue — links, secondary buttons, informational accents */
  mountainBlue: '#5B8FA8',
  /** Darker brand blue — hover state for blue interactive elements */
  mountainBlueDark: '#3D6B80',
  /** Light brand blue — tinted backgrounds, tag fills, info banners */
  mountainBlueLight: '#A8CCD8',
  /** CF brand blue (darkened) — CTA buttons, primary interactive elements. WCAG AA 4.56:1 with white text */
  sunsetCoral: '#4A7D94',
  /** Dark blue — hover/active state for CTA buttons */
  sunsetCoralDark: '#3D6B80',
  /** Light blue — sale badges, subtle accent backgrounds */
  sunsetCoralLight: '#A8CCD8',
  /** Pure white — page background */
  offWhite: '#FFFFFF',
  /** Pure white — card backgrounds, modal surfaces */
  white: '#FFFFFF',

  // ── Decorative (warm palette for illustrations) ────────────────
  /** Top of mountain skyline gradient — cool morning sky blue */
  skyGradientTop: '#B8D4E3',
  /** Bottom of mountain skyline gradient — warm golden horizon */
  skyGradientBottom: '#F0C87A',
  /** Semi-transparent navy overlay for hero images and modals */
  overlay: 'rgba(30, 58, 95, 0.6)',

  // ── Semantic / status ──────────────────────────────────────────
  /** Success feedback — order confirmations, in-stock indicators */
  success: '#4A7C59',
  /** Error feedback — validation errors, out-of-stock, destructive actions */
  error: '#DC2626',
  /** Muted slate — disabled controls, secondary metadata (WCAG AA on all surfaces) */
  muted: '#646C79',
  /** Slate gray — blends with blue-gray backgrounds */
  mutedBrown: '#64748B',
};

/**
 * Font family stacks for the two-typeface system.
 *
 * Playfair Display (headings) provides the elegant, editorial character.
 * Source Sans 3 (body) ensures readability at small sizes.
 * Fallbacks are chosen to match x-height and weight of the primary fonts
 * so layout shift is minimal while web fonts load.
 *
 * @type {{ heading: string, body: string }}
 */
export const fontFamilies = {
  /** Playfair Display — serif display face for h1-h4, hero text, prices */
  heading: '"Playfair Display", Georgia, serif',
  /** Source Sans 3 — clean sans-serif for body copy, nav, buttons, form labels */
  body: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
};

/**
 * Spacing scale based on a 4px base unit.
 *
 * All values are raw numbers (pixels) so they work on both web (append "px")
 * and mobile (use as density-independent pixels). The web layer in
 * designTokens.js converts these to CSS strings via `spacingPx()`.
 *
 * @type {{ xs: number, sm: number, md: number, lg: number, xl: number, xxl: number, xxxl: number }}
 */
export const spacing = {
  xs: 4,    // Tight gaps: icon-to-label, inline badge padding
  sm: 8,    // Small gaps: form field spacing, list item padding
  md: 16,   // Default gap: card padding, section element spacing
  lg: 24,   // Comfortable gap: between card groups, form sections
  xl: 32,   // Large gap: between major page sections
  xxl: 48,  // Extra-large: hero content padding, major visual breaks
  xxxl: 64, // Maximum: full section vertical padding on desktop
};

/**
 * Border radius scale for rounded corners.
 *
 * Values are raw pixels. The `pill` value (9999px) creates fully rounded
 * ends on any element regardless of height — used for tags, badges, and
 * pill-shaped buttons.
 *
 * @type {{ sm: number, md: number, lg: number, xl: number, pill: number }}
 */
export const borderRadius = {
  sm: 4,     // Subtle rounding: input fields, small buttons
  md: 8,     // Default: cards, dropdowns, tooltips
  lg: 12,    // Prominent rounding: featured cards, image containers
  xl: 16,    // Large rounding: modals, bottom sheets
  pill: 9999, // Fully rounded ends: tags, badges, pill buttons
};

/**
 * Box shadow definitions using navy-tinted tones for depth.
 *
 * Shadows use the navy base color (rgb 30,58,95) at varying opacities
 * for a clean, professional look. The `button` shadow uses the
 * brand blue for a subtle glow effect on primary actions.
 *
 * Stored as structured objects so both web (via `shadowToCSS()`) and mobile
 * can consume them in their native shadow formats.
 *
 * @type {Object<string, { x: number, y: number, blur: number, color: string }>}
 */
export const shadows = {
  /** Default card resting state — subtle lift off the background */
  card: { x: 0, y: 2, blur: 12, color: 'rgba(30, 58, 95, 0.08)' },
  /** Card hover/focus — elevated to signal interactivity */
  cardHover: { x: 0, y: 8, blur: 24, color: 'rgba(30, 58, 95, 0.12)' },
  /** Navigation bar — minimal shadow to separate from page content */
  nav: { x: 0, y: 2, blur: 8, color: 'rgba(30, 58, 95, 0.06)' },
  /** Modal/dialog overlay — strong depth to focus attention */
  modal: { x: 0, y: 16, blur: 48, color: 'rgba(30, 58, 95, 0.2)' },
  /** CTA button — blue-tinted glow to draw the eye to primary actions */
  button: { x: 0, y: 2, blur: 8, color: 'rgba(91, 143, 168, 0.3)' },
};

/**
 * Animation/transition durations in milliseconds.
 *
 * Three tiers cover all UI motion needs. The web layer appends "ms ease"
 * to produce CSS transition values. Raw numbers here for cross-platform use.
 *
 * @type {{ fast: number, medium: number, slow: number }}
 */
export const transitions = {
  /** Fast — micro-interactions: button hover, focus rings, tooltip show */
  fast: 150,
  /** Medium — standard UI transitions: panel open, tab switch, fade in */
  medium: 250,
  /** Slow — dramatic transitions: page hero reveal, modal entrance */
  slow: 400,
};

/**
 * Responsive breakpoints in pixels (min-width convention).
 *
 * These define the viewport widths at which layout shifts occur.
 * On web, Wix Studio handles most responsive behavior in the editor,
 * but these are used by `mobileHelpers.js` for JS-driven responsive logic.
 * On mobile, these inform adaptive layout decisions.
 *
 * @type {{ mobile: number, mobileLarge: number, tablet: number, desktop: number, wide: number, ultraWide: number }}
 */
export const breakpoints = {
  mobile: 320,       // Smallest supported viewport (1 column, 16px gap)
  mobileLarge: 480,  // Larger phones in portrait (1 column)
  tablet: 768,       // Tablets and small laptops (2 columns, 20px gap)
  desktop: 1024,     // Standard desktop (3 columns, 24px gap)
  wide: 1280,        // Wide desktop — max-width container kicks in
  ultraWide: 1440,   // Ultra-wide — content centered, extra margin
};

/**
 * Business contact and location info — single source of truth for all platforms.
 *
 * Used in structured data (JSON-LD), footer, contact page, emails, and the
 * mobile app. Phone is stored in three formats to avoid runtime reformatting:
 *  - `phone` — human-readable display format
 *  - `phoneE164` — international standard for tel: links and APIs
 *  - `phoneDigits` — digits only for click-to-call on mobile
 *
 * @type {Object}
 */
export const business = {
  phone: '(828) 252-9449',
  /** E.164 format (international tel: link standard) */
  phoneE164: '+18282529449',
  /** Digits only — used in mobile native dialer intents */
  phoneDigits: '8282529449',
  baseUrl: 'https://www.carolinafutons.com',
  address: {
    street: '824 Locust St, Ste 200',
    city: 'Hendersonville',
    state: 'NC',
    zip: '28792',
  },
  /** Display string for store hours — showroom is open 4 days/week */
  hours: 'Wed-Sat 10am-5pm',
  /** JS Date day-of-week indices (0=Sun) used by deliveryScheduling.web.js */
  deliveryDays: [3, 4, 5, 6], // Wed=3, Thu=4, Fri=5, Sat=6
};

/**
 * Domestic shipping rate configuration.
 *
 * Zones are determined by the first 3 digits of the destination ZIP code.
 * "WNC" = Western North Carolina (local delivery area).
 * White-glove service includes in-home delivery and assembly.
 *
 * All monetary values are in USD (whole dollars, no cents).
 *
 * @type {Object}
 */
export const shippingConfig = {
  /** Orders at or above this amount (USD) qualify for free standard shipping */
  freeThreshold: 999999,
  whiteGlove: {
    /** Orders at or above this amount get free white-glove delivery */
    freeThreshold: 999999,
    /** White-glove price for local zone (WNC — within ~50 miles) */
    localPrice: 149,
    /** White-glove price for regional zone (Southeast — NC/SC/GA/TN/VA) */
    regionalPrice: 249,
  },
  /** ZIP prefix ranges for shipping zone determination */
  zones: {
    /** WNC = Western North Carolina — local delivery area */
    local: { prefixMin: 287, prefixMax: 289, name: 'WNC' },
    /** Southeast region — broader delivery area with higher shipping cost */
    regional: { prefixMin: 270, prefixMax: 399, name: 'Southeast' },
  },
};

/**
 * Supported currencies for multi-currency price display.
 *
 * Each entry provides the ISO 4217 currency code, display symbol, human name,
 * and the BCP 47 locale used by `Intl.NumberFormat` for proper formatting
 * (decimal separators, symbol placement, grouping).
 *
 * @type {Object<string, { code: string, symbol: string, name: string, locale: string }>}
 */
export const supportedCurrencies = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
};

/** @type {string} ISO 4217 code — fallback currency when user preference is unknown */
export const defaultCurrency = 'USD';

/**
 * International shipping zones, rates, and restrictions.
 *
 * Shipping cost = `baseRate` + (item weight in lbs * `perPoundRate`).
 * Country codes are ISO 3166-1 alpha-2. The `other` zone is a catch-all
 * for countries not in a named zone and not on the restricted list.
 *
 * @type {Object}
 */
export const internationalShippingConfig = {
  zones: {
    canada: {
      /** ISO 3166-1 alpha-2 country codes in this zone */
      countries: ['CA'],
      name: 'Canada',
      /** Flat base shipping fee in USD */
      baseRate: 79.99,
      /** Additional cost per pound (lb) of product weight in USD */
      perPoundRate: 1.25,
      /** Estimated transit time displayed to the customer */
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
    /** Catch-all for countries not in a named zone (empty countries array = fallback) */
    other: {
      countries: [],
      name: 'International',
      baseRate: 249.99,
      perPoundRate: 4.00,
      estimatedDays: '21-35',
    },
  },
  /** ISO 3166-1 alpha-2 codes of embargoed/sanctioned countries — orders are blocked */
  restrictedCountries: ['CU', 'IR', 'KP', 'SY', 'SD'],
  /** Orders at or above this USD amount qualify for free international shipping */
  freeInternationalThreshold: 2999,
};

/**
 * Customs and duties estimation configuration for international orders.
 *
 * HS = Harmonized System — international product classification standard.
 * HS code 9403 covers "Other furniture and parts thereof."
 * VAT = Value Added Tax. GST = Goods and Services Tax.
 *
 * Duty and VAT rates are approximate and used for estimation only — actual
 * amounts are determined by the destination country's customs authority.
 * De minimis thresholds define the order value (in approximate USD) below
 * which no import duty is charged.
 *
 * @type {Object}
 */
export const customsConfig = {
  /** HS (Harmonized System) code for furniture — 9403 = "other furniture and parts" */
  defaultHSCode: '9403',
  /** Typical duty rates by country (decimal fraction of declared value) */
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
  /** VAT (Value Added Tax) / GST (Goods and Services Tax) rates by country (decimal fraction) */
  vatRates: {
    GB: 0.20, DE: 0.19, FR: 0.20, IT: 0.22, ES: 0.21,
    NL: 0.21, BE: 0.21, AT: 0.20, IE: 0.23, PT: 0.23,
    SE: 0.25, DK: 0.25, FI: 0.24, NO: 0.25, CH: 0.077,
    AU: 0.10, NZ: 0.15, JP: 0.10, KR: 0.10, SG: 0.09,
    CA: 0.05, HK: 0, TW: 0.05,
  },
  /** De minimis thresholds in approximate USD — orders below this value are duty-free */
  deMinimisUSD: {
    CA: 150, GB: 135, DE: 150, FR: 150, AU: 1000, NZ: 1000, JP: 10000,
  },
};

/**
 * Converts a structured shadow object to a CSS `box-shadow` value string.
 *
 * Used by `designTokens.js` to transform platform-agnostic shadow definitions
 * into ready-to-use CSS. Mobile consumers use the structured objects directly.
 *
 * @param {{ x: number, y: number, blur: number, color: string }} shadow - Shadow definition from the `shadows` constant
 * @returns {string} CSS box-shadow value, e.g. "0px 2px 12px rgba(58, 37, 24, 0.08)"
 */
export function shadowToCSS(shadow) {
  return `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.color}`;
}

/**
 * Converts a spacing token key to a CSS pixel string.
 *
 * Provides the bridge between raw numeric spacing values (used cross-platform)
 * and CSS-ready strings (used on web). For example, `spacingPx('md')` returns `"16px"`.
 *
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl'} key - Spacing scale key from the `spacing` constant
 * @returns {string} Pixel value string, e.g. "16px"
 */
export function spacingPx(key) {
  return `${spacing[key]}px`;
}
