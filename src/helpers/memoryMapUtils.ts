/**
 * Sort content keys by prefix frequency among visible keys on the page.
 * Uses the first "." as namespace separator.
 * Best candidate (most common prefix) is first in the returned array.
 *
 * @param allKeys - All candidate content keys for a match
 * @param contextKeys - Keys already assigned on the page (provides prefix frequency context)
 * @returns Sorted array of keys, best candidate first
 */
export function sortKeysByPageContext(
  allKeys: string[],
  contextKeys: Iterable<string>
): string[] {
  if (allKeys.length <= 1) return allKeys;

  // Build prefix frequency map from context keys
  const prefixCounts = new Map<string, number>();
  for (const key of contextKeys) {
    const dotIndex = key.indexOf('.');
    const prefix = dotIndex > 0 ? key.substring(0, dotIndex) : key;
    prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
  }

  // Sort keys by prefix frequency (most common first), stable sort preserves original order for ties
  return [...allKeys].sort((a, b) => {
    const dotA = a.indexOf('.');
    const dotB = b.indexOf('.');
    const prefixA = dotA > 0 ? a.substring(0, dotA) : a;
    const prefixB = dotB > 0 ? b.substring(0, dotB) : b;
    return (prefixCounts.get(prefixB) || 0) - (prefixCounts.get(prefixA) || 0);
  });
}

const MAX_MEMORY_MAP_ENTRIES = 10_000;

/**
 * Populate memoryMap from flat translations object.
 * Transforms {"greeting": "Hello"} → Map { "Hello" => { ids: Set(["greeting"]), type: "text" } }
 */
export function populateFromFlatTranslations(
  translations: Record<string, string>
): void {
  const entries = Object.entries(translations);

  if (entries.length > MAX_MEMORY_MAP_ENTRIES) {
    console.warn(
      `[Contentstorage] Truncated translations from ${entries.length} to ${MAX_MEMORY_MAP_ENTRIES} entries`
    );
  }

  const limitedEntries = entries.slice(0, MAX_MEMORY_MAP_ENTRIES);

  // Clear existing entries
  window.memoryMap.clear();

  // Group by value (template text) - multiple keys can share the same value
  for (const [key, value] of limitedEntries) {
    const existing = window.memoryMap.get(value);

    if (existing) {
      existing.ids.add(key);
    } else {
      window.memoryMap.set(value, {
        ids: new Set([key]),
        type: 'text',
      });
    }
  }

  console.log(
    `[Contentstorage] Populated memoryMap with ${window.memoryMap.size} entries from ${limitedEntries.length} translations`
  );
}
