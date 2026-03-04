/**
 * @module priceMatchService
 * @description Backend web module for price match guarantee system.
 * Members can submit competitor price claims, which are verified and
 * processed for refund/credit. Admins review and approve/deny requests.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection "PriceMatches" in Wix Dashboard with fields:
 * - claimNumber (Text) - Generated claim reference (PM-XXXX-XXXX)
 * - memberId (Text) - Reference to Members
 * - memberEmail (Text) - For notifications
 * - memberName (Text) - Display name
 * - productId (Text) - Reference to Stores/Products
 * - productName (Text) - Product display name
 * - ourPrice (Number) - Our price at time of claim
 * - competitorName (Text) - Competitor retailer name
 * - competitorUrl (Text) - URL to competitor listing
 * - competitorPrice (Number) - Competitor's listed price
 * - priceDifference (Number) - ourPrice - competitorPrice
 * - notes (Text) - Customer notes
 * - status (Text) - "pending" | "approved" | "denied" | "credited"
 * - adminNotes (Text) - Internal review notes
 * - creditAmount (Number) - Approved credit/refund amount
 * - reviewedBy (Text) - Admin who reviewed
 * - reviewedDate (DateTime) - When reviewed
 * - _createdDate (DateTime) - Auto
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

const COLLECTION = 'PriceMatches';
const MAX_NOTES_LEN = 2000;
const MAX_PRICE = 50000;

const APPROVED_COMPETITORS = [
  { name: 'Wayfair', domain: 'wayfair.com' },
  { name: 'Amazon', domain: 'amazon.com' },
  { name: 'Overstock', domain: 'overstock.com' },
  { name: 'Ashley Furniture', domain: 'ashleyfurniture.com' },
  { name: 'IKEA', domain: 'ikea.com' },
  { name: 'Target', domain: 'target.com' },
  { name: 'Walmart', domain: 'walmart.com' },
  { name: 'West Elm', domain: 'westelm.com' },
  { name: 'Pottery Barn', domain: 'potterybarn.com' },
  { name: 'CB2', domain: 'cb2.com' },
];

const VALID_DECISIONS = ['approved', 'denied'];

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Generate a unique claim number.
 * @returns {string} Claim number in PM-XXXX-XXXX format.
 */
function generateClaimNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (len) => Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `PM-${seg(4)}-${seg(4)}`;
}

/**
 * Validate a URL string. Only allows http/https protocols.
 * @param {string} url - URL to validate.
 * @returns {boolean} True if valid http(s) URL.
 */
function isValidUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate price is a finite positive number within limits.
 * @param {*} price - Value to check.
 * @returns {boolean}
 */
function isValidPrice(price) {
  return typeof price === 'number' && Number.isFinite(price) && price > 0 && price <= MAX_PRICE;
}

// ─── Public Methods ──────────────────────────────────────────────────

/**
 * Submit a price match request for a product.
 *
 * @param {Object} data - Request data.
 * @param {string} data.productId - Product ID.
 * @param {string} data.productName - Product display name.
 * @param {number} data.ourPrice - Our current price.
 * @param {string} data.competitorName - Competitor retailer name.
 * @param {string} data.competitorUrl - URL to competitor listing (optional).
 * @param {number} data.competitorPrice - Competitor's listed price.
 * @param {string} [data.notes] - Additional notes.
 * @returns {Promise<{success: boolean, request?: Object, message?: string}>}
 */
export const submitPriceMatchRequest = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Request data is required' };
      }

      const member = await currentMember.getMember();
      if (!member?._id) {
        return { success: false, message: 'You must be logged in to submit a price match request' };
      }

      const productId = validateId(data.productId);
      if (!productId) {
        return { success: false, message: 'Valid product ID is required' };
      }

      const productName = sanitize(data.productName, 200);
      const competitorName = sanitize(data.competitorName, 200);
      if (!competitorName) {
        return { success: false, message: 'Competitor name is required' };
      }

      // Validate competitor URL (optional but must be valid if provided)
      if (data.competitorUrl != null && data.competitorUrl !== '' && typeof data.competitorUrl !== 'string') {
        return { success: false, message: 'Competitor URL must be a string' };
      }
      const competitorUrl = typeof data.competitorUrl === 'string' ? data.competitorUrl.trim() : '';
      if (competitorUrl && !isValidUrl(competitorUrl)) {
        return { success: false, message: 'Competitor URL must be a valid http or https URL' };
      }

      // Validate prices
      const ourPrice = Number(data.ourPrice);
      const competitorPrice = Number(data.competitorPrice);
      if (!isValidPrice(ourPrice)) {
        return { success: false, message: 'Our price must be a valid positive number' };
      }
      if (!isValidPrice(competitorPrice)) {
        return { success: false, message: 'Competitor price must be a valid positive number' };
      }
      if (competitorPrice >= ourPrice) {
        return { success: false, message: 'Competitor price must be lower than our price' };
      }

      // Check for duplicate pending request
      const existing = await wixData.query(COLLECTION)
        .eq('productId', productId)
        .eq('competitorName', competitorName.toLowerCase())
        .eq('memberId', member._id)
        .eq('status', 'pending')
        .find();

      if (existing.totalCount > 0) {
        return { success: false, message: 'You already have a pending price match request for this product and competitor' };
      }

      const notes = data.notes ? sanitize(String(data.notes), MAX_NOTES_LEN) : '';
      const priceDifference = Math.round((ourPrice - competitorPrice) * 100) / 100;

      const record = {
        claimNumber: generateClaimNumber(),
        memberId: member._id,
        memberEmail: member.loginEmail || '',
        memberName: [
          member.contactDetails?.firstName || '',
          member.contactDetails?.lastName || '',
        ].filter(Boolean).join(' '),
        productId,
        productName,
        ourPrice,
        competitorName,
        competitorUrl: sanitize(competitorUrl, 500),
        competitorPrice,
        priceDifference,
        notes,
        status: 'pending',
        adminNotes: '',
        creditAmount: 0,
        reviewedBy: '',
        reviewedDate: null,
      };

      const inserted = await wixData.insert(COLLECTION, record);

      return {
        success: true,
        request: {
          _id: inserted._id,
          claimNumber: inserted.claimNumber,
          productName: inserted.productName,
          competitorName: inserted.competitorName,
          competitorPrice: inserted.competitorPrice,
          ourPrice: inserted.ourPrice,
          priceDifference: inserted.priceDifference,
          notes: inserted.notes,
          status: inserted.status,
        },
      };
    } catch (err) {
      console.error('Error submitting price match request:', err);
      return { success: false, message: 'Failed to submit price match request' };
    }
  }
);

/**
 * Get all price match requests for the current member.
 *
 * @returns {Promise<{requests: Array}>}
 */
export const getMyPriceMatches = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { requests: [] };

      const result = await wixData.query(COLLECTION)
        .eq('memberId', member._id)
        .descending('_createdDate')
        .limit(50)
        .find();

      return {
        requests: (result.items || []).map(r => ({
          _id: r._id,
          claimNumber: r.claimNumber,
          productName: r.productName,
          competitorName: r.competitorName,
          ourPrice: r.ourPrice,
          competitorPrice: r.competitorPrice,
          priceDifference: r.priceDifference,
          status: r.status,
          creditAmount: r.creditAmount || 0,
          adminNotes: r.status === 'denied' ? (r.adminNotes || '') : '',
          _createdDate: r._createdDate,
        })),
      };
    } catch (err) {
      console.error('Error fetching price matches:', err);
      return { requests: [] };
    }
  }
);

/**
 * Get a specific price match request by ID.
 *
 * @param {string} requestId - The price match request ID.
 * @returns {Promise<{success: boolean, request?: Object, message?: string}>}
 */
export const getPriceMatchById = webMethod(
  Permissions.SiteMember,
  async (requestId) => {
    try {
      const cleanId = validateId(requestId);
      if (!cleanId) {
        return { success: false, message: 'Valid request ID is required' };
      }

      const record = await wixData.get(COLLECTION, cleanId);
      if (!record) {
        return { success: false, message: 'Price match request not found' };
      }

      return {
        success: true,
        request: {
          _id: record._id,
          claimNumber: record.claimNumber,
          productName: record.productName,
          competitorName: record.competitorName,
          competitorUrl: record.competitorUrl,
          ourPrice: record.ourPrice,
          competitorPrice: record.competitorPrice,
          priceDifference: record.priceDifference,
          notes: record.notes,
          status: record.status,
          creditAmount: record.creditAmount || 0,
          adminNotes: record.adminNotes || '',
          _createdDate: record._createdDate,
        },
      };
    } catch (err) {
      console.error('Error fetching price match:', err);
      return { success: false, message: 'Failed to fetch price match request' };
    }
  }
);

/**
 * Review (approve/deny) a pending price match request. Admin only.
 *
 * @param {string} requestId - The price match request ID.
 * @param {string} decision - "approved" or "denied".
 * @param {string} [notes] - Admin review notes.
 * @returns {Promise<{success: boolean, request?: Object, message?: string}>}
 */
export const reviewPriceMatchRequest = webMethod(
  Permissions.Admin,
  async (requestId, decision, notes) => {
    try {
      const cleanId = validateId(requestId);
      if (!cleanId) {
        return { success: false, message: 'Valid request ID is required' };
      }

      if (!VALID_DECISIONS.includes(decision)) {
        return { success: false, message: 'Decision must be "approved" or "denied"' };
      }

      const record = await wixData.get(COLLECTION, cleanId);
      if (!record) {
        return { success: false, message: 'Price match request not found' };
      }

      if (record.status !== 'pending') {
        return { success: false, message: 'Only pending requests can be reviewed' };
      }

      const adminNotes = notes ? sanitize(String(notes), MAX_NOTES_LEN) : '';
      const creditAmount = decision === 'approved' ? (record.priceDifference || 0) : 0;

      const updated = await wixData.update(COLLECTION, {
        ...record,
        status: decision,
        adminNotes,
        creditAmount,
        reviewedDate: new Date(),
      });

      return {
        success: true,
        request: {
          _id: updated._id,
          claimNumber: updated.claimNumber,
          status: updated.status,
          creditAmount: updated.creditAmount,
          adminNotes: updated.adminNotes,
        },
      };
    } catch (err) {
      console.error('Error reviewing price match request:', err);
      return { success: false, message: 'Failed to review price match request' };
    }
  }
);

/**
 * Get list of approved competitor sources for the submission form.
 *
 * @returns {Promise<{competitors: Array<{name: string, domain: string}>}>}
 */
export const getCompetitorSources = webMethod(
  Permissions.Anyone,
  async () => {
    return {
      competitors: APPROVED_COMPETITORS.map(c => ({
        name: c.name,
        domain: c.domain,
      })),
    };
  }
);

/**
 * Get aggregate statistics for price match requests. Admin only.
 *
 * @returns {Promise<{stats: Object}>}
 */
export const getPriceMatchStats = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const result = await wixData.query(COLLECTION)
        .limit(1000)
        .find();

      const items = result.items || [];
      const stats = {
        total: items.length,
        pending: items.filter(i => i.status === 'pending').length,
        approved: items.filter(i => i.status === 'approved').length,
        denied: items.filter(i => i.status === 'denied').length,
        credited: items.filter(i => i.status === 'credited').length,
        totalCreditIssued: items
          .filter(i => i.status === 'approved' || i.status === 'credited')
          .reduce((sum, i) => sum + (i.creditAmount || 0), 0),
      };

      return { stats };
    } catch (err) {
      console.error('Error fetching price match stats:', err);
      return {
        stats: {
          total: 0,
          pending: 0,
          approved: 0,
          denied: 0,
          credited: 0,
          totalCreditIssued: 0,
        },
      };
    }
  }
);
