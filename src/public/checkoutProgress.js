/**
 * @module checkoutProgress
 * @description Checkout step progress indicator logic.
 * Provides step definitions, active state tracking, and ARIA attributes
 * for the multi-step checkout progress bar.
 *
 * Steps: Information → Shipping → Payment → Review
 */

const CHECKOUT_STEPS = [
  { id: 'information', label: 'Information', number: 1 },
  { id: 'shipping', label: 'Shipping', number: 2 },
  { id: 'payment', label: 'Payment', number: 3 },
  { id: 'review', label: 'Review', number: 4 },
];

/**
 * Get the ordered list of checkout steps.
 * @returns {Array<{ id: string, label: string, number: number }>}
 */
export function getCheckoutSteps() {
  return CHECKOUT_STEPS.map(s => ({ ...s }));
}

/**
 * Get the index of a step by its ID.
 * @param {string|null} stepId - Step identifier
 * @returns {number} Zero-based index, defaults to 0 for unknown values
 */
export function getActiveStepIndex(stepId) {
  if (!stepId || typeof stepId !== 'string') return 0;
  const idx = CHECKOUT_STEPS.findIndex(s => s.id === stepId);
  return idx >= 0 ? idx : 0;
}

/**
 * Get ARIA attributes for a step element based on its position relative
 * to the active step.
 * @param {number} stepIndex - Index of this step (0-based)
 * @param {number} activeIndex - Index of the currently active step
 * @param {string} [label] - Step label for aria-label generation
 * @returns {{ state: 'completed'|'active'|'pending', ariaCurrent?: string, ariaLabel: string }}
 */
export function getStepAriaAttributes(stepIndex, activeIndex, label) {
  const stepNum = stepIndex + 1;
  const stepLabel = label || `Step ${stepNum}`;

  if (stepIndex < activeIndex) {
    return {
      state: 'completed',
      ariaLabel: `Step ${stepNum}: ${stepLabel} — completed`,
    };
  }

  if (stepIndex === activeIndex) {
    return {
      state: 'active',
      ariaCurrent: 'step',
      ariaLabel: `Step ${stepNum}: ${stepLabel} — current`,
    };
  }

  return {
    state: 'pending',
    ariaLabel: `Step ${stepNum}: ${stepLabel}`,
  };
}
