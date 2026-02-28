/**
 * accessibility.web.js - WCAG 2.1 AA Accessibility Audit Helper Module
 *
 * Backend service that provides accessibility audit data, generates
 * aria-live announcement text, and validates page structures for
 * WCAG 2.1 AA compliance.
 *
 * @module accessibility
 */
import { Permissions, webMethod } from 'wix-web-module';

// ── ARIA Live Announcement Templates ────────────────────────────────

const ANNOUNCEMENT_TEMPLATES = {
  cartAdd: (name, qty) => `${name} added to cart${qty > 1 ? `, quantity ${qty}` : ''}`,
  cartRemove: (name) => `${name} removed from cart`,
  cartUpdate: (count, total) => `Cart updated: ${count} item${count !== 1 ? 's' : ''}, $${total}`,
  filterApplied: (count) => `Showing ${count} product${count !== 1 ? 's' : ''}`,
  filterCleared: (count) => `Filters cleared. Showing ${count} product${count !== 1 ? 's' : ''}`,
  searchResults: (count, query) => `${count} result${count !== 1 ? 's' : ''} for "${query}"`,
  searchNoResults: (query) => `No results found for "${query}"`,
  formError: (fieldName) => `Error: ${fieldName} is required`,
  formSuccess: (formName) => `${formName} submitted successfully`,
  sortChanged: (sortLabel) => `Products sorted by ${sortLabel}`,
  loadingStart: (context) => `Loading ${context}`,
  loadingComplete: (context) => `${context} loaded`,
  modalOpen: (title) => `${title} dialog opened`,
  modalClose: () => 'Dialog closed',
  quantityChanged: (qty) => `Quantity set to ${qty}`,
  stockStatus: (status) => `Stock status: ${status}`,
};

/**
 * Get an aria-live announcement string for a given event.
 *
 * @param {string} event - Event type key from ANNOUNCEMENT_TEMPLATES
 * @param {...*} args - Arguments for the template function
 * @returns {string} Announcement text for screen readers
 */
export const getAnnouncement = webMethod(
  Permissions.Anyone,
  (event, ...args) => {
    const template = ANNOUNCEMENT_TEMPLATES[event];
    if (!template) return '';
    try {
      return template(...args);
    } catch (err) {
      console.warn(`[accessibility] Announcement template "${event}" failed:`, err?.message || err);
      return '';
    }
  }
);

// ── Page Accessibility Audit ────────────────────────────────────────

/**
 * WCAG 2.1 AA checklist items for auditing pages.
 */
const WCAG_CHECKLIST = [
  { id: '1.1.1', criterion: 'Non-text Content', level: 'A', category: 'perceivable' },
  { id: '1.3.1', criterion: 'Info and Relationships', level: 'A', category: 'perceivable' },
  { id: '1.4.3', criterion: 'Contrast (Minimum)', level: 'AA', category: 'perceivable' },
  { id: '1.4.11', criterion: 'Non-text Contrast', level: 'AA', category: 'perceivable' },
  { id: '2.1.1', criterion: 'Keyboard', level: 'A', category: 'operable' },
  { id: '2.1.2', criterion: 'No Keyboard Trap', level: 'A', category: 'operable' },
  { id: '2.4.1', criterion: 'Bypass Blocks', level: 'A', category: 'operable' },
  { id: '2.4.3', criterion: 'Focus Order', level: 'A', category: 'operable' },
  { id: '2.4.6', criterion: 'Headings and Labels', level: 'AA', category: 'operable' },
  { id: '2.4.7', criterion: 'Focus Visible', level: 'AA', category: 'operable' },
  { id: '3.3.1', criterion: 'Error Identification', level: 'A', category: 'understandable' },
  { id: '3.3.2', criterion: 'Labels or Instructions', level: 'A', category: 'understandable' },
  { id: '4.1.2', criterion: 'Name, Role, Value', level: 'A', category: 'robust' },
  { id: '4.1.3', criterion: 'Status Messages', level: 'AA', category: 'robust' },
];

/**
 * Get the WCAG 2.1 AA checklist for audit purposes.
 *
 * @returns {Array<Object>} Checklist items
 */
export const getWcagChecklist = webMethod(
  Permissions.Admin,
  () => WCAG_CHECKLIST
);

// ── Dialog/Modal Accessibility Config ───────────────────────────────

/**
 * Get recommended ARIA attributes for a dialog/modal element.
 *
 * @param {Object} options
 * @param {string} options.titleId - Element ID of the dialog title
 * @param {string} options.descriptionId - Element ID of the dialog description
 * @returns {Object} Recommended ARIA attributes
 */
export const getDialogAriaConfig = webMethod(
  Permissions.Anyone,
  ({ titleId, descriptionId } = {}) => {
    const config = {
      role: 'dialog',
      ariaModal: true,
    };
    if (titleId) config.ariaLabelledBy = titleId;
    if (descriptionId) config.ariaDescribedBy = descriptionId;
    return config;
  }
);

// ── Form Error Accessibility ────────────────────────────────────────

/**
 * Generate accessible error message attributes for form validation.
 *
 * @param {Array<Object>} errors - Array of { fieldId, message } objects
 * @returns {Object} Map of fieldId to aria attributes
 */
export const getFormErrorAttributes = webMethod(
  Permissions.Anyone,
  (errors) => {
    if (!Array.isArray(errors)) return {};
    const result = {};
    for (const { fieldId, message } of errors) {
      if (!fieldId) continue;
      result[fieldId] = {
        ariaInvalid: true,
        ariaDescribedBy: `${fieldId}-error`,
        errorMessage: message || 'This field has an error',
      };
    }
    return result;
  }
);

// ── Page-Level Accessibility Audit ──────────────────────────────────

const REQUIRED_LANDMARKS = ['banner', 'navigation', 'main', 'contentinfo'];
const BAD_ALT_PATTERNS = [/^image$/i, /^img$/i, /^photo$/i, /^picture$/i, /^untitled$/i, /^\.jpg$/i, /^\.png$/i, /^\.webp$/i, /^\s*$/];

/**
 * Audit a page's accessibility metadata against WCAG 2.1 AA criteria.
 * Returns a compliance report with issues and a percentage score.
 *
 * @param {Object} pageData - Page accessibility metadata
 * @param {string} pageData.pageName - Page name
 * @param {Array<string>} pageData.landmarks - ARIA landmarks present
 * @param {Array<Object>} pageData.images - Images with { src, alt }
 * @param {Array<Object>} pageData.forms - Form fields with { fieldId, label, ariaLabel, ariaLabelledBy }
 * @param {Array<Object>} pageData.interactiveElements - Elements with { id, hasKeyboardHandler, hasAriaLabel }
 * @param {boolean} pageData.hasSkipNav - Whether skip navigation exists
 * @param {boolean} pageData.hasLiveRegion - Whether aria-live region exists
 * @returns {{ pageName: string, passes: boolean, issues: Array, score: number }}
 */
export const auditPageAccessibility = webMethod(
  Permissions.Admin,
  (pageData) => {
    if (!pageData || typeof pageData !== 'object') {
      return { pageName: 'Unknown', passes: false, issues: [{ criterion: 'N/A', details: 'No page data provided' }], score: 0 };
    }

    const { pageName = 'Unknown', landmarks = [], images = [], forms = [], interactiveElements = [], hasSkipNav = false, hasLiveRegion = false } = pageData;
    const issues = [];
    let totalChecks = 0;
    let passedChecks = 0;

    // 2.4.1 Bypass Blocks — landmarks + skip nav
    totalChecks++;
    const normalizedLandmarks = Array.isArray(landmarks) ? landmarks.map(l => l.toLowerCase().trim()) : [];
    const missingLandmarks = REQUIRED_LANDMARKS.filter(l => !normalizedLandmarks.includes(l));
    if (missingLandmarks.length > 0) {
      issues.push({ criterion: '2.4.1', details: `Missing landmarks: ${missingLandmarks.join(', ')}` });
    } else {
      passedChecks++;
    }

    totalChecks++;
    if (!hasSkipNav) {
      issues.push({ criterion: '2.4.1', details: 'Missing skip navigation link' });
    } else {
      passedChecks++;
    }

    // 1.1.1 Non-text Content — alt text on images
    const imageList = Array.isArray(images) ? images : [];
    for (const img of imageList) {
      totalChecks++;
      const alt = img.alt;
      if (alt === undefined || alt === null) {
        issues.push({ criterion: '1.1.1', element: img.src, details: 'Missing alt attribute' });
      } else if (alt === '') {
        passedChecks++; // decorative
      } else {
        const trimmed = alt.trim();
        const isBad = BAD_ALT_PATTERNS.some(p => p.test(trimmed));
        if (isBad || trimmed.length < 3) {
          issues.push({ criterion: '1.1.1', element: img.src, details: `Non-descriptive alt text: "${alt}"` });
        } else {
          passedChecks++;
        }
      }
    }

    // 3.3.2 Labels or Instructions — form fields must have labels
    const formList = Array.isArray(forms) ? forms : [];
    for (const field of formList) {
      totalChecks++;
      const hasLabel = (field.label && field.label.trim().length > 0) ||
                       (field.ariaLabel && field.ariaLabel.trim().length > 0) ||
                       (field.ariaLabelledBy && field.ariaLabelledBy.trim().length > 0);
      if (!hasLabel) {
        issues.push({ criterion: '3.3.2', element: field.fieldId, details: `Form field "${field.fieldId}" has no label` });
      } else {
        passedChecks++;
      }
    }

    // 2.1.1 Keyboard — interactive elements need keyboard handlers
    const elements = Array.isArray(interactiveElements) ? interactiveElements : [];
    for (const el of elements) {
      totalChecks++;
      if (!el.hasKeyboardHandler) {
        issues.push({ criterion: '2.1.1', element: el.id, details: `Interactive element "${el.id}" lacks keyboard handler` });
      } else {
        passedChecks++;
      }
    }

    // 4.1.2 Name, Role, Value — interactive elements need aria labels
    for (const el of elements) {
      totalChecks++;
      if (!el.hasAriaLabel) {
        issues.push({ criterion: '4.1.2', element: el.id, details: `Interactive element "${el.id}" lacks accessible name` });
      } else {
        passedChecks++;
      }
    }

    // 4.1.3 Status Messages — need aria-live region
    totalChecks++;
    if (!hasLiveRegion) {
      issues.push({ criterion: '4.1.3', details: 'Missing aria-live region for status messages' });
    } else {
      passedChecks++;
    }

    const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

    return {
      pageName,
      passes: issues.length === 0,
      issues,
      score,
    };
  }
);
