declare global {
  interface Window {
    memoryMap: Map<string, { ids: Set<string>; type: 'text' | 'image' }>;
  }
}

// This export is needed to make the file a module
export {};
