// Wishlist Share.js — /wishlist-share
<<<<<<< HEAD
// CF-y24r S1 + CF-4qll S2 + CF-o779 S3 + CF-muzy S5
=======
// CF-y24r: S1 Token resolution + wishlist fetch
>>>>>>> origin/cf-y24r-wishlist-share
// Stories: S1 token/fetch, S2 product cards, S3 add-to-cart,
//          S4 member share generation, S5 SEO

import wixLocation from 'wix-location-frontend';
<<<<<<< HEAD
import { seo } from 'wix-seo';
=======
>>>>>>> origin/cf-y24r-wishlist-share
import { resolveShareToken } from 'backend/wishlistShare.web.js';
import {
  parseShareToken,
  buildInvalidMessage,
<<<<<<< HEAD
  buildWishlistTitle,
  buildWishlistDescription,
  buildWishlistOgTags,
  populateShareCard,
=======
>>>>>>> origin/cf-y24r-wishlist-share
} from 'public/wishlistShareHelpers.js';
import { isMobile } from 'public/mobileHelpers';

/** Safe $w wrapper — swallows DOM errors for optional elements. */
function _safe(fn) {
  try { fn(); } catch (e) {}
}

$w.onReady(async () => {
  // S1: Extract share token from URL
  const token = parseShareToken(wixLocation.query);

  // Skeleton opacity while loading
  _safe(() => { $w('#wishlistShareContentSection').style.opacity = '0.4'; });

  // Register shop button (always — works in both valid and invalid states)
  _safe(() => $w('#wishlistShareShopBtn').onClick(() => wixLocation.to('/shop-main')));

  if (!token) {
<<<<<<< HEAD
    _applyNoindex();
=======
>>>>>>> origin/cf-y24r-wishlist-share
    _showInvalidState('missing_token');
    return;
  }

  let result;
  try {
    result = await resolveShareToken(token);
  } catch (err) {
    console.error('[WishlistShare] Token resolution failed:', err);
<<<<<<< HEAD
    _applyNoindex();
=======
>>>>>>> origin/cf-y24r-wishlist-share
    _showInvalidState('error');
    return;
  }

  if (!result.valid) {
<<<<<<< HEAD
    _applyNoindex();
=======
>>>>>>> origin/cf-y24r-wishlist-share
    _showInvalidState(result.reason);
    return;
  }

<<<<<<< HEAD
  // S5: Dynamic SEO for valid wishlist
  _applySeo(result);

=======
>>>>>>> origin/cf-y24r-wishlist-share
  // S1: Success — render content (S2 wires product cards)
  _safe(() => { $w('#wishlistShareContentSection').style.opacity = '1'; });
  _safe(() => $w('#wishlistShareInvalidSection').hide());
  _safe(() => $w('#wishlistShareContentSection').show());

  $w('#wishlistShareTitle').text = `${result.ownerName}'s Wishlist`;
  $w('#wishlistShareSubtitle').text =
    `${result.items.length} item${result.items.length !== 1 ? 's' : ''}`;

  if (result.items.length === 0) {
    _safe(() => $w('#wishlistShareEmptySection').show());
    return;
  }

<<<<<<< HEAD
  // S2+S3: Register onItemReady BEFORE setting .data (Velo requirement)
  $w('#wishlistShareRepeater').onItemReady(($item, itemData) => {
    // S2: Product card — image and name
    populateShareCard($item, itemData);

    // S3: Add to cart cycle: Add to Cart → Adding... → Added! → (2s) → Add to Cart
    $item('#shareAddCart').onClick(async () => {
      try {
        $item('#shareAddCart').disable();
        $item('#shareAddCart').label = 'Adding...';
        const { addToCart } = await import('public/cartService');
        await addToCart(itemData.productId);
        $item('#shareAddCart').label = 'Added!';
        setTimeout(() => {
          _safe(() => { $item('#shareAddCart').label = 'Add to Cart'; });
          _safe(() => $item('#shareAddCart').enable());
        }, 2000);
      } catch (err) {
        console.error('[WishlistShare] Add to cart failed:', err);
        $item('#shareAddCart').label = 'Error — Try Again';
        $item('#shareAddCart').enable();
        setTimeout(() => {
          _safe(() => { $item('#shareAddCart').label = 'Add to Cart'; });
        }, 2000);
      }
    });
  });

=======
  // S2 will wire onItemReady — for S1 we just populate the data
>>>>>>> origin/cf-y24r-wishlist-share
  $w('#wishlistShareRepeater').data = result.items.map(item => ({
    _id: item._id || item.productId,
    productId: item.productId,
    productName: item.productName,
    productImage: item.productImage,
  }));
});

<<<<<<< HEAD
// ── S5: SEO ───────────────────────────────────────────────────────────────────

function _applySeo(result) {
  try {
    const title = buildWishlistTitle(result.ownerName);
    const desc = buildWishlistDescription(result.ownerName, result.items.length);
    seo.setTitle(title);
    seo.setMetaTag({ name: 'description', content: desc });
    for (const tag of buildWishlistOgTags(result.ownerName, desc, result.items)) {
      seo.setMetaTag(tag);
    }
  } catch (e) {
    console.warn('[WishlistShare] SEO setup failed:', e);
  }
}

function _applyNoindex() {
  try {
    seo.setTitle(buildWishlistTitle(null));
    seo.setMetaTag({ name: 'robots', content: 'noindex' });
  } catch (e) {
    console.error('[WishlistShare] Failed to apply noindex — page may be indexed:', e);
  }
}

=======
>>>>>>> origin/cf-y24r-wishlist-share
// ── State helpers ─────────────────────────────────────────────────────────────

function _showInvalidState(reason) {
  _safe(() => { $w('#wishlistShareContentSection').style.opacity = '1'; });
  _safe(() => $w('#wishlistShareInvalidSection').show());
  _safe(() => { $w('#wishlistShareInvalidText').text = buildInvalidMessage(reason); });
  _safe(() => $w('#wishlistShareContentSection').hide());
  _safe(() => $w('#wishlistShareEmptySection').hide());
}
