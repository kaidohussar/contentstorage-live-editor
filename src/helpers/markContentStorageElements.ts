import { sendMessageToParent } from './sendMessageToParent';
import { ContentNode, OUTGOING_MESSAGE_TYPES } from '../contants';
import { PendingChangeSimple } from '../types';
import { isImageElement } from './typeguards';

let isProcessing = false;

const editButton = (contentId: string) => {
  // Create the button element
  const button = document.createElement('button');
  button.setAttribute('id', 'contentstorage-element-button');
  button.type = 'button'; // Good practice for buttons not submitting forms

  // Style the button directly using inline styles
  button.style.width = '30px';
  button.style.height = '30px';
  button.style.position = 'absolute';
  button.style.top = '-25px';
  button.style.right = '-15px';

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

const applyContentKey = (node: Node, contentKey: string): void => {
  // Handle Text Nodes by wrapping them
  if (node.nodeType === Node.TEXT_NODE && node.textContent) {
    const parent = node.parentElement;
    // Avoid re-wrapping if parent already has the correct key
    if (parent?.getAttribute('data-content-key') === contentKey) {
      return;
    }

    const span = document.createElement('span');
    span.setAttribute('data-content-key', contentKey);
    span.textContent = node.textContent;
    node.parentNode?.replaceChild(span, node);
  }
  // Handle Element Nodes (like IMG) by setting the attribute directly
  else if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
    // Avoid reapplying the same attribute
    if (element.getAttribute('data-content-key') === contentKey) {
      return;
    }
    element.setAttribute('data-content-key', contentKey);
  }
};

const applyCheckedAttribute = (node: Node): void => {
  // Handle Text Nodes by wrapping them
  if (node.nodeType === Node.TEXT_NODE && node.textContent) {
    const parent = node.parentElement;
    // Avoid re-wrapping
    if (parent?.hasAttribute('data-content-checked')) {
      return;
    }

    const span = document.createElement('span');
    span.setAttribute('data-content-checked', 'true');
    span.textContent = node.textContent;
    node.parentNode?.replaceChild(span, node);
  }
  // Handle Element Nodes (like IMG) by setting the attribute directly
  else if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
    // Avoid re-applying attribute
    if (element.hasAttribute('data-content-checked')) {
      return;
    }
    element.setAttribute('data-content-checked', 'true');
  }
};

const findAndMarkElements = (element: Node, content: ContentNode[]): void => {
  // 1. If the current node is a text node, process it.
  if (element.nodeType === Node.TEXT_NODE && element.textContent?.trim()) {
    // Find if this text node's content matches any of the items to be highlighted.
    const matchedItem = content.find(
      (item) =>
        (item.type === 'text' || item.type === 'variation') &&
        element.textContent?.includes(item.text)
    );

    if (matchedItem) {
      // If a match is found, wrap it in the highlight span.
      applyContentKey(
        element,
        matchedItem.contentKey[matchedItem.contentKey.length - 1]
      );
    } else {
      // If no match is found, wrap it in the "checked" span.
      applyCheckedAttribute(element);
    }
    // Once processed, we don't need to do anything else with this node.
    return;
  }

  if (
    element.nodeType === Node.ELEMENT_NODE &&
    ((element as Element).tagName === 'IMG' ||
      (element as Element).tagName === 'INPUT')
  ) {
    const htmlElement = element as HTMLElement;
    let matchedItem: ContentNode | undefined;

    if (htmlElement.tagName === 'IMG') {
      const imgElement = htmlElement as HTMLImageElement;
      // Find if this image node's src matches any of the items to be marked.
      matchedItem = content.find(
        (item) => item.type === 'image' && item.url === imgElement.src
      );
    } else {
      // It must be an INPUT
      const inputElement = htmlElement as HTMLInputElement;
      const contentValue =
        inputElement.placeholder?.trim() ||
        inputElement.getAttribute('aria-label')?.trim();
      if (contentValue) {
        matchedItem = content.find((item) => {
          if (item.type === 'text') {
            return item.text === contentValue;
          } else if (item.type === 'variation') {
            return item.variation === contentValue;
          }
        });
      }
    }

    if (matchedItem) {
      // If a match is found, apply the contentKey directly to the element.
      applyContentKey(
        element,
        matchedItem.contentKey[matchedItem.contentKey.length - 1]
      );
    } else {
      // If no match is found, apply the "checked" attribute directly to the element.
      applyCheckedAttribute(element);
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

  const childNodes = Array.from(element.childNodes);
  for (const child of childNodes) {
    findAndMarkElements(child, content);
  }
};

export const markContentStorageElements = (
  content: ContentNode[],
  shouldHighlight: boolean
) => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // First, find and wrap matching text in spans with data-content-key
    if (content && content?.length > 0) {
      findAndMarkElements(document.body, content);
    }

    // Then highlight all elements with data-content-key
    const elements =
      document.querySelectorAll<HTMLElement>('[data-content-key]');

    elements.forEach((element) => {
      const contentStorageId = element.dataset.contentKey;
      if (!contentStorageId || !shouldHighlight) {
        return;
      }

      const isImg = isImageElement(element);
      const isInput = element.tagName === 'INPUT';
      let contentValue: string | null | undefined;
      let wrapper: HTMLElement | null = null;

      // Determine the content value based on element type
      if (isImg) {
        contentValue = element.src;
      } else if (isInput) {
        const inputElement = element as HTMLInputElement;
        contentValue =
          inputElement.placeholder || inputElement.getAttribute('aria-label');
      } else {
        contentValue = element.textContent;
      }

      // Ensure the content is valid and tracked
      if (!contentValue || !window.memoryMap.has(contentValue)) {
        return;
      }

      // Create a wrapper for IMG and INPUT elements to help with positioning
      if (isImg || isInput) {
        const wrapperElemId = isImg
          ? 'contentstorage-element-image-wrapper'
          : 'contentstorage-element-input-wrapper';

        const parentNode = element.parentNode as HTMLElement;
        // Check if the element is already wrapped
        if (parentNode && parentNode.id === wrapperElemId) {
          wrapper = parentNode;
        } else {
          wrapper = document.createElement('div');
          wrapper.setAttribute('id', wrapperElemId);
          wrapper.style.position = 'relative';
          wrapper.style.display = 'inline-block'; // Fit the content

          if (element.parentNode) {
            element.parentNode.insertBefore(wrapper, element);
            wrapper.appendChild(element);
          }
        }
        wrapper.style.outline = `1px solid #1791FF`;
        wrapper.style.borderRadius = isImg ? '2px' : '4px';
      } else {
        // For text nodes (spans), style them directly
        element.style.outline = `1px solid #1791FF`;
        element.style.outlineOffset = '4px';
        element.style.borderRadius = '2px';
        element.style.position = 'relative';
      }

      const parentForControls = wrapper || element;

      // Prevent adding duplicate labels or buttons
      if (parentForControls.querySelector('#contentstorage-element-label')) {
        return;
      }

      const label = document.createElement('div');
      label.setAttribute('id', 'contentstorage-element-label');
      label.textContent = contentStorageId;
      label.style.position = 'absolute';
      if (isInput || isImg) {
        label.style.bottom = '0px';
      } else {
        label.style.top = '4px';
      }
      label.style.left = 'calc(100% + 10px)';
      label.style.color = '#1791FF';
      label.style.fontSize = '10px';
      label.style.fontWeight = '400';
      label.style.zIndex = '9999';
      label.style.pointerEvents = 'none';

      const button = editButton(contentStorageId);

      parentForControls.appendChild(label);
      parentForControls.appendChild(button);
    });
  } finally {
    isProcessing = false;
  }
};

export const hideContentstorageElementsHighlight = () => {
  const elements = document.querySelectorAll<HTMLElement>('[data-content-key]');
  const wrappers = document.querySelectorAll<HTMLElement>(
    '#contentstorage-element-image-wrapper, #contentstorage-element-input-wrapper'
  );
  const labels = document.querySelectorAll<HTMLElement>(
    '#contentstorage-element-label'
  );
  const buttons = document.querySelectorAll<HTMLElement>(
    '#contentstorage-element-button'
  );

  wrappers.forEach((wrapper) => {
    const elementToUnwrap = wrapper.querySelector('img, input');
    const parent = wrapper.parentNode;

    if (parent && elementToUnwrap) {
      parent.insertBefore(elementToUnwrap, wrapper);
      parent.removeChild(wrapper);
    }
  });

  elements.forEach((item) => (item.style.cssText = ''));

  [...labels, ...buttons].forEach((item) => item.remove());
};

export const showPendingChanges = (pendingChanges: PendingChangeSimple[]) => {
  pendingChanges.forEach((change) => {
    const elem = document.querySelector(
      `[data-content-key="${change.contentId}"]`
    );

    if (elem) {
      const childNodes = elem.childNodes;

      // Loop through all the child nodes
      for (const node of childNodes) {
        // Check if the node is a text node (nodeType === 3)
        // and if its content is not just whitespace.
        if (
          node.nodeType === Node.TEXT_NODE &&
          node.textContent &&
          node.textContent.trim().length > 0
        ) {
          const textVal = change.value?.toString() || '';

          if (textVal && change.langCountry === window.currentLanguageCode) {
            elem.setAttribute('data-content-showing-pending-change', 'true');
            node.nodeValue = change.value?.toString() || '';
          }

          break; // Remove this 'break' if you want to replace ALL text nodes with the new text.
        }
      }
    }
  });
};

export const showOriginalContent = () => {
  const pendingChangesContent = document.querySelectorAll<HTMLElement>(
    `[data-content-showing-pending-change="true"]`
  );

  pendingChangesContent.forEach((pendingChangeElem) => {
    const childNodes = pendingChangeElem.childNodes;
    const contentKey = pendingChangeElem.getAttribute('data-content-key');

    // Loop through all the child nodes
    for (const node of childNodes) {
      // Check if the node is a text node (nodeType === 3)
      // and if its content is not just whitespace.
      if (
        contentKey &&
        node.nodeType === Node.TEXT_NODE &&
        node.textContent &&
        node.textContent.trim().length > 0
      ) {
        const textVal = Array.from(window.memoryMap).find(([key, data]) => {
          return data.ids.has(contentKey);
        });

        if (textVal && textVal.length > 0 && typeof textVal[0] === 'string') {
          node.nodeValue = textVal[0] || '';
        }

        break; // Remove this 'break' if you want to replace ALL text nodes with the new text.
      }
    }
  });
};
