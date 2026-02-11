import { isElementVisible } from './isElementVisible';

// IDs of our own UI elements that should be excluded from content detection
const CONTENTSTORAGE_UI_ELEMENT_IDS = [
  'contentstorage-element-label',
  'contentstorage-element-button',
  'contentstorage-element-image-wrapper',
  'contentstorage-element-input-wrapper',
];

// Minimum text length to be considered meaningful content
const MIN_TEXT_LENGTH = 2;

/**
 * Checks if text is likely dynamic/non-translatable content
 * Examples: "65%", "$45,234", "2,845", "+12.5%", "3", "JD"
 */
const isDynamicContent = (text: string): boolean => {
  const trimmed = text.trim();

  // Pure numbers (with optional thousand separators)
  if (/^[\d,.\s]+$/.test(trimmed)) {
    return true;
  }

  // Currency values: $45,234, €100, £50.00
  if (/^[$€£¥₹]\s*[\d,.\s]+$/.test(trimmed) || /^[\d,.\s]+\s*[$€£¥₹]$/.test(trimmed)) {
    return true;
  }

  // Percentages: 65%, +12.5%, -2.1%
  if (/^[+-]?[\d,.\s]+%$/.test(trimmed)) {
    return true;
  }

  // Time ago patterns: "2 minutes ago", "1 hour ago"
  if (/^\d+\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i.test(trimmed)) {
    return true;
  }

  // Initials/abbreviations: "JD", "SJ", "AC" (2-3 uppercase letters)
  if (/^[A-Z]{2,3}$/.test(trimmed)) {
    return true;
  }

  return false;
};

/**
 * Checks if element or any ancestor is one of our UI elements
 */
const isContentStorageUIElement = (element: HTMLElement | null): boolean => {
  let current = element;
  while (current && current !== document.body) {
    if (current.id && CONTENTSTORAGE_UI_ELEMENT_IDS.includes(current.id)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const isEditableOrInsideEditable = (element: HTMLElement | null): boolean => {
  if (!element) {
    return false;
  }
  if (element.isContentEditable) {
    return true;
  }
  return isEditableOrInsideEditable(element.parentElement);
};

export const findContentNodesInPage = (): Node[] => {
  const textNodes: Node[] = [];
  // Define unsupported tags.
  const isUnsupported = (element: HTMLElement): boolean =>
    element instanceof HTMLScriptElement ||
    element instanceof HTMLStyleElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLOptionElement ||
    element.tagName === 'NOSCRIPT';

  // Perform check for editable elements once for performance.
  const hasEditableElements = !!document.querySelector(
    '[contenteditable="true"]'
  );

  const treeWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;

          const isImg = element.tagName === 'IMG';
          const isInputWithPlaceholder =
            element.tagName === 'INPUT' &&
            ((element as HTMLInputElement).placeholder?.trim() ||
              element.getAttribute('aria-label')?.trim());

          if (isImg || isInputWithPlaceholder) {
            // We apply a set of checks similar to what's done for text node parents.

            // Skip our own UI elements (labels, buttons, wrappers)
            if (isContentStorageUIElement(element)) {
              return NodeFilter.FILTER_REJECT;
            }

            // Check the element and its ancestors for 'data-content-checked'
            let currentAncestor: HTMLElement | null = element;
            while (currentAncestor && currentAncestor !== document.body) {
              if (currentAncestor.hasAttribute('data-content-checked')) {
                return NodeFilter.FILTER_REJECT;
              }
              currentAncestor = currentAncestor.parentElement;
            }

            if (isUnsupported(element)) {
              return NodeFilter.FILTER_REJECT;
            }

            if (!isElementVisible(element)) {
              return NodeFilter.FILTER_REJECT;
            }

            // Skip if inside a content-editable element.
            if (hasEditableElements && isEditableOrInsideEditable(element)) {
              return NodeFilter.FILTER_REJECT;
            }

            return NodeFilter.FILTER_ACCEPT;
          }

          // For other elements, we just want to traverse them.
          return NodeFilter.FILTER_SKIP;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          const textContent = node.textContent?.trim();
          if (!textContent) {
            return NodeFilter.FILTER_SKIP;
          }

          // Skip text that's too short to be meaningful
          if (textContent.length < MIN_TEXT_LENGTH) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip dynamic/non-translatable content (numbers, percentages, currency, etc.)
          if (isDynamicContent(textContent)) {
            return NodeFilter.FILTER_REJECT;
          }

          const parent = node.parentElement;
          if (!parent) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip our own UI elements (labels, buttons, wrappers)
          if (isContentStorageUIElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          let currentAncestor: HTMLElement | null = parent;
          while (currentAncestor && currentAncestor !== document.body) {
            if (currentAncestor.hasAttribute('data-content-checked')) {
              return NodeFilter.FILTER_REJECT; // Skip text nodes within these ancestors
            }
            currentAncestor = currentAncestor.parentElement;
          }

          if (isUnsupported(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          if (!isElementVisible(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip if inside a content-editable element.
          if (hasEditableElements && isEditableOrInsideEditable(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  let currentNode;
  while ((currentNode = treeWalker.nextNode())) {
    textNodes.push(currentNode);
  }

  return textNodes;
};
