declare global {
  interface Window {
    memoryMap: Map<
      string,
      {
        ids: Set<string>;
        type: 'text' | 'image';
        variables?: Record<string, string | number | boolean>;
      }
    >;
    currentLanguageCode: string | null;
    isStandaloneMode?: boolean; // True when browser script is loaded (no SDK translations)
    __contentstorageRefresh?: () => void;
    __contentstorageApiKey?: string;
    __contentstorageAPI?: {
      version: string;
      isReady: boolean;
      requestTranslations: () => void;
      getContentById: (id: string) => string | null;
      getLanguageCode: () => string | null;
      getMemoryMapSize: () => number;
      setTranslations: (languageCode: string, translations: Record<string, string>) => void;
      clear: () => void;
      onRefresh: (callback: () => void) => void;
    };
    __contentstorageAgentAPI?: import('./agent-api').AgentAPI;
  }
}

// This export is needed to make the file a module
export {};
