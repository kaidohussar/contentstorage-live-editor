export const isElementVisible = (
  element: HTMLElement,
  checkOpacity = false,
  checkVisibilityCSS = false
): boolean => {
  if (!('checkVisibility' in element)) {
    return true;
  }

  return element.checkVisibility({
    checkOpacity,
    checkVisibilityCSS,
  });
};
