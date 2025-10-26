# Content Storage Live Editor

A TypeScript-based live editor script that runs inside iframes to enable real-time content identification, highlighting, and editing capabilities for Content Management Systems.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)

## What It Does

Content Storage Live Editor is an embedded iframe script that transforms any webpage into an interactive content editing interface. When loaded, it automatically scans the page to identify all editable content (text, images, input placeholders), wraps each piece with a unique identifier, and adds visual indicators (blue labels showing content IDs and edit buttons). When users click an edit button, the script communicates with the parent window via postMessage to trigger editing workflows. It continuously monitors the page for changes using MutationObserver, supports dynamic content with variable templates like `{name}` or `{days}`, can preview pending changes before publishing, and includes smart screenshot capabilities that automatically hide edit buttons while keeping labels visible for documentation purposes.

## Dependencies

**Runtime:**
- `modern-screenshot` (^4.6.6) - Screenshot capture
- `tslib` (^2.8.1) - TypeScript helpers

**Dev:**
- TypeScript (^5.8.3), Rollup (^4.41.0), Babel (^7.27+), ESLint (^9.26.0), Prettier (^3.5.3)

## Use Cases

Used for Contentstorage CMS preview iframes.

## License

ISC

---

**Repository:** [github.com/kaidohussar/contentstorage-live-editor](https://github.com/kaidohussar/contentstorage-live-editor)
