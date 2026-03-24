/**
 * @file gamificationChatbotGreeting.test.js
 * @description TDD tests for CF-e0y2: getChatGreeting webMethod + chatWidget PDP wiring.
 *
 * Covers:
 *  - getChatGreeting: returns { enabled: false } when feature flag off
 *  - getChatGreeting: returns greeting for cold visitors (Permissions.Anyone)
 *  - getChatGreeting: greeting includes product name when provided
 *  - getChatGreeting: generic greeting when no product name given
 *  - getChatGreeting: handles missing/empty productName gracefully
 *  - getChatGreeting: returns { enabled: false } when secret fetch throws
 *  - chatWidget (Product Page): shows widget and greeting when flag on
 *  - chatWidget (Product Page): hides widget when flag off
 *  - chatWidget (Product Page): send calls chatWithAssistant
 *  - chatWidget (Product Page): auth_required triggers promptLogin
 *  - chatWidget (Product Page): successful reply updates #chatResponseText
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';

// ── getChatGreeting (backend unit tests) ──────────────────────────────────────

beforeEach(() => {
  resetSecrets();
  vi.clearAllMocks();
});

describe('getChatGreeting — feature flag', () => {
  it('returns { enabled: false } when GAMIFICATION_CHATBOT_ENABLED secret is absent', async () => {
    // No secrets seeded — getSecret throws
    const { getChatGreeting } = await vi.importActual('../src/backend/gamificationChatbot.web.js');
    const result = await getChatGreeting();
    expect(result).toEqual({ enabled: false });
  });

  it('returns { enabled: false } when flag is "false"', async () => {
    __setSecrets({ GAMIFICATION_CHATBOT_ENABLED: 'false', ANTHROPIC_API_KEY: 'key' });
    const { getChatGreeting } = await vi.importActual('../src/backend/gamificationChatbot.web.js');
    const result = await getChatGreeting();
    expect(result).toEqual({ enabled: false });
  });

  it('returns { enabled: true, greeting } when flag is "true"', async () => {
    __setSecrets({ GAMIFICATION_CHATBOT_ENABLED: 'true', ANTHROPIC_API_KEY: 'key' });
    const { getChatGreeting } = await vi.importActual('../src/backend/gamificationChatbot.web.js');
    const result = await getChatGreeting();
    expect(result.enabled).toBe(true);
    expect(typeof result.greeting).toBe('string');
    expect(result.greeting.length).toBeGreaterThan(10);
  });
});

describe('getChatGreeting — greeting content', () => {
  beforeEach(() => {
    __setSecrets({ GAMIFICATION_CHATBOT_ENABLED: 'true', ANTHROPIC_API_KEY: 'key' });
  });

  it('includes product name in greeting when provided', async () => {
    const { getChatGreeting } = await vi.importActual('../src/backend/gamificationChatbot.web.js');
    const result = await getChatGreeting({ productName: 'Luna Futon Frame', productId: 'prod-1' });
    expect(result.enabled).toBe(true);
    expect(result.greeting).toContain('Luna Futon Frame');
  });

  it('returns generic greeting when productName is absent', async () => {
    const { getChatGreeting } = await vi.importActual('../src/backend/gamificationChatbot.web.js');
    const result = await getChatGreeting({});
    expect(result.enabled).toBe(true);
    expect(result.greeting).not.toContain('undefined');
    expect(result.greeting).not.toContain('null');
  });

  it('returns generic greeting when called with no arguments', async () => {
    const { getChatGreeting } = await vi.importActual('../src/backend/gamificationChatbot.web.js');
    const result = await getChatGreeting();
    expect(result.enabled).toBe(true);
    expect(typeof result.greeting).toBe('string');
  });

  it('returns generic greeting when productName is empty string', async () => {
    const { getChatGreeting } = await vi.importActual('../src/backend/gamificationChatbot.web.js');
    const result = await getChatGreeting({ productName: '', productId: 'prod-1' });
    expect(result.enabled).toBe(true);
    expect(result.greeting).not.toContain('about .');
  });

  it('trims whitespace-only productName and falls back to generic', async () => {
    const { getChatGreeting } = await vi.importActual('../src/backend/gamificationChatbot.web.js');
    const result = await getChatGreeting({ productName: '   ' });
    expect(result.enabled).toBe(true);
    expect(result.greeting).not.toContain('   ');
  });
});

// ── chatWidget — Product Page wiring ─────────────────────────────────────────

const MOCK_PRODUCT = { _id: 'prod-1', name: 'Luna Futon Frame', price: 599, formattedPrice: '$599.00', mainMedia: '', slug: 'luna-futon' };

const elements = new Map();
function createEl() {
  return {
    text: '', value: '', html: '', src: '', label: '', collapsed: false,
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    getCurrentItem: vi.fn(() => MOCK_PRODUCT),
    onItemReady: vi.fn(),
    expand: vi.fn(),
    collapse: vi.fn(),
    data: [],
  };
}
function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createEl());
  return elements.get(sel);
}
let onReadyHandler = null;
globalThis.$w = Object.assign((sel) => getEl(sel), {
  onReady: (fn) => { onReadyHandler = fn; },
});

const chatbotMocks = vi.hoisted(() => ({
  getChatGreeting: vi.fn(),
  chatWithAssistant: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  promptLogin: vi.fn(),
}));

vi.mock('backend/gamificationChatbot.web', () => ({
  getChatGreeting: chatbotMocks.getChatGreeting,
  chatWithAssistant: chatbotMocks.chatWithAssistant,
  _callClaude: vi.fn(),
}));

// Stub all other Product Page dependencies
vi.mock('backend/productRecommendations.web', () => ({ getRelatedProducts: vi.fn().mockResolvedValue([]), getSameCollection: vi.fn().mockResolvedValue([]), getCustomersAlsoBought: vi.fn().mockResolvedValue([]) }));
vi.mock('public/galleryHelpers.js', () => ({ trackProductView: vi.fn(), getRecentlyViewed: vi.fn().mockResolvedValue([]) }));
vi.mock('public/productCache', () => ({ cacheProduct: vi.fn(), getCachedProduct: vi.fn() }));
vi.mock('public/mobileHelpers', () => ({ collapseOnMobile: vi.fn(), initBackToTop: vi.fn(), isMobile: vi.fn(() => false) }));
vi.mock('public/productPageUtils.js', () => ({ buildGridAlt: vi.fn(() => ''), isCallForPrice: vi.fn(() => false), CALL_FOR_PRICE_TEXT: '' }));
vi.mock('wix-location-frontend', () => ({ default: { query: {}, path: [] }, to: vi.fn() }));
vi.mock('public/performanceHelpers.js', () => ({ prioritizeSections: vi.fn(async (sections) => { await Promise.allSettled(sections.map(s => s.init())); return { critical: [] }; }) }));
vi.mock('public/galleryConfig.js', () => ({ getImageDimensions: vi.fn(() => ({ width: 800, height: 600 })) }));
vi.mock('public/ProductGallery.js', () => ({ initImageGallery: vi.fn(), initProductBadge: vi.fn(), initProductVideo: vi.fn() }));
vi.mock('public/ProductOptions.js', () => ({ initVariantSelector: vi.fn(), initSwatchSelector: vi.fn() }));
vi.mock('public/ProductDetails.js', () => ({ initBreadcrumbs: vi.fn(), initProductInfoAccordion: vi.fn(), initSocialShare: vi.fn(), initDeliveryEstimate: vi.fn(), injectProductSchema: vi.fn(), initSwatchRequest: vi.fn(), initSwatchCTA: vi.fn() }));
vi.mock('public/AddToCart.js', () => ({ initQuantitySelector: vi.fn(), initAddToCartEnhancements: vi.fn(), initStickyCartBar: vi.fn(), initBundleSection: vi.fn(), initStockUrgency: vi.fn(), initBackInStockNotification: vi.fn(), initWishlistButton: vi.fn() }));
vi.mock('public/BrowseReminder.js', () => ({ initBrowseTracking: vi.fn(), _createBrowseState: vi.fn(() => ({})) }));
vi.mock('public/a11yHelpers.js', () => ({ makeClickable: vi.fn(), announce: vi.fn() }));
vi.mock('public/productCardHelpers.js', () => ({ setCardImage: vi.fn() }));
vi.mock('public/socialProofToast', () => ({ initProductSocialProof: vi.fn() }));
vi.mock('backend/promotions.web', () => ({ getFlashSales: vi.fn().mockResolvedValue([]) }));
vi.mock('public/flashSaleHelpers', () => ({ initProductUrgencyBadge: vi.fn() }));
vi.mock('public/ProductPagePolish.js', () => ({ applyProductPageTokens: vi.fn() }));
vi.mock('public/InventoryDisplay.js', () => ({ initInventoryDisplay: vi.fn() }));
vi.mock('public/product/productSchema.js', () => ({ injectProductMeta: vi.fn(), injectPinterestMeta: vi.fn() }));
vi.mock('public/giftProductBtn.js', () => ({ initGiftProductButton: vi.fn() }));
vi.mock('public/videoHelpers.js', () => ({ buildYouTubeEmbed: vi.fn(() => '') }));
vi.mock('public/PDPSocialProofBadge.js', () => ({ initPDPSocialProofBadge: vi.fn() }));
vi.mock('backend/socialProofBadge.web', () => ({ getNeighborCount: vi.fn().mockResolvedValue(0) }));
vi.mock('backend/errorMonitoring.web', () => ({ logError: vi.fn() }));
vi.mock('wix-members-frontend', () => ({ authentication: authMocks, currentMember: { getMember: vi.fn() } }));

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  chatbotMocks.getChatGreeting.mockResolvedValue({ enabled: true, greeting: 'Hi! Ask me about this product.' });
  chatbotMocks.chatWithAssistant.mockResolvedValue({ reply: 'Here is the answer.', dailyMessagesRemaining: 19 });
  authMocks.promptLogin.mockResolvedValue(undefined);
});

async function loadPage() {
  await import('../src/pages/Product Page.js');
  if (onReadyHandler) await onReadyHandler();
}

describe('chatWidget — PDP wiring', () => {
  it('shows #chatAssistantWidget and sets greeting when flag enabled', async () => {
    await loadPage();
    expect(chatbotMocks.getChatGreeting).toHaveBeenCalled();
    expect(getEl('#chatAssistantWidget').show).toHaveBeenCalled();
    expect(getEl('#chatGreetingText').text).toBe('Hi! Ask me about this product.');
  });

  it('does not show widget when getChatGreeting returns enabled:false', async () => {
    chatbotMocks.getChatGreeting.mockResolvedValue({ enabled: false });
    await loadPage();
    expect(getEl('#chatAssistantWidget').show).not.toHaveBeenCalled();
  });

  it('passes product name from state to getChatGreeting', async () => {
    await loadPage();
    const [context] = chatbotMocks.getChatGreeting.mock.calls[0];
    expect(context).toHaveProperty('productName');
    expect(context).toHaveProperty('productId');
  });

  it('calls chatWithAssistant with message on send button click', async () => {
    await loadPage();
    getEl('#chatInput').value = 'What size is this?';
    const clickHandler = getEl('#chatSendBtn').onClick.mock.calls[0]?.[0];
    expect(clickHandler).toBeDefined();
    await clickHandler();
    expect(chatbotMocks.chatWithAssistant).toHaveBeenCalledWith('What size is this?');
  });

  it('does not call chatWithAssistant when input is empty', async () => {
    await loadPage();
    getEl('#chatInput').value = '   ';
    const clickHandler = getEl('#chatSendBtn').onClick.mock.calls[0]?.[0];
    await clickHandler();
    expect(chatbotMocks.chatWithAssistant).not.toHaveBeenCalled();
  });

  it('prompts login when chatWithAssistant returns auth_required', async () => {
    chatbotMocks.chatWithAssistant.mockResolvedValue({ error: 'auth_required' });
    await loadPage();
    getEl('#chatInput').value = 'Hello';
    const clickHandler = getEl('#chatSendBtn').onClick.mock.calls[0]?.[0];
    await clickHandler();
    expect(authMocks.promptLogin).toHaveBeenCalledWith({ modal: true });
  });

  it('updates #chatResponseText on successful reply', async () => {
    await loadPage();
    getEl('#chatInput').value = 'Tell me more';
    const clickHandler = getEl('#chatSendBtn').onClick.mock.calls[0]?.[0];
    await clickHandler();
    expect(getEl('#chatResponseText').text).toBe('Here is the answer.');
  });

  it('clears #chatInput after successful reply', async () => {
    await loadPage();
    getEl('#chatInput').value = 'Tell me more';
    const clickHandler = getEl('#chatSendBtn').onClick.mock.calls[0]?.[0];
    await clickHandler();
    expect(getEl('#chatInput').value).toBe('');
  });

  it('re-enables send button after successful reply', async () => {
    await loadPage();
    getEl('#chatInput').value = 'Hi';
    const clickHandler = getEl('#chatSendBtn').onClick.mock.calls[0]?.[0];
    await clickHandler();
    expect(getEl('#chatSendBtn').enable).toHaveBeenCalled();
  });

  it('re-enables send button when chatWithAssistant throws', async () => {
    chatbotMocks.chatWithAssistant.mockRejectedValue(new Error('network'));
    await loadPage();
    getEl('#chatInput').value = 'Hi';
    const clickHandler = getEl('#chatSendBtn').onClick.mock.calls[0]?.[0];
    await clickHandler();
    expect(getEl('#chatSendBtn').enable).toHaveBeenCalled();
  });
});
