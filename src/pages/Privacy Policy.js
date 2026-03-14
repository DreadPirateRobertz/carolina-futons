// Privacy Policy.js - Privacy Policy Page
// Code-driven policy content with accordion sections and TOC navigation
import { initBackToTop, collapseOnMobile } from 'public/mobileHelpers';
import { announce, makeClickable } from 'public/a11yHelpers';
import { initPageSeo } from 'public/pageSeo.js';

$w.onReady(function () {
  initPageSeo('privacyPolicy');
  initPolicyContent();
  initPolicyNavigation();
  try { collapseOnMobile($w, ['#policyTocRepeater']); } catch (e) {}
  try { initBackToTop($w); } catch (e) {}
});

const POLICY_SECTIONS = [
  {
    _id: '1',
    title: 'Information We Collect',
    anchor: '#policyCollect',
    content:
      'When you visit carolinafutons.com or make a purchase, we collect information you provide directly:\n\n' +
      '\u2022 Contact information: name, email address, phone number, shipping and billing address\n' +
      '\u2022 Order information: products purchased, order history, payment method (we do not store full credit card numbers)\n' +
      '\u2022 Account information: login credentials if you create an account\n' +
      '\u2022 Communications: messages sent through our contact form, live chat, or email\n\n' +
      'We also collect information automatically when you browse our site:\n\n' +
      '\u2022 Device and browser type, operating system, IP address\n' +
      '\u2022 Pages visited, time spent on pages, referring URL\n' +
      '\u2022 Cookies and similar tracking technologies for site functionality and analytics',
  },
  {
    _id: '2',
    title: 'How We Use Your Information',
    anchor: '#policyUse',
    content:
      'We use the information we collect to:\n\n' +
      '\u2022 Process and fulfill your orders, including shipping and delivery coordination\n' +
      '\u2022 Communicate about your orders, deliveries, and any issues\n' +
      '\u2022 Provide customer support via phone, email, live chat, or in our Hendersonville showroom\n' +
      '\u2022 Send promotional emails about sales and new products (only with your consent \u2014 you can unsubscribe anytime)\n' +
      '\u2022 Improve our website, product offerings, and customer experience\n' +
      '\u2022 Prevent fraud and maintain site security\n' +
      '\u2022 Comply with legal obligations',
  },
  {
    _id: '3',
    title: 'Information Sharing',
    anchor: '#policySharing',
    content:
      'We do not sell your personal information. We share information only with:\n\n' +
      '\u2022 Shipping carriers: to deliver your furniture (name, address, phone for delivery coordination)\n' +
      '\u2022 Payment processors: to securely process transactions (Wix Payments, PayPal, Afterpay)\n' +
      '\u2022 Analytics services: Google Analytics and similar tools to understand site usage (anonymized data)\n' +
      '\u2022 Email service providers: to send order confirmations and marketing emails you opted into\n\n' +
      'We may also disclose information when required by law or to protect our rights.',
  },
  {
    _id: '4',
    title: 'Cookies & Tracking',
    anchor: '#policyCookies',
    content:
      'Our site uses cookies and similar technologies for:\n\n' +
      '\u2022 Essential functions: shopping cart, checkout, login sessions\n' +
      '\u2022 Analytics: understanding how visitors use our site (Google Analytics)\n' +
      '\u2022 Marketing: showing relevant ads on other platforms (with your consent)\n\n' +
      'You can control cookies through your browser settings. Disabling essential cookies may affect site functionality such as the shopping cart.',
  },
  {
    _id: '5',
    title: 'Your Rights',
    anchor: '#policyRights',
    content:
      'You have the right to:\n\n' +
      '\u2022 Access the personal information we hold about you\n' +
      '\u2022 Request correction of inaccurate information\n' +
      '\u2022 Request deletion of your personal information (subject to legal retention requirements)\n' +
      '\u2022 Opt out of marketing emails at any time using the unsubscribe link in our emails\n' +
      '\u2022 Request a copy of your data in a portable format\n\n' +
      'To exercise any of these rights, contact us at (828) 252-9449 or through our website contact form. We will respond within 30 days.',
  },
  {
    _id: '6',
    title: 'Data Security',
    anchor: '#policySecurity',
    content:
      'We take reasonable measures to protect your personal information, including:\n\n' +
      '\u2022 SSL/TLS encryption for all data transmitted between your browser and our site\n' +
      '\u2022 PCI-compliant payment processing \u2014 we never store full credit card numbers\n' +
      '\u2022 Restricted access to personal information on a need-to-know basis\n\n' +
      'No method of transmission over the internet is completely secure. While we strive to protect your data, we cannot guarantee absolute security.',
  },
  {
    _id: '7',
    title: 'Children\u2019s Privacy',
    anchor: '#policyChildren',
    content:
      'Our site is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us so we can delete it.',
  },
  {
    _id: '8',
    title: 'Changes to This Policy',
    anchor: '#policyChanges',
    content:
      'We may update this privacy policy from time to time. Changes will be posted on this page with an updated effective date. We encourage you to review this policy periodically.',
  },
  {
    _id: '9',
    title: 'Contact Us',
    anchor: '#policyContact',
    content:
      'If you have questions about this privacy policy or our data practices, contact us:\n\n' +
      'Carolina Futons\n' +
      '824 Locust St, Ste 200\n' +
      'Hendersonville, NC 28792\n' +
      'Phone: (828) 252-9449\n' +
      'Website: carolinafutons.com/contact',
  },
];

function initPolicyContent() {
  try {
    // Set page header and last-updated date
    try { $w('#policyTitle').text = 'Privacy Policy'; } catch (e) {}
    try { $w('#policyEffectiveDate').text = 'Effective Date: March 14, 2026'; } catch (e) {}
    try {
      $w('#policyIntro').text =
        'Carolina Futons ("we", "us", "our") respects your privacy. This policy describes how we collect, use, and protect your personal information when you visit our website or make a purchase.';
    } catch (e) {}

    const repeater = $w('#policyRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      $item('#sectionTitle').text = itemData.title;
      $item('#sectionContent').text = itemData.content;

      // Start collapsed
      $item('#sectionContent').collapse();
      $item('#sectionToggle').text = '+';

      try { $item('#sectionTitle').accessibility.role = 'button'; } catch (e) {}
      try { $item('#sectionTitle').accessibility.ariaLabel = `Toggle ${itemData.title}`; } catch (e) {}
      try { $item('#sectionToggle').accessibility.ariaExpanded = false; } catch (e) {}

      $item('#sectionTitle').onClick(() => {
        if ($item('#sectionContent').collapsed) {
          $item('#sectionContent').expand();
          $item('#sectionToggle').text = '\u2212';
          try { $item('#sectionToggle').accessibility.ariaExpanded = true; } catch (e) {}
        } else {
          $item('#sectionContent').collapse();
          $item('#sectionToggle').text = '+';
          try { $item('#sectionToggle').accessibility.ariaExpanded = false; } catch (e) {}
        }
      });
    });
    repeater.data = POLICY_SECTIONS;
  } catch (e) {}
}

function initPolicyNavigation() {
  try {
    const tocRepeater = $w('#policyTocRepeater');
    if (!tocRepeater) return;

    try { tocRepeater.accessibility.ariaLabel = 'Privacy policy table of contents'; } catch (e) {}
    tocRepeater.onItemReady(($item, itemData) => {
      $item('#tocLink').text = itemData.title;
      try { $item('#tocLink').accessibility.ariaLabel = `Jump to ${itemData.title}`; } catch (e) {}
      $item('#tocLink').onClick(() => {
        try {
          $w(itemData.anchor).scrollTo();
        } catch (e) {}
      });
    });
    tocRepeater.data = POLICY_SECTIONS;
  } catch (e) {}
}
