// Mock for wix-crm-backend
let _emailLog = [];
let _shouldFail = false;

export function __reset() {
  _emailLog = [];
  _shouldFail = false;
}

export function __getEmailLog() {
  return _emailLog;
}

export function __failNextEmail() {
  _shouldFail = true;
}

export const triggeredEmails = {
  async emailContact(templateId, contactId, options) {
    if (_shouldFail) {
      _shouldFail = false;
      throw new Error('Email service unavailable');
    }
    _emailLog.push({ templateId, contactId, options });
    return { success: true };
  },
  async emailMember(templateId, memberId, options) {
    if (_shouldFail) {
      _shouldFail = false;
      throw new Error('Email service unavailable');
    }
    _emailLog.push({ templateId, memberId, options });
    return { success: true };
  },
};
