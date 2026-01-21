// Translations payload from parent (simple flat format)
export interface TranslationsPayload {
  languageCode: string;
  translations: Record<string, string>; // { "greeting": "Hello", "nav.home": "Home" }
}

// Language change payload
export interface LanguageChangePayload {
  languageCode: string;
  translations: Record<string, string>;
}

// Single translation update payload
export interface TranslationUpdatePayload {
  key: string;
  value: string;
  oldValue: string;
  language: string;
}

// Queued message for processing after ready
export interface QueuedMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

// Browser script internal state
export interface BrowserScriptState {
  isLiveEditorMode: boolean;
  isReady: boolean;
  parentOrigin: string | null;
  messageQueue: QueuedMessage[];
}

// Memory map entry structure (matches existing live-editor expectations)
export interface MemoryMapEntry {
  ids: Set<string>;
  type: 'text' | 'image';
  variables?: Record<string, string | number | boolean>;
}
