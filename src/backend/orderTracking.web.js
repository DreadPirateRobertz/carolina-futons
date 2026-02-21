/**
 * @module orderTracking
 * @description Customer-facing order tracking service. Allows customers to look
 * up orders by order number + email, view UPS tracking status with timeline,
 * and opt in/out of shipping notification emails.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Uses existing collections:
 * - Stores/Orders - Order data with buyer/shipping info
 * - Fulfillments - Tracking numbers and carrier details
 *
 * Create CMS collection "TrackingNotifications" with fields:
 * - email (Text) - Subscriber email
 * - orderNumber (Text) - The order number
 * - trackingNumber (Text) - UPS tracking number
 * - enabled (Boolean) - Whether notifications are active
 * - _createdDate (DateTime) - Auto
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { trackShipment } from 'backend/ups-shipping.web';

// ── Status display mapping ──────────────────────────────────────────

const STATUS_DISPLAY = {
  NOT_FULFILLED: { label: 'Processing', description: 'Your order is being prepared', step: 0 },
  LABEL_CREATED: { label: 'Label Created', description: 'Shipping label has been created', step: 1 },
  PICKED_UP: { label: 'Picked Up', description: 'Package picked up by UPS', step: 2 },
  IN_TRANSIT: { label: 'In Transit', description: 'Your package is on its way', step: 2 },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', description: 'Your package is out for delivery today', step: 3 },
  DELIVERED: { label: 'Delivered', description: 'Your package has been delivered', step: 4 },
  EXCEPTION: { label: 'Exception', description: 'There is an issue with your shipment', step: -1 },
  RETURNED: { label: 'Returned', description: 'Package is being returned', step: -1 },
  UNKNOWN: { label: 'Unknown', description: 'Status unavailable', step: -1 },
};

const TIMELINE_STEPS = [
  { step: 0, label: 'Order Placed' },
  { step: 1, label: 'Shipped' },
  { step: 2, label: 'In Transit' },
  { step: 3, label: 'Out for Delivery' },
  { step: 4, label: 'Delivered' },
];

// ── lookupOrder ─────────────────────────────────────────────────────

export const lookupOrder = webMethod(
  Permissions.Anyone,
  async (orderNumber, email) => {
    try {
      // Validate inputs
      const cleanOrderNumber = sanitize(orderNumber, 50).replace(/[^a-zA-Z0-9-]/g, '');
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!cleanOrderNumber) {
        return { success: false, error: 'Order number is required' };
      }
      if (!cleanEmail || !validateEmail(cleanEmail)) {
        return { success: false, error: 'A valid email address is required' };
      }

      // Find the order
      const orderResult = await wixData.query('Stores/Orders')
        .eq('number', cleanOrderNumber)
        .find();

      if (orderResult.items.length === 0) {
        return { success: false, error: 'Order not found. Please check your order number.' };
      }

      const order = orderResult.items[0];

      // Verify email matches buyer
      const buyerEmail = (order.buyerInfo?.email || '').toLowerCase();
      if (buyerEmail !== cleanEmail) {
        return { success: false, error: 'Order not found. Please check your order number and email.' };
      }

      // Get fulfillment/tracking records
      const fulfillmentResult = await wixData.query('Fulfillments')
        .eq('orderId', order._id)
        .find();

      const fulfillment = fulfillmentResult.items.length > 0 ? fulfillmentResult.items[0] : null;

      // Get live tracking if we have a tracking number
      let tracking = null;
      if (fulfillment?.trackingNumber) {
        tracking = await trackShipment(fulfillment.trackingNumber);
      }

      // Build response
      const fulfillmentStatus = fulfillment?.status || 'NOT_FULFILLED';
      const statusInfo = STATUS_DISPLAY[fulfillmentStatus] || STATUS_DISPLAY.UNKNOWN;

      // Build timeline
      const timeline = TIMELINE_STEPS.map(step => ({
        ...step,
        completed: statusInfo.step >= 0 && step.step <= statusInfo.step,
        current: step.step === statusInfo.step,
      }));

      // Build line items with thumbnails
      const lineItems = (order.lineItems || []).map(item => ({
        name: item.name || '',
        quantity: item.quantity || 1,
        sku: item.sku || '',
        price: item.price || 0,
        image: item.mediaItem?.url || item.image || null,
      }));

      // Check notification opt-in status
      let notificationsEnabled = false;
      if (fulfillment?.trackingNumber) {
        const notifResult = await wixData.query('TrackingNotifications')
          .eq('orderNumber', cleanOrderNumber)
          .eq('email', cleanEmail)
          .eq('enabled', true)
          .find();
        notificationsEnabled = notifResult.items.length > 0;
      }

      return {
        success: true,
        order: {
          number: order.number,
          createdDate: order._createdDate,
          status: statusInfo.label,
          statusDescription: statusInfo.description,
          fulfillmentStatus,
          paymentStatus: order.paymentStatus || 'UNKNOWN',
        },
        shipping: {
          carrier: fulfillment?.carrier || null,
          serviceName: fulfillment?.serviceName || null,
          trackingNumber: fulfillment?.trackingNumber || null,
          estimatedDelivery: tracking?.estimatedDelivery || fulfillment?.estimatedDelivery || null,
          shippingAddress: {
            city: order.shippingInfo?.shipmentDetails?.address?.city || '',
            state: order.shippingInfo?.shipmentDetails?.address?.subdivision || '',
            postalCode: order.shippingInfo?.shipmentDetails?.address?.postalCode || '',
          },
        },
        tracking: tracking?.success ? {
          status: tracking.status,
          statusCode: tracking.statusCode,
          activities: tracking.activities || [],
        } : null,
        timeline,
        lineItems,
        totals: {
          subtotal: order.totals?.subtotal || 0,
          shipping: order.totals?.shipping || 0,
          total: order.totals?.total || 0,
        },
        notificationsEnabled,
      };
    } catch (err) {
      console.error('lookupOrder error:', err);
      return { success: false, error: 'Unable to retrieve order information. Please try again.' };
    }
  }
);

// ── subscribeToNotifications ────────────────────────────────────────

export const subscribeToNotifications = webMethod(
  Permissions.Anyone,
  async (orderNumber, email) => {
    try {
      const cleanOrderNumber = sanitize(orderNumber, 50).replace(/[^a-zA-Z0-9-]/g, '');
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!cleanOrderNumber || !cleanEmail || !validateEmail(cleanEmail)) {
        return { success: false, error: 'Valid order number and email required' };
      }

      // Verify the order exists and email matches
      const orderResult = await wixData.query('Stores/Orders')
        .eq('number', cleanOrderNumber)
        .find();

      if (orderResult.items.length === 0) {
        return { success: false, error: 'Order not found' };
      }

      const order = orderResult.items[0];
      const buyerEmail = (order.buyerInfo?.email || '').toLowerCase();
      if (buyerEmail !== cleanEmail) {
        return { success: false, error: 'Email does not match order' };
      }

      // Get tracking number
      const fulfillmentResult = await wixData.query('Fulfillments')
        .eq('orderId', order._id)
        .find();

      const trackingNumber = fulfillmentResult.items?.[0]?.trackingNumber || '';

      // Check for existing subscription
      const existing = await wixData.query('TrackingNotifications')
        .eq('orderNumber', cleanOrderNumber)
        .eq('email', cleanEmail)
        .find();

      if (existing.items.length > 0) {
        // Re-enable if disabled
        const record = existing.items[0];
        if (!record.enabled) {
          record.enabled = true;
          await wixData.update('TrackingNotifications', record);
        }
        return { success: true, alreadySubscribed: record.enabled };
      }

      // Create new subscription
      await wixData.insert('TrackingNotifications', {
        email: cleanEmail,
        orderNumber: cleanOrderNumber,
        trackingNumber,
        enabled: true,
      });

      return { success: true, alreadySubscribed: false };
    } catch (err) {
      console.error('subscribeToNotifications error:', err);
      return { success: false, error: 'Unable to subscribe. Please try again.' };
    }
  }
);

// ── unsubscribeFromNotifications ────────────────────────────────────

export const unsubscribeFromNotifications = webMethod(
  Permissions.Anyone,
  async (orderNumber, email) => {
    try {
      const cleanOrderNumber = sanitize(orderNumber, 50).replace(/[^a-zA-Z0-9-]/g, '');
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!cleanOrderNumber || !cleanEmail) {
        return { success: false, error: 'Order number and email required' };
      }

      const existing = await wixData.query('TrackingNotifications')
        .eq('orderNumber', cleanOrderNumber)
        .eq('email', cleanEmail)
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];
        record.enabled = false;
        await wixData.update('TrackingNotifications', record);
      }

      return { success: true };
    } catch (err) {
      console.error('unsubscribeFromNotifications error:', err);
      return { success: false, error: 'Unable to unsubscribe. Please try again.' };
    }
  }
);

// ── getTrackingTimeline ─────────────────────────────────────────────
// Standalone timeline fetch for refreshing status without full order lookup

export const getTrackingTimeline = webMethod(
  Permissions.Anyone,
  async (trackingNumber) => {
    try {
      const cleanTracking = sanitize(trackingNumber, 50).replace(/[^a-zA-Z0-9]/g, '');
      if (!cleanTracking) {
        return { success: false, error: 'Tracking number is required' };
      }

      const tracking = await trackShipment(cleanTracking);
      if (!tracking.success) {
        return { success: false, error: tracking.error || 'Unable to get tracking info' };
      }

      // Map UPS status code to our status
      let fulfillmentStatus = 'IN_TRANSIT';
      const code = (tracking.statusCode || '').toUpperCase();
      if (code === 'D') fulfillmentStatus = 'DELIVERED';
      else if (code === 'IT' || code === 'I') fulfillmentStatus = 'IN_TRANSIT';
      else if (code === 'OD') fulfillmentStatus = 'OUT_FOR_DELIVERY';
      else if (code === 'M') fulfillmentStatus = 'LABEL_CREATED';
      else if (code === 'P') fulfillmentStatus = 'PICKED_UP';
      else if (code === 'X') fulfillmentStatus = 'EXCEPTION';
      else if (code === 'RS') fulfillmentStatus = 'RETURNED';

      const statusInfo = STATUS_DISPLAY[fulfillmentStatus] || STATUS_DISPLAY.UNKNOWN;
      const timeline = TIMELINE_STEPS.map(step => ({
        ...step,
        completed: statusInfo.step >= 0 && step.step <= statusInfo.step,
        current: step.step === statusInfo.step,
      }));

      return {
        success: true,
        status: tracking.status,
        statusCode: tracking.statusCode,
        fulfillmentStatus,
        statusLabel: statusInfo.label,
        estimatedDelivery: tracking.estimatedDelivery,
        activities: tracking.activities || [],
        timeline,
      };
    } catch (err) {
      console.error('getTrackingTimeline error:', err);
      return { success: false, error: 'Unable to retrieve tracking information' };
    }
  }
);
