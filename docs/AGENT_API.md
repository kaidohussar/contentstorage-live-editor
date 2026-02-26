# Agent API Reference

The Agent API is exposed on `window.__contentstorageAgentAPI` when the live-editor script is loaded with `?agent-mode=true`.

## Setup

```javascript
// Inject the live-editor script with agent mode enabled
await page.addScriptTag({
  url: 'https://cdn.contentstorage.app/live-editor.js?contentstorage-live-editor=true&agent-mode=true'
});
```

## Functions

### Content Management

#### `setTranslations(lang, translations)`
Populate memoryMap with content key-to-text mappings and set the active language.

```javascript
await page.evaluate(() => {
  window.__contentstorageAgentAPI.setTranslations('EN', {
    'greeting_key': 'Hello World',
    'cta_key': 'Sign up now',
    'nav_home': 'Home',
  });
});
```

| Param | Type | Description |
|-------|------|-------------|
| `lang` | `string` | Language code (e.g., `'EN'`, `'DE'`) |
| `translations` | `Record<string, string>` | Map of content key ID to text value |

#### `clearTranslations()`
Clear all translations from memoryMap and reset language code.

```javascript
await page.evaluate(() => {
  window.__contentstorageAgentAPI.clearTranslations();
});
```

---

### Scanning & Annotation

Both `scanAndAnnotate` and `getVisibleContent` support template pattern matching via an options object. Matching uses a deterministic pipeline: exact match, template rendering with known variables, and regex pattern matching for variable placeholders.

#### `scanAndAnnotate(options?)` -> `FuzzyMatchResult[]`
Scan the DOM, match text against memoryMap (with fuzzy matching), apply visual annotations (blue outlines + key labels), and return results. Use Playwright's `page.screenshot()` after this to capture the annotated page.

```javascript
const results = await page.evaluate(() => {
  return window.__contentstorageAgentAPI.scanAndAnnotate({
    candidateThreshold: 0.80,  // Min similarity for candidates (default: 0.80)
  });
});
await page.screenshot({ path: 'annotated.png', fullPage: true });
```

| Param | Type | Description |
|-------|------|-------------|
| `options.candidateThreshold` | `number` | Min similarity score (0-1) for potential candidates. Default: `0.80` |

#### `getVisibleContent(options?)` -> `FuzzyMatchResult[]`
Scan the DOM and return matched content **without** modifying the page. Pure data query -- no visual changes.

```javascript
const results = await page.evaluate(() => {
  return window.__contentstorageAgentAPI.getVisibleContent();
});
```

#### Return type: `FuzzyMatchResult`

```typescript
interface FuzzyMatchResult {
  text: string;                          // DOM text (what's on the page)
  elementPath: string;                   // CSS selector path to the element
  matchedKeys: string[];                 // All matching content keys, sorted best-first by prefix frequency
  matchedTranslation: string | null;     // The translation text/template that matched
  matchScore: number;                    // Similarity score (0-1, 1 = exact)
  potentialCandidates: PotentialCandidate[];  // Other close matches below threshold
}

interface PotentialCandidate {
  contentKey: string;
  text: string;    // The translation text
  score: number;   // Similarity score 0-1
}
```

**Duplicate translation handling:**
When multiple content keys map to the same text, `matchedKeys` contains ALL matching keys sorted best-first. The best candidate is determined by prefix frequency: keys whose namespace prefix (before the first `.`) appears most often among other matched keys on the page are ranked higher.

**Visual indicators:**
- **Blue outline** (`#1791FF`): unambiguous match (single content key)
- **Orange outline** (`#FF9800`): ambiguous match (multiple content keys for the same text)

**How matching works (deterministic 3-step pipeline):**
1. **Exact match** — O(1) hashmap lookup against memoryMap → score 1.0
2. **Template exact match** — render templates with known variables (e.g., `"Hello {{name}}"` with `name="John"` → `"Hello John"`) → score 1.0
3. **Template pattern match** — convert `{{var}}` placeholders to regex patterns (e.g., `"Hello {{name}}"` → `/^Hello (.+?)$/`) and test DOM text → score 1.0

All primary matches are deterministic (100% or no match). For unmatched DOM text, potential candidates are discovered from variable-containing templates, scored by what fraction of their static text appears in the DOM text. Candidates with score >= `candidateThreshold` are included as `potentialCandidates`.

#### `clearAnnotations()`
Remove all visual highlights (outlines, labels, edit buttons) from the page.

```javascript
await page.evaluate(() => {
  window.__contentstorageAgentAPI.clearAnnotations();
});
```

---

### Navigation Discovery

#### `getNavigableElements()` -> `NavigableElement[]`
Find all clickable/navigable elements on the page. Useful for the agent to decide where to navigate next.

```javascript
const elements = await page.evaluate(() => {
  return window.__contentstorageAgentAPI.getNavigableElements();
});
```

**Returns:** Array of `NavigableElement`:
```typescript
interface NavigableElement {
  type: 'link' | 'button' | 'tab' | 'menuitem' | 'submit' | 'other';
  text: string;           // Visible text label
  href: string | null;    // Link destination (if applicable)
  ariaLabel: string | null;
  elementPath: string;    // CSS selector path
  tagName: string;        // e.g., 'A', 'BUTTON'
}
```

**Discovered elements include:**
- `a[href]` -- Standard links
- `button` -- Buttons (excluding disabled)
- `[role="link"]`, `[role="button"]`, `[role="tab"]`, `[role="menuitem"]` -- ARIA elements
- `input[type="submit"]`, `input[type="button"]` -- Form buttons
- `[data-href]` -- Custom link attributes
- `summary` -- Collapsible toggles
- `[onclick]` -- Elements with click handlers

**Filtering applied:**
- Hidden elements excluded
- Zero-size elements excluded
- Elements with no text and no aria-label excluded
- Internal UI elements (our highlights/buttons) excluded

---

### Utility

#### `getLanguageCode()` -> `string | null`
Returns the currently set language code.

#### `getMemoryMapSize()` -> `number`
Returns the number of entries in the memoryMap.

#### `hasPlugin()` -> `boolean`
Check if the page has the ContentStorage SDK/plugin loaded (detects `__contentstorageRefresh` or `__contentstorageAPI` globals).

```javascript
const hasPlugin = await page.evaluate(() => {
  return window.__contentstorageAgentAPI.hasPlugin();
});
```

---

## Full Example: Translation Agent Workflow

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1. Navigate to target page
  await page.goto('https://example.com');

  // 2. Inject live-editor in agent mode
  await page.addScriptTag({
    url: 'https://cdn.contentstorage.app/live-editor.js?contentstorage-live-editor=true&agent-mode=true'
  });

  // 3. Check if ContentStorage plugin is already loaded
  const hasPlugin = await page.evaluate(() => {
    return window.__contentstorageAgentAPI.hasPlugin();
  });
  console.log('Plugin detected:', hasPlugin);

  // 4. Set known translations (10k entries)
  await page.evaluate((translations) => {
    window.__contentstorageAgentAPI.setTranslations('EN', translations);
  }, translations);

  // 5. Scan with template pattern matching and annotate
  const results = await page.evaluate(() => {
    return window.__contentstorageAgentAPI.scanAndAnnotate({
      candidateThreshold: 0.80,
    });
  });

  // 6. Take annotated screenshot
  await page.screenshot({ path: 'annotated-page.png', fullPage: true });

  // 7. Inspect results
  for (const r of results) {
    if (r.matchedKeys.length > 0) {
      console.log(`Matched: "${r.text}" -> ${r.matchedKeys[0]} (${(r.matchScore * 100).toFixed(1)}%)`);
      if (r.matchedKeys.length > 1) {
        console.log(`  Ambiguous: ${r.matchedKeys.length} keys:`, r.matchedKeys);
      }
    }
    if (r.potentialCandidates.length > 0) {
      console.log(`  Candidates:`, r.potentialCandidates.map(c =>
        `${c.contentKey} "${c.text}" (${(c.score * 100).toFixed(1)}%)`
      ));
    }
  }

  // 8. Discover navigation options
  const navElements = await page.evaluate(() => {
    return window.__contentstorageAgentAPI.getNavigableElements();
  });

  // 9. Navigate to next page and repeat
  const aboutLink = navElements.find(el => el.text === 'About us');
  if (aboutLink?.href) {
    await page.goto(aboutLink.href);
    // Repeat steps 2-8...
  }

  await browser.close();
})();
```
