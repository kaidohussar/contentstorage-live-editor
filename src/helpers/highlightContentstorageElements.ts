export const highlightContentstorageElements = () => {
  // 1. Find all elements with the 'data-contentstorage-id' attribute.
  const elements = document.querySelectorAll<HTMLElement>(
    '[data-contentstorage-id]'
  );
  console.log('ELEMENTS', elements);
  // 2. Iterate over the found elements.
  elements.forEach((element) => {
    // 3. Get the value of the 'data-contentstorage-id' attribute.
    const contentStorageId = element.dataset.contentstorageId;

    if (contentStorageId) {
      element.style.outline = `1px solid #1791FF`;
      element.style.position = 'relative'; // Needed for absolute positioning of the label
      element.style.borderRadius = element.style.borderRadius
        ? element.style.borderRadius
        : '4px';

      // 5. Create and style the label for the top-left corner.
      const label = document.createElement('div');
      label.setAttribute('id', 'contentstorage-element-label');
      label.textContent = contentStorageId;
      label.style.position = 'absolute';
      label.style.top = '-17px';
      label.style.left = '0px';
      label.style.color = '#1791FF';
      label.style.padding = '2px 4px';
      label.style.fontSize = '10px';
      label.style.zIndex = '9999'; // Ensure it's on top
      label.style.pointerEvents = 'none'; // So it doesn't interfere with clicks on the element

      // 6. Append the label to the element.
      element.appendChild(label);
    }
  });
};
