// Member Page.js - Customer Account Page
// Account dashboard, order history, wishlist, and account settings
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
import { colors } from 'public/designTokens.js';
import { collapseOnMobile, initBackToTop } from 'public/mobileHelpers';
import { initReturnsSection } from 'public/ReturnsPortal.js';

// Status badge color mapping
const STATUS_COLORS = {
  Processing: colors.mountainBlue,
  Shipped: colors.sunsetCoral,
  Delivered: colors.success,
  Cancelled: colors.muted,
};

let currentMember = null;
let wishlistData = [];
let wishlistSortOrder = 'date-desc';

$w.onReady(async function () {
  collapseOnMobile($w, ['#ordersRepeater', '#wishlistRepeater', '#addressBook']);
  initBackToTop($w);
  await initMemberPage();
  trackEvent('page_view', { page: 'member_account' });
});

// ── Main Initialization ─────────────────────────────────────────────

async function initMemberPage() {
  try {
    currentMember = await loadCurrentMember();

    const sections = [
      { name: 'dashboard', init: initDashboard },
      { name: 'orderHistory', init: initOrderHistory },
      { name: 'wishlist', init: initWishlist },
      { name: 'accountSettings', init: initAccountSettings },
      { name: 'addressBook', init: initAddressBook },
      { name: 'communicationPrefs', init: initCommunicationPrefs },
      { name: 'returns', init: () => initReturnsSection($w) },
    ];

    const results = await Promise.allSettled(sections.map(s => s.init()));

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`[MemberPage] Section "${sections[i].name}" failed:`, result.reason);
        import('backend/errorMonitoring.web').then(({ logError }) => {
          logError({
            message: `Member page section "${sections[i].name}" failed to load`,
            stack: result.reason?.stack || String(result.reason),
            page: 'Member Page',
            context: `initMemberPage/${sections[i].name}`,
            severity: 'error',
          });
        }).catch(err => console.error('[MemberPage] Error logging failed:', err.message));
      }
    });

  } catch (err) {
    console.error('[MemberPage] Initialization error:', err);
    showErrorFallback('We had trouble loading your account. Please refresh the page.');
  }
}

// ── Member Data ─────────────────────────────────────────────────────

async function loadCurrentMember() {
  try {
    const { currentMember: memberApi } = await import('wix-members-frontend');
    const member = await memberApi.getMember();
    return member;
  } catch (err) {
    console.error('[MemberPage] Error loading member:', err);
    return null;
  }
}

// ── Account Dashboard ───────────────────────────────────────────────

async function initDashboard() {
  try {
    // Welcome message
    const welcomeEl = $w('#memberWelcome');
    if (welcomeEl && currentMember) {
      const name = currentMember.contactDetails?.firstName || 'Member';
      welcomeEl.text = `Welcome back, ${name}!`;
    }

    // Summary cards - order count
    try {
      const wixData = (await import('wix-data')).default;
      const memberId = currentMember?._id;

      if (memberId) {
        // Order count
        const ordersResult = await wixData.query('Stores/Orders')
          .eq('buyerInfo.id', memberId)
          .count();

        const orderCountEl = $w('#memberOrderCount');
        if (orderCountEl) {
          orderCountEl.text = String(ordersResult);
        }

        // Wishlist count
        const wishCount = await wixData.query('Wishlist')
          .eq('memberId', memberId)
          .count();

        const wishCountEl = $w('#memberWishCount');
        if (wishCountEl) {
          wishCountEl.text = String(wishCount);
        }
      }
    } catch (e) {
      console.error('[MemberPage] Error loading dashboard counts:', e);
    }

    // Loyalty points display
    try {
      const pointsEl = $w('#memberPointsDisplay');
      if (pointsEl) {
        const { getMyLoyaltyAccount } = await import('backend/loyaltyService.web');
        const account = await getMyLoyaltyAccount();
        if (account && account.points !== undefined) {
          pointsEl.text = `${account.points.toLocaleString()} pts`;
          // Show tier if available
          try {
            const tierEl = $w('#memberTierDisplay');
            if (tierEl && account.tier) {
              tierEl.text = account.tier;
            }
          } catch (e) {}
        } else {
          pointsEl.text = 'Join Rewards';
        }
      }
    } catch (e) {
      try { $w('#memberPointsDisplay').text = 'Join Rewards'; } catch (e2) {}
    }

    // Quick links - scroll to page sections
    const quickLinks = [
      { id: '#dashQuickOrders', target: '#ordersRepeater', label: 'Jump to your orders' },
      { id: '#dashQuickWishlist', target: '#wishlistRepeater', label: 'Jump to your wishlist' },
      { id: '#dashQuickSettings', target: '#accountSettings', label: 'Jump to account settings' },
    ];
    for (const link of quickLinks) {
      try {
        $w(link.id).onClick(() => {
          try { $w(link.target).scrollTo(); } catch (e) {}
        });
        try { $w(link.id).accessibility.ariaLabel = link.label; } catch (e) {}
      } catch (e) {}
    }
  } catch (e) {
    console.error('[MemberPage] Error initializing dashboard:', e);
  }
}

// ── Order History ───────────────────────────────────────────────────

function initOrderHistory() {
  try {
    const ordersRepeater = $w('#ordersRepeater');
    if (!ordersRepeater) return;

    ordersRepeater.onItemReady(($item, itemData) => {
      $item('#orderNumber').text = `Order #${itemData.number}`;
      $item('#orderDate').text = new Date(itemData._createdDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      $item('#orderTotal').text = `$${Number(itemData.totals?.total || 0).toFixed(2)}`;

      // Status badge with color coding
      const status = itemData.fulfillmentStatus || 'Processing';
      try {
        const badgeEl = $item('#orderStatusBadge');
        if (badgeEl) {
          badgeEl.text = status;
          badgeEl.style.color = STATUS_COLORS[status] || colors.mountainBlue;
          try { badgeEl.accessibility.ariaLabel = `Order status: ${status}`; } catch (e) {}
        } else {
          $item('#orderStatus').text = status;
        }
      } catch (e) {
        try { $item('#orderStatus').text = status; } catch (e2) {}
      }

      // Track Order button
      try {
        $item('#orderTrackBtn').onClick(() => {
          const trackingNumber = itemData.shippingInfo?.trackingNumber;
          if (trackingNumber) {
            import('wix-location-frontend').then(({ to }) => {
              to(`/tracking?order=${itemData.number}&tracking=${trackingNumber}`);
            });
          }
        });
        try { $item('#orderTrackBtn').accessibility.ariaLabel = `Track order ${itemData.number}`; } catch (e) {}

        // Hide track button if no tracking info
        if (!itemData.shippingInfo?.trackingNumber) {
          $item('#orderTrackBtn').hide();
        }
      } catch (e) {}

      // Reorder button - adds all items from past order to cart
      try {
        try { $item('#orderReorderBtn').accessibility.ariaLabel = `Reorder items from order ${itemData.number}`; } catch (e) {}
        $item('#orderReorderBtn').onClick(async () => {
          try {
            const { addToCart } = await import('public/cartService');
            const lineItems = itemData.lineItems || [];
            if (lineItems.length === 0) return;

            for (const item of lineItems) {
              await addToCart(item.productId, item.quantity || 1);
            }
            $item('#orderReorderBtn').label = 'Added to Cart!';
            $item('#orderReorderBtn').disable();
            announce($w, `Items from order ${itemData.number} added to cart`);
            setTimeout(() => {
              $item('#orderReorderBtn').label = 'Reorder';
              $item('#orderReorderBtn').enable();
            }, 3000);
          } catch (err) {
            console.error('[MemberPage] Reorder error:', err);
          }
        });
      } catch (e) {}

      // Start a Return button
      try {
        try { $item('#orderStartReturnBtn').accessibility.ariaLabel = `Start a return for order ${itemData.number}`; } catch (e) {}
        $item('#orderStartReturnBtn').onClick(() => {
          try { $w('#startReturnBtn').click(); } catch (e) {}
          trackEvent('return_started', { orderNumber: itemData.number });
        });

        // Hide return button for cancelled orders
        if (status === 'Cancelled') {
          $item('#orderStartReturnBtn').hide();
        }
      } catch (e) {}

      // Order items mini-gallery
      try {
        const gallery = $item('#orderItemsGallery');
        if (gallery && itemData.lineItems) {
          const galleryItems = itemData.lineItems
            .filter(li => li.mediaItem?.src)
            .map(li => ({
              src: li.mediaItem.src,
              alt: li.name ? `Ordered item: ${li.name}` : 'Ordered item',
              title: li.name,
            }));
          if (galleryItems.length > 0) {
            gallery.items = galleryItems;
          }
        }
      } catch (e) {}
    });

  } catch (e) {
    console.error('[MemberPage] Error initializing order history:', e);
  }
}

// ── Wishlist / Saved Items ──────────────────────────────────────────

async function initWishlist() {
  try {
    const wishlistRepeater = $w('#wishlistRepeater');
    if (!wishlistRepeater) return;

    // Load wishlist data
    await loadWishlistData();

    // Sort dropdown
    try {
      const sortDropdown = $w('#wishSortDropdown');
      if (sortDropdown) {
        sortDropdown.options = [
          { label: 'Newest First', value: 'date-desc' },
          { label: 'Oldest First', value: 'date-asc' },
          { label: 'Price: Low to High', value: 'price-asc' },
          { label: 'Price: High to Low', value: 'price-desc' },
          { label: 'Name: A-Z', value: 'name-asc' },
        ];
        sortDropdown.value = wishlistSortOrder;

        sortDropdown.onChange(() => {
          wishlistSortOrder = sortDropdown.value;
          applyWishlistSort();
          announce($w, `Wishlist sorted by ${sortDropdown.options.find(o => o.value === wishlistSortOrder)?.label || wishlistSortOrder}`);
        });
        try { sortDropdown.accessibility.ariaLabel = 'Sort wishlist items'; } catch (e) {}
      }
    } catch (e) {}

    // Share Wishlist — copy link button
    try {
      try { $w('#wishShareBtn').accessibility.ariaLabel = 'Copy wishlist link'; } catch (e) {}
      $w('#wishShareBtn').onClick(async () => {
        try {
          const shareUrl = await getWishlistShareUrl();
          const wixWindow = await import('wix-window-frontend');
          await wixWindow.copyToClipboard(shareUrl);
          $w('#wishShareBtn').label = 'Link Copied!';
          setTimeout(() => {
            $w('#wishShareBtn').label = 'Share Wishlist';
          }, 3000);
        } catch (err) {
          console.error('[MemberPage] Share wishlist error:', err);
        }
      });
    } catch (e) {}

    // Share Wishlist — Pinterest board
    try {
      try { $w('#wishSharePinterest').accessibility.ariaLabel = 'Share wishlist on Pinterest'; } catch (e) {}
      $w('#wishSharePinterest').onClick(async () => {
        try {
          const shareUrl = await getWishlistShareUrl();
          const desc = encodeURIComponent('My furniture wishlist from Carolina Futons — Hendersonville, NC');
          const wixWindow = await import('wix-window-frontend');
          wixWindow.openUrl(
            `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${desc}`,
            '_blank'
          );
          trackEvent('social_share', { platform: 'pinterest', context: 'wishlist' });
        } catch (err) {
          console.error('[MemberPage] Pinterest share error:', err);
        }
      });
    } catch (e) {}

    // Share Wishlist — Email
    try {
      try { $w('#wishShareEmail').accessibility.ariaLabel = 'Share wishlist via email'; } catch (e) {}
      $w('#wishShareEmail').onClick(async () => {
        try {
          const shareUrl = await getWishlistShareUrl();
          const subject = encodeURIComponent('Check out my furniture wishlist!');
          const body = encodeURIComponent(
            `I've been putting together a furniture wishlist at Carolina Futons. ` +
            `Take a look and let me know what you think!\n\n${shareUrl}`
          );
          const wixWindow = await import('wix-window-frontend');
          wixWindow.openUrl(`mailto:?subject=${subject}&body=${body}`, '_self');
          trackEvent('social_share', { platform: 'email', context: 'wishlist' });
        } catch (err) {
          console.error('[MemberPage] Email share error:', err);
        }
      });
    } catch (e) {}

    // Share Wishlist — Facebook
    try {
      try { $w('#wishShareFacebook').accessibility.ariaLabel = 'Share wishlist on Facebook'; } catch (e) {}
      $w('#wishShareFacebook').onClick(async () => {
        try {
          const shareUrl = await getWishlistShareUrl();
          const wixWindow = await import('wix-window-frontend');
          wixWindow.openUrl(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
            '_blank'
          );
          trackEvent('social_share', { platform: 'facebook', context: 'wishlist' });
        } catch (err) {
          console.error('[MemberPage] Facebook share error:', err);
        }
      });
    } catch (e) {}

    wishlistRepeater.onItemReady(($item, itemData) => {
      $item('#wishImage').src = itemData.mainMedia;
      $item('#wishImage').alt = `${itemData.name} - saved item`;
      $item('#wishName').text = itemData.name;
      $item('#wishPrice').text = itemData.formattedPrice;

      // Stock status
      try {
        const stockEl = $item('#wishStockStatus');
        if (stockEl) {
          if (itemData.inStock !== false) {
            stockEl.text = 'In Stock';
            stockEl.style.color = colors.success;
          } else {
            stockEl.text = 'Special Order';
            stockEl.style.color = colors.sunsetCoral;
          }
        }
      } catch (e) {}

      // Sale price display
      try {
        const salePriceEl = $item('#wishSalePrice');
        if (salePriceEl && itemData.comparePrice && itemData.comparePrice > itemData.price) {
          salePriceEl.text = `Was $${Number(itemData.comparePrice).toFixed(2)}`;
          salePriceEl.show();
        } else if (salePriceEl) {
          salePriceEl.hide();
        }
      } catch (e) {}

      // Add to Cart button
      try {
        try { $item('#wishAddToCartBtn').accessibility.ariaLabel = `Add ${itemData.name} to cart`; } catch (e) {}
        $item('#wishAddToCartBtn').onClick(async () => {
          try {
            const { addToCart } = await import('public/cartService');
            await addToCart(itemData.productId || itemData._id);
            $item('#wishAddToCartBtn').label = 'Added!';
            $item('#wishAddToCartBtn').disable();
            announce($w, `${itemData.name} added to cart`);
            setTimeout(() => {
              $item('#wishAddToCartBtn').label = 'Add to Cart';
              $item('#wishAddToCartBtn').enable();
            }, 3000);
          } catch (err) {
            console.error('[MemberPage] Add to cart from wishlist error:', err);
          }
        });
      } catch (e) {}

      // View product
      try { $item('#wishViewBtn').accessibility.ariaLabel = `View ${itemData.name}`; } catch (e) {}
      $item('#wishViewBtn').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });

      // Per-product alert toggle (mute/unmute price drop & back-in-stock alerts)
      try {
        const alertToggle = $item('#wishAlertToggle');
        if (alertToggle) {
          alertToggle.checked = itemData.muteAlerts !== true;
          try { alertToggle.accessibility.ariaLabel = `${itemData.muteAlerts ? 'Enable' : 'Disable'} alerts for ${itemData.name}`; } catch (e) {}
          alertToggle.onChange(async () => {
            try {
              const { toggleProductAlerts } = await import('backend/notificationService.web');
              await toggleProductAlerts(itemData._id, !alertToggle.checked);
            } catch (err) {
              console.error('[MemberPage] Alert toggle error:', err);
            }
          });
        }
      } catch (e) {}

      // Remove from wishlist
      try { $item('#wishRemoveBtn').accessibility.ariaLabel = `Remove ${itemData.name} from wishlist`; } catch (e) {}
      $item('#wishRemoveBtn').onClick(() => {
        import('wix-data').then(async (mod) => {
          try {
            await mod.default.remove('Wishlist', itemData._id);
            $item('#wishCard').collapse();
            announce($w, `${itemData.name} removed from wishlist`);
            // Update dashboard count
            try {
              const countEl = $w('#memberWishCount');
              if (countEl) {
                const current = parseInt(countEl.text) || 0;
                countEl.text = String(Math.max(0, current - 1));
              }
            } catch (e2) {}
          } catch (e) {
            console.error('[MemberPage] Wishlist remove error:', e);
          }
        });
      });
    });

  } catch (e) {
    console.error('[MemberPage] Error initializing wishlist:', e);
  }
}

async function loadWishlistData() {
  try {
    const wixData = (await import('wix-data')).default;
    const memberId = currentMember?._id;
    if (!memberId) return;

    const result = await wixData.query('Wishlist')
      .eq('memberId', memberId)
      .find();

    wishlistData = result.items || [];
  } catch (e) {
    console.error('[MemberPage] Error loading wishlist data:', e);
  }
}

function applyWishlistSort() {
  const sorted = [...wishlistData];
  switch (wishlistSortOrder) {
    case 'date-desc':
      sorted.sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
      break;
    case 'date-asc':
      sorted.sort((a, b) => new Date(a._createdDate) - new Date(b._createdDate));
      break;
    case 'price-asc':
      sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case 'price-desc':
      sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'name-asc':
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
  }

  try {
    $w('#wishlistRepeater').data = sorted;
  } catch (e) {
    console.error('[MemberPage] Error applying wishlist sort:', e);
  }
}

// ── Account Settings ────────────────────────────────────────────────

function initAccountSettings() {
  try {
    $w('#logoutBtn').onClick(() => {
      import('wix-members-frontend').then(({ authentication }) => {
        authentication.logout();
      });
    });
    try { $w('#logoutBtn').accessibility.ariaLabel = 'Log out of your account'; } catch (e) {}

  } catch (e) {
    console.error('[MemberPage] Error initializing account settings:', e);
  }
}

// ── Address Book ────────────────────────────────────────────────────

async function initAddressBook() {
  try {
    const addressRepeater = $w('#addressRepeater');
    if (!addressRepeater) return;

    // Load saved addresses from member contact
    if (currentMember?.contactDetails?.addresses) {
      const addresses = currentMember.contactDetails.addresses;
      addressRepeater.data = addresses.map((addr, idx) => ({
        _id: addr._id || String(idx),
        ...addr,
      }));
    }

    addressRepeater.onItemReady(($item, itemData) => {
      try {
        const lines = [];
        if (itemData.street) lines.push(itemData.street);
        if (itemData.city && itemData.state) {
          lines.push(`${itemData.city}, ${itemData.state} ${itemData.zip || ''}`);
        }
        $item('#addressText').text = lines.join('\n') || 'No address saved';
      } catch (e) {}
    });

    // Address Book container toggle
    try {
      const addressBook = $w('#addressBook');
      if (addressBook && (!currentMember?.contactDetails?.addresses ||
          currentMember.contactDetails.addresses.length === 0)) {
        // Show empty state message within the container
        try {
          $w('#addressEmptyState').show();
        } catch (e) {}
      }
    } catch (e) {}

  } catch (e) {
    console.error('[MemberPage] Error initializing address book:', e);
  }
}

// ── Communication Preferences ───────────────────────────────────────

async function initCommunicationPrefs() {
  try {
    const commPrefs = $w('#commPrefs');
    if (!commPrefs) return;

    // Load existing preferences from CMS
    try {
      const wixData = (await import('wix-data')).default;
      const memberId = currentMember?._id;
      if (!memberId) return;

      const prefResult = await wixData.query('MemberPreferences')
        .eq('memberId', memberId)
        .find();

      const prefs = prefResult.items?.[0] || {
        newsletter: true,
        saleAlerts: true,
        backInStock: true,
      };

      // Bind toggles to saved prefs
      const toggleIds = [
        { id: '#prefNewsletter', key: 'newsletter', label: 'Receive newsletter emails' },
        { id: '#prefSaleAlerts', key: 'saleAlerts', label: 'Receive sale alerts' },
        { id: '#prefBackInStock', key: 'backInStock', label: 'Receive back-in-stock notifications' },
      ];

      for (const toggle of toggleIds) {
        try {
          const el = $w(toggle.id);
          if (el) {
            el.checked = prefs[toggle.key] !== false;
            try { el.accessibility.ariaLabel = toggle.label; } catch (e) {}
            el.onChange(async () => {
              try {
                prefs[toggle.key] = el.checked;
                if (prefs._id) {
                  await wixData.update('MemberPreferences', prefs);
                } else {
                  prefs.memberId = memberId;
                  const saved = await wixData.insert('MemberPreferences', prefs);
                  prefs._id = saved._id;
                }
              } catch (err) {
                console.error('[MemberPage] Error saving preference:', err);
              }
            });
          }
        } catch (e) {}
      }
    } catch (e) {
      console.error('[MemberPage] Error loading comm prefs:', e);
    }

  } catch (e) {
    console.error('[MemberPage] Error initializing comm prefs:', e);
  }
}

// ── Wishlist Share URL Builder ────────────────────────────────────────

async function getWishlistShareUrl() {
  const wixLocation = await import('wix-location-frontend');
  const baseUrl = wixLocation.baseUrl;
  const memberId = currentMember?._id || '';
  return `${baseUrl}/wishlist?member=${memberId}`;
}

// ── Error Fallback ──────────────────────────────────────────────────

function showErrorFallback(message) {
  try {
    const errorBox = $w('#memberErrorFallback');
    if (errorBox) {
      try { $w('#memberErrorText').text = message; } catch (e) {}
      errorBox.show();
    }
  } catch (e) {
    console.error('[MemberPage] Could not show error fallback:', e);
  }
}
