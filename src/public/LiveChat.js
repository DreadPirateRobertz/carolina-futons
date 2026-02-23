// LiveChat.js — Chat widget component for bottom-right corner
// Async loaded from masterPage.js, no impact on initial page speed.
// Handles pre-chat form, online/offline state, canned responses,
// message sending, and after-hours ticket creation.

import { isOnline, getCannedResponses, getCannedResponse, sendMessage, getChatHistory, createSupportTicket } from 'backend/liveChatService.web';
import { trackEvent } from 'public/engagementTracker';
import { colors } from 'public/designTokens.js';

let _sessionId = null;
let _userName = '';
let _userEmail = '';
let _isOnline = false;

/**
 * Initialize the live chat widget. Called from masterPage.js after page load.
 * @param {Function} $w - Wix $w selector
 */
export async function initLiveChat($w) {
  try {
    // Check online status
    const status = await isOnline();
    _isOnline = status.online;

    // Set online/offline indicator
    try {
      const indicator = $w('#chatStatusIndicator');
      if (indicator) {
        indicator.text = status.online ? 'Online' : 'Offline';
        indicator.style.color = status.online ? colors.successGreen : colors.textMuted;
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

    // ARIA labels
    try { $w('#chatToggleBtn').accessibility.ariaLabel = 'Open live chat'; } catch (e) {}
    try { $w('#chatCloseBtn').accessibility.ariaLabel = 'Close chat'; } catch (e) {}
    try { $w('#chatSendBtn').accessibility.ariaLabel = 'Send message'; } catch (e) {}
    try { $w('#chatMessageInput').accessibility.ariaLabel = 'Type your message'; } catch (e) {}
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
          widget.show('slide', { direction: 'bottom', duration: 300 });
          try { $w('#chatToggleBtn').label = '\u2715'; } catch (e) {}
          trackEvent('chat_opened', { online: _isOnline });
        } else {
          widget.hide('slide', { direction: 'bottom', duration: 300 });
          try { $w('#chatToggleBtn').label = '\uD83D\uDCAC'; } catch (e) {}
        }
      } catch (e) {}
    });

    // Close button inside widget
    try {
      $w('#chatCloseBtn').onClick(() => {
        try { $w('#chatWidget').hide('slide', { direction: 'bottom', duration: 300 }); } catch (e) {}
        try { $w('#chatToggleBtn').label = '\uD83D\uDCAC'; } catch (e) {}
      });
    } catch (e) {}

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
        }).catch(() => {});
      }).catch(() => {});
    } catch (e) {}

    try { $w('#preChatName').accessibility.ariaLabel = 'Your name'; } catch (e) {}
    try { $w('#preChatEmail').accessibility.ariaLabel = 'Your email'; } catch (e) {}
    try { $w('#preChatStart').accessibility.ariaLabel = 'Start chat'; } catch (e) {}

    $w('#preChatStart').onClick(() => {
      try {
        const name = $w('#preChatName').value?.trim() || '';
        const email = $w('#preChatEmail').value?.trim() || '';

        if (!email || !email.includes('@')) {
          try { $w('#preChatError').text = 'Please enter a valid email'; } catch (e) {}
          try { $w('#preChatError').show(); } catch (e) {}
          return;
        }

        _userName = name;
        _userEmail = email;

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
          });
        } else {
          // After hours — create support ticket
          await createSupportTicket({
            name: _userName,
            email: _userEmail,
            message: text,
            sessionId: _sessionId,
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

    // Append to existing text (simple text-based chat display)
    const prefix = sender === 'agent' ? `${name}: ` : `${name}: `;
    const currentText = messagesContainer.text || '';
    const newLine = currentText ? '\n' : '';
    messagesContainer.text = `${currentText}${newLine}${prefix}${text}`;
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
