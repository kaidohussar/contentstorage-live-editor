# Content Storage Live Editor

A TypeScript-based live editor script that runs inside iframes to enable real-time content identification, highlighting, and editing capabilities for Translation Management Systems.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)

## Scripts

This repository produces two scripts:

| Script | Size | Format | Purpose |
|--------|------|--------|---------|
| `live-editor.js` | ~100KB | ES Module | Full live editor with highlighting, edit buttons, screenshots |
| `browser-script.js` | ~2KB gzipped | IIFE | Lightweight script for receiving translations via postMessage |

## Live Editor Usage

The live editor script provides the visual editing interface with content highlighting, edit buttons, and screenshot capabilities.

### Prerequisites

The live editor requires `window.memoryMap` to be populated before it can match DOM content to translation keys. This can be done via:
- **browser-script.js** (recommended) - Automatically receives translations via postMessage
- **i18next-contentstorage plugin** - For i18next-based applications
- **Manual population** - Directly setting `window.memoryMap`

### Loading

The script must be loaded with the `contentstorage-live-editor` query parameter:

```html
<script src="https://cdn.contentstorage.app/live-editor.js?contentstorage-live-editor=true"></script>
```

### Modes

1. **Iframe Mode**: When running inside an iframe, initiates handshake with parent window
2. **Standalone Screenshot Mode**: When `?contentstorage_screenshot_mode=true` is in the page URL, enables screenshot-only mode with a camera button

### Message Protocol

#### Live Editor to Parent

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `contentstorage-handshake-initiate` | `string` | Initiates communication handshake |
| `contentstorage-found-content-nodes` | `{ contentNodes: ContentNode[] }` | Reports discovered content elements |
| `contentstorage-click-item-edit-btn` | `{ contentKey: string }` | User clicked edit button on content |
| `contentstorage-screenshot-response` | `ScreenshotResponsePayload` | Screenshot capture result |

#### Parent to Live Editor

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `parent-handshake-acknowledge` | `{ data: { config: LiveEditorConfig } }` | Acknowledges handshake with initial config |
| `contentstorage-set-config` | `LiveEditorConfig` | Update editor configuration |
| `contentstorage-set-highlight-content` | - | Show content highlighting |
| `contentstorage-set-hide-highlight-content` | - | Hide content highlighting |
| `contentstorage-show-element-highlight` | `{ contentKey: string }` | Highlight specific element |
| `contentstorage-hide-element-highlight` | `{ contentKey: string }` | Hide specific element highlight |
| `contentstorage-show-pending-changes` | `PendingChangeSimple[]` | Preview pending content changes |
| `contentstorage-show-original-content` | - | Revert to original content |
| `contentstorage-request-screenshot` | `{ quality?: number }` | Request screenshot capture |

### ContentNode Type

```typescript
type ContentNode =
  | { type: 'text'; contentKey: string[]; text: string; elementPath: string }
  | { type: 'image'; contentKey: string[]; url: string; altText: string };
```

### LiveEditorConfig Type

```typescript
type LiveEditorConfig = {
  highlightEditableContent?: boolean;  // Show blue outlines and edit buttons
  showPendingChanges?: boolean;        // Display pending content changes
};
```

### Example: Parent App Handshake

```javascript
const iframe = document.getElementById('preview-iframe');

window.addEventListener('message', (event) => {
  if (event.data.type === 'contentstorage-handshake-initiate') {
    // Acknowledge handshake
    iframe.contentWindow.postMessage({
      type: 'parent-handshake-acknowledge',
      payload: {
        data: {
          config: {
            highlightEditableContent: true,
            showPendingChanges: false
          }
        }
      }
    }, '*');
  }

  if (event.data.type === 'contentstorage-found-content-nodes') {
    // Handle discovered content
    console.log('Found content:', event.data.payload.contentNodes);
  }

  if (event.data.type === 'contentstorage-click-item-edit-btn') {
    // Open editor for this content
    console.log('Edit:', event.data.payload.contentKey);
  }
});
```

---

### How It Works

1. **Detection**: The script detects when running inside the Contentstorage live editor (iframe + `?contentstorage_live_editor=true` query param)
2. **Communication**: It receives translations from the parent app via postMessage
3. **Memory Map**: Translations are stored in `window.memoryMap` for the live editor to match DOM content
4. **Live Editor**: Automatically loads `live-editor.js` when translations are received

### Message Protocol

#### Script to Parent

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `contentstorage-script-ready` | `{ version: "1.0.0" }` | Sent when script initializes |
| `contentstorage-request-translations` | `{}` | Request translations from parent |

#### Parent to Script

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `contentstorage-translations` | `{ languageCode: string, translations: Record<string, string> }` | Initial translations |
| `contentstorage-language-change` | `{ languageCode: string, translations: Record<string, string> }` | Language switched |
| `contentstorage-translation-update` | `{ key: string, value: string, oldValue: string }` | Single translation updated |

### Example: Parent App Integration

```javascript
const iframe = document.getElementById('preview-iframe');

window.addEventListener('message', (event) => {
  if (event.data.type === 'contentstorage-script-ready') {
    // Send translations
    iframe.contentWindow.postMessage({
      type: 'contentstorage-translations',
      payload: {
        languageCode: 'en',
        translations: {
          'greeting': 'Hello, World!',
          'nav.home': 'Home',
          'nav.about': 'About Us',
          'footer.copyright': '© 2024 My Company'
        }
      }
    }, '*');
  }
});
```

### Public API

The script exposes `window.__contentstorageAPI`:

```javascript
// Check if ready
window.__contentstorageAPI.isReady // boolean

// Get script version
window.__contentstorageAPI.version // "1.0.0"

// Get content by translation key
window.__contentstorageAPI.getContentById('greeting') // "Hello, World!"

// Get current language
window.__contentstorageAPI.getLanguageCode() // "en"

// Get number of translations
window.__contentstorageAPI.getMemoryMapSize() // 4

// Manually set translations (for non-iframe use)
window.__contentstorageAPI.setTranslations('en', {
  'greeting': 'Hello!'
})

// Register refresh callback
window.__contentstorageAPI.onRefresh(() => {
  console.log('Translations updated!')
})

// Clear all translations
window.__contentstorageAPI.clear()
```

### Security

The script only accepts messages from trusted origins:
- `https://contentstorage.app`
- `https://*.contentstorage.app`
- `http://localhost:*` (development only)

---

## Global Variables

Both scripts work with these global variables:

| Variable | Type | Description |
|----------|------|-------------|
| `window.memoryMap` | `Map<string, { ids: Set<string>, type: 'text' \| 'image', variables?: Record<string, any> }>` | Maps content values to translation keys |
| `window.currentLanguageCode` | `string \| null` | Current language code |
| `window.__contentstorageRefresh` | `() => void` | Callback triggered on translation updates |
| `window.__contentstorageAPI` | `ContentStorageAPI` | Public API (browser-script only) |

---

## Development

### Commands

```bash
# Build both scripts
npm run build

# Type check
npx tsc --noEmit

# Lint
npx eslint .
```

### Build Output

```
dist/
├── live-editor.js      # ES module, full editor
├── browser-script.js   # IIFE, lightweight bridge
└── types/              # TypeScript declarations
```

## Dependencies

**Runtime:**
- `modern-screenshot` (^4.6.6) - Screenshot capture
- `tslib` (^2.8.1) - TypeScript helpers

**Dev:**
- TypeScript (^5.8.3), Rollup (^4.41.0), Babel (^7.27+), ESLint (^9.26.0), Prettier (^3.5.3)

## Use Cases

Used for Contentstorage TMS preview iframes.

## License

ISC

---

**Repository:** [github.com/kaidohussar/contentstorage-live-editor](https://github.com/kaidohussar/contentstorage-live-editor)
