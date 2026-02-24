// AddToCart.js - Quantity, cart, sticky bar, bundle, stock, wishlist
import { getProductVariants, addToCart, onCartChanged, clampQuantity, MIN_QUANTITY, MAX_QUANTITY } from 'public/cartService';
import { getBundleSuggestion } from 'backend/productRecommendations.web';
import { trackCartAdd } from 'public/engagementTracker';
import { fireAddToCart, fireAddToWishlist } from 'public/ga4Tracking';
import { formatCurrency, HEART_FILLED_SVG, HEART_OUTLINE_SVG } from 'public/productPageUtils.js';
import wixWindowFrontend from 'wix-window-frontend';
import { validateEmail } from 'public/validators.js';

// ── Quantity Selector ─────────────────────────────────────────────────

export function initQuantitySelector($w, state) {
  try {
    const input = $w('#quantityInput');
    if (!input) return;
    input.value = '1';
    state.selectedQuantity = 1;
    try { input.accessibility.ariaLabel = 'Product quantity'; } catch (e) {}
    try { $w('#quantityMinus').accessibility.ariaLabel = 'Decrease quantity'; } catch (e) {}
    try { $w('#quantityPlus').accessibility.ariaLabel = 'Increase quantity'; } catch (e) {}
    input.onInput(() => {
      state.selectedQuantity = clampQuantity(input.value);
      input.value = String(state.selectedQuantity);
    });
    try { $w('#quantityMinus').onClick(() => {
      if (state.selectedQuantity > MIN_QUANTITY) { state.selectedQuantity--; input.value = String(state.selectedQuantity); }
    }); } catch (e) {}
    try { $w('#quantityPlus').onClick(() => {
      if (state.selectedQuantity < MAX_QUANTITY) { state.selectedQuantity++; input.value = String(state.selectedQuantity); }
    }); } catch (e) {}
  } catch (e) {}
}

// ── Add to Cart Button ────────────────────────────────────────────────

export function initAddToCartEnhancements($w, state) {
  try {
    const btn = $w('#addToCartButton');
    if (!btn) return;
    btn.onClick(async () => {
      if (!state.product) return;
      try {
        btn.disable(); btn.label = 'Adding...';
        await addToCart(state.product._id, state.selectedQuantity);
        trackCartAdd(state.product, state.selectedQuantity);
        fireAddToCart(state.product, state.selectedQuantity);
        btn.label = 'Added!';
      } catch (err) {
        console.error('Error adding to cart:', err);
        btn.label = 'Error \u2014 Try Again';
      }
      setTimeout(() => { try { btn.label = 'Add to Cart'; btn.enable(); } catch (e) {} }, 3000);
    });
    onCartChanged(() => {
      try {
        const box = $w('#addToCartSuccess');
        if (box) { box.show('fade', { duration: 300 }); setTimeout(() => box.hide('fade', { duration: 300 }), 4000); }
      } catch (e) {}
    });
  } catch (e) {}
}

// ── Sticky Cart Bar ───────────────────────────────────────────────────

export function updateStickyPrice($w, variant) {
  try { if (variant?.price) $w('#stickyPrice').text = formatCurrency(variant.price); } catch (e) {}
}

export function initStickyCartBar($w, state) {
  try {
    const bar = $w('#stickyCartBar');
    if (!bar) return;
    bar.hide();
    if (state.product) {
      try { $w('#stickyProductName').text = state.product.name; } catch (e) {}
      try { $w('#stickyPrice').text = state.product.formattedPrice; } catch (e) {}
    }
    try { $w('#stickyAddBtn').onClick(async () => {
      try {
        $w('#stickyAddBtn').disable(); $w('#stickyAddBtn').label = 'Adding...';
        await addToCart(state.product._id, state.selectedQuantity);
        trackCartAdd(state.product, state.selectedQuantity);
        fireAddToCart(state.product, state.selectedQuantity);
        $w('#stickyAddBtn').label = 'Added!';
      } catch (err) { $w('#stickyAddBtn').label = 'Error \u2014 Try Again'; }
      setTimeout(() => { try { $w('#stickyAddBtn').label = 'Add to Cart'; $w('#stickyAddBtn').enable(); } catch (e) {} }, 3000);
    }); } catch (e) {}
    let stickyVisible = false;
    wixWindowFrontend.onScroll(async () => {
      try {
        const bounds = await $w('#addToCartButton').getBoundingRect();
        if (bounds.top < 0 && !stickyVisible) { stickyVisible = true; bar.show('slide', { direction: 'bottom', duration: 250 }); }
        else if (bounds.top >= 0 && stickyVisible) { stickyVisible = false; bar.hide('slide', { direction: 'bottom', duration: 250 }); }
      } catch (e) {}
    });
  } catch (e) {}
}

// ── Bundle Section ────────────────────────────────────────────────────

export async function initBundleSection($w, state) {
  try {
    if (!state.product) return;
    const bundle = await getBundleSuggestion(state.product._id);
    if (!bundle?.product) { try { $w('#bundleSection').collapse(); } catch (e) {} return; }
    state.bundleProduct = bundle.product;
    try {
      $w('#bundleSection').expand();
      $w('#bundleImage').src = bundle.product.mainMedia;
      $w('#bundleImage').alt = bundle.product.name + ' \u2014 bundle suggestion';
      $w('#bundleName').text = bundle.product.name;
      $w('#bundlePrice').text = formatCurrency(bundle.bundlePrice);
      $w('#bundleSavings').text = `Save ${formatCurrency(bundle.savings)}`;
    } catch (e) {}
    try { $w('#addBundleBtn').onClick(async () => {
      try {
        $w('#addBundleBtn').disable(); $w('#addBundleBtn').label = 'Adding...';
        await addToCart(state.product._id, state.selectedQuantity);
        await addToCart(bundle.product._id, 1);
        $w('#addBundleBtn').label = 'Bundle Added!';
        trackCartAdd(state.product, state.selectedQuantity);
        fireAddToCart(state.product, state.selectedQuantity);
      } catch (err) { $w('#addBundleBtn').label = 'Error \u2014 Try Again'; }
      setTimeout(() => { try { $w('#addBundleBtn').label = 'Add Both to Cart'; $w('#addBundleBtn').enable(); } catch (e) {} }, 3000);
    }); } catch (e) {}
    const nav = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${bundle.product.slug}`));
    try { $w('#bundleImage').onClick(nav); } catch (e) {}
    try { $w('#bundleName').onClick(nav); } catch (e) {}
  } catch (err) { console.error('Error loading bundle section:', err); }
}

// ── Stock Urgency ─────────────────────────────────────────────────────

export async function initStockUrgency($w, state) {
  try {
    if (!state.product) return;
    try {
      const el = $w('#stockUrgency');
      if (el && state.product.quantityInStock != null && state.product.quantityInStock < 5 && state.product.quantityInStock > 0) {
        el.text = `Only ${state.product.quantityInStock} left in stock`; el.show();
      } else if (el) { el.hide(); }
    } catch (e) {}
    try {
      const badge = $w('#popularityBadge');
      if (badge) {
        const mod = await import('wix-data');
        const res = await mod.default.query('ProductAnalytics').eq('productId', state.product._id).find();
        const weekSales = res.items.length > 0 ? Number(res.items[0].weekSales) : 0;
        if (weekSales > 0 && isFinite(weekSales)) { badge.text = `Popular \u2014 ${weekSales} sold this week`; badge.show(); }
        else { badge.hide(); }
      }
    } catch (e) { console.error('[AddToCart] Error loading popularity badge:', e.message); try { $w('#popularityBadge').hide(); } catch (e2) {} }
  } catch (e) {}
}

// ── Back-in-Stock Notification ────────────────────────────────────────

export async function initBackInStockNotification($w, state) {
  try {
    const section = $w('#backInStockSection');
    const emailInput = $w('#backInStockEmail');
    const submitBtn = $w('#backInStockBtn');
    const successMsg = $w('#backInStockSuccess');
    if (!section || !emailInput || !submitBtn) return;
    section.collapse();
    if (successMsg) successMsg.hide();
    checkBackInStock($w, state, section);
    try { $w('#sizeDropdown').onChange(() => checkBackInStock($w, state, section)); } catch (e) {}
    try { $w('#finishDropdown').onChange(() => checkBackInStock($w, state, section)); } catch (e) {}
    // For logged-in members with item in wishlist, show auto-enrolled message
    try {
      const { currentMember } = await import('wix-members-frontend');
      const member = await currentMember.getMember();
      if (member) {
        const wixData = (await import('wix-data')).default;
        const wishlistCheck = await wixData.query('Wishlist').eq('memberId', member._id).eq('productId', state.product?._id).find();
        if (wishlistCheck.items.length > 0 && wishlistCheck.items[0].muteAlerts !== true) {
          submitBtn.hide(); emailInput.hide();
          if (successMsg) { successMsg.text = "You'll be notified when this item is back — it's in your wishlist."; successMsg.show(); }
          return;
        }
      }
    } catch (e) { /* Fall through to email form */ }
    submitBtn.onClick(async () => {
      const email = emailInput.value?.trim();
      if (!email || !validateEmail(email)) return;
      try {
        const { submitContactForm } = await import('backend/contactSubmissions.web');
        await submitContactForm({ email, source: 'back_in_stock', status: 'back_in_stock_request', productId: state.product?._id || '', productName: state.product?.name || '', notes: `Back in stock request for ${state.product?.name || 'unknown product'}` });
        submitBtn.hide(); emailInput.hide();
        if (successMsg) { successMsg.text = "We'll email you when this item is back in stock!"; successMsg.show('fade', { duration: 300 }); }
      } catch (err) { console.error('Back in stock submission error:', err); }
    });
  } catch (e) {}
}

async function checkBackInStock($w, state, section) {
  try {
    const size = $w('#sizeDropdown')?.value;
    const finish = $w('#finishDropdown')?.value;
    if (!size && !finish) {
      const badge = $w('#stockStatus');
      if (badge?.text === 'Special Order') section.expand();
      return;
    }
    const choices = {};
    if (size) choices['Size'] = size;
    if (finish) choices['Finish'] = finish;
    const variants = await getProductVariants(state.product._id, choices);
    if (variants?.length > 0 && !variants[0].inStock) section.expand();
    else section.collapse();
  } catch (e) {}
}

// ── Wishlist ──────────────────────────────────────────────────────────

export async function initWishlistButton($w, state) {
  try {
    const btn = $w('#wishlistBtn');
    if (!btn || !state.product) return;
    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember();
    if (member) {
      try {
        const wixData = (await import('wix-data')).default;
        const existing = await wixData.query('Wishlist').eq('memberId', member._id).eq('productId', state.product._id).find();
        if (existing.items.length > 0) setWishlistActive($w, true);
      } catch (e) { console.error('[AddToCart] Error checking wishlist status:', e.message); }
    }
    btn.onClick(async () => {
      const { currentMember: cm, authentication } = await import('wix-members-frontend');
      const m = await cm.getMember();
      if (!m) { authentication.promptLogin(); return; }
      const wixData = (await import('wix-data')).default;
      const existing = await wixData.query('Wishlist').eq('memberId', m._id).eq('productId', state.product._id).find();
      if (existing.items.length > 0) {
        await wixData.remove('Wishlist', existing.items[0]._id);
        setWishlistActive($w, false);
      } else {
        await wixData.insert('Wishlist', { memberId: m._id, productId: state.product._id, productName: state.product.name, productImage: state.product.mainMedia, addedDate: new Date() });
        setWishlistActive($w, true);
        fireAddToWishlist(state.product);
      }
    });
  } catch (e) { console.error('[AddToCart] Wishlist operation failed:', e.message); try { $w('#wishlistBtn').hide(); } catch (e2) {} }
}

function setWishlistActive($w, active) {
  try {
    const icon = $w('#wishlistIcon');
    if (icon) icon.src = active ? HEART_FILLED_SVG : HEART_OUTLINE_SVG;
    try { $w('#wishlistBtn').accessibility.ariaLabel = active ? 'Remove from wishlist' : 'Add to wishlist'; } catch (e) {}
  } catch (e) {}
}
