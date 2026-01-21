// Allowed origins for postMessage communication
const ALLOWED_ORIGINS = [
  'https://contentstorage.app',
  'https://www.contentstorage.app',
  'https://app.contentstorage.app',
  'https://staging.contentstorage.app',
];

// Development origins (only in non-production)
const DEV_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

/**
 * Check if the current environment is development
 */
function isDevelopment(): boolean {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

/**
 * Check if an origin is allowed for postMessage communication
 */
export function isAllowedOrigin(origin: string): boolean {
  // Production origins always allowed
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Check for contentstorage.app subdomains
  if (/^https:\/\/[a-z0-9-]+\.contentstorage\.app$/.test(origin)) {
    return true;
  }

  // Dev origins only allowed in development
  if (isDevelopment()) {
    for (const pattern of DEV_ORIGIN_PATTERNS) {
      if (pattern.test(origin)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validate that a message event is from a trusted source
 */
export function validateMessageEvent(event: MessageEvent): boolean {
  // Must have an origin
  if (!event.origin) {
    return false;
  }

  // Origin must be allowed
  if (!isAllowedOrigin(event.origin)) {
    console.warn(
      '[ContentStorage] Rejected message from untrusted origin:',
      event.origin
    );
    return false;
  }

  // Must have data with type
  if (!event.data || typeof event.data.type !== 'string') {
    return false;
  }

  return true;
}
