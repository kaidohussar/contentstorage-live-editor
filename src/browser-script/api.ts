import { SCRIPT_VERSION } from './constants';
import { getState, requestTranslations } from './messageHandler';
import { getContentById, populateFromFlatTranslations, clearMemoryMap } from './memoryMap';

/**
 * Public API exposed on window.__contentstorageAPI
 */
export interface ContentStorageAPI {
  /** Script version */
  version: string;

  /** Check if script is ready (translations received) */
  isReady: boolean;

  /** Request translations from parent */
  requestTranslations: () => void;

  /** Get content value by ID */
  getContentById: (id: string) => string | null;

  /** Get current language code */
  getLanguageCode: () => string | null;

  /** Get memory map size */
  getMemoryMapSize: () => number;

  /** Manually set translations (for non-iframe use) */
  setTranslations: (languageCode: string, translations: Record<string, string>) => void;

  /** Clear all translations */
  clear: () => void;

  /** Register refresh callback */
  onRefresh: (callback: () => void) => void;
}

/**
 * Create the public API object
 */
export function createAPI(): ContentStorageAPI {
  return {
    version: SCRIPT_VERSION,

    get isReady() {
      return getState().isReady;
    },

    requestTranslations,

    getContentById,

    getLanguageCode() {
      return window.currentLanguageCode;
    },

    getMemoryMapSize() {
      return window.memoryMap?.size || 0;
    },

    setTranslations(languageCode: string, translations: Record<string, string>) {
      window.currentLanguageCode = languageCode;
      populateFromFlatTranslations(translations);
    },

    clear() {
      clearMemoryMap();
      window.currentLanguageCode = null;
    },

    onRefresh(callback: () => void) {
      window.__contentstorageRefresh = callback;
    },
  };
}
