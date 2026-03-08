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

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  createFocusTrap: vi.fn(() => ({
    release: vi.fn(),
    isActive: () => true,
    firstId: '#chatCloseBtn',
    lastId: '#chatSendBtn',
  })),
}));

import { initLiveChat, cleanupLiveChat } from '../../src/public/LiveChat.js';
import { isOnline, sendMessage, createSupportTicket } from 'backend/liveChatService.web';
import { initProactiveTriggers, cleanupProactiveTriggers } from 'public/proactiveChatTriggers.js';
import { createFocusTrap } from 'public/a11yHelpers';

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
    preChatCategory: { value: '', options: [], accessibility: {} },
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

// ═════════════════════════════════════════════════════════════════
// 9. PRE-CHAT QUESTION CATEGORY
// ═════════════════════════════════════════════════════════════════

describe('Pre-chat question category', () => {
  it('sets ARIA label on category dropdown', async () => {
    const $w = make$w();
    await initLiveChat($w);
    expect($w('#preChatCategory').accessibility.ariaLabel).toBeTruthy();
    expect($w('#preChatCategory').accessibility.ariaLabel).toMatch(/category/i);
  });

  it('sends question category with support ticket when offline', async () => {
    isOnline.mockResolvedValue({ online: false, message: 'Offline', nextOpen: 'Wed' });
    const $w = make$w();
    await initLiveChat($w);

    // Fill pre-chat form with category
    const preChatHandler = $w('#preChatStart').onClick.mock.calls[0]?.[0];
    $w('#preChatName').value = 'Jane';
    $w('#preChatEmail').value = 'jane@example.com';
    $w('#preChatCategory').value = 'Returns';
    if (preChatHandler) preChatHandler();

    // Send message
    const sendHandler = $w('#chatSendBtn').onClick.mock.calls[0]?.[0];
    $w('#chatMessageInput').value = 'Need to return my order';
    if (sendHandler) await sendHandler();

    expect(createSupportTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Returns',
      })
    );
  });

  it('sends question category with online message', async () => {
    isOnline.mockResolvedValue({ online: true, message: 'Online', nextOpen: null });
    const $w = make$w();
    await initLiveChat($w);

    const preChatHandler = $w('#preChatStart').onClick.mock.calls[0]?.[0];
    $w('#preChatName').value = 'Jane';
    $w('#preChatEmail').value = 'jane@example.com';
    $w('#preChatCategory').value = 'Sales';
    if (preChatHandler) preChatHandler();

    const sendHandler = $w('#chatSendBtn').onClick.mock.calls[0]?.[0];
    $w('#chatMessageInput').value = 'Price question';
    if (sendHandler) await sendHandler();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Sales',
      })
    );
  });

  it('defaults category to empty string if not selected', async () => {
    const $w = make$w();
    await initLiveChat($w);

    const preChatHandler = $w('#preChatStart').onClick.mock.calls[0]?.[0];
    $w('#preChatEmail').value = 'jane@example.com';
    if (preChatHandler) preChatHandler();

    const sendHandler = $w('#chatSendBtn').onClick.mock.calls[0]?.[0];
    $w('#chatMessageInput').value = 'Hello';
    if (sendHandler) await sendHandler();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        category: '',
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════
// 10. FOCUS TRAP
// ═════════════════════════════════════════════════════════════════

describe('Focus trap', () => {
  it('creates focus trap when chat widget opens', async () => {
    const widget = { hidden: true, show: vi.fn(), hide: vi.fn(), accessibility: {} };
    widget.show.mockImplementation(() => { widget.hidden = false; });
    const $w = make$w({ chatWidget: widget });
    await initLiveChat($w);

    // Click toggle to open
    const toggleHandler = $w('#chatToggleBtn').onClick.mock.calls[0]?.[0];
    if (toggleHandler) toggleHandler();

    expect(createFocusTrap).toHaveBeenCalledWith(
      $w,
      '#chatWidget',
      expect.arrayContaining(['#chatCloseBtn', '#chatSendBtn'])
    );
  });

  it('releases focus trap when chat widget closes via close button', async () => {
    const widget = { hidden: true, show: vi.fn(), hide: vi.fn(), accessibility: {} };
    widget.show.mockImplementation(() => { widget.hidden = false; });
    widget.hide.mockImplementation(() => { widget.hidden = true; });
    const $w = make$w({ chatWidget: widget });
    await initLiveChat($w);

    // Open chat
    const toggleHandler = $w('#chatToggleBtn').onClick.mock.calls[0]?.[0];
    if (toggleHandler) toggleHandler();

    const trap = createFocusTrap.mock.results[0]?.value;

    // Close chat via close button
    const closeHandler = $w('#chatCloseBtn').onClick.mock.calls[0]?.[0];
    if (closeHandler) closeHandler();

    expect(trap.release).toHaveBeenCalled();
  });

  it('releases focus trap on cleanup', async () => {
    const widget = { hidden: true, show: vi.fn(), hide: vi.fn(), accessibility: {} };
    widget.show.mockImplementation(() => { widget.hidden = false; });
    const $w = make$w({ chatWidget: widget });
    await initLiveChat($w);

    // Open chat to create trap
    const toggleHandler = $w('#chatToggleBtn').onClick.mock.calls[0]?.[0];
    if (toggleHandler) toggleHandler();

    const trap = createFocusTrap.mock.results[0]?.value;

    cleanupLiveChat();
    expect(trap.release).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════
// 11. MOBILE FULL-SCREEN
// ═════════════════════════════════════════════════════════════════

describe('Mobile full-screen', () => {
  it('applies mobile full-screen style when opening on mobile viewport', async () => {
    globalThis.window.innerWidth = 375;
    const widget = {
      hidden: true,
      show: vi.fn(),
      hide: vi.fn(),
      accessibility: {},
      style: {},
    };
    widget.show.mockImplementation(() => { widget.hidden = false; });
    const $w = make$w({ chatWidget: widget });
    await initLiveChat($w);

    const toggleHandler = $w('#chatToggleBtn').onClick.mock.calls[0]?.[0];
    if (toggleHandler) toggleHandler();

    // On mobile, widget style should indicate full-screen
    expect(widget.style.width).toBe('100%');
    expect(widget.style.height).toBe('100%');
  });

  it('does not apply mobile full-screen on desktop', async () => {
    globalThis.window.innerWidth = 1024;
    const widget = {
      hidden: true,
      show: vi.fn(),
      hide: vi.fn(),
      accessibility: {},
      style: {},
    };
    widget.show.mockImplementation(() => { widget.hidden = false; });
    const $w = make$w({ chatWidget: widget });
    await initLiveChat($w);

    const toggleHandler = $w('#chatToggleBtn').onClick.mock.calls[0]?.[0];
    if (toggleHandler) toggleHandler();

    expect(widget.style.width).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════
// 12. PAGE CONTEXT
// ═════════════════════════════════════════════════════════════════

describe('Page context', () => {
  it('passes pageUrl to sendMessage when provided', async () => {
    const $w = make$w();
    await initLiveChat($w, { page: 'product', pageUrl: '/product-page/eureka', productName: 'Eureka Futon Frame' });

    const preChatHandler = $w('#preChatStart').onClick.mock.calls[0]?.[0];
    $w('#preChatEmail').value = 'jane@example.com';
    if (preChatHandler) preChatHandler();

    const sendHandler = $w('#chatSendBtn').onClick.mock.calls[0]?.[0];
    $w('#chatMessageInput').value = 'Question about this';
    if (sendHandler) await sendHandler();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        pageUrl: '/product-page/eureka',
        productName: 'Eureka Futon Frame',
      })
    );
  });

  it('defaults pageUrl and productName to empty when not provided', async () => {
    const $w = make$w();
    await initLiveChat($w);

    const preChatHandler = $w('#preChatStart').onClick.mock.calls[0]?.[0];
    $w('#preChatEmail').value = 'jane@example.com';
    if (preChatHandler) preChatHandler();

    const sendHandler = $w('#chatSendBtn').onClick.mock.calls[0]?.[0];
    $w('#chatMessageInput').value = 'Hello';
    if (sendHandler) await sendHandler();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        pageUrl: '',
        productName: '',
      })
    );
  });
});
