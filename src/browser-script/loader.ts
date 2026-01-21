import { LIVE_EDITOR_SCRIPT_URL } from './constants';

let loadPromise: Promise<void> | null = null;
let retryCount = 0;
const MAX_RETRIES = 2;
const RETRY_DELAY = 3000;

/**
 * Dynamically load the live-editor.js script
 * Adds the contentstorage-live-editor parameter for the live editor to detect
 */
export function loadLiveEditor(): Promise<void> {
  // Return existing promise if already loading/loaded
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const attemptLoad = () => {
      const script = document.createElement('script');

      // Add the required parameter for live-editor detection
      const url = new URL(LIVE_EDITOR_SCRIPT_URL);
      url.searchParams.set('contentstorage-live-editor', 'true');

      script.src = url.toString();
      script.async = true;

      script.onload = () => {
        console.log('[ContentStorage] Live editor loaded successfully');
        retryCount = 0;
        resolve();
      };

      script.onerror = () => {
        retryCount++;
        console.error(
          `[ContentStorage] Failed to load live editor (attempt ${retryCount}/${MAX_RETRIES + 1})`
        );

        if (retryCount <= MAX_RETRIES) {
          console.log(
            `[ContentStorage] Retrying in ${RETRY_DELAY / 1000} seconds...`
          );
          setTimeout(attemptLoad, RETRY_DELAY);
        } else {
          loadPromise = null; // Allow future retry
          retryCount = 0;
          reject(new Error('Failed to load live editor script after retries'));
        }
      };

      document.head.appendChild(script);
    };

    attemptLoad();
  });

  return loadPromise;
}

/**
 * Check if live editor is already loaded
 */
export function isLiveEditorLoaded(): boolean {
  return loadPromise !== null;
}
