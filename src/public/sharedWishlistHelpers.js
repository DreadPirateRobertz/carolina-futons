// sharedWishlistHelpers.js - Pure helpers for Shared Wishlist page
// Extracted for unit testability. All functions are side-effect free
// except renderWishlist and populateCard (which take $w/$item as params).

import wixData from 'wix-data';

// ── Pure string helpers ───────────────────────────────────────────

/**
 * Returns "X items" / "1 item" label.
 * @param {Array} items
 * @returns {string}
 */
export function itemCount(items) {
  const n = items.length;
  return n === 1 ? '1 item' : `${n} items`;
}

/**
 * Returns "[Name]'s Wishlist" or "A Curated Wishlist" fallback.
 * @param {{ memberName: string|null }} wishlist
 * @returns {string}
 */
export function ownerName(wishlist) {
  const name = wishlist?.memberName;
  if (!name) return 'A Curated Wishlist';
  return `${name}'s Wishlist`;
}

// ── S1: Token resolution and wishlist fetch ───────────────────────
// Interface radahn (CF-y24r) will own. Stubbed here so S2 rendering
// can be built and tested independently.

/**
 * Fetches wishlist record by share token.
 * @param {string} token
 * @returns {Promise<{status: 'ok'|'not_found'|'private', wishlist?: object}>}
 */
export async function fetchWishlistByToken(token) {
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
    return { status: 'not_found' };
  }
}

// ── S2: State management ─────────────────────────────────────────

/**
 * Shows the appropriate error/state section and hides others.
 * @param {Function} $w
 * @param {'not_found'|'private'|'empty'} state
 */
export async function showState($w, state) {
  const sections = ['#sharedWishNotFound', '#sharedWishPrivate', '#sharedWishEmpty'];

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
    try { await $w(target).show(); } catch (e) {}
  }
}

// ── S2: Repeater card population ──────────────────────────────────

/**
 * Populates a single repeater card with product data.
 * @param {Function} $item - scoped $w for repeater item
 * @param {object} itemData - wishlist item data
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
    if (itemData.comparePrice && itemData.comparePrice > itemData.price) {
      origEl.text = `Was $${Number(itemData.comparePrice).toFixed(2)}`;
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
    import('wix-location-frontend').then(m => {
      const loc = m.default || m;
      try { loc.to(`/product-page/${itemData.slug}`); } catch (e) {}
    }).catch(() => {});
  };

  try { $item('#sharedWishImage').onClick(navigateToProduct); } catch (e) {}
  try { $item('#sharedWishName').onClick(navigateToProduct); } catch (e) {}
  try { $item('#sharedWishViewBtn').onClick(navigateToProduct); } catch (e) {}

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
          cartBtn.label = 'Add to Cart';
          try { cartBtn.enable(); } catch (e) {}
        }
      });
    }
  } catch (e) {}
}

// ── S2: Wishlist rendering ────────────────────────────────────────

/**
 * Renders the full wishlist view.
 * @param {object} wishlist - wishlist record with items[]
 * @param {Function} $w
 */
export async function renderWishlist(wishlist, $w) {
  // Header
  try { $w('#sharedWishTitle').text = ownerName(wishlist); } catch (e) {}
  try { $w('#sharedWishSubtitle').text = itemCount(wishlist.items); } catch (e) {}

  // Avatar (hide on load — show if available)
  try { $w('#sharedWishMemberAvatar').hide(); } catch (e) {}
  if (wishlist.memberAvatar) {
    try {
      $w('#sharedWishMemberAvatar').src = wishlist.memberAvatar;
      $w('#sharedWishMemberAvatar').show();
    } catch (e) {}
  }

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
  } catch (e) {}

  try { $w('#sharedWishSection').show(); } catch (e) {}
  try { $w('#sharedWishEmpty').hide(); } catch (e) {}
}
