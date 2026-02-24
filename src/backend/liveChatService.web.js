/**
 * @module liveChatService
 * @description Live chat customer support backend.
 * Handles office hours logic (Wed-Sat 10am-5pm ET), canned responses,
 * after-hours ticket creation, and chat history persistence.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

// ─── Office Hours Config ─────────────────────────────────────────

const OFFICE_HOURS = {
  timezone: 'America/New_York',
  // 0=Sun, 1=Mon, ..., 3=Wed, 4=Thu, 5=Fri, 6=Sat
  days: [3, 4, 5, 6], // Wed-Sat
  openHour: 10,
  closeHour: 17,
};

// ─── Canned Responses ────────────────────────────────────────────

const CANNED_RESPONSES = {
  shipping: {
    label: 'Shipping & Delivery',
    response: 'We offer free shipping on orders over $999! Standard delivery takes 5-10 business days. White-glove delivery is available for larger items — local delivery within 50 miles is $149, regional is $249. Orders over $1,999 include free white-glove delivery.',
  },
  returns: {
    label: 'Returns & Exchanges',
    response: 'We accept returns within 30 days of delivery for items in original condition. Custom fabric orders are final sale. Return shipping is the customer\'s responsibility unless the item arrived damaged. Contact us and we\'ll walk you through the process.',
  },
  assembly: {
    label: 'Assembly & Setup',
    response: 'Most futon frames ship flat-packed with hardware included and can be assembled in 30-45 minutes with basic tools. Assembly guides are available on each product page. Murphy cabinet beds typically require 2 people and about 2 hours. White-glove delivery includes setup!',
  },
  fabrics: {
    label: 'Fabric Swatches',
    response: 'We offer over 700 fabric options! Request up to 5 free swatches shipped to your door — just visit our Contact page or ask us here. In-store, you can see and feel our full swatch collection at our Hendersonville showroom.',
  },
  hours: {
    label: 'Store Hours',
    response: 'Our Hendersonville showroom is open Wednesday through Saturday, 10am to 5pm Eastern. We\'re located at 824 Locust St, Hendersonville, NC 28792. Online chat support follows the same hours.',
  },
  financing: {
    label: 'Financing Options',
    response: 'We offer flexible financing through our partner. On the product page, look for the "Monthly Payments" section to see estimated payments. Apply at checkout — most decisions are instant. 0% APR available on select promotions!',
  },
};

// ─── isOnline ────────────────────────────────────────────────────

/**
 * Check if live chat is currently within office hours.
 *
 * @returns {Promise<{online: boolean, nextOpen: string|null, message: string}>}
 */
export const isOnline = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const now = getCurrentTimeET();
      const day = now.getDay();
      const hour = now.getHours();

      const online = OFFICE_HOURS.days.includes(day)
        && hour >= OFFICE_HOURS.openHour
        && hour < OFFICE_HOURS.closeHour;

      let nextOpen = null;
      let message;

      if (online) {
        message = 'We\'re online! How can we help?';
      } else {
        nextOpen = getNextOpenTime(now);
        message = 'We\'re offline right now. Leave a message and we\'ll get back to you!';
      }

      return { online, nextOpen, message };
    } catch (err) {
      console.error('Error checking online status:', err);
      return { online: false, nextOpen: null, message: 'Chat is currently unavailable.' };
    }
  }
);

// ─── getCannedResponses ──────────────────────────────────────────

/**
 * Get available canned response topics for quick-help buttons.
 *
 * @returns {Promise<Object[]>} Array of {key, label} pairs
 */
export const getCannedResponses = webMethod(
  Permissions.Anyone,
  async () => {
    return Object.entries(CANNED_RESPONSES).map(([key, val]) => ({
      key,
      label: val.label,
    }));
  }
);

/**
 * Get a specific canned response by topic key.
 *
 * @param {string} topic - Canned response key
 * @returns {Promise<{label: string, response: string}|null>}
 */
export const getCannedResponse = webMethod(
  Permissions.Anyone,
  async (topic) => {
    if (!topic || typeof topic !== 'string') return null;
    const entry = CANNED_RESPONSES[topic];
    return entry ? { label: entry.label, response: entry.response } : null;
  }
);

// ─── sendMessage ─────────────────────────────────────────────────

/**
 * Send a chat message and persist to CMS.
 *
 * @param {Object} params
 * @param {string} params.sessionId - Chat session ID
 * @param {string} params.message - Message text
 * @param {string} [params.senderName] - Display name
 * @param {string} [params.senderEmail] - Email for follow-up
 * @param {string} [params.sender] - 'customer' or 'agent'
 * @returns {Promise<{success: boolean, messageId: string}>}
 */
export const sendMessage = webMethod(
  Permissions.Anyone,
  async (params = {}) => {
    try {
      const { sessionId, message, senderName, senderEmail, sender = 'customer' } = params;

      if (!sessionId || !message) {
        return { success: false, error: 'Session ID and message are required' };
      }

      const cleanMessage = sanitize(message, 2000);
      if (!cleanMessage) {
        return { success: false, error: 'Message cannot be empty' };
      }

      const record = {
        sessionId: sanitize(sessionId, 100),
        message: cleanMessage,
        senderName: sanitize(senderName || '', 100),
        senderEmail: senderEmail && validateEmail(senderEmail) ? senderEmail.trim() : '',
        sender: 'customer',
        timestamp: new Date(),
        read: sender === 'agent',
      };

      const inserted = await wixData.insert('ChatMessages', record);

      return { success: true, messageId: inserted._id };
    } catch (err) {
      console.error('Error sending chat message:', err);
      return { success: false, error: 'Failed to send message' };
    }
  }
);

// ─── getChatHistory ──────────────────────────────────────────────

/**
 * Get chat history for a session.
 *
 * @param {string} sessionId - Chat session ID
 * @param {number} [limit=50] - Max messages to return
 * @returns {Promise<Object[]>} Messages sorted by timestamp ascending
 */
export const getChatHistory = webMethod(
  Permissions.SiteMember,
  async (sessionId, limit = 50) => {
    try {
      if (!sessionId) return [];
      const cleanSessionId = sanitize(sessionId, 100);
      if (!cleanSessionId) return [];

      const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);

      const results = await wixData.query('ChatMessages')
        .eq('sessionId', cleanSessionId)
        .ascending('timestamp')
        .limit(safeLimit)
        .find();

      return results.items.map(item => ({
        _id: item._id,
        message: item.message,
        senderName: item.senderName,
        sender: item.sender,
        timestamp: item.timestamp,
        read: item.read,
      }));
    } catch (err) {
      console.error('Error fetching chat history:', err);
      return [];
    }
  }
);

// ─── createSupportTicket ─────────────────────────────────────────

/**
 * Create a support ticket from an after-hours chat message.
 *
 * @param {Object} params
 * @param {string} params.name - Customer name
 * @param {string} params.email - Customer email
 * @param {string} params.message - Message text
 * @param {string} [params.sessionId] - Chat session ID for reference
 * @returns {Promise<{success: boolean, ticketId: string}>}
 */
export const createSupportTicket = webMethod(
  Permissions.Anyone,
  async (params = {}) => {
    try {
      const { name, email, message, sessionId } = params;

      if (!email || !validateEmail(email)) {
        return { success: false, error: 'Valid email is required' };
      }

      if (!message) {
        return { success: false, error: 'Message is required' };
      }

      const ticket = {
        customerName: sanitize(name || '', 100),
        customerEmail: email.trim(),
        message: sanitize(message, 2000),
        sessionId: sessionId ? sanitize(sessionId, 100) : '',
        status: 'open',
        priority: 'normal',
        source: 'live_chat',
        createdDate: new Date(),
      };

      const inserted = await wixData.insert('SupportTickets', ticket);

      return { success: true, ticketId: inserted._id };
    } catch (err) {
      console.error('Error creating support ticket:', err);
      return { success: false, error: 'Failed to create ticket' };
    }
  }
);

// ─── Internal helpers ────────────────────────────────────────────

function getCurrentTimeET() {
  // Create a Date that represents current time in ET
  // In production, this uses the server's timezone handling
  const now = new Date();
  try {
    const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    return new Date(etString);
  } catch {
    // Fallback: assume server is in ET or close to it
    return now;
  }
}

function getNextOpenTime(now) {
  const day = now.getDay();
  const hour = now.getHours();

  // If it's an open day but before opening
  if (OFFICE_HOURS.days.includes(day) && hour < OFFICE_HOURS.openHour) {
    return formatNextOpen(day, OFFICE_HOURS.openHour);
  }

  // Find the next open day
  for (let offset = 1; offset <= 7; offset++) {
    const nextDay = (day + offset) % 7;
    if (OFFICE_HOURS.days.includes(nextDay)) {
      return formatNextOpen(nextDay, OFFICE_HOURS.openHour);
    }
  }

  return null;
}

function formatNextOpen(day, hour) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hourStr = hour > 12 ? `${hour - 12}pm` : `${hour}am`;
  return `${days[day]} at ${hourStr} ET`;
}
