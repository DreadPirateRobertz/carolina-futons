// Mock for wix-members-backend
// Simulates the currentMember API for authentication checks

let _currentMember = null;

export function __reset() {
  _currentMember = null;
}

// Set the mock member for testing authenticated endpoints
export function __setMember(member) {
  _currentMember = member;
}

export const currentMember = {
  async getMember() {
    return _currentMember;
  },
};
