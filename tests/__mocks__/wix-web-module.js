// Mock for wix-web-module
// webMethod(permission, fn) just returns fn — strips the Wix permission wrapper.
// Permissions MUST match the canonical runtime enum (Anyone, Admin, SiteMember).
// Do not add keys here — a typo that resolves to undefined in prod would be
// silently masked by tests. See cf-zkj.
export const Permissions = {
  Anyone: 'Anyone',
  SiteMember: 'SiteMember',
  Admin: 'Admin',
};

export function webMethod(_permission, fn) {
  return fn;
}
