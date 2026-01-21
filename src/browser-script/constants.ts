// Message types for browser-script communication
// Using 'contentstorage-' prefix to match existing convention

export const BROWSER_SCRIPT_MESSAGE_TYPES = {
  // Outgoing (script -> parent)
  SCRIPT_READY: 'contentstorage-script-ready',
  REQUEST_TRANSLATIONS: 'contentstorage-request-translations',

  // Incoming (parent -> script)
  TRANSLATIONS: 'contentstorage-translations',
  LANGUAGE_CHANGE: 'contentstorage-language-change',
  TRANSLATION_UPDATE: 'contentstorage-translation-update',
  READY_REQUEST: 'contentstorage-ready-request',
} as const;

// URL parameter for live editor detection
export const LIVE_EDITOR_PARAM = 'contentstorage_live_editor';

// Maximum entries limit for performance
export const MAX_MEMORY_MAP_ENTRIES = 10_000;

// Live editor script URL (same CDN path)
export const LIVE_EDITOR_SCRIPT_URL = 'https://cdn.contentstorage.app/live-editor.js';

// Message queue timeout (ms)
export const MESSAGE_QUEUE_TIMEOUT = 5000;

// Script version
export const SCRIPT_VERSION = '1.0.0';
