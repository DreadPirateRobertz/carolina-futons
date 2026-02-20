// Mock for wix-web-module
// webMethod(permission, fn) just returns fn — strips the Wix permission wrapper
export const Permissions = {
  Anyone: 'Anyone',
  SiteMember: 'SiteMember',
  Admin: 'Admin',
};

export function webMethod(_permission, fn) {
  return fn;
}
