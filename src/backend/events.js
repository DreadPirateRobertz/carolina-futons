/**
 * @module events
 * @description Wix platform event handlers for eCommerce lifecycle events.
 * Populates the AbandonedCarts CMS collection, triggers restock notifications,
 * and fires content orchestration for product lifecycle changes (new arrivals, price drops).
 *
 * @requires wix-data
 * @requires wix-secrets-backend - CONTENT_EVENT_KEY for orchestrator auth
 * @requires backend/emailAutomation.web - triggerRestockNotifications
 * @requires backend/contentOrchestrator.web - triggerEventOrchestration
 *
 * @setup
 * 1. Create `AbandonedCarts` CMS collection with fields:
 *    checkoutId (text), buyerEmail (text), buyerName (text),
 *    cartTotal (number), lineItems (text/JSON), abandonedAt (dateTime),
 *    status (text: abandoned|recovered), recoveryEmailSent (boolean),
 *    recoveryEmailSentAt (dateTime)
 * 2. Create `FailedEvents` CMS collection for dead-letter queue:
 *    handler (text), checkoutId (text), buyerEmail (text), productId (text),
 *    error (text), severity (text), impact (text), failedAt (dateTime),
 *    resolved (boolean)
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
  const checkout = event.entity || event;
  const checkoutId = checkout._id || checkout.checkoutId || '';
  const buyerEmail = checkout.buyerInfo?.email || '';

  try {
    if (!checkoutId) return;

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
    console.error(`[events] DROPPED abandoned cart — checkoutId: ${checkoutId || 'unknown'}, email: ${buyerEmail || 'unknown'}, error:`, err);
    await logFailedEvent({
      handler: 'wixEcom_onAbandonedCheckoutCreated',
      checkoutId: checkoutId || 'unknown',
      buyerEmail: buyerEmail || 'unknown',
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
  const checkout = event.entity || event;
  const checkoutId = checkout._id || checkout.checkoutId || '';

  try {
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
    console.error(`[events] FAILED to mark cart recovered — checkoutId: ${checkoutId || 'unknown'}, error:`, err);
    await logFailedEvent({
      handler: 'wixEcom_onAbandonedCheckoutRecovered',
      checkoutId: checkoutId || 'unknown',
      error: err.message,
      severity: 'CRITICAL',
      impact: 'Cart stays abandoned — customer may receive recovery emails after purchasing',
    });
  }
}

// ── Member + Order Lifecycle Handlers ────────────────────────────────

/**
 * Extract UTC month (1-12) and day (1-31) from a birthday Date value.
 * Uses UTC to avoid timezone shift on bare date strings (e.g. "1990-05-15").
 * Returns null if the value is absent or unparseable.
 * @internal Exported for unit testing only. Not part of the public module API.
 */
export function _parseBirthdayMonthDay(birthdayValue) {
  if (!birthdayValue) return null;
  const d = new Date(birthdayValue);
  if (isNaN(d.getTime())) return null;
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

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
  const memberId = order.buyerInfo?.memberId || '';
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

  if (memberId) {
    try {
      const { receiveGamificationEvent, recordChallengeProgress } = await import('backend/gamificationEventReceiver.web');

      // Award points for purchase — web customers earn points on every order.
      // CF-tf1: this call was missing, leaving web-only customers with zero points.
      await receiveGamificationEvent('gamification_order_complete', { orderTotal: Number(total) }, memberId);

      const challengeQuery = await wixData
        .query('Challenges')
        .eq('conditionType', 'ORDER_COMPLETE')
        .eq('active', true)
        .find({ suppressAuth: true });
      for (const challenge of challengeQuery.items) {
        await recordChallengeProgress({ memberId, challengeId: challenge.challengeId });
      }
    } catch (err) {
      console.error('[events] Error recording gamification on order:', err);
    }
  }
}

/**
 * Fired when an order is fulfilled (all items shipped).
 * Delegates to notificationOrchestrator to send "order shipped" SMS.
 */
export async function wixEcom_onOrderFulfilled(event) {
  const order = event.entity || event;
  const memberId = order.buyerInfo?.memberId || '';
  const orderNumber = order.number || '';
  // Extract tracking number from first fulfillment, if present
  const trackingNumber = order.fulfillmentStatus?.trackingInfo?.trackingNumber
    || order.trackingInfo?.trackingNumber
    || '';

  if (!memberId) return;

  try {
    const { handleOrderFulfilled } = await import('backend/notificationOrchestrator.web');
    await handleOrderFulfilled({ memberId, orderNumber, trackingNumber });
  } catch (err) {
    console.error('[events] Error handling order fulfilled SMS:', err);
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

// ── Product Lifecycle → Content Orchestration ────────────────────────

/**
 * Fired when a new product is created in the store.
 * Triggers content orchestration for new_arrival.
 */
export async function wixStores_onProductCreated(event) {
  const product = event.entity || event;
  const productId = product._id || '';

  if (!productId) {
    console.warn('[events] wixStores_onProductCreated received event without product ID');
    return;
  }

  try {
    const { getSecret } = await import('wix-secrets-backend');
    const eventSecret = await getSecret('CONTENT_EVENT_KEY');
    const { triggerEventOrchestration } = await import('backend/contentOrchestrator.web');
    await triggerEventOrchestration(eventSecret, 'new_arrival', {
      productId,
      productName: product.name || '',
      productCategory: product.productType || '',
      imageUrl: product.mainMedia || product.media?.mainMedia?.image?.url || '',
    });
  } catch (err) {
    console.error('[events] Content orchestration failed for new product:', err);
    await logFailedEvent({
      handler: 'wixStores_onProductCreated',
      productId,
      error: err.message,
      severity: 'MEDIUM',
      impact: 'New arrival content not auto-generated — manual trigger available',
    });
  }
}

/**
 * Fired when a product is updated.
 * Detects price drops and triggers content orchestration.
 */
export async function wixStores_onProductUpdated(event) {
  const product = event.entity || event;
  const previous = event.previousEntity || {};
  const productId = product._id || '';

  if (!productId) {
    console.warn('[events] wixStores_onProductUpdated received event without product ID');
    return;
  }

  const newPrice = product.price?.amount ?? product.price ?? null;
  const oldPrice = previous.price?.amount ?? previous.price ?? null;

  // Only trigger on actual price drops (not increases, not identical)
  if (oldPrice == null || newPrice == null || newPrice >= oldPrice) return;

  try {
    const { getSecret } = await import('wix-secrets-backend');
    const eventSecret = await getSecret('CONTENT_EVENT_KEY');
    const { triggerEventOrchestration } = await import('backend/contentOrchestrator.web');
    await triggerEventOrchestration(eventSecret, 'price_drop', {
      productId,
      productName: product.name || '',
      productCategory: product.productType || '',
      imageUrl: product.mainMedia || product.media?.mainMedia?.image?.url || '',
      oldPrice,
      newPrice,
    });
  } catch (err) {
    console.error('[events] Content orchestration failed for price drop:', err);
    await logFailedEvent({
      handler: 'wixStores_onProductUpdated',
      productId,
      error: err.message,
      severity: 'MEDIUM',
      impact: 'Price drop content not auto-generated — manual trigger available',
    });
  }
}

// ── Inventory Restock Handler ────────────────────────────────────────

/**
 * Fired when inventory variant is updated.
 * Detects restock (quantity goes from 0 to positive) and triggers notifications.
 */
export async function wixStores_onInventoryVariantUpdated(event) {
  const variant = event.entity || event;
  const productId = variant.productId || '';

  try {
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
    const result = await triggerRestockNotifications(productId, signups.items);

    // Check for soft failure (returned { success: false } without throwing)
    if (result && !result.success) {
      console.error(`[events] Restock notifications returned failure — productId: ${productId}, error: ${result.error || 'unknown'}`);
      await logFailedEvent({
        handler: 'wixStores_onInventoryVariantUpdated',
        productId: productId || 'unknown',
        error: result.error || 'triggerRestockNotifications returned success: false',
        severity: 'HIGH',
        impact: 'Back-in-stock subscribers not notified — trust erosion',
      });
    }

    // Trigger content orchestration for back-in-stock
    try {
      const { triggerManualOrchestration } = await import('backend/contentOrchestrator.web');
      const product = await wixData.get('Stores/Products', productId);
      if (product) {
        await triggerManualOrchestration('back_in_stock', {
          productId,
          productName: product.name || '',
          productCategory: product.productType || '',
          imageUrl: product.mainMedia || '',
        });
      }
    } catch (orchErr) {
      console.error('[events] Content orchestration failed for restock:', orchErr);
    }
  } catch (err) {
    console.error(`[events] FAILED restock notifications — productId: ${productId || 'unknown'}, error:`, err);
    await logFailedEvent({
      handler: 'wixStores_onInventoryVariantUpdated',
      productId: productId || 'unknown',
      error: err.message,
      severity: 'HIGH',
      impact: 'Back-in-stock subscribers not notified — trust erosion',
    });
  }
}

// ── Member Birthday Field Sync ────────────────────────────────────────

/**
 * Fired when a site member's profile is updated.
 * Derives and writes `birthday_month` (1-12) and `birthday_day` (1-31) as
 * searchable int fields so the daily birthday cron can query by today's
 * month/day without a full-table scan.
 *
 * No-op if birthday is absent, unparseable, or unchanged from previousEntity.
 * Only writes when birthday value actually changes, preventing redundant
 * get+update on every profile save (name, avatar, etc.).
 */
export async function wixMembers_onMemberUpdated(event) {
  const member = event.entity || event;
  const memberId = member._id || '';
  const birthday = member.contactDetails?.birthdate ?? member.birthdate ?? null;
  const prevMember = event.previousEntity || {};
  const prevBirthday = prevMember.contactDetails?.birthdate ?? prevMember.birthdate ?? null;

  if (!memberId) return; // no member ID — cannot write
  if (!birthday) return; // no birthday set — nothing to derive
  if (birthday === prevBirthday) return; // birthday unchanged — skip redundant write

  const parsed = _parseBirthdayMonthDay(birthday);
  if (!parsed) {
    console.warn('[events] wixMembers_onMemberUpdated: unparseable birthday for member', memberId, ':', birthday);
    return;
  }

  try {
    // get() before update() — wixData.update replaces the entire item,
    // so we must spread the existing record to avoid destroying other fields.
    const existing = await wixData.get('Members/PrivateMembersData', memberId);
    if (!existing) {
      console.warn('[events] wixMembers_onMemberUpdated: no PrivateMembersData record for member', memberId);
      return;
    }
    await wixData.update('Members/PrivateMembersData', {
      ...existing,
      birthday_month: parsed.month,
      birthday_day: parsed.day,
    });
  } catch (err) {
    console.error(`[events] Failed to sync birthday fields for member ${memberId}:`, err?.message ?? err);
    await logFailedEvent({
      handler: 'wixMembers_onMemberUpdated',
      error: err.message,
      severity: 'LOW',
      impact: `Birthday fields not synced for member ${memberId} — birthday cron may skip this member`,
    });
  }
}
