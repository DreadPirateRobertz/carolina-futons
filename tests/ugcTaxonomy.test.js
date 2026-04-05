/**
 * @file ugcTaxonomy.test.js
 * @description Branch coverage for ugcTaxonomy.js — CF-rw9i.3 / CF-hgcl
 *
 * Covers:
 *  - ROOM_TYPES / ROOM_TYPE_VALUES exports
 *  - validatePhotoMetadata: all guard branches + optional-field branches
 */

import { describe, it, expect } from 'vitest';
import {
  ROOM_TYPES,
  ROOM_TYPE_VALUES,
  validatePhotoMetadata,
} from '../src/public/ugcTaxonomy.js';

// ── ROOM_TYPES ─────────────────────────────────────────────────────────────────

describe('ROOM_TYPES / ROOM_TYPE_VALUES', () => {
  it('ROOM_TYPE_VALUES contains all ROOM_TYPES values', () => {
    expect(ROOM_TYPE_VALUES).toEqual(Object.values(ROOM_TYPES));
  });
});

// ── validatePhotoMetadata ──────────────────────────────────────────────────────

describe('validatePhotoMetadata', () => {
  const VALID = {
    photoUrl: 'wix:image://v1/abc/room.jpg',
    roomType: 'living-room',
  };

  it('returns valid:true for a minimal valid submission', () => {
    expect(validatePhotoMetadata(VALID)).toEqual({ valid: true });
  });

  it('returns valid:true for an https photoUrl', () => {
    expect(validatePhotoMetadata({ ...VALID, photoUrl: 'https://example.com/img.jpg' }))
      .toEqual({ valid: true });
  });

  // ── required-field guards ────────────────────────────────────────────────────

  it('returns error when obj is null', () => {
    const r = validatePhotoMetadata(null);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/object/i);
  });

  it('returns error when obj is not an object (string)', () => {
    const r = validatePhotoMetadata('not-an-object');
    expect(r.valid).toBe(false);
  });

  it('returns error when photoUrl is missing', () => {
    const r = validatePhotoMetadata({ roomType: 'office' });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/photoUrl is required/i);
  });

  it('returns error when photoUrl is neither wix:image:// nor https://', () => {
    const r = validatePhotoMetadata({ ...VALID, photoUrl: 'http://insecure.com/img.jpg' });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Wix media URL or HTTPS/i);
  });

  it('returns error when roomType is missing', () => {
    const r = validatePhotoMetadata({ photoUrl: VALID.photoUrl });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/roomType is required/i);
  });

  it('returns error when roomType is not in ROOM_TYPE_VALUES', () => {
    const r = validatePhotoMetadata({ ...VALID, roomType: 'garage' });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Invalid roomType/i);
  });

  // ── optional caption ─────────────────────────────────────────────────────────

  it('accepts a valid caption', () => {
    expect(validatePhotoMetadata({ ...VALID, caption: 'Cozy corner' })).toEqual({ valid: true });
  });

  it('returns error when caption exceeds 200 chars', () => {
    const r = validatePhotoMetadata({ ...VALID, caption: 'x'.repeat(201) });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/caption must be 200/i);
  });

  it('skips caption check when caption is null', () => {
    expect(validatePhotoMetadata({ ...VALID, caption: null })).toEqual({ valid: true });
  });

  it('skips caption check when caption is undefined', () => {
    expect(validatePhotoMetadata({ ...VALID, caption: undefined })).toEqual({ valid: true });
  });

  // ── optional productId ────────────────────────────────────────────────────────

  it('accepts a valid productId', () => {
    expect(validatePhotoMetadata({ ...VALID, productId: 'prod-123' })).toEqual({ valid: true });
  });

  it('returns error when productId is not a string', () => {
    const r = validatePhotoMetadata({ ...VALID, productId: 42 });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/productId must be a string/i);
  });

  it('returns error when productId exceeds 50 chars', () => {
    const r = validatePhotoMetadata({ ...VALID, productId: 'p'.repeat(51) });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/productId must be a string of 50/i);
  });

  it('returns error when productId contains invalid characters', () => {
    const r = validatePhotoMetadata({ ...VALID, productId: 'invalid id/path?x=1' });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/productId must be a string/i);
  });


  it('skips productId check when productId is null', () => {
    expect(validatePhotoMetadata({ ...VALID, productId: null })).toEqual({ valid: true });
  });

  // ── optional productName ─────────────────────────────────────────────────────

  it('accepts a valid productName', () => {
    expect(validatePhotoMetadata({ ...VALID, productName: 'Kodiak Frame' })).toEqual({ valid: true });
  });

  it('returns error when productName is not a string', () => {
    const r = validatePhotoMetadata({ ...VALID, productName: 999 });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/productName must be a string/i);
  });

  it('returns error when productName exceeds 200 chars', () => {
    const r = validatePhotoMetadata({ ...VALID, productName: 'n'.repeat(201) });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/productName must be a string of 200/i);
  });

  it('skips productName check when productName is null', () => {
    expect(validatePhotoMetadata({ ...VALID, productName: null })).toEqual({ valid: true });
  });
});
