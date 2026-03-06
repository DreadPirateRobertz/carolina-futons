// Newsletter.js - Newsletter & Email Signup Landing Page
// Dedicated landing page for email capture from ad campaigns, social media,
// and promotional links. Integrates with Wix CRM and GA4 tracking.
import { trackEvent, trackNewsletterSignup } from 'public/engagementTracker';
import { fireCustomEvent } from 'public/ga4Tracking';
import { initBackToTop } from 'public/mobileHelpers';
import { announce } from 'public/a11yHelpers';

$w.onReady(function () {
  initHero();
  initSignupForm();
  initBenefits();
  initSocialLinks();
  initBackToTop($w);
  trackEvent('page_view', { page: 'newsletter' });
  fireCustomEvent('page_view', { page: 'newsletter' });
});

// ── Hero Section ──────────────────────────────────────────────────

function initHero() {
  try {
    $w('#newsletterHeroTitle').text = 'Stay in the Loop';
    $w('#newsletterHeroSubtitle').text =
      'Get exclusive deals, new product alerts, and furniture tips ' +
      'delivered to your inbox. Plus, enjoy 10% off your first order.';
  } catch (e) {}
}

// ── Signup Form ──────────────────────────────────────────────────

function initSignupForm() {
  try {
    const emailInput = $w('#nlEmailInput');
    const nameInput = $w('#nlNameInput');
    const submitBtn = $w('#nlSubmitBtn');
    const successMsg = $w('#nlSuccessMessage');
    const errorMsg = $w('#nlErrorMessage');

    // ARIA labels
    try { emailInput.accessibility.ariaLabel = 'Your email address'; } catch (e) {}
    try { emailInput.accessibility.ariaRequired = true; } catch (e) {}
    try { nameInput.accessibility.ariaLabel = 'Your first name (optional)'; } catch (e) {}
    try { submitBtn.accessibility.ariaLabel = 'Subscribe to newsletter'; } catch (e) {}

    // Placeholder text
    try { emailInput.placeholder = 'your@email.com'; } catch (e) {}
    try { nameInput.placeholder = 'First name (optional)'; } catch (e) {}

    try { successMsg.hide(); } catch (e) {}
    try { errorMsg.hide(); } catch (e) {}

    submitBtn.onClick(async () => {
      const email = emailInput.value?.trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        try {
          errorMsg.text = 'Please enter a valid email address.';
          errorMsg.show();
          announce($w, 'Please enter a valid email address');
        } catch (e) {}
        return;
      }

      try { errorMsg.hide(); } catch (e) {}
      submitBtn.disable();
      submitBtn.label = 'Subscribing...';

      try {
        const firstName = nameInput.value?.trim() || '';
        const { contacts } = await import('wix-crm-frontend');

        const contactInfo = { emails: [email], labelKeys: ['custom.newsletter'] };
        if (firstName) {
          contactInfo.name = { first: firstName };
        }

        await contacts.appendOrCreateContact(contactInfo);

        // Track in both engagement system and GA4/Meta Pixel
        trackNewsletterSignup('newsletter_page');
        fireCustomEvent('newsletter_signup', {
          source: 'newsletter_page',
          value: 0,
          currency: 'USD',
        });

        // Show success state
        try { emailInput.hide(); } catch (e) {}
        try { nameInput.hide(); } catch (e) {}
        submitBtn.hide();
        successMsg.text =
          'You\'re in! Check your inbox for your 10% welcome discount. ' +
          'Use code WELCOME10 at checkout.';
        successMsg.show('fade', { duration: 300 });
        announce($w, 'Successfully subscribed to newsletter');
      } catch (err) {
        console.error('Newsletter signup error:', err);
        submitBtn.enable();
        submitBtn.label = 'Subscribe';
        try {
          errorMsg.text = 'Something went wrong. Please try again.';
          errorMsg.show();
        } catch (e) {}
      }
    });
  } catch (e) {}
}

// ── Benefits Section ──────────────────────────────────────────────

function initBenefits() {
  try {
    const benefits = [
      { _id: '1', title: 'Exclusive Deals', description: 'Subscriber-only discounts and early access to sales' },
      { _id: '2', title: 'New Arrivals', description: 'Be the first to know when new products drop' },
      { _id: '3', title: 'Furniture Tips', description: 'Care guides, styling ideas, and space-saving inspiration' },
      { _id: '4', title: 'No Spam', description: 'We send 2-4 emails per month — quality over quantity' },
    ];

    const repeater = $w('#benefitsRepeater');
    if (!repeater) return;

    repeater.data = benefits;
    repeater.onItemReady(($item, itemData) => {
      try { $item('#benefitTitle').text = itemData.title; } catch (e) {}
      try { $item('#benefitDescription').text = itemData.description; } catch (e) {}
    });
  } catch (e) {}
}

// ── Social Links ──────────────────────────────────────────────────

function initSocialLinks() {
  try {
    try { $w('#nlSocialTitle').text = 'Follow Us'; } catch (e) {}

    const links = [
      { btnId: '#nlPinterestBtn', url: 'https://pinterest.com/carolinafutons', label: 'Follow us on Pinterest' },
      { btnId: '#nlInstagramBtn', url: 'https://instagram.com/carolinafutons', label: 'Follow us on Instagram' },
      { btnId: '#nlFacebookBtn', url: 'https://facebook.com/carolinafutons', label: 'Follow us on Facebook' },
    ];

    for (const link of links) {
      try {
        const btn = $w(link.btnId);
        if (!btn) continue;
        try { btn.accessibility.ariaLabel = link.label; } catch (e) {}
        btn.onClick(() => {
          trackEvent('social_follow', { platform: link.label });
          import('wix-window-frontend').then(({ openUrl }) => openUrl(link.url));
        });
      } catch (e) {}
    }
  } catch (e) {}
}
