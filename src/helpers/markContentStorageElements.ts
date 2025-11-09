import { sendMessageToParent } from './sendMessageToParent';
import { ContentNode, OUTGOING_MESSAGE_TYPES } from '../contants';
import { PendingChangeSimple } from '../types';
import { isImageElement } from './typeguards';
import { renderTemplate } from './variableMatching';
import { normalizeWhitespace, stripHtmlTags } from './htmlUtils';

let isProcessing = false;

// Map to track content keys → element info (for positioning edit buttons)
interface ContentElementInfo {
  element: HTMLElement;
  contentValue: string; // The actual template/text that's in memoryMap
}
const contentKeyToElements = new Map<string, ContentElementInfo[]>();

/**
 * Exact text matching using template rendering with variables
 * Renders the template with variables and does exact string comparison
 */
const matchesExact = (
  domText: string,
  itemText: string,
  variables?: Record<string, string | number | boolean>
): boolean => {
  const normalizedDomText = normalizeWhitespace(domText.trim());
  const rendered = renderTemplate(itemText, variables);
  return rendered === normalizedDomText;
};

const applyProtectedStyles = (
  element: HTMLElement,
  styles: Record<string, string>
) => {
  Object.entries(styles).forEach(([property, value]) => {
    element.style.setProperty(property, value, 'important');
  });
};

const removeProtectedStyles = (
  element: HTMLElement,
  properties: string[]
) => {
  properties.forEach(prop => element.style.removeProperty(prop));
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

/**
 * Track content element for positioning edit buttons (React-safe, no DOM modification of text nodes)
 */
const trackContentElement = (node: Node, contentKey: string, templateText?: string): void => {
  if (node.nodeType === Node.TEXT_NODE && node.textContent) {
    // Track parent element for positioning edit buttons
    const parentElement = node.parentElement;
    if (parentElement && templateText) {
      // Set data-content-key attribute so showPendingChanges() can find this element
      parentElement.setAttribute('data-content-key', contentKey);

      if (!contentKeyToElements.has(contentKey)) {
        contentKeyToElements.set(contentKey, []);
      }
      contentKeyToElements.get(contentKey)!.push({
        element: parentElement,
        contentValue: templateText
      });
    }
  }
  // Handle Element Nodes (like IMG/INPUT) by setting the attribute directly
  else if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
    // Avoid reapplying the same attribute
    if (element.getAttribute('data-content-key') === contentKey) {
      return;
    }
    element.setAttribute('data-content-key', contentKey);
  }
};

/**
 * Checks if we should skip wrapping this text node because an ancestor or sibling
 * already has been marked with the same content key.
 * This prevents duplicate highlighting of text fragments from the same content.
 *
 * @param node The text node to check
 * @param contentKey The content key we're trying to apply
 * @returns true if we should skip wrapping this node
 */
const shouldSkipTextNodeWrapping = (
  node: Node,
  contentKey: string
): boolean => {
  const parent = node.parentElement;
  if (!parent) return false;

  // Check if parent already has the content key - most common case
  if (parent.getAttribute('data-content-key') === contentKey) {
    return true;
  }

  // Check if any sibling element (previously wrapped text node) has this content key
  // This handles cases where text nodes at the same level have already been processed
  for (const child of Array.from(parent.children)) {
    if (child.getAttribute('data-content-key') === contentKey) {
      return true; // A sibling was already wrapped, skip this one
    }
  }

  // Check ancestors up to a reasonable depth
  // This prevents duplicate marking when text nodes are in nested structures
  let ancestor = parent.parentElement;
  let depth = 0;
  const MAX_DEPTH = 5; // Don't traverse too far up the DOM tree

  while (ancestor && ancestor !== document.body && depth < MAX_DEPTH) {
    if (ancestor.getAttribute('data-content-key') === contentKey) {
      return true;
    }
    ancestor = ancestor.parentElement;
    depth++;
  }

  return false;
};

const findAndMarkElements = (
  element: Node,
  content: ContentNode[],
  templateLookup: Map<string, { template: string; variables?: Record<string, string | number | boolean> }>
): void => {
  if (element.nodeType === Node.TEXT_NODE && element.textContent?.trim()) {
    // Check if the parent element already has a content key
    const parentElement = element.parentElement;
    const existingContentKey = parentElement?.getAttribute('data-content-key');

    let matchedItem: ContentNode | undefined;
    // Variable to capture the original template (with HTML) for tracking
    let originalTemplate: string | undefined = undefined;

    if (existingContentKey) {
      // If parent already has content key, find by content key to ensure consistency
      matchedItem = content.find((item) =>
        item.contentKey.includes(existingContentKey)
      );
    } else {
      // Find if this text node's content matches any of the items to be highlighted.
      // Use exact matching with variable rendering
      // Use parent's textContent to get combined text (handles HTML tags that split text nodes)
      const parentText = element.parentElement?.textContent?.trim();

      matchedItem = content.find((item) => {
        if (
          (item.type === 'text' || item.type === 'variation') &&
          parentText
        ) {
          // O(1) lookup using pre-built template map
          const templateData = templateLookup.get(item.text);
          if (templateData) {
            const isMatch = matchesExact(
              parentText,
              templateData.template,
              templateData.variables
            );
            if (isMatch) {
              // Store the original template (with HTML) for tracking
              originalTemplate = templateData.template;
            }
            return isMatch;
          }
          // Fallback to matching without variables (shouldn't happen often)
          return matchesExact(parentText, item.text);
        }
        return false;
      });
    }

    if (matchedItem) {
      const contentKey =
        matchedItem.contentKey[matchedItem.contentKey.length - 1];

      // Check if we should skip wrapping this text node to prevent duplicates
      if (!shouldSkipTextNodeWrapping(element, contentKey)) {
        // If a match is found and no ancestor/sibling already has this key, track it
        // Use originalTemplate (with HTML) if available, otherwise fall back to matchedItem.text
        const templateText = matchedItem.type === 'image' ? undefined : (originalTemplate || matchedItem.text);
        trackContentElement(element, contentKey, templateText);
      }
    } else {
      // If no match is found, mark it as checked
      // Only if not already part of marked content
      if (!shouldSkipTextNodeWrapping(element, '')) {
        trackContentElement(element, 'checked');
      }
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
            // O(1) lookup using pre-built template map
            const templateData = templateLookup.get(item.text);
            if (templateData) {
              return matchesExact(
                contentValue,
                templateData.template,
                templateData.variables
              );
            }
            return matchesExact(contentValue, item.text);
          } else if (item.type === 'variation') {
            const textToMatch = item.variation || item.text;
            // O(1) lookup using pre-built template map
            const templateData = templateLookup.get(textToMatch);
            if (templateData) {
              return matchesExact(
                contentValue,
                templateData.template,
                templateData.variables
              );
            }
            return matchesExact(contentValue, textToMatch);
          }
          return false;
        });
      }
    }

    if (matchedItem) {
      // If a match is found, track the element.
      trackContentElement(
        element,
        matchedItem.contentKey[matchedItem.contentKey.length - 1]
      );
    } else {
      // If no match is found, mark as checked.
      trackContentElement(element, 'checked');
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
    findAndMarkElements(child, content, templateLookup);
  }
};

export const markContentStorageElements = (
  content: ContentNode[],
  shouldHighlight: boolean
) => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // Clear previous tracking before applying new ones
    contentKeyToElements.clear();

    // Create reverse lookup map for O(1) template lookups
    // Maps: HTML-stripped template → { original template with HTML, variables }
    const templateLookup = new Map<string, { template: string; variables?: Record<string, string | number | boolean> }>();

    for (const [templateText, contentData] of window.memoryMap) {
      const strippedTemplate = stripHtmlTags(templateText);
      templateLookup.set(strippedTemplate, {
        template: templateText,
        variables: contentData.variables
      });
    }

    // First, find and wrap matching text in spans with data-content-key
    if (content && content?.length > 0) {
      findAndMarkElements(document.body, content, templateLookup);
    }

    // Then position edit buttons for highlighted content
    // For text content: use contentKeyToElements map (CSS highlights don't create DOM elements)
    // For IMG/INPUT: still use data-content-key attribute
    const attributeElements = document.querySelectorAll<HTMLElement>('[data-content-key]');

    // Combine elements from both sources
    const allContentElements = new Map<string, HTMLElement>();

    // Add IMG/INPUT elements that have data-content-key
    attributeElements.forEach((element) => {
      const key = element.dataset.contentKey;
      if (key) {
        allContentElements.set(key, element);
      }
    });

    // Add text content elements from our tracking map
    contentKeyToElements.forEach((infos, contentKey) => {
      // Use the first parent element for this content key
      const firstInfo = infos[0];
      if (firstInfo && !allContentElements.has(contentKey)) {
        // Store the element with a special marker so we know to use the tracked contentValue
        const element = firstInfo.element;
        element.setAttribute('data-tracked-content-value', firstInfo.contentValue);
        allContentElements.set(contentKey, element);
      }
    });

    allContentElements.forEach((element, contentStorageId) => {
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
        // For text content, use the tracked template value if available
        const trackedValue = element.getAttribute('data-tracked-content-value');
        if (trackedValue) {
          contentValue = trackedValue;
          // Clean up the temporary attribute
          element.removeAttribute('data-tracked-content-value');
        } else {
          contentValue = element.textContent;
        }
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

        // If direct lookup fails and this is text content, try exact matching with renderTemplate
        if (!contentFound && !isImg && !isInput) {
          const normalizedContentValue = normalizeWhitespace(
            contentValue.trim()
          );

          for (const [templateText, contentData] of window.memoryMap) {
            // Render template with variables and do exact matching
            const rendered = renderTemplate(
              templateText,
              contentData.variables
            );

            if (rendered === normalizedContentValue) {
              contentFound = true;
              break;
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
            try {
              element.parentNode.insertBefore(wrapper, element);
              wrapper.appendChild(element);
            } catch (error) {
              console.debug(
                '[Live editor] Failed to wrap image/input element:',
                error
              );
            }
          }
        }

        // Apply highlight outline with protection
        const highlightStyles = {
          outline: '1px solid #1791FF',
          'border-radius': isImg ? '2px' : '4px',
          'outline-offset': '0',
        };
        applyProtectedStyles(wrapper, highlightStyles);
        wrapper.setAttribute('data-contentstorage-styled', 'wrapper');
      } else {
        // For text nodes (parent elements), style them directly with protection
        const spanHighlightStyles = {
          outline: '1px solid #1791FF',
          'outline-offset': '4px',
          'border-radius': '2px',
          position: 'relative',
        };
        applyProtectedStyles(element, spanHighlightStyles);
        element.setAttribute('data-contentstorage-styled', 'text');
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
  // Clear tracking map
  contentKeyToElements.clear();

  // Remove styles from elements we styled (preserves pre-existing inline styles)
  const styledElements = document.querySelectorAll<HTMLElement>('[data-contentstorage-styled]');
  styledElements.forEach((element) => {
    const styleType = element.getAttribute('data-contentstorage-styled');

    if (styleType === 'text') {
      // Remove text highlight styles
      removeProtectedStyles(element, [
        'outline',
        'outline-offset',
        'border-radius',
        'position'
      ]);
    } else if (styleType === 'wrapper') {
      // Remove wrapper styles
      removeProtectedStyles(element, [
        'outline',
        'outline-offset',
        'border-radius',
        'position',
        'display',
        'vertical-align',
        'max-width',
        'max-height',
        'min-width',
        'min-height'
      ]);
    }

    // Remove marker attribute
    element.removeAttribute('data-contentstorage-styled');
  });

  // Clean up wrapper elements (unwrap IMG/INPUT)
  const wrappers = document.querySelectorAll<HTMLElement>(
    '#contentstorage-element-image-wrapper, #contentstorage-element-input-wrapper'
  );
  wrappers.forEach((wrapper) => {
    const elementToUnwrap = wrapper.querySelector('img, input');
    const parent = wrapper.parentNode;

    if (parent && elementToUnwrap) {
      try {
        parent.insertBefore(elementToUnwrap, wrapper);
        parent.removeChild(wrapper);
      } catch (error) {
        console.debug('[Live editor] Failed to unwrap element:', error);
      }
    }
  });

  // Remove data-content-key attributes from IMG/INPUT elements
  const elements = document.querySelectorAll<HTMLElement>('[data-content-key]');
  elements.forEach((element) => {
    element.removeAttribute('data-content-key');
  });

  // Remove labels and buttons
  const labels = document.querySelectorAll<HTMLElement>('#contentstorage-element-label');
  const buttons = document.querySelectorAll<HTMLElement>('#contentstorage-element-button');
  [...labels, ...buttons].forEach((item) => item.remove());
};

export const showPendingChanges = (pendingChanges: PendingChangeSimple[]) => {
  console.log('[Pending Changes] Processing pending changes:', {
    count: pendingChanges.length,
    currentLanguageCode: window.currentLanguageCode,
    changes: pendingChanges.map(c => ({ contentId: c.contentId, langCountry: c.langCountry, value: c.value }))
  });

  pendingChanges.forEach((change, index) => {
    console.log(`[Pending Changes] [${index + 1}/${pendingChanges.length}] Processing change:`, {
      contentId: change.contentId,
      langCountry: change.langCountry,
      value: change.value
    });

    const elem = document.querySelector(
      `[data-content-key="${change.contentId}"]`
    );

    if (!elem) {
      console.warn(`[Pending Changes] Element NOT FOUND for contentId: "${change.contentId}"`);
      return;
    }

    console.log(`[Pending Changes] Element FOUND:`, {
      tagName: (elem as HTMLElement).tagName,
      className: (elem as HTMLElement).className,
      childNodesCount: elem.childNodes.length
    });

    const childNodes = elem.childNodes;

    console.log('[Pending Changes] Child nodes:', Array.from(childNodes).map((node, i) => ({
      index: i,
      nodeType: node.nodeType,
      nodeName: node.nodeName,
      textContent: node.nodeType === Node.TEXT_NODE ? `"${node.textContent}"` : (node as HTMLElement).id || 'no-id'
    })));

    // Loop through all the child nodes
    for (const node of childNodes) {
      // Check if the node is a text node (nodeType === 3)
      // and if its content is not just whitespace.
      if (
        node.nodeType === Node.TEXT_NODE &&
        node.textContent &&
        node.textContent.trim().length > 0
      ) {
        console.log('[Pending Changes] Found text node:', {
          textContent: `"${node.textContent}"`,
          trimmedLength: node.textContent.trim().length
        });

        const textVal = change.value?.toString() || '';

        console.log('[Pending Changes] Language comparison:', {
          'change.langCountry': change.langCountry,
          'change.langCountry.toLowerCase()': change.langCountry?.toLowerCase(),
          'window.currentLanguageCode': window.currentLanguageCode,
          'window.currentLanguageCode.toLowerCase()': window.currentLanguageCode?.toLowerCase(),
          'match': change.langCountry?.toLowerCase() === window.currentLanguageCode?.toLowerCase(),
          'textVal': textVal
        });

        if (textVal && change.langCountry?.toLowerCase() === window.currentLanguageCode?.toLowerCase()) {
          console.log('[Pending Changes] ✓ UPDATE APPLIED:', {
            oldValue: node.textContent,
            newValue: change.value?.toString()
          });
          elem.setAttribute('data-content-showing-pending-change', 'true');
          node.nodeValue = change.value?.toString() || '';
        } else {
          console.warn('[Pending Changes] ✗ UPDATE SKIPPED:', {
            reason: !textVal ? 'textVal is empty' : 'language code mismatch',
            textVal,
            langMatch: change.langCountry?.toLowerCase() === window.currentLanguageCode?.toLowerCase()
          });
        }

        break; // Remove this 'break' if you want to replace ALL text nodes with the new text.
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
