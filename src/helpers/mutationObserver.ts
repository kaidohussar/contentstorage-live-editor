import { findTextNodesInPage } from './domTreeWalker';
import { sendMessageToParent } from './sendMessageToParent';
import { OUTGOING_MESSAGE_TYPES } from '../contants';
import { getConfig } from './config';
import { highlightContentstorageElements } from './highlightContentstorageElements';

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

export const mutationObserverCallback: MutationCallback = (
  mutationsList,
  observer
) => {
  let significantMutationDetected = false;

  const ACTUAL_OBSERVED_TARGET_NODE: Node = document.body;
  const IGNORED_ELEMENT_IDS: string[] = ['contentstorage-element-label'];
  const STYLE_RELATED_ATTRIBUTES: string[] = ['style', 'class'];

  // --- NEW: Determine if this batch of mutations was likely caused by our script. ---
  // We check if at least one mutation involves adding our specific wrapper span.
  // This gives us context for ignoring related mutations, like text node removals.
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

    // --- NEW: Ignore corresponding text node removals during our wrapping operation. ---
    // If we've established this is an internal batch, and we encounter a mutation
    // that is *only* removing text nodes, we can safely assume it's the other
    // half of our wrapping process and ignore it.
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

    try {
      // applyConfig(); // Assuming this is part of your process
      const textNodes = findTextNodesInPage();
      const texts = textNodes.map((node) => node.textContent || '');
      if (texts.length > 0) {
        console.log('BEFORE SEND FOUND TEXT NODES', window.memoryMap);
        const allContentNodes = textNodes.map((node) => {
          const textContent = node.textContent || '';
          const keys = Array.from(
            window.memoryMap?.get(textContent)?.ids || []
          );

          return {
            contentKey: keys,
            type: 'text',
            text: textContent,
          };
        });

        const contentNodesWithMatchedId = allContentNodes.filter(
          (node) => node.contentKey.length > 0
        );

        sendMessageToParent(OUTGOING_MESSAGE_TYPES.FOUND_CONTENT_NODES, {
          contentNodes: contentNodesWithMatchedId,
        });

        const shouldHighlight = getConfig().highlightEditableContent;
        console.log('shouldHighlight', shouldHighlight);
        if (shouldHighlight && contentNodesWithMatchedId?.length > 0) {
          highlightContentstorageElements(contentNodesWithMatchedId);
        }

        console.log(
          'Significant mutation detected. Processing and sending text nodes.'
        );
      }
    } catch (error) {
      console.error('Error during DOM processing after mutation:', error);
    } finally {
      // Reconnect the observer asynchronously.
      Promise.resolve()
        .then(() => {
          observer.observe(ACTUAL_OBSERVED_TARGET_NODE, mutationObserverConfig);
        })
        .catch((promiseError) => {
          console.error('Error re-observing target node:', promiseError);
        });
    }
  }
};

// Your configuration remains the same.
export const mutationObserverConfig: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  // No need to filter attributes here if you do it in the callback
  // but it can be a micro-optimization.
  // attributeFilter: ['data-content-key', 'style', 'class'],
};
