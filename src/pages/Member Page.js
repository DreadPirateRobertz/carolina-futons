// Member Page.js - Customer Account Page
// Account dashboard, order history, wishlist, and account settings
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
import { colors } from 'public/designTokens.js';
import { collapseOnMobile, initBackToTop } from 'public/mobileHelpers';
import { initReturnsSection } from 'public/ReturnsPortal.js';
import { initStoreCreditDashboard } from 'public/storeCreditHelpers.js';
import {
  formatPoints,
  formatProgressText,
  getProgressPercent,
  getTierColor,
  getTierIcon,
  canAffordReward,
  formatRewardCost,
  buildTierComparisonData,
  getNextMilestone,
} from 'public/loyaltyHelpers.js';

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

    if (!currentMember) {
      const { authentication } = await import('wix-members-frontend');
      authentication.promptLogin();
      return;
    }

    const sections = [
      { name: 'dashboard', init: initDashboard },
      { name: 'storeCredit', init: () => initStoreCreditDashboard($w) },
      { name: 'loyaltyDashboard', init: initLoyaltyDashboard },
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

    // Loyalty summary cards (points + tier text)
    try {
      const { getMyLoyaltyAccount } = await import('backend/loyaltyService.web');
      const account = await getMyLoyaltyAccount();

      try {
        const pointsEl = $w('#memberPointsDisplay');
        if (pointsEl) {
          pointsEl.text = (account && account.points !== undefined)
            ? formatPoints(account.points)
            : 'Join Rewards';
        }
      } catch (e) {}

      try {
        const tierEl = $w('#memberTierDisplay');
        if (tierEl && account && account.tier) {
          tierEl.text = `${getTierIcon(account.tier)} ${account.tier}`;
          tierEl.style.color = getTierColor(account.tier);
        }
      } catch (e) {}
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

// ── Loyalty Dashboard ───────────────────────────────────────────────

async function initLoyaltyDashboard() {
  try {
    const { getMyLoyaltyAccount, getAvailableRewards, redeemReward, getLoyaltyTiers } =
      await import('backend/loyaltyService.web');

    const [account, rewards, tiers] = await Promise.all([
      getMyLoyaltyAccount(),
      getAvailableRewards(),
      getLoyaltyTiers(),
    ]);

    // ── Tier Progress Bar ──────────────────────────────────────────
    try {
      const progressBar = $w('#tierProgressBar');
      if (progressBar) {
        const pct = getProgressPercent(account);
        progressBar.value = pct;
        try { progressBar.style.foregroundColor = getTierColor(account?.tier); } catch (e) {}
      }
    } catch (e) {}

    try {
      const progressText = $w('#tierProgressText');
      if (progressText) {
        progressText.text = formatProgressText(account);
      }
    } catch (e) {}

    // ── Milestone Message ──────────────────────────────────────────
    try {
      const milestoneEl = $w('#loyaltyMilestone');
      if (milestoneEl) {
        const msg = getNextMilestone(account);
        if (msg) {
          milestoneEl.text = msg;
          milestoneEl.show('fade', { duration: 250 });
        } else {
          milestoneEl.collapse();
        }
      }
    } catch (e) {}

    // ── Tier Comparison / Benefits ─────────────────────────────────
    try {
      const tierRepeater = $w('#tierComparisonRepeater');
      if (tierRepeater) {
        const comparisonData = buildTierComparisonData(tiers, account?.tier);

        tierRepeater.onItemReady(($item, itemData) => {
          try { $item('#tierName').text = `${getTierIcon(itemData.name)} ${itemData.name}`; } catch (e) {}
          try { $item('#tierMinPoints').text = `${itemData.minPoints.toLocaleString()} pts`; } catch (e) {}

          // Benefits list
          try {
            $item('#tierBenefits').text = itemData.benefits.join('\n');
          } catch (e) {}

          // Highlight current tier
          try {
            if (itemData.isCurrent) {
              $item('#tierCard').style.borderColor = getTierColor(itemData.name);
              $item('#tierCurrentBadge').show();
              try { $item('#tierCurrentBadge').text = 'Your Tier'; } catch (e) {}
            } else {
              $item('#tierCurrentBadge').hide();
            }
          } catch (e) {}

          // Dim future tiers
          try {
            if (!itemData.isAchieved && !itemData.isCurrent) {
              $item('#tierCard').style.opacity = 0.6;
            }
          } catch (e) {}
        });

        tierRepeater.data = comparisonData.map((t, i) => ({ _id: `tier-${i}`, ...t }));
      }
    } catch (e) {}

    // ── Rewards Redemption ─────────────────────────────────────────
    try {
      const rewardsRepeater = $w('#rewardsRepeater');
      if (rewardsRepeater && rewards.length > 0) {
        rewardsRepeater.onItemReady(($item, itemData) => {
          try { $item('#rewardName').text = itemData.name; } catch (e) {}
          try { $item('#rewardDescription').text = itemData.description; } catch (e) {}
          try { $item('#rewardCost').text = formatRewardCost(itemData, account?.points || 0); } catch (e) {}

          // Redeem button
          try {
            const redeemBtn = $item('#redeemBtn');
            const affordable = canAffordReward(itemData, account?.points || 0);
            if (!affordable) {
              redeemBtn.disable();
              try { redeemBtn.label = 'Not Enough Points'; } catch (e) {}
            }
            try { redeemBtn.accessibility.ariaLabel = `Redeem ${itemData.name} for ${itemData.pointsCost} points`; } catch (e) {}

            redeemBtn.onClick(async () => {
              try {
                redeemBtn.disable();
                redeemBtn.label = 'Redeeming...';
                const result = await redeemReward(itemData._id);
                if (result.success) {
                  redeemBtn.label = 'Redeemed!';
                  announce($w, `${itemData.name} redeemed${result.couponCode ? `. Code: ${result.couponCode}` : ''}`);
                  try {
                    $item('#rewardCouponCode').text = result.couponCode || '';
                    if (result.couponCode) $item('#rewardCouponCode').show('fade', { duration: 250 });
                  } catch (e) {}
                  trackEvent('reward_redeemed', { rewardId: itemData._id, name: itemData.name });
                } else {
                  redeemBtn.label = result.message || 'Failed';
                  redeemBtn.enable();
                  announce($w, `Could not redeem: ${result.message}`);
                }
              } catch (err) {
                console.error('[MemberPage] Redeem error:', err);
                redeemBtn.label = 'Try Again';
                redeemBtn.enable();
              }
            });
          } catch (e) {}
        });

        rewardsRepeater.data = rewards.map(r => ({ ...r, _id: r._id }));
        try { $w('#rewardsSection').show('fade', { duration: 250 }); } catch (e) {}
      } else {
        try { $w('#rewardsEmpty').show(); } catch (e) {}
        try { $w('#rewardsRepeater').collapse(); } catch (e) {}
      }
    } catch (e) {}

    trackEvent('loyalty_dashboard_view', {
      tier: account?.tier || 'none',
      points: account?.points || 0,
      rewardsAvailable: rewards.length,
    });

  } catch (e) {
    console.error('[MemberPage] Error initializing loyalty dashboard:', e);
  }
}

// ── Order History ───────────────────────────────────────────────────

let _orderData = [];
let _orderPage = 1;
let _orderFilter = 'all';
let _memberEmail = '';
let _deliveries = [];

async function initOrderHistory() {
  try {
    // Reset state on each init (handles re-navigation)
    _orderData = [];
    _orderPage = 1;
    _orderFilter = 'all';
    _deliveries = [];

    const ordersRepeater = $w('#ordersRepeater');
    if (!ordersRepeater) return;

    const {
      mergeDeliveryStatus,
      formatOrderDate,
      formatOrderTotal,
      formatOrderNumber,
      formatDeliveryEstimate,
      formatItemCount,
      getOrderFilterOptions,
      filterOrdersByStatus,
      buildTrackingUrl,
      isReturnEligible,
      buildOrderGalleryItems,
      getStatusColor,
    } = await import('public/MemberPageHelpers.js');

    _memberEmail = currentMember?.loginEmail || currentMember?.contactDetails?.emails?.[0] || '';

    ordersRepeater.onItemReady(($item, itemData) => {
      try { $item('#orderNumber').text = formatOrderNumber(itemData.number); } catch (e) {}
      try { $item('#orderDate').text = formatOrderDate(itemData.createdDate); } catch (e) {}
      try { $item('#orderTotal').text = formatOrderTotal({ total: itemData.total }); } catch (e) {}
      try { $item('#orderItemCount').text = formatItemCount(itemData.itemCount); } catch (e) {}

      // Status badge
      try {
        const status = itemData.status || 'Processing';
        const badgeEl = $item('#orderStatusBadge');
        if (badgeEl) {
          badgeEl.text = status;
          badgeEl.style.color = getStatusColor(status);
          try { badgeEl.accessibility.ariaLabel = `Order status: ${status}`; } catch (e) {}
        } else {
          try { $item('#orderStatus').text = status; } catch (e) {}
        }
      } catch (e) {}

      // Delivery ETA
      try {
        const etaEl = $item('#orderDeliveryEta');
        if (etaEl) {
          if (itemData.deliveryEta) {
            const formatted = formatDeliveryEstimate(itemData.deliveryEta);
            etaEl.text = itemData.status === 'Delivered'
              ? `Delivered ${formatted}`
              : `Est. delivery: ${formatted}`;
            etaEl.show('fade', { duration: 250 });
          } else {
            etaEl.hide();
          }
        }
      } catch (e) {}

      // Track Order button
      try {
        const trackBtn = $item('#orderTrackBtn');
        const hasTracking = itemData.trackingNumber || itemData.deliveryTrackingNumber;
        if (hasTracking) {
          trackBtn.show();
          try { trackBtn.accessibility.ariaLabel = `Track order ${itemData.number}`; } catch (e) {}
          trackBtn.onClick(() => {
            import('wix-location-frontend').then(({ to }) => {
              to(buildTrackingUrl(itemData.number, _memberEmail));
            });
          });
        } else {
          trackBtn.hide();
        }
      } catch (e) {}

      // Reorder button
      try {
        const reorderBtn = $item('#orderReorderBtn');
        try { reorderBtn.accessibility.ariaLabel = `Reorder items from order ${itemData.number}`; } catch (e) {}
        reorderBtn.onClick(async () => {
          try {
            reorderBtn.disable();
            reorderBtn.label = 'Adding...';
            const { getReorderItems } = await import('backend/accountDashboard.web');
            const result = await getReorderItems(itemData._id);
            if (result.success && result.data?.items?.length > 0) {
              const { addToCart } = await import('public/cartService');
              await Promise.all(result.data.items.map(
                item => addToCart(item.productId, item.quantity || 1)
              ));
              reorderBtn.label = 'Added to Cart!';
              announce($w, `Items from order ${itemData.number} added to cart`);
              trackEvent('reorder', { orderNumber: itemData.number });
            } else {
              reorderBtn.label = 'No Items';
            }
            reorderBtn.disable();
            setTimeout(() => {
              reorderBtn.label = 'Reorder';
              reorderBtn.enable();
            }, 3000);
          } catch (err) {
            console.error('[MemberPage] Reorder error:', err);
            reorderBtn.label = 'Reorder';
            reorderBtn.enable();
          }
        });
      } catch (e) {}

      // Start a Return button
      try {
        const returnBtn = $item('#orderStartReturnBtn');
        try { returnBtn.accessibility.ariaLabel = `Start a return for order ${itemData.number}`; } catch (e) {}
        if (!isReturnEligible(itemData.status)) {
          returnBtn.hide();
        } else {
          returnBtn.onClick(() => {
            try { $w('#startReturnBtn').click(); } catch (e) {}
            trackEvent('return_started', { orderNumber: itemData.number });
          });
        }
      } catch (e) {}

      // Order items mini-gallery
      try {
        const gallery = $item('#orderItemsGallery');
        if (gallery && itemData.lineItems) {
          const galleryItems = buildOrderGalleryItems(
            itemData.lineItems.map(li => ({
              mediaItem: { src: li.imageUrl },
              name: li.name,
            }))
          );
          if (galleryItems.length > 0) {
            gallery.items = galleryItems;
          }
        }
      } catch (e) {}
    });

    // Setup filter dropdown
    try {
      const filterDropdown = $w('#orderFilterDropdown');
      if (filterDropdown) {
        filterDropdown.options = getOrderFilterOptions();
        filterDropdown.value = 'all';
        try { filterDropdown.accessibility.ariaLabel = 'Filter orders by status'; } catch (e) {}
        filterDropdown.onChange(async () => {
          _orderFilter = filterDropdown.value || 'all';
          _orderPage = 1;
          await loadOrders();
          announce($w, `Showing ${filterDropdown.options.find(o => o.value === _orderFilter)?.label || 'all'} orders`);
        });
      }
    } catch (e) {}

    // Setup Load More button
    try {
      const loadMoreBtn = $w('#ordersLoadMoreBtn');
      if (loadMoreBtn) {
        loadMoreBtn.hide();
        try { loadMoreBtn.accessibility.ariaLabel = 'Load more orders'; } catch (e) {}
        loadMoreBtn.onClick(async () => {
          try {
            loadMoreBtn.disable();
            loadMoreBtn.label = 'Loading...';
            _orderPage += 1;
            await loadOrders(true);
            loadMoreBtn.label = 'Load More Orders';
            loadMoreBtn.enable();
          } catch (err) {
            console.error('[MemberPage] Load more error:', err);
            loadMoreBtn.label = 'Retry';
            loadMoreBtn.enable();
          }
        });
      }
    } catch (e) {}

    // Setup Retry button (wired once to avoid stacking handlers)
    try {
      const retryBtn = $w('#ordersRetryBtn');
      if (retryBtn) {
        retryBtn.onClick(async () => {
          _orderPage = 1;
          await loadOrders();
        });
      }
    } catch (e) {}

    // Initial load
    await loadOrders();

  } catch (e) {
    console.error('[MemberPage] Error initializing order history:', e);
  }
}

async function loadOrders(append = false) {
  const {
    mergeDeliveryStatus,
    filterOrdersByStatus,
  } = await import('public/MemberPageHelpers.js');

  try {
    try { $w('#ordersLoader').show(); } catch (e) {}
    try { $w('#ordersError').hide(); } catch (e) {}
    if (!append) {
      try { $w('#ordersRepeater').collapse(); } catch (e) {}
      try { $w('#ordersEmpty').hide(); } catch (e) {}
    }

    const { getOrderHistory, getActiveDeliveries } = await import('backend/accountDashboard.web');

    const promises = [getOrderHistory({ page: _orderPage })];
    if (!append && _deliveries.length === 0) {
      promises.push(getActiveDeliveries());
    }

    const results = await Promise.all(promises);
    const orderResult = results[0];
    const deliveryResult = results[1];

    if (!orderResult.success) {
      showOrdersError('Unable to load your orders. Please try again.');
      return;
    }

    if (deliveryResult?.success) {
      _deliveries = deliveryResult.data.deliveries || [];
    }

    const enrichedOrders = mergeDeliveryStatus(orderResult.data.orders, _deliveries);
    const filtered = filterOrdersByStatus(enrichedOrders, _orderFilter);

    if (append) {
      _orderData = [..._orderData, ...filtered];
    } else {
      _orderData = filtered;
    }

    try { $w('#ordersLoader').hide(); } catch (e) {}

    if (_orderData.length === 0 && !append) {
      try { $w('#ordersEmpty').show(); } catch (e) {}
      try { $w('#ordersRepeater').collapse(); } catch (e) {}
      try { $w('#ordersLoadMoreBtn').hide(); } catch (e) {}
      return;
    }

    try {
      $w('#ordersRepeater').data = _orderData;
      $w('#ordersRepeater').expand();
    } catch (e) {}

    try {
      if (orderResult.data.hasNext) {
        $w('#ordersLoadMoreBtn').show();
      } else {
        $w('#ordersLoadMoreBtn').hide();
      }
    } catch (e) {}

  } catch (err) {
    console.error('[MemberPage] Error loading orders:', err);
    showOrdersError('Unable to load your orders. Please try again.');
  }
}

function showOrdersError(message) {
  try { $w('#ordersLoader').hide(); } catch (e) {}
  try {
    const errorEl = $w('#ordersError');
    errorEl.text = message;
    errorEl.show('fade', { duration: 200 });
  } catch (e) {}
}

// ── Wishlist / Saved Items ──────────────────────────────────────────

async function initWishlist() {
  try {
    const wishlistRepeater = $w('#wishlistRepeater');
    if (!wishlistRepeater) return;

    // Load wishlist data via backend service
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

      // Move to Cart button — uses backend service
      try {
        try { $item('#wishAddToCartBtn').accessibility.ariaLabel = `Move ${itemData.name} to cart`; } catch (e) {}
        $item('#wishAddToCartBtn').onClick(async () => {
          try {
            $item('#wishAddToCartBtn').label = 'Moving...';
            $item('#wishAddToCartBtn').disable();
            const { moveWishlistToCart } = await import('backend/accountDashboard.web');
            const result = await moveWishlistToCart(itemData._id);
            if (result.success) {
              const { addToCart } = await import('public/cartService');
              await addToCart(result.data.productId);
              $item('#wishAddToCartBtn').label = 'Moved to Cart!';
              announce($w, `${itemData.name} moved to cart`);
              trackEvent('wishlist_move_to_cart', { productId: result.data.productId });
              // Update dashboard count
              try {
                const countEl = $w('#memberWishCount');
                if (countEl) {
                  const current = parseInt(countEl.text) || 0;
                  countEl.text = String(Math.max(0, current - 1));
                }
              } catch (e2) {}
              setTimeout(() => { try { $item('#wishCard').collapse(); } catch (e) {} }, 1500);
            } else {
              $item('#wishAddToCartBtn').label = 'Try Again';
              $item('#wishAddToCartBtn').enable();
            }
          } catch (err) {
            console.error('[MemberPage] Move to cart error:', err);
            $item('#wishAddToCartBtn').label = 'Add to Cart';
            $item('#wishAddToCartBtn').enable();
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

      // Remove from wishlist — uses backend service
      try { $item('#wishRemoveBtn').accessibility.ariaLabel = `Remove ${itemData.name} from wishlist`; } catch (e) {}
      $item('#wishRemoveBtn').onClick(async () => {
        try {
          const { removeFromWishlist } = await import('backend/accountDashboard.web');
          const result = await removeFromWishlist(itemData._id);
          if (result.success) {
            $item('#wishCard').collapse();
            announce($w, `${itemData.name} removed from wishlist`);
            try {
              const countEl = $w('#memberWishCount');
              if (countEl) {
                const current = parseInt(countEl.text) || 0;
                countEl.text = String(Math.max(0, current - 1));
              }
            } catch (e2) {}
          }
        } catch (e) {
          console.error('[MemberPage] Wishlist remove error:', e);
        }
      });
    });

    // Set initial data on the repeater
    applyWishlistSort();

    // Show empty state if no items
    if (wishlistData.length === 0) {
      try { $w('#wishlistEmpty').show(); } catch (e) {}
      try { wishlistRepeater.collapse(); } catch (e) {}
    }

    // Load and display alert history
    initWishlistAlertHistory();

  } catch (e) {
    console.error('[MemberPage] Error initializing wishlist:', e);
  }
}

async function initWishlistAlertHistory() {
  try {
    const alertRepeater = $w('#wishAlertHistoryRepeater');
    if (!alertRepeater) return;

    const { getWishlistAlertHistory } = await import('backend/accountDashboard.web');
    const { formatAlertForDisplay } = await import('public/MemberPageHelpers');
    const result = await getWishlistAlertHistory();

    if (!result.success || !result.data.alerts.length) {
      try { alertRepeater.collapse(); } catch (e) {}
      return;
    }

    alertRepeater.onItemReady(($item, itemData) => {
      const display = formatAlertForDisplay(itemData);
      try { $item('#alertTypeLabel').text = display.typeLabel; } catch (e) {}
      try { $item('#alertProductName').text = display.productName; } catch (e) {}
      try { $item('#alertMessage').text = display.message; } catch (e) {}
      try { $item('#alertDate').text = display.date; } catch (e) {}
    });

    alertRepeater.data = result.data.alerts.slice(0, 10).map(a => ({ ...a, _id: a._id }));
    try { $w('#wishAlertHistorySection').show('fade', { duration: 250 }); } catch (e) {}
  } catch (e) {
    console.error('[MemberPage] Error loading alert history:', e);
  }
}

async function loadWishlistData() {
  try {
    const { getWishlist } = await import('backend/accountDashboard.web');
    const result = await getWishlist({ pageSize: 50 });

    if (result.success) {
      wishlistData = result.data.items || [];
    } else {
      wishlistData = [];
    }
  } catch (e) {
    console.error('[MemberPage] Error loading wishlist data:', e);
    wishlistData = [];
  }
}

function applyWishlistSort() {
  const sorted = [...wishlistData];
  switch (wishlistSortOrder) {
    case 'date-desc':
      sorted.sort((a, b) => new Date(b._createdDate || b.addedAt) - new Date(a._createdDate || a.addedAt));
      break;
    case 'date-asc':
      sorted.sort((a, b) => new Date(a._createdDate || a.addedAt) - new Date(b._createdDate || b.addedAt));
      break;
    case 'price-asc':
      sorted.sort((a, b) => (a.price || a.productPrice || 0) - (b.price || b.productPrice || 0));
      break;
    case 'price-desc':
      sorted.sort((a, b) => (b.price || b.productPrice || 0) - (a.price || a.productPrice || 0));
      break;
    case 'name-asc':
      sorted.sort((a, b) => (a.name || a.productName || '').localeCompare(b.name || b.productName || ''));
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
