import { isElementVisible } from './isElementVisible';

const isEditableOrInsideEditable = (element: HTMLElement | null): boolean => {
  if (!element) {
    return false;
  }
  if (element.isContentEditable) {
    return true;
  }
  return isEditableOrInsideEditable(element.parentElement);
};

export const findTextNodesInPage = (): Node[] => {
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
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node: Text) => {
        const parent = node.parentElement;

        // Basic filter: Skip if there's no parent or the text is just whitespace.
        if (!parent || !node.textContent?.trim()) {
          return NodeFilter.FILTER_SKIP;
        }

        let currentAncestor: HTMLElement | null = parent;
        while (currentAncestor && currentAncestor !== document.body) {
          if (
            currentAncestor.hasAttribute('data-content-key') ||
            currentAncestor.hasAttribute('data-content-checked')
          ) {
            return NodeFilter.FILTER_SKIP; // Skip this node entirely.
          }
          currentAncestor = currentAncestor.parentElement;
        }

        // --- Additional Filters ---
        // Skip if inside an unsupported element type.
        if (isUnsupported(parent)) {
          return NodeFilter.FILTER_SKIP;
        }

        // Skip if the element is not visible.
        if (!isElementVisible(parent)) {
          return NodeFilter.FILTER_SKIP;
        }

        // Skip if inside a content-editable element.
        if (hasEditableElements && isEditableOrInsideEditable(parent)) {
          return NodeFilter.FILTER_SKIP;
        }

        // If all checks pass, accept the node.
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let currentNode;
  while ((currentNode = treeWalker.nextNode())) {
    textNodes.push(currentNode);
  }

  return textNodes;
};
