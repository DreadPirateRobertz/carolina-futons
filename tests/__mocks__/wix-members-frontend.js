// Mock for wix-members-frontend
let _memberOverride = null;

export const currentMember = {
  getMember: async () => _memberOverride,
};

export const authentication = {
  promptLogin: () => {},
  onLogin: () => {},
};

export function __setMember(member) {
  _memberOverride = member;
}

export function __reset() {
  _memberOverride = null;
}
