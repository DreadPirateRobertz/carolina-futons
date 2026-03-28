// Thank You Page.js - Order Confirmation & Post-Purchase Engagement
// Personalized order summary, Brenda's message, social sharing, newsletter,
// delivery timeline, referral prompt, and product suggestions
import { getFeaturedProducts } from 'backend/productRecommendations.web';
import { subscribeToNewsletter } from 'backend/newsletterService.web';
import { trackPurchaseComplete, trackSocialShare, trackNewsletterSignup, trackReferralAction } from 'public/engagementTracker';
import { firePurchase, fireCustomEvent } from 'public/ga4Tracking';
import { trackPurchase } from 'backend/analyticsHelpers.web';
import { trackCheckoutStep } from 'backend/checkoutOptimization.web';
import { colors, typography } from 'public/designTokens.js';
import { limitForViewport, initBackToTop } from 'public/mobileHelpers';
import { announce, makeClickable } from 'public/a11yHelpers';
import { validateEmail, sanitizeText } from 'public/validators.js';
import { markSessionConverted } from 'backend/browseAbandonment.web';
import { getReferralLink } from 'backend/referralService.web';
import { submitReview } from 'backend/reviewsService.web';
import { finalizeGiftCardRedemption } from 'public/giftCardHelpers.js';
import { initGiftCardUpsell } from 'public/giftCardUpsell.js';
import { initPageSeo } from 'public/pageSeo.js';
import { initPostPurchaseReveal } from 'public/PostPurchaseReveal.js';
import { getMyLoyaltyAccount } from 'backend/loyaltyService.web';
import { getZipLeaderboard } from 'backend/zipLeaderboard.web';
import { getEnrollmentPrompt, enrollMember, calculatePointsForOrder } from 'backend/loyaltyMarketing.web';

$w.onReady(async function () {
  initBackToTop($w);
  initPageSeo('thankYou');

  // CF-sy7r: Finalize gift card redemption now that order is confirmed.
  // Must happen before sections init — deducts the balance that was validated at checkout.
  try {
    const orderTotal = null; // Wix provides total via orderCtx below
    const gcResult = await finalizeGiftCardRedemption();
    if (gcResult.amountApplied > 0) {
      console.log(`[ThankYou] Gift card redeemed: $${gcResult.amountApplied.toFixed(2)}`);
    }
    if (!gcResult.success) {
      console.error('[ThankYou] Gift card finalization failed:', gcResult.message);
    }
  } catch (err) {
    console.error('[ThankYou] Gift card finalization error:', err);
  }

  // Get order context early so sections can use it
  const wixWindow = await import('wix-window-frontend');
  const orderCtx = wixWindow.lightbox?.getContext?.() || null;

  const sections = [
    { name: 'orderSummary', init: initOrderSummary },
    { name: 'brendaMessage', init: initBrendaMessage },
    { name: 'deliveryTimeline', init: initDeliveryTimeline },
    { name: 'freightTracking', init: () => initFreightTracking(orderCtx) },
    { name: 'socialSharing', init: () => initSocialSharing(orderCtx) },
    { name: 'newsletterSignup', init: initNewsletterSignup },
    { name: 'referralSection', init: initReferralSection },
    { name: 'postPurchaseSuggestions', init: loadPostPurchaseSuggestions },
    { name: 'postPurchaseCare', init: initPostPurchaseCareSequence },
    { name: 'assemblyGuideLink', init: initAssemblyGuideLink },
    { name: 'testimonialPrompt', init: initTestimonialPrompt },
    { name: 'reviewRequest', init: () => initReviewRequest(orderCtx) },
    { name: 'giftCardUpsell', init: () => initGiftCardUpsell($w, orderCtx?.total || 0) },
<<<<<<< HEAD
    { name: 'loyaltyEnrollment', init: () => initLoyaltyEnrollment(orderCtx) },
    { name: 'postPurchaseReveal', init: () => initPostPurchaseReveal($w, {
      orderTotal: orderCtx?.total || 0,
      getLoyaltyAccount: getMyLoyaltyAccount,
      getLeaderboard: getZipLeaderboard,
    }) },
=======
>>>>>>> origin/cf-ou1f-gift-cards-s4
  ];

  const results = await Promise.allSettled(sections.map(s => s.init()));

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[ThankYou] Section "${sections[i].name}" failed:`, result.reason);
    }
  });
  // Track purchase completion in engagement funnel + GA4/Meta Pixel
  trackPurchaseComplete(orderCtx?.orderId || '', orderCtx?.total || 0);
  firePurchase({
    _id: orderCtx?.orderId || '',
    lineItems: orderCtx?.lineItems || [],
    totals: { total: orderCtx?.total || 0 },
  });

  // Track checkout funnel completion
  try {
    const sessionId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('cf_browse_session') : null;
    if (sessionId) {
      trackCheckoutStep({ sessionId, step: 'complete', cartTotal: orderCtx?.total || 0 }).catch(() => {});
    }
  } catch (e) {}

  // Increment purchaseCount in ProductAnalytics for each purchased item
  try {
    const lineItems = orderCtx?.lineItems || [];
    for (const item of lineItems) {
      const pid = item.catalogItemId || item.productId || '';
      if (pid) {
        trackPurchase(pid).catch(err => console.error('[ThankYou] trackPurchase failed:', err.message));
      }
    }
  } catch (e) {}

  // Mark browse session as converted to cancel recovery emails
  try {
    if (typeof sessionStorage !== 'undefined') {
      const sessionId = sessionStorage.getItem('cf_browse_session');
      if (sessionId) {
        markSessionConverted(sessionId).catch(err => console.error('[ThankYou] markSessionConverted failed:', err.message));
        sessionStorage.removeItem('cf_browse_session');
      }
    }
  } catch (e) {}
});

// ── Order Summary ──────────────────────────────────────────────────
// Pulls order details from the Thank You page context

async function initOrderSummary() {
  try {
    try { $w('#thankYouTitle').text = 'Thank You for Your Order!'; } catch (e) {}

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
    try { $w('#thankYouMessage').text =
      'Your order has been confirmed and is being prepared with care. ' +
      'We\'ll send you a shipping confirmation email with tracking info once your items are on their way.'; } catch (e) {}

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

    // Delivery steps with ARIA step indicator
    const steps = [
      { id: '#step1', text: 'Order confirmed', status: 'complete' },
      { id: '#step2', text: 'Preparing your items', status: 'active' },
      { id: '#step3', text: 'Shipped with tracking', status: 'pending' },
      { id: '#step4', text: 'Delivered to your door', status: 'pending' },
    ];

    steps.forEach((step, index) => {
      try {
        const el = $w(step.id);
        if (el) {
          el.text = step.text;
          if (step.status === 'complete') {
            el.style.color = colors.success;
            try { el.accessibility.ariaLabel = `Step ${index + 1} of ${steps.length}: ${step.text} — completed`; } catch (e) {}
          } else if (step.status === 'active') {
            el.style.color = colors.mountainBlue;
            el.style.fontWeight = String(typography.h2.weight);
            try { el.accessibility.ariaLabel = `Step ${index + 1} of ${steps.length}: ${step.text} — in progress`; } catch (e) {}
            try { el.accessibility.ariaCurrent = 'step'; } catch (e) {}
          } else {
            el.style.color = colors.mutedBrown;
            try { el.accessibility.ariaLabel = `Step ${index + 1} of ${steps.length}: ${step.text} — pending`; } catch (e) {}
          }
        }
      } catch (e) {}
    });

    timeline.expand();
  } catch (e) {}
}

// ── Freight Tracking ───────────────────────────────────────────────
// Shown when the order contains an LTL freight item (murphy beds, heavy frames).
// At Thank You time the order has just been placed — no tracking number yet.
// Shows a static freight scheduling message; tracking link appears via email later.

/**
 * If the order was shipped via LTL freight, show a freight-specific section
 * explaining the delivery scheduling process and that tracking will arrive by email.
 *
 * @param {Object|null} orderCtx - Order context from wix-window-frontend lightbox
 */
function initFreightTracking(orderCtx) {
  try {
    const section = $w('#freightTrackingSection');
    if (!section) return;

    // Detect freight from selected shipping option code/title
    const shippingOption = orderCtx?.selectedShippingOption || orderCtx?.shippingOption || {};
    const code = shippingOption.code || shippingOption.id || '';
    const title = shippingOption.title || shippingOption.label || shippingOption.name || '';

    const isFreight = code.includes('ltl') || code.includes('wwex') || code.includes('freight') ||
                      title.toLowerCase().includes('ltl') || title.toLowerCase().includes('freight') ||
                      title.toLowerCase().includes('wwex');

    if (!isFreight) return; // parcel order — hide section, no-op

    try {
      $w('#freightTrackingTitle').text = '🚛 Freight Delivery Information';
    } catch (e) {}

    try {
      $w('#freightTrackingMessage').text =
        'Your order contains large items that ship via LTL freight. ' +
        'A freight carrier will contact you to schedule a delivery appointment. ' +
        'You\'ll receive a separate email with your PRO tracking number once your shipment is picked up.';
    } catch (e) {}

    try {
      $w('#freightScheduleNote').text =
        'Freight deliveries typically arrive within 5–10 business days. ' +
        'Please ensure someone 18+ is home to accept the delivery.';
    } catch (e) {}

    try { section.expand(); } catch (e) {}
  } catch (e) {
    // Freight section is optional
  }
}

// ── Social Sharing ─────────────────────────────────────────────────

/**
 * Initialize social sharing section with dynamic content from order context.
 * Wires Facebook, Pinterest, Instagram, and Twitter/X share buttons with
 * engagement tracking and product-specific share text.
 * @param {Object|null} orderCtx - Order context from wix-window-frontend lightbox
 */
function initSocialSharing(orderCtx) {
  try {
    // Build dynamic share text from purchased product names (sanitized)
    const lineItems = orderCtx?.lineItems || [];
    const productNames = lineItems
      .map(item => item.name)
      .filter(Boolean)
      .map(name => sanitizeText(name, 100));
    const sharePrompt = productNames.length > 0
      ? `Love your new ${productNames[0]}? Share with friends!`
      : 'Love your new furniture? Share with friends!';
    try { $w('#shareText').text = sharePrompt; } catch (e) {}

    const shareText = productNames.length > 0
      ? `Just ordered ${productNames.join(' and ')} from Carolina Futons in Hendersonville, NC!`
      : 'Just ordered beautiful furniture from Carolina Futons in Hendersonville, NC!';

    try { $w('#shareFacebook').accessibility.ariaLabel = 'Share on Facebook (opens in new window)'; } catch (e) {}
    try { $w('#sharePinterest').accessibility.ariaLabel = 'Share on Pinterest (opens in new window)'; } catch (e) {}
    try { $w('#shareInstagram').accessibility.ariaLabel = 'Follow us on Instagram (opens in new window)'; } catch (e) {}
    try { $w('#shareTwitter').accessibility.ariaLabel = 'Share on Twitter (opens in new window)'; } catch (e) {}

    try { $w('#shareFacebook').onClick(() => {
      trackSocialShare('facebook', 'purchase');
      const url = encodeURIComponent('https://www.carolinafutons.com');
      const text = encodeURIComponent(shareText);
      import('wix-window-frontend').then(({ openUrl }) => {
        openUrl(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`);
      });
    }); } catch (e) {}

    try { $w('#sharePinterest').onClick(() => {
      trackSocialShare('pinterest', 'purchase');
      const url = encodeURIComponent('https://www.carolinafutons.com');
      const desc = encodeURIComponent(shareText);
      import('wix-window-frontend').then(({ openUrl }) => {
        openUrl(`https://pinterest.com/pin/create/button/?url=${url}&description=${desc}`);
      });
    }); } catch (e) {}

    // Instagram share prompt (no direct share API — link to profile)
    try {
      $w('#shareInstagram').onClick(() => {
        trackSocialShare('instagram', 'purchase');
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl('https://www.instagram.com/carolinafutons/');
        });
      });
    } catch (e) {}

    // Twitter/X share
    try {
      $w('#shareTwitter').onClick(() => {
        trackSocialShare('twitter', 'purchase');
        const url = encodeURIComponent('https://www.carolinafutons.com');
        const text = encodeURIComponent(shareText);
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`https://twitter.com/intent/tweet?url=${url}&text=${text}`);
        });
      });
    } catch (e) {}
  } catch (e) {}
}

// ── Newsletter Signup ──────────────────────────────────────────────

function initNewsletterSignup() {
  try {
    try { $w('#newsletterPrompt').text = 'Get updates on new products and exclusive deals'; } catch (e) {}
    try { $w('#newsletterEmail').accessibility.ariaLabel = 'Enter your email for newsletter'; } catch (e) {}
    try { $w('#newsletterSignup').accessibility.ariaLabel = 'Subscribe to newsletter'; } catch (e) {}
    try { $w('#newsletterSignup').onClick(async () => {
      const email = $w('#newsletterEmail').value?.trim();
      if (!email || !validateEmail(email)) {
        try {
          $w('#newsletterError').text = 'Please enter a valid email address.';
          $w('#newsletterError').show();
        } catch (e) {}
        return;
      }
      try {
        const result = await subscribeToNewsletter(email, { source: 'thank_you_page' });
        if (result.success) {
          trackNewsletterSignup('thank_you_page');
          fireCustomEvent('newsletter_signup', { source: 'thank_you_page' });
          $w('#newsletterSuccess').text = 'You\'re subscribed! Watch for exclusive deals.';
          $w('#newsletterSuccess').show();
          $w('#newsletterSignup').disable();
        }
      } catch (e) {
        console.error('Newsletter signup error:', e);
      }
    }); } catch (e) {}
  } catch (e) {}
}

// ── Referral Section ───────────────────────────────────────────────
// Encourage customers to share with friends

async function initReferralSection() {
  try {
    const section = $w('#referralSection');
    if (!section) return;

    try {
      $w('#referralTitle').text = 'Share the Love';
    } catch (e) {}

    // Try to get unique referral code for logged-in users
    let referralCode = '';
    try {
      const result = await getReferralLink();
      if (result.success && result.referralCode) {
        referralCode = result.referralCode;
      }
    } catch (e) {
      // Not logged in or service error — use generic link
    }

    const referralUrl = referralCode
      ? `https://www.carolinafutons.com?ref=${referralCode}`
      : 'https://www.carolinafutons.com?ref=friend';

    try {
      $w('#referralMessage').text = referralCode
        ? `Share your code ${referralCode} with friends! You both earn store credit ` +
          'when they make a purchase. Handcrafted comfort at mountain-town prices.'
        : 'Know someone who\'d love our furniture? Tell a friend about Carolina Futons ' +
          'and help them discover handcrafted comfort at mountain-town prices.';
    } catch (e) {}

    // Copy referral link
    try {
      try { $w('#referralCopyBtn').accessibility.ariaLabel = 'Copy referral link'; } catch (e) {}
      $w('#referralCopyBtn').onClick(() => {
        trackReferralAction('copy_link');
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(referralUrl).then(() => {
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
          `Check them out: ${referralUrl}`
        );
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`mailto:?subject=${subject}&body=${body}`);
        });
      });
    } catch (e) {}

    // Facebook share
    try {
      try { $w('#referralFacebookBtn').accessibility.ariaLabel = 'Share referral on Facebook'; } catch (e) {}
      $w('#referralFacebookBtn').onClick(() => {
        trackReferralAction('share_facebook');
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`;
        import('wix-window-frontend').then(({ openUrl }) => { openUrl(fbUrl, '_blank'); });
      });
    } catch (e) {}

    // Twitter share
    try {
      try { $w('#referralTwitterBtn').accessibility.ariaLabel = 'Share referral on Twitter'; } catch (e) {}
      $w('#referralTwitterBtn').onClick(() => {
        trackReferralAction('share_twitter');
        const tweetText = encodeURIComponent(`Just got amazing furniture from @CarolinaFutons! Get $25 off: ${referralUrl}`);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
        import('wix-window-frontend').then(({ openUrl }) => { openUrl(twitterUrl, '_blank'); });
      });
    } catch (e) {}

    // SMS share
    try {
      try { $w('#referralSmsBtn').accessibility.ariaLabel = 'Share referral via text message'; } catch (e) {}
      $w('#referralSmsBtn').onClick(() => {
        trackReferralAction('share_sms');
        const smsBody = encodeURIComponent(`Hey! Check out Carolina Futons. Use my link for $25 off: ${referralUrl}`);
        import('wix-window-frontend').then(({ openUrl }) => { openUrl(`sms:?body=${smsBody}`, '_self'); });
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
      try { $item('#ppImage').src = itemData.mainMedia; } catch (e) {}
      try { $item('#ppImage').alt = `${itemData.name} - Carolina Futons`; } catch (e) {}
      try { $item('#ppName').text = itemData.name; } catch (e) {}
      try { $item('#ppPrice').text = itemData.formattedPrice; } catch (e) {}

      makeClickable($item('#ppImage'), () => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      }, { ariaLabel: `View ${itemData.name}` });
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
        const name = sanitizeText($w('#testimonialNameInput').value, 100);
        const story = sanitizeText($w('#testimonialStoryInput').value, 5000);
        if (!story || story.length < 10) {
          try { $w('#testimonialError').text = 'Please write at least 10 characters.'; $w('#testimonialError').show(); } catch (e) {}
          announce($w, 'Please write at least 10 characters for your testimonial');
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
            announce($w, 'Thank you for sharing your testimonial');
          } catch (e) {}
        } else {
          try { $w('#testimonialError').text = result.error || 'Something went wrong. Please try again.'; $w('#testimonialError').show(); } catch (e) {}
          announce($w, result.error || 'Something went wrong. Please try again.');
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

/**
 * Initialize star-rating review request section.
 * Uses reviewsService.submitReview which requires productId, rating, title, and body (min 10 chars).
 * Submits review for the first product in the order.
 * @param {Object|null} orderCtx - Order context from wix-window-frontend lightbox
 */
function initReviewRequest(orderCtx) {
  try {
    const section = $w('#reviewSection');
    if (!section) return;

    // Need at least one product to review
    const lineItems = orderCtx?.lineItems || [];
    const firstItem = lineItems[0];
    const productId = firstItem?.catalogItemId || firstItem?.productId || '';

    try { $w('#reviewTitle').text = 'Rate Your Experience'; } catch (e) {}
    try { $w('#reviewPrompt').text = 'How was your shopping experience? A quick rating helps us improve.'; } catch (e) {}

    let selectedRating = 0;

    // Wire up 5 star buttons
    for (let i = 1; i <= 5; i++) {
      try {
        $w(`#reviewStar${i}`).accessibility.ariaLabel = `${i} star${i > 1 ? 's' : ''}`;
        $w(`#reviewStar${i}`).onClick(() => {
          selectedRating = i;
          try { $w('#reviewRating').text = `${i} of 5 stars`; } catch (e) {}
          // Update star visuals
          for (let j = 1; j <= 5; j++) {
            try {
              $w(`#reviewStar${j}`).style.color = j <= i ? colors.coral : colors.mutedBrown;
            } catch (e) {}
          }
        });
      } catch (e) {}
    }

    // Submit review
    try {
      try { $w('#reviewSubmitBtn').accessibility.ariaLabel = 'Submit your rating'; } catch (e) {}
      $w('#reviewSubmitBtn').onClick(async () => {
        try {
          if (!selectedRating) {
            try {
              $w('#reviewError').text = 'Please select a rating before submitting.';
              $w('#reviewError').show();
            } catch (e) {}
            announce($w, 'Please select a rating before submitting');
            return;
          }

          $w('#reviewSubmitBtn').disable();
          $w('#reviewSubmitBtn').label = 'Submitting...';

          const reviewBody = sanitizeText(
            $w('#reviewBodyInput')?.value || 'Great shopping experience!',
            5000
          );
          // reviewsService.submitReview expects { productId, rating, title, body }
          const result = await submitReview({
            productId,
            rating: selectedRating,
            title: `${selectedRating}-star review`,
            body: reviewBody.length >= 10 ? reviewBody : 'Great shopping experience at Carolina Futons!',
          });

          if (result.success) {
            try {
              $w('#reviewSuccess').text = 'Thank you for your feedback!';
              $w('#reviewSuccess').show('fade', { duration: 300 });
              announce($w, 'Thank you for your feedback');
            } catch (e) {}
            try { $w('#reviewSubmitBtn').hide(); } catch (e) {}
            try { $w('#reviewError').hide(); } catch (e) {}
          } else {
            try {
              $w('#reviewError').text = result.error || 'Something went wrong. Please try again.';
              $w('#reviewError').show();
            } catch (e) {}
            announce($w, result.error || 'Something went wrong. Please try again.');
            $w('#reviewSubmitBtn').enable();
            $w('#reviewSubmitBtn').label = 'Submit Rating';
          }
        } catch (err) {
          console.error('Review submission error:', err);
          try { $w('#reviewSubmitBtn').enable(); $w('#reviewSubmitBtn').label = 'Submit Rating'; } catch (e) {}
        }
      });
    } catch (e) {}

    section.expand();
  } catch (e) {
    // Review request section is non-critical
  }
}

// ── Loyalty Enrollment Prompt (CF-nru7) ─────────────────────────────

async function initLoyaltyEnrollment(orderCtx) {
  try {
    const email = orderCtx?.email || '';
    if (!email) { try { $w('#loyaltyEnrollSection').collapse(); } catch (e) {} return; }

    const prompt = await getEnrollmentPrompt(email);
    if (!prompt.shouldPrompt) {
      try { $w('#loyaltyEnrollSection').collapse(); } catch (e) {}
      return;
    }

    // Calculate points for this order
    const orderTotal = orderCtx?.total || 0;
    const pointsResult = calculatePointsForOrder(orderTotal, 'Bronze');
    const earnedPoints = pointsResult.points + 50; // order points + welcome bonus

    try { $w('#loyaltyEnrollTitle').text = 'Join Carolina Futons Rewards'; } catch (e) {}
    try { $w('#loyaltyEnrollPoints').text = `You just earned ${earnedPoints} points!`; } catch (e) {}
    try { $w('#loyaltyEnrollDescription').text = 'Earn points on every purchase. Unlock discounts, free shipping, and exclusive perks.'; } catch (e) {}
    try { $w('#loyaltyBirthdayLabel').text = 'Birthday (optional) — +50 bonus points'; } catch (e) {}
    try { $w('#loyaltyEnrollSection').expand(); } catch (e) {}

    try {
      $w('#loyaltyJoinButton').onClick(async () => {
        try { $w('#loyaltyJoinButton').disable(); } catch (e) {}

        const memberId = orderCtx?.memberId || orderCtx?.contactId || '';
        const firstName = orderCtx?.firstName || '';
        const birthday = $w('#loyaltyBirthdayInput')?.value || '';

        const result = await enrollMember({ memberId, email, firstName, birthday });

        if (result.success) {
          try { $w('#loyaltyEnrollTitle').text = `Welcome! ${result.welcomePoints} points added!`; } catch (e) {}
          try { $w('#loyaltyJoinButton').collapse(); } catch (e) {}
          try { $w('#loyaltySkipButton').collapse(); } catch (e) {}
          try { $w('#loyaltyBirthdayInput').collapse(); } catch (e) {}
          fireCustomEvent('loyalty_enrolled', { source: 'thank_you_page', points: result.welcomePoints });
          announce(`Enrolled in rewards! ${result.welcomePoints} points added to your account.`);
        } else {
          try { $w('#loyaltyEnrollTitle').text = result.error || 'Enrollment failed. Try again later.'; } catch (e) {}
          try { $w('#loyaltyJoinButton').enable(); } catch (e) {}
        }
      });
    } catch (e) {}

    try {
      $w('#loyaltySkipButton').onClick(() => {
        try { $w('#loyaltyEnrollSection').collapse(); } catch (e) {}
        fireCustomEvent('loyalty_skip', { source: 'thank_you' });
      });
    } catch (e) {}
  } catch (err) {
    console.error('[ThankYou] Loyalty enrollment error:', err);
    try { $w('#loyaltyEnrollSection').collapse(); } catch (e) {}
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
