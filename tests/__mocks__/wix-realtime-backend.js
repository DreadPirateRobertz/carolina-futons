// Mock for wix-realtime-backend
const _published = [];

export function __reset() {
  _published.length = 0;
}

export function __getPublished() {
  return [..._published];
}

export const realtime = {
  async publish(channel, payload) {
    _published.push({ channel, payload });
  },
};
