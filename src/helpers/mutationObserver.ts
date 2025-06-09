import { applyConfig } from './config';
import { sendMessageToParent } from './sendMessageToParent';
import { OUTGOING_MESSAGE_TYPES } from '../contants';
import { findTextNodesInPage } from './domTreeWalker';

export const mutationObserverCallback: MutationCallback = (
  mutationsList,
  observer // This 'observer' is the instance that triggered the callback
) => {
  let significantMutationDetected = false;

  const ACTUAL_OBSERVED_TARGET_NODE: Node = document.body;
  const IGNORED_ELEMENT_IDS: string[] = ['contentstorage-element-label']; // IDs of elements whose mutations should be ignored (e.g., labels added by highlighting)
  const STYLE_RELATED_ATTRIBUTES: string[] = ['style', 'class'];

  for (const mutation of mutationsList) {
    console.log('mutation', mutation);
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
          // console.log(`MutationObserver: Ignoring style/class attribute change on element WITHOUT 'data-content-key'`, targetElement);
          continue;
        }
      }
      // Other attribute changes (like 'data-content-key' itself, or attributes
      // set by applyConfig like 'data-highlighted-by-script') will pass this block
      // and be evaluated by the ID check below or become significant.
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
    // For 'characterData', mutation.target is the Text node. .parentElement would get the actual element.

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
          // console.log(`MutationObserver: Mutation target is inside or IS an ignored element ('${currentElement.id}'). Ignoring.`, mutation.target);
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
    // console.log('MutationObserver: Significant mutation detected.', mutation);
    break; // One significant mutation is enough to trigger the action.
  }
  console.log('significantMutationDetected', significantMutationDetected);
  if (significantMutationDetected) {
    // console.log('DOM mutated, re-highlighting...');

    observer.disconnect(); // <--- KEY FIX: Disconnect the observer

    try {
      applyConfig(); // Call your DOM manipulation function
      const textNodes = findTextNodesInPage();
      sendMessageToParent(OUTGOING_MESSAGE_TYPES.FOUND_TEXT_NODES, textNodes);
    } catch (error) {
      console.error('Error during applyConfig:', error);
      // Optionally, handle the error further
    } finally {
      // KEY FIX: Reconnect the observer after DOM manipulations are done.
      // Use a microtask (Promise.resolve().then()) to ensure that reconnection
      // happens after the current batch of DOM changes has been fully processed
      // and any synchronous mutation events have fired (and been ignored because we were disconnected).
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
  attributes: true, // Important if data-content-key can be added/removed from existing elements
  attributeFilter: ['data-content-key'], // More efficient if only observing this specific attribute change
};
