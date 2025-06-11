import { applyConfig } from './config';
import { sendMessageToParent } from './sendMessageToParent';
import { OUTGOING_MESSAGE_TYPES } from '../contants';
import { findTextNodesInPage } from './domTreeWalker';

export const mutationObserverCallback: MutationCallback = (
  mutationsList,
  observer
) => {
  let significantMutationDetected = false;

  const ACTUAL_OBSERVED_TARGET_NODE: Node = document.body;
  // IDs of container elements whose mutations should be completely ignored.
  const IGNORED_ELEMENT_IDS: string[] = ['contentstorage-element-label'];
  const STYLE_RELATED_ATTRIBUTES: string[] = ['style', 'class'];

  for (const mutation of mutationsList) {
    // --- PRIMARY LOOP FIX ---
    // If the mutation is a childList change, we first check if it was caused by our own script
    // adding a 'data-content-key' span. If so, we ignore this entire mutation record
    // because the addition of our span and the removal of the original text node are
    // part of the same internal operation.
    if (mutation.type === 'childList') {
      let isInternalWrappingMutation = false;
      for (const addedNode of Array.from(mutation.addedNodes)) {
        // Check if the added node is an element and has our specific data attribute.
        if (
          addedNode.nodeType === Node.ELEMENT_NODE &&
          (addedNode as HTMLElement).hasAttribute('data-content-key')
        ) {
          isInternalWrappingMutation = true;
          break; // Found our wrapper, no need to check other added nodes.
        }
      }
      if (isInternalWrappingMutation) {
        continue; // This is our own change, skip to the next mutation record.
      }
    }

    // A. Attribute change filtering logic
    if (mutation.type === 'attributes') {
      // Ignore style or class changes on elements that we haven't already marked.
      // This prevents loops if external scripts are changing styles on generic elements,
      // while still allowing us to detect style changes on our specifically marked elements.
      if (STYLE_RELATED_ATTRIBUTES.includes(mutation.attributeName || '')) {
        const targetElement = mutation.target as HTMLElement;
        if (!targetElement.hasAttribute('data-content-key')) {
          continue; // Style change on a non-target element, ignore.
        }
      }
    }

    // B. Ignore mutations if their target is within an element with an ignored ID
    const nodeToCheckIdPath: Node | null = mutation.target;

    if (nodeToCheckIdPath) {
      let isInsideIgnoredElement = false;
      // Start from the element itself or its parent if it's a text node.
      let currentElement: HTMLElement | null =
        nodeToCheckIdPath.nodeType === Node.ELEMENT_NODE
          ? (nodeToCheckIdPath as HTMLElement)
          : nodeToCheckIdPath.parentElement;

      // Walk up the DOM tree to see if any parent has an ignored ID.
      while (currentElement) {
        if (
          currentElement.id &&
          IGNORED_ELEMENT_IDS.includes(currentElement.id)
        ) {
          isInsideIgnoredElement = true;
          break;
        }
        currentElement = currentElement.parentElement;
      }

      if (isInsideIgnoredElement) {
        continue; // Skip this mutation, it's within an explicitly ignored zone.
      }
    }

    // If a mutation passes all the filters above, we consider it significant.
    significantMutationDetected = true;
    break; // One significant mutation is enough to trigger our actions.
  }

  // If a significant, external mutation was detected, run our processing logic.
  if (significantMutationDetected) {
    // IMPORTANT: Disconnect the observer to prevent it from observing the changes we are about to make.
    observer.disconnect();

    try {
      applyConfig();
      const textNodes = findTextNodesInPage();
      sendMessageToParent(
        OUTGOING_MESSAGE_TYPES.FOUND_TEXT_NODES,
        textNodes.map((node) => node.textContent || '')
      );
      console.log(
        'Significant mutation detected. Would run applyConfig() now.'
      );
    } catch (error) {
      console.error('Error during DOM processing after mutation:', error);
    } finally {
      // After our work is done, reconnect the observer.
      // Using Promise.resolve().then() ensures this happens in a separate microtask,
      // allowing the DOM to settle before we start observing again.
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

export const mutationObserverConfig: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['data-content-key', 'style', 'class'],
};
