/**
 * @module testimonialService
 * @description Backend service for customer testimonials. Handles submission,
 * curation, retrieval, and JSON-LD schema generation.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection `Testimonials` with fields:
 *   memberId (Text), name (Text), photo (Image), story (Text),
 *   productId (Text), productName (Text), productCategory (Text),
 *   rating (Number 1-5), status (Text: 'pending'|'approved'|'rejected'|'featured'),
 *   featured (Boolean), submittedAt (Date), approvedAt (Date),
 *   orderId (Text), source (Text: 'thank_you'|'member_page'|'email')
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

async function requireMember() {
  const member = await currentMember.getMember();
  if (!member) throw new Error('Authentication required');
  return member._id;
}

/**
 * Submit a new testimonial. Status starts as 'pending' for admin review.
 *
 * @param {Object} data
 * @param {string} data.name - Customer display name.
 * @param {string} data.story - Testimonial text (max 2000 chars).
 * @param {string} [data.photo] - Photo URL (Wix media).
 * @param {string} [data.productId] - Associated product ID.
 * @param {string} [data.productName] - Associated product name.
 * @param {string} [data.productCategory] - Product category.
 * @param {number} [data.rating] - 1-5 star rating.
 * @param {string} [data.orderId] - Order that prompted the testimonial.
 * @param {string} [data.source] - Where submitted from.
 * @returns {Promise<{success: boolean, id?: string}>}
 */
export const submitTestimonial = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const memberId = await requireMember();

      const name = sanitize(data.name, 200);
      const story = sanitize(data.story, 2000);
      if (!story || story.length < 10) {
        return { success: false, error: 'Testimonial must be at least 10 characters.' };
      }

      const rating = Math.min(5, Math.max(1, Math.round(Number(data.rating) || 5)));

      const record = {
        memberId,
        name: name || 'Carolina Futons Customer',
        story,
        photo: data.photo || '',
        productId: sanitize(data.productId || '', 50),
        productName: sanitize(data.productName || '', 200),
        productCategory: sanitize(data.productCategory || '', 100),
        rating,
        status: 'pending',
        featured: false,
        submittedAt: new Date(),
        orderId: sanitize(data.orderId || '', 50),
        source: sanitize(data.source || 'member_page', 50),
      };

      const inserted = await wixData.insert('Testimonials', record);
      return { success: true, id: inserted._id };
    } catch (err) {
      console.error('[testimonialService] Error submitting testimonial:', err);
      return { success: false, error: 'Failed to submit testimonial.' };
    }
  }
);

/**
 * Get featured testimonials for the Home page carousel.
 * Returns top 6 featured testimonials, sorted by most recent approval.
 *
 * @param {number} [limit=6] - Max testimonials to return.
 * @returns {Promise<{items: Array, success: boolean}>}
 */
export const getFeaturedTestimonials = webMethod(
  Permissions.Anyone,
  async (limit = 6) => {
    try {
      const result = await wixData.query('Testimonials')
        .eq('status', 'featured')
        .descending('approvedAt')
        .limit(Math.min(limit, 20))
        .find();

      return { items: result.items, success: true };
    } catch (err) {
      console.error('[testimonialService] Error getting featured testimonials:', err);
      return { items: [], success: false };
    }
  }
);

/**
 * Get approved testimonials filtered by product category.
 * Used on Product pages to show relevant customer stories.
 *
 * @param {string} [category] - Product category to filter by (optional).
 * @param {number} [limit=4] - Max testimonials to return.
 * @returns {Promise<{items: Array, success: boolean}>}
 */
export const getTestimonialsByCategory = webMethod(
  Permissions.Anyone,
  async (category, limit = 4) => {
    try {
      let query = wixData.query('Testimonials')
        .hasSome('status', ['approved', 'featured'])
        .descending('approvedAt')
        .limit(Math.min(limit, 20));

      if (category) {
        query = query.eq('productCategory', sanitize(category, 100));
      }

      const result = await query.find();
      return { items: result.items, success: true };
    } catch (err) {
      console.error('[testimonialService] Error getting testimonials by category:', err);
      return { items: [], success: false };
    }
  }
);

/**
 * Get testimonials submitted by the current member (for Member Page).
 *
 * @returns {Promise<{items: Array, success: boolean}>}
 */
export const getMyTestimonials = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const memberId = await requireMember();
      const result = await wixData.query('Testimonials')
        .eq('memberId', memberId)
        .descending('submittedAt')
        .limit(20)
        .find();

      return { items: result.items, success: true };
    } catch (err) {
      console.error('[testimonialService] Error getting my testimonials:', err);
      return { items: [], success: false };
    }
  }
);

/**
 * Build JSON-LD Review schema for testimonials.
 * Used for SEO — outputs aggregate rating + individual reviews.
 *
 * @returns {Promise<string>} JSON-LD script content.
 */
export const getTestimonialSchema = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await wixData.query('Testimonials')
        .hasSome('status', ['approved', 'featured'])
        .descending('approvedAt')
        .limit(50)
        .find();

      const reviews = result.items;
      if (reviews.length === 0) return '';

      const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 5), 0);
      const avgRating = (totalRating / reviews.length).toFixed(1);

      const schema = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        'name': 'Carolina Futons',
        'url': 'https://www.carolinafutons.com',
        'aggregateRating': {
          '@type': 'AggregateRating',
          'ratingValue': avgRating,
          'reviewCount': String(reviews.length),
          'bestRating': '5',
          'worstRating': '1',
        },
        'review': reviews.slice(0, 10).map(r => ({
          '@type': 'Review',
          'author': { '@type': 'Person', 'name': r.name || 'Customer' },
          'reviewBody': r.story,
          'reviewRating': {
            '@type': 'Rating',
            'ratingValue': String(r.rating || 5),
            'bestRating': '5',
          },
          'datePublished': r.approvedAt ? new Date(r.approvedAt).toISOString().split('T')[0] : undefined,
        })),
      };

      return JSON.stringify(schema);
    } catch (err) {
      console.error('[testimonialService] Error building schema:', err);
      return '';
    }
  }
);
