import { sendMessageToParent } from './sendMessageToParent';
import { OUTGOING_MESSAGE_TYPES } from '../contants';

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

export const highlightContentstorageElements = () => {
  // 1. Find all elements with the 'data-content-key' attribute.
  const elements = document.querySelectorAll<HTMLElement>('[data-content-key]');
  console.log('ELEMENTS', elements);
  // 2. Iterate over the found elements.
  elements.forEach((element) => {
    // 3. Get the value of the 'data-content-key' attribute.
    const contentStorageId = element.dataset.contentKey;

    if (contentStorageId) {
      element.style.outline = `1px solid #1791FF`;
      element.style.position = 'relative'; // Needed for absolute positioning of the label

      // 5. Create and style the label for the top-left corner.
      const label = document.createElement('div');
      label.setAttribute('id', 'contentstorage-element-label');
      label.textContent = contentStorageId;
      label.style.position = 'absolute';
      label.style.top = '-15px';
      label.style.left = '0px';
      label.style.color = '#1791FF';
      label.style.fontSize = '10px';
      label.style.zIndex = '9999'; // Ensure it's on top
      label.style.pointerEvents = 'none'; // So it doesn't interfere with clicks on the element

      const button = editButton(contentStorageId);

      // 6. Append the label to the element.
      element.appendChild(label);
      element.appendChild(button);
    }
  });
};
