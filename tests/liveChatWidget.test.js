import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock backend service — must be before module import
vi.mock('backend/liveChatService.web', () => ({
  isOnline: vi.fn().mockResolvedValue({ online: true, message: "We're online!", nextOpen: null }),
  getCannedResponses: vi.fn().mockResolvedValue([
    { key: 'shipping', label: 'Shipping' },
    { key: 'returns', label: 'Returns' },
  ]),
  getCannedResponse: vi.fn().mockResolvedValue({ label: 'Shipping', response: 'Free shipping over $999' }),
  sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-001' }),
  getChatHistory: vi.fn().mockResolvedValue([]),
  createSupportTicket: vi.fn().mockResolvedValue({ success: true, ticketId: 'ticket-001' }),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/proactiveChatTriggers.js', () => ({
  initProactiveTriggers: vi.fn(),
  cleanupProactiveTriggers: vi.fn(),
}));

import { initLiveChat, cleanupLiveChat } from '../src/public/LiveChat.js';
import { isOnline, sendMessage, createSupportTicket } from 'backend/liveChatService.web';
import { initProactiveTriggers, cleanupProactiveTriggers } from 'public/proactiveChatTriggers.js';

// ── $w Mock Factory ──────────────────────────────────────────────

function make$w(overrides = {}) {
  const elements = {};
  const defaults = {
    chatWidget: { hidden: true, show: vi.fn(), hide: vi.fn(), accessibility: {} },
    chatToggleBtn: { label: '', focus: vi.fn(), onClick: vi.fn(), accessibility: {} },
    chatCloseBtn: { onClick: vi.fn(), accessibility: {} },
    chatSendBtn: { onClick: vi.fn(), accessibility: {} },
    chatMessageInput: { value: '', onKeyPress: vi.fn(), accessibility: {} },
    chatMessages: { text: '', accessibility: {} },
    chatStatusIndicator: { text: '', style: {} },
    chatStatusMessage: { text: '' },
    chatNextOpen: { text: '' },
    preChatForm: { show: vi.fn(), hide: vi.fn() },
    preChatName: { value: '', accessibility: {} },
    preChatEmail: { value: '', accessibility: {} },
    preChatStart: { onClick: vi.fn(), accessibility: {} },
    preChatError: { text: '', show: vi.fn(), hide: vi.fn() },
    chatMessagesSection: { show: vi.fn(), hide: vi.fn() },
    cannedResponseRepeater: {
      data: [],
      onItemReady: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
    },
    a11yLiveRegion: { text: '', accessibility: {} },
    proactiveBubble: { text: '', show: vi.fn(), hide: vi.fn(), hidden: true, accessibility: {} },
    ...overrides,
  };

  Object.entries(defaults).forEach(([id, el]) => { elements[`#${id}`] = el; });

  return (selector) => {
    if (elements[selector]) return elements[selector];
    throw new Error(`Element ${selector} not found`);
  };
}

// ── Setup / Teardown ─────────────────────────────────────────────

let _savedDocument;
let _savedWindow;

beforeEach(() => {
  vi.clearAllMocks();
  isOnline.mockResolvedValue({ online: true, message: "We're online!", nextOpen: null });

  _savedDocument = globalThis.document;
  _savedWindow = globalThis.window;
  globalThis.document = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    activeElement: null,
  };
  globalThis.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    innerWidth: 1024,
  };
});

afterEach(() => {
  cleanupLiveChat();
  vi.restoreAllMocks();
  globalThis.document = _savedDocument;
  globalThis.window = _savedWindow;
});

// ═════════════════════════════════════════════════════════════════
// 1. RENDER — Widget starts collapsed
// ═════════════════════════════════════════════════════════════════

describe('Render', () => {
  it('hides chat widget on init (collapsed state)', async () => {
    const $w = make$w();
    await initLiveChat($w);
    expect($w('#chatWidget').hide).toHaveBeenCalled();
  });

  it('does not throw if non-critical elements are missing', async () => {
    const $w = (selector) => {
      if (selector === '#chatToggleBtn') return { label: '', focus: vi.fn(), onClick: vi.fn(), accessibility: {} };
      if (selector === '#chatWidget') return { hidden: true, show: vi.fn(), hide: vi.fn(), accessibility: {} };
      throw new Error('not found');
    };
    await expect(initLiveChat($w)).resolves.not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════
// 2. ONLINE/OFFLINE STATUS
// ═════════════════════════════════════════════════════════════════

describe('Hours detection', () => {
  it('displays online status when within business hours', async () => {
    isOnline.mockResolvedValue({ online: true, message: "We're online!", nextOpen: null });
    const $w = make$w();
    await initLiveChat($w);
    expect($w('#chatStatusIndicator').text).toBe('Online');
    expect($w('#chatStatusMessage').text).toBe("We're online!");
  });

  it('displays offline status when outside business hours', async () => {
    isOnline.mockResolvedValue({ online: false, message: 'We\'re offline right now.', nextOpen: 'Wednesday at 10am ET' });
    const $w = make$w();
    await initLiveChat($w);
    expect($w('#chatStatusIndicator').text).toBe('Offline');
    expect($w('#chatStatusMessage').text).toBe('We\'re offline right now.');
    expect($w('#chatNextOpen').text).toContain('Wednesday');
  });
});

// ═════════════════════════════════════════════════════════════════
// 3. AFTER-HOURS FALLBACK
// ═════════════════════════════════════════════════════════════════

describe('After-hours fallback', () => {
  it('sends support ticket when offline and user sends message', async () => {
    isOnline.mockResolvedValue({ online: false, message: 'Offline', nextOpen: 'Wed' });
    const $w = make$w();
    await initLiveChat($w);

    // Simulate pre-chat form submit to set email
    const preChatHandler = $w('#preChatStart').onClick.mock.calls[0]?.[0];
    $w('#preChatName').value = 'Jane';
    $w('#preChatEmail').value = 'jane@example.com';
    if (preChatHandler) preChatHandler();

    // Get send handler and simulate message
    const sendHandler = $w('#chatSendBtn').onClick.mock.calls[0]?.[0];
    $w('#chatMessageInput').value = 'I need help';
    if (sendHandler) await sendHandler();

    expect(createSupportTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'I need help',
        email: 'jane@example.com',
      })
    );
  });

  it('sends message to CMS when online', async () => {
    isOnline.mockResolvedValue({ online: true, message: 'Online', nextOpen: null });
    const $w = make$w();
    await initLiveChat($w);

    // Set user info via pre-chat
    const preChatHandler = $w('#preChatStart').onClick.mock.calls[0]?.[0];
    $w('#preChatName').value = 'Jane';
    $w('#preChatEmail').value = 'jane@example.com';
    if (preChatHandler) preChatHandler();

    const sendHandler = $w('#chatSendBtn').onClick.mock.calls[0]?.[0];
    $w('#chatMessageInput').value = 'Hello';
    if (sendHandler) await sendHandler();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Hello',
        sender: 'customer',
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════
// 4. PROACTIVE TRIGGER INTEGRATION
// ═════════════════════════════════════════════════════════════════

describe('Proactive trigger integration', () => {
  it('initializes proactive triggers when page option is provided', async () => {
    const $w = make$w();
    await initLiveChat($w, { page: 'product' });
    expect(initProactiveTriggers).toHaveBeenCalledWith(
      $w,
      expect.objectContaining({ page: 'product', isOnline: true })
    );
  });

  it('does not initialize proactive triggers without page option', async () => {
    const $w = make$w();
    await initLiveChat($w);
    expect(initProactiveTriggers).not.toHaveBeenCalled();
  });

  it('passes isOnline=false to proactive triggers when offline', async () => {
    isOnline.mockResolvedValue({ online: false, message: 'Offline', nextOpen: 'Wed' });
    const $w = make$w();
    await initLiveChat($w, { page: 'checkout' });
    expect(initProactiveTriggers).toHaveBeenCalledWith(
      $w,
      expect.objectContaining({ page: 'checkout', isOnline: false })
    );
  });
});

// ═════════════════════════════════════════════════════════════════
// 5. ARIA ACCESSIBILITY
// ═════════════════════════════════════════════════════════════════

describe('ARIA accessibility', () => {
  it('sets aria-label on toggle button', async () => {
    const $w = make$w();
    await initLiveChat($w);
    expect($w('#chatToggleBtn').accessibility.ariaLabel).toBeTruthy();
    expect($w('#chatToggleBtn').accessibility.ariaLabel).toMatch(/chat/i);
  });

  it('sets aria-label on close button', async () => {
    const $w = make$w();
    await initLiveChat($w);
    expect($w('#chatCloseBtn').accessibility.ariaLabel).toMatch(/close/i);
  });

  it('sets aria-label on send button', async () => {
    const $w = make$w();
    await initLiveChat($w);
    expect($w('#chatSendBtn').accessibility.ariaLabel).toMatch(/send/i);
  });

  it('sets aria-label on message input', async () => {
    const $w = make$w();
    await initLiveChat($w);
    expect($w('#chatMessageInput').accessibility.ariaLabel).toBeTruthy();
  });

  it('sets role="complementary" on chat widget container', async () => {
    const $w = make$w();
    await initLiveChat($w);
    expect($w('#chatWidget').accessibility.role).toBe('complementary');
  });

  it('sets aria-live="polite" on messages container for screen reader updates', async () => {
    const $w = make$w();
    await initLiveChat($w);

    // Send a message to trigger aria-live setup on messages container
    const preChatHandler = $w('#preChatStart').onClick.mock.calls[0]?.[0];
    $w('#preChatEmail').value = 'jane@example.com';
    if (preChatHandler) preChatHandler();

    const sendHandler = $w('#chatSendBtn').onClick.mock.calls[0]?.[0];
    $w('#chatMessageInput').value = 'Test';
    if (sendHandler) await sendHandler();

    expect($w('#chatMessages').accessibility.ariaLive).toBe('polite');
  });
});

// ═════════════════════════════════════════════════════════════════
// 6. KEYBOARD NAVIGATION
// ═════════════════════════════════════════════════════════════════

describe('Keyboard navigation', () => {
  it('Escape key closes chat panel', async () => {
    const widget = { hidden: false, show: vi.fn(), hide: vi.fn(), accessibility: {} };
    const $w = make$w({ chatWidget: widget });
    await initLiveChat($w);

    const keydownCall = globalThis.document.addEventListener.mock.calls.find(
      ([event]) => event === 'keydown'
    );
    expect(keydownCall).toBeDefined();

    const keyHandler = keydownCall[1];
    keyHandler({ key: 'Escape' });

    expect(widget.hide).toHaveBeenCalled();
  });

  it('Escape key restores focus to toggle button', async () => {
    const widget = { hidden: false, show: vi.fn(), hide: vi.fn(), accessibility: {} };
    const toggleBtn = { label: '', focus: vi.fn(), onClick: vi.fn(), accessibility: {} };
    const $w = make$w({ chatWidget: widget, chatToggleBtn: toggleBtn });
    await initLiveChat($w);

    const keydownCall = globalThis.document.addEventListener.mock.calls.find(
      ([event]) => event === 'keydown'
    );
    const keyHandler = keydownCall[1];
    keyHandler({ key: 'Escape' });

    expect(toggleBtn.focus).toHaveBeenCalled();
  });

  it('Enter key in message input sends message', async () => {
    const $w = make$w();
    await initLiveChat($w);

    const keyPressHandler = $w('#chatMessageInput').onKeyPress.mock.calls[0]?.[0];
    expect(keyPressHandler).toBeDefined();

    // Set up pre-chat first
    const preChatHandler = $w('#preChatStart').onClick.mock.calls[0]?.[0];
    $w('#preChatEmail').value = 'jane@example.com';
    if (preChatHandler) preChatHandler();

    $w('#chatMessageInput').value = 'Hello';
    if (keyPressHandler) await keyPressHandler({ key: 'Enter' });

    expect($w('#chatMessages').text).toContain('Hello');
  });
});

// ═════════════════════════════════════════════════════════════════
// 7. PRE-CHAT FORM
// ═════════════════════════════════════════════════════════════════

describe('Pre-chat form', () => {
  it('validates email before starting chat', async () => {
    const $w = make$w();
    await initLiveChat($w);

    const startHandler = $w('#preChatStart').onClick.mock.calls[0]?.[0];
    $w('#preChatEmail').value = 'not-valid';
    if (startHandler) startHandler();

    expect($w('#preChatError').show).toHaveBeenCalled();
    expect($w('#preChatForm').hide).not.toHaveBeenCalled();
  });

  it('hides form and shows messages section on valid email', async () => {
    const $w = make$w();
    await initLiveChat($w);

    const startHandler = $w('#preChatStart').onClick.mock.calls[0]?.[0];
    $w('#preChatName').value = 'Jane';
    $w('#preChatEmail').value = 'jane@example.com';
    if (startHandler) startHandler();

    expect($w('#preChatForm').hide).toHaveBeenCalled();
    expect($w('#chatMessagesSection').show).toHaveBeenCalled();
  });

  it('sets ARIA labels on pre-chat form fields', async () => {
    const $w = make$w();
    await initLiveChat($w);

    expect($w('#preChatName').accessibility.ariaLabel).toBeTruthy();
    expect($w('#preChatEmail').accessibility.ariaLabel).toBeTruthy();
    expect($w('#preChatStart').accessibility.ariaLabel).toBeTruthy();
  });
});

// ═════════════════════════════════════════════════════════════════
// 8. SPA CLEANUP
// ═════════════════════════════════════════════════════════════════

describe('SPA cleanup', () => {
  it('removes escape key listener on cleanup', async () => {
    const $w = make$w();
    await initLiveChat($w);

    cleanupLiveChat();

    expect(globalThis.document.removeEventListener).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    );
  });

  it('calls cleanupProactiveTriggers on cleanup', async () => {
    const $w = make$w();
    await initLiveChat($w, { page: 'product' });

    cleanupLiveChat();

    expect(cleanupProactiveTriggers).toHaveBeenCalled();
  });

  it('cleanup is safe to call without init', () => {
    expect(() => cleanupLiveChat()).not.toThrow();
  });

  it('cleanup is safe to call multiple times', async () => {
    const $w = make$w();
    await initLiveChat($w);

    expect(() => {
      cleanupLiveChat();
      cleanupLiveChat();
    }).not.toThrow();
  });
});
