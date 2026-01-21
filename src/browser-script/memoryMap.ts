import { MAX_MEMORY_MAP_ENTRIES } from './constants';
import { MemoryMapEntry } from './types';

/**
 * Initialize the global memoryMap if it doesn't exist
 */
export function initializeMemoryMap(): void {
  if (!window.memoryMap) {
    window.memoryMap = new Map<string, MemoryMapEntry>();
  }
}

/**
 * Populate memoryMap from flat translations object
 * Transforms {"greeting": "Hello"} → Map { "Hello" => { ids: Set(["greeting"]), type: "text" } }
 */
export function populateFromFlatTranslations(
  translations: Record<string, string>
): void {
  const entries = Object.entries(translations);

  // Enforce entry limit for performance
  if (entries.length > MAX_MEMORY_MAP_ENTRIES) {
    console.warn(
      `[ContentStorage] Truncated translations from ${entries.length} to ${MAX_MEMORY_MAP_ENTRIES} entries`
    );
  }

  const limitedEntries = entries.slice(0, MAX_MEMORY_MAP_ENTRIES);

  // Clear existing entries
  window.memoryMap.clear();

  // Group by value (template text) - multiple keys can share the same value
  for (const [key, value] of limitedEntries) {
    const existing = window.memoryMap.get(value);

    if (existing) {
      // Add key to existing entry
      existing.ids.add(key);
    } else {
      // Create new entry
      window.memoryMap.set(value, {
        ids: new Set([key]),
        type: 'text',
      });
    }
  }

  console.log(
    `[ContentStorage] Populated memoryMap with ${window.memoryMap.size} entries from ${limitedEntries.length} translations`
  );
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
