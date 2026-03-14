/**
 * footerContent.js — Rich footer data for 4-column layout
 *
 * Provides navigation links, store info, trust badges, payment methods,
 * and social media links for the site-wide footer.
 * Used by masterPage.js initFooterContent().
 *
 * CF-8gzd: Footer redesign
 */

/**
 * Shop navigation links for the footer "Shop" column.
 * @returns {Array<{ label: string, path: string }>}
 */
export function getFooterShopLinks() {
  return [
    { label: 'Futon Frames', path: '/futon-frames' },
    { label: 'Futon Mattresses', path: '/mattresses' },
    { label: 'Murphy Cabinet Beds', path: '/murphy-cabinet-beds' },
    { label: 'Platform Beds', path: '/platform-beds' },
    { label: 'Wall Hugger Frames', path: '/wall-huggers' },
    { label: 'Casegoods & Accessories', path: '/casegoods-accessories' },
    { label: 'Sale & Clearance', path: '/sales' },
  ];
}

/**
 * Customer service links for the footer "Customer Service" column.
 * @returns {Array<{ label: string, path: string }>}
 */
export function getFooterServiceLinks() {
  return [
    { label: 'Shipping Policy', path: '/shipping-policy' },
    { label: 'Returns & Exchanges', path: '/returns' },
    { label: 'Contact Us', path: '/contact' },
    { label: 'FAQ', path: '/faq' },
    { label: 'Order Tracking', path: '/order-tracking' },
    { label: 'Assembly Guides', path: '/assembly-guides' },
  ];
}

/**
 * About/company links for the footer "About Us" column.
 * @returns {Array<{ label: string, path: string }>}
 */
export function getFooterAboutLinks() {
  return [
    { label: 'Our Story', path: '/about' },
    { label: 'Blog', path: '/blog' },
    { label: 'Style Quiz', path: '/style-quiz' },
    { label: 'Privacy Policy', path: '/privacy-policy' },
    { label: 'Terms & Conditions', path: '/terms-conditions' },
    { label: 'Accessibility', path: '/accessibility-statement' },
  ];
}

/**
 * Physical store information for footer display.
 * @returns {{ name: string, address: string, phone: string, hours: Array<{ days: string, time: string }> }}
 */
export function getStoreInfo() {
  return {
    name: 'Carolina Futons',
    address: '824 Locust St, Hendersonville, NC 28792',
    phone: '(828) 252-9449',
    hours: [
      { days: 'Wednesday – Saturday', time: '10:00 AM – 5:00 PM' },
      { days: 'Sunday – Tuesday', time: 'Closed' },
    ],
  };
}

/**
 * Trust badges for footer social proof display.
 * @returns {Array<{ label: string, icon: string }>}
 */
export function getTrustBadges() {
  return [
    { label: 'Family Owned Since 1991', icon: '\u2764' },
    { label: 'Largest Selection in the Carolinas', icon: '\u26F0' },
    { label: '700+ Fabric Swatches', icon: '\uD83C\uDFA8' },
    { label: 'Free Shipping $999+', icon: '\uD83D\uDE9A' },
  ];
}

/**
 * Accepted payment methods for footer display.
 * @returns {Array<{ name: string, icon: string }>}
 */
export function getPaymentMethods() {
  return [
    { name: 'visa', icon: 'visa' },
    { name: 'mastercard', icon: 'mastercard' },
    { name: 'amex', icon: 'amex' },
    { name: 'discover', icon: 'discover' },
    { name: 'paypal', icon: 'paypal' },
  ];
}

/**
 * Social media links for footer display.
 * @returns {Array<{ platform: string, url: string, ariaLabel: string }>}
 */
export function getFooterSocialLinks() {
  return [
    { platform: 'facebook', url: 'https://www.facebook.com/carolinafutons', ariaLabel: 'Visit Carolina Futons on Facebook' },
    { platform: 'instagram', url: 'https://www.instagram.com/carolinafutons', ariaLabel: 'Follow Carolina Futons on Instagram' },
    { platform: 'pinterest', url: 'https://www.pinterest.com/carolinafutons', ariaLabel: 'Browse Carolina Futons on Pinterest' },
  ];
}
