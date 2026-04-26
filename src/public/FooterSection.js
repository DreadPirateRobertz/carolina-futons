/**
 * FooterSection.js — Footer initialization module
 *
 * Extracts footer logic from masterPage.js into a testable module.
 * 4-column links, newsletter signup (via newsletterService), social icons,
 * trust badges, payment methods, copyright, ARIA landmarks.
 *
 * CF-76b1: Footer redesign
 *
 * @module FooterSection
 */
import { subscribeToNewsletter } from 'backend/newsletterService.web';
import {
  getFooterShopLinks,
  getFooterServiceLinks,
  getFooterAboutLinks,
  getStoreInfo,
  getTrustBadges,
  getPaymentMethods,
  getFooterSocialLinks,
} from 'public/footerContent';
import { trackEvent } from 'public/engagementTracker';
import { fireCustomEvent } from 'public/ga4Tracking';
import { colors, transitions, spacing } from 'public/designTokens.js';
import { getFooterLogoImageUrl } from 'public/carolinaFutonsLogo';

// Safe hex color validator — accepts #RGB, #RRGGBB, #RRGGBBAA only.
const SAFE_COLOR_RE = /^#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{2})?)?$/;

function safeColor(val, fallback) {
  return typeof val === 'string' && SAFE_COLOR_RE.test(val) ? val : fallback;
}

// Default ridge colors — match original static SVG palette.
const DEFAULT_R1 = '#3A2518'; // near (espresso-brown, not a brand token)
const DEFAULT_R2 = '#5C4033'; // mid ridge (not a brand token)
const DEFAULT_R4 = colors.mountainBlue; // far (use token, not hardcoded hex)

/**
 * Build a reactive Blue Ridge mountain silhouette SVG for the footer divider.
 * Three ridge layers shift color based on LivingSkyState.ridgeColors.
 *
 * Layer mapping (SVG paint order, background → foreground):
 *   Layer 1 far   — ridgeColors.r4 at opacity 0.45
 *   Layer 2 mid   — ridgeColors.r2 at opacity 0.65
 *   Layer 3 near  — ridgeColors.r1 at opacity 0.88
 *
 * SVG filter chain:
 *   feTurbulence result="cf-noise" → feDisplacementMap in2="cf-noise"
 *   (result/in2 must be wired or displacement is a no-op)
 *
 * @param {Object} [ridgeColors={}] - Color map from LivingSkyState. Fields: r1, r2, r4.
 * @returns {string} Full SVG markup string.
 */
export function buildFooterMountainSVG(ridgeColors = {}) {
  const r1 = safeColor(ridgeColors.r1, DEFAULT_R1);
  const r2 = safeColor(ridgeColors.r2, DEFAULT_R2);
  const r4 = safeColor(ridgeColors.r4, DEFAULT_R4);

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true" style="display:block;width:100%;height:auto;">'
    + '<defs>'
    + '<filter id="cf-ridge-warp" x="-5%" y="-5%" width="110%" height="110%">'
    + '<feTurbulence type="fractalNoise" baseFrequency="0.04 0.08" numOctaves="3" seed="42" result="cf-noise"/>'
    + '<feDisplacementMap in="SourceGraphic" in2="cf-noise" scale="4" xChannelSelector="R" yChannelSelector="G"/>'
    + '</filter>'
    + '</defs>'
    // Layer 1: far ridge — r4
    + `<path d="M0,80 L0,52 C45,48 72,38 120,34 C168,30 195,40 245,36 C295,32 325,22 378,18 C431,14 462,28 512,24 C562,20 592,12 645,15 C698,18 728,30 778,26 C828,22 858,14 908,18 C958,22 988,32 1038,28 C1088,24 1118,16 1168,20 C1218,24 1248,34 1298,30 C1348,26 1378,18 1418,22 C1432,24 1438,30 1440,34 L1440,80 Z" fill="${r4}" opacity="0.45" filter="url(#cf-ridge-warp)"/>`
    // Layer 2: mid ridge — r2
    + `<path d="M0,80 L0,56 C38,52 62,42 108,38 C154,34 182,46 232,42 C282,38 312,26 365,24 C418,22 448,34 498,30 C548,26 578,18 632,20 C686,22 715,34 765,30 C815,26 845,18 898,22 C951,26 982,36 1032,32 C1082,28 1112,20 1162,24 C1212,28 1242,38 1292,34 C1342,30 1372,22 1412,26 C1430,28 1438,34 1440,38 L1440,80 Z" fill="${r2}" opacity="0.65" filter="url(#cf-ridge-warp)"/>`
    // Layer 3: near ridge — r1
    + `<path d="M0,80 L0,60 C42,56 68,48 118,44 C168,40 198,50 248,48 C298,46 328,36 382,34 C436,32 465,42 515,40 C565,38 598,28 652,30 C706,32 735,42 785,40 C835,38 868,30 918,32 C968,34 998,44 1048,42 C1098,40 1128,32 1178,34 C1228,36 1258,44 1308,42 C1358,40 1388,34 1422,36 C1434,37 1438,42 1440,44 L1440,80 Z" fill="${r1}" opacity="0.88" filter="url(#cf-ridge-warp)"/>`
    + '<g class="birds" opacity="0.3">'
    + '<path d="M280,18 C284,14 288,12 292,15 C296,12 300,14 304,18" fill="none" stroke="#3A2518" stroke-width="1" stroke-linecap="round"/>'
    + '<path d="M302,15 C305,12 308,11 311,14 C314,11 317,12 320,15" fill="none" stroke="#3A2518" stroke-width="0.8" stroke-linecap="round"/>'
    + '<path d="M820,14 C824,10 828,9 832,12 C836,9 840,10 844,14" fill="none" stroke="#3A2518" stroke-width="0.9" stroke-linecap="round"/>'
    + '<path d="M1120,20 C1123,17 1126,16 1129,18 C1132,16 1135,17 1138,20" fill="none" stroke="#3A2518" stroke-width="0.7" stroke-linecap="round"/>'
    + '</g>'
    + '<g class="pine-trees" opacity="0.5">'
    + '<rect x="420" y="38" width="3" height="14" fill="#3A2518" opacity="0.6" rx="1"/>'
    + '<path d="M412,42 C416,34 419,30 422,26 C425,30 428,34 432,42" fill="#5C4033" opacity="0.4"/>'
    + '<path d="M414,39 C417,33 420,29 422,25 C424,29 427,33 430,39" fill="#5C4033" opacity="0.5"/>'
    + '<rect x="980" y="40" width="2.5" height="12" fill="#3A2518" opacity="0.5" rx="1"/>'
    + '<path d="M973,43 C976,37 979,33 981,30 C983,33 986,37 989,43" fill="#5C4033" opacity="0.35"/>'
    + '<path d="M975,41 C978,35 980,32 981,29 C982,32 985,35 988,41" fill="#5C4033" opacity="0.45"/>'
    + '</g>'
    + '<g class="wildflowers" opacity="0.4">'
    + '<line x1="160" y1="62" x2="160" y2="56" stroke="#5C4033" stroke-width="0.8" opacity="0.5"/>'
    + '<circle cx="160" cy="55" r="1.8" fill="#E8845C" opacity="0.55"/>'
    + '<line x1="175" y1="63" x2="175" y2="58" stroke="#5C4033" stroke-width="0.7" opacity="0.4"/>'
    + '<circle cx="175" cy="57" r="1.5" fill="#F2A882" opacity="0.5"/>'
    + '<line x1="650" y1="60" x2="650" y2="54" stroke="#5C4033" stroke-width="0.8" opacity="0.5"/>'
    + '<circle cx="650" cy="53" r="1.8" fill="#E8845C" opacity="0.5"/>'
    + '<line x1="1100" y1="61" x2="1100" y2="56" stroke="#5C4033" stroke-width="0.7" opacity="0.45"/>'
    + '<circle cx="1100" cy="55" r="1.5" fill="#F2A882" opacity="0.5"/>'
    + '</g>'
    + '</svg>';
}

/**
 * Initialize the 4-column link grid and store info section.
 * @param {Function} $w - Wix selector function
 */
export function initFooterColumns($w) {
  try {
    // Column 1: Shop links
    try {
      const shopRepeater = $w('#footerShopRepeater');
      if (shopRepeater) {
        const links = getFooterShopLinks();
        shopRepeater.data = links.map((l, i) => ({ ...l, _id: `shop-${i}` }));
        shopRepeater.onItemReady(($item, itemData) => {
          try { $item('#shopLink').text = itemData.label; } catch (e) {}
          try { $item('#shopLink').accessibility.ariaLabel = `Shop ${itemData.label}`; } catch (e) {}
          try {
            $item('#shopLink').onClick(() => {
              import('wix-location-frontend').then(({ to }) => to(itemData.path));
            });
          } catch (e) {}
        });
      }
    } catch (e) {}

    // Column 2: Customer Service links
    try {
      const serviceRepeater = $w('#footerServiceRepeater');
      if (serviceRepeater) {
        const links = getFooterServiceLinks();
        serviceRepeater.data = links.map((l, i) => ({ ...l, _id: `svc-${i}` }));
        serviceRepeater.onItemReady(($item, itemData) => {
          try { $item('#serviceLink').text = itemData.label; } catch (e) {}
          try { $item('#serviceLink').accessibility.ariaLabel = itemData.label; } catch (e) {}
          try {
            $item('#serviceLink').onClick(() => {
              import('wix-location-frontend').then(({ to }) => to(itemData.path));
            });
          } catch (e) {}
        });
      }
    } catch (e) {}

    // Column 3: About Us links
    try {
      const aboutRepeater = $w('#footerAboutRepeater');
      if (aboutRepeater) {
        const links = getFooterAboutLinks();
        aboutRepeater.data = links.map((l, i) => ({ ...l, _id: `about-${i}` }));
        aboutRepeater.onItemReady(($item, itemData) => {
          try { $item('#aboutLink').text = itemData.label; } catch (e) {}
          try { $item('#aboutLink').accessibility.ariaLabel = itemData.label; } catch (e) {}
          try {
            $item('#aboutLink').onClick(() => {
              import('wix-location-frontend').then(({ to }) => to(itemData.path));
            });
          } catch (e) {}
        });
      }
    } catch (e) {}

    // Column 4: Store Info (wire both legacy #footerStore* and BUILD-SPEC #footer* IDs)
    try {
      const info = getStoreInfo();
      const phoneLabel = `Call ${info.name} at ${info.phone}`;
      const hoursText = info.hours.map(h => `${h.days}: ${h.time}`).join('\n');

      try { $w('#footerStoreName').text = info.name; } catch (e) {}
      try { $w('#footerStoreAddress').text = info.address; } catch (e) {}
      try { $w('#footerStorePhone').text = info.phone; } catch (e) {}
      try { $w('#footerStorePhone').accessibility.ariaLabel = phoneLabel; } catch (e) {}
      try { $w('#footerStoreHours').text = hoursText; } catch (e) {}

      // BUILD-SPEC element IDs
      try { $w('#footerPhone').text = info.phone; } catch (e) {}
      try { $w('#footerPhone').accessibility.ariaLabel = phoneLabel; } catch (e) {}
      try { $w('#footerAddress').text = info.address; } catch (e) {}
      try { $w('#footerHours').text = hoursText; } catch (e) {}
    } catch (e) {}
  } catch (e) {}
}

/**
 * Initialize newsletter signup form wired to newsletterService.
 * @param {Function} $w - Wix selector function
 */
export function initFooterNewsletter($w) {
  try {
    const emailInput = $w('#footerEmailInput');
    const submitBtn = $w('#footerEmailSubmit');
    if (!emailInput || !submitBtn) return;

    try { emailInput.accessibility.ariaLabel = 'Enter your email for newsletter'; } catch (e) {}
    try { submitBtn.accessibility.ariaLabel = 'Subscribe to newsletter'; } catch (e) {}

    submitBtn.onClick(async () => {
      const email = emailInput.value?.trim();
      if (!email || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
        try { $w('#footerEmailError').text = 'Please enter a valid email'; } catch (e) {}
        try { $w('#footerEmailError').show(); } catch (e) {}
        return;
      }

      try { $w('#footerEmailError').hide(); } catch (e) {}
      submitBtn.disable();
      submitBtn.label = 'Subscribing...';

      try {
        const result = await subscribeToNewsletter(email, { source: 'footer_newsletter' });

        if (result && result.success) {
          emailInput.value = '';
          submitBtn.label = 'Subscribed!';
          try { $w('#footerEmailSuccess').show('fade', { duration: 300 }); } catch (e) {}
          trackEvent('newsletter_signup', { source: 'footer' });
          fireCustomEvent('newsletter_signup', { source: 'footer' });
        } else {
          try { $w('#footerEmailError').text = (result && result.message) || 'Subscription failed. Please try again.'; } catch (e) {}
          try { $w('#footerEmailError').show(); } catch (e) {}
          submitBtn.enable();
          submitBtn.label = 'Subscribe';
        }
      } catch (err) {
        submitBtn.enable();
        submitBtn.label = 'Subscribe';
      }
    });
  } catch (e) {}
}

/**
 * Initialize social media links repeater.
 * @param {Function} $w - Wix selector function
 */
export function initFooterSocial($w) {
  try {
    const links = getFooterSocialLinks();

    // Fix native SocialBar links (http → https, set canonical URLs).
    fixTemplateSocialBar($w, links);
  } catch (e) {}
}

/**
 * Fix the template's built-in social bar: upgrade http→https and set correct URLs.
 * Works with Wix's native SocialBar element which exposes a .links array property.
 * @param {Function} $w - Wix selector function
 * @param {Array} socialLinks - Canonical social link data from footerContent
 */
function fixTemplateSocialBar($w, socialLinks) {
  try {
    // Wix social bars are queried by type selector
    const socialBars = $w('SocialBar');
    if (!socialBars || socialBars.length === 0) return;

    for (let i = 0; i < socialBars.length; i++) {
      try {
        const bar = socialBars[i];
        // Wix SocialBar has a .links property (array of {url, icon, label})
        if (!bar.links) continue;

        const updatedLinks = bar.links.map(link => {
          const url = (link.url || '').toLowerCase();
          // Fix http → https
          let fixedUrl = link.url;
          if (url.startsWith('http://')) {
            fixedUrl = 'https://' + link.url.substring(7);
          }
          // Match to our canonical URLs
          for (const canonical of socialLinks) {
            if (url.includes(canonical.platform)) {
              fixedUrl = canonical.url;
              break;
            }
          }
          return { ...link, url: fixedUrl };
        });

        bar.links = updatedLinks;
      } catch (_) {}
    }
  } catch (e) {}
}

/**
 * Initialize trust badges repeater.
 * @param {Function} $w - Wix selector function
 */
export function initFooterTrustBadges($w) {
  try {
    const badgeRepeater = $w('#footerBadgeRepeater');
    if (!badgeRepeater) return;

    const badges = getTrustBadges();
    badgeRepeater.data = badges.map((b, i) => ({ ...b, _id: `badge-${i}` }));
    badgeRepeater.onItemReady(($item, itemData) => {
      try { $item('#badgeIcon').text = itemData.icon; } catch (e) {}
      try { $item('#badgeLabel').text = itemData.label; } catch (e) {}
      try { $item('#badgeLabel').accessibility.ariaLabel = itemData.label; } catch (e) {}
    });
  } catch (e) {}
}

/**
 * Initialize payment method icons repeater.
 * @param {Function} $w - Wix selector function
 */
export function initFooterPayment($w) {
  try {
    const paymentRepeater = $w('#footerPaymentRepeater');
    if (!paymentRepeater) return;

    const methods = getPaymentMethods();
    paymentRepeater.data = methods.map((m, i) => ({ ...m, _id: `pay-${i}` }));
    paymentRepeater.onItemReady(($item, itemData) => {
      try { $item('#paymentIcon').text = itemData.icon; } catch (e) {}
      try { $item('#paymentIcon').accessibility.ariaLabel = `We accept ${itemData.name}`; } catch (e) {}
    });
  } catch (e) {}
}

/**
 * Initialize copyright line with current year.
 * @param {Function} $w - Wix selector function
 */
export function initFooterCopyright($w) {
  const year = new Date().getFullYear();
  const copyrightText = `\u00A9 ${year} Carolina Futons. All rights reserved.`;

  try { $w('#footerCopyright').text = copyrightText; } catch (e) {}

  // Fallback: replace template tagline with copyright if the dedicated element
  // doesn't exist yet. The Tera template ships with a tagline that creates
  // duplicate bottom text once #footerCopyright is added.
  try {
    const allTexts = $w('Text');
    for (let i = 0; i < allTexts.length; i++) {
      try {
        const el = allTexts[i];
        if (el.text && el.text.includes('Where Comfort Meets Design')) {
          el.text = copyrightText;
        }
      } catch (_) {}
    }
  } catch (e) {}
}

/**
 * Set ARIA contentinfo landmark on footer.
 * @param {Function} $w - Wix selector function
 */
export function initFooterAria($w) {
  try {
    $w('#siteFooter').accessibility.role = 'contentinfo';
  } catch (e) {}
}

/**
 * Apply brand token colors to all footer elements.
 * background → espresso, text → sandLight, links → mountainBlue/coral hover,
 * newsletter input → offWhite bg/espresso text, social icons → sandLight/coral hover.
 * @param {Function} $w - Wix selector function
 */
export function applyFooterStyles($w) {
  try {
    // Footer background
    try { $w('#siteFooter').style.backgroundColor = colors.espresso; } catch (e) {}

    // Heading colors
    const headings = ['#footerShopHeading', '#footerServiceHeading', '#footerAboutHeading', '#footerInfoHeading'];
    headings.forEach((sel) => {
      try { $w(sel).style.color = colors.sandLight; } catch (e) {}
    });

    // Store info text
    const infoEls = ['#footerStoreName', '#footerStoreAddress', '#footerStorePhone', '#footerStoreHours'];
    infoEls.forEach((sel) => {
      try { $w(sel).style.color = colors.sandLight; } catch (e) {}
    });

    // Copyright text
    try { $w('#footerCopyright').style.color = colors.sandLight; } catch (e) {}

    // Newsletter input: offWhite bg, espresso text
    try {
      $w('#footerEmailInput').style.backgroundColor = colors.offWhite;
      $w('#footerEmailInput').style.color = colors.espresso;
    } catch (e) {}

    // Newsletter submit button: coral
    try { $w('#footerEmailSubmit').style.backgroundColor = colors.sunsetCoral; } catch (e) {}
    try { $w('#footerEmailSubmit').style.color = colors.espresso; } catch (e) {}

    // Link repeaters: mountainBlue default, coral on hover
    const linkRepeaters = [
      { repeater: '#footerShopRepeater', link: '#shopLink' },
      { repeater: '#footerServiceRepeater', link: '#serviceLink' },
      { repeater: '#footerAboutRepeater', link: '#aboutLink' },
    ];
    linkRepeaters.forEach(({ repeater, link }) => {
      try {
        $w(repeater).onItemReady(($item) => {
          try {
            $item(link).style.color = colors.mountainBlue;
            $item(link).onMouseIn(() => {
              try { $item(link).style.color = colors.sunsetCoral; } catch (e) {}
            });
            $item(link).onMouseOut(() => {
              try { $item(link).style.color = colors.mountainBlue; } catch (e) {}
            });
          } catch (e) {}
        });
      } catch (e) {}
    });

    // Social bar styling is handled by the native Wix SocialBar widget
  } catch (e) {}
}

/**
 * Render the footer mountain divider and subscribe to LivingSkyState updates.
 * Sets initial SVG via buildFooterMountainSVG with design-token defaults, then
 * wires #livingSkyFrame onMessage to rerender with state-derived ridge colors.
 * Consumes e.data directly as LivingSkyState — no type field check (LivingSkyState
 * has no .type property; a type guard would always block the update).
 * @param {Function} $w - Wix selector function
 */
export function initMountainDivider($w) {
  try {
    const divider = $w('#footerMountainDivider');
    if (!divider) return;
    divider.html = buildFooterMountainSVG({
      r1: colors.espresso,
      r2: colors.mountainBlue,
      r4: colors.mountainBlue,
    });

    // Subscribe to LivingSkyState — only wrap the selector call; callback errors surface
    let livingSkyFrame;
    try { livingSkyFrame = $w('#livingSkyFrame'); } catch (_) { /* not on this page */ }
    if (livingSkyFrame && typeof livingSkyFrame.onMessage === 'function') {
      livingSkyFrame.onMessage((event) => {
        const state = event && event.data;
        if (!state) return;
        const rc = state.ridgeColors || {};
        divider.html = buildFooterMountainSVG({
          r1: rc.r1,
          r2: rc.r2,
          r4: state.skyColors && state.skyColors[0],
        });
      });
    }
  } catch (e) { console.warn('[FooterSection] initMountainDivider failed:', e); }
}

/**
 * Re-render the footer mountain divider using live ridge colors from LivingSkyState.
 * Called on every livingSkyFrame message to keep the divider in sync with the sky.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object|null} state - LivingSkyState: { ridgeColors: {r1,r2,r4,...}, ... }
 */
export function initMountainDividerWithSkyWiring($w, state) {
  try {
    const divider = $w('#footerMountainDivider');
    if (!divider) return;
    const ridgeColors = (state && state.ridgeColors) || {};
    divider.html = buildFooterMountainSVG(ridgeColors);
  } catch (e) {}
}

/**
 * Initialize footer logo with navigation and ARIA.
 * @param {Function} $w - Wix selector function
 */
export function initFooterLogo($w) {
  try {
    const logo = $w('#footerLogo');
    if (!logo) return;

    // Replace template logo with real CF_SQUARE-blue.jpg from production
    try { logo.src = getFooterLogoImageUrl(); } catch (e) {}
    try { logo.alt = 'Carolina Futons'; } catch (e) {}
    try { logo.accessibility.ariaLabel = 'Carolina Futons - Go to homepage'; } catch (e) {}

    logo.onClick(() => {
      import('wix-location-frontend').then(({ to }) => to('/'));
    });
  } catch (e) {}
}

/**
 * Fallback: scan all text elements for wrong template contact info and replace
 * with correct CF data. Works even when editor nicknames aren't assigned.
 * CF-1zxp: Footer wrong city/hours
 * @param {Function} $w - Wix selector function
 */
export function fixFooterContactFallback($w) {
  try {
    const info = getStoreInfo();
    const hoursText = info.hours.map(h => `${h.days}: ${h.time}`).join('\n');

    // Known wrong values from the tera template
    const replacements = [
      { wrong: '(828) 327-8030', correct: info.phone },
      { wrong: 'Hickory, NC', correct: info.address },
      { wrong: 'Monday-Friday 9:00am - 5:00pm EST', correct: hoursText },
    ];

    const allTexts = $w('Text');
    for (let i = 0; i < allTexts.length; i++) {
      try {
        const el = allTexts[i];
        const txt = el.text;
        if (!txt) continue;
        for (const r of replacements) {
          if (txt.includes(r.wrong)) {
            el.text = txt.replace(r.wrong, r.correct);
          }
        }
      } catch (_) {}
    }
  } catch (_) {}
}

/**
 * Initialize entire footer — orchestrates all subsections.
 * @param {Function} $w - Wix selector function
 */
export function initFooter($w) {
  initMountainDivider($w);
  initFooterLogo($w);
  initFooterColumns($w);
  fixFooterContactFallback($w);
  initFooterNewsletter($w);
  initFooterSocial($w);
  initFooterTrustBadges($w);
  initFooterPayment($w);
  initFooterCopyright($w);
  initFooterAria($w);
  applyFooterStyles($w);
}
