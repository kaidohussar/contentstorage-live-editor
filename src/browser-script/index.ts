import { LIVE_EDITOR_PARAM } from './constants';
import { initializeMemoryMap } from './memoryMap';
import { initializeMessageHandler } from './messageHandler';
import { createAPI } from './api';

/**
 * Detect if running in live editor mode
 * Requirements: inside iframe + URL param present
 */
function detectLiveEditorMode(): boolean {
  // Check if in iframe
  const isInIframe = window.parent && window.parent !== window;

  if (!isInIframe) {
    return false;
  }

  // Check URL parameter (on the page URL, not script URL)
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(LIVE_EDITOR_PARAM) === 'true';
}

/**
 * Main initialization (IIFE)
 */
(function initBrowserScript() {
  // Check live editor mode first - exit early if not in live editor
  const isLiveEditorMode = detectLiveEditorMode();

  if (!isLiveEditorMode) {
    return;
  }

  console.log('[ContentStorage] Browser script initializing...');

  // Initialize memoryMap
  initializeMemoryMap();

  // Initialize language code if not set
  if (typeof window.currentLanguageCode === 'undefined') {
    window.currentLanguageCode = null;
  }

  // Expose public API
  window.__contentstorageAPI = createAPI();

  // Initialize message handler
  initializeMessageHandler(isLiveEditorMode);

  console.log('[ContentStorage] Browser script ready');
})();
