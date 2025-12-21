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
    __contentstorageRefresh?: () => void;
    __contentstorageApiKey?: string;
  }
}

// This export is needed to make the file a module
export {};
