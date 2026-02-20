// Mock for wix-http-functions
// Returns response objects with body and headers

export function ok({ body, headers }) {
  return { status: 200, body, headers: headers || {} };
}

export function serverError({ body, headers }) {
  return { status: 500, body, headers: headers || {} };
}

export function notFound({ body, headers }) {
  return { status: 404, body, headers: headers || {} };
}

export function __reset() {}
