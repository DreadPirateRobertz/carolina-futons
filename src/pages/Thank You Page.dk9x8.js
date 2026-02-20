// Thank You Page.dk9x8.js - Order Confirmation & Post-Purchase Engagement
// Personalized order summary, Brenda's message, social sharing, newsletter,
// delivery timeline, referral prompt, and product suggestions
import { getFeaturedProducts } from 'backend/productRecommendations.web';
import { trackPurchaseComplete, trackSocialShare, trackNewsletterSignup, trackReferralAction } from 'public/engagementTracker';

$w.onReady(async function () {
  await Promise.all([
    initOrderSummary(),
    initBrendaMessage(),
    initDeliveryTimeline(),
    initSocialSharing(),
    initNewsletterSignup(),
    initReferralSection(),
    loadPostPurchaseSuggestions(),
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
            el.style.color = '#4A7C59'; // Forest green
          } else if (step.status === 'active') {
            el.style.color = '#5B8FA8'; // Mountain blue
            el.style.fontWeight = '700';
          } else {
            el.style.color = '#8B7355'; // Muted
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

      $item('#ppImage').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });
    });
    repeater.data = products;
  } catch (err) {
    console.error('Error loading post-purchase suggestions:', err);
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
