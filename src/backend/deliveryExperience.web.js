/**
 * @module deliveryExperience
 * @description Post-purchase delivery experience: status timeline, milestones,
 * white-glove instructions, assembly guide links, delivery survey, and
 * notification preferences. Extends orderTracking with rich member-facing data.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection `DeliveryTracking` with fields:
 *   orderId (Text, indexed) - Order ID
 *   memberId (Text, indexed) - Member who placed the order
 *   status (Text, indexed) - 'placed'|'confirmed'|'preparing'|'shipped'|'in_transit'|'out_for_delivery'|'delivered'
 *   deliveryTier (Text) - 'standard'|'white_glove_local'|'white_glove_regional'
 *   milestones (Text) - JSON array of milestone objects
 *   estimatedDelivery (Date) - Estimated delivery date
 *   actualDelivery (Date) - Actual delivery date
 *   trackingNumber (Text) - Carrier tracking number
 *   productCategories (Text) - Comma-separated product categories
 *   surveyCompleted (Boolean) - Whether post-delivery survey done
 *   _createdDate (Date) - Auto
 *
 * Create CMS collection `DeliverySurveys` with fields:
 *   orderId (Text, indexed) - Order ID
 *   memberId (Text, indexed) - Member ID
 *   rating (Number) - 1-5 star rating
 *   onTime (Boolean) - Delivered on time
 *   condition (Text) - 'perfect'|'minor_damage'|'damaged'
 *   assemblyExperience (Text) - 'easy'|'moderate'|'difficult'|'na'
 *   comments (Text) - Free text feedback
 *   submittedAt (Date) - Submission timestamp
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

// ── Constants ──────────────────────────────────────────────────────

const DELIVERY_STATUSES = ['placed', 'confirmed', 'preparing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'];

const STATUS_DISPLAY = {
  placed: { label: 'Order Placed', description: 'Your order has been received', step: 0, icon: 'receipt' },
  confirmed: { label: 'Confirmed', description: 'Order confirmed and payment processed', step: 1, icon: 'check' },
  preparing: { label: 'Preparing', description: 'Your items are being prepared for shipment', step: 2, icon: 'box' },
  shipped: { label: 'Shipped', description: 'Your order has shipped', step: 3, icon: 'truck' },
  in_transit: { label: 'In Transit', description: 'Your package is on its way to you', step: 4, icon: 'route' },
  out_for_delivery: { label: 'Out for Delivery', description: 'Arriving today', step: 5, icon: 'home' },
  delivered: { label: 'Delivered', description: 'Your order has been delivered', step: 6, icon: 'delivered' },
};

const WHITE_GLOVE_INSTRUCTIONS = {
  white_glove_local: {
    title: 'White Glove Local Delivery',
    instructions: [
      'Our delivery team will call 24 hours before your scheduled window.',
      'Please clear a path from your front door to the room where you want the furniture.',
      'Our team will unbox, assemble, and place your furniture in the room of your choice.',
      'All packaging materials will be removed.',
      'Please inspect your furniture with the delivery team present.',
    ],
    tips: [
      'Measure doorways and hallways to ensure furniture will fit.',
      'Remove any fragile items from the delivery path.',
      'Have someone available to sign for the delivery.',
    ],
  },
  white_glove_regional: {
    title: 'White Glove Regional Delivery',
    instructions: [
      'The delivery company will contact you to schedule a delivery window.',
      'Typical delivery windows are 4 hours (morning or afternoon).',
      'Clear a path from your front door to the destination room.',
      'Our team will unbox, assemble, and place your furniture.',
      'All packaging materials will be removed.',
      'Inspect your furniture before signing the delivery receipt.',
    ],
    tips: [
      'Measure doorways, stairways, and hallways before delivery day.',
      'Note any tight turns or obstacles the team should know about.',
      'Have someone 18+ available to sign for the delivery.',
    ],
  },
  standard: {
    title: 'Standard Curbside Delivery',
    instructions: [
      'Your order ships via freight carrier to your address.',
      'The carrier will contact you to schedule delivery.',
      'Delivery is curbside — the driver will bring the package to your front door or garage.',
      'Inspect the packaging for damage before signing.',
      'If packaging is damaged, note it on the delivery receipt.',
    ],
    tips: [
      'Have a helper available — furniture packages can be heavy.',
      'Keep the packaging until you verify the furniture is undamaged.',
      'Contact us within 48 hours if you notice any damage.',
    ],
  },
};

const ASSEMBLY_GUIDES = {
  'futon-frames': {
    title: 'Futon Frame Assembly Guide',
    estimatedTime: '30-60 minutes',
    toolsNeeded: ['Phillips screwdriver', 'Allen wrench (included)'],
    steps: [
      'Unbox all components and verify parts against the included parts list.',
      'Attach the side rails to the seat deck using the provided bolts.',
      'Connect the back frame to the seat frame at the pivot points.',
      'Install the arm rests and tighten all connections.',
      'Test the fold mechanism several times to ensure smooth operation.',
    ],
    videoUrl: '',
  },
  'murphy-cabinet-beds': {
    title: 'Murphy Cabinet Bed Setup',
    estimatedTime: 'Under 2 minutes (daily use)',
    toolsNeeded: [],
    steps: [
      'Position the cabinet against a wall on a level surface.',
      'Open the cabinet doors fully.',
      'Pull the mattress platform forward and unfold.',
      'The queen mattress is pre-installed — no setup needed.',
      'To store: fold the platform back and close the doors.',
    ],
    videoUrl: '',
  },
  'platform-beds': {
    title: 'Platform Bed Assembly Guide',
    estimatedTime: '45-90 minutes',
    toolsNeeded: ['Phillips screwdriver', 'Allen wrench (included)', 'Rubber mallet (optional)'],
    steps: [
      'Lay out all parts and hardware. Verify against the parts list.',
      'Assemble the headboard if applicable.',
      'Connect the side rails to the headboard and footboard.',
      'Install the center support beam.',
      'Place slats evenly across the frame.',
      'Place your mattress on top — no box spring needed.',
    ],
    videoUrl: '',
  },
  'mattresses': {
    title: 'Mattress Care Guide',
    estimatedTime: 'N/A',
    toolsNeeded: [],
    steps: [
      'Remove packaging and allow the mattress to expand for 24-48 hours.',
      'No flipping required — our mattresses are single-sided.',
      'Rotate 180 degrees every 3-6 months for even wear.',
      'Use a mattress protector to maintain warranty coverage.',
      'Allow air circulation under the mattress for freshness.',
    ],
    videoUrl: '',
  },
};

const VALID_CONDITIONS = ['perfect', 'minor_damage', 'damaged'];
const VALID_ASSEMBLY = ['easy', 'moderate', 'difficult', 'na'];

// ── Helpers ────────────────────────────────────────────────────────

async function requireMember() {
  const member = await currentMember.getMember();
  if (!member) throw new Error('Authentication required');
  return member._id;
}

function parseMilestones(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Get delivery status and timeline for an order.
 * @param {string} orderId
 * @returns {Promise<{ success: boolean, data?: Object }>}
 */
export const getDeliveryStatus = webMethod(
  Permissions.SiteMember,
  async (orderId) => {
    try {
      const memberId = await requireMember();
      const cleanId = validateId(orderId);
      if (!cleanId) return { success: false, error: 'Valid order ID is required.' };

      const result = await wixData.query('DeliveryTracking')
        .eq('orderId', cleanId)
        .eq('memberId', memberId)
        .limit(1)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Delivery not found for this order.' };
      }

      const delivery = result.items[0];
      const statusInfo = STATUS_DISPLAY[delivery.status] || STATUS_DISPLAY.placed;
      const milestones = parseMilestones(delivery.milestones);

      // Build timeline with completed/current/upcoming indicators
      const timeline = DELIVERY_STATUSES.map((s, i) => ({
        status: s,
        ...STATUS_DISPLAY[s],
        completed: i < statusInfo.step,
        current: i === statusInfo.step,
        upcoming: i > statusInfo.step,
        timestamp: milestones.find(m => m.status === s)?.timestamp || null,
      }));

      return {
        success: true,
        data: {
          orderId: delivery.orderId,
          status: delivery.status,
          statusLabel: statusInfo.label,
          statusDescription: statusInfo.description,
          deliveryTier: delivery.deliveryTier || 'standard',
          trackingNumber: delivery.trackingNumber || '',
          estimatedDelivery: delivery.estimatedDelivery || null,
          actualDelivery: delivery.actualDelivery || null,
          timeline,
          surveyCompleted: delivery.surveyCompleted || false,
        },
      };
    } catch (err) {
      console.error('[deliveryExperience] Error getting delivery status:', err);
      return { success: false, error: 'Failed to load delivery status.' };
    }
  }
);

/**
 * Update a delivery milestone (admin only — called by fulfillment system).
 * @param {string} orderId
 * @param {string} status - New delivery status
 * @param {string} [note] - Optional milestone note
 * @returns {Promise<{ success: boolean }>}
 */
export const updateDeliveryMilestone = webMethod(
  Permissions.Admin,
  async (orderId, status, note) => {
    try {
      const cleanId = validateId(orderId);
      if (!cleanId) return { success: false, error: 'Valid order ID is required.' };

      const cleanStatus = sanitize(status, 30);
      if (!DELIVERY_STATUSES.includes(cleanStatus)) {
        return { success: false, error: `Invalid status. Must be one of: ${DELIVERY_STATUSES.join(', ')}` };
      }

      const result = await wixData.query('DeliveryTracking')
        .eq('orderId', cleanId)
        .limit(1)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Delivery record not found.' };
      }

      const delivery = result.items[0];
      const milestones = parseMilestones(delivery.milestones);
      milestones.push({
        status: cleanStatus,
        timestamp: new Date().toISOString(),
        note: sanitize(note || '', 500),
      });

      delivery.status = cleanStatus;
      delivery.milestones = JSON.stringify(milestones);

      if (cleanStatus === 'delivered') {
        delivery.actualDelivery = new Date();
      }

      await wixData.update('DeliveryTracking', delivery);
      return { success: true };
    } catch (err) {
      console.error('[deliveryExperience] Error updating milestone:', err);
      return { success: false, error: 'Failed to update delivery milestone.' };
    }
  }
);

/**
 * Get white-glove delivery instructions for a delivery tier.
 * @param {string} deliveryTier - 'standard'|'white_glove_local'|'white_glove_regional'
 * @returns {{ success: boolean, data?: Object }}
 */
export const getDeliveryInstructions = webMethod(
  Permissions.Anyone,
  (deliveryTier) => {
    const tier = sanitize(deliveryTier || 'standard', 30);
    const instructions = WHITE_GLOVE_INSTRUCTIONS[tier];

    if (!instructions) {
      return {
        success: false,
        error: `Unknown delivery tier. Available: ${Object.keys(WHITE_GLOVE_INSTRUCTIONS).join(', ')}`,
      };
    }

    return { success: true, data: instructions };
  }
);

/**
 * Get assembly guide for a product category.
 * @param {string} productCategory - Product category slug
 * @returns {{ success: boolean, data?: Object }}
 */
export const getAssemblyGuide = webMethod(
  Permissions.Anyone,
  (productCategory) => {
    const category = sanitize(productCategory || '', 100).toLowerCase().replace(/\s+/g, '-');
    const guide = ASSEMBLY_GUIDES[category];

    if (!guide) {
      return {
        success: false,
        error: `No assembly guide for "${productCategory}". Available: ${Object.keys(ASSEMBLY_GUIDES).join(', ')}`,
      };
    }

    return { success: true, data: { category, ...guide } };
  }
);

/**
 * Get all available assembly guides.
 * @returns {{ success: boolean, guides: Object }}
 */
export const getAllAssemblyGuides = webMethod(
  Permissions.Anyone,
  () => {
    return { success: true, guides: { ...ASSEMBLY_GUIDES } };
  }
);

/**
 * Submit a post-delivery survey.
 * @param {Object} data
 * @param {string} data.orderId - Order ID
 * @param {number} data.rating - 1-5 rating
 * @param {boolean} data.onTime - Was delivery on time
 * @param {string} data.condition - Product condition on arrival
 * @param {string} [data.assemblyExperience] - Assembly difficulty
 * @param {string} [data.comments] - Free text feedback
 * @returns {Promise<{ success: boolean }>}
 */
export const submitDeliverySurvey = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const memberId = await requireMember();

      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Survey data is required.' };
      }

      const orderId = validateId(data.orderId);
      if (!orderId) return { success: false, error: 'Valid order ID is required.' };

      const rawRating = Number(data.rating);
      if (!rawRating || rawRating < 1) return { success: false, error: 'Rating (1-5) is required.' };
      const rating = Math.max(1, Math.min(5, Math.round(rawRating)));

      const condition = sanitize(data.condition || '', 30);
      if (!VALID_CONDITIONS.includes(condition)) {
        return { success: false, error: `Condition must be one of: ${VALID_CONDITIONS.join(', ')}` };
      }

      const assembly = sanitize(data.assemblyExperience || 'na', 30);
      if (!VALID_ASSEMBLY.includes(assembly)) {
        return { success: false, error: `Assembly experience must be one of: ${VALID_ASSEMBLY.join(', ')}` };
      }

      // Check for duplicate survey
      const existing = await wixData.query('DeliverySurveys')
        .eq('orderId', orderId)
        .eq('memberId', memberId)
        .limit(1)
        .find();

      if (existing.items.length > 0) {
        return { success: false, error: 'Survey already submitted for this order.' };
      }

      await wixData.insert('DeliverySurveys', {
        orderId,
        memberId,
        rating,
        onTime: Boolean(data.onTime),
        condition,
        assemblyExperience: assembly,
        comments: sanitize(data.comments || '', 1000),
        submittedAt: new Date(),
      });

      // Mark delivery as survey completed
      const delivery = await wixData.query('DeliveryTracking')
        .eq('orderId', orderId)
        .limit(1)
        .find();

      if (delivery.items.length > 0) {
        delivery.items[0].surveyCompleted = true;
        await wixData.update('DeliveryTracking', delivery.items[0]);
      }

      return { success: true };
    } catch (err) {
      console.error('[deliveryExperience] Error submitting survey:', err);
      return { success: false, error: 'Failed to submit survey.' };
    }
  }
);

/**
 * Get delivery survey stats for admin dashboard.
 * @param {number} [daysBack=30]
 * @returns {Promise<{ success: boolean, data?: Object }>}
 */
export const getSurveyStats = webMethod(
  Permissions.Admin,
  async (daysBack = 30) => {
    try {
      const days = Math.max(1, Math.min(365, Math.round(Number(daysBack) || 30)));
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const result = await wixData.query('DeliverySurveys')
        .ge('submittedAt', cutoff)
        .limit(1000)
        .find();

      if (result.items.length === 0) {
        return { success: true, data: { totalSurveys: 0, averageRating: 0, onTimeRate: 0, period: `${days} days` } };
      }

      const surveys = result.items;
      const avgRating = Math.round((surveys.reduce((s, r) => s + r.rating, 0) / surveys.length) * 10) / 10;
      const onTimeCount = surveys.filter(s => s.onTime).length;
      const onTimeRate = Math.round((onTimeCount / surveys.length) * 100);

      const conditionBreakdown = {};
      for (const s of surveys) {
        conditionBreakdown[s.condition] = (conditionBreakdown[s.condition] || 0) + 1;
      }

      return {
        success: true,
        data: {
          totalSurveys: surveys.length,
          averageRating: avgRating,
          onTimeRate,
          conditionBreakdown,
          period: `${days} days`,
        },
      };
    } catch (err) {
      console.error('[deliveryExperience] Error getting survey stats:', err);
      return { success: false, error: 'Failed to get survey stats.' };
    }
  }
);
