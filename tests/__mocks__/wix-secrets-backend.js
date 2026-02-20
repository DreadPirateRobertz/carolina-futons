// Mock for wix-secrets-backend
let _secrets = {};

export function __reset() {
  _secrets = {};
}

export function __setSecrets(map) {
  _secrets = { ..._secrets, ...map };
}

export async function getSecret(key) {
  if (!(key in _secrets)) {
    throw new Error(`Secret "${key}" not found`);
  }
  return _secrets[key];
}
