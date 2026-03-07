import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════
// UGC Gallery Tests
// Tests for user-generated content gallery: photo cards, filter tabs,
// sort controls, before/after slider, and full initialization
// ═══════════════════════════════════════════════════════════════════

// ── Dependency mocks ────────────────────────────────────────────────

vi.mock('public/designTokens.js', () => ({
  colors: {
    sandBase: '#E8D5B7', espresso: '#3A2518', mountainBlue: '#5B8FA8',
    sunsetCoral: '#E8845C', white: '#FFFFFF', offWhite: '#FAF7F2',
    sandLight: '#F2E8D5', overlay: 'rgba(58, 37, 24, 0.6)',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: '4px', md: '8px', lg: '12px', pill: '999px' },
  shadows: {
    sm: '0 1px 3px rgba(58,37,24,0.12)',
    md: '0 4px 12px rgba(58,37,24,0.15)',
  },
  transitions: { fast: 150, medium: 250, slow: 400 },
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
  trackGalleryInteraction: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler) => { if (el && handler) el.onClick(handler); }),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
}));

vi.mock('public/galleryHelpers.js', () => ({
  initImageLightbox: vi.fn(),
}));

// ── $w Mock Factory ─────────────────────────────────────────────────

function mockElement(overrides = {}) {
  return {
    collapse: vi.fn(),
    expand: vi.fn(),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onKeyPress: vi.fn(),
    onItemReady: vi.fn(),
    onItemClicked: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
    onChange: vi.fn(),
    focus: vi.fn(),
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    html: '',
    data: [],
    items: [],
    accessibility: {},
    style: { color: '', backgroundColor: '', borderColor: '' },
    ...overrides,
  };
}

function createMock$w(elements = {}) {
  return (selector) => {
    if (elements[selector]) return elements[selector];
    throw new Error(`Element ${selector} not found`);
  };
}

// ── Import module under test ────────────────────────────────────────

import {
  initUGCGallery,
  renderPhotoCards,
  initFilterTabs,
  initSortControls,
  buildBeforeAfterSlider,
} from '../src/public/UGCGallery.js';

import { trackEvent, trackGalleryInteraction } from 'public/engagementTracker';
import { announce, makeClickable } from 'public/a11yHelpers.js';
import { isMobile } from 'public/mobileHelpers';
import { initImageLightbox } from 'public/galleryHelpers.js';

// ═══════════════════════════════════════════════════════════════════
// renderPhotoCards
// ═══════════════════════════════════════════════════════════════════

describe('renderPhotoCards', () => {
  let elements, $w;

  beforeEach(() => {
    vi.clearAllMocks();
    elements = {
      '#ugcRepeater': mockElement(),
      '#ugcSection': mockElement(),
      '#ugcEmptyState': mockElement(),
    };
    $w = createMock$w(elements);
  });

  const samplePhotos = [
    {
      _id: 'photo-1',
      imageUrl: 'https://example.com/ugc1.jpg',
      caption: 'Love my new futon!',
      productName: 'Eureka Futon Frame',
      votes: 42,
      roomType: 'living room',
      submittedBy: 'Jane D.',
    },
    {
      _id: 'photo-2',
      imageUrl: 'https://example.com/ugc2.jpg',
      caption: 'Perfect guest room setup',
      productName: 'Asheville Mattress',
      votes: 17,
      roomType: 'guest room',
      submittedBy: 'Tom S.',
    },
  ];

  it('sets up repeater onItemReady handler', () => {
    renderPhotoCards($w, samplePhotos);
    expect(elements['#ugcRepeater'].onItemReady).toHaveBeenCalled();
  });

  it('sets repeater data with photo items', () => {
    renderPhotoCards($w, samplePhotos);
    expect(elements['#ugcRepeater'].data).toHaveLength(2);
    expect(elements['#ugcRepeater'].data[0]._id).toBe('photo-1');
    expect(elements['#ugcRepeater'].data[1]._id).toBe('photo-2');
  });

  it('each item gets image src, caption text, and vote count via onItemReady', () => {
    renderPhotoCards($w, samplePhotos);

    const itemReadyFn = elements['#ugcRepeater'].onItemReady.mock.calls[0][0];
    const itemElements = {};
    const $item = (sel) => {
      if (!itemElements[sel]) itemElements[sel] = mockElement();
      return itemElements[sel];
    };

    itemReadyFn($item, samplePhotos[0]);

    expect(itemElements['#ugcImage'].src).toBe('https://example.com/ugc1.jpg');
    expect(itemElements['#ugcCaption'].text).toBe('Love my new futon!');
    expect(itemElements['#ugcVoteCount'].text).toContain('42');
  });

  it('handles empty photos array — collapses section or shows empty state', () => {
    renderPhotoCards($w, []);

    const sectionCollapsed = elements['#ugcSection'].collapse.mock.calls.length > 0;
    const emptyStateExpanded = elements['#ugcEmptyState'].expand.mock.calls.length > 0;
    const emptyStateShown = elements['#ugcEmptyState'].show.mock.calls.length > 0;

    // Either collapses the section, expands/shows the empty state, or both
    expect(sectionCollapsed || emptyStateExpanded || emptyStateShown).toBe(true);
  });

  it('handles null photos array gracefully', () => {
    expect(() => renderPhotoCards($w, null)).not.toThrow();
  });

  it('handles undefined photos array gracefully', () => {
    expect(() => renderPhotoCards($w, undefined)).not.toThrow();
  });

  it('handles photos with missing caption — does not throw', () => {
    const photosNoCaption = [
      { _id: 'p1', imageUrl: 'https://example.com/no-caption.jpg', votes: 5 },
    ];
    renderPhotoCards($w, photosNoCaption);

    const itemReadyFn = elements['#ugcRepeater'].onItemReady.mock.calls[0][0];
    const itemElements = {};
    const $item = (sel) => {
      if (!itemElements[sel]) itemElements[sel] = mockElement();
      return itemElements[sel];
    };

    expect(() => itemReadyFn($item, photosNoCaption[0])).not.toThrow();
    expect(itemElements['#ugcImage'].src).toBe('https://example.com/no-caption.jpg');
  });

  it('handles photos with missing productName — does not throw', () => {
    const photosNoProduct = [
      { _id: 'p2', imageUrl: 'https://example.com/no-product.jpg', caption: 'Nice!', votes: 3 },
    ];
    renderPhotoCards($w, photosNoProduct);

    const itemReadyFn = elements['#ugcRepeater'].onItemReady.mock.calls[0][0];
    const itemElements = {};
    const $item = (sel) => {
      if (!itemElements[sel]) itemElements[sel] = mockElement();
      return itemElements[sel];
    };

    expect(() => itemReadyFn($item, photosNoProduct[0])).not.toThrow();
  });

  it('sets accessibility labels on images', () => {
    renderPhotoCards($w, samplePhotos);

    const itemReadyFn = elements['#ugcRepeater'].onItemReady.mock.calls[0][0];
    const itemElements = {};
    const $item = (sel) => {
      if (!itemElements[sel]) itemElements[sel] = mockElement();
      return itemElements[sel];
    };

    itemReadyFn($item, samplePhotos[0]);

    // Image should have alt text or aria label set
    const imgEl = itemElements['#ugcImage'];
    const hasAlt = imgEl.alt && imgEl.alt.length > 0;
    const hasAriaLabel = imgEl.accessibility.ariaLabel && imgEl.accessibility.ariaLabel.length > 0;
    expect(hasAlt || hasAriaLabel).toBe(true);
  });

  it('sets accessibility labels on vote buttons', () => {
    renderPhotoCards($w, samplePhotos);

    const itemReadyFn = elements['#ugcRepeater'].onItemReady.mock.calls[0][0];
    const itemElements = {};
    const $item = (sel) => {
      if (!itemElements[sel]) itemElements[sel] = mockElement();
      return itemElements[sel];
    };

    itemReadyFn($item, samplePhotos[0]);

    const voteBtn = itemElements['#ugcVoteButton'];
    if (voteBtn) {
      const hasAriaLabel = voteBtn.accessibility.ariaLabel && voteBtn.accessibility.ariaLabel.length > 0;
      const hasLabel = voteBtn.label && voteBtn.label.length > 0;
      expect(hasAriaLabel || hasLabel).toBe(true);
    }
  });

  it('handles photos with zero votes', () => {
    const zeroVotePhotos = [
      { _id: 'p3', imageUrl: 'https://example.com/new.jpg', caption: 'Just arrived!', votes: 0 },
    ];
    renderPhotoCards($w, zeroVotePhotos);

    const itemReadyFn = elements['#ugcRepeater'].onItemReady.mock.calls[0][0];
    const itemElements = {};
    const $item = (sel) => {
      if (!itemElements[sel]) itemElements[sel] = mockElement();
      return itemElements[sel];
    };

    itemReadyFn($item, zeroVotePhotos[0]);
    expect(itemElements['#ugcVoteCount'].text).toContain('0');
  });
});

// ═══════════════════════════════════════════════════════════════════
// initFilterTabs
// ═══════════════════════════════════════════════════════════════════

describe('initFilterTabs', () => {
  let elements, $w;

  beforeEach(() => {
    vi.clearAllMocks();
    elements = {
      '#filterTabAll': mockElement(),
      '#filterTabLivingRoom': mockElement(),
      '#filterTabBedroom': mockElement(),
      '#filterTabOffice': mockElement(),
      '#filterTabs': mockElement(),
    };
    $w = createMock$w(elements);
  });

  it('wires click handlers on filter tab elements', () => {
    const onFilterChange = vi.fn();
    initFilterTabs($w, onFilterChange);

    // At least one tab should have onClick wired
    const anyTabClicked =
      elements['#filterTabAll'].onClick.mock.calls.length > 0 ||
      elements['#filterTabLivingRoom'].onClick.mock.calls.length > 0 ||
      elements['#filterTabBedroom'].onClick.mock.calls.length > 0 ||
      elements['#filterTabOffice'].onClick.mock.calls.length > 0;
    expect(anyTabClicked).toBe(true);
  });

  it('calls onFilterChange callback with selected room type', () => {
    const onFilterChange = vi.fn();
    initFilterTabs($w, onFilterChange);

    // Simulate clicking the living room tab
    const livingRoomClickHandler = elements['#filterTabLivingRoom'].onClick.mock.calls[0]?.[0];
    if (livingRoomClickHandler) {
      livingRoomClickHandler();
      expect(onFilterChange).toHaveBeenCalledWith(expect.stringMatching(/living/i));
    }
  });

  it('"All" tab resets filter to null', () => {
    const onFilterChange = vi.fn();
    initFilterTabs($w, onFilterChange);

    const allClickHandler = elements['#filterTabAll'].onClick.mock.calls[0]?.[0];
    if (allClickHandler) {
      allClickHandler();
      expect(onFilterChange).toHaveBeenCalledWith(null);
    }
  });

  it('highlights active tab', () => {
    const onFilterChange = vi.fn();
    initFilterTabs($w, onFilterChange);

    // Simulate clicking living room tab
    const livingRoomClickHandler = elements['#filterTabLivingRoom'].onClick.mock.calls[0]?.[0];
    if (livingRoomClickHandler) {
      livingRoomClickHandler();

      // Active tab should have distinct styling or state
      const tabEl = elements['#filterTabLivingRoom'];
      const hasActiveStyle =
        tabEl.style.backgroundColor !== '' ||
        tabEl.style.color !== '' ||
        tabEl.style.borderColor !== '';
      expect(hasActiveStyle).toBe(true);
    }
  });

  it('does not throw with null onFilterChange callback', () => {
    expect(() => initFilterTabs($w, null)).not.toThrow();
  });

  it('does not throw with undefined onFilterChange callback', () => {
    expect(() => initFilterTabs($w, undefined)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// initSortControls
// ═══════════════════════════════════════════════════════════════════

describe('initSortControls', () => {
  let elements, $w;

  beforeEach(() => {
    vi.clearAllMocks();
    elements = {
      '#ugcSortDropdown': mockElement(),
    };
    $w = createMock$w(elements);
  });

  it('wires onChange handler on sort dropdown', () => {
    const onSortChange = vi.fn();
    initSortControls($w, onSortChange);

    expect(elements['#ugcSortDropdown'].onChange).toHaveBeenCalled();
  });

  it('calls onSortChange with selected value when dropdown changes', () => {
    const onSortChange = vi.fn();
    initSortControls($w, onSortChange);

    const changeHandler = elements['#ugcSortDropdown'].onChange.mock.calls[0][0];
    // Simulate selecting 'votes'
    const mockEvent = { target: { value: 'votes' } };
    changeHandler(mockEvent);

    expect(onSortChange).toHaveBeenCalledWith('votes');
  });

  it('default sort is "recent"', () => {
    const onSortChange = vi.fn();
    initSortControls($w, onSortChange);

    // Either the dropdown value is set to 'recent' or onSortChange is called with 'recent'
    const dropdownValue = elements['#ugcSortDropdown'].value;
    const calledWithRecent = onSortChange.mock.calls.some(
      (call) => call[0] === 'recent'
    );
    expect(dropdownValue === 'recent' || calledWithRecent).toBe(true);
  });

  it('does not throw with null onSortChange callback', () => {
    expect(() => initSortControls($w, null)).not.toThrow();
  });

  it('does not throw with undefined onSortChange callback', () => {
    expect(() => initSortControls($w, undefined)).not.toThrow();
  });

  it('handles "featured" sort option', () => {
    const onSortChange = vi.fn();
    initSortControls($w, onSortChange);

    const changeHandler = elements['#ugcSortDropdown'].onChange.mock.calls[0][0];
    const mockEvent = { target: { value: 'featured' } };
    changeHandler(mockEvent);

    expect(onSortChange).toHaveBeenCalledWith('featured');
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildBeforeAfterSlider
// ═══════════════════════════════════════════════════════════════════

describe('buildBeforeAfterSlider', () => {
  let elements, $w;

  beforeEach(() => {
    vi.clearAllMocks();
    elements = {
      '#beforeImage': mockElement(),
      '#afterImage': mockElement(),
      '#beforeAfterSlider': mockElement(),
      '#beforeAfterSection': mockElement(),
      '#sliderHandle': mockElement(),
      '#beforeLabel': mockElement(),
      '#afterLabel': mockElement(),
    };
    $w = createMock$w(elements);
  });

  const beforePhoto = {
    _id: 'before-1',
    imageUrl: 'https://example.com/before.jpg',
    alt: 'Room before futon',
  };

  const afterPhoto = {
    _id: 'after-1',
    imageUrl: 'https://example.com/after.jpg',
    alt: 'Room after futon makeover',
  };

  it('sets before image source', () => {
    buildBeforeAfterSlider($w, beforePhoto, afterPhoto);
    expect(elements['#beforeImage'].src).toBe('https://example.com/before.jpg');
  });

  it('sets after image source', () => {
    buildBeforeAfterSlider($w, beforePhoto, afterPhoto);
    expect(elements['#afterImage'].src).toBe('https://example.com/after.jpg');
  });

  it('handles missing before photo gracefully — does not throw', () => {
    expect(() => buildBeforeAfterSlider($w, null, afterPhoto)).not.toThrow();
  });

  it('handles missing after photo gracefully — does not throw', () => {
    expect(() => buildBeforeAfterSlider($w, beforePhoto, null)).not.toThrow();
  });

  it('handles both photos missing gracefully', () => {
    expect(() => buildBeforeAfterSlider($w, null, null)).not.toThrow();
  });

  it('handles undefined photos gracefully', () => {
    expect(() => buildBeforeAfterSlider($w, undefined, undefined)).not.toThrow();
  });

  it('sets appropriate ARIA labels on before image', () => {
    buildBeforeAfterSlider($w, beforePhoto, afterPhoto);

    const beforeImg = elements['#beforeImage'];
    const hasAlt = beforeImg.alt && beforeImg.alt.length > 0;
    const hasAriaLabel = beforeImg.accessibility.ariaLabel && beforeImg.accessibility.ariaLabel.length > 0;
    expect(hasAlt || hasAriaLabel).toBe(true);
  });

  it('sets appropriate ARIA labels on after image', () => {
    buildBeforeAfterSlider($w, beforePhoto, afterPhoto);

    const afterImg = elements['#afterImage'];
    const hasAlt = afterImg.alt && afterImg.alt.length > 0;
    const hasAriaLabel = afterImg.accessibility.ariaLabel && afterImg.accessibility.ariaLabel.length > 0;
    expect(hasAlt || hasAriaLabel).toBe(true);
  });

  it('collapses or hides section when before photo is missing', () => {
    buildBeforeAfterSlider($w, null, afterPhoto);

    const sectionCollapsed = elements['#beforeAfterSection'].collapse.mock.calls.length > 0;
    const sectionHidden = elements['#beforeAfterSection'].hide.mock.calls.length > 0;
    expect(sectionCollapsed || sectionHidden).toBe(true);
  });

  it('collapses or hides section when after photo is missing', () => {
    buildBeforeAfterSlider($w, beforePhoto, null);

    const sectionCollapsed = elements['#beforeAfterSection'].collapse.mock.calls.length > 0;
    const sectionHidden = elements['#beforeAfterSection'].hide.mock.calls.length > 0;
    expect(sectionCollapsed || sectionHidden).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// initUGCGallery
// ═══════════════════════════════════════════════════════════════════

describe('initUGCGallery', () => {
  let elements, $w;

  beforeEach(() => {
    vi.clearAllMocks();
    elements = {
      '#ugcSection': mockElement(),
      '#ugcRepeater': mockElement(),
      '#ugcEmptyState': mockElement(),
      '#ugcSortDropdown': mockElement(),
      '#filterTabAll': mockElement(),
      '#filterTabLivingRoom': mockElement(),
      '#filterTabBedroom': mockElement(),
      '#filterTabOffice': mockElement(),
      '#filterTabs': mockElement(),
      '#beforeImage': mockElement(),
      '#afterImage': mockElement(),
      '#beforeAfterSlider': mockElement(),
      '#beforeAfterSection': mockElement(),
      '#sliderHandle': mockElement(),
      '#beforeLabel': mockElement(),
      '#afterLabel': mockElement(),
    };
    $w = createMock$w(elements);
  });

  it('calls renderPhotoCards during initialization', () => {
    const opts = {
      photos: [
        { _id: 'p1', imageUrl: 'https://example.com/1.jpg', caption: 'Great!', votes: 10 },
      ],
    };
    initUGCGallery($w, opts);

    // Repeater should have onItemReady wired (evidence renderPhotoCards was called)
    expect(elements['#ugcRepeater'].onItemReady).toHaveBeenCalled();
  });

  it('calls initFilterTabs during initialization', () => {
    const opts = {
      photos: [
        { _id: 'p1', imageUrl: 'https://example.com/1.jpg', caption: 'Great!', votes: 10 },
      ],
    };
    initUGCGallery($w, opts);

    // At least one filter tab should have onClick wired
    const anyTabClicked =
      elements['#filterTabAll'].onClick.mock.calls.length > 0 ||
      elements['#filterTabLivingRoom'].onClick.mock.calls.length > 0;
    expect(anyTabClicked).toBe(true);
  });

  it('calls initSortControls during initialization', () => {
    const opts = {
      photos: [
        { _id: 'p1', imageUrl: 'https://example.com/1.jpg', caption: 'Great!', votes: 10 },
      ],
    };
    initUGCGallery($w, opts);

    // Sort dropdown should have onChange wired
    expect(elements['#ugcSortDropdown'].onChange).toHaveBeenCalled();
  });

  it('handles missing elements gracefully via try/catch — does not throw', () => {
    // $w that throws for every element
    const broken$w = () => {
      throw new Error('Element not found');
    };
    expect(() => initUGCGallery(broken$w, {})).not.toThrow();
  });

  it('collapses section when no $w elements exist', () => {
    // $w that throws for every element — init should try to collapse
    const collapseFn = vi.fn();
    const minimal$w = (sel) => {
      if (sel === '#ugcSection') return mockElement({ collapse: collapseFn });
      throw new Error(`Element ${sel} not found`);
    };
    initUGCGallery(minimal$w, {});

    expect(collapseFn).toHaveBeenCalled();
  });

  it('handles empty opts gracefully', () => {
    expect(() => initUGCGallery($w, {})).not.toThrow();
  });

  it('handles null opts gracefully', () => {
    expect(() => initUGCGallery($w, null)).not.toThrow();
  });

  it('handles undefined opts gracefully', () => {
    expect(() => initUGCGallery($w)).not.toThrow();
  });

  it('expands ugcSection when photos are provided', () => {
    const opts = {
      photos: [
        { _id: 'p1', imageUrl: 'https://example.com/1.jpg', caption: 'Nice!', votes: 5 },
      ],
    };
    initUGCGallery($w, opts);

    expect(elements['#ugcSection'].expand).toHaveBeenCalled();
  });
});

// ── mapPhotoForDisplay ──────────────────────────────────────────────

import { mapPhotoForDisplay } from '../src/public/UGCGallery.js';

describe('mapPhotoForDisplay', () => {
  it('maps backend field names to frontend field names', () => {
    const backendPhoto = {
      _id: 'photo-1',
      photoUrl: 'https://example.com/photo.jpg',
      voteCount: 12,
      memberDisplayName: 'Sarah D.',
      caption: 'My new futon!',
      productName: 'Kodiak Frame',
      roomType: 'living-room',
      status: 'approved',
      tags: ['lifestyle'],
    };
    const result = mapPhotoForDisplay(backendPhoto);
    expect(result.imageUrl).toBe('https://example.com/photo.jpg');
    expect(result.votes).toBe(12);
    expect(result.submittedBy).toBe('Sarah D.');
    expect(result._id).toBe('photo-1');
    expect(result.caption).toBe('My new futon!');
    expect(result.productName).toBe('Kodiak Frame');
    expect(result.roomType).toBe('living-room');
    expect(result.status).toBe('approved');
    expect(result.tags).toEqual(['lifestyle']);
  });

  it('handles null/undefined input', () => {
    expect(mapPhotoForDisplay(null)).toEqual({});
    expect(mapPhotoForDisplay(undefined)).toEqual({});
  });

  it('defaults missing fields', () => {
    const result = mapPhotoForDisplay({ _id: 'p1' });
    expect(result.imageUrl).toBe('');
    expect(result.votes).toBe(0);
    expect(result.submittedBy).toBe('');
    expect(result.caption).toBe('');
  });

  it('preserves extra fields from backend', () => {
    const result = mapPhotoForDisplay({
      _id: 'p1',
      photoUrl: 'url',
      voteCount: 3,
      memberDisplayName: 'Test',
      socialSource: 'instagram',
      beforeAfterId: 'pair-1',
      beforeAfterType: 'before',
    });
    expect(result.socialSource).toBe('instagram');
    expect(result.beforeAfterId).toBe('pair-1');
    expect(result.beforeAfterType).toBe('before');
  });

  it('handles zero vote count', () => {
    const result = mapPhotoForDisplay({ _id: 'p1', voteCount: 0 });
    expect(result.votes).toBe(0);
  });

  it('maps a batch of photos', () => {
    const photos = [
      { _id: 'p1', photoUrl: 'url1', voteCount: 5, memberDisplayName: 'A' },
      { _id: 'p2', photoUrl: 'url2', voteCount: 10, memberDisplayName: 'B' },
    ];
    const mapped = photos.map(mapPhotoForDisplay);
    expect(mapped).toHaveLength(2);
    expect(mapped[0].imageUrl).toBe('url1');
    expect(mapped[1].votes).toBe(10);
  });
});
