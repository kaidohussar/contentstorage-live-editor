// Cache screenshot mode at module load time (before URL params get cleaned)
const urlParams = new URLSearchParams(window.location.search);
const screenshotModeEnabled = urlParams.get('screenshot_mode') === 'true';

/**
 * Check if screenshot mode is enabled (cached at init)
 */
export const isScreenshotModeEnabled = (): boolean => screenshotModeEnabled;
