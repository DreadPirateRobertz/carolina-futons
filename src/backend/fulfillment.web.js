// Order Fulfillment Backend Module
// Manages the workflow from order received → label printed → shipped → delivered
// Integrates with UPS shipping and Wix Stores orders
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { createShipment, trackShipment } from 'backend/ups-shipping.web';

// ── Order Processing ────────────────────────────────────────────────

// Get orders ready for fulfillment (paid, not yet shipped)
export const getPendingOrders = webMethod(
  Permissions.SiteMember,
  async (limit = 50) => {
    try {
      const orders = await wixData.query('Stores/Orders')
        .eq('paymentStatus', 'PAID')
        .ne('fulfillmentStatus', 'FULFILLED')
        .descending('_createdDate')
        .limit(limit)
        .find();

      return orders.items.map(order => ({
        _id: order._id,
        number: order.number,
        createdDate: order._createdDate,
        buyerName: `${order.billingInfo?.firstName || ''} ${order.billingInfo?.lastName || ''}`.trim(),
        buyerEmail: order.buyerInfo?.email || '',
        shippingAddress: order.shippingInfo?.shipmentDetails?.address || {},
        lineItems: (order.lineItems || []).map(item => ({
          name: item.name,
          quantity: item.quantity,
          sku: item.sku,
          price: item.price,
          weight: item.weight,
        })),
        subtotal: order.totals?.subtotal || 0,
        shipping: order.totals?.shipping || 0,
        total: order.totals?.total || 0,
        fulfillmentStatus: order.fulfillmentStatus || 'NOT_FULFILLED',
        shippingMethod: order.shippingInfo?.title || '',
        buyerNote: order.buyerNote || '',
      }));
    } catch (err) {
      console.error('Error fetching pending orders:', err);
      return [];
    }
  }
);

// Create UPS shipment for an order and save tracking info
export const fulfillOrder = webMethod(
  Permissions.SiteMember,
  async (orderId, packageDetails) => {
    try {
      // Get the order
      const order = await wixData.get('Stores/Orders', orderId);
      if (!order) throw new Error('Order not found');

      const shippingAddr = order.shippingInfo?.shipmentDetails?.address || {};

      // Create UPS shipment
      const shipmentResult = await createShipment({
        orderId: order.number || orderId,
        recipientName: `${order.billingInfo?.firstName || ''} ${order.billingInfo?.lastName || ''}`.trim(),
        recipientPhone: order.billingInfo?.phone || '',
        addressLine1: shippingAddr.addressLine || shippingAddr.addressLine1 || '',
        addressLine2: shippingAddr.addressLine2 || '',
        city: shippingAddr.city || '',
        state: shippingAddr.subdivision || shippingAddr.state || '',
        postalCode: shippingAddr.postalCode || '',
        country: shippingAddr.country || 'US',
        serviceCode: packageDetails.serviceCode || '03',
        packages: packageDetails.packages || [{
          length: 48,
          width: 30,
          height: 12,
          weight: packageDetails.totalWeight || 50,
          description: 'Furniture',
        }],
      });

      if (!shipmentResult.success) {
        throw new Error(shipmentResult.error || 'Shipment creation failed');
      }

      // Save fulfillment record
      await wixData.insert('Fulfillments', {
        orderId,
        orderNumber: order.number,
        trackingNumber: shipmentResult.trackingNumber,
        carrier: 'UPS',
        serviceCode: packageDetails.serviceCode || '03',
        serviceName: getServiceName(packageDetails.serviceCode || '03'),
        labelBase64: shipmentResult.labels?.[0]?.labelBase64 || '',
        shippingCost: shipmentResult.totalCharge,
        status: 'LABEL_CREATED',
        createdDate: new Date(),
        recipientName: `${order.billingInfo?.firstName || ''} ${order.billingInfo?.lastName || ''}`.trim(),
        recipientCity: shippingAddr.city || '',
        recipientState: shippingAddr.subdivision || '',
      });

      return {
        success: true,
        trackingNumber: shipmentResult.trackingNumber,
        labels: shipmentResult.labels,
        shippingCost: shipmentResult.totalCharge,
      };
    } catch (err) {
      console.error('Error fulfilling order:', err);
      return { success: false, error: err.message };
    }
  }
);

// ── Tracking Updates ────────────────────────────────────────────────

// Get tracking status for a fulfillment record
export const getTrackingUpdate = webMethod(
  Permissions.Anyone,
  async (trackingNumber) => {
    try {
      const tracking = await trackShipment(trackingNumber);
      if (!tracking.success) {
        return tracking;
      }

      // Update the fulfillment record with latest status
      const records = await wixData.query('Fulfillments')
        .eq('trackingNumber', trackingNumber)
        .find();

      if (records.items.length > 0) {
        const record = records.items[0];
        record.status = mapTrackingStatus(tracking.statusCode);
        record.lastTrackingUpdate = new Date();
        record.estimatedDelivery = tracking.estimatedDelivery || null;
        await wixData.update('Fulfillments', record);
      }

      return tracking;
    } catch (err) {
      console.error('Error getting tracking update:', err);
      return { success: false, error: err.message };
    }
  }
);

// Batch update tracking for all active shipments
export const updateAllTracking = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const active = await wixData.query('Fulfillments')
        .ne('status', 'DELIVERED')
        .ne('status', 'RETURNED')
        .find();

      const updates = [];
      for (const record of active.items) {
        if (record.trackingNumber) {
          const tracking = await trackShipment(record.trackingNumber);
          if (tracking.success) {
            record.status = mapTrackingStatus(tracking.statusCode);
            record.lastTrackingUpdate = new Date();
            record.estimatedDelivery = tracking.estimatedDelivery || null;
            record.lastActivity = tracking.activities?.[0]?.status || '';
            updates.push(wixData.update('Fulfillments', record));
          }
        }
      }

      await Promise.all(updates);
      return { success: true, updated: updates.length };
    } catch (err) {
      console.error('Error batch updating tracking:', err);
      return { success: false, error: err.message };
    }
  }
);

// ── Fulfillment History ─────────────────────────────────────────────

export const getFulfillmentHistory = webMethod(
  Permissions.SiteMember,
  async (limit = 100) => {
    try {
      const records = await wixData.query('Fulfillments')
        .descending('createdDate')
        .limit(limit)
        .find();

      return records.items;
    } catch (err) {
      console.error('Error fetching fulfillment history:', err);
      return [];
    }
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function getServiceName(code) {
  const services = {
    '03': 'UPS Ground',
    '02': 'UPS 2nd Day Air',
    '01': 'UPS Next Day Air',
    '12': 'UPS 3 Day Select',
    '13': 'UPS Next Day Air Saver',
    '14': 'UPS Next Day Air Early',
    '59': 'UPS 2nd Day Air A.M.',
  };
  return services[code] || `UPS Service ${code}`;
}

function mapTrackingStatus(statusCode) {
  if (!statusCode) return 'UNKNOWN';

  const code = statusCode.toUpperCase();
  if (code === 'D' || code === 'DELIVERED') return 'DELIVERED';
  if (code === 'I' || code === 'IN TRANSIT' || code === 'IT') return 'IN_TRANSIT';
  if (code === 'P' || code === 'PICKUP') return 'PICKED_UP';
  if (code === 'X' || code === 'EXCEPTION') return 'EXCEPTION';
  if (code === 'RS' || code === 'RETURNED') return 'RETURNED';
  if (code === 'M' || code === 'MANIFEST') return 'LABEL_CREATED';

  return 'IN_TRANSIT';
}
