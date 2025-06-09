import { isElementVisible } from './isElementVisible';

export const findTextNodesInPage = (): string[] => {
  /**
   * Enable check for ContentEditable elements only if there are ContentEditable elements on page,
   * otherwise this check will unnecessarily loop through a lot of DOM elements potentially causing performance issues
   */
  let checkForEditableElementsEnabled = false;
  
  const elementUnsupported = (element: HTMLElement): boolean =>
    element instanceof HTMLScriptElement ||
    element instanceof HTMLStyleElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLOptionElement ||
    element.tagName === 'NOSCRIPT';

  const isEditableOrInsideEditable = (element: HTMLElement | null): boolean => {
    if (!element) {
      return false;
    }

    if (element.isContentEditable) {
      return true;
    }

    return isEditableOrInsideEditable(element.parentElement);
  };

  const treeWalkerFilterCallback = (textNode: Text): number => {
    const hasEditableElements = !!document.querySelector(
      '[contenteditable="true"]'
    );

    const { data, parentElement } = textNode;

    if (!data || !parentElement) {
      return NodeFilter.FILTER_SKIP;
    }

    // Skip if the text node only contains whitespace
    if (data.trim().length === 0) {
      return NodeFilter.FILTER_SKIP;
    }

    // Skip the node is unsupported
    if (elementUnsupported(parentElement)) {
      return NodeFilter.FILTER_SKIP;
    }

    // Skip if element is not visible (if browser supports checkVisibility())
    if (!isElementVisible(parentElement)) {
      return NodeFilter.FILTER_SKIP;
    }

    // Skip if the node is editable (or inside editable). Only enable this check if there are editable elements on page.
    if (
      hasEditableElements &&
      !checkForEditableElementsEnabled &&
      parentElement.isContentEditable
    ) {
      checkForEditableElementsEnabled = true;
    }

    if (
      checkForEditableElementsEnabled &&
      isEditableOrInsideEditable(parentElement)
    ) {
      return NodeFilter.FILTER_SKIP;
    }

    return NodeFilter.FILTER_ACCEPT;
  };

  const getTextNodes = (): string[] => {
    const textNodes: string[] = [];

    const treeWalker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: treeWalkerFilterCallback,
      }
    );

    while (treeWalker.nextNode()) {
      const currentNode = treeWalker.currentNode as Text;
      textNodes.push(currentNode.data);
    }

    return textNodes;
  };

  return getTextNodes();
};
