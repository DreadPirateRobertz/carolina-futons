// Wishlist Share.js — /wishlist-share
// CF-y24r: S1 Token resolution + wishlist fetch
// Stories: S1 token/fetch, S2 product cards, S3 add-to-cart,
//          S4 member share generation, S5 SEO

import wixLocation from 'wix-location-frontend';
import { resolveShareToken } from 'backend/wishlistShare.web.js';
import {
  parseShareToken,
  buildInvalidMessage,
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
    _showInvalidState('missing_token');
    return;
  }

  let result;
  try {
    result = await resolveShareToken(token);
  } catch (err) {
    console.error('[WishlistShare] Token resolution failed:', err);
    _showInvalidState('error');
    return;
  }

  if (!result.valid) {
    _showInvalidState(result.reason);
    return;
  }

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

  // S2 will wire onItemReady — for S1 we just populate the data
  $w('#wishlistShareRepeater').data = result.items.map(item => ({
    _id: item._id || item.productId,
    productId: item.productId,
    productName: item.productName,
    productImage: item.productImage,
  }));
});

// ── State helpers ─────────────────────────────────────────────────────────────

function _showInvalidState(reason) {
  _safe(() => { $w('#wishlistShareContentSection').style.opacity = '1'; });
  _safe(() => $w('#wishlistShareInvalidSection').show());
  _safe(() => { $w('#wishlistShareInvalidText').text = buildInvalidMessage(reason); });
  _safe(() => $w('#wishlistShareContentSection').hide());
  _safe(() => $w('#wishlistShareEmptySection').hide());
}
