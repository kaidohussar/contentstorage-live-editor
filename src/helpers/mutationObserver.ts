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

export function processDomChanges() {
  try {
    // applyConfig(); // Assuming this is part of your process
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

    if (nodes.length > 0) {
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

            if (keys.length === 0) {
              return null;
            }

            // Find the first unclaimed ID, or fall back to first ID if all are claimed
            const availableKey = keys.find(k => !assignedIds.has(k)) || keys[0];
            assignedIds.add(availableKey);

            const data: ContentNode = {
              type: 'text',
              text: stripHtmlTags(matchedTemplateText),
              contentKey: [availableKey],
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

              if (keys.length === 0) {
                return null;
              }

              // Find the first unclaimed ID, or fall back to first ID if all are claimed
              const availableKey = keys.find(k => !assignedIds.has(k)) || keys[0];
              assignedIds.add(availableKey);

              return {
                type: 'image',
                url: imgElement.src,
                altText: imgElement.alt,
                contentKey: [availableKey],
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

              if (keys.length === 0) {
                return null;
              }

              // Find the first unclaimed ID, or fall back to first ID if all are claimed
              const availableKey = keys.find(k => !assignedIds.has(k)) || keys[0];
              assignedIds.add(availableKey);

              const data: ContentNode = {
                type: 'text',
                text: stripHtmlTags(matchedTemplateText),
                contentKey: [availableKey],
                elementPath: getElementPath(inputElement),
              };

              return data;
            }
          }

          // Return null for any nodes we want to ignore
          return null;
        })
        .filter(Boolean) as ContentNode[];

      console.log('[Live editor] Sending nodes to parent:', structuredContent);
      sendMessageToParent(OUTGOING_MESSAGE_TYPES.FOUND_CONTENT_NODES, {
        contentNodes: structuredContent,
      });

      const shouldHighlight = getConfig().highlightEditableContent;
      const shouldShowPendingChanges = getConfig().showPendingChanges;
      const highlight = shouldHighlight === undefined ? true : shouldHighlight;

      markContentStorageElements(structuredContent, highlight);

      if (shouldShowPendingChanges) {
        showPendingChanges(getPendingChanges());
      }

      console.log(
        '[Live editor] Significant mutation detected. Processing and sending text nodes.'
      );
    }
  } catch (error) {
    console.error('Error during DOM processing after mutation:', error);
  }
}

const mutationObserverCallbackOriginal: MutationCallback = (
  mutationsList,
  observer
) => {
  let significantMutationDetected = false;

  const ACTUAL_OBSERVED_TARGET_NODE: Node = document.body;
  const IGNORED_ELEMENT_IDS: string[] = ['contentstorage-element-label'];
  const STYLE_RELATED_ATTRIBUTES: string[] = ['style', 'class'];

  const isInternalWrappingBatch = mutationsList.some(
    (mutation) =>
      mutation.type === 'childList' &&
      Array.from(mutation.addedNodes).some(isInternalWrapper) // Use the helper function here
  );

  for (const mutation of mutationsList) {
    if (mutation.type === 'childList') {
      const isWrapperAddition = Array.from(mutation.addedNodes).some(
        isInternalWrapper
      ); // And here
      if (isWrapperAddition) {
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
      if (STYLE_RELATED_ATTRIBUTES.includes(mutation.attributeName || '')) {
        const targetElement = mutation.target as HTMLElement;
        if (!targetElement.hasAttribute('data-content-key')) {
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

      while (currentElement) {
        if (
          currentElement.id &&
          IGNORED_ELEMENT_IDS.includes(currentElement.id)
        ) {
          // By using 'continue' with a label, we could break out to the next mutation,
          // but for clarity, we'll just set a flag and break.
          // This part of the logic can be simplified, but for now, we ensure it works.
          // We mark this path to be skipped.
          significantMutationDetected = false; // Override any previous detection
          break;
        }
        currentElement = currentElement.parentElement;
      }
      // If the while loop broke because it found an ignored ID, continue to the next mutation.
      if (currentElement && IGNORED_ELEMENT_IDS.includes(currentElement.id)) {
        continue;
      }
    }

    significantMutationDetected = true;
    break;
  }

  if (significantMutationDetected) {
    observer.disconnect();

    processDomChanges();

    // Reconnect the observer asynchronously.
    Promise.resolve()
      .then(() => {
        observer.observe(ACTUAL_OBSERVED_TARGET_NODE, mutationObserverConfig);
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
