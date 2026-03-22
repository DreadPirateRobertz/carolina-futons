// Rooms.js — /rooms page
// Customer Room Gallery — browse, filter, like, and submit UGC room photos.
//
// Orchestrates:
//   - initRoomGallery: loads approved photos into gallery repeater
//   - initRoomFilter: room-type filter tabs
//   - initRoomSubmitForm: UGC photo submission form

import { getApprovedPhotos } from 'backend/ugcService.web';
import { initRoomGallery } from 'public/RoomGallery.js';
import { trackEvent } from 'public/engagementTracker';

$w.onReady(async function () {
  trackEvent('page_view', { page: 'rooms' });

  let photos = [];
  try {
    const result = await getApprovedPhotos();
    photos = (result && Array.isArray(result.photos)) ? result.photos : [];
  } catch (err) {
    console.error('[Rooms] getApprovedPhotos failed:', err);
  }

  try {
    initRoomGallery($w, { photos });
  } catch (err) {
    console.error('[Rooms] initRoomGallery failed:', err);
  }
});
