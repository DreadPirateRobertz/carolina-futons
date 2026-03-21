/**
 * Tests for public/miniCartDrawer.js
 * Covers: open/close, repeater rendering, qty update, remove, empty state,
 * subtotal, cart count badge, checkout/view-cart navigation, a11y.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockElement, createItemScope } from './helpers/wixMocks.js';

// ── $w Mock ──────────────────────────────────────────────────────────

let elements;
let $w;

function resetElements() {
  elements = new Map();
  $w = (sel) => {
    if (!elements.has(sel)) elements.set(sel, createMockElement());
    return elements.get(sel);
  };
}

// ── Module Mocks ─────────────────────────────────────────────────────

const mockGetCurrentCart = vi.fn();
const mockUpdateCartItemQuantity = vi.fn();
const mockRemoveCartItem = vi.fn();
const mockOnCartChanged = vi.fn();
const mockAnnounce = vi.fn();
const mockIsMobile = vi.fn(() => false);
const mockWixTo = vi.fn();

vi.mock('public/cartService', () => ({
  getCurrentCart: (...args) => mockGetCurrentCart(...args),
  updateCartItemQuantity: (...args) => mockUpdateCartItemQuantity(...args),
  removeCartItem: (...args) => mockRemoveCartItem(...args),
  onCartChanged: (...args) => mockOnCartChanged(...args),
  safeMultiply: (price, qty) => Math.round(price * qty * 100) / 100,
  clampQuantity: (qty) => Math.max(1, Math.min(99, parseInt(qty, 10) || 1)),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: (...args) => mockAnnounce(...args),
  makeClickable: vi.fn((el, fn) => { el.onClick(fn); }),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: (...args) => mockIsMobile(...args),
}));

vi.mock('wix-location-frontend', () => ({
  default: { to: (...args) => mockWixTo(...args) },
}));

// ── Import Module ────────────────────────────────────────────────────
// Import once at module level per page-test pattern (feedback_page_test_pattern)

import {
  initMiniCartDrawer,
  openMiniCart,
  closeMiniCart,
  renderCartItems,
  updateCartCount,
  clearAll,
} from '../src/public/miniCartDrawer.js';

// ── Fixtures ─────────────────────────────────────────────────────────

function makeCart(overrides = {}) {
  return {
    lineItems: [
      {
        _id: 'item-1',
        quantity: 2,
        product: {
          name: 'Futon Frame',
          mediaItems: [{ src: 'wix:image://v1/abc.jpg' }],
        },
        priceData: { price: 199.99 },
      },
      {
        _id: 'item-2',
        quantity: 1,
        product: {
          name: 'Futon Mattress',
          mediaItems: [{ src: 'wix:image://v1/def.jpg' }],
        },
        priceData: { price: 149.5 },
      },
    ],
    ...overrides,
  };
}

function emptyCart() {
  return { lineItems: [] };
}

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  resetElements();
  clearAll();
  mockGetCurrentCart.mockReset();
  mockUpdateCartItemQuantity.mockReset();
  mockRemoveCartItem.mockReset();
  mockOnCartChanged.mockReset();
  mockAnnounce.mockReset();
  mockWixTo.mockReset();
  mockIsMobile.mockReturnValue(false);
});

// ── initMiniCartDrawer ───────────────────────────────────────────────

describe('initMiniCartDrawer', () => {
  it('hides drawer and overlay on init', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartDrawer').hide).toHaveBeenCalled();
    expect($w('#miniCartOverlay').hide).toHaveBeenCalled();
  });

  it('sets ARIA dialog attributes on drawer', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartDrawer').accessibility.role).toBe('dialog');
    expect($w('#miniCartDrawer').accessibility.ariaModal).toBe(true);
    expect($w('#miniCartDrawer').accessibility.ariaLabel).toBe('Shopping cart');
  });

  it('sets ARIA live region on subtotal', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartSubtotal').accessibility.ariaLive).toBe('polite');
  });

  it('wires close button onClick', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartClose').onClick).toHaveBeenCalled();
  });

  it('wires overlay onClick to close', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartOverlay').onClick).toHaveBeenCalled();
  });

  it('wires checkout button onClick', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartCheckoutBtn').onClick).toHaveBeenCalled();
  });

  it('wires view-cart button onClick', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartViewBtn').onClick).toHaveBeenCalled();
  });

  it('close button sets ariaLabel', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartClose').accessibility.ariaLabel).toBe('Close cart');
  });

  it('checkout button sets ariaLabel', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartCheckoutBtn').accessibility.ariaLabel).toBe('Proceed to checkout');
  });
});

// ── openMiniCart ─────────────────────────────────────────────────────

describe('openMiniCart', () => {
  it('shows drawer and overlay', () => {
    const cart = makeCart();
    openMiniCart($w, cart);
    expect($w('#miniCartDrawer').show).toHaveBeenCalled();
    expect($w('#miniCartOverlay').show).toHaveBeenCalled();
  });

  it('shows drawer with slide animation on desktop', () => {
    mockIsMobile.mockReturnValue(false);
    const cart = makeCart();
    openMiniCart($w, cart);
    const [effect] = $w('#miniCartDrawer').show.mock.calls[0];
    expect(effect).toBe('slide');
  });

  it('shows drawer with slide from bottom on mobile', () => {
    mockIsMobile.mockReturnValue(true);
    const cart = makeCart();
    openMiniCart($w, cart);
    const [effect, opts] = $w('#miniCartDrawer').show.mock.calls[0];
    expect(effect).toBe('slide');
    expect(opts?.direction).toBe('bottom');
  });

  it('updates subtotal text from cart line items', () => {
    const cart = makeCart();
    openMiniCart($w, cart);
    // 199.99 * 2 + 149.50 * 1 = 549.48
    expect($w('#miniCartSubtotal').text).toContain('549.48');
  });

  it('updates cart count element', () => {
    const cart = makeCart(); // 2+1=3 items
    openMiniCart($w, cart);
    expect($w('#cartItemCount').text).toBe('3');
  });

  it('announces drawer open to screen readers', () => {
    const cart = makeCart();
    openMiniCart($w, cart);
    expect(mockAnnounce).toHaveBeenCalledWith($w, 'Cart opened with 3 items');
  });

  it('focuses close button after opening', () => {
    const cart = makeCart();
    openMiniCart($w, cart);
    expect($w('#miniCartClose').focus).toHaveBeenCalled();
  });
});

// ── closeMiniCart ────────────────────────────────────────────────────

describe('closeMiniCart', () => {
  it('hides drawer and overlay', () => {
    closeMiniCart($w);
    expect($w('#miniCartDrawer').hide).toHaveBeenCalled();
    expect($w('#miniCartOverlay').hide).toHaveBeenCalled();
  });

  it('announces close to screen readers', () => {
    closeMiniCart($w);
    expect(mockAnnounce).toHaveBeenCalledWith($w, 'Cart closed');
  });

  it('uses slide animation to close on desktop', () => {
    mockIsMobile.mockReturnValue(false);
    closeMiniCart($w);
    const [effect] = $w('#miniCartDrawer').hide.mock.calls[0];
    expect(effect).toBe('slide');
  });
});

// ── renderCartItems ──────────────────────────────────────────────────

describe('renderCartItems — with items', () => {
  it('sets repeater data from line items', () => {
    const cart = makeCart();
    renderCartItems($w, cart.lineItems);
    const repeater = $w('#miniCartRepeater');
    expect(repeater.data).toHaveLength(2);
    expect(repeater.data[0]._id).toBe('item-1');
    expect(repeater.data[1]._id).toBe('item-2');
  });

  it('shows repeater and hides empty state', () => {
    renderCartItems($w, makeCart().lineItems);
    expect($w('#miniCartRepeater').show).toHaveBeenCalled();
    expect($w('#miniCartEmpty').hide).toHaveBeenCalled();
  });

  it('registers onItemReady handler', () => {
    renderCartItems($w, makeCart().lineItems);
    expect($w('#miniCartRepeater').onItemReady).toHaveBeenCalled();
  });

  it('onItemReady sets image src and alt', () => {
    renderCartItems($w, makeCart().lineItems);
    const { $item } = createItemScope();
    const handler = $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'Futon Frame', mediaItems: [{ src: 'wix:image://v1/abc.jpg' }] }, priceData: { price: 199.99 } };
    handler($item, itemData);
    expect($item('#cartItemImage').src).toBe('wix:image://v1/abc.jpg');
    expect($item('#cartItemImage').alt).toBe('Futon Frame');
  });

  it('onItemReady sets name text', () => {
    renderCartItems($w, makeCart().lineItems);
    const { $item } = createItemScope();
    const handler = $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'Futon Frame', mediaItems: [{ src: 'img.jpg' }] }, priceData: { price: 199.99 } };
    handler($item, itemData);
    expect($item('#cartItemName').text).toBe('Futon Frame');
  });

  it('onItemReady sets price × quantity', () => {
    renderCartItems($w, makeCart().lineItems);
    const { $item } = createItemScope();
    const handler = $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'Futon Frame', mediaItems: [{ src: 'img.jpg' }] }, priceData: { price: 199.99 } };
    handler($item, itemData);
    // 199.99 * 2 = 399.98
    expect($item('#cartItemPrice').text).toContain('399.98');
  });

  it('onItemReady sets qty input value', () => {
    renderCartItems($w, makeCart().lineItems);
    const { $item } = createItemScope();
    const handler = $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
    const itemData = { _id: 'item-1', quantity: 3, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);
    expect($item('#cartItemQty').value).toBe(3);
  });

  it('onItemReady wires qty onChange', () => {
    renderCartItems($w, makeCart().lineItems);
    const { $item } = createItemScope();
    const handler = $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);
    expect($item('#cartItemQty').onChange).toHaveBeenCalled();
  });

  it('onItemReady wires remove button onClick', () => {
    renderCartItems($w, makeCart().lineItems);
    const { $item } = createItemScope();
    const handler = $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
    const itemData = { _id: 'item-2', quantity: 1, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);
    expect($item('#cartItemRemove').onClick).toHaveBeenCalled();
  });

  it('onItemReady sets remove ariaLabel with product name', () => {
    renderCartItems($w, makeCart().lineItems);
    const { $item } = createItemScope();
    const handler = $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
    const itemData = { _id: 'item-1', quantity: 1, product: { name: 'Futon Frame', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);
    expect($item('#cartItemRemove').accessibility.ariaLabel).toBe('Remove Futon Frame from cart');
  });
});

describe('renderCartItems — empty cart', () => {
  it('hides repeater and shows empty state', () => {
    renderCartItems($w, []);
    expect($w('#miniCartRepeater').hide).toHaveBeenCalled();
    expect($w('#miniCartEmpty').show).toHaveBeenCalled();
  });

  it('hides checkout and view-cart buttons when empty', () => {
    renderCartItems($w, []);
    expect($w('#miniCartCheckoutBtn').hide).toHaveBeenCalled();
    expect($w('#miniCartViewBtn').hide).toHaveBeenCalled();
  });

  it('shows checkout and view-cart buttons with items', () => {
    renderCartItems($w, makeCart().lineItems);
    expect($w('#miniCartCheckoutBtn').show).toHaveBeenCalled();
    expect($w('#miniCartViewBtn').show).toHaveBeenCalled();
  });
});

// ── qty update via onChange ───────────────────────────────────────────

describe('qty update via onChange', () => {
  it('calls updateCartItemQuantity with clamped value', async () => {
    mockUpdateCartItemQuantity.mockResolvedValue({ lineItems: [] });
    mockGetCurrentCart.mockResolvedValue(emptyCart());

    renderCartItems($w, makeCart().lineItems);
    const { $item } = createItemScope();
    const handler = $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);

    const qtyChangeHandler = $item('#cartItemQty').onChange.mock.calls[0][0];
    $item('#cartItemQty').value = 5;
    await qtyChangeHandler({ target: { value: 5 } });

    expect(mockUpdateCartItemQuantity).toHaveBeenCalledWith('item-1', 5);
  });

  it('ignores qty change if same as current', async () => {
    renderCartItems($w, makeCart().lineItems);
    const { $item } = createItemScope();
    const handler = $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);

    const qtyChangeHandler = $item('#cartItemQty').onChange.mock.calls[0][0];
    $item('#cartItemQty').value = 2; // same as initial
    await qtyChangeHandler({ target: { value: 2 } });

    expect(mockUpdateCartItemQuantity).not.toHaveBeenCalled();
  });
});

// ── remove item ───────────────────────────────────────────────────────

describe('remove item', () => {
  it('calls removeCartItem and re-renders after removal', async () => {
    const updatedCart = { lineItems: [makeCart().lineItems[1]] };
    mockRemoveCartItem.mockResolvedValue(updatedCart);
    mockGetCurrentCart.mockResolvedValue(updatedCart);

    renderCartItems($w, makeCart().lineItems);
    const { $item } = createItemScope();
    const handler = $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);

    const removeHandler = $item('#cartItemRemove').onClick.mock.calls[0][0];
    await removeHandler();

    expect(mockRemoveCartItem).toHaveBeenCalledWith('item-1');
  });

  it('announces removal to screen readers', async () => {
    const updatedCart = emptyCart();
    mockRemoveCartItem.mockResolvedValue(updatedCart);
    mockGetCurrentCart.mockResolvedValue(updatedCart);

    renderCartItems($w, makeCart().lineItems);
    const { $item } = createItemScope();
    const handler = $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'Futon Frame', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);

    const removeHandler = $item('#cartItemRemove').onClick.mock.calls[0][0];
    await removeHandler();

    expect(mockAnnounce).toHaveBeenCalledWith($w, 'Futon Frame removed from cart');
  });
});

// ── updateCartCount ───────────────────────────────────────────────────

describe('updateCartCount', () => {
  it('sets cartItemCount text to item total', () => {
    updateCartCount($w, 5);
    expect($w('#cartItemCount').text).toBe('5');
  });

  it('shows cartItemCount when count > 0', () => {
    updateCartCount($w, 1);
    expect($w('#cartItemCount').show).toHaveBeenCalled();
  });

  it('hides cartItemCount when count is 0', () => {
    updateCartCount($w, 0);
    expect($w('#cartItemCount').hide).toHaveBeenCalled();
  });

  it('sets cartItemCount text to 0 when count is 0', () => {
    updateCartCount($w, 0);
    expect($w('#cartItemCount').text).toBe('0');
  });
});

// ── checkout/view-cart navigation ────────────────────────────────────

describe('checkout navigation', () => {
  it('checkout button navigates to /checkout', () => {
    initMiniCartDrawer($w);
    const checkoutHandler = $w('#miniCartCheckoutBtn').onClick.mock.calls[0][0];
    checkoutHandler();
    expect(mockWixTo).toHaveBeenCalledWith('/checkout');
  });

  it('view-cart button navigates to /cart', () => {
    initMiniCartDrawer($w);
    const viewHandler = $w('#miniCartViewBtn').onClick.mock.calls[0][0];
    viewHandler();
    expect(mockWixTo).toHaveBeenCalledWith('/cart');
  });
});

// ── subtotal calculation ──────────────────────────────────────────────

describe('subtotal calculation', () => {
  it('calculates subtotal as sum of price×qty for all items', () => {
    const lineItems = [
      { _id: 'a', quantity: 3, product: { name: 'A', mediaItems: [{ src: '' }] }, priceData: { price: 10.00 } },
      { _id: 'b', quantity: 2, product: { name: 'B', mediaItems: [{ src: '' }] }, priceData: { price: 25.50 } },
    ];
    openMiniCart($w, { lineItems });
    // 30.00 + 51.00 = 81.00
    expect($w('#miniCartSubtotal').text).toContain('81.00');
  });

  it('shows $0.00 subtotal for empty cart', () => {
    openMiniCart($w, emptyCart());
    expect($w('#miniCartSubtotal').text).toContain('0.00');
  });

  it('guards against missing priceData', () => {
    const lineItems = [
      { _id: 'x', quantity: 1, product: { name: 'X', mediaItems: [{ src: '' }] } }, // no priceData
    ];
    expect(() => openMiniCart($w, { lineItems })).not.toThrow();
    expect($w('#miniCartSubtotal').text).toContain('0.00');
  });
});
