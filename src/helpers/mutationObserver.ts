import { findContentNodesInPage } from './domTreeWalker';
import { sendMessageToParent } from './sendMessageToParent';
import { ContentNode, OUTGOING_MESSAGE_TYPES } from '../contants';
import { getConfig } from './config';
import {
  markContentStorageElements,
  showPendingChanges,
} from './markContentStorageElements';
import { getPendingChanges, throttle } from './misc';

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

export function processDomChanges() {
  try {
    // applyConfig(); // Assuming this is part of your process
    const nodes = findContentNodesInPage();

    if (nodes.length > 0) {
      const structuredContent = nodes
        .map((node): ContentNode | null => {
          // Check if it's a Text node with content
          if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
            let content = window.memoryMap?.get(node.textContent);

            const isShowingPendingChange = node.parentElement?.getAttribute(
              'data-content-showing-pending-change'
            );

            if (isShowingPendingChange) {
              const contentId =
                node.parentElement?.getAttribute('data-content-key') || '';
              Array.from(window.memoryMap).forEach((node) => {
                if (node[1].ids.has(contentId)) {
                  content = node[1];
                }
              });
            }

            const keys = Array.from(content?.ids || []);
            const variation = content?.variation;

            if (keys.length === 0) {
              return null;
            }

            const data: ContentNode = {
              type: variation ? 'variation' : 'text',
              text: node.textContent.trim(),
              contentKey: keys,
              variation: variation || '',
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

              return {
                type: 'image',
                url: imgElement.src,
                altText: imgElement.alt,
                contentKey: keys,
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

              const content = window.memoryMap?.get(contentValue);
              const keys = Array.from(content?.ids || []);
              const variation = content?.variation;

              if (keys.length === 0) {
                return null;
              }

              const data: ContentNode = {
                type: variation ? 'variation' : 'text',
                text: contentValue,
                contentKey: keys,
                variation: variation || '',
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
    // 1. Ignore mutations that are clearly our own span additions.
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

    // 2. Attribute change filtering logic (your existing code is good).
    if (mutation.type === 'attributes') {
      if (STYLE_RELATED_ATTRIBUTES.includes(mutation.attributeName || '')) {
        const targetElement = mutation.target as HTMLElement;
        if (!targetElement.hasAttribute('data-content-key')) {
          continue;
        }
      }
    }

    // 3. Ignore mutations within explicitly ignored parent elements (your existing code is good).
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
          break; // Exit the while loop
        }
        currentElement = currentElement.parentElement;
      }
      // If the while loop broke because it found an ignored ID, continue to the next mutation.
      if (currentElement && IGNORED_ELEMENT_IDS.includes(currentElement.id)) {
        continue;
      }
    }

    // If a mutation passes all filters, we consider it significant.
    significantMutationDetected = true;
    break; // One significant mutation is enough.
  }

  // If a significant, external mutation was detected, run the processing logic.
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
  // No need to filter attributes here if you do it in the callback
  // but it can be a micro-optimization.
  // attributeFilter: ['data-content-key', 'style', 'class'],
};
