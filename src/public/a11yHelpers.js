/**
 * WCAG 2.1 AA Accessibility Helpers
 *
 * Provides skip navigation, focus management, contrast validation,
 * ARIA landmark validation, and keyboard navigation utilities.
 * Used by page files to enhance accessibility compliance.
 */

import { colors } from './sharedTokens.js';

// ── Skip Navigation ─────────────────────────────────────────────────

/**
 * Initialize skip navigation link. Creates or configures a skip link
 * that focuses the main content area on activation.
 *
 * @param {Function} $w - Wix selector function
 * @param {string} [mainContentId='#mainContent'] - Selector for main content
 * @param {string} [skipLinkId='#skipNav'] - Selector for skip link element
 */
export function initSkipNav($w, mainContentId = '#mainContent', skipLinkId = '#skipNav') {
  try {
    const skipLink = $w(skipLinkId);
    try { skipLink.accessibility.ariaLabel = 'Skip to main content'; } catch (e) {}
    skipLink.onClick(() => {
      try {
        $w(mainContentId).scrollTo();
      } catch (e) {
        // Main content element might not exist
      }
    });
  } catch (e) {
    // Skip link element doesn't exist on this page
  }
}

// ── Focus Trap ──────────────────────────────────────────────────────

/**
 * Create a focus trap for modals/dialogs. Listens for Tab/Shift+Tab
 * and wraps focus between first and last focusable elements.
 *
 * @param {Function} $w - Wix selector function
 * @param {string} containerId - Wix element ID of the trap container
 * @param {Array<string>} focusableIds - Element IDs that can receive focus
 * @returns {{ firstId: string, lastId: string, isActive: Function, release: Function }}
 */
export function createFocusTrap($w, containerId, focusableIds) {
  if (!containerId || !focusableIds || focusableIds.length === 0) {
    return { release: () => {}, isActive: () => false };
  }

  const state = {
    active: true,
    currentFocusId: null,
    firstId: focusableIds[0],
    lastId: focusableIds[focusableIds.length - 1],
  };

  for (const id of focusableIds) {
    try {
      const el = $w(id);
      if (el && el.onFocus) {
        el.onFocus(() => { state.currentFocusId = id; });
      }
    } catch (e) { /* element may not support onFocus */ }
  }

  function onKeydown(e) {
    if (e.key !== 'Tab' || !state.active) return;
    if (!e.shiftKey && state.currentFocusId === state.lastId) {
      e.preventDefault();
      try { $w(state.firstId).focus(); } catch (err) { /* */ }
    } else if (e.shiftKey && state.currentFocusId === state.firstId) {
      e.preventDefault();
      try { $w(state.lastId).focus(); } catch (err) { /* */ }
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', onKeydown);
  }

  return {
    containerId,
    focusableIds,
    firstId: state.firstId,
    lastId: state.lastId,
    isActive() { return state.active; },
    release() {
      state.active = false;
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', onKeydown);
      }
    },
  };
}

// ── Contrast Ratio Calculation ──────────────────────────────────────

/**
 * Parse a hex color to RGB components.
 * @param {string} hex - Hex color string (e.g. "#FFFFFF" or "FFFFFF")
 * @returns {{ r: number, g: number, b: number } | null}
 */
export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/**
 * Calculate relative luminance per WCAG 2.1.
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {number} Luminance value 0-1
 */
export function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two hex colors.
 * WCAG 2.1 AA requires >= 4.5:1 for normal text, >= 3:1 for large text.
 *
 * @param {string} foreground - Foreground hex color
 * @param {string} background - Background hex color
 * @returns {number} Contrast ratio (1 to 21)
 */
export function contrastRatio(foreground, background) {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return 0;

  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color pair meets WCAG AA contrast requirements.
 *
 * @param {string} foreground - Foreground hex color
 * @param {string} background - Background hex color
 * @param {'normal'|'large'} [textSize='normal'] - Text size category
 * @returns {{ passes: boolean, ratio: number, required: number }}
 */
export function meetsContrastAA(foreground, background, textSize = 'normal') {
  const ratio = contrastRatio(foreground, background);
  const required = textSize === 'large' ? 3 : 4.5;
  return {
    passes: ratio >= required,
    ratio: Math.round(ratio * 100) / 100,
    required,
  };
}

// ── ARIA Landmark Validation ────────────────────────────────────────

/**
 * Required ARIA landmarks per WCAG 2.1 AA.
 */
export const REQUIRED_LANDMARKS = ['banner', 'navigation', 'main', 'contentinfo'];

/**
 * Validate that all required ARIA landmarks are present on a page.
 *
 * @param {Array<string>} presentLandmarks - Landmarks found on the page
 * @returns {{ valid: boolean, missing: Array<string> }}
 */
export function validateLandmarks(presentLandmarks) {
  if (!Array.isArray(presentLandmarks)) {
    return { valid: false, missing: [...REQUIRED_LANDMARKS] };
  }

  const normalized = presentLandmarks.map(l => l.toLowerCase().trim());
  const missing = REQUIRED_LANDMARKS.filter(l => !normalized.includes(l));

  return {
    valid: missing.length === 0,
    missing,
  };
}

// ── Alt Text Validation ─────────────────────────────────────────────

const BAD_ALT_PATTERNS = [
  /^image$/i,
  /^img$/i,
  /^photo$/i,
  /^picture$/i,
  /^untitled$/i,
  /^\.jpg$/i,
  /^\.png$/i,
  /^\.webp$/i,
  /^\s*$/,
];

/**
 * Validate that alt text is descriptive (not generic like "image" or empty).
 *
 * @param {string} altText - The alt text to validate
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateAltText(altText) {
  if (altText === undefined || altText === null) {
    return { valid: false, reason: 'Missing alt attribute' };
  }

  // Decorative images can have empty alt="" (intentional)
  if (altText === '') {
    return { valid: true, reason: 'Decorative image (empty alt)' };
  }

  const trimmed = altText.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Alt text is only whitespace' };
  }

  for (const pattern of BAD_ALT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: `Generic alt text: "${trimmed}"` };
    }
  }

  if (trimmed.length < 3) {
    return { valid: false, reason: 'Alt text too short (less than 3 characters)' };
  }

  return { valid: true };
}

// ── Focus Indicator Check ───────────────────────────────────────────

/**
 * Recommended focus indicator styles per WCAG 2.1 AA.
 * @returns {Object} CSS properties for visible focus indicators
 */
export function getFocusIndicatorStyle() {
  return {
    outline: `3px solid ${colors.mountainBlue}`,
    outlineOffset: '2px',
  };
}

// ── Form Accessibility ──────────────────────────────────────────────

/**
 * Validate that a form field has proper accessibility attributes.
 *
 * @param {Object} field - Form field descriptor
 * @param {string} field.id - Element ID
 * @param {string} [field.label] - Associated label text
 * @param {string} [field.ariaLabel] - aria-label value
 * @param {string} [field.ariaLabelledBy] - aria-labelledby reference
 * @param {boolean} [field.required] - Whether field is required
 * @param {string} [field.ariaDescribedBy] - aria-describedby for error messages
 * @returns {{ valid: boolean, issues: Array<string> }}
 */
export function validateFormField(field) {
  const issues = [];

  if (!field || !field.id) {
    return { valid: false, issues: ['Field must have an id'] };
  }

  // Must have at least one labeling method
  const hasLabel = field.label && field.label.trim().length > 0;
  const hasAriaLabel = field.ariaLabel && field.ariaLabel.trim().length > 0;
  const hasAriaLabelledBy = field.ariaLabelledBy && field.ariaLabelledBy.trim().length > 0;

  if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
    issues.push('Field must have a label, aria-label, or aria-labelledby');
  }

  // Required fields should have aria-required
  if (field.required && !field.ariaRequired) {
    issues.push('Required fields should have aria-required="true"');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// ── Design Token Contrast Audit ─────────────────────────────────────

/**
 * Audit all design token color pairs used on the site for WCAG AA contrast.
 * Tests common foreground/background combinations.
 *
 * @returns {Array<{ pair: string, foreground: string, background: string, ratio: number, passes: boolean, textSize: string }>}
 */
export function auditDesignTokenContrast() {
  const pairs = [
    { pair: 'espresso on sandLight', fg: colors.espresso, bg: colors.sandLight, size: 'normal' },
    { pair: 'espresso on sandBase', fg: colors.espresso, bg: colors.sandBase, size: 'normal' },
    { pair: 'espresso on white', fg: colors.espresso, bg: colors.white, size: 'normal' },
    { pair: 'white on espresso', fg: colors.white, bg: colors.espresso, size: 'normal' },
    { pair: 'white on mountainBlue', fg: colors.white, bg: colors.mountainBlue, size: 'large' },
    { pair: 'white on mountainBlueDark', fg: colors.white, bg: colors.mountainBlueDark, size: 'normal' },
    { pair: 'espresso on sunsetCoral', fg: colors.espresso, bg: colors.sunsetCoral, size: 'large' },
    { pair: 'white on sunsetCoralDark', fg: colors.white, bg: colors.sunsetCoralDark, size: 'large' },
    { pair: 'espresso on mountainBlueLight', fg: colors.espresso, bg: colors.mountainBlueLight, size: 'normal' },
    { pair: 'muted on white', fg: colors.muted, bg: colors.white, size: 'normal' },
    { pair: 'mutedBrown on white', fg: colors.mutedBrown, bg: colors.white, size: 'normal' },
    { pair: 'success on white', fg: colors.success, bg: colors.white, size: 'normal' },
    { pair: 'error on white', fg: colors.error, bg: colors.white, size: 'large' },
  ];

  return pairs.map(({ pair, fg, bg, size }) => {
    const result = meetsContrastAA(fg, bg, size);
    return {
      pair,
      foreground: fg,
      background: bg,
      ratio: result.ratio,
      passes: result.passes,
      textSize: size,
    };
  });
}

// ── Keyboard Navigation Helper ──────────────────────────────────────

/**
 * ARIA role descriptions for common interactive patterns.
 */
export const KEYBOARD_PATTERNS = {
  button: { keys: ['Enter', 'Space'], role: 'button' },
  link: { keys: ['Enter'], role: 'link' },
  tab: { keys: ['ArrowLeft', 'ArrowRight'], role: 'tab' },
  menu: { keys: ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'], role: 'menu' },
  dialog: { keys: ['Escape', 'Tab'], role: 'dialog' },
  accordion: { keys: ['Enter', 'Space', 'ArrowUp', 'ArrowDown'], role: 'region' },
};

/**
 * Get the expected keyboard interactions for an ARIA role.
 * @param {string} role - ARIA role
 * @returns {{ keys: string[], role: string } | null}
 */
export function getKeyboardPattern(role) {
  return KEYBOARD_PATTERNS[role] || null;
}

// ── Clickable Element Helper ──────────────────────────────────────

/**
 * Make an element keyboard-accessible by adding onKeyPress for Enter/Space.
 * Use this for non-button elements that have onClick handlers (images, text, etc.).
 *
 * @param {Object} element - Wix element with onClick and onKeyPress
 * @param {Function} handler - Click/activate handler
 * @param {Object} [opts]
 * @param {string} [opts.ariaLabel] - aria-label to set
 * @param {string} [opts.role='button'] - ARIA role
 */
export function makeClickable(element, handler, opts = {}) {
  if (!element || !handler) return;
  try { element.onClick(handler); } catch (e) {}
  try {
    element.onKeyPress((event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        try { event.preventDefault?.(); } catch (e) {}
        handler();
      }
    });
  } catch (e) {}
  if (opts.role) {
    try { element.accessibility.role = opts.role; } catch (e) {}
  }
  if (opts.ariaLabel) {
    try { element.accessibility.ariaLabel = opts.ariaLabel; } catch (e) {}
  }
  try { element.accessibility.tabIndex = 0; } catch (e) {}
}

// ── Live Announcements ────────────────────────────────────────────

/**
 * Announce a message to screen readers via an aria-live region.
 * Creates or reuses a live region element on the Wix page.
 *
 * @param {Function} $w - Wix selector function
 * @param {string} message - Text to announce
 * @param {'polite'|'assertive'} [priority='polite'] - aria-live priority
 */
export function announce($w, message, priority = 'polite') {
  if (!message) return;
  try {
    const el = $w('#a11yLiveRegion');
    if (el) {
      el.text = '';
      // Brief delay so screen readers detect the change
      setTimeout(() => {
        try { el.text = message; } catch (e) {}
      }, 50);
    }
  } catch (e) {
    // Live region element not on page — fallback to announcement text
    try {
      const announcement = $w('#announcementText');
      if (announcement && announcement.role === 'status') {
        announcement.text = message;
      }
    } catch (e2) {}
  }
}

// ── Enhanced Dialog Focus Management ────────────────────────────────

/**
 * Set up accessible dialog/modal behavior. Manages focus trap,
 * Escape key close, ARIA attributes, and focus restoration.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} config
 * @param {string} config.panelId - Dialog container element ID (e.g. '#quickViewModal')
 * @param {string} config.closeId - Close button element ID
 * @param {string} [config.titleId] - Dialog title element ID for aria-labelledby
 * @param {Array<string>} [config.focusableIds] - Focusable element IDs for trap
 * @param {Function} [config.onClose] - Callback when dialog closes
 * @returns {{ open: Function, close: Function }}
 */
export function setupAccessibleDialog($w, config) {
  const { panelId, closeId, titleId, focusableIds = [], onClose } = config;
  let trap = null;
  let savedFocus = null;
  let escHandler = null;

  // Set ARIA attributes
  try {
    const panel = $w(panelId);
    if (panel) {
      try { panel.accessibility.role = 'dialog'; } catch (e) {}
      try { panel.accessibility.ariaModal = true; } catch (e) {}
      if (titleId) {
        try { panel.accessibility.ariaLabelledBy = titleId; } catch (e) {}
      }
    }
  } catch (e) {}

  function removeEscHandler() {
    if (escHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
  }

  function open() {
    try {
      // Save current focus for restoration on close
      if (typeof document !== 'undefined') {
        savedFocus = document.activeElement;
      }
      $w(panelId).show('fade', { duration: 200 });
      // Create focus trap and move focus into dialog
      if (focusableIds.length > 0) {
        trap = createFocusTrap($w, panelId, focusableIds);
        try { $w(focusableIds[0]).focus(); } catch (e) {}
      } else {
        try { $w(closeId).focus(); } catch (e) {}
      }
      announce($w, 'Dialog opened');
    } catch (e) {}
  }

  function close() {
    try {
      $w(panelId).hide('fade', { duration: 200 });
      if (trap) {
        trap.release();
        trap = null;
      }
      // Restore focus to previously focused element
      if (savedFocus && savedFocus.focus) {
        savedFocus.focus();
        savedFocus = null;
      }
      removeEscHandler();
      announce($w, 'Dialog closed');
      if (onClose) onClose();
    } catch (e) {}
  }

  // Wire close button
  try {
    $w(closeId).onClick(close);
    $w(closeId).onKeyPress((event) => {
      if (event.key === 'Enter' || event.key === ' ') close();
    });
  } catch (e) {}

  // Escape key closes dialog
  if (typeof document !== 'undefined') {
    escHandler = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', escHandler);
  }

  return { open, close };
}
