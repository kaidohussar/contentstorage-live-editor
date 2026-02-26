import { getElementPath, processDomChanges, pauseObserver, resumeObserver } from './helpers/mutationObserver';
import { hideContentstorageElementsHighlight } from './helpers/markContentStorageElements';
import { populateFromFlatTranslations } from './helpers/memoryMapUtils';
import { isElementVisible } from './helpers/isElementVisible';
import { setConfig } from './helpers/config';
import {
  fuzzyMatchContent,
  FuzzyMatchResult,
  FuzzyMatchOptions,
  PotentialCandidate,
} from './helpers/fuzzyMatching';

export type { FuzzyMatchResult, FuzzyMatchOptions, PotentialCandidate };

// IDs of our own UI elements to exclude from navigation discovery
const CONTENTSTORAGE_UI_ELEMENT_IDS = [
  'contentstorage-element-label',
  'contentstorage-element-button',
  'contentstorage-element-image-wrapper',
  'contentstorage-element-input-wrapper',
  'contentstorage-screenshot-button',
];

export type NavigableElementType = 'link' | 'button' | 'tab' | 'menuitem' | 'submit' | 'other';

export interface NavigableElement {
  type: NavigableElementType;
  text: string;
  href: string | null;
  ariaLabel: string | null;
  elementPath: string;
  tagName: string;
}

export interface ScanOptions {
  candidateThreshold?: number;
}

/**
 * Determine the navigable element type based on tag name and ARIA role
 */
function getNavigableType(element: HTMLElement): NavigableElementType {
  const tag = element.tagName.toUpperCase();
  const role = element.getAttribute('role');

  if (tag === 'A' || role === 'link' || role === 'menuitemlink') {
    return 'link';
  }
  if (role === 'tab') {
    return 'tab';
  }
  if (role === 'menuitem') {
    return 'menuitem';
  }
  if (tag === 'INPUT' && (element as HTMLInputElement).type === 'submit') {
    return 'submit';
  }
  if (tag === 'BUTTON' || role === 'button' || (tag === 'INPUT' && (element as HTMLInputElement).type === 'button')) {
    return 'button';
  }

  return 'other';
}

/**
 * Get the visible text content of an element, excluding hidden children
 */
function getVisibleText(element: HTMLElement): string {
  return (element.textContent || '').trim();
}

/**
 * Check if element is one of our own UI elements
 */
function isOwnUIElement(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    if (current.id && CONTENTSTORAGE_UI_ELEMENT_IDS.includes(current.id)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Get the href from an element (supports a[href] and data-href)
 */
function getHref(element: HTMLElement): string | null {
  if (element.tagName === 'A') {
    return (element as HTMLAnchorElement).href || null;
  }
  return element.getAttribute('data-href') || null;
}

/**
 * Find all navigable elements on the page
 */
function getNavigableElements(): NavigableElement[] {
  const selector = [
    'a[href]',
    'button:not(:disabled)',
    '[role="link"]',
    '[role="button"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="menuitemlink"]',
    'input[type="submit"]:not(:disabled)',
    'input[type="button"]:not(:disabled)',
    '[data-href]',
    'summary',
    '[onclick]',
  ].join(', ');

  const elements = document.querySelectorAll<HTMLElement>(selector);
  const results: NavigableElement[] = [];
  const seen = new Set<HTMLElement>();

  elements.forEach((element) => {
    // Deduplicate (same element can match multiple selectors)
    if (seen.has(element)) return;
    seen.add(element);

    // Skip our own UI elements
    if (isOwnUIElement(element)) return;

    // Skip hidden elements
    if (!isElementVisible(element)) return;

    // Check bounding rect for zero-size elements
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const text = getVisibleText(element);
    const ariaLabel = element.getAttribute('aria-label') || null;

    // Skip elements with no text and no aria-label
    if (!text && !ariaLabel) return;

    results.push({
      type: getNavigableType(element),
      text,
      href: getHref(element),
      ariaLabel,
      elementPath: getElementPath(element),
      tagName: element.tagName,
    });
  });

  return results;
}

/**
 * Check if the page has the ContentStorage SDK/plugin loaded.
 * Detects by checking for SDK-specific globals set before agent mode.
 */
function hasPlugin(): boolean {
  // __contentstorageRefresh is set by the SDK's i18next plugin
  if (typeof window.__contentstorageRefresh === 'function') {
    return true;
  }
  // __contentstorageAPI is set by the browser-script (not agent mode)
  if (window.__contentstorageAPI) {
    return true;
  }
  return false;
}

export interface AgentAPI {
  setTranslations: (lang: string, translations: Record<string, string>) => void;
  clearTranslations: () => void;
  scanAndAnnotate: (options?: ScanOptions) => FuzzyMatchResult[];
  getVisibleContent: (options?: ScanOptions) => FuzzyMatchResult[];
  clearAnnotations: () => void;
  enableHighlighting: () => void;
  disableHighlighting: () => void;
  getNavigableElements: () => NavigableElement[];
  getLanguageCode: () => string | null;
  getMemoryMapSize: () => number;
  hasPlugin: () => boolean;
}

/**
 * Initialize the agent API and expose it on window.__contentstorageAgentAPI
 */
export function initAgentAPI(): void {
  const api: AgentAPI = {
    setTranslations(lang: string, translations: Record<string, string>) {
      window.currentLanguageCode = lang;
      populateFromFlatTranslations(translations);
    },

    clearTranslations() {
      window.memoryMap.clear();
      window.currentLanguageCode = null;
    },

    scanAndAnnotate(options?: ScanOptions): FuzzyMatchResult[] {
      // Run matching — populates memoryMap aliases for pattern matches
      const fuzzyResults = fuzzyMatchContent({
        candidateThreshold: options?.candidateThreshold,
      });

      // Apply highlighting using enriched memoryMap (aliases make exact matching work)
      processDomChanges();

      return fuzzyResults;
    },

    getVisibleContent(options?: ScanOptions): FuzzyMatchResult[] {
      return fuzzyMatchContent({
        candidateThreshold: options?.candidateThreshold,
      });
    },

    clearAnnotations() {
      hideContentstorageElementsHighlight();
    },

    enableHighlighting() {
      setConfig({ highlightEditableContent: true });
      resumeObserver();
    },

    disableHighlighting() {
      hideContentstorageElementsHighlight();
      setConfig({ highlightEditableContent: false });
      pauseObserver();
    },

    getNavigableElements,

    getLanguageCode() {
      return window.currentLanguageCode;
    },

    getMemoryMapSize() {
      return window.memoryMap?.size || 0;
    },

    hasPlugin,
  };

  window.__contentstorageAgentAPI = api;
  console.log('[Live editor] Agent API initialized on window.__contentstorageAgentAPI');
}