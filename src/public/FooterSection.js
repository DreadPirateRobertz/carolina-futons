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
import { colors, transitions } from 'public/designTokens';

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

    // Column 4: Store Info
    try {
      const info = getStoreInfo();
      try { $w('#footerStoreName').text = info.name; } catch (e) {}
      try { $w('#footerStoreAddress').text = info.address; } catch (e) {}
      try { $w('#footerStorePhone').text = info.phone; } catch (e) {}
      try { $w('#footerStorePhone').accessibility.ariaLabel = `Call ${info.name} at ${info.phone}`; } catch (e) {}
      try {
        const hoursText = info.hours.map(h => `${h.days}: ${h.time}`).join('\n');
        $w('#footerStoreHours').text = hoursText;
      } catch (e) {}
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
    const socialRepeater = $w('#footerSocialRepeater');
    if (!socialRepeater) return;

    const links = getFooterSocialLinks();
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
 * Render a subtle mountain silhouette SVG divider above the footer.
 * Uses espresso token color for the mountain fill against transparent bg.
 * @param {Function} $w - Wix selector function
 */
export function initMountainDivider($w) {
  try {
    const divider = $w('#footerMountainDivider');
    if (!divider) return;
    divider.html = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true" style="display:block;width:100%;height:auto;"><path d="M0,80 L0,50 Q60,30 120,45 Q180,60 240,35 Q320,10 400,30 Q460,45 520,25 Q600,5 680,20 Q740,32 800,15 Q880,0 960,25 Q1020,40 1080,20 Q1160,5 1240,30 Q1320,48 1380,35 Q1420,28 1440,32 L1440,80 Z" fill="${colors.espresso}"/></svg>`;
  } catch (e) {}
}

/**
 * Initialize entire footer — orchestrates all subsections.
 * @param {Function} $w - Wix selector function
 */
export function initFooter($w) {
  initMountainDivider($w);
  initFooterColumns($w);
  initFooterNewsletter($w);
  initFooterSocial($w);
  initFooterTrustBadges($w);
  initFooterPayment($w);
  initFooterCopyright($w);
  initFooterAria($w);
  applyFooterStyles($w);
}
