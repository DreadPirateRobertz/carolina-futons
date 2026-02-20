// Global test setup — resets all Wix mocks before each test
import { __reset as resetData } from './__mocks__/wix-data.js';
import { __reset as resetCrm } from './__mocks__/wix-crm-backend.js';
import { __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as resetFetch } from './__mocks__/wix-fetch.js';
import { __reset as resetMembers } from './__mocks__/wix-members-backend.js';
import { __reset as resetStorage } from './__mocks__/wix-storage-frontend.js';

beforeEach(() => {
  resetData();
  resetCrm();
  resetSecrets();
  resetFetch();
  resetMembers();
  resetStorage();
});
