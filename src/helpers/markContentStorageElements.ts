import { sendMessageToParent } from './sendMessageToParent';
import { ContentNode, OUTGOING_MESSAGE_TYPES } from '../contants';
import { PendingChangeSimple } from '../types';
import { isImageElement } from './typeguards';
import {
  hasVariables,
  createVariablePattern,
  matchesWithVariables,
} from './variableMatching';
import { stripHtmlTags, normalizeWhitespace } from './htmlUtils';

let isProcessing = false;

/**
 * Enhanced text matching that handles HTML templates
 * Tries multiple strategies:
 * 1. Direct matchesWithVariables (fast path for non-HTML templates)
 * 2. Strip HTML from item.text and match against DOM text
 */
const matchesWithHtmlSupport = (
  domText: string,
  itemText: string
): boolean => {
  // Strategy 1: Try direct matching first (fast path)
  if (matchesWithVariables(domText, itemText)) {
    return true;
  }

  // Strategy 2: Strip HTML tags and try matching again
  const strippedItemText = stripHtmlTags(itemText);
  const normalizedDomText = normalizeWhitespace(domText);
  const normalizedItemText = normalizeWhitespace(strippedItemText);

  // Only proceed if stripping made a difference
  if (strippedItemText !== itemText) {
    return matchesWithVariables(normalizedDomText, normalizedItemText);
  }

  return false;
};

const applyProtectedStyles = (
  element: HTMLElement,
  styles: Record<string, string>
) => {
  Object.entries(styles).forEach(([property, value]) => {
    element.style.setProperty(property, value, 'important');
  });
};

const resetInheritedStyles = (element: HTMLElement) => {
  const resetStyles = {
    'font-family':
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'font-size': '14px',
    'font-weight': 'normal',
    'font-style': 'normal',
    'line-height': 'normal',
    color: 'inherit',
    'text-decoration': 'none',
    'text-transform': 'none',
    'letter-spacing': 'normal',
    'text-align': 'left',
    'text-indent': '0',
    'white-space': 'normal',
    'word-spacing': 'normal',
    margin: '0',
    padding: '0',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    'box-sizing': 'border-box',
    'vertical-align': 'baseline',
    'text-shadow': 'none',
    'box-shadow': 'none',
    opacity: '1',
    visibility: 'visible',
    overflow: 'visible',
    transform: 'none',
    transition: 'none',
    animation: 'none',
  };
  applyProtectedStyles(element, resetStyles);
};

const editButton = (contentId: string) => {
  // Create the button element
  const button = document.createElement('button');
  button.setAttribute('id', 'contentstorage-element-button');
  button.type = 'button';

  // Reset all inherited styles first
  resetInheritedStyles(button);

  // Apply protected button styles
  const buttonStyles = {
    width: '30px',
    height: '30px',
    position: 'absolute',
    top: '-25px',
    right: '-15px',
    cursor: 'pointer',
    border: '1px solid #C0C0CA',
    'background-color': '#EAF1F9',
    'border-radius': '30px',
    display: 'flex',
    'justify-content': 'center',
    'align-items': 'center',
    padding: '0',
    color: '#222225',
    'z-index': '9999',
    'min-width': '30px',
    'min-height': '30px',
    'max-width': '30px',
    'max-height': '30px',
    'flex-shrink': '0',
    'user-select': 'none',
    'pointer-events': 'auto',
    'font-size': '0',
    'line-height': '1',
  };
  applyProtectedStyles(button, buttonStyles);

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
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');

  const svgStyles = {
    display: 'block',
    'pointer-events': 'none',
    'user-select': 'none',
    'flex-shrink': '0',
    width: '16px',
    height: '16px',
    'min-width': '16px',
    'min-height': '16px',
    'max-width': '16px',
    'max-height': '16px',
    margin: '0',
    padding: '0',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    'box-sizing': 'border-box',
    'vertical-align': 'baseline',
    fill: 'currentColor',
    stroke: 'none',
    'stroke-width': '0',
    opacity: '1',
    visibility: 'visible',
    overflow: 'visible',
    transform: 'none',
    transition: 'none',
    animation: 'none',
    filter: 'none',
    'clip-path': 'none',
    mask: 'none',
  };
  applyProtectedStyles(svg as any, svgStyles);

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute(
    'd',
    'M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z'
  );

  const pathStyles = {
    fill: 'currentColor',
    stroke: 'none',
    'stroke-width': '0',
    margin: '0',
    padding: '0',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    'box-sizing': 'border-box',
    'vertical-align': 'baseline',
    opacity: '1',
    visibility: 'visible',
    transform: 'none',
    transition: 'none',
    animation: 'none',
    filter: 'none',
    'clip-path': 'none',
    mask: 'none',
    'pointer-events': 'none',
    'user-select': 'none',
  };
  applyProtectedStyles(path as any, pathStyles);

  svg.appendChild(path);
  button.appendChild(svg);

  return button;
};

const applyContentKey = (node: Node, contentKey: string): void => {
  if (node.nodeType === Node.TEXT_NODE && node.textContent) {
    const parent = node.parentElement;
    // Avoid re-wrapping if parent already has the correct key
    if (parent?.getAttribute('data-content-key') === contentKey) {
      return;
    }

    const span = document.createElement('span');
    span.setAttribute('data-content-key', contentKey);
    span.textContent = node.textContent;

    // Apply minimal protected styling to content spans
    // Only protect essential properties to avoid breaking text flow
    const contentSpanStyles = {
      display: 'inline',
      'box-sizing': 'border-box',
    };
    applyProtectedStyles(span, contentSpanStyles);

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
  if (element.nodeType === Node.TEXT_NODE && element.textContent?.trim()) {
    // Check if the parent element already has a content key
    const parentElement = element.parentElement;
    const existingContentKey = parentElement?.getAttribute('data-content-key');

    let matchedItem: ContentNode | undefined;

    if (existingContentKey) {
      // If parent already has content key, find by content key to ensure consistency
      matchedItem = content.find((item) =>
        item.contentKey.includes(existingContentKey)
      );
    } else {
      // Find if this text node's content matches any of the items to be highlighted.
      // Use enhanced matching to handle:
      // - Variables like {days}, {name}, {{userName}}, {{count}}, etc.
      // - HTML tags in templates like <strong>{{userName}}</strong>
      matchedItem = content.find(
        (item) =>
          (item.type === 'text' || item.type === 'variation') &&
          element.textContent &&
          matchesWithHtmlSupport(element.textContent, item.text)
      );
    }

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
            return matchesWithHtmlSupport(contentValue, item.text);
          } else if (item.type === 'variation') {
            return matchesWithHtmlSupport(
              contentValue,
              item.variation || item.text
            );
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
      // For elements showing pending changes, we should skip the contentValue check
      // since the displayed text won't match the original text in memoryMap
      const isShowingPendingChange = element.getAttribute(
        'data-content-showing-pending-change'
      );

      if (!contentValue) {
        return;
      }

      // Skip memoryMap check for pending changes, or check if content exists in memoryMap
      // For content with variables, we need to do a more sophisticated check
      if (!isShowingPendingChange) {
        let contentFound = window.memoryMap.has(contentValue);

        // If direct lookup fails and this is text content, try enhanced matching
        if (!contentFound && !isImg && !isInput) {
          const normalizedContentValue = normalizeWhitespace(contentValue.trim());

          for (const [templateText] of window.memoryMap) {
            // Strategy 1: Try variable-aware matching with original template
            if (hasVariables(templateText)) {
              try {
                const pattern = createVariablePattern(templateText);
                if (pattern.test(normalizedContentValue)) {
                  contentFound = true;
                  break;
                }
              } catch {
                // Skip this template if regex fails
                continue;
              }
            }

            // Strategy 2: Strip HTML and try matching
            const strippedTemplate = stripHtmlTags(templateText);
            if (strippedTemplate !== templateText) {
              const normalizedStripped = normalizeWhitespace(strippedTemplate);

              if (hasVariables(strippedTemplate)) {
                try {
                  const pattern = createVariablePattern(strippedTemplate);
                  if (pattern.test(normalizedContentValue)) {
                    contentFound = true;
                    break;
                  }
                } catch {
                  continue;
                }
              } else if (normalizedContentValue.includes(normalizedStripped)) {
                contentFound = true;
                break;
              }
            }
          }
        }

        if (!contentFound) {
          return;
        }
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

          // Reset inherited styles for wrapper
          resetInheritedStyles(wrapper);

          // Apply protected wrapper styles
          const wrapperStyles = {
            position: 'relative',
            display: 'inline-block',
            'vertical-align': 'baseline',
            'max-width': 'none',
            'max-height': 'none',
            'min-width': '0',
            'min-height': '0',
          };
          applyProtectedStyles(wrapper, wrapperStyles);

          if (element.parentNode) {
            element.parentNode.insertBefore(wrapper, element);
            wrapper.appendChild(element);
          }
        }

        // Apply highlight outline with protection
        const highlightStyles = {
          outline: '1px solid #1791FF',
          'border-radius': isImg ? '2px' : '4px',
          'outline-offset': '0',
        };
        applyProtectedStyles(wrapper, highlightStyles);
      } else {
        // For text nodes (spans), style them directly with protection
        const spanHighlightStyles = {
          outline: '1px solid #1791FF',
          'outline-offset': '4px',
          'border-radius': '2px',
          position: 'relative',
        };
        applyProtectedStyles(element, spanHighlightStyles);
      }

      const parentForControls = wrapper || element;

      // Prevent adding duplicate labels or buttons
      if (parentForControls.querySelector('#contentstorage-element-label')) {
        return;
      }

      const label = document.createElement('div');
      label.setAttribute('id', 'contentstorage-element-label');
      label.textContent = contentStorageId;

      // Reset inherited styles for label
      resetInheritedStyles(label);

      // Apply protected label styles
      const labelStyles: Record<string, string> = {
        position: 'absolute',
        left: 'calc(100% + 10px)',
        color: '#1791FF',
        'font-size': '10px',
        'font-weight': '400',
        'font-family':
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        'line-height': '1.2',
        'z-index': '9999',
        'pointer-events': 'none',
        'user-select': 'none',
        'white-space': 'nowrap',
        'text-align': 'left',
        display: 'block',
        'max-width': 'none',
        width: 'auto',
        height: 'auto',
      };

      if (isInput || isImg) {
        labelStyles['bottom'] = '0px';
      } else {
        labelStyles['top'] = '4px';
      }

      applyProtectedStyles(label, labelStyles);

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
        const textVal = Array.from(window.memoryMap).find(([, data]) => {
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
