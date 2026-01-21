import {
  BROWSER_SCRIPT_MESSAGE_TYPES,
  MESSAGE_QUEUE_TIMEOUT,
  SCRIPT_VERSION,
} from './constants';
import { validateMessageEvent } from './security';
import {
  populateFromFlatTranslations,
  updateSingleTranslation,
} from './memoryMap';
import { loadLiveEditor } from './loader';
import {
  TranslationsPayload,
  LanguageChangePayload,
  TranslationUpdatePayload,
  BrowserScriptState,
} from './types';

// Internal state
const state: BrowserScriptState = {
  isLiveEditorMode: false,
  isReady: false,
  parentOrigin: null,
  messageQueue: [],
};

/**
 * Send a message to the parent window
 */
function sendToParent(type: string, payload?: unknown): void {
  if (!window.parent || window.parent === window) {
    return;
  }

  // Use stored parent origin if available, otherwise use wildcard for initial message
  const targetOrigin = state.parentOrigin || '*';
  window.parent.postMessage({ type, payload }, targetOrigin);
}

/**
 * Handle incoming translations data
 */
async function handleTranslations(payload: TranslationsPayload): Promise<void> {
  console.log('[ContentStorage] Received translations:', {
    languageCode: payload.languageCode,
    count: payload.translations ? Object.keys(payload.translations).length : 0,
  });

  // Set language code
  window.currentLanguageCode = payload.languageCode;

  // Populate memoryMap from flat translations
  if (payload.translations) {
    populateFromFlatTranslations(payload.translations);
  }

  // Mark as ready
  state.isReady = true;

  // Load live editor if in live editor mode
  if (state.isLiveEditorMode) {
    try {
      await loadLiveEditor();
    } catch (error) {
      console.error('[ContentStorage] Failed to load live editor:', error);
    }
  }

  // Process queued messages
  processMessageQueue();

  // Trigger refresh callback if registered
  if (typeof window.__contentstorageRefresh === 'function') {
    window.__contentstorageRefresh();
  }
}

/**
 * Handle language change
 */
function handleLanguageChange(payload: LanguageChangePayload): void {
  console.log('[ContentStorage] Language changed:', payload.languageCode);

  window.currentLanguageCode = payload.languageCode;

  if (payload.translations) {
    populateFromFlatTranslations(payload.translations);
  }

  // Trigger refresh callback
  if (typeof window.__contentstorageRefresh === 'function') {
    window.__contentstorageRefresh();
  }
}

/**
 * Handle single translation update
 */
function handleTranslationUpdate(payload: TranslationUpdatePayload): void {
  console.log('[ContentStorage] Translation updated:', payload.key);

  updateSingleTranslation(payload.key, payload.value, payload.oldValue);

  // Trigger refresh callback
  if (typeof window.__contentstorageRefresh === 'function') {
    window.__contentstorageRefresh();
  }
}

/**
 * Handle ready request from parent (for re-sync)
 */
function handleReadyRequest(): void {
  console.log('[ContentStorage] Received ready request');
  sendToParent(BROWSER_SCRIPT_MESSAGE_TYPES.SCRIPT_READY, {
    version: SCRIPT_VERSION,
    isReady: state.isReady,
    memoryMapSize: window.memoryMap?.size || 0,
  });
}

/**
 * Process queued messages after becoming ready
 */
function processMessageQueue(): void {
  const now = Date.now();

  // Filter out expired messages
  const validMessages = state.messageQueue.filter(
    (msg) => now - msg.timestamp < MESSAGE_QUEUE_TIMEOUT
  );

  // Clear queue
  state.messageQueue = [];

  // Process valid messages
  for (const msg of validMessages) {
    handleMessage(msg.type, msg.payload, false);
  }
}

/**
 * Main message handler
 */
function handleMessage(
  type: string,
  payload: unknown,
  canQueue: boolean = true
): void {
  // Queue messages if not ready yet (except for translations which make us ready)
  if (
    !state.isReady &&
    canQueue &&
    type !== BROWSER_SCRIPT_MESSAGE_TYPES.TRANSLATIONS
  ) {
    state.messageQueue.push({
      type,
      payload,
      timestamp: Date.now(),
    });
    return;
  }

  switch (type) {
    case BROWSER_SCRIPT_MESSAGE_TYPES.TRANSLATIONS:
      handleTranslations(payload as TranslationsPayload);
      break;

    case BROWSER_SCRIPT_MESSAGE_TYPES.LANGUAGE_CHANGE:
      handleLanguageChange(payload as LanguageChangePayload);
      break;

    case BROWSER_SCRIPT_MESSAGE_TYPES.TRANSLATION_UPDATE:
      handleTranslationUpdate(payload as TranslationUpdatePayload);
      break;

    case BROWSER_SCRIPT_MESSAGE_TYPES.READY_REQUEST:
      handleReadyRequest();
      break;

    default:
      // Unknown message type - may be for live-editor, ignore silently
      break;
  }
}

/**
 * PostMessage event listener
 */
function onMessage(event: MessageEvent): void {
  // Validate message
  if (!validateMessageEvent(event)) {
    return;
  }

  // Store parent origin on first valid message
  if (!state.parentOrigin) {
    state.parentOrigin = event.origin;
  }

  handleMessage(event.data.type, event.data.payload);
}

/**
 * Initialize message handling
 */
export function initializeMessageHandler(isLiveEditorMode: boolean): void {
  state.isLiveEditorMode = isLiveEditorMode;

  // Add message listener
  window.addEventListener('message', onMessage);

  // If in live editor mode, announce readiness
  if (isLiveEditorMode && window.parent && window.parent !== window) {
    sendToParent(BROWSER_SCRIPT_MESSAGE_TYPES.SCRIPT_READY, {
      version: SCRIPT_VERSION,
    });
    console.log('[ContentStorage] Sent script-ready message to parent');
  }
}

/**
 * Get current state (for API)
 */
export function getState(): Readonly<BrowserScriptState> {
  return { ...state };
}

/**
 * Request translations from parent
 */
export function requestTranslations(): void {
  sendToParent(BROWSER_SCRIPT_MESSAGE_TYPES.REQUEST_TRANSLATIONS, {});
}
