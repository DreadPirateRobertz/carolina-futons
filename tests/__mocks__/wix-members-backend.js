// Mock for wix-members-backend
// Simulates the currentMember API for authentication checks
import { vi } from 'vitest';

let _currentMember = null;
let _roles = [];

export function __reset() {
  _currentMember = null;
  _roles = [];
  currentMember.getMember.mockReset();
  currentMember.getMember.mockImplementation(() => Promise.resolve(_currentMember));
  currentMember.getRoles.mockReset();
  currentMember.getRoles.mockImplementation(() => Promise.resolve(_roles));
}

// Alias — resets member to null (no authenticated session)
export function __resetMember() {
  _currentMember = null;
  currentMember.getMember.mockImplementation(() => Promise.resolve(null));
}

// Set the mock member for testing authenticated endpoints
export function __setMember(member) {
  _currentMember = member;
  currentMember.getMember.mockImplementation(() => Promise.resolve(_currentMember));
}

// Set the mock roles for testing admin checks
export function __setRoles(roles) {
  _roles = roles;
  currentMember.getRoles.mockImplementation(() => Promise.resolve(_roles));
}

export const currentMember = {
  getMember: vi.fn(() => Promise.resolve(_currentMember)),
  getRoles: vi.fn(() => Promise.resolve(_roles)),
};
