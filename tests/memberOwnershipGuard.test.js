/**
 * Tests for CF-2za7: IDOR guard — SiteMember webMethod ownership check scanner.
 * Verifies that extractSiteMemberMethods, checkMethodForIDOR, and the full
 * scanBackendFiles pipeline correctly detect and ignore ownership patterns.
 */
import { describe, it, expect } from 'vitest';
import {
  extractSiteMemberMethods,
  checkMethodForIDOR,
  scanBackendFiles,
} from '../scripts/check-member-ownership.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const BACKEND_DIR = resolve(__dir, '../src/backend');

// ── extractSiteMemberMethods ─────────────────────────────────────

describe('extractSiteMemberMethods', () => {
  it('finds a SiteMember webMethod', () => {
    const source = `
export const getItem = webMethod(Permissions.SiteMember, async (memberId) => {
  return wixData.get('Items', memberId);
});`;
    const methods = extractSiteMemberMethods(source);
    expect(methods).toHaveLength(1);
    expect(methods[0].name).toBe('getItem');
    expect(methods[0].params).toBe('memberId');
  });

  it('extracts method body', () => {
    const source = `
export const getItem = webMethod(Permissions.SiteMember, async (memberId) => {
  const result = await wixData.get('Items', memberId);
  return result;
});`;
    const methods = extractSiteMemberMethods(source);
    expect(methods[0].body).toContain('wixData.get');
  });

  it('ignores non-SiteMember webMethods', () => {
    const source = `
export const getAll = webMethod(Permissions.Anyone, async () => {
  return wixData.query('Items').find();
});`;
    const methods = extractSiteMemberMethods(source);
    expect(methods).toHaveLength(0);
  });

  it('ignores Admin webMethods', () => {
    const source = `
export const adminGet = webMethod(Permissions.Admin, async (memberId) => {
  return wixData.get('Items', memberId);
});`;
    const methods = extractSiteMemberMethods(source);
    expect(methods).toHaveLength(0);
  });

  it('finds multiple SiteMember methods in one file', () => {
    const source = `
export const getA = webMethod(Permissions.SiteMember, async (memberId) => {
  return wixData.get('A', memberId);
});
export const getB = webMethod(Permissions.SiteMember, async (userId) => {
  return wixData.get('B', userId);
});`;
    const methods = extractSiteMemberMethods(source);
    expect(methods).toHaveLength(2);
    expect(methods.map(m => m.name)).toEqual(['getA', 'getB']);
  });

  it('returns lineNumber for each method', () => {
    const source = `
// line 2

export const getItem = webMethod(Permissions.SiteMember, async (memberId) => {
  return wixData.get('Items', memberId);
});`;
    const methods = extractSiteMemberMethods(source);
    expect(methods[0].lineNumber).toBeGreaterThan(1);
  });

  it('returns empty array for source with no webMethods', () => {
    const methods = extractSiteMemberMethods('const x = 1;');
    expect(methods).toHaveLength(0);
  });
});

// ── checkMethodForIDOR ────────────────────────────────────────────

describe('checkMethodForIDOR', () => {
  it('flags method with memberId param and .eq() query, no getMember()', () => {
    const method = {
      name: 'getCredits',
      params: 'memberId',
      body: `{ const r = await wixData.query('Credits').eq('memberId', memberId).find(); return r; }`,
    };
    const result = checkMethodForIDOR(method);
    expect(result.violation).toBe(true);
    expect(result.reason).toContain('getCredits');
  });

  it('does not flag when getMember() is called', () => {
    const method = {
      name: 'getCredits',
      params: 'memberId',
      body: `{
        const member = await currentMember.getMember();
        const r = await wixData.query('Credits').eq('memberId', memberId).find();
        return r;
      }`,
    };
    expect(checkMethodForIDOR(method).violation).toBe(false);
  });

  it('does not flag when currentMember. is accessed', () => {
    const method = {
      name: 'getCredits',
      params: 'memberId',
      body: `{
        const id = currentMember.getId();
        const r = await wixData.query('Credits').eq('memberId', memberId).find();
        return r;
      }`,
    };
    expect(checkMethodForIDOR(method).violation).toBe(false);
  });

  it('does not flag when param is not memberId-like', () => {
    const method = {
      name: 'getItem',
      params: 'itemId',
      body: `{ return await wixData.query('Items').eq('_id', itemId).find(); }`,
    };
    expect(checkMethodForIDOR(method).violation).toBe(false);
  });

  it('does not flag when no .eq() query', () => {
    const method = {
      name: 'doSomething',
      params: 'memberId',
      body: `{ return { memberId }; }`,
    };
    expect(checkMethodForIDOR(method).violation).toBe(false);
  });

  it('flags userId param as IDOR risk', () => {
    const method = {
      name: 'getProfile',
      params: 'userId',
      body: `{ return await wixData.query('Profiles').eq('userId', userId).find(); }`,
    };
    expect(checkMethodForIDOR(method).violation).toBe(true);
  });

  it('flags contactId param as IDOR risk', () => {
    const method = {
      name: 'getContact',
      params: 'contactId',
      body: `{ return await wixData.query('Contacts').eq('contactId', contactId).find(); }`,
    };
    expect(checkMethodForIDOR(method).violation).toBe(true);
  });

  it('flags fromMemberId compound param as IDOR risk', () => {
    const method = {
      name: 'transferCredit',
      params: 'fromMemberId, toMemberId, amount',
      body: `{ return await wixData.query('Credits').eq('memberId', fromMemberId).find(); }`,
    };
    expect(checkMethodForIDOR(method).violation).toBe(true);
  });

  it('flags toMemberId compound param as IDOR risk', () => {
    const method = {
      name: 'transferCredit',
      params: 'toMemberId',
      body: `{ return await wixData.query('Credits').eq('memberId', toMemberId).find(); }`,
    };
    expect(checkMethodForIDOR(method).violation).toBe(true);
  });

  it('violation reason references the method name', () => {
    const method = {
      name: 'myDangerousMethod',
      params: 'memberId',
      body: `{ return await wixData.query('Data').eq('memberId', memberId).find(); }`,
    };
    const result = checkMethodForIDOR(method);
    expect(result.reason).toContain('myDangerousMethod');
  });
});

// ── scanBackendFiles (integration) ───────────────────────────────

describe('scanBackendFiles', () => {
  it('runs against real backend directory without crashing', () => {
    expect(() => scanBackendFiles(BACKEND_DIR)).not.toThrow();
  });

  it('returns an array', () => {
    const violations = scanBackendFiles(BACKEND_DIR);
    expect(Array.isArray(violations)).toBe(true);
  });

  it('each violation has required fields', () => {
    const violations = scanBackendFiles(BACKEND_DIR);
    for (const v of violations) {
      expect(v).toHaveProperty('file');
      expect(v).toHaveProperty('name');
      expect(v).toHaveProperty('line');
      expect(v).toHaveProperty('reason');
    }
  });

  it('storeCreditService has no IDOR violations (CF-zamz fix verified)', () => {
    const violations = scanBackendFiles(BACKEND_DIR);
    const storeCredit = violations.filter(v => v.file.includes('storeCreditService'));
    expect(storeCredit).toHaveLength(0);
  });

  it('produces zero violations in current codebase (all ownership checks present)', () => {
    const violations = scanBackendFiles(BACKEND_DIR);
    // Document violations if any exist — this test acts as a ratchet:
    // if violations are 0 now, any new IDOR will fail CI
    expect(violations).toHaveLength(0);
  });
});
