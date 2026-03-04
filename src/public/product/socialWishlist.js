// socialWishlist.js - Social Share Buttons & Wishlist
// Share product on Facebook, Pinterest, email, and copy link.
// Heart icon to save product to Wishlist CMS collection.

import { colors } from 'public/designTokens.js';
import { trackSocialShare } from 'public/engagementTracker';

// ── Social Share ────────────────────────────────────────────────────

/**
 * Initialize share buttons for Facebook, Pinterest, email, and copy link.
 */
export function initSocialShare($w, product) {
  try {
    if (!product) return;
    const url = `https://www.carolinafutons.com/product-page/${product.slug}`;
    const title = product.name;
    const image = product.mainMedia || '';

    try { $w('#shareFacebook').accessibility.ariaLabel = 'Share on Facebook'; } catch (e) {}
    try { $w('#sharePinterest').accessibility.ariaLabel = 'Share on Pinterest'; } catch (e) {}
    try { $w('#shareEmail').accessibility.ariaLabel = 'Share via email'; } catch (e) {}
    try { $w('#shareCopyLink').accessibility.ariaLabel = 'Copy product link'; } catch (e) {}

    const productId = product._id || '';

    try {
      $w('#shareFacebook').onClick(() => {
        trackSocialShare('facebook', 'product', productId);
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
        });
      });
    } catch (e) {}

    try {
      $w('#sharePinterest').onClick(() => {
        trackSocialShare('pinterest', 'product', productId);
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(image)}&description=${encodeURIComponent(title)}`);
        });
      });
    } catch (e) {}

    try {
      $w('#shareEmail').onClick(() => {
        trackSocialShare('email', 'product', productId);
        const subject = encodeURIComponent(`Check out ${title} from Carolina Futons`);
        const body = encodeURIComponent(`I thought you might like this: ${title}\n\n${url}`);
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`mailto:?subject=${subject}&body=${body}`);
        });
      });
    } catch (e) {}

    try {
      $w('#shareCopyLink').onClick(() => {
        trackSocialShare('copy_link', 'product', productId);
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(url).then(() => {
            $w('#shareCopyLink').label = 'Copied!';
            setTimeout(() => {
              try { $w('#shareCopyLink').label = 'Copy Link'; } catch (e) {}
            }, 2000);
          });
        }
      });
    } catch (e) {}
  } catch (e) {}
}

// ── Wishlist / Save Button ───────────────────────────────────────

// SVG data URI heart icons — filled (coral) and outline (espresso)
const HEART_FILLED_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${colors.sunsetCoral}"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`)}`;
const HEART_OUTLINE_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors.espresso}" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`)}`;

function setWishlistActive($w, active) {
  try {
    const icon = $w('#wishlistIcon');
    if (icon) {
      icon.src = active ? HEART_FILLED_SVG : HEART_OUTLINE_SVG;
    }
    try {
      const btn = $w('#wishlistBtn');
      btn.accessibility.ariaLabel = active ? 'Remove from wishlist' : 'Add to wishlist';
    } catch (e) {}
  } catch (e) {}
}

/**
 * Initialize wishlist heart button with toggle behavior.
 */
export async function initWishlistButton($w, product) {
  try {
    const btn = $w('#wishlistBtn');
    if (!btn || !product) return;

    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember();

    if (member) {
      try {
        const wixData = (await import('wix-data')).default;
        const existing = await wixData.query('Wishlist')
          .eq('memberId', member._id)
          .eq('productId', product._id)
          .find();

        if (existing.items.length > 0) {
          setWishlistActive($w, true);
        }
      } catch (e) {}
    }

    let wishlistBusy = false;
    btn.onClick(async () => {
      if (wishlistBusy) return;
      wishlistBusy = true;
      try {
        const { currentMember: cm, authentication } = await import('wix-members-frontend');
        const m = await cm.getMember();

        if (!m) {
          authentication.promptLogin();
          return;
        }

        const wixData = (await import('wix-data')).default;
        const existing = await wixData.query('Wishlist')
          .eq('memberId', m._id)
          .eq('productId', product._id)
          .find();

        if (existing.items.length > 0) {
          await wixData.remove('Wishlist', existing.items[0]._id);
          setWishlistActive($w, false);
        } else {
          await wixData.insert('Wishlist', {
            memberId: m._id,
            productId: product._id,
            productName: product.name,
            productImage: product.mainMedia,
            addedDate: new Date(),
          });
          setWishlistActive($w, true);
        }
      } catch (e) {
        console.error('[socialWishlist] Wishlist toggle failed:', e.message);
      } finally {
        wishlistBusy = false;
      }
    });
  } catch (e) {
    try { $w('#wishlistBtn').hide(); } catch (e2) {}
  }
}
