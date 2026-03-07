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

// Static SVG inner content from pipeline output (footer-mountain-divider.optimized.svg).
// This is a literal string — no template interpolation, no programmatic generation.
// All colors verified against sharedTokens.js by pipeline token injection step (31 replacements).
// Source: src/assets/illustrations/footer-mountain-divider.svg
// eslint-disable-next-line
const MOUNTAIN_DIVIDER_CONTENT = '<defs><filter id="haze-footer"><feGaussianBlur stdDeviation="2"/></filter><linearGradient id="footer-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F2E8D5" stop-opacity="0"/><stop offset="30%" stop-color="#E8D5B7" stop-opacity="0.15"/><stop offset="60%" stop-color="#B8D4E3" stop-opacity="0.08"/><stop offset="100%" stop-color="#3A2518" stop-opacity="0.05"/></linearGradient></defs><rect width="1440" height="80" fill="url(#footer-sky)"/><path d="M0,80 L0,52 C45,48 72,38 120,34 C168,30 195,40 245,36 C295,32 325,22 378,18 C431,14 462,28 512,24 C562,20 592,12 645,15 C698,18 728,30 778,26 C828,22 858,14 908,18 C958,22 988,32 1038,28 C1088,24 1118,16 1168,20 C1218,24 1248,34 1298,30 C1348,26 1378,18 1418,22 C1432,24 1438,30 1440,34 L1440,80 Z" fill="#5B8FA8" opacity="0.12"/><rect x="0" y="20" width="1440" height="18" fill="#B8D4E3" opacity="0.06" filter="url(#haze-footer)"/><path d="M0,80 L0,56 C38,52 62,42 108,38 C154,34 182,46 232,42 C282,38 312,26 365,24 C418,22 448,34 498,30 C548,26 578,18 632,20 C686,22 715,34 765,30 C815,26 845,18 898,22 C951,26 982,36 1032,32 C1082,28 1112,20 1162,24 C1212,28 1242,38 1292,34 C1342,30 1372,22 1412,26 C1430,28 1438,34 1440,38 L1440,80 Z" fill="#5C4033" opacity="0.25"/><path d="M0,80 L0,60 C42,56 68,48 118,44 C168,40 198,50 248,48 C298,46 328,36 382,34 C436,32 465,42 515,40 C565,38 598,28 652,30 C706,32 735,42 785,40 C835,38 868,30 918,32 C968,34 998,44 1048,42 C1098,40 1128,32 1178,34 C1228,36 1258,44 1308,42 C1358,40 1388,34 1422,36 C1434,37 1438,42 1440,44 L1440,80 Z" fill="#3A2518" opacity="0.42"/><rect x="0" y="40" width="1440" height="12" fill="#B8D4E3" opacity="0.04" filter="url(#haze-footer)"/><path d="M0,80 L0,62 C35,59 55,52 105,50 C155,48 185,55 238,53 C291,51 322,44 375,42 C428,40 458,48 508,46 C558,44 592,38 645,40 C698,42 728,50 778,48 C828,46 862,40 912,42 C962,44 992,52 1042,50 C1092,48 1122,42 1172,44 C1222,46 1252,52 1302,50 C1352,48 1382,44 1418,46 C1432,47 1438,52 1440,54 L1440,80 Z" fill="#3A2518" opacity="0.65"/><path d="M0,80 L0,68 C40,66 65,60 115,58 C165,56 195,62 248,61 C301,60 332,54 385,53 C438,52 468,58 518,57 C568,56 602,52 652,53 C702,54 732,59 782,58 C832,57 862,53 912,54 C962,55 992,60 1042,59 C1092,58 1122,54 1172,55 C1222,56 1252,60 1302,59 C1352,58 1382,55 1420,56 C1434,57 1438,60 1440,62 L1440,80 Z" fill="#3A2518" opacity="0.85"/><g class="birds" opacity="0.3"><path d="M280,18 C284,14 288,12 292,15 C296,12 300,14 304,18" fill="none" stroke="#3A2518" stroke-width="1" stroke-linecap="round"/><path d="M302,15 C305,12 308,11 311,14 C314,11 317,12 320,15" fill="none" stroke="#3A2518" stroke-width="0.8" stroke-linecap="round"/><path d="M820,14 C824,10 828,9 832,12 C836,9 840,10 844,14" fill="none" stroke="#3A2518" stroke-width="0.9" stroke-linecap="round"/><path d="M1120,20 C1123,17 1126,16 1129,18 C1132,16 1135,17 1138,20" fill="none" stroke="#3A2518" stroke-width="0.7" stroke-linecap="round"/></g><g class="pine-trees" opacity="0.5"><rect x="420" y="38" width="3" height="14" fill="#3A2518" opacity="0.6" rx="1"/><path d="M412,42 C416,34 419,30 422,26 C425,30 428,34 432,42" fill="#5C4033" opacity="0.4"/><path d="M414,39 C417,33 420,29 422,25 C424,29 427,33 430,39" fill="#5C4033" opacity="0.5"/><rect x="980" y="40" width="2.5" height="12" fill="#3A2518" opacity="0.5" rx="1"/><path d="M973,43 C976,37 979,33 981,30 C983,33 986,37 989,43" fill="#5C4033" opacity="0.35"/><path d="M975,41 C978,35 980,32 981,29 C982,32 985,35 988,41" fill="#5C4033" opacity="0.45"/></g><g class="wildflowers" opacity="0.4"><line x1="160" y1="62" x2="160" y2="56" stroke="#5C4033" stroke-width="0.8" opacity="0.5"/><circle cx="160" cy="55" r="1.8" fill="#E8845C" opacity="0.55"/><line x1="175" y1="63" x2="175" y2="58" stroke="#5C4033" stroke-width="0.7" opacity="0.4"/><circle cx="175" cy="57" r="1.5" fill="#F2A882" opacity="0.5"/><line x1="188" y1="64" x2="188" y2="59" stroke="#5C4033" stroke-width="0.6" opacity="0.35"/><circle cx="188" cy="58" r="1.2" fill="#E8D5B7" opacity="0.45"/><line x1="650" y1="60" x2="650" y2="54" stroke="#5C4033" stroke-width="0.8" opacity="0.5"/><circle cx="650" cy="53" r="1.8" fill="#E8845C" opacity="0.5"/><line x1="665" y1="61" x2="665" y2="56" stroke="#5C4033" stroke-width="0.7" opacity="0.4"/><circle cx="665" cy="55" r="1.5" fill="#A8CCD8" opacity="0.45"/><line x1="1100" y1="61" x2="1100" y2="56" stroke="#5C4033" stroke-width="0.7" opacity="0.45"/><circle cx="1100" cy="55" r="1.5" fill="#F2A882" opacity="0.5"/><line x1="1115" y1="62" x2="1115" y2="57" stroke="#5C4033" stroke-width="0.6" opacity="0.35"/><circle cx="1115" cy="56" r="1.2" fill="#E8D5B7" opacity="0.4"/></g>';

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
          try { $item('#footerLink').text = itemData.label; } catch (e) {}
          try { $item('#footerLink').accessibility.ariaLabel = `Shop ${itemData.label}`; } catch (e) {}
          try {
            $item('#footerLink').onClick(() => {
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
          try { $item('#footerLink').text = itemData.label; } catch (e) {}
          try { $item('#footerLink').accessibility.ariaLabel = itemData.label; } catch (e) {}
          try {
            $item('#footerLink').onClick(() => {
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
          try { $item('#footerLink').text = itemData.label; } catch (e) {}
          try { $item('#footerLink').accessibility.ariaLabel = itemData.label; } catch (e) {}
          try {
            $item('#footerLink').onClick(() => {
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

    // Repeater-based social icons (legacy pattern)
    try {
      const socialRepeater = $w('#footerSocialRepeater');
      if (socialRepeater) {
        socialRepeater.data = links.map((l, i) => ({ ...l, _id: `social-${i}` }));
        socialRepeater.onItemReady(($item, itemData) => {
          try { $item('#socialIcon').text = itemData.platform; } catch (e) {}
          try { $item('#socialIcon').accessibility.ariaLabel = itemData.ariaLabel; } catch (e) {}
          try {
            $item('#socialIcon').onClick(() => {
              if (typeof window !== 'undefined') window.open(itemData.url, '_blank');
            });
          } catch (e) {}
        });
      }
    } catch (e) {}

    // Individual BUILD-SPEC social button elements
    const socialMap = {
      '#socialFacebook': links.find(l => l.platform === 'facebook'),
      '#socialInstagram': links.find(l => l.platform === 'instagram'),
      '#socialPinterest': links.find(l => l.platform === 'pinterest'),
    };

    Object.entries(socialMap).forEach(([selector, linkData]) => {
      if (!linkData) return;
      try {
        const el = $w(selector);
        if (!el) return;
        try { el.accessibility.ariaLabel = linkData.ariaLabel; } catch (e) {}
        el.onClick(() => {
          if (typeof window !== 'undefined') window.open(linkData.url, '_blank');
        });
      } catch (e) {}
    });
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
  try {
    const year = new Date().getFullYear();
    $w('#footerCopyright').text = `\u00A9 ${year} Carolina Futons. All rights reserved.`;
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

    // Link repeaters: mountainBlue default, coral on hover
    const linkRepeaters = ['#footerShopRepeater', '#footerServiceRepeater', '#footerAboutRepeater'];
    linkRepeaters.forEach((sel) => {
      try {
        $w(sel).onItemReady(($item) => {
          try {
            $item('#footerLink').style.color = colors.mountainBlue;
            $item('#footerLink').onMouseIn(() => {
              try { $item('#footerLink').style.color = colors.sunsetCoral; } catch (e) {}
            });
            $item('#footerLink').onMouseOut(() => {
              try { $item('#footerLink').style.color = colors.mountainBlue; } catch (e) {}
            });
          } catch (e) {}
        });
      } catch (e) {}
    });

    // Social icons: sandLight default, coral on hover
    try {
      $w('#footerSocialRepeater').onItemReady(($item) => {
        try {
          $item('#socialIcon').style.color = colors.sandLight;
          $item('#socialIcon').onMouseIn(() => {
            try { $item('#socialIcon').style.color = colors.sunsetCoral; } catch (e) {}
          });
          $item('#socialIcon').onMouseOut(() => {
            try { $item('#socialIcon').style.color = colors.sandLight; } catch (e) {}
          });
        } catch (e) {}
      });
    } catch (e) {}
  } catch (e) {}
}

/**
 * Render a layered Blue Ridge mountain silhouette SVG divider above the footer.
 * Static SVG content from Figma-first pipeline — 5 ridgeline layers with haze,
 * birds, pine trees, and wildflowers. Matches header skyline aesthetic.
 * @param {Function} $w - Wix selector function
 */
export function initMountainDivider($w) {
  try {
    const divider = $w('#footerMountainDivider');
    if (!divider) return;
    divider.html = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true" style="display:block;width:100%;height:auto;">' + MOUNTAIN_DIVIDER_CONTENT + '</svg>';
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

    try { logo.alt = 'Carolina Futons'; } catch (e) {}
    try { logo.accessibility.ariaLabel = 'Carolina Futons - Go to homepage'; } catch (e) {}

    logo.onClick(() => {
      import('wix-location-frontend').then(({ to }) => to('/'));
    });
  } catch (e) {}
}

/**
 * Initialize entire footer — orchestrates all subsections.
 * @param {Function} $w - Wix selector function
 */
export function initFooter($w) {
  initMountainDivider($w);
  initFooterLogo($w);
  initFooterColumns($w);
  initFooterNewsletter($w);
  initFooterSocial($w);
  initFooterTrustBadges($w);
  initFooterPayment($w);
  initFooterCopyright($w);
  initFooterAria($w);
  applyFooterStyles($w);
}
