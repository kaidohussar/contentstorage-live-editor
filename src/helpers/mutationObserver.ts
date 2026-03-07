import { findContentNodesInPage } from './domTreeWalker';
import { sendMessageToParent } from './sendMessageToParent';
import { ContentNode, AssignmentReason, OUTGOING_MESSAGE_TYPES } from '../contants';
import { getConfig } from './config';
import {
  markContentStorageElements,
  showPendingChanges,
} from './markContentStorageElements';
import { getPendingChanges, throttle } from './misc';
import { renderTemplate } from './variableMatching';
import { normalizeWhitespace, stripHtmlTags } from './htmlUtils';
import { detectPageLanguage } from './detectLanguage';
import { sortKeysByPageContext } from './memoryMapUtils';
import { getElementPath } from './elementPath';
export { getElementPath } from './elementPath';

interface InternalContentEntry {
  contentKey: string[];
  text: string;
  elementPath: string;
  reason?: AssignmentReason;
  domNode: Node;
  parentElement: HTMLElement | null;
}

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
export function getCleanTextContent(element: HTMLElement | null): string {
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
 * Attempts to resolve an ambiguous entry by checking sibling elements
 * at the grandparent level for a dominant key prefix.
 * Returns true if resolved (contentKey reordered), false otherwise.
 */
function trySiblingCorrection(
  entry: InternalContentEntry,
  allEntries: InternalContentEntry[],
  assignedIds: Set<string>
): boolean {
  const grandparent = entry.parentElement?.parentElement;
  if (!grandparent) return false;

  // Collect resolved keys from sibling entries (same grandparent, different entry)
  const siblingKeys: string[] = [];
  for (const other of allEntries) {
    if (other === entry) continue;
    if (other.parentElement?.parentElement !== grandparent) continue;
    if (other.contentKey.length >= 1 &&
        (other.reason === 'single_match' || assignedIds.has(other.contentKey[0]))) {
      siblingKeys.push(other.contentKey[0]);
    }
  }

  if (siblingKeys.length === 0) return false;

  // Count prefixes among sibling keys
  const prefixCounts = new Map<string, number>();
  for (const key of siblingKeys) {
    const dotIndex = key.indexOf('.');
    const prefix = dotIndex > 0 ? key.substring(0, dotIndex) : key;
    prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
  }

  // Find the dominant prefix
  let bestPrefix = '';
  let bestCount = 0;
  for (const [prefix, count] of prefixCounts) {
    if (count > bestCount) {
      bestPrefix = prefix;
      bestCount = count;
    }
  }

  if (!bestPrefix) return false;

  // Check if any candidate key matches the dominant prefix and is not yet assigned
  const candidates = entry.contentKey;
  const matchingIndex = candidates.findIndex(k => {
    const dotIndex = k.indexOf('.');
    const prefix = dotIndex > 0 ? k.substring(0, dotIndex) : k;
    return prefix === bestPrefix && !assignedIds.has(k);
  });

  if (matchingIndex > 0) {
    // Move matching key to front
    const [matched] = candidates.splice(matchingIndex, 1);
    candidates.unshift(matched);
    return true;
  } else if (matchingIndex === 0) {
    // Already in front, confirmed by sibling context
    return true;
  }

  return false;
}

/**
 * Finds and processes content nodes from the DOM
 * Returns structured content ready for sending to parent or highlighting
 */
export function findAndProcessNodes(): { structuredContent: ContentNode[], detectedLanguage: string | null, unmatchedIds: string[] } {
  const nodes = findContentNodesInPage();

  // Track processed parent elements to avoid duplicates when text nodes are fragmented by HTML tags
  const processedAncestors = new Set<HTMLElement>();

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
    return { structuredContent: [], detectedLanguage: null, unmatchedIds: getAllMemoryMapIds() };
  }

  // Track which content IDs have been assigned to DOM elements
  const assignedIds = new Set<string>();

  // Wave 1: Initial assignment (direct/template matching + assignedIds dedup)
  const entries: InternalContentEntry[] = [];

  for (const node of nodes) {
    // Check if it's a Text node with content
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      // Skip if any ancestor was already matched as a whole unit
      let ancestor = node.parentElement;
      let skipNode = false;
      while (ancestor) {
        if (processedAncestors.has(ancestor)) {
          skipNode = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (skipNode) continue;

      let content = window.memoryMap?.get(node.textContent);
      let matchedTemplateText = node.textContent;

      // If direct lookup fails, try exact matching with renderTemplate using parent's textContent
      if (!content && node.parentElement) {
        const parentText = getCleanTextContent(node.parentElement).trim();
        if (parentText) {
          const normalizedParentText = normalizeWhitespace(parentText);

          for (const [templateText, contentData] of window.memoryMap) {
            const rendered = renderTemplate(templateText, contentData.variables);

            if (rendered === normalizedParentText) {
              content = contentData;
              matchedTemplateText = templateText;
              processedAncestors.add(node.parentElement);
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

      if (keys.length === 0 && !window.isStandaloneMode) {
        continue;
      }

      const availableKeys = keys.filter(k => !assignedIds.has(k));
      const contentKeyArr = availableKeys.length > 0 ? availableKeys : (keys.length > 0 ? [keys[0]] : []);

      let reason: AssignmentReason | undefined;
      if (contentKeyArr.length === 1 && contentKeyArr[0]) {
        assignedIds.add(contentKeyArr[0]);
        reason = 'single_match';
      }

      entries.push({
        contentKey: contentKeyArr,
        text: stripHtmlTags(matchedTemplateText),
        elementPath: getElementPath(node.parentElement),
        reason,
        domNode: node,
        parentElement: node.parentElement,
      });
      continue;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;

      if (element.tagName === 'INPUT') {
        const inputElement = element as HTMLInputElement;
        const contentValue =
          inputElement.placeholder?.trim() ||
          inputElement.getAttribute('aria-label')?.trim();

        if (!contentValue) continue;

        let content = window.memoryMap?.get(contentValue);
        let matchedTemplateText = contentValue;

        if (!content) {
          const normalizedValue = normalizeWhitespace(contentValue);

          for (const [templateText, contentData] of window.memoryMap) {
            const rendered = renderTemplate(templateText, contentData.variables);

            if (rendered === normalizedValue) {
              content = contentData;
              matchedTemplateText = templateText;
              break;
            }
          }
        }

        const keys = Array.from(content?.ids || []);

        if (keys.length === 0 && !window.isStandaloneMode) {
          continue;
        }

        const availableKeys = keys.filter(k => !assignedIds.has(k));
        const contentKeyArr = availableKeys.length > 0 ? availableKeys : (keys.length > 0 ? [keys[0]] : []);

        let reason: AssignmentReason | undefined;
        if (contentKeyArr.length === 1 && contentKeyArr[0]) {
          assignedIds.add(contentKeyArr[0]);
          reason = 'single_match';
        }

        entries.push({
          contentKey: contentKeyArr,
          text: stripHtmlTags(matchedTemplateText),
          elementPath: getElementPath(inputElement),
          reason,
          domNode: node,
          parentElement: inputElement,
        });
      }
    }
  }

  // Wave 2: Sibling correction — resolve ambiguous entries using grandparent-level sibling context
  for (const entry of entries) {
    if (entry.contentKey.length > 1 && !entry.reason) {
      const resolved = trySiblingCorrection(entry, entries, assignedIds);
      if (resolved) {
        entry.reason = 'sibling_context';
        assignedIds.add(entry.contentKey[0]);
      }
    }
  }

  // Wave 3: Prefix frequency fallback for remaining ambiguous entries
  for (const entry of entries) {
    if (entry.contentKey.length > 1 && !entry.reason) {
      entry.contentKey = sortKeysByPageContext(entry.contentKey, assignedIds);
      assignedIds.add(entry.contentKey[0]);
      entry.reason = 'prefix_frequency';
    }
  }

  // Final: mark any still without reason (e.g., standalone mode nodes with no keys)
  for (const entry of entries) {
    if (!entry.reason) {
      entry.reason = entry.contentKey.length > 1 ? 'ambiguous' : 'single_match';
    }
  }

  // Group entries by assigned contentKey into ContentNode with elements array
  const groupedMap = new Map<string, ContentNode>();
  for (const entry of entries) {
    const key = entry.contentKey[0];
    if (!key) continue;

    const existing = groupedMap.get(key);
    if (existing) {
      existing.elements.push({
        text: entry.text,
        elementPath: entry.elementPath,
        reason: entry.reason!,
      });
    } else {
      groupedMap.set(key, {
        type: 'text',
        contentKey: key,
        text: entry.text,
        elements: [{
          text: entry.text,
          elementPath: entry.elementPath,
          reason: entry.reason!,
        }],
      });
    }
  }

  const structuredContent = Array.from(groupedMap.values());

  // Compute unmatched IDs: all memoryMap IDs minus assigned IDs
  const unmatchedIds = getAllMemoryMapIds().filter(id => !assignedIds.has(id));

  // Detect language for standalone mode
  const detectedLanguage = window.isStandaloneMode ? detectPageLanguage() : null;

  return { structuredContent, detectedLanguage, unmatchedIds };
}

/**
 * Collects all IDs from memoryMap
 */
function getAllMemoryMapIds(): string[] {
  const allIds: string[] = [];
  for (const [, value] of window.memoryMap) {
    for (const id of value.ids) {
      allIds.push(id);
    }
  }
  return allIds;
}

/**
 * Builds a lookup map from elementPath to resolved contentKey for consistent highlighting
 */
function buildElementPathToKeyMap(structuredContent: ContentNode[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of structuredContent) {
    for (const el of node.elements) {
      if (el.elementPath) {
        map.set(el.elementPath, node.contentKey);
      }
    }
  }
  return map;
}

/**
 * Applies highlighting to content elements
 * This is an internal helper used by both processDomChanges and refreshHighlighting
 */
function applyHighlighting(structuredContent: ContentNode[], elementPathToKey?: Map<string, string>) {
  const shouldHighlight = getConfig().highlightEditableContent;
  const shouldShowPendingChanges = getConfig().showPendingChanges;
  const highlight = shouldHighlight === undefined ? true : shouldHighlight;

  markContentStorageElements(structuredContent, highlight, elementPathToKey);

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
  // In standalone mode, apply highlighting. If memoryMap has entries (from SET_CONTENT_KEYS),
  // also send FOUND_CONTENT_NODES so the parent knows which keys are visible on the page.
  if (window.isStandaloneMode) {
    if (window.memoryMap.size > 0) {
      const { contentNodes, unmatchedIds } = refreshHighlighting();
      sendMessageToParent(OUTGOING_MESSAGE_TYPES.FOUND_CONTENT_NODES, {
        contentNodes,
        language: null,
        unmatchedIds,
      });
    }
    // When memoryMap is empty, skip highlighting entirely.
    // This prevents marking all text nodes with data-content-key="undefined"
    // which blocks correct key assignment when SET_CONTENT_KEYS arrives later.
    return;
  }

  try {
    const { structuredContent, detectedLanguage, unmatchedIds } = findAndProcessNodes();

    if (structuredContent.length > 0) {
      // Send nodes to parent
      console.log('[Live editor] Sending nodes to parent:', structuredContent, 'language:', detectedLanguage);
      sendMessageToParent(OUTGOING_MESSAGE_TYPES.FOUND_CONTENT_NODES, {
        contentNodes: structuredContent,
        language: detectedLanguage,
        unmatchedIds,
      });

      // Apply highlighting with elementPath lookup for consistency
      const elementPathToKey = buildElementPathToKeyMap(structuredContent);
      applyHighlighting(structuredContent, elementPathToKey);

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
export function refreshHighlighting(): { contentNodes: ContentNode[], unmatchedIds: string[] } {
  try {
    // Pause observer to prevent our DOM changes from triggering it
    pauseObserver();

    const { structuredContent, unmatchedIds } = findAndProcessNodes();

    if (structuredContent.length > 0) {
      const elementPathToKey = buildElementPathToKeyMap(structuredContent);
      applyHighlighting(structuredContent, elementPathToKey);
      console.log('[Live editor] Refreshed highlighting without sending nodes');
    }

    // Resume observer after a short delay to let DOM settle
    setTimeout(() => {
      resumeObserver();
    }, 100);

    return { contentNodes: structuredContent, unmatchedIds };
  } catch (error) {
    console.error('Error during highlighting refresh:', error);
    // Make sure to resume observer even on error
    resumeObserver();
    return { contentNodes: [], unmatchedIds: [] };
  }
}

/**
 * Pauses the mutation observer
 */
export function pauseObserver() {
  if (observerInstance && isObserving) {
    observerInstance.disconnect();
    isObserving = false;
    console.log('[Live editor] Observer paused');
  }
}

/**
 * Resumes the mutation observer
 */
export function resumeObserver() {
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