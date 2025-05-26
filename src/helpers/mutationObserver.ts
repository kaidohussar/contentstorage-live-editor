import { applyConfig } from './config';

export const mutationObserverCallback: MutationCallback = (
  mutationsList,
  observer
) => {
  let significantMutationDetected = false;

  const IGNORED_ELEMENT_IDS: string[] = ['contentstorage-element-label']; // Add IDs you want to ignore
  const STYLE_RELATED_ATTRIBUTES: string[] = ['style', 'class'];

  for (const mutation of mutationsList) {
    // A. Ignore style-only attribute changes
    if (mutation.type === 'attributes') {
      if (
        mutation.attributeName &&
        STYLE_RELATED_ATTRIBUTES.includes(mutation.attributeName)
      ) {
        const targetElement = mutation.target as HTMLElement;

        if (targetElement.hasAttribute('data-contentstorage-id')) {
          // This is a style/class change on an element that HAS 'data-contentstorage-id'.
          // According to the new requirement, we DO NOT continue (ignore) here.
          // This mutation is considered potentially significant for highlighting.
          // So, we let it pass this specific check.
          // console.log(`MutationObserver: Processing style/class attribute change on element WITH 'data-contentstorage-id'`, targetElement);
        } else {
          // This is a style/class change on an element that DOES NOT HAVE 'data-contentstorage-id'.
          // We IGNORE this mutation.
          // console.log(`MutationObserver: Ignoring style/class attribute change on element WITHOUT 'data-contentstorage-id'`, targetElement);
          continue; // Skip this mutation
        }
      }
    }

    // B. Ignore mutations within elements (or on elements) with specified IDs
    let targetNode: Node | null = null;

    // Determine the primary node to check for ignored ID parentage
    if (mutation.type === 'childList') {
      // For childList, the mutation.target is the parent whose children changed.
      // We care if this parent is in an ignored zone.
      targetNode = mutation.target;
    } else if (mutation.type === 'attributes') {
      // For attributes, mutation.target is the element whose attribute changed.
      targetNode = mutation.target;
    } else {
      // For other types like 'characterData', mutation.target is also the relevant node.
      targetNode = mutation.target;
    }

    if (targetNode) {
      let isInsideIgnoredElement = false;
      let currentElement: HTMLElement | null =
        targetNode.nodeType === Node.ELEMENT_NODE
          ? (targetNode as HTMLElement)
          : targetNode.parentElement;

      while (currentElement) {
        if (
          currentElement.id &&
          IGNORED_ELEMENT_IDS.includes(currentElement.id)
        ) {
          isInsideIgnoredElement = true;
          // console.log(`MutationObserver: Mutation target is inside or is an ignored element ('${currentElement.id}'). Ignoring.`, mutation.target);
          break;
        }
        currentElement = currentElement.parentElement;
      }

      if (isInsideIgnoredElement) {
        continue; // Skip this mutation, it's within an ignored zone
      }
    }

    // If we reach here, this mutation is considered significant
    significantMutationDetected = true;
    // console.log('MutationObserver: Significant mutation detected.', mutation);
    break; // No need to check other mutations if one significant one is found
  }

  if (significantMutationDetected) {
    console.log('DOM mutated, re-highlighting...');
    //  applyConfig();
  }
};

export const mutationObserverConfig: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true, // Important if data-contentstorage-id can be added/removed from existing elements
  attributeFilter: ['data-contentstorage-id'], // More efficient if only observing this specific attribute change
};
