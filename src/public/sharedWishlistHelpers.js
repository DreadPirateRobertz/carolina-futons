// sharedWishlistHelpers.js - Pure helpers for Shared Wishlist page
// Extracted for unit testability (same pattern as comparePageHelpers).
// Pure helpers: itemCount, ownerName.
// Side-effecting: fetchWishlistByToken (wixData), showState/$w, renderWishlist/$w, populateCard/$item.

import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';

// ── Pure string helpers ───────────────────────────────────────────

/**
 * Returns "X items" / "1 item" label.
 * @param {Array} items
 * @returns {string}
 */
export function itemCount(items) {
  const n = (items || []).length;
  return n === 1 ? '1 item' : `${n} items`;
}

/**
 * Returns "[Name]'s Wishlist" or "A Curated Wishlist" fallback.
 * @param {{ memberName: string|null|undefined }} wishlist
 * @returns {string}
 */
export function ownerName(wishlist) {
  const name = wishlist?.memberName;
  if (!name) return 'A Curated Wishlist';
  return `${name}'s Wishlist`;
}

// ── S1: Token resolution and wishlist fetch ───────────────────────
// Interface owned by radahn (CF-y24r). This implementation queries
// MemberWishlists directly — radahn's S1 may replace the data source
// or add token expiry logic. Coordinate before merging S1.

/**
 * Fetches wishlist record by share token.
 * @param {string} token
 * @returns {Promise<{status: 'ok'|'not_found'|'private'|'error', wishlist?: object}>}
 */
export async function fetchWishlistByToken(token) {
  if (!token || typeof token !== 'string') {
    return { status: 'not_found' };
  }
  try {
    const result = await wixData
      .query('MemberWishlists')
      .eq('shareToken', token)
      .find();

    if (!result.items.length) {
      return { status: 'not_found' };
    }

    const record = result.items[0];

    if (!record.isPublic) {
      return { status: 'private' };
    }

    return { status: 'ok', wishlist: record };
  } catch (err) {
    console.error('[SharedWishlist] fetchWishlistByToken error:', err);
    return { status: 'error' };
  }
}

// ── S2: State management ─────────────────────────────────────────

/**
 * Shows the appropriate error/state section and hides others.
 * Also hides the main content section (#sharedWishSection).
 * @param {(selector: string) => {show: Function, hide: Function}} $w
 * @param {'not_found'|'private'|'empty'} state
 */
export async function showState($w, state) {
  const sections = [
    '#sharedWishNotFound', '#sharedWishPrivate', '#sharedWishEmpty', '#sharedWishSection',
  ];

  await Promise.all(sections.map(sel => {
    try { return $w(sel).hide(); } catch (e) { return Promise.resolve(); }
  }));

  const targetMap = {
    not_found: '#sharedWishNotFound',
    private: '#sharedWishPrivate',
    empty: '#sharedWishEmpty',
  };

  const target = targetMap[state];
  if (target) {
    try { await $w(target).show(); } catch (e) {
      console.error('[SharedWishlist] showState: could not show', target, e);
    }
  }
}

// ── S2: Repeater card population ──────────────────────────────────

/**
 * Populates a single repeater card with product data.
 * @param {Function} $item - scoped $w for repeater item
 * @param {{ name: string, slug: string, mainMedia: string, formattedPrice: string,
 *           price: number, comparePrice: number|null, ribbon: string|null,
 *           callForPrice: boolean, productId: string, _id: string }} itemData
 */
export function populateCard($item, itemData) {
  // Image
  try { $item('#sharedWishImage').src = itemData.mainMedia || ''; } catch (e) {}
  try { $item('#sharedWishImage').alt = `${itemData.name} - wishlist item`; } catch (e) {}

  // Name + price
  try { $item('#sharedWishName').text = itemData.name || ''; } catch (e) {}
  try { $item('#sharedWishPrice').text = itemData.formattedPrice || ''; } catch (e) {}

  // Sale price — show only when comparePrice > price
  try {
    const origEl = $item('#sharedWishOrigPrice');
    const compare = Number(itemData.comparePrice);
    if (compare && compare > itemData.price) {
      origEl.text = `Was $${compare.toFixed(2)}`;
      origEl.show();
    } else {
      origEl.hide();
    }
  } catch (e) {}

  // Badge — show only when ribbon is set
  try {
    const badgeEl = $item('#sharedWishBadge');
    if (itemData.ribbon) {
      badgeEl.text = itemData.ribbon;
      badgeEl.show();
    } else {
      badgeEl.hide();
    }
  } catch (e) {}

  // Navigation — image, name, view button all navigate to product page
  const navigateToProduct = () => {
    if (!itemData.slug) {
      console.error('[SharedWishlist] navigateToProduct: missing slug for item', itemData._id);
      return;
    }
    try { wixLocationFrontend.to(`/product-page/${itemData.slug}`); } catch (e) {
      console.error('[SharedWishlist] navigateToProduct failed:', e);
    }
  };

  ['#sharedWishImage', '#sharedWishName', '#sharedWishViewBtn'].forEach(sel => {
    try { $item(sel).onClick(navigateToProduct); } catch (e) {}
  });

  // Add to Cart button
  try {
    const cartBtn = $item('#sharedWishAddCart');
    if (itemData.callForPrice) {
      cartBtn.label = 'Call for Pricing';
      cartBtn.disable();
    } else {
      cartBtn.label = 'Add to Cart';
      cartBtn.onClick(async () => {
        try {
          cartBtn.label = 'Adding...';
          cartBtn.disable();
          const { addToCart } = await import('public/cartService');
          await addToCart(itemData.productId || itemData._id);
          cartBtn.label = 'Added!';
          setTimeout(() => {
            try { cartBtn.label = 'Add to Cart'; cartBtn.enable(); } catch (e) {}
          }, 2000);
        } catch (err) {
          console.error('[SharedWishlist] Add to cart error:', err);
          cartBtn.label = 'Error \u2014 Try Again';
          try { cartBtn.enable(); } catch (e) {}
        }
      });
    }
  } catch (e) {
    console.error('[SharedWishlist] populateCard: failed to wire add-to-cart button', e);
  }
}

// ── S2: Wishlist rendering ────────────────────────────────────────

/**
 * Renders the full wishlist view.
 * @param {{ memberName: string|null, memberAvatar: string|null, items: object[] }} wishlist
 * @param {Function} $w
 */
export async function renderWishlist(wishlist, $w) {
  // Header
  try { $w('#sharedWishTitle').text = ownerName(wishlist); } catch (e) {}
  try { $w('#sharedWishSubtitle').text = itemCount(wishlist.items); } catch (e) {}

  // Avatar — hidden on load, shown only when available
  try {
    const avatar = $w('#sharedWishMemberAvatar');
    avatar.hide();
    if (wishlist.memberAvatar) {
      avatar.src = wishlist.memberAvatar;
      avatar.show();
    }
  } catch (e) {}

  if (!wishlist.items || wishlist.items.length === 0) {
    try { $w('#sharedWishSection').hide(); } catch (e) {}
    try { $w('#sharedWishEmpty').show(); } catch (e) {}
    return;
  }

  // Populate repeater
  try {
    $w('#sharedWishRepeater').onItemReady(($item, itemData) => {
      populateCard($item, itemData);
    });
    $w('#sharedWishRepeater').data = wishlist.items;
  } catch (e) {
    console.error('[SharedWishlist] renderWishlist: failed to populate repeater', e);
  }

  try { $w('#sharedWishSection').show(); } catch (e) {}
  try { $w('#sharedWishEmpty').hide(); } catch (e) {}
}
