export function isImageElement(element: HTMLElement): element is HTMLImageElement {
  return element && element.tagName === 'IMG';
}