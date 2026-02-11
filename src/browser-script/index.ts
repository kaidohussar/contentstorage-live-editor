import { initializeMemoryMap } from './memoryMap';
import { initializeMessageHandler } from './messageHandler';
import { loadLiveEditor } from './loader';
import { createAPI } from './api';

/**
 * Detect if running in live editor mode
 * Checks for iframe or PiP mode (URL param check is done by loader snippet)
 */
function detectLiveEditorMode(): boolean {
  // Check if in iframe
  const isInIframe = window.parent && window.parent !== window;

  // Check if in PiP mode (opened via window.open)
  const isInPipMode = window.opener && window.opener !== window;

  return isInIframe || isInPipMode;
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

  // Mark standalone mode - browser script is loaded without SDK translations
  window.isStandaloneMode = true;

  // Initialize memoryMap
  initializeMemoryMap();

  // Initialize language code if not set
  if (typeof window.currentLanguageCode === 'undefined') {
    window.currentLanguageCode = null;
  }

  // Expose public API
  window.__contentstorageAPI = createAPI();

  // Initialize message handler (for SDK mode communication)
  initializeMessageHandler(isLiveEditorMode);

  // In standalone mode, load live-editor immediately (don't wait for translations)
  // The live-editor handles handshake with Contentstorage parent app
  loadLiveEditor().catch((error) => {
    console.error('[ContentStorage] Failed to load live editor:', error);
  });

  console.log('[ContentStorage] Browser script ready');
})();
