declare global {
  interface Window {
    memoryMap: Map<
      string,
      {
        ids: Set<string>;
        type: 'text' | 'image' | 'variation';
        variation?: string;
      }
    >;
    currentLanguageCode: string | null;
  }
}

// This export is needed to make the file a module
export {};
