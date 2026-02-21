// Thank You Page.js - Order Confirmation & Post-Purchase Engagement
// Personalized order summary, Brenda's message, social sharing, newsletter,
// delivery timeline, referral prompt, and product suggestions
import { getFeaturedProducts } from 'backend/productRecommendations.web';
import { trackPurchaseComplete, trackSocialShare, trackNewsletterSignup, trackReferralAction } from 'public/engagementTracker';
import { colors, typography } from 'public/designTokens.js';
import { limitForViewport, initBackToTop } from 'public/mobileHelpers';

$w.onReady(async function () {
  initBackToTop($w);
  await Promise.all([
    initOrderSummary(),
    initBrendaMessage(),
    initDeliveryTimeline(),
    initSocialSharing(),
    initNewsletterSignup(),
    initReferralSection(),
    loadPostPurchaseSuggestions(),
    initPostPurchaseCareSequence(),
    initAssemblyGuideLink(),
    initTestimonialPrompt(),
  ]);
  // Track purchase completion in engagement funnel
  trackPurchaseComplete('', 0);
});

// ── Order Summary ──────────────────────────────────────────────────
// Pulls order details from the Thank You page context

async function initOrderSummary() {
  try {
    $w('#thankYouTitle').text = 'Thank You for Your Order!';

    // Wix passes order data via the page's Thank You context
    const wixWindow = await import('wix-window-frontend');
    const orderData = wixWindow.lightbox?.getContext?.() || null;

    // Try to get order info from the thank you page's built-in data
    try {
      const orderNumber = $w('#orderNumber');
      if (orderNumber) {
        // The element may be auto-populated by Wix Stores
        // If not, try to set it from context
        if (orderData && orderData.orderId) {
          orderNumber.text = `Order #${orderData.orderId}`;
        }
      }
    } catch (e) {}

    // Order confirmation message
    $w('#thankYouMessage').text =
      'Your order has been confirmed and is being prepared with care. ' +
      'We\'ll send you a shipping confirmation email with tracking info once your items are on their way.';

    // Contact info for questions
    try {
      $w('#orderContactInfo').text =
        'Questions about your order? Call us at (828) 252-9449 ' +
        '(Wed-Sat, 10am-5pm) or email through our contact page.';
    } catch (e) {}
  } catch (e) {}
}

// ── Brenda's Personal Message ──────────────────────────────────────
// Warm, personal thank-you from the store owner

function initBrendaMessage() {
  try {
    const messageSection = $w('#brendaMessageSection');
    if (!messageSection) return;

    try {
      $w('#brendaTitle').text = 'A Note from Brenda';
    } catch (e) {}

    try {
      $w('#brendaMessage').text =
        'Thank you for choosing Carolina Futons! Every piece we sell is one I\'d be proud to have in my own home. ' +
        'We\'ve been helping families find quality furniture since 1991, and it means the world to have you as part of ' +
        'our Carolina Futons family. If you\'re ever in Hendersonville, stop by our showroom — I\'d love to meet you!\n\n' +
        '— Brenda Deal, Owner';
    } catch (e) {}

    messageSection.expand();
  } catch (e) {
    // Brenda's message section is optional
  }
}

// ── Delivery Timeline ──────────────────────────────────────────────
// Estimated delivery range and what to expect next

function initDeliveryTimeline() {
  try {
    const timeline = $w('#deliveryTimeline');
    if (!timeline) return;

    const today = new Date();
    const minDate = addBusinessDays(today, 5);
    const maxDate = addBusinessDays(today, 10);
    const opts = { month: 'long', day: 'numeric' };

    try {
      $w('#deliveryEstimateText').text =
        `Estimated delivery: ${minDate.toLocaleDateString('en-US', opts)} – ${maxDate.toLocaleDateString('en-US', opts)}`;
    } catch (e) {}

    // Delivery steps
    const steps = [
      { id: '#step1', text: 'Order confirmed', status: 'complete' },
      { id: '#step2', text: 'Preparing your items', status: 'active' },
      { id: '#step3', text: 'Shipped with tracking', status: 'pending' },
      { id: '#step4', text: 'Delivered to your door', status: 'pending' },
    ];

    steps.forEach(step => {
      try {
        const el = $w(step.id);
        if (el) {
          el.text = step.text;
          if (step.status === 'complete') {
            el.style.color = colors.success;
          } else if (step.status === 'active') {
            el.style.color = colors.mountainBlue;
            el.style.fontWeight = String(typography.h2.weight);
          } else {
            el.style.color = colors.mutedBrown;
          }
        }
      } catch (e) {}
    });

    timeline.expand();
  } catch (e) {}
}

// ── Social Sharing ─────────────────────────────────────────────────

function initSocialSharing() {
  try {
    $w('#shareText').text = 'Love your new furniture? Share with friends!';

    try { $w('#shareFacebook').accessibility.ariaLabel = 'Share on Facebook'; } catch (e) {}
    try { $w('#sharePinterest').accessibility.ariaLabel = 'Share on Pinterest'; } catch (e) {}
    try { $w('#shareInstagram').accessibility.ariaLabel = 'Follow us on Instagram'; } catch (e) {}

    $w('#shareFacebook').onClick(() => {
      trackSocialShare('facebook', 'purchase');
      const url = encodeURIComponent('https://www.carolinafutons.com');
      const text = encodeURIComponent('Just ordered beautiful furniture from Carolina Futons in Hendersonville, NC!');
      import('wix-window-frontend').then(({ openUrl }) => {
        openUrl(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`);
      });
    });

    $w('#sharePinterest').onClick(() => {
      trackSocialShare('pinterest', 'purchase');
      const url = encodeURIComponent('https://www.carolinafutons.com');
      const desc = encodeURIComponent('Quality futon furniture from Carolina Futons - Hendersonville, NC');
      import('wix-window-frontend').then(({ openUrl }) => {
        openUrl(`https://pinterest.com/pin/create/button/?url=${url}&description=${desc}`);
      });
    });

    // Instagram share prompt (no direct share API — link to profile)
    try {
      $w('#shareInstagram').onClick(() => {
        trackSocialShare('instagram', 'purchase');
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl('https://www.instagram.com/carolinafutons/');
        });
      });
    } catch (e) {}
  } catch (e) {}
}

// ── Newsletter Signup ──────────────────────────────────────────────

function initNewsletterSignup() {
  try {
    $w('#newsletterPrompt').text = 'Get updates on new products and exclusive deals';
    try { $w('#newsletterEmail').accessibility.ariaLabel = 'Enter your email for newsletter'; } catch (e) {}
    try { $w('#newsletterSignup').accessibility.ariaLabel = 'Subscribe to newsletter'; } catch (e) {}
    $w('#newsletterSignup').onClick(async () => {
      const email = $w('#newsletterEmail').value;
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        try {
          const { contacts } = await import('wix-crm-frontend');
          await contacts.appendOrCreateContact({
            emails: [email],
            labelKeys: ['custom.newsletter'],
          });
          trackNewsletterSignup('thank_you_page');
          $w('#newsletterSuccess').text = 'You\'re subscribed! Watch for exclusive deals.';
          $w('#newsletterSuccess').show();
          $w('#newsletterSignup').disable();
        } catch (e) {
          console.error('Newsletter signup error:', e);
        }
      }
    });
  } catch (e) {}
}

// ── Referral Section ───────────────────────────────────────────────
// Encourage customers to share with friends

function initReferralSection() {
  try {
    const section = $w('#referralSection');
    if (!section) return;

    try {
      $w('#referralTitle').text = 'Share the Love';
    } catch (e) {}

    try {
      $w('#referralMessage').text =
        'Know someone who\'d love our furniture? Tell a friend about Carolina Futons ' +
        'and help them discover handcrafted comfort at mountain-town prices.';
    } catch (e) {}

    // Copy referral link
    try {
      try { $w('#referralCopyBtn').accessibility.ariaLabel = 'Copy referral link'; } catch (e) {}
      $w('#referralCopyBtn').onClick(() => {
        trackReferralAction('copy_link');
        const link = 'https://www.carolinafutons.com?ref=friend';
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(link).then(() => {
            $w('#referralCopyBtn').label = 'Link Copied!';
            setTimeout(() => {
              try { $w('#referralCopyBtn').label = 'Copy Link'; } catch (e) {}
            }, 2000);
          });
        }
      });
    } catch (e) {}

    // Email share
    try {
      try { $w('#referralEmailBtn').accessibility.ariaLabel = 'Share referral via email'; } catch (e) {}
      $w('#referralEmailBtn').onClick(() => {
        trackReferralAction('email_share');
        const subject = encodeURIComponent('Check out Carolina Futons!');
        const body = encodeURIComponent(
          'I just ordered from Carolina Futons — great handcrafted furniture at mountain-town prices. ' +
          'Check them out: https://www.carolinafutons.com'
        );
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`mailto:?subject=${subject}&body=${body}`);
        });
      });
    } catch (e) {}

    section.expand();
  } catch (e) {}
}

// ── Post-Purchase Suggestions ──────────────────────────────────────
// "Customers also love" section to drive repeat visits

async function loadPostPurchaseSuggestions() {
  try {
    const products = await getFeaturedProducts(4);
    const repeater = $w('#postPurchaseRepeater');
    if (!repeater || products.length === 0) return;

    try {
      $w('#postPurchaseHeading').text = 'You Might Also Love';
    } catch (e) {}

    repeater.onItemReady(($item, itemData) => {
      $item('#ppImage').src = itemData.mainMedia;
      $item('#ppImage').alt = `${itemData.name} - Carolina Futons`;
      $item('#ppName').text = itemData.name;
      $item('#ppPrice').text = itemData.formattedPrice;

      try { $item('#ppImage').accessibility.ariaLabel = `View ${itemData.name}`; } catch (e) {}
      $item('#ppImage').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });
    });
    repeater.data = limitForViewport(products, { mobile: 2, tablet: 3, desktop: 4 });
  } catch (err) {
    console.error('Error loading post-purchase suggestions:', err);
  }
}

// ── Post-Purchase Care Sequence ──────────────────────────────────
// Registers the customer for a multi-touch care email sequence:
// Day 0: Order confirmation (handled by Wix Stores)
// Day 3: Delivery preparation tips (scheduled trigger)
// Day 7: Review request (existing scheduleReviewRequest)
// Day 30: Care guide + accessory recommendations

async function initPostPurchaseCareSequence() {
  try {
    const wixWindow = await import('wix-window-frontend');
    const orderData = wixWindow.lightbox?.getContext?.() || null;
    const orderId = orderData?.orderId;
    if (!orderId) return;

    // Register the care sequence in backend
    const { submitContactForm } = await import('backend/contactSubmissions.web');

    // Get buyer email if available
    let buyerEmail = '';
    try {
      const { currentMember } = await import('wix-members-frontend');
      const member = await currentMember.getMember();
      buyerEmail = member?.loginEmail || member?.contactDetails?.emails?.[0] || '';
    } catch (e) {}

    if (!buyerEmail) return;

    // Schedule post-purchase care touchpoints
    await submitContactForm({
      email: buyerEmail,
      source: 'post_purchase_care',
      status: 'care_sequence_enrolled',
      orderId,
      enrolledDate: new Date().toISOString(),
    });

    // Also schedule a review request via existing system
    try {
      const { scheduleReviewRequest } = await import('backend/dataService.web');
      await scheduleReviewRequest(orderId);
    } catch (e) {}

    // Show care sequence info to customer
    try {
      const careSection = $w('#careSequenceInfo');
      if (careSection) {
        $w('#careSequenceText').text =
          'We\'ll follow up to make sure everything goes smoothly:\n' +
          '• Delivery prep tips before your items arrive\n' +
          '• Setup & care guide after delivery\n' +
          '• Personalized accessory recommendations';
        careSection.expand();
      }
    } catch (e) {}
  } catch (err) {
    // Care sequence enrollment is non-critical
    console.error('Care sequence enrollment error:', err);
  }
}

// ── Assembly Guide Link ─────────────────────────────────────────────
// Shows relevant assembly guides for purchased products

async function initAssemblyGuideLink() {
  try {
    const guideSection = $w('#assemblyGuideSection');
    if (!guideSection) return;

    try {
      $w('#assemblyGuideTitle').text = 'Assembly & Care Guides';
      $w('#assemblyGuideText').text =
        'Need help setting up your new furniture? Visit our assembly guides ' +
        'for step-by-step instructions and video walkthroughs.';
    } catch (e) {}

    try {
      try { $w('#assemblyGuideBtn').accessibility.ariaLabel = 'View assembly and care guides'; } catch (e) {}
      $w('#assemblyGuideBtn').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to('/getting-it-home');
        });
      });
    } catch (e) {}

    guideSection.expand();
  } catch (err) {
    // Assembly guide section is optional
  }
}

// ── Testimonial Submission ─────────────────────────────────────────
// Invite customers to share their experience after purchase

async function initTestimonialPrompt() {
  try {
    const section = $w('#testimonialSection');
    if (!section) return;

    try { $w('#testimonialTitle').text = 'Share Your Experience'; } catch (e) {}
    try { $w('#testimonialPrompt').text = 'Love your new furniture? Tell us about it! Your story helps other customers find the perfect piece.'; } catch (e) {}

    try { $w('#testimonialNameInput').accessibility.ariaLabel = 'Your name'; } catch (e) {}
    try { $w('#testimonialStoryInput').accessibility.ariaLabel = 'Your testimonial'; } catch (e) {}
    try { $w('#testimonialSubmitBtn').accessibility.ariaLabel = 'Submit testimonial'; } catch (e) {}

    $w('#testimonialSubmitBtn').onClick(async () => {
      try {
        const name = $w('#testimonialNameInput').value?.trim();
        const story = $w('#testimonialStoryInput').value?.trim();
        if (!story || story.length < 10) {
          try { $w('#testimonialError').text = 'Please write at least 10 characters.'; $w('#testimonialError').show(); } catch (e) {}
          return;
        }

        $w('#testimonialSubmitBtn').disable();
        $w('#testimonialSubmitBtn').label = 'Submitting...';

        const { submitTestimonial } = await import('backend/testimonialService.web');
        const result = await submitTestimonial({
          name: name || undefined,
          story,
          source: 'thank_you',
        });

        if (result.success) {
          try { $w('#testimonialNameInput').hide(); } catch (e) {}
          try { $w('#testimonialStoryInput').hide(); } catch (e) {}
          $w('#testimonialSubmitBtn').hide();
          try { $w('#testimonialError').hide(); } catch (e) {}
          try {
            $w('#testimonialSuccess').text = 'Thank you for sharing! Your testimonial will appear on our site once reviewed.';
            $w('#testimonialSuccess').show('fade', { duration: 300 });
          } catch (e) {}
        } else {
          try { $w('#testimonialError').text = result.error || 'Something went wrong. Please try again.'; $w('#testimonialError').show(); } catch (e) {}
          $w('#testimonialSubmitBtn').enable();
          $w('#testimonialSubmitBtn').label = 'Share Your Story';
        }
      } catch (err) {
        console.error('Testimonial submission error:', err);
        try { $w('#testimonialSubmitBtn').enable(); $w('#testimonialSubmitBtn').label = 'Share Your Story'; } catch (e) {}
      }
    });

    section.expand();
  } catch (e) {
    // Testimonial prompt is non-critical
  }
}

// ── Utility ─────────────────────────────────────────────────────────

function addBusinessDays(startDate, days) {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}
