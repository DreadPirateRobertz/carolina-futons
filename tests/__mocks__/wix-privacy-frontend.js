// Mock for wix-privacy-frontend
// Simulates the Wix consent/privacy policy API for testing.
import { vi } from 'vitest';

let _policy = { functional: true, analytics: true, advertising: true, dataToThirdParty: true };
let _callbacks = [];

export function __reset() {
  _policy = { functional: true, analytics: true, advertising: true, dataToThirdParty: true };
  _callbacks = [];
}

export function __setPolicy(policy) {
  _policy = { ..._policy, ...policy };
}

const wixPrivacy = {
  getCurrentConsentPolicy: vi.fn(() => ({ policy: _policy })),
  onCurrentConsentPolicyChanged: vi.fn((cb) => {
    _callbacks.push(cb);
    return () => { _callbacks = _callbacks.filter(fn => fn !== cb); };
  }),
};

export default wixPrivacy;
