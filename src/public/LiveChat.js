// LiveChat.js — Chat widget component for bottom-right corner
// Async loaded from masterPage.js, no impact on initial page speed.
// Handles pre-chat form (name, email, question category), online/offline state,
// canned responses, message sending, after-hours ticket creation,
// focus trapping, and mobile full-screen layout.

import { isOnline, getCannedResponses, getCannedResponse, sendMessage, getChatHistory, createSupportTicket } from 'backend/liveChatService.web';
import { trackEvent } from 'public/engagementTracker';
import { colors, transitions, spacing } from 'public/designTokens.js';
import { validateEmail } from 'public/validators.js';
import { announce, createFocusTrap } from 'public/a11yHelpers';
import { initProactiveTriggers, cleanupProactiveTriggers } from 'public/proactiveChatTriggers.js';
import wixLocationFrontend from 'wix-location-frontend';

const MOBILE_BREAKPOINT = 768;

let _sessionId = null;
let _userName = '';
let _userEmail = '';
let _userCategory = '';
let _isOnline = false;
let _escapeKeyHandler = null;
let _focusTrap = null;
let _pageUrl = '';
let _productName = '';

/**
 * Initialize the live chat widget. Called from masterPage.js after page load.
 * @param {Function} $w - Wix $w selector
 * @param {Object} [options]
 * @param {string} [options.page] - Current page type ('product'|'checkout') for proactive triggers
 * @param {string} [options.pageUrl] - Current page URL for agent context
 * @param {string} [options.productName] - Current product name for agent context
 */
export async function initLiveChat($w, options = {}) {
  try {
    _pageUrl = options.pageUrl || '';
    _productName = options.productName || '';

    // Check online status
    const status = await isOnline();
    _isOnline = status.online;

    // Set online/offline indicator
    try {
      const indicator = $w('#chatStatusIndicator');
      if (indicator) {
        indicator.text = status.online ? 'Online' : 'Offline';
        indicator.style.color = status.online ? colors.success : colors.muted;
      }
    } catch (e) {}

    try {
      $w('#chatStatusMessage').text = status.message;
    } catch (e) {}

    if (!status.online && status.nextOpen) {
      try { $w('#chatNextOpen').text = `Back ${status.nextOpen}`; } catch (e) {}
    }

    // Generate or restore session ID
    _sessionId = getOrCreateSessionId();

    // Load canned response buttons
    await loadCannedButtons($w);

    // Set up chat toggle button (bottom-right)
    initChatToggle($w);

    // Set up pre-chat form
    initPreChatForm($w);

    // Set up message input
    initMessageInput($w);

    // Restore existing chat history
    await restoreChatHistory($w);

    // ARIA attributes
    try { $w('#chatWidget').accessibility.role = 'complementary'; } catch (e) {}
    try { $w('#chatToggleBtn').accessibility.ariaLabel = 'Open live chat'; } catch (e) {}
    try { $w('#chatCloseBtn').accessibility.ariaLabel = 'Close chat'; } catch (e) {}
    try { $w('#chatSendBtn').accessibility.ariaLabel = 'Send message'; } catch (e) {}
    try { $w('#chatMessageInput').accessibility.ariaLabel = 'Type your message'; } catch (e) {}

    // Proactive chat triggers (Product Page & Checkout only)
    if (options.page) {
      try {
        initProactiveTriggers($w, { page: options.page, isOnline: _isOnline });
      } catch (e) {}
    }

    // Wire cleanup to SPA navigation — prevent listener/timer leaks across pages
    try {
      wixLocationFrontend.onChange(() => { cleanupLiveChat(); });
    } catch (e) {}
  } catch (e) {
    // Chat widget is non-critical — never block the page
  }
}

// ── Chat Toggle ──────────────────────────────────────────────────

function initChatToggle($w) {
  try {
    $w('#chatToggleBtn').onClick(() => {
      try {
        const widget = $w('#chatWidget');
        if (widget.hidden) {
          _applyMobileStyles($w, widget);
          widget.show('slide', { direction: 'bottom', duration: 300 });
          try { $w('#chatToggleBtn').label = '\u2715'; } catch (e) {}
          _activateFocusTrap($w);
          trackEvent('chat_opened', { online: _isOnline });
        } else {
          _clearMobileStyles(widget);
          widget.hide('slide', { direction: 'bottom', duration: 300 });
          try { $w('#chatToggleBtn').label = '\uD83D\uDCAC'; } catch (e) {}
          _releaseFocusTrap();
        }
      } catch (e) {}
    });

    // Close button inside widget
    try {
      $w('#chatCloseBtn').onClick(() => {
        try {
          const widget = $w('#chatWidget');
          _clearMobileStyles(widget);
          widget.hide('slide', { direction: 'bottom', duration: 300 });
        } catch (e) {}
        try { $w('#chatToggleBtn').label = '\uD83D\uDCAC'; } catch (e) {}
        _releaseFocusTrap();
      });
    } catch (e) {}

    // Escape key closes chat — store ref for cleanup
    if (typeof document !== 'undefined') {
      if (_escapeKeyHandler) {
        document.removeEventListener('keydown', _escapeKeyHandler);
      }
      _escapeKeyHandler = (e) => {
        if (e.key === 'Escape') {
          try {
            const widget = $w('#chatWidget');
            if (!widget.hidden) {
              _clearMobileStyles(widget);
              widget.hide('slide', { direction: 'bottom', duration: 300 });
              try { $w('#chatToggleBtn').label = '💬'; } catch (e2) {}
              try { $w('#chatToggleBtn').focus(); } catch (e2) {}
              _releaseFocusTrap();
            }
          } catch (e2) {}
        }
      };
      document.addEventListener('keydown', _escapeKeyHandler);
    }

    // Keep widget collapsed initially
    try { $w('#chatWidget').hide(); } catch (e) {}
  } catch (e) {}
}

// ── Pre-Chat Form ────────────────────────────────────────────────

function initPreChatForm($w) {
  try {
    // Check if user is already logged in (has member data)
    try {
      import('wix-members-frontend').then(({ currentMember }) => {
        currentMember.getMember().then(member => {
          if (member) {
            _userName = member.contactDetails?.firstName || '';
            _userEmail = member.loginEmail || '';
            // Skip pre-chat form for logged-in users
            try { $w('#preChatForm').hide(); } catch (e) {}
            try { $w('#chatMessagesSection').show(); } catch (e) {}
          }
        }).catch(err => console.error('[LiveChat] getMember failed:', err.message));
      }).catch(err => console.error('[LiveChat] wix-members-frontend import failed:', err.message));
    } catch (e) {}

    try { $w('#preChatName').accessibility.ariaLabel = 'Your name'; } catch (e) {}
    try { $w('#preChatEmail').accessibility.ariaLabel = 'Your email'; } catch (e) {}
    try { $w('#preChatCategory').accessibility.ariaLabel = 'Question category'; } catch (e) {}
    try { $w('#preChatStart').accessibility.ariaLabel = 'Start chat'; } catch (e) {}

    $w('#preChatStart').onClick(() => {
      try {
        const name = $w('#preChatName').value?.trim() || '';
        const email = $w('#preChatEmail').value?.trim() || '';

        if (!email || !validateEmail(email)) {
          try { $w('#preChatError').text = 'Please enter a valid email'; } catch (e) {}
          try { $w('#preChatError').show(); } catch (e) {}
          return;
        }

        _userName = name;
        _userEmail = email;

        // Capture question category (Sales/Support/Returns)
        try {
          _userCategory = $w('#preChatCategory').value?.trim() || '';
        } catch (e) {
          _userCategory = '';
        }

        try { $w('#preChatError').hide(); } catch (e) {}
        try { $w('#preChatForm').hide(); } catch (e) {}
        try { $w('#chatMessagesSection').show(); } catch (e) {}
      } catch (e) {}
    });
  } catch (e) {}
}

// ── Canned Responses ─────────────────────────────────────────────

async function loadCannedButtons($w) {
  try {
    const topics = await getCannedResponses();
    const repeater = $w('#cannedResponseRepeater');
    if (!repeater || !topics.length) return;

    repeater.data = topics.map(t => ({ _id: t.key, label: t.label, key: t.key }));
    repeater.onItemReady(($item, itemData) => {
      try {
        $item('#cannedBtn').label = itemData.label;
        $item('#cannedBtn').onClick(async () => {
          const response = await getCannedResponse(itemData.key);
          if (response) {
            appendMessage($w, response.response, 'agent', 'Carolina Futons');
          }
        });
      } catch (e) {}
    });
  } catch (e) {}
}

// ── Message Input ────────────────────────────────────────────────

function initMessageInput($w) {
  try {
    const sendBtn = $w('#chatSendBtn');
    const input = $w('#chatMessageInput');

    const handleSend = async () => {
      const text = input.value?.trim();
      if (!text) return;

      input.value = '';
      appendMessage($w, text, 'customer', _userName || 'You');

      try {
        if (_isOnline) {
          // Send to CMS for agent pickup
          await sendMessage({
            sessionId: _sessionId,
            message: text,
            senderName: _userName,
            senderEmail: _userEmail,
            sender: 'customer',
            category: _userCategory,
            pageUrl: _pageUrl,
            productName: _productName,
          });
        } else {
          // After hours — create support ticket
          await createSupportTicket({
            name: _userName,
            email: _userEmail,
            message: text,
            sessionId: _sessionId,
            category: _userCategory,
          });

          appendMessage(
            $w,
            'Thanks for your message! We\'re currently offline but will respond via email within 1 business day.',
            'agent',
            'Carolina Futons'
          );
        }

        trackEvent('chat_message_sent', { online: _isOnline });
      } catch (err) {
        console.error('[LiveChat] Failed to send message:', err.message);
        appendMessage($w, 'Sorry, we couldn\'t send your message. Please try again.', 'agent', 'System');
      }
    };

    sendBtn.onClick(handleSend);

    // Enter key to send
    try {
      input.onKeyPress((event) => {
        if (event.key === 'Enter') handleSend();
      });
    } catch (e) {}
  } catch (e) {}
}

// ── Message Display ──────────────────────────────────────────────

function appendMessage($w, text, sender, name) {
  try {
    const messagesContainer = $w('#chatMessages');
    if (!messagesContainer) return;

    // Ensure aria-live is set so screen readers announce new messages
    try { messagesContainer.accessibility.ariaLive = 'polite'; } catch (e) {}
    try { messagesContainer.accessibility.role = 'log'; } catch (e) {}

    // Append to existing text (simple text-based chat display)
    const prefix = sender === 'agent' ? `${name}: ` : `${name}: `;
    const currentText = messagesContainer.text || '';
    const newLine = currentText ? '\n' : '';
    messagesContainer.text = `${currentText}${newLine}${prefix}${text}`;

    // Announce new messages to screen readers
    if (sender === 'agent') {
      announce($w, `${name} says: ${text}`, 'polite');
    }
  } catch (e) {}
}

// ── Chat History ─────────────────────────────────────────────────

async function restoreChatHistory($w) {
  try {
    if (!_sessionId) return;

    const history = await getChatHistory(_sessionId);
    if (!history.length) return;

    for (const msg of history) {
      appendMessage($w, msg.message, msg.sender, msg.senderName || (msg.sender === 'agent' ? 'Carolina Futons' : 'You'));
    }
  } catch (e) {}
}

// ── Session Management ───────────────────────────────────────────

function getOrCreateSessionId() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const existing = sessionStorage.getItem('cf_chat_session');
      if (existing) return existing;

      const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('cf_chat_session', id);
      return id;
    }
  } catch (e) {}

  // Fallback if sessionStorage unavailable
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Focus Trap ──────────────────────────────────────────────────

function _activateFocusTrap($w) {
  _releaseFocusTrap();
  try {
    _focusTrap = createFocusTrap($w, '#chatWidget', [
      '#chatCloseBtn',
      '#chatMessageInput',
      '#chatSendBtn',
    ]);
  } catch (e) {}
}

function _releaseFocusTrap() {
  try {
    if (_focusTrap) {
      _focusTrap.release();
      _focusTrap = null;
    }
  } catch (e) {}
}

// ── Mobile Full-Screen ──────────────────────────────────────────

function _isMobile() {
  try {
    if (typeof window !== 'undefined') {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }
  } catch (e) {}
  return false;
}

function _applyMobileStyles($w, widget) {
  if (!_isMobile()) return;
  try {
    widget.style.width = '100%';
    widget.style.height = '100%';
  } catch (e) {}
}

function _clearMobileStyles(widget) {
  try {
    if (widget && widget.style) {
      delete widget.style.width;
      delete widget.style.height;
    }
  } catch (e) {}
}

/**
 * Remove all LiveChat document event listeners.
 * Call on SPA page navigation to prevent memory leaks.
 */
export function cleanupLiveChat() {
  try {
    if (typeof document !== 'undefined' && _escapeKeyHandler) {
      document.removeEventListener('keydown', _escapeKeyHandler);
      _escapeKeyHandler = null;
    }
  } catch (e) {}
  _releaseFocusTrap();
  try { cleanupProactiveTriggers(); } catch (e) {}
}
