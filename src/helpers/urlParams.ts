// Cache URL params at module load time (before URL params get cleaned)
const urlParams = new URLSearchParams(window.location.search);
const screenshotModeEnabled = urlParams.get('screenshot_mode') === 'true';

// PiP mode detection with sessionStorage persistence for OAuth flow reconnection
// If pip_mode is in URL, store it in sessionStorage so it persists through OAuth redirects
const PIP_MODE_STORAGE_KEY = 'contentstorage_pip_mode';
const pipModeFromUrl = urlParams.get('pip_mode') === 'true';

// Store pip_mode in sessionStorage if present in URL
if (pipModeFromUrl) {
  try {
    sessionStorage.setItem(PIP_MODE_STORAGE_KEY, 'true');
  } catch {
    // sessionStorage might be blocked in some contexts
  }
}

// Check both URL param and sessionStorage (for OAuth redirect recovery)
const pipModeFromStorage = (() => {
  try {
    return sessionStorage.getItem(PIP_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
})();

const pipModeEnabled = pipModeFromUrl || pipModeFromStorage;

// Track if this is an OAuth reconnection (pip mode from storage, not URL)
const isOAuthReconnection = !pipModeFromUrl && pipModeFromStorage;

/**
 * Check if screenshot mode is enabled (cached at init)
 */
export const isScreenshotModeEnabled = (): boolean => screenshotModeEnabled;

/**
 * Check if PiP (Picture-in-Picture) mode is enabled.
 * In PiP mode, the live-editor is opened via window.open() instead of iframe.
 * This also checks sessionStorage for persistence across OAuth redirects.
 */
export const isPipMode = (): boolean => pipModeEnabled;

/**
 * Check if this is a reconnection after OAuth/navigation (pip_mode from storage, not URL).
 * Useful for logging and debugging purposes.
 */
export const isPipModeReconnection = (): boolean => isOAuthReconnection;

/**
 * Clear the PiP mode flag from sessionStorage.
 * Call this when the PiP session is intentionally ended.
 */
export const clearPipMode = (): void => {
  try {
    sessionStorage.removeItem(PIP_MODE_STORAGE_KEY);
  } catch {
    // sessionStorage might be blocked in some contexts
  }
};
