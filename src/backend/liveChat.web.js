/**
 * @module liveChat
 * @description Backend service for live chat customer support widget.
 * Manages office hours, canned responses, support ticket creation for
 * after-hours messages, and chat session context.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Create CMS collection "SupportTickets" with fields:
 * - name (Text) - Customer name
 * - email (Text) - Customer email
 * - message (Text) - The chat message
 * - page (Text) - Page where chat was initiated
 * - status (Text) - "new" | "in_progress" | "resolved"
 * - assignedTo (Text) - Team member handling ticket
 * - notes (Text) - Internal notes
 * - _createdDate (DateTime) - Auto
 *
 * Create CMS collection "ChatConfig" with fields:
 * - key (Text) - Config key (e.g., "officeHours", "cannedResponses")
 * - value (Text/JSON) - Config value as JSON string
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { safeParse } from 'backend/utils/safeParse';

// ── Default office hours (EST) ──────────────────────────────────────

const DEFAULT_OFFICE_HOURS = {
  timezone: 'America/New_York',
  schedule: {
    0: null,                               // Sunday: closed
    1: { open: '10:00', close: '18:00' },  // Monday
    2: { open: '10:00', close: '18:00' },  // Tuesday
    3: { open: '10:00', close: '18:00' },  // Wednesday
    4: { open: '10:00', close: '18:00' },  // Thursday
    5: { open: '10:00', close: '17:00' },  // Friday
    6: { open: '10:00', close: '16:00' },  // Saturday
  },
};

// ── Default canned responses ────────────────────────────────────────

const DEFAULT_CANNED_RESPONSES = [
  {
    id: 'shipping',
    category: 'Shipping',
    trigger: 'shipping',
    title: 'Shipping Times & Costs',
    response: 'Most items ship within 3-5 business days via UPS Ground. ' +
      'Orders over $999 qualify for FREE shipping within the continental US. ' +
      'Local delivery in the Hendersonville, NC area is available — just ask!',
  },
  {
    id: 'returns',
    category: 'Returns',
    trigger: 'return',
    title: 'Return Policy',
    response: 'We accept returns within 30 days of delivery. Items must be in original ' +
      'condition with packaging. Start a return from your account page under Order History, ' +
      'or contact us and we\'ll walk you through it. Restocking fees may apply for ' +
      'non-defective returns.',
  },
  {
    id: 'assembly',
    category: 'Assembly',
    trigger: 'assembly',
    title: 'Assembly Information',
    response: 'All our futon frames come with detailed assembly instructions. Most frames ' +
      'can be assembled in 30-60 minutes with basic tools. Assembly guides with step-by-step ' +
      'photos are available on each product page. Need help? We\'re happy to assist!',
  },
  {
    id: 'fabrics',
    category: 'Fabrics',
    trigger: 'fabric',
    title: 'Fabric Samples',
    response: 'We offer 700+ fabric options! Free fabric swatches are available — just let ' +
      'us know which fabrics you\'re interested in and we\'ll mail samples to you. You can ' +
      'browse fabrics on any frame product page by clicking "View All Fabrics".',
  },
  {
    id: 'store-hours',
    category: 'Store',
    trigger: 'hours',
    title: 'Store Hours',
    response: 'Our Hendersonville, NC showroom is open:\n' +
      'Mon-Thu: 10am - 6pm\nFri: 10am - 5pm\nSat: 10am - 4pm\nSun: Closed\n' +
      'Located at the historic district — come see and try our furniture in person!',
  },
  {
    id: 'warranty',
    category: 'Warranty',
    trigger: 'warranty',
    title: 'Warranty Information',
    response: 'Night & Day Furniture frames carry a limited lifetime warranty on the frame ' +
      'mechanism. Mattresses include a 5-year warranty. Murphy cabinet beds have a 10-year ' +
      'warranty. Contact us for specific warranty questions about your product.',
  },
];

// ── getOfficeHoursStatus ────────────────────────────────────────────

export const getOfficeHoursStatus = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      // Try to load custom config from CMS
      let officeHours = DEFAULT_OFFICE_HOURS;
      try {
        const config = await wixData.query('ChatConfig')
          .eq('key', 'officeHours')
          .find();
        if (config.items.length > 0) {
          officeHours = safeParse(config.items[0].value, DEFAULT_OFFICE_HOURS, 'liveChat/officeHours');
        }
      } catch (e) {
        // Fall back to defaults
      }

      // Calculate current status based on office hours
      const now = new Date();
      const dayOfWeek = now.getDay();
      const schedule = officeHours.schedule[dayOfWeek];

      if (!schedule) {
        return {
          isOnline: false,
          message: 'We\'re currently closed. Leave a message and we\'ll get back to you!',
          nextOpen: getNextOpenTime(officeHours, now),
        };
      }

      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (currentTime >= schedule.open && currentTime < schedule.close) {
        return {
          isOnline: true,
          message: 'We\'re online! How can we help?',
          closesAt: schedule.close,
        };
      }

      if (currentTime < schedule.open) {
        return {
          isOnline: false,
          message: `We open at ${formatTime(schedule.open)} today. Leave a message!`,
          nextOpen: schedule.open,
        };
      }

      return {
        isOnline: false,
        message: 'We\'re closed for today. Leave a message and we\'ll respond tomorrow!',
        nextOpen: getNextOpenTime(officeHours, now),
      };
    } catch (err) {
      console.error('getOfficeHoursStatus error:', err);
      return {
        isOnline: false,
        message: 'Leave a message and we\'ll get back to you soon!',
        nextOpen: null,
      };
    }
  }
);

// ── getCannedResponses ──────────────────────────────────────────────

export const getCannedResponses = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      // Try to load custom responses from CMS
      try {
        const config = await wixData.query('ChatConfig')
          .eq('key', 'cannedResponses')
          .find();
        if (config.items.length > 0) {
          return {
            success: true,
            responses: safeParse(config.items[0].value, [], 'liveChat/cannedResponses'),
          };
        }
      } catch (e) {
        // Fall back to defaults
      }

      return {
        success: true,
        responses: DEFAULT_CANNED_RESPONSES,
      };
    } catch (err) {
      console.error('getCannedResponses error:', err);
      return { success: true, responses: DEFAULT_CANNED_RESPONSES };
    }
  }
);

// ── matchCannedResponse ─────────────────────────────────────────────

export const matchCannedResponse = webMethod(
  Permissions.Anyone,
  async (userMessage) => {
    try {
      const cleanMessage = sanitize(userMessage, 500).toLowerCase();
      if (!cleanMessage) return { matched: false };

      const responses = DEFAULT_CANNED_RESPONSES;

      // Check each canned response trigger
      for (const resp of responses) {
        if (cleanMessage.includes(resp.trigger)) {
          return {
            matched: true,
            response: resp,
          };
        }
      }

      // Check for common question patterns
      if (cleanMessage.includes('price') || cleanMessage.includes('cost') || cleanMessage.includes('how much')) {
        return {
          matched: true,
          response: {
            id: 'pricing',
            category: 'Pricing',
            title: 'Pricing Help',
            response: 'Pricing varies by product and configuration. Visit any product page ' +
              'for current pricing, or tell us which product you\'re looking at and we can help!',
          },
        };
      }

      return { matched: false };
    } catch (err) {
      console.error('matchCannedResponse error:', err);
      return { matched: false };
    }
  }
);

// ── createSupportTicket ─────────────────────────────────────────────

export const createSupportTicket = webMethod(
  Permissions.Anyone,
  async (ticketData = {}) => {
    try {
      const {
        name,
        email,
        message,
        page,
      } = ticketData;

      const cleanName = sanitize(name, 100);
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanMessage = sanitize(message, 5000);
      const cleanPage = sanitize(page, 200);

      if (!cleanMessage) {
        return { success: false, error: 'Message is required' };
      }

      if (cleanEmail && !validateEmail(cleanEmail)) {
        return { success: false, error: 'Please provide a valid email address' };
      }

      const ticket = await wixData.insert('SupportTickets', {
        name: cleanName || 'Anonymous',
        email: cleanEmail || '',
        message: cleanMessage,
        page: cleanPage,
        status: 'new',
        assignedTo: '',
        notes: '',
      });

      return {
        success: true,
        ticketId: ticket._id,
        message: 'Your message has been received! We\'ll get back to you soon.',
      };
    } catch (err) {
      console.error('createSupportTicket error:', err);
      return { success: false, error: 'Unable to submit message. Please try again.' };
    }
  }
);

// ── getChatContext ───────────────────────────────────────────────────
// Pre-populate chat with customer info from session

export const getChatContext = webMethod(
  Permissions.SiteMember,
  async (sessionInfo = {}) => {
    try {
      const { currentPage } = sessionInfo;

      const context = {
        page: sanitize(currentPage, 200),
        userName: '',
        userEmail: '',
        isLoggedIn: false,
        recentOrders: [],
      };

      // Use the authenticated caller's own member ID instead of accepting arbitrary IDs
      let cleanId = '';
      try {
        const { currentMember } = await import('wix-members-backend');
        const member = await currentMember.getMember();
        cleanId = member?._id || '';
      } catch (e) { /* not logged in */ }

      if (cleanId) {
          // Try to get member info
          try {
            const memberResult = await wixData.query('Members/PrivateMembersData')
              .eq('_id', cleanId)
              .find();

            if (memberResult.items.length > 0) {
              const member = memberResult.items[0];
              context.userName = member.name || member.firstName || '';
              context.userEmail = member.loginEmail || '';
              context.isLoggedIn = true;
            }
          } catch (e) {
            // Member lookup failed — continue without user info
          }

          // Try to get recent orders for context
          try {
            const orders = await wixData.query('Stores/Orders')
              .eq('buyerInfo.memberId', cleanId)
              .descending('_createdDate')
              .limit(3)
              .find();

            context.recentOrders = orders.items.map(o => ({
              number: o.number,
              date: o._createdDate,
              status: o.fulfillmentStatus || 'PROCESSING',
            }));
          } catch (e) {
            // Order lookup failed — continue without order context
          }
        }

      return { success: true, context };
    } catch (err) {
      console.error('getChatContext error:', err);
      return { success: true, context: { page: '', userName: '', userEmail: '', isLoggedIn: false, recentOrders: [] } };
    }
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function getNextOpenTime(officeHours, now) {
  const currentDay = now.getDay();

  for (let offset = 1; offset <= 7; offset++) {
    const day = (currentDay + offset) % 7;
    const schedule = officeHours.schedule[day];
    if (schedule) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `${dayNames[day]} at ${formatTime(schedule.open)}`;
    }
  }

  return null;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return minutes === 0 ? `${displayHours}${suffix}` : `${displayHours}:${String(minutes).padStart(2, '0')}${suffix}`;
}
