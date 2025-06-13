declare global {
  interface Window {
    memoryMap: Map<string, { ids: Set<string> }>;
  }
}

// This export is needed to make the file a module
export {};
