import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('backend/browseAbandonment.web', () => ({
  trackBrowseSession: vi.fn().mockResolvedValue({ success: true }),
  captureRemindMeRequest: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('public/validators.js', () => ({
  validateEmail: vi.fn((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')),
}));

vi.mock('wix-location-frontend', () => ({
  default: { path: ['product-page', 'eureka-futon'] },
}));

const mockTrapRelease = vi.fn();
vi.mock('public/a11yHelpers.js', () => ({
  createFocusTrap: vi.fn(() => ({ release: mockTrapRelease, isActive: () => true })),
  announce: vi.fn(),
}));

import { initBrowseTracking, showRemindMePopup, _createBrowseState } from '../src/public/BrowseReminder.js';
import { trackBrowseSession, captureRemindMeRequest } from 'backend/browseAbandonment.web';
import { validateEmail } from 'public/validators.js';
import { createFocusTrap } from 'public/a11yHelpers.js';

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    style: { color: '', backgroundColor: '' },
    show: vi.fn(() => Promise.resolve()), hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    disable: vi.fn(), enable: vi.fn(), focus: vi.fn(),
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  return (sel) => { if (!els.has(sel)) els.set(sel, createMockElement()); return els.get(sel); };
}

describe('BrowseReminder', () => {
  let $w, state, browseState;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTrapRelease.mockClear();
    vi.useFakeTimers();
    $w = create$w();
    state = { product: { _id: 'prod-1', name: 'Test Futon', price: 499 } };
    browseState = _createBrowseState();

    // Mock sessionStorage
    const store = {};
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((k) => store[k] || null),
      setItem: vi.fn((k, v) => { store[k] = v; }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ── initBrowseTracking ──────────────────────────────────────

  describe('initBrowseTracking', () => {
    it('returns early when product is null', () => {
      state.product = null;
      initBrowseTracking($w, state, browseState);
      expect(browseState.productsViewed).toHaveLength(0);
    });

    it('generates a session ID', () => {
      initBrowseTracking($w, state, browseState);
      expect(browseState.sessionId).toBeTruthy();
      expect(browseState.sessionId).toMatch(/^bs_/);
    });

    it('records the current product view', () => {
      initBrowseTracking($w, state, browseState);
      expect(browseState.productsViewed).toHaveLength(1);
      expect(browseState.productsViewed[0].productId).toBe('prod-1');
      expect(browseState.productsViewed[0].productName).toBe('Test Futon');
      expect(browseState.productsViewed[0].price).toBe(499);
    });

    it('schedules remind-me popup after 2 minutes', () => {
      initBrowseTracking($w, state, browseState);
      expect($w('#remindMePopup').show).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect($w('#remindMePopup').show).toHaveBeenCalled();
    });

    it('stores session ID in sessionStorage', () => {
      initBrowseTracking($w, state, browseState);
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'cf_browse_session',
        expect.stringMatching(/^bs_/)
      );
    });

    it('reuses existing session ID from sessionStorage', () => {
      sessionStorage.getItem.mockReturnValue('bs_existing_123');
      initBrowseTracking($w, state, browseState);
      expect(browseState.sessionId).toBe('bs_existing_123');
    });

    it('registers visibilitychange listener', () => {
      const mockDoc = { addEventListener: vi.fn(), visibilityState: 'visible' };
      vi.stubGlobal('document', mockDoc);
      initBrowseTracking($w, state, browseState);
      expect(mockDoc.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('registers beforeunload listener', () => {
      const mockWin = { addEventListener: vi.fn() };
      vi.stubGlobal('window', mockWin);
      initBrowseTracking($w, state, browseState);
      expect(mockWin.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });
  });

  // ── showRemindMePopup ──────────────────────────────────────

  describe('showRemindMePopup', () => {
    beforeEach(() => {
      browseState.sessionId = 'bs_test_123';
    });

    it('shows the popup with fade animation', () => {
      showRemindMePopup($w, browseState);
      expect($w('#remindMePopup').show).toHaveBeenCalledWith('fade', { duration: 300 });
    });

    it('sets popup title and subtitle', () => {
      showRemindMePopup($w, browseState);
      expect($w('#remindMeTitle').text).toBe('Still deciding?');
      expect($w('#remindMeSubtitle').text).toContain('remind you');
    });

    it('sets ARIA dialog attributes', () => {
      showRemindMePopup($w, browseState);
      expect($w('#remindMePopup').accessibility.role).toBe('dialog');
      expect($w('#remindMePopup').accessibility.ariaModal).toBe(true);
    });

    it('sets accessibility labels on inputs', () => {
      showRemindMePopup($w, browseState);
      expect($w('#remindMeEmailInput').accessibility.ariaLabel).toContain('email');
    });

    it('marks popup as shown in sessionStorage', () => {
      showRemindMePopup($w, browseState);
      expect(sessionStorage.setItem).toHaveBeenCalledWith('cf_remind_shown', '1');
    });

    it('does not show if already shown this session', () => {
      sessionStorage.getItem.mockReturnValue('1');
      showRemindMePopup($w, browseState);
      expect($w('#remindMePopup').show).not.toHaveBeenCalled();
    });

    it('close button hides popup', () => {
      showRemindMePopup($w, browseState);
      const closeCb = $w('#remindMeClose').onClick.mock.calls[0][0];
      closeCb();
      expect($w('#remindMePopup').hide).toHaveBeenCalledWith('fade', { duration: 200 });
    });

    it('submit shows error for empty email', async () => {
      showRemindMePopup($w, browseState);
      $w('#remindMeEmailInput').value = '';
      const submitCb = $w('#remindMeSubmit').onClick.mock.calls[0][0];
      await submitCb();
      expect($w('#remindMeError').text).toContain('valid email');
      expect($w('#remindMeError').show).toHaveBeenCalled();
    });

    it('submit shows error for invalid email', async () => {
      showRemindMePopup($w, browseState);
      $w('#remindMeEmailInput').value = 'not-an-email';
      validateEmail.mockReturnValueOnce(false);
      const submitCb = $w('#remindMeSubmit').onClick.mock.calls[0][0];
      await submitCb();
      expect($w('#remindMeError').text).toContain('valid email');
    });

    it('submit calls captureRemindMeRequest for valid email', async () => {
      showRemindMePopup($w, browseState);
      $w('#remindMeEmailInput').value = 'test@example.com';
      validateEmail.mockReturnValueOnce(true);
      const submitCb = $w('#remindMeSubmit').onClick.mock.calls[0][0];
      await submitCb();
      expect(captureRemindMeRequest).toHaveBeenCalledWith('bs_test_123', 'test@example.com');
    });

    it('submit disables button and shows saving state', async () => {
      showRemindMePopup($w, browseState);
      $w('#remindMeEmailInput').value = 'test@example.com';
      validateEmail.mockReturnValueOnce(true);
      const submitCb = $w('#remindMeSubmit').onClick.mock.calls[0][0];
      await submitCb();
      expect($w('#remindMeSubmit').disable).toHaveBeenCalled();
    });

    it('submit shows success message after capture', async () => {
      showRemindMePopup($w, browseState);
      $w('#remindMeEmailInput').value = 'test@example.com';
      validateEmail.mockReturnValueOnce(true);
      const submitCb = $w('#remindMeSubmit').onClick.mock.calls[0][0];
      await submitCb();
      expect($w('#remindMeSuccess').text).toContain('reminder');
      expect($w('#remindMeSuccess').show).toHaveBeenCalled();
    });

    it('submit hides popup after 3 second delay on success', async () => {
      showRemindMePopup($w, browseState);
      $w('#remindMeEmailInput').value = 'test@example.com';
      validateEmail.mockReturnValueOnce(true);
      const submitCb = $w('#remindMeSubmit').onClick.mock.calls[0][0];
      await submitCb();
      vi.advanceTimersByTime(3000);
      expect($w('#remindMePopup').hide).toHaveBeenCalled();
    });

    it('submit re-enables button on API error', async () => {
      captureRemindMeRequest.mockRejectedValueOnce(new Error('API error'));
      showRemindMePopup($w, browseState);
      $w('#remindMeEmailInput').value = 'test@example.com';
      validateEmail.mockReturnValueOnce(true);
      const submitCb = $w('#remindMeSubmit').onClick.mock.calls[0][0];
      await submitCb();
      expect($w('#remindMeSubmit').enable).toHaveBeenCalled();
      expect($w('#remindMeSubmit').label).toBe('Remind Me');
    });

    it('submit shows error message on API failure', async () => {
      captureRemindMeRequest.mockRejectedValueOnce(new Error('Network error'));
      showRemindMePopup($w, browseState);
      $w('#remindMeEmailInput').value = 'test@example.com';
      validateEmail.mockReturnValueOnce(true);
      const submitCb = $w('#remindMeSubmit').onClick.mock.calls[0][0];
      await submitCb();
      expect($w('#remindMeError').text).toContain('Something went wrong');
      expect($w('#remindMeError').show).toHaveBeenCalled();
    });

    it('creates focus trap on popup open', () => {
      showRemindMePopup($w, browseState);
      expect(createFocusTrap).toHaveBeenCalledWith(
        $w, '#remindMePopup', ['#remindMeEmailInput', '#remindMeSubmit', '#remindMeClose']
      );
    });

    it('Escape key dismisses popup and releases focus trap', () => {
      const listeners = {};
      vi.stubGlobal('document', {
        addEventListener: vi.fn((evt, cb) => { listeners[evt] = cb; }),
        removeEventListener: vi.fn(),
      });
      showRemindMePopup($w, browseState);
      expect(listeners.keydown).toBeDefined();
      listeners.keydown({ key: 'Escape' });
      expect($w('#remindMePopup').hide).toHaveBeenCalledWith('fade', { duration: 200 });
      expect(mockTrapRelease).toHaveBeenCalled();
    });

    it('close button releases focus trap', () => {
      showRemindMePopup($w, browseState);
      const closeCb = $w('#remindMeClose').onClick.mock.calls[0][0];
      closeCb();
      expect(mockTrapRelease).toHaveBeenCalled();
    });

    it('does not throw when popup element is missing', () => {
      const broken$w = (sel) => {
        if (sel === '#remindMePopup') return null;
        return createMockElement();
      };
      expect(() => showRemindMePopup(broken$w, browseState)).not.toThrow();
    });

    it('trims whitespace from email input', async () => {
      showRemindMePopup($w, browseState);
      $w('#remindMeEmailInput').value = '  test@example.com  ';
      validateEmail.mockReturnValueOnce(true);
      const submitCb = $w('#remindMeSubmit').onClick.mock.calls[0][0];
      await submitCb();
      expect(captureRemindMeRequest).toHaveBeenCalledWith('bs_test_123', 'test@example.com');
    });
  });
});
