import { MemoryMapEntry } from './types';

export { populateFromFlatTranslations } from '../helpers/memoryMapUtils';

/**
 * Initialize the global memoryMap if it doesn't exist
 */
export function initializeMemoryMap(): void {
  if (!window.memoryMap) {
    window.memoryMap = new Map<string, MemoryMapEntry>();
  }
}

/**
 * Update a single translation entry
 */
export function updateSingleTranslation(
  key: string,
  value: string,
  oldValue: string
): void {
  // Remove key from old value's entry
  const oldEntry = window.memoryMap.get(oldValue);
  if (oldEntry) {
    oldEntry.ids.delete(key);
    if (oldEntry.ids.size === 0) {
      window.memoryMap.delete(oldValue);
    }
  }

  // Add key to new value's entry
  const newEntry = window.memoryMap.get(value);
  if (newEntry) {
    newEntry.ids.add(key);
  } else {
    window.memoryMap.set(value, {
      ids: new Set([key]),
      type: 'text',
    });
  }

  console.log(`[ContentStorage] Updated translation: ${key}`);
}

/**
 * Clear all entries from memoryMap
 */
export function clearMemoryMap(): void {
  window.memoryMap.clear();
}

/**
 * Get content value by ID
 */
export function getContentById(id: string): string | null {
  for (const [value, data] of window.memoryMap) {
    if (data.ids.has(id)) {
      return value;
    }
  }
  return null;
}
