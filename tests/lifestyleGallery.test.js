import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock lifestyleImages module
vi.mock('../src/public/lifestyleImages.js', () => ({
  getLifestyleScenes: vi.fn((category, count) => {
    const scenes = [
      { url: 'https://images.unsplash.com/photo-living-room?w=800&h=600&fit=crop', alt: 'Futon in cozy living room', room: 'living room', style: 'modern farmhouse' },
      { url: 'https://images.unsplash.com/photo-guest-room?w=800&h=600&fit=crop', alt: 'Futon in guest room', room: 'guest room', style: 'minimalist' },
      { url: 'https://images.unsplash.com/photo-studio?w=800&h=600&fit=crop', alt: 'Futon in studio apartment', room: 'studio', style: 'contemporary' },
      { url: 'https://images.unsplash.com/photo-den?w=800&h=600&fit=crop', alt: 'Futon in den', room: 'den', style: 'rustic' },
    ];
    return count ? scenes.slice(0, count) : scenes;
  }),
  getLifestyleOverlay: vi.fn(() => ({
    imageUrl: 'https://images.unsplash.com/photo-living-room?w=400&h=300&fit=crop',
    label: 'See It In a Room',
    alt: 'Lifestyle room scene',
  })),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    mountainBlue: '#5B8FA8',
    espresso: '#3A2518',
    sandLight: '#F2E8D5',
    white: '#FFFFFF',
    overlay: 'rgba(58, 37, 24, 0.6)',
  },
  typography: {
    h3: { size: '24px', weight: 600 },
    bodySmall: { size: '14px', weight: 400 },
    caption: { size: '12px', weight: 500 },
  },
}));

// ── $w Mock ──────────────────────────────────────────────────────────
const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    html: '',
    data: [],
    items: [],
    style: { color: '', backgroundColor: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    onItemClicked: vi.fn(),
    accessibility: {},
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

const $w = (sel) => getEl(sel);

// ── Import module under test ─────────────────────────────────────────
import { initLifestyleGallery } from '../src/public/LifestyleGallery.js';
import { getLifestyleScenes, getLifestyleOverlay } from '../src/public/lifestyleImages.js';
import { trackEvent } from 'public/engagementTracker';

describe('initLifestyleGallery', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('initializes lifestyle section with scenes from product category', () => {
    const state = { product: { _id: 'p1', name: 'Eureka Futon', collections: ['futon-frames'] } };
    initLifestyleGallery($w, state);
    expect(getLifestyleScenes).toHaveBeenCalledWith('futon-frames', 4);
  });

  it('sets section title to "See It In Your Room"', () => {
    const state = { product: { _id: 'p1', name: 'Eureka Futon', collections: ['futon-frames'] } };
    initLifestyleGallery($w, state);
    expect(getEl('#lifestyleTitle').text).toBe('See It In Your Room');
  });

  it('sets section subtitle with product name', () => {
    const state = { product: { _id: 'p1', name: 'Eureka Futon', collections: ['futon-frames'] } };
    initLifestyleGallery($w, state);
    expect(getEl('#lifestyleSubtitle').text).toContain('Eureka Futon');
  });

  it('populates lifestyle repeater with scene data', () => {
    const state = { product: { _id: 'p1', name: 'Eureka Futon', collections: ['futon-frames'] } };
    initLifestyleGallery($w, state);
    const repeater = getEl('#lifestyleRepeater');
    expect(repeater.data.length).toBe(4);
    expect(repeater.data[0]).toHaveProperty('_id');
    expect(repeater.data[0]).toHaveProperty('url');
    expect(repeater.data[0]).toHaveProperty('room');
  });

  it('sets up repeater onItemReady for image and label rendering', () => {
    const state = { product: { _id: 'p1', name: 'Eureka Futon', collections: ['futon-frames'] } };
    initLifestyleGallery($w, state);
    const repeater = getEl('#lifestyleRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
  });

  it('expands lifestyle section when scenes are available', () => {
    const state = { product: { _id: 'p1', name: 'Eureka Futon', collections: ['futon-frames'] } };
    initLifestyleGallery($w, state);
    expect(getEl('#lifestyleSection').expand).toHaveBeenCalled();
  });

  it('collapses lifestyle section when no product', () => {
    initLifestyleGallery($w, { product: null });
    expect(getEl('#lifestyleSection').collapse).toHaveBeenCalled();
  });

  it('collapses lifestyle section when product has no collections', () => {
    const state = { product: { _id: 'p1', name: 'Test', collections: [] } };
    initLifestyleGallery($w, state);
    expect(getEl('#lifestyleSection').collapse).toHaveBeenCalled();
  });

  it('sets ARIA attributes on section for accessibility', () => {
    const state = { product: { _id: 'p1', name: 'Eureka Futon', collections: ['futon-frames'] } };
    initLifestyleGallery($w, state);
    const section = getEl('#lifestyleSection');
    expect(section.accessibility.ariaLabel).toContain('Lifestyle');
  });

  it('tracks lifestyle gallery view event', () => {
    const state = { product: { _id: 'p1', name: 'Eureka Futon', collections: ['futon-frames'] } };
    initLifestyleGallery($w, state);
    expect(trackEvent).toHaveBeenCalledWith('lifestyle_gallery_view', expect.objectContaining({
      productId: 'p1',
      category: 'futon-frames',
    }));
  });

  it('does not throw when optional elements are missing', () => {
    // Remove some elements so they return fresh mocks
    const state = { product: { _id: 'p1', name: 'Test', collections: ['mattresses'] } };
    expect(() => initLifestyleGallery($w, state)).not.toThrow();
  });

  it('handles products with multiple collections (uses first)', () => {
    const state = { product: { _id: 'p1', name: 'Multi', collections: ['platform-beds', 'sale'] } };
    initLifestyleGallery($w, state);
    expect(getLifestyleScenes).toHaveBeenCalledWith('platform-beds', 4);
  });
});

describe('initLifestyleGallery repeater rendering', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('renders scene image, room label, and style on item ready', () => {
    const state = { product: { _id: 'p1', name: 'Eureka', collections: ['futon-frames'] } };
    initLifestyleGallery($w, state);

    const repeater = getEl('#lifestyleRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    // Simulate repeater item rendering
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    const sceneData = {
      _id: 'scene-0',
      url: 'https://images.unsplash.com/photo-living-room?w=800&h=600&fit=crop',
      alt: 'Futon in cozy living room',
      room: 'living room',
      style: 'modern farmhouse',
    };

    itemReadyFn($item, sceneData);

    expect(itemElements.get('#lifestyleImage').src).toBe(sceneData.url);
    expect(itemElements.get('#lifestyleImage').alt).toBe(sceneData.alt);
    expect(itemElements.get('#lifestyleRoomLabel').text).toBe('Living Room');
  });
});
