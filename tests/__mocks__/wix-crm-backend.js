// Mock for wix-crm-backend
let _emailLog = [];

export function __reset() {
  _emailLog = [];
}

export function __getEmailLog() {
  return _emailLog;
}

export const triggeredEmails = {
  async emailContact(templateId, contactId, options) {
    _emailLog.push({ templateId, contactId, options });
    return { success: true };
  },
};
