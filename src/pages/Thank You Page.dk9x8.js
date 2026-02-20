// Thank You Page.dk9x8.js - Order Confirmation
// Post-purchase engagement: thank you message, order summary,
// social sharing prompts, and related product suggestions
import { getFeaturedProducts } from 'backend/productRecommendations.web';

$w.onReady(async function () {
  initThankYou();
  await loadPostPurchaseSuggestions();
});

// ── Thank You Message ───────────────────────────────────────────────

function initThankYou() {
  try {
    $w('#thankYouTitle').text = 'Thank You for Your Order!';
    $w('#thankYouMessage').text =
      'Your order has been confirmed. We\'ll send you a shipping confirmation email once your items are on their way. ' +
      'If you have any questions, don\'t hesitate to reach out at (828) 252-9449.';
  } catch (e) {}

  // Social sharing
  try {
    $w('#shareText').text = 'Love your new furniture? Share with friends!';

    $w('#shareFacebook').onClick(() => {
      const url = encodeURIComponent('https://www.carolinafutons.com');
      const text = encodeURIComponent('Just ordered beautiful furniture from Carolina Futons in Hendersonville, NC!');
      import('wix-location').then(({ to }) => {
        to(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`);
      });
    });

    $w('#sharePinterest').onClick(() => {
      const url = encodeURIComponent('https://www.carolinafutons.com');
      const desc = encodeURIComponent('Quality futon furniture from Carolina Futons - Hendersonville, NC');
      import('wix-location').then(({ to }) => {
        to(`https://pinterest.com/pin/create/button/?url=${url}&description=${desc}`);
      });
    });
  } catch (e) {}

  // Newsletter signup prompt
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
          $w('#newsletterSuccess').text = 'You\'re subscribed!';
          $w('#newsletterSuccess').show();
        } catch (e) {
          console.error('Newsletter signup error:', e);
        }
      }
    });
  } catch (e) {}
}

// ── Post-Purchase Suggestions ───────────────────────────────────────
// "Customers also love" section to drive repeat visits

async function loadPostPurchaseSuggestions() {
  try {
    const products = await getFeaturedProducts(4);
    const repeater = $w('#postPurchaseRepeater');
    if (!repeater || products.length === 0) return;

    try {
      $w('#postPurchaseHeading').text = 'You Might Also Love';
    } catch (e) {}

    repeater.data = products;
    repeater.onItemReady(($item, itemData) => {
      $item('#ppImage').src = itemData.mainMedia;
      $item('#ppImage').alt = `${itemData.name} - Carolina Futons`;
      $item('#ppName').text = itemData.name;
      $item('#ppPrice').text = itemData.formattedPrice;

      $item('#ppImage').onClick(() => {
        import('wix-location').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });
    });
  } catch (err) {
    console.error('Error loading post-purchase suggestions:', err);
  }
}
