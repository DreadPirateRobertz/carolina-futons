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

// ── Dead-Letter Queue Helper ─────────────────────────────────────────

/**
 * Write a failed event to the FailedEvents dead-letter collection for
 * manual recovery. Best-effort — never throws.
 */
async function logFailedEvent(entry) {
  try {
    await wixData.insert('FailedEvents', {
      ...entry,
      failedAt: new Date(),
      resolved: false,
    });
  } catch (dlErr) {
    console.warn('[events] Dead-letter queue write also failed:', dlErr.message);
  }
}

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
    const checkoutId = (event.entity || event)._id || (event.entity || event).checkoutId || 'unknown';
    const buyerEmail = (event.entity || event).buyerInfo?.email || 'unknown';
    console.error(`[events] DROPPED abandoned cart — checkoutId: ${checkoutId}, email: ${buyerEmail}, error:`, err);
    await logFailedEvent({
      handler: 'wixEcom_onAbandonedCheckoutCreated',
      checkoutId,
      buyerEmail,
      error: err.message,
      severity: 'HIGH',
      impact: 'Abandoned cart data lost — customer will not receive recovery emails',
    });
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
    const checkoutId = (event.entity || event)._id || (event.entity || event).checkoutId || 'unknown';
    console.error(`[events] FAILED to mark cart recovered — checkoutId: ${checkoutId}, error:`, err);
    await logFailedEvent({
      handler: 'wixEcom_onAbandonedCheckoutRecovered',
      checkoutId,
      error: err.message,
      severity: 'CRITICAL',
      impact: 'Cart stays abandoned — customer may receive recovery emails after purchasing',
    });
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
    const productId = (event.entity || event).productId || 'unknown';
    console.error(`[events] FAILED restock notifications — productId: ${productId}, error:`, err);
    await logFailedEvent({
      handler: 'wixStores_onInventoryVariantUpdated',
      productId,
      error: err.message,
      severity: 'HIGH',
      impact: 'Back-in-stock subscribers not notified — trust erosion',
    });
  }
}
