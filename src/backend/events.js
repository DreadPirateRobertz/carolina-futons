/**
 * @module events
 * @description Wix platform event handlers for eCommerce lifecycle events.
 * Populates the AbandonedCarts CMS collection and triggers restock notifications.
 *
 * @requires wix-data
 * @requires backend/emailAutomation.web - triggerRestockNotifications
 *
 * @setup
 * 1. Create `AbandonedCarts` CMS collection with fields:
 *    checkoutId (text), buyerEmail (text), buyerName (text),
 *    cartTotal (number), lineItems (text/JSON), abandonedAt (dateTime),
 *    status (text: abandoned|recovered), recoveryEmailSent (boolean),
 *    recoveryEmailSentAt (dateTime)
 */
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// ── Abandoned Cart Handlers ──────────────────────────────────────────

/**
 * Fired when a checkout is abandoned (customer leaves without completing).
 * Inserts a record into AbandonedCarts for the cart recovery sequence.
 */
export async function wixEcom_onAbandonedCheckoutCreated(event) {
  try {
    const checkout = event.entity || event;
    const checkoutId = checkout._id || checkout.checkoutId || '';
    if (!checkoutId) return;

    const buyerEmail = checkout.buyerInfo?.email || '';
    const buyerName = sanitize(
      checkout.buyerInfo?.firstName ||
      checkout.billingInfo?.firstName ||
      '',
      200,
    );
    const cartTotal = checkout.priceSummary?.total?.amount
      || checkout.totals?.total
      || 0;

    const lineItems = (checkout.lineItems || []).map(item => ({
      name: item.productName?.original || item.name || '',
      quantity: item.quantity || 1,
      price: item.price?.amount || item.price || 0,
      image: item.image?.url || '',
    }));

    // Check if this checkout already exists (idempotency)
    const existing = await wixData.query('AbandonedCarts')
      .eq('checkoutId', checkoutId)
      .find();

    if (existing.items.length > 0) return;

    await wixData.insert('AbandonedCarts', {
      checkoutId,
      buyerEmail,
      buyerName,
      cartTotal: Number(cartTotal),
      lineItems: JSON.stringify(lineItems),
      abandonedAt: new Date(),
      status: 'abandoned',
      recoveryEmailSent: false,
    });
  } catch (err) {
    console.error('[events] Error handling abandoned checkout:', err);
  }
}

/**
 * Fired when a previously abandoned checkout is recovered (completed).
 * Updates the AbandonedCarts record status to 'recovered'.
 */
export async function wixEcom_onAbandonedCheckoutRecovered(event) {
  try {
    const checkout = event.entity || event;
    const checkoutId = checkout._id || checkout.checkoutId || '';
    if (!checkoutId) return;

    const result = await wixData.query('AbandonedCarts')
      .eq('checkoutId', checkoutId)
      .find();

    if (result.items.length === 0) return;

    const cart = result.items[0];
    await wixData.update('AbandonedCarts', {
      ...cart,
      status: 'recovered',
    });
  } catch (err) {
    console.error('[events] Error handling recovered checkout:', err);
  }
}

// ── Member + Order Lifecycle Handlers ────────────────────────────────

/**
 * Fired when a new site member is created.
 * Delegates to emailAutomation to queue the welcome email series.
 */
export async function wixMembers_onMemberCreated(event) {
  const member = event.entity || event;
  const email = member.loginEmail || member.contactDetails?.emails?.[0] || '';
  const firstName = member.contactDetails?.firstName || member.profile?.nickname || '';
  const contactId = member._id || '';

  if (!email) return;

  try {
    const { triggerWelcomeSequence } = await import('backend/emailAutomation.web');
    await triggerWelcomeSequence(contactId, email, firstName);
  } catch (err) {
    console.error('[events] Error triggering welcome sequence:', err);
  }
}

/**
 * Fired when an order is created (completed checkout).
 * Delegates to emailAutomation to queue the post-purchase care sequence.
 */
export async function wixEcom_onOrderCreated(event) {
  const order = event.entity || event;
  const email = order.buyerInfo?.email || '';
  const firstName = order.billingInfo?.firstName || order.buyerInfo?.firstName || '';
  const contactId = order.buyerInfo?.contactId || '';
  const orderNumber = order.number || '';
  const total = order.priceSummary?.total?.amount || order.totals?.total || 0;
  const lineItems = (order.lineItems || []).map(item => ({
    name: item.productName?.original || item.name || '',
    quantity: item.quantity || 1,
    price: item.price?.amount || item.price || 0,
  }));

  if (!email) return;

  try {
    const { triggerPostPurchaseSequence } = await import('backend/emailAutomation.web');
    await triggerPostPurchaseSequence(contactId, email, firstName, orderNumber, total, lineItems);
  } catch (err) {
    console.error('[events] Error triggering post-purchase sequence:', err);
  }
}

/**
 * Fired when an order is cancelled.
 * Delegates to emailAutomation to cancel pending post-purchase care emails.
 */
export async function wixEcom_onOrderCanceled(event) {
  const order = event.entity || event;
  const email = order.buyerInfo?.email || '';
  const orderNumber = order.number || '';

  if (!email) return;

  try {
    const { cancelSequenceForOrder } = await import('backend/emailAutomation.web');
    await cancelSequenceForOrder(email, orderNumber);
  } catch (err) {
    console.error('[events] Error cancelling care sequence:', err);
  }
}

// ── Inventory Restock Handler ────────────────────────────────────────

/**
 * Fired when inventory variant is updated.
 * Detects restock (quantity goes from 0 to positive) and triggers notifications.
 */
export async function wixStores_onInventoryVariantUpdated(event) {
  try {
    const variant = event.entity || event;
    const productId = variant.productId || '';
    const variantId = variant.variantId || variant._id || '';
    const newQuantity = variant.quantity ?? variant.inStock ?? 0;
    const oldQuantity = event.previousEntity?.quantity ?? event.previousEntity?.inStock ?? 0;

    // Only trigger on restock: was 0 (or less), now positive
    if (oldQuantity > 0 || newQuantity <= 0) return;
    if (!productId) return;

    // Query BackInStockSignups for pending notifications
    const signups = await wixData.query('BackInStockSignups')
      .eq('productId', productId)
      .eq('notified', false)
      .find();

    if (signups.items.length === 0) return;

    // Queue restock notification emails via emailAutomation
    const { triggerRestockNotifications } = await import('backend/emailAutomation.web');
    await triggerRestockNotifications(productId, signups.items);
  } catch (err) {
    console.error('[events] Error handling inventory restock:', err);
  }
}
