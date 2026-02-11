import { findContentNodesInPage } from './domTreeWalker';
import { sendMessageToParent } from './sendMessageToParent';
import { ContentNode, OUTGOING_MESSAGE_TYPES } from '../contants';
import { getConfig } from './config';
import {
  markContentStorageElements,
  showPendingChanges,
} from './markContentStorageElements';
import { getPendingChanges, throttle } from './misc';
import { renderTemplate } from './variableMatching';
import { normalizeWhitespace, stripHtmlTags } from './htmlUtils';
import { detectPageLanguage } from './detectLanguage';

// Module-level observer reference for pause/resume control
let observerInstance: MutationObserver | null = null;
let isObserving = false;

function isInternalWrapper(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  const element = node as HTMLElement;
  // Check for the highlight span OR the "checked" span
  return (
    element.hasAttribute('data-content-key') ||
    element.hasAttribute('data-content-checked')
  );
}

/**
 * Gets clean text content from an element, excluding our UI elements (labels, buttons, wrappers)
 * This prevents contamination of text content by our own UI additions
 */
function getCleanTextContent(element: HTMLElement | null): string {
  if (!element) return '';

  const IGNORED_IDS = [
    'contentstorage-element-label',
    'contentstorage-element-button',
    'contentstorage-element-image-wrapper',
    'contentstorage-element-input-wrapper'
  ];

  let textContent = '';

  const collectText = (node: Node): void => {
    // Skip our UI elements
    if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement;
      if (elem.id && IGNORED_IDS.includes(elem.id)) {
        return; // Skip this element and its children
      }
    }

    // Collect text from text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      textContent += node.textContent || '';
    }

    // Recursively process child nodes
    node.childNodes.forEach(collectText);
  };

  collectText(element);
  return textContent;
}

/**
 * Generates a unique CSS selector path for an element
 * Returns a path like: "div#sidebar > nav > ul > li:nth-of-type(2) > a"
 */
function getElementPath(element: Element | null): string {
  if (!element) return '';

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    // Add id if present (makes it unique)
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break; // ID is unique, no need to go further up
    }

    // Add nth-of-type for uniqueness among siblings of same tag
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Finds and processes content nodes from the DOM
 * Returns structured content ready for sending to parent or highlighting
 */
function findAndProcessNodes(): { structuredContent: ContentNode[], detectedLanguage: string | null } {
  const nodes = findContentNodesInPage();

  // Track processed parent elements to avoid duplicates when text nodes are fragmented by HTML tags
  const processedParents = new Set<HTMLElement>();

  // Log memoryMap content for debugging
  console.log('[Live editor] memoryMap content:', {
    size: window.memoryMap?.size || 0,
    entries: Array.from(window.memoryMap?.entries() || []).map(([key, value]) => ({
      template: key,
      ids: Array.from(value.ids),
      type: value.type,
      variables: value.variables,
    })),
  });

  if (nodes.length === 0) {
    return { structuredContent: [], detectedLanguage: null };
  }

  // Track which content IDs have been assigned to DOM elements
  // This ensures each DOM element gets a unique ID when multiple IDs share the same text
  const assignedIds = new Set<string>();

  const structuredContent = nodes
    .map((node): ContentNode | null => {
      // Check if it's a Text node with content
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        // Skip if we've already processed this parent element
        if (node.parentElement && processedParents.has(node.parentElement)) {
          return null;
        }

        let content = window.memoryMap?.get(node.textContent);
        let matchedTemplateText = node.textContent; // Track the template text

        // If direct lookup fails, try exact matching with renderTemplate using parent's textContent
        if (!content && node.parentElement) {
          const parentText = getCleanTextContent(node.parentElement).trim();
          if (parentText) {
            const normalizedParentText = normalizeWhitespace(parentText);

            // Search through all templates and do exact matching
            for (const [templateText, contentData] of window.memoryMap) {
              // Render template (handles variables + HTML stripping + whitespace normalization)
              const rendered = renderTemplate(templateText, contentData.variables);

              // Exact comparison using parent's combined text
              if (rendered === normalizedParentText) {
                content = contentData;
                matchedTemplateText = templateText; // Store the matched template
                // Mark this parent as processed to avoid duplicate matches
                processedParents.add(node.parentElement);
                break;
              }
            }
          }
        }

        const isShowingPendingChange = node.parentElement?.getAttribute(
          'data-content-showing-pending-change'
        );

        if (isShowingPendingChange) {
          const contentId =
            node.parentElement?.getAttribute('data-content-key') || '';
          Array.from(window.memoryMap).forEach((mapEntry) => {
            if (mapEntry[1].ids.has(contentId)) {
              content = mapEntry[1];
            }
          });
        }

        const keys = Array.from(content?.ids || []);

        // In standalone mode, report nodes even without keys - parent will match via API
        // In SDK mode, skip nodes without matching content keys
        if (keys.length === 0 && !window.isStandaloneMode) {
          return null;
        }

        // Find the first unclaimed ID, or fall back to first ID if all are claimed
        const availableKey = keys.length > 0
          ? (keys.find(k => !assignedIds.has(k)) || keys[0])
          : null;
        if (availableKey) {
          assignedIds.add(availableKey);
        }

        const data: ContentNode = {
          type: 'text',
          text: stripHtmlTags(matchedTemplateText),
          contentKey: availableKey ? [availableKey] : [],
          elementPath: getElementPath(node.parentElement),
        };

        return data;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;

        if (element.tagName === 'IMG') {
          const imgElement = element as HTMLImageElement;

          const keys = Array.from(
            window.memoryMap?.get(imgElement.src)?.ids || []
          );

          // In standalone mode, report images even without keys - parent will match via API
          // In SDK mode, skip images without matching content keys
          if (keys.length === 0 && !window.isStandaloneMode) {
            return null;
          }

          // Find the first unclaimed ID, or fall back to first ID if all are claimed
          const availableKey = keys.length > 0
            ? (keys.find(k => !assignedIds.has(k)) || keys[0])
            : null;
          if (availableKey) {
            assignedIds.add(availableKey);
          }

          return {
            type: 'image',
            url: imgElement.src,
            altText: imgElement.alt,
            contentKey: availableKey ? [availableKey] : [],
          };
        }

        if (element.tagName === 'INPUT') {
          const inputElement = element as HTMLInputElement;
          const contentValue =
            inputElement.placeholder?.trim() ||
            inputElement.getAttribute('aria-label')?.trim();

          if (!contentValue) {
            return null;
          }

          let content = window.memoryMap?.get(contentValue);
          let matchedTemplateText = contentValue; // Track the template text

          // If direct lookup fails, try exact matching with renderTemplate
          if (!content) {
            const normalizedValue = normalizeWhitespace(contentValue);

            // Search through all templates and do exact matching
            for (const [templateText, contentData] of window.memoryMap) {
              const rendered = renderTemplate(templateText, contentData.variables);

              if (rendered === normalizedValue) {
                content = contentData;
                matchedTemplateText = templateText; // Store the matched template
                break;
              }
            }
          }

          const keys = Array.from(content?.ids || []);

          // In standalone mode, report inputs even without keys - parent will match via API
          // In SDK mode, skip inputs without matching content keys
          if (keys.length === 0 && !window.isStandaloneMode) {
            return null;
          }

          // Find the first unclaimed ID, or fall back to first ID if all are claimed
          const availableKey = keys.length > 0
            ? (keys.find(k => !assignedIds.has(k)) || keys[0])
            : null;
          if (availableKey) {
            assignedIds.add(availableKey);
          }

          const data: ContentNode = {
            type: 'text',
            text: stripHtmlTags(matchedTemplateText),
            contentKey: availableKey ? [availableKey] : [],
            elementPath: getElementPath(inputElement),
          };

          return data;
        }
      }

      // Return null for any nodes we want to ignore
      return null;
    })
    .filter(Boolean) as ContentNode[];

  // Detect language for standalone mode - helps parent match texts to correct language content
  const detectedLanguage = window.isStandaloneMode ? detectPageLanguage() : null;

  return { structuredContent, detectedLanguage };
}

/**
 * Applies highlighting to content elements
 * This is an internal helper used by both processDomChanges and refreshHighlighting
 */
function applyHighlighting(structuredContent: ContentNode[]) {
  const shouldHighlight = getConfig().highlightEditableContent;
  const shouldShowPendingChanges = getConfig().showPendingChanges;
  const highlight = shouldHighlight === undefined ? true : shouldHighlight;

  markContentStorageElements(structuredContent, highlight);

  if (shouldShowPendingChanges) {
    showPendingChanges(getPendingChanges());
  }
}

/**
 * Full DOM processing: finds nodes, sends to parent, and applies highlighting
 * Used by MutationObserver for real DOM changes
 *
 * In standalone mode (browser script without SDK), this function should NOT be called
 * automatically on DOM mutations. Instead, highlighting is applied only after
 * SET_CONTENT_KEYS message provides content keys from AI analysis.
 */
export function processDomChanges() {
  // In standalone mode, still apply highlighting but don't send content nodes
  // This allows existing memoryMap entries to highlight content after page navigation
  if (window.isStandaloneMode) {
    console.log('[Live editor] Standalone mode - applying highlighting without sending nodes');
    refreshHighlighting();
    return;
  }

  try {
    const { structuredContent, detectedLanguage } = findAndProcessNodes();

    if (structuredContent.length > 0) {
      // Send nodes to parent
      console.log('[Live editor] Sending nodes to parent:', structuredContent, 'language:', detectedLanguage);
      sendMessageToParent(OUTGOING_MESSAGE_TYPES.FOUND_CONTENT_NODES, {
        contentNodes: structuredContent,
        language: detectedLanguage,
      });

      // Apply highlighting
      applyHighlighting(structuredContent);

      console.log(
        '[Live editor] Significant mutation detected. Processing and sending text nodes.'
      );
    }
  } catch (error) {
    console.error('Error during DOM processing after mutation:', error);
  }
}

/**
 * Refresh highlighting only - does NOT send nodes to parent
 * Used after receiving SET_CONTENT_KEYS to apply highlighting with new keys
 * Pauses the mutation observer to prevent infinite loops
 */
export function refreshHighlighting(): ContentNode[] {
  try {
    // Pause observer to prevent our DOM changes from triggering it
    pauseObserver();

    const { structuredContent } = findAndProcessNodes();

    if (structuredContent.length > 0) {
      applyHighlighting(structuredContent);
      console.log('[Live editor] Refreshed highlighting without sending nodes');
    }

    // Resume observer after a short delay to let DOM settle
    setTimeout(() => {
      resumeObserver();
    }, 100);

    return structuredContent;
  } catch (error) {
    console.error('Error during highlighting refresh:', error);
    // Make sure to resume observer even on error
    resumeObserver();
    return [];
  }
}

/**
 * Pauses the mutation observer
 */
function pauseObserver() {
  if (observerInstance && isObserving) {
    observerInstance.disconnect();
    isObserving = false;
    console.log('[Live editor] Observer paused');
  }
}

/**
 * Resumes the mutation observer
 */
function resumeObserver() {
  if (observerInstance && !isObserving) {
    observerInstance.observe(document.body, mutationObserverConfig);
    isObserving = true;
    console.log('[Live editor] Observer resumed');
  }
}

/**
 * Sets the observer instance for pause/resume control
 * Called from index.ts after creating the observer
 */
export function setObserverInstance(observer: MutationObserver) {
  observerInstance = observer;
  isObserving = true;
}

const mutationObserverCallbackOriginal: MutationCallback = (
  mutationsList,
  observer
) => {
  let significantMutationDetected = false;

  const ACTUAL_OBSERVED_TARGET_NODE: Node = document.body;
  const IGNORED_ELEMENT_IDS: string[] = [
    'contentstorage-element-label',
    'contentstorage-element-button',
    'contentstorage-element-image-wrapper',
    'contentstorage-element-input-wrapper'
  ];
  const STYLE_RELATED_ATTRIBUTES: string[] = ['style', 'class'];

  const isInternalWrappingBatch = mutationsList.some(
    (mutation) =>
      mutation.type === 'childList' &&
      Array.from(mutation.addedNodes).some(isInternalWrapper)
  );

  for (const mutation of mutationsList) {
    if (mutation.type === 'childList') {
      const isWrapperAddition = Array.from(mutation.addedNodes).some(
        isInternalWrapper
      );
      if (isWrapperAddition) {
        continue;
      }

      // Also check if added nodes are our UI elements by ID
      const isUIElementAddition = Array.from(mutation.addedNodes).some((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const elem = node as HTMLElement;
          return elem.id && IGNORED_ELEMENT_IDS.includes(elem.id);
        }
        return false;
      });
      if (isUIElementAddition) {
        continue;
      }
    }

    if (isInternalWrappingBatch && mutation.type === 'childList') {
      const onlyTextNodesRemoved =
        mutation.removedNodes.length > 0 &&
        mutation.addedNodes.length === 0 &&
        Array.from(mutation.removedNodes).every(
          (node) => node.nodeType === Node.TEXT_NODE
        );

      if (onlyTextNodesRemoved) {
        continue; // Ignore removal of the original text node.
      }
    }

    if (mutation.type === 'attributes') {
      // Skip our own attribute changes
      if (mutation.attributeName?.startsWith('data-content')) {
        continue;
      }
      if (mutation.attributeName === 'data-contentstorage-styled') {
        continue;
      }
      if (mutation.attributeName === 'data-tracked-content-value') {
        continue;
      }
      if (STYLE_RELATED_ATTRIBUTES.includes(mutation.attributeName || '')) {
        const targetElement = mutation.target as HTMLElement;
        if (targetElement.hasAttribute('data-content-key') ||
            targetElement.hasAttribute('data-contentstorage-styled')) {
          continue;
        }
      }
    }

    const nodeToCheckIdPath: Node | null = mutation.target;
    if (nodeToCheckIdPath) {
      let currentElement: HTMLElement | null =
        nodeToCheckIdPath.nodeType === Node.ELEMENT_NODE
          ? (nodeToCheckIdPath as HTMLElement)
          : nodeToCheckIdPath.parentElement;

      let isIgnoredPath = false;
      while (currentElement) {
        if (
          currentElement.id &&
          IGNORED_ELEMENT_IDS.includes(currentElement.id)
        ) {
          isIgnoredPath = true;
          break;
        }
        currentElement = currentElement.parentElement;
      }

      if (isIgnoredPath) {
        continue;
      }
    }

    significantMutationDetected = true;
    break;
  }

  if (significantMutationDetected) {
    observer.disconnect();
    isObserving = false;

    processDomChanges();

    // Reconnect the observer asynchronously.
    Promise.resolve()
      .then(() => {
        observer.observe(ACTUAL_OBSERVED_TARGET_NODE, mutationObserverConfig);
        isObserving = true;
      })
      .catch((promiseError) => {
        console.error('Error re-observing target node:', promiseError);
      });
  }
};

export const mutationObserverCallback = throttle(
  mutationObserverCallbackOriginal,
  1000
);

export const mutationObserverConfig: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
};