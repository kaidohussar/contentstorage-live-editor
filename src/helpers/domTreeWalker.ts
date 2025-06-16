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

export const findContentNodesInPage = (): Node[] => {
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
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node: Node) => {
        // --- Handle ELEMENT_NODE (specifically for IMG) ---
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;

          console.log('IMAGE element.tagName', element.tagName);

          if (element.tagName !== 'IMG') {
            return NodeFilter.FILTER_SKIP; // We only care about IMG elements
          }

          if (element.hasAttribute('data-content-checked')) {
            return NodeFilter.FILTER_REJECT; // Skip this IMG element.
          }

          // If it's an IMG and passes the checks, accept it.
          return NodeFilter.FILTER_ACCEPT;
        }

        // --- Handle TEXT_NODE ---
        if (node.nodeType === Node.TEXT_NODE) {
          // Skip empty or whitespace-only text nodes
          if (!node.textContent?.trim()) {
            return NodeFilter.FILTER_SKIP;
          }

          const parent = node.parentElement;
          if (!parent) {
            return NodeFilter.FILTER_REJECT;
          }

          // --- Ancestor and Parent-based Filters for Text Nodes ONLY ---
          let currentAncestor: HTMLElement | null = parent;
          while (currentAncestor && currentAncestor !== document.body) {
            if (
              currentAncestor.hasAttribute('data-content-key') ||
              currentAncestor.hasAttribute('data-content-checked')
            ) {
              return NodeFilter.FILTER_REJECT; // Skip text nodes within these ancestors
            }
            currentAncestor = currentAncestor.parentElement;
          }

          // Skip if the parent is an unsupported element type.
          if (isUnsupported(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip if the parent element is not visible.
          if (!isElementVisible(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip if inside a content-editable element.
          if (hasEditableElements && isEditableOrInsideEditable(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          // If all checks pass for the text node, accept it.
          return NodeFilter.FILTER_ACCEPT;
        }

        // For any other node type, skip it.
        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  let currentNode;
  while ((currentNode = treeWalker.nextNode())) {
    textNodes.push(currentNode);
  }

  return textNodes;
};
