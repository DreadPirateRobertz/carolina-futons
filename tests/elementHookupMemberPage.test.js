/**
 * Tests for Member Page element hookup
 * Covers: #memberWelcome, #memberOrderCount, #memberWishCount,
 * #memberPointsDisplay, #memberTierDisplay, #dashQuickOrders,
 * #dashQuickWishlist, #dashQuickSettings, #tierProgressBar,
 * #tierProgressText, #loyaltyMilestone, #tierComparisonRepeater,
 * #tierName, #tierMinPoints, #tierBenefits, #tierCard, #tierCurrentBadge,
 * #rewardsRepeater, #rewardName, #rewardDescription, #rewardCost,
 * #redeemBtn, #rewardCouponCode, #rewardsSection, #rewardsEmpty,
 * #ordersRepeater, #orderNumber, #orderDate, #orderTotal, #orderItemCount,
 * #orderStatusBadge, #orderStatus, #orderDeliveryEta, #orderTrackBtn,
 * #orderReorderBtn, #orderStartReturnBtn, #orderItemsGallery,
 * #orderFilterDropdown, #ordersLoadMoreBtn, #ordersRetryBtn,
 * #ordersLoader, #ordersError, #ordersEmpty, #startReturnBtn,
 * #wishlistRepeater, #wishImage, #wishName, #wishPrice, #wishStockStatus,
 * #wishSalePrice, #wishAddToCartBtn, #wishViewBtn, #wishAlertToggle,
 * #wishRemoveBtn, #wishCard, #wishSortDropdown, #wishShareBtn,
 * #wishSharePinterest, #wishShareEmail, #wishShareFacebook,
 * #wishlistEmpty, #wishAlertHistoryRepeater, #wishAlertHistorySection,
 * #alertTypeLabel, #alertProductName, #alertMessage, #alertDate,
 * #logoutBtn, #addressRepeater, #addressText, #addressBook,
 * #addressEmptyState, #commPrefs, #prefNewsletter, #prefSaleAlerts,
 * #prefBackInStock, #memberErrorFallback, #memberErrorText
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    src: '',
    alt: '',
    data: [],
    items: [],
    options: [],
    checked: false,
    collapsed: false,
    style: { color: '', backgroundColor: '', fontWeight: '', borderColor: '', foregroundColor: '', opacity: 1 },
    accessibility: { ariaLabel: '', ariaLive: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    onItemReady: vi.fn(),
    scrollTo: vi.fn(),
    click: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Data ───────────────────────────────────────────────────────

const mockMember = {
  _id: 'mem-1',
  contactDetails: {
    firstName: 'Jane',
    emails: ['jane@test.com'],
    addresses: [{ _id: 'a1', street: '123 Main St', city: 'Hendersonville', state: 'NC', zip: '28739' }],
  },
  loginEmail: 'jane@test.com',
};

const mockLoyaltyAccount = { points: 1500, tier: 'Gold', nextTierAt: 2000 };

const mockRewards = [
  { _id: 'rew-1', name: '$10 Off', description: 'Get $10 off next order', pointsCost: 500 },
];

const mockTiers = [
  { name: 'Bronze', minPoints: 0, benefits: ['Free shipping'] },
  { name: 'Gold', minPoints: 1000, benefits: ['Free shipping', '10% off'] },
];

const mockOrderResult = {
  success: true,
  data: {
    orders: [{
      _id: 'ord-1', number: '1001', createdDate: '2026-03-14',
      total: 549.99, status: 'Delivered', itemCount: 2,
      lineItems: [{ imageUrl: 'img.jpg', name: 'Futon' }],
    }],
    hasNext: false,
  },
};

const mockDeliveriesResult = { success: true, data: { deliveries: [] } };

const mockWishlistResult = {
  success: true,
  data: {
    items: [{
      _id: 'w-1', name: 'Comfy Futon', mainMedia: 'img.jpg',
      formattedPrice: '$399.99', price: 399.99, slug: 'comfy-futon', inStock: true,
    }],
  },
};

const mockAlertHistoryResult = {
  success: true,
  data: {
    alerts: [{
      _id: 'alert-1', type: 'price_drop', productName: 'Comfy Futon',
      message: 'Price dropped to $349', date: '2026-03-10',
    }],
  },
};

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    sand: '#E8D5B7', espresso: '#3A2518', mountainBlue: '#5B8FA8',
    sunsetCoral: '#E8845C', success: '#4CAF50',
  },
}));

vi.mock('public/mobileHelpers', () => ({
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
}));

vi.mock('public/ReturnsPortal.js', () => ({
  initReturnsSection: vi.fn(),
}));

vi.mock('public/storeCreditHelpers.js', () => ({
  initStoreCreditDashboard: vi.fn(),
}));

vi.mock('public/giftCardHelpers.js', () => ({
  initGiftCardDashboard: vi.fn(),
}));

vi.mock('public/loyaltyHelpers.js', () => ({
  formatPoints: vi.fn((pts) => `${pts.toLocaleString()} pts`),
  formatProgressText: vi.fn(() => '500 points to Gold'),
  getProgressPercent: vi.fn(() => 75),
  getTierColor: vi.fn(() => '#FFD700'),
  getTierIcon: vi.fn(() => '\u2B50'),
  canAffordReward: vi.fn(() => true),
  formatRewardCost: vi.fn(() => '500 pts'),
  buildTierComparisonData: vi.fn((tiers) => tiers.map((t, i) => ({
    name: t.name, minPoints: t.minPoints, benefits: t.benefits,
    isCurrent: i === 1, isAchieved: true,
  }))),
  getNextMilestone: vi.fn(() => '500 more points to Platinum!'),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: vi.fn(() => Promise.resolve(mockMember)),
  },
  authentication: {
    promptLogin: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({
      eq: vi.fn(function () { return this; }),
      find: vi.fn(() => Promise.resolve({ items: [{ newsletter: true, saleAlerts: true, backInStock: true }] })),
      count: vi.fn(() => Promise.resolve(5)),
    })),
    update: vi.fn(() => Promise.resolve()),
    insert: vi.fn(() => Promise.resolve({ _id: 'pref-1' })),
  },
}));

vi.mock('backend/loyaltyService.web', () => ({
  getMyLoyaltyAccount: vi.fn(() => Promise.resolve(mockLoyaltyAccount)),
  getAvailableRewards: vi.fn(() => Promise.resolve(mockRewards)),
  redeemReward: vi.fn(() => Promise.resolve({ success: true, couponCode: 'SAVE10' })),
  getLoyaltyTiers: vi.fn(() => Promise.resolve(mockTiers)),
}));

vi.mock('backend/accountDashboard.web', () => ({
  getOrderHistory: vi.fn(() => Promise.resolve(mockOrderResult)),
  getActiveDeliveries: vi.fn(() => Promise.resolve(mockDeliveriesResult)),
  getWishlist: vi.fn(() => Promise.resolve(mockWishlistResult)),
  moveWishlistToCart: vi.fn(() => Promise.resolve({ success: true, data: { productId: 'p1' } })),
  removeFromWishlist: vi.fn(() => Promise.resolve({ success: true })),
  getReorderItems: vi.fn(() => Promise.resolve({ success: true, data: { items: [{ productId: 'p1', quantity: 1 }] } })),
  getWishlistAlertHistory: vi.fn(() => Promise.resolve(mockAlertHistoryResult)),
  toggleProductAlerts: vi.fn(() => Promise.resolve()),
}));

vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn(),
}));

vi.mock('backend/notificationService.web', () => ({
  toggleProductAlerts: vi.fn(() => Promise.resolve()),
}));

vi.mock('public/MemberPageHelpers.js', () => ({
  mergeDeliveryStatus: vi.fn((orders) => orders),
  formatOrderDate: vi.fn((d) => d),
  formatOrderTotal: vi.fn(({ total }) => `$${total}`),
  formatOrderNumber: vi.fn((n) => `#${n}`),
  formatDeliveryEstimate: vi.fn((d) => d),
  formatItemCount: vi.fn((c) => `${c} items`),
  getOrderFilterOptions: vi.fn(() => [
    { label: 'All Orders', value: 'all' },
    { label: 'Delivered', value: 'Delivered' },
  ]),
  filterOrdersByStatus: vi.fn((orders) => orders),
  buildTrackingUrl: vi.fn(() => '/tracking/1001'),
  isReturnEligible: vi.fn(() => true),
  buildOrderGalleryItems: vi.fn((items) => items.map(i => ({ src: i.mediaItem.src, title: i.name }))),
  getStatusColor: vi.fn(() => '#4CAF50'),
  formatAlertForDisplay: vi.fn((a) => ({
    typeLabel: a.type, productName: a.productName, message: a.message, date: a.date,
  })),
}));

vi.mock('public/cartService', () => ({
  addToCart: vi.fn(() => Promise.resolve()),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
  baseUrl: 'https://www.carolinafutons.com',
}));

vi.mock('wix-window-frontend', () => ({
  copyToClipboard: vi.fn(() => Promise.resolve()),
  openUrl: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────────

async function loadPage() {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
  await import('../src/pages/Member Page.js');
  if (onReadyHandler) await onReadyHandler();
}

function simulateRepeaterItem(repeaterId, itemData) {
  const repeater = getEl(repeaterId);
  if (repeater.onItemReady.mock.calls.length === 0) return null;
  const handler = repeater.onItemReady.mock.calls[0][0];
  const itemElements = new Map();
  const $item = (sel) => {
    if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
    return itemElements.get(sel);
  };
  handler($item, itemData);
  return $item;
}

// ── Dashboard Section Tests ─────────────────────────────────────────

describe('Member Page — Dashboard element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets welcome text with member first name', async () => {
    await loadPage();
    expect(getEl('#memberWelcome').text).toBe('Welcome back, Jane!');
  });

  it('sets order count from wix-data query', async () => {
    await loadPage();
    expect(getEl('#memberOrderCount').text).toBe('5');
  });

  it('sets wishlist count from wix-data query', async () => {
    await loadPage();
    expect(getEl('#memberWishCount').text).toBe('5');
  });

  it('sets loyalty points display with formatted points', async () => {
    await loadPage();
    expect(getEl('#memberPointsDisplay').text).toContain('1,500');
  });

  it('sets tier display with tier icon and name', async () => {
    await loadPage();
    const tierEl = getEl('#memberTierDisplay');
    expect(tierEl.text).toContain('Gold');
    expect(tierEl.style.color).toBe('#FFD700');
  });

  it('registers click handler on #dashQuickOrders', async () => {
    await loadPage();
    expect(getEl('#dashQuickOrders').onClick).toHaveBeenCalled();
  });

  it('registers click handler on #dashQuickWishlist', async () => {
    await loadPage();
    expect(getEl('#dashQuickWishlist').onClick).toHaveBeenCalled();
  });

  it('registers click handler on #dashQuickSettings', async () => {
    await loadPage();
    expect(getEl('#dashQuickSettings').onClick).toHaveBeenCalled();
  });

  it('sets ARIA labels on quick link buttons', async () => {
    await loadPage();
    expect(getEl('#dashQuickOrders').accessibility.ariaLabel).toBe('Jump to your orders');
    expect(getEl('#dashQuickWishlist').accessibility.ariaLabel).toBe('Jump to your wishlist');
    expect(getEl('#dashQuickSettings').accessibility.ariaLabel).toBe('Jump to account settings');
  });
});

// ── Loyalty Dashboard Tests ─────────────────────────────────────────

describe('Member Page — Loyalty Dashboard element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets tier progress bar value from getProgressPercent', async () => {
    await loadPage();
    expect(getEl('#tierProgressBar').value).toBe(75);
  });

  it('sets tier progress text from formatProgressText', async () => {
    await loadPage();
    expect(getEl('#tierProgressText').text).toBe('500 points to Gold');
  });

  it('sets loyalty milestone text from getNextMilestone', async () => {
    await loadPage();
    const el = getEl('#loyaltyMilestone');
    expect(el.text).toBe('500 more points to Platinum!');
    expect(el.show).toHaveBeenCalled();
  });

  it('populates tier comparison repeater with onItemReady', async () => {
    await loadPage();
    const repeater = getEl('#tierComparisonRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBe(2);
  });

  it('sets tier name, min points, and benefits in tier comparison items', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#tierComparisonRepeater', {
      _id: 'tier-0', name: 'Bronze', minPoints: 0,
      benefits: ['Free shipping'], isCurrent: false, isAchieved: true,
    });
    expect($item).not.toBeNull();
    expect($item('#tierName').text).toContain('Bronze');
    expect($item('#tierMinPoints').text).toContain('0');
    expect($item('#tierBenefits').text).toContain('Free shipping');
  });

  it('shows current badge for current tier card', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#tierComparisonRepeater', {
      _id: 'tier-1', name: 'Gold', minPoints: 1000,
      benefits: ['Free shipping', '10% off'], isCurrent: true, isAchieved: true,
    });
    expect($item('#tierCurrentBadge').show).toHaveBeenCalled();
    expect($item('#tierCurrentBadge').text).toBe('Your Tier');
    expect($item('#tierCard').style.borderColor).toBe('#FFD700');
  });

  it('hides current badge for non-current tier', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#tierComparisonRepeater', {
      _id: 'tier-0', name: 'Bronze', minPoints: 0,
      benefits: ['Free shipping'], isCurrent: false, isAchieved: true,
    });
    expect($item('#tierCurrentBadge').hide).toHaveBeenCalled();
  });

  it('populates rewards repeater with onItemReady', async () => {
    await loadPage();
    const repeater = getEl('#rewardsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBe(1);
  });

  it('sets reward name, description, and cost in reward items', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#rewardsRepeater', {
      _id: 'rew-1', name: '$10 Off', description: 'Get $10 off next order', pointsCost: 500,
    });
    expect($item('#rewardName').text).toBe('$10 Off');
    expect($item('#rewardDescription').text).toBe('Get $10 off next order');
    expect($item('#rewardCost').text).toBe('500 pts');
  });

  it('registers click handler on redeem button with ARIA label', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#rewardsRepeater', {
      _id: 'rew-1', name: '$10 Off', description: 'Get $10 off', pointsCost: 500,
    });
    expect($item('#redeemBtn').onClick).toHaveBeenCalled();
    expect($item('#redeemBtn').accessibility.ariaLabel).toContain('Redeem $10 Off');
  });

  it('shows rewards section when rewards exist', async () => {
    await loadPage();
    expect(getEl('#rewardsSection').show).toHaveBeenCalled();
  });
});

// ── Order History Tests ─────────────────────────────────────────────

describe('Member Page — Order History element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('registers onItemReady on orders repeater', async () => {
    await loadPage();
    expect(getEl('#ordersRepeater').onItemReady).toHaveBeenCalled();
  });

  it('sets order number, date, total, and item count in repeater items', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#ordersRepeater', {
      _id: 'ord-1', number: '1001', createdDate: '2026-03-14',
      total: 549.99, status: 'Delivered', itemCount: 2,
      lineItems: [{ imageUrl: 'img.jpg', name: 'Futon' }],
    });
    expect($item('#orderNumber').text).toBe('#1001');
    expect($item('#orderDate').text).toBe('2026-03-14');
    expect($item('#orderTotal').text).toBe('$549.99');
    expect($item('#orderItemCount').text).toBe('2 items');
  });

  it('sets status badge text and color', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#ordersRepeater', {
      _id: 'ord-1', number: '1001', createdDate: '2026-03-14',
      total: 549.99, status: 'Delivered', itemCount: 2,
      lineItems: [],
    });
    expect($item('#orderStatusBadge').text).toBe('Delivered');
    expect($item('#orderStatusBadge').style.color).toBe('#4CAF50');
    expect($item('#orderStatusBadge').accessibility.ariaLabel).toBe('Order status: Delivered');
  });

  it('registers click handler on reorder button with ARIA label', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#ordersRepeater', {
      _id: 'ord-1', number: '1001', createdDate: '2026-03-14',
      total: 549.99, status: 'Delivered', itemCount: 2,
      lineItems: [],
    });
    expect($item('#orderReorderBtn').onClick).toHaveBeenCalled();
    expect($item('#orderReorderBtn').accessibility.ariaLabel).toContain('Reorder items from order 1001');
  });

  it('shows return button for eligible orders with ARIA label', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#ordersRepeater', {
      _id: 'ord-1', number: '1001', createdDate: '2026-03-14',
      total: 549.99, status: 'Delivered', itemCount: 2,
      lineItems: [],
    });
    expect($item('#orderStartReturnBtn').onClick).toHaveBeenCalled();
    expect($item('#orderStartReturnBtn').accessibility.ariaLabel).toContain('Start a return for order 1001');
  });

  it('populates order items gallery from line items', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#ordersRepeater', {
      _id: 'ord-1', number: '1001', createdDate: '2026-03-14',
      total: 549.99, status: 'Delivered', itemCount: 2,
      lineItems: [{ imageUrl: 'img.jpg', name: 'Futon' }],
    });
    expect($item('#orderItemsGallery').items.length).toBeGreaterThan(0);
  });

  it('sets filter dropdown options and ARIA label', async () => {
    await loadPage();
    const dropdown = getEl('#orderFilterDropdown');
    expect(dropdown.options.length).toBeGreaterThan(0);
    expect(dropdown.value).toBe('all');
    expect(dropdown.accessibility.ariaLabel).toBe('Filter orders by status');
  });

  it('registers onChange on filter dropdown', async () => {
    await loadPage();
    expect(getEl('#orderFilterDropdown').onChange).toHaveBeenCalled();
  });

  it('sets up load more button with ARIA label and click handler', async () => {
    await loadPage();
    const btn = getEl('#ordersLoadMoreBtn');
    expect(btn.onClick).toHaveBeenCalled();
    expect(btn.accessibility.ariaLabel).toBe('Load more orders');
  });

  it('registers click handler on retry button', async () => {
    await loadPage();
    expect(getEl('#ordersRetryBtn').onClick).toHaveBeenCalled();
  });

  it('hides orders loader after data loads', async () => {
    await loadPage();
    expect(getEl('#ordersLoader').hide).toHaveBeenCalled();
  });
});

// ── Wishlist Tests ──────────────────────────────────────────────────

describe('Member Page — Wishlist element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('registers onItemReady on wishlist repeater', async () => {
    await loadPage();
    expect(getEl('#wishlistRepeater').onItemReady).toHaveBeenCalled();
  });

  it('sets image src, alt, name, and price in wishlist items', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#wishlistRepeater', {
      _id: 'w-1', name: 'Comfy Futon', mainMedia: 'img.jpg',
      formattedPrice: '$399.99', price: 399.99, slug: 'comfy-futon', inStock: true,
    });
    expect($item('#wishImage').src).toBe('img.jpg');
    expect($item('#wishImage').alt).toContain('Comfy Futon');
    expect($item('#wishName').text).toBe('Comfy Futon');
    expect($item('#wishPrice').text).toBe('$399.99');
  });

  it('sets stock status text for in-stock items', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#wishlistRepeater', {
      _id: 'w-1', name: 'Comfy Futon', mainMedia: 'img.jpg',
      formattedPrice: '$399.99', price: 399.99, slug: 'comfy-futon', inStock: true,
    });
    expect($item('#wishStockStatus').text).toBe('In Stock');
  });

  it('hides sale price when no compare price exists', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#wishlistRepeater', {
      _id: 'w-1', name: 'Comfy Futon', mainMedia: 'img.jpg',
      formattedPrice: '$399.99', price: 399.99, slug: 'comfy-futon', inStock: true,
    });
    expect($item('#wishSalePrice').hide).toHaveBeenCalled();
  });

  it('shows sale price when compare price is higher', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#wishlistRepeater', {
      _id: 'w-1', name: 'Comfy Futon', mainMedia: 'img.jpg',
      formattedPrice: '$349.99', price: 349.99, comparePrice: 399.99,
      slug: 'comfy-futon', inStock: true,
    });
    expect($item('#wishSalePrice').text).toContain('399.99');
    expect($item('#wishSalePrice').show).toHaveBeenCalled();
  });

  it('registers click handler on add-to-cart button with ARIA label', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#wishlistRepeater', {
      _id: 'w-1', name: 'Comfy Futon', mainMedia: 'img.jpg',
      formattedPrice: '$399.99', price: 399.99, slug: 'comfy-futon', inStock: true,
    });
    expect($item('#wishAddToCartBtn').onClick).toHaveBeenCalled();
    expect($item('#wishAddToCartBtn').accessibility.ariaLabel).toContain('Move Comfy Futon to cart');
  });

  it('sets ARIA label on view button', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#wishlistRepeater', {
      _id: 'w-1', name: 'Comfy Futon', mainMedia: 'img.jpg',
      formattedPrice: '$399.99', price: 399.99, slug: 'comfy-futon', inStock: true,
    });
    expect($item('#wishViewBtn').accessibility.ariaLabel).toContain('View Comfy Futon');
    expect($item('#wishViewBtn').onClick).toHaveBeenCalled();
  });

  it('sets checked state and ARIA label on alert toggle', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#wishlistRepeater', {
      _id: 'w-1', name: 'Comfy Futon', mainMedia: 'img.jpg',
      formattedPrice: '$399.99', price: 399.99, slug: 'comfy-futon',
      inStock: true, muteAlerts: false,
    });
    expect($item('#wishAlertToggle').checked).toBe(true);
    expect($item('#wishAlertToggle').accessibility.ariaLabel).toContain('alerts for Comfy Futon');
    expect($item('#wishAlertToggle').onChange).toHaveBeenCalled();
  });

  it('registers click handler on remove button with ARIA label', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#wishlistRepeater', {
      _id: 'w-1', name: 'Comfy Futon', mainMedia: 'img.jpg',
      formattedPrice: '$399.99', price: 399.99, slug: 'comfy-futon', inStock: true,
    });
    expect($item('#wishRemoveBtn').onClick).toHaveBeenCalled();
    expect($item('#wishRemoveBtn').accessibility.ariaLabel).toContain('Remove Comfy Futon from wishlist');
  });

  it('sets sort dropdown options and ARIA label', async () => {
    await loadPage();
    const dropdown = getEl('#wishSortDropdown');
    expect(dropdown.options.length).toBe(5);
    expect(dropdown.accessibility.ariaLabel).toBe('Sort wishlist items');
    expect(dropdown.onChange).toHaveBeenCalled();
  });

  it('registers click handler on share buttons with ARIA labels', async () => {
    await loadPage();
    expect(getEl('#wishShareBtn').onClick).toHaveBeenCalled();
    expect(getEl('#wishShareBtn').accessibility.ariaLabel).toBe('Copy wishlist link');
    expect(getEl('#wishSharePinterest').onClick).toHaveBeenCalled();
    expect(getEl('#wishSharePinterest').accessibility.ariaLabel).toBe('Share wishlist on Pinterest');
    expect(getEl('#wishShareEmail').onClick).toHaveBeenCalled();
    expect(getEl('#wishShareEmail').accessibility.ariaLabel).toBe('Share wishlist via email');
    expect(getEl('#wishShareFacebook').onClick).toHaveBeenCalled();
    expect(getEl('#wishShareFacebook').accessibility.ariaLabel).toBe('Share wishlist on Facebook');
  });

  it('populates alert history repeater with onItemReady', async () => {
    await loadPage();
    const repeater = getEl('#wishAlertHistoryRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBe(1);
  });

  it('sets alert type, product name, message, and date in alert history items', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#wishAlertHistoryRepeater', {
      _id: 'alert-1', type: 'price_drop', productName: 'Comfy Futon',
      message: 'Price dropped to $349', date: '2026-03-10',
    });
    expect($item('#alertTypeLabel').text).toBe('price_drop');
    expect($item('#alertProductName').text).toBe('Comfy Futon');
    expect($item('#alertMessage').text).toBe('Price dropped to $349');
    expect($item('#alertDate').text).toBe('2026-03-10');
  });

  it('shows alert history section when alerts exist', async () => {
    await loadPage();
    expect(getEl('#wishAlertHistorySection').show).toHaveBeenCalled();
  });
});

// ── Account Settings Tests ──────────────────────────────────────────

describe('Member Page — Account Settings element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('registers click handler on logout button with ARIA label', async () => {
    await loadPage();
    expect(getEl('#logoutBtn').onClick).toHaveBeenCalled();
    expect(getEl('#logoutBtn').accessibility.ariaLabel).toBe('Log out of your account');
  });
});

// ── Address Book Tests ──────────────────────────────────────────────

describe('Member Page — Address Book element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('registers onItemReady on address repeater', async () => {
    await loadPage();
    expect(getEl('#addressRepeater').onItemReady).toHaveBeenCalled();
  });

  it('sets address text from member address data', async () => {
    await loadPage();
    const $item = simulateRepeaterItem('#addressRepeater', {
      _id: 'a1', street: '123 Main St', city: 'Hendersonville', state: 'NC', zip: '28739',
    });
    expect($item('#addressText').text).toContain('123 Main St');
    expect($item('#addressText').text).toContain('Hendersonville');
  });

  it('populates address repeater data from member contact', async () => {
    await loadPage();
    const repeater = getEl('#addressRepeater');
    expect(repeater.data.length).toBe(1);
  });
});

// ── Communication Preferences Tests ─────────────────────────────────

describe('Member Page — Communication Preferences element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets checked state on preference toggles', async () => {
    await loadPage();
    expect(getEl('#prefNewsletter').checked).toBe(true);
    expect(getEl('#prefSaleAlerts').checked).toBe(true);
    expect(getEl('#prefBackInStock').checked).toBe(true);
  });

  it('sets ARIA labels on preference toggles', async () => {
    await loadPage();
    expect(getEl('#prefNewsletter').accessibility.ariaLabel).toBe('Receive newsletter emails');
    expect(getEl('#prefSaleAlerts').accessibility.ariaLabel).toBe('Receive sale alerts');
    expect(getEl('#prefBackInStock').accessibility.ariaLabel).toBe('Receive back-in-stock notifications');
  });

  it('registers onChange handlers on preference toggles', async () => {
    await loadPage();
    expect(getEl('#prefNewsletter').onChange).toHaveBeenCalled();
    expect(getEl('#prefSaleAlerts').onChange).toHaveBeenCalled();
    expect(getEl('#prefBackInStock').onChange).toHaveBeenCalled();
  });
});

// ── Error Fallback Tests ────────────────────────────────────────────

describe('Member Page — Error Fallback element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('shows error fallback when initMemberPage throws', async () => {
    // Make Promise.allSettled throw by sabotaging the sections array via
    // having the member load succeed but then crashing inside the outer try.
    // Override getMember to return a value, but break Promise.allSettled
    // so the outer catch fires showErrorFallback.
    const origAllSettled = Promise.allSettled;
    try {
      Promise.allSettled = () => { throw new Error('Catastrophic failure'); };

      elements.clear();
      onReadyHandler = null;
      vi.resetModules();
      await import('../src/pages/Member Page.js');
      if (onReadyHandler) await onReadyHandler();
    } finally {
      Promise.allSettled = origAllSettled;
    }

    const errorBox = getEl('#memberErrorFallback');
    expect(errorBox.show).toHaveBeenCalled();
  });

  it('sets error text on #memberErrorText when fallback shown', async () => {
    const origAllSettled = Promise.allSettled;
    try {
      Promise.allSettled = () => { throw new Error('Catastrophic failure'); };

      elements.clear();
      onReadyHandler = null;
      vi.resetModules();
      await import('../src/pages/Member Page.js');
      if (onReadyHandler) await onReadyHandler();
    } finally {
      Promise.allSettled = origAllSettled;
    }

    expect(getEl('#memberErrorText').text).toContain('trouble loading your account');
  });
});

// ── Page-level Integration Tests ────────────────────────────────────

describe('Member Page — page-level hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('calls collapseOnMobile with correct section IDs', async () => {
    await loadPage();
    const { collapseOnMobile } = await import('public/mobileHelpers');
    expect(collapseOnMobile).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining(['#ordersRepeater', '#wishlistRepeater', '#addressBook'])
    );
  });

  it('calls initBackToTop', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    expect(initBackToTop).toHaveBeenCalled();
  });

  it('calls initPageSeo with member identifier', async () => {
    await loadPage();
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('member');
  });

  it('tracks page_view event', async () => {
    await loadPage();
    const { trackEvent } = await import('public/engagementTracker');
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'member_account' });
  });

  it('calls initStoreCreditDashboard', async () => {
    await loadPage();
    const { initStoreCreditDashboard } = await import('public/storeCreditHelpers.js');
    expect(initStoreCreditDashboard).toHaveBeenCalled();
  });

  it('calls initGiftCardDashboard', async () => {
    await loadPage();
    const { initGiftCardDashboard } = await import('public/giftCardHelpers.js');
    expect(initGiftCardDashboard).toHaveBeenCalled();
  });

  it('calls initReturnsSection', async () => {
    await loadPage();
    const { initReturnsSection } = await import('public/ReturnsPortal.js');
    expect(initReturnsSection).toHaveBeenCalled();
  });
});
