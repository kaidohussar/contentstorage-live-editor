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
  const IGNORED_ELEMENT_IDS: string[] = ['contentstorage-element-label']; // IDs of elements whose mutations should be ignored
  const STYLE_RELATED_ATTRIBUTES: string[] = ['style', 'class'];

  for (const mutation of mutationsList) {
    // Skip mutations that are part of our own highlighting process
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      const addedNode = mutation.addedNodes[0] as HTMLElement;
      if (addedNode.hasAttribute && addedNode.hasAttribute('data-content-key')) {
        continue; // Skip mutations that add our own highlighted elements
      }
    }

    // A. Attribute change filtering logic
    if (mutation.type === 'attributes') {
      if (
        mutation.attributeName &&
        STYLE_RELATED_ATTRIBUTES.includes(mutation.attributeName)
      ) {
        const targetElement = mutation.target as HTMLElement;
        if (targetElement.hasAttribute('data-content-key')) {
          // This is a style/class change on an element that HAS 'data-content-key'.
          // As per your rule, this is potentially significant (if it's an external change).
          // The disconnect/reconnect mechanism will prevent loops from applyConfig's own style changes.
        } else {
          // Style change on an element WITHOUT 'data-content-key'. Ignore.
          continue;
        }
      }
    }

    // B. Ignore mutations if their target is within an element with an ignored ID
    let nodeToCheckIdPath: Node | null = null;

    // Determine the primary node whose ancestry we need to check for ignored IDs
    if (
      mutation.type === 'childList' ||
      mutation.type === 'attributes' ||
      mutation.type === 'characterData'
    ) {
      nodeToCheckIdPath = mutation.target;
    }

    if (nodeToCheckIdPath) {
      let isInsideIgnoredElement = false;
      let currentElement: HTMLElement | null =
        nodeToCheckIdPath.nodeType === Node.ELEMENT_NODE
          ? (nodeToCheckIdPath as HTMLElement)
          : nodeToCheckIdPath.parentElement;

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
        continue; // Skip this mutation, it's within an explicitly ignored zone
      }
    }

    // If we reach here, the mutation is considered significant by the current rules.
    significantMutationDetected = true;
    break; // One significant mutation is enough to trigger the action.
  }

  if (significantMutationDetected) {
    observer.disconnect(); // Disconnect the observer

    try {
      applyConfig(); // Call your DOM manipulation function
      const textNodes = findTextNodesInPage();
      sendMessageToParent(OUTGOING_MESSAGE_TYPES.FOUND_TEXT_NODES, textNodes);
    } catch (error) {
      console.error('Error during applyConfig:', error);
    } finally {
      // Reconnect the observer after DOM manipulations are done
      Promise.resolve()
        .then(() => {
          observer.observe(ACTUAL_OBSERVED_TARGET_NODE, mutationObserverConfig);
        })
        .catch((promiseError) => {
          console.error('Error re-observing after applyConfig:', promiseError);
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
