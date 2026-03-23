/**
 * @file shippingPrefs.js
 * @description Unified ZIP persistence for shipping estimate widgets.
 *
 * Storage layers (in priority order):
 *  1. localStorage  — persists across sessions on the same device/browser
 *  2. Wix member extended fields — persists across devices for logged-in members
 *
 * The canonical storage key is ZIP_KEY ('cf_shipping_zip').  All entry points
 * (ShippingWidget, ShippingIntelligence, CartShippingEstimate, Checkout) must
 * read/write through this module so that a ZIP entered anywhere is available
 * everywhere.
 */

export const ZIP_KEY = 'cf_shipping_zip';

// Wix extended-field path used when persisting to member profile.
// Must match the field registered in Wix Dashboard → Members → Fields.
const MEMBER_FIELD = 'custom.shippingZip';

/** Lazy-load wix-storage-frontend local store (injectable in tests). */
async function getLocalStorage() {
  const m = await import('wix-storage-frontend');
  return m.local;
}

/**
 * Read the persisted ZIP from local storage.
 *
 * @param {object} [storage] - Optional injectable storage adapter (tests).
 * @returns {string|null}
 */
export async function getStoredZip(storage) {
  const store = storage ?? (await getLocalStorage());
  return store.getItem(ZIP_KEY);
}

/**
 * Persist ZIP to local storage and, for logged-in members, to their profile.
 *
 * Member profile save is fire-and-forget — a failure does not surface to the
 * user and does not block the widget.
 *
 * @param {string} zip       - 5-digit ZIP to persist.
 * @param {object} [storage] - Optional injectable storage adapter (tests).
 */
export async function setStoredZip(zip, storage) {
  const store = storage ?? (await getLocalStorage());
  store.setItem(ZIP_KEY, zip);
  // Best-effort member profile save — do not await.
  saveMemberZip(zip).catch(() => {});
}

/**
 * Clear the persisted ZIP (call when the user confirms a different shipping
 * address at checkout so the next page-load estimate reflects the new address).
 *
 * @param {object} [storage] - Optional injectable storage adapter (tests).
 */
export async function clearStoredZip(storage) {
  const store = storage ?? (await getLocalStorage());
  store.removeItem(ZIP_KEY);
}

/**
 * Save ZIP to the logged-in member's extended fields.
 * No-ops silently if the visitor is not logged in.
 *
 * @param {string} zip
 */
export async function saveMemberZip(zip) {
  try {
    const { currentMember, authentication } = await import('wix-members-frontend');
    const loggedIn = await authentication.loggedIn();
    if (!loggedIn) return;
    await currentMember.updateCurrentMember({
      extendedFields: { [MEMBER_FIELD]: zip },
    });
  } catch (err) {
    // Non-critical — member profile is a best-effort enhancement.
    console.warn('[shippingPrefs] saveMemberZip failed:', err?.message ?? err);
  }
}

/**
 * Load ZIP from the logged-in member's extended fields.
 * Returns null if the visitor is not logged in or no ZIP is stored.
 *
 * @param {object} [storage] - Optional injectable storage adapter (tests,
 *   pass null to skip local-storage hydration).
 * @returns {string|null}
 */
export async function loadMemberZip(storage) {
  try {
    const { currentMember, authentication } = await import('wix-members-frontend');
    const loggedIn = await authentication.loggedIn();
    if (!loggedIn) return null;
    const member = await currentMember.getMember({ fieldsets: ['EXTENDED'] });
    const zip = member?.extendedFields?.[MEMBER_FIELD] ?? null;
    if (zip && storage !== null) {
      // Hydrate local storage so subsequent calls to getStoredZip() are instant.
      const store = storage ?? (await getLocalStorage());
      store.setItem(ZIP_KEY, zip);
    }
    return zip;
  } catch (err) {
    console.warn('[shippingPrefs] loadMemberZip failed:', err?.message ?? err);
    return null;
  }
}
