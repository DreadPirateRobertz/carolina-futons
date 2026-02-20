// Mock for wix-members-backend
// Simulates the currentMember API for authentication checks

let _currentMember = null;
let _roles = [];

export function __reset() {
  _currentMember = null;
  _roles = [];
}

// Set the mock member for testing authenticated endpoints
export function __setMember(member) {
  _currentMember = member;
}

// Set the mock roles for testing admin checks
export function __setRoles(roles) {
  _roles = roles;
}

export const currentMember = {
  async getMember() {
    return _currentMember;
  },
  async getRoles() {
    return _roles;
  },
};
