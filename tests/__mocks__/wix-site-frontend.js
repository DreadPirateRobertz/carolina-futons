// Mock wix-site-frontend for vitest
export const currentPage = {
  visitorZip: '',
  name: 'Test Page',
  url: '/test',
};

export function __reset() {
  currentPage.visitorZip = '';
}
