// Mock for wix-crm-backend
let _emailLog = [];
let _shouldFail = false;
let _contacts = [];

export function __reset() {
  _emailLog = [];
  _shouldFail = false;
  _contacts = [];
}

export function __getEmailLog() {
  return _emailLog;
}

export function __failNextEmail() {
  _shouldFail = true;
}

export function __seedContacts(items) {
  _contacts = [...items];
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

export const contacts = {
  queryContacts() {
    let _filters = {};
    const builder = {
      eq(field, value) { _filters[field] = value; return builder; },
      limit() { return builder; },
      find: async () => {
        const items = _contacts.filter(c => {
          for (const [field, val] of Object.entries(_filters)) {
            const parts = field.split('.');
            let obj = c;
            for (const p of parts) { obj = obj?.[p]; }
            if (obj !== val) return false;
          }
          return true;
        });
        return { items };
      },
    };
    return builder;
  },
  async appendOrCreateContact(info) {
    const email = info?.emails?.[0]?.email || '';
    const existing = _contacts.find(c => c.primaryInfo?.email === email);
    if (existing) return { contactId: existing._id };
    const newContact = {
      _id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      primaryInfo: { email },
    };
    _contacts.push(newContact);
    return { contactId: newContact._id };
  },
};
