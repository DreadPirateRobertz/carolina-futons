import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPhotos = vi.fn();
vi.mock('backend/realRoomsGallery.web', () => ({ getGalleryPhotos: mockGetPhotos }));
vi.mock('public/designTokens.js', () => ({ colors: {} }));
vi.mock('public/a11yHelpers.js', () => ({ announce: vi.fn() }));

function makeEl() {
  return {
    text: '', src: '', alt: '', data: null, accessibility: {},
    expand: vi.fn(), collapse: vi.fn(),
    onClick: vi.fn(), onItemReady: vi.fn(),
  };
}
function make$w() {
  const map = new Map();
  const get = (s) => { if (!map.has(s)) map.set(s, makeEl()); return map.get(s); };
  const $w = (s) => get(s);
  $w._els = map;
  return $w;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('RealRoomsGallery widget', () => {
  it('shows empty state when no photos', async () => {
    mockGetPhotos.mockResolvedValue({ success: true, photos: [], total: 0 });
    const { initRealRoomsGallery } = await import('../src/public/RealRoomsGallery.js');
    const $w = make$w();
    await initRealRoomsGallery($w, {});
    expect($w('#realRoomsEmpty').expand).toHaveBeenCalled();
    expect($w('#realRoomsRepeater').collapse).toHaveBeenCalled();
  });

  it('shows empty when success=false', async () => {
    mockGetPhotos.mockResolvedValue({ success: false, photos: [], total: 0 });
    const { initRealRoomsGallery } = await import('../src/public/RealRoomsGallery.js');
    const $w = make$w();
    await initRealRoomsGallery($w, {});
    expect($w('#realRoomsEmpty').expand).toHaveBeenCalled();
  });

  it('populates repeater with photos and expands section', async () => {
    mockGetPhotos.mockResolvedValue({
      success: true, total: 1,
      photos: [{ _id: 'p1', imageUrl: 'x.jpg', altText: 'alt', city: 'Asheville', state: 'NC', memberName: 'Jane', caption: 'Nice' }],
    });
    const { initRealRoomsGallery } = await import('../src/public/RealRoomsGallery.js');
    const $w = make$w();
    await initRealRoomsGallery($w, { productId: 'prod-1', state: 'NC' });
    expect($w('#realRoomsRepeater').data).toHaveLength(1);
    expect($w('#realRoomsSection').expand).toHaveBeenCalled();
  });

  it('onItemReady populates fields and tag count pluralization', async () => {
    mockGetPhotos.mockResolvedValue({
      success: true, total: 2,
      photos: [{ _id: 'p1', imageUrl: 'x', altText: 'a', city: 'Dallas', state: 'TX', memberName: 'Bob', caption: '', tags: [{}, {}] }],
    });
    const { initRealRoomsGallery } = await import('../src/public/RealRoomsGallery.js');
    const $w = make$w();
    await initRealRoomsGallery($w, {});
    const cb = $w('#realRoomsRepeater').onItemReady.mock.calls[0][0];

    const $item2 = make$w();
    cb($item2, { imageUrl: 'img.jpg', altText: 'alt', city: 'Dallas', state: 'TX', memberName: 'Bob', caption: 'cap', tags: [{}, {}] });
    expect($item2('#realRoomLocation').text).toBe('Dallas, TX');
    expect($item2('#realRoomTagCount').text).toBe('2 products tagged');

    const $item3 = make$w();
    cb($item3, { imageUrl: 'i', altText: 'a', city: 'X', state: 'Y', memberName: 'Z', tags: [{}] });
    expect($item3('#realRoomTagCount').text).toBe('1 product tagged');

    const $item4 = make$w();
    cb($item4, { imageUrl: 'i', altText: 'a', city: 'X', state: 'Y', memberName: 'Z' });
    expect($item4('#realRoomTagCount').text).toBe('0 products tagged');
    expect($item4('#realRoomCaption').text).toBe('');
  });

  it('shows Load More button when total > page size and loads more on click', async () => {
    mockGetPhotos.mockResolvedValueOnce({
      success: true, total: 20,
      photos: Array.from({ length: 12 }, (_, i) => ({ _id: `p${i}`, imageUrl: '', altText: '', city: '', state: '', memberName: '' })),
    });
    const { initRealRoomsGallery } = await import('../src/public/RealRoomsGallery.js');
    const $w = make$w();
    await initRealRoomsGallery($w, {});
    expect($w('#realRoomsLoadMore').expand).toHaveBeenCalled();

    mockGetPhotos.mockResolvedValueOnce({
      success: true, total: 20,
      photos: Array.from({ length: 8 }, (_, i) => ({ _id: `p${i + 12}`, imageUrl: '', altText: '', city: '', state: '', memberName: '' })),
    });
    const moreCb = $w('#realRoomsLoadMore').onClick.mock.calls[0][0];
    await moreCb();
    expect($w('#realRoomsRepeater').data.length).toBe(20);
    expect($w('#realRoomsLoadMore').collapse).toHaveBeenCalled();
  });

  it('collapses section on error', async () => {
    mockGetPhotos.mockRejectedValue(new Error('boom'));
    const { initRealRoomsGallery } = await import('../src/public/RealRoomsGallery.js');
    const $w = make$w();
    await initRealRoomsGallery($w, {});
    expect($w('#realRoomsSection').collapse).toHaveBeenCalled();
  });
});
