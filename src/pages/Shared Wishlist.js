// Shared Wishlist.js - Public read-only view of a member's shared wishlist
// URL: /wishlist/{shareToken} — configured in Wix Router; path[1] reads the token segment
// Spec: cf-complete-product-spec.md § Spec 03 — Wishlist Share View
// Stories: S1 (token resolution + fetch), S2 (rendering)

import wixLocationFrontend from 'wix-location-frontend';
import {
  fetchWishlistByToken,
  renderWishlist,
  showState,
} from 'public/sharedWishlistHelpers';

$w.onReady(async () => {
  try {
    // Hide main content section on load (state sections handled by showState)
    try { $w('#sharedWishSection').hide(); } catch (e) {}

    // S1: Resolve token from URL path /wishlist/{shareToken}
    const path = wixLocationFrontend.path;
    const shareToken = path[1] || '';

    if (!shareToken) {
      await showState($w, 'not_found');
      return;
    }

    const { status, wishlist } = await fetchWishlistByToken(shareToken);

    if (status === 'private') {
      await showState($w, 'private');
      return;
    }

    if (status === 'error') {
      // DB error — show not_found as closest available fallback
      await showState($w, 'not_found');
      return;
    }

    if (status !== 'ok' || !wishlist) {
      await showState($w, 'not_found');
      return;
    }

    // S2: Render wishlist
    await renderWishlist(wishlist, $w);

  } catch (err) {
    console.error('[SharedWishlist] Page init error:', err);
    try { $w('#sharedWishNotFound').show(); } catch (e) {}
  }
});
