import { sendMessageToParent } from './sendMessageToParent';
import { OUTGOING_MESSAGE_TYPES } from '../contants';

let isProcessing = false;

const editButton = (contentId: string) => {
  // Create the button element
  const button = document.createElement('button');
  button.type = 'button'; // Good practice for buttons not submitting forms

  // Style the button directly using inline styles
  button.style.width = '30px';
  button.style.height = '30px';
  button.style.position = 'absolute';
  button.style.top = '-15px';
  button.style.right = '-10px';

  // Styles previously in .edit-button class
  button.style.cursor = 'pointer';
  button.style.border = '1px solid #C0C0CA';
  button.style.backgroundColor = '#EAF1F9';
  button.style.borderRadius = '30px';
  button.style.display = 'flex';
  button.style.justifyContent = 'center';
  button.style.alignItems = 'center';
  button.style.padding = '0px';
  button.style.color = '#222225';
  button.style.zIndex = '9999';

  button.onclick = (event) => {
    event.stopPropagation();
    event.preventDefault();
    sendMessageToParent(OUTGOING_MESSAGE_TYPES.CLICK_CONTENT_ITEM_EDIT_BTN, {
      contentKey: contentId,
    });
  };

  // Create SVG for the edit icon (pencil)
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('xmlns', svgNS);
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'currentColor');
  // Apply styles directly to SVG if needed, though width/height attributes are often sufficient
  svg.setAttribute('width', '16'); // Icon size, slightly smaller than button
  svg.setAttribute('height', '16');

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute(
    'd',
    'M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z'
  );
  svg.appendChild(path);
  button.appendChild(svg);

  return button;
};

const wrapTextInContentKeyWrapper = (node: Node, contentKey: string): void => {
  // This function is already correct.
  if (node.nodeType === Node.TEXT_NODE && node.textContent) {
    const parent = node.parentElement;
    if (
      parent?.hasAttribute('data-content-key') &&
      parent.getAttribute('data-content-key') === contentKey
    ) {
      return;
    }

    const span = document.createElement('span');
    span.setAttribute('data-content-key', contentKey);
    span.textContent = node.textContent;
    node.parentNode?.replaceChild(span, node);
  }
};

const wrapTextInCheckedTextWrapper = (node: Node): void => {
  if (node.nodeType === Node.TEXT_NODE && node.textContent) {
    const parent = node.parentElement;
    if (parent?.hasAttribute('data-content-checked')) {
      return;
    }

    const span = document.createElement('span');
    // --- FIX: Corrected 'trie' to 'true' ---
    span.setAttribute('data-content-checked', 'true');
    span.textContent = node.textContent;
    node.parentNode?.replaceChild(span, node);
  }
};

const findAndWrapText = (
  element: Node,
  content: { text: string; contentKey: string }[]
): void => {
  // 1. If the current node is a text node, process it.
  if (element.nodeType === Node.TEXT_NODE && element.textContent?.trim()) {
    // Find if this text node's content matches any of the items to be highlighted.
    const matchedItem = content.find((item) =>
      element.textContent!.includes(item.text)
    );

    if (matchedItem) {
      // If a match is found, wrap it in the highlight span.
      wrapTextInContentKeyWrapper(element, matchedItem.contentKey);
    } else {
      // If no match is found, wrap it in the "checked" span.
      wrapTextInCheckedTextWrapper(element);
    }
    // Once processed, we don't need to do anything else with this node.
    return;
  }

  // 2. Do not recurse into elements we have already created.
  if (element.nodeType === Node.ELEMENT_NODE) {
    const el = element as HTMLElement;
    if (
      el.hasAttribute('data-content-key') ||
      el.hasAttribute('data-content-checked')
    ) {
      return;
    }
  }

  // 3. If it's an element node, recursively call this function on its children.
  // We must copy childNodes to an array because the original NodeList is "live"
  // and will change when we replace nodes, which can break the loop.
  const childNodes = Array.from(element.childNodes);
  for (const child of childNodes) {
    findAndWrapText(child, content);
  }
};

export const highlightContentstorageElements = (
  content?: { text: string; contentKey: string }[]
) => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // First, find and wrap matching text in spans with data-content-key
    if (content && content?.length > 0) {
      findAndWrapText(document.body, content);
    }

    // Then highlight all elements with data-content-key
    const elements =
      document.querySelectorAll<HTMLElement>('[data-content-key]');

    elements.forEach((element) => {
      const contentStorageId = element.dataset.contentKey;

      if (contentStorageId) {
        element.style.outline = `1px solid #1791FF`;
        element.style.position = 'relative';

        const label = document.createElement('div');
        label.setAttribute('id', 'contentstorage-element-label');
        label.textContent = contentStorageId;
        label.style.position = 'absolute';
        label.style.top = '-15px';
        label.style.left = '0px';
        label.style.color = '#1791FF';
        label.style.fontSize = '10px';
        label.style.zIndex = '9999';
        label.style.pointerEvents = 'none';

        const button = editButton(contentStorageId);

        element.appendChild(label);
        element.appendChild(button);
      }
    });
  } finally {
    isProcessing = false;
  }
};
