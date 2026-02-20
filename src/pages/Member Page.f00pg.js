// Member Page.f00pg.js - Customer Account Page
// Account dashboard, order history, wishlist, and account settings
// Enhanced for Wix Velo integration readiness

// Status badge color mapping
const STATUS_COLORS = {
  Processing: '#5B8FA8',  // Mountain blue
  Shipped: '#E8845C',     // Sunset coral
  Delivered: '#4A7C59',   // Forest green
  Cancelled: '#999999',
};

let currentMember = null;
let wishlistData = [];
let wishlistSortOrder = 'date-desc';

$w.onReady(async function () {
  console.log('[MemberPage] onReady - initializing');
  await initMemberPage();
});

// ── Main Initialization ─────────────────────────────────────────────

async function initMemberPage() {
  try {
    currentMember = await loadCurrentMember();
    console.log('[MemberPage] Member loaded:', currentMember ? 'yes' : 'no');

    await Promise.all([
      initDashboard(),
      initOrderHistory(),
      initWishlist(),
      initAccountSettings(),
      initAddressBook(),
      initCommunicationPrefs(),
    ]);

    console.log('[MemberPage] All sections initialized');
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
    console.log('[MemberPage] Member API response received');
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

    // Loyalty points placeholder
    const pointsEl = $w('#memberPointsDisplay');
    if (pointsEl) {
      pointsEl.text = 'Coming Soon';
    }

    // Quick links - scroll to page sections
    const quickLinks = [
      { id: '#dashQuickOrders', target: '#ordersRepeater' },
      { id: '#dashQuickWishlist', target: '#wishlistRepeater' },
      { id: '#dashQuickSettings', target: '#accountSettings' },
    ];
    for (const link of quickLinks) {
      try {
        $w(link.id).onClick(() => {
          try { $w(link.target).scrollTo(); } catch (e) {}
        });
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
          badgeEl.style.color = STATUS_COLORS[status] || '#5B8FA8';
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
            import('wix-location').then(({ to }) => {
              to(`/tracking?order=${itemData.number}&tracking=${trackingNumber}`);
            });
          }
        });

        // Hide track button if no tracking info
        if (!itemData.shippingInfo?.trackingNumber) {
          $item('#orderTrackBtn').hide();
        }
      } catch (e) {}

      // Reorder button - adds all items from past order to cart
      try {
        $item('#orderReorderBtn').onClick(async () => {
          try {
            const wixStores = (await import('wix-stores-frontend')).default;
            const lineItems = itemData.lineItems || [];
            if (lineItems.length === 0) return;

            const cartItems = lineItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity || 1,
            }));

            await wixStores.cart.addProducts(cartItems);
            $item('#orderReorderBtn').label = 'Added to Cart!';
            $item('#orderReorderBtn').disable();
            setTimeout(() => {
              $item('#orderReorderBtn').label = 'Reorder';
              $item('#orderReorderBtn').enable();
            }, 3000);
          } catch (err) {
            console.error('[MemberPage] Reorder error:', err);
          }
        });
      } catch (e) {}

      // Order items mini-gallery
      try {
        const gallery = $item('#orderItemsGallery');
        if (gallery && itemData.lineItems) {
          const galleryItems = itemData.lineItems
            .filter(li => li.mediaItem?.src)
            .map(li => ({
              src: li.mediaItem.src,
              alt: li.name || 'Order item',
              title: li.name,
            }));
          if (galleryItems.length > 0) {
            gallery.items = galleryItems;
          }
        }
      } catch (e) {}
    });

    console.log('[MemberPage] Order history initialized');
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
        });
      }
    } catch (e) {}

    // Share Wishlist button
    try {
      $w('#wishShareBtn').onClick(async () => {
        try {
          const wixLocation = await import('wix-location-frontend');
          const baseUrl = wixLocation.baseUrl;
          const memberId = currentMember?._id || '';
          const shareUrl = `${baseUrl}/wishlist?member=${memberId}`;

          // Copy to clipboard via Wix window API
          try {
            const wixWindow = await import('wix-window-frontend');
            await wixWindow.copyToClipboard(shareUrl);
            $w('#wishShareBtn').label = 'Link Copied!';
            setTimeout(() => {
              $w('#wishShareBtn').label = 'Share Wishlist';
            }, 3000);
          } catch (clipErr) {
            console.error('[MemberPage] Clipboard copy failed:', clipErr);
          }
        } catch (err) {
          console.error('[MemberPage] Share wishlist error:', err);
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
            stockEl.style.color = '#4A7C59';
          } else {
            stockEl.text = 'Special Order';
            stockEl.style.color = '#E8845C';
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
        $item('#wishAddToCartBtn').onClick(async () => {
          try {
            const wixStores = (await import('wix-stores-frontend')).default;
            await wixStores.cart.addProducts([{
              productId: itemData.productId || itemData._id,
              quantity: 1,
            }]);
            $item('#wishAddToCartBtn').label = 'Added!';
            $item('#wishAddToCartBtn').disable();
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
      $item('#wishViewBtn').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });

      // Remove from wishlist
      $item('#wishRemoveBtn').onClick(() => {
        import('wix-data').then(async (mod) => {
          try {
            await mod.default.remove('Wishlist', itemData._id);
            $item('#wishCard').collapse();
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

    console.log('[MemberPage] Wishlist initialized');
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
    console.log('[MemberPage] Wishlist loaded:', wishlistData.length, 'items');
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

    console.log('[MemberPage] Account settings initialized');
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

    console.log('[MemberPage] Address book initialized');
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
        { id: '#prefNewsletter', key: 'newsletter' },
        { id: '#prefSaleAlerts', key: 'saleAlerts' },
        { id: '#prefBackInStock', key: 'backInStock' },
      ];

      for (const toggle of toggleIds) {
        try {
          const el = $w(toggle.id);
          if (el) {
            el.checked = prefs[toggle.key] !== false;
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

    console.log('[MemberPage] Communication prefs initialized');
  } catch (e) {
    console.error('[MemberPage] Error initializing comm prefs:', e);
  }
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
