export const getContentElementKeys = () => {
  const elements = document.querySelectorAll<HTMLElement>('[data-content-key]');
  return [...elements].map((el) => el.dataset.contentKey as string);
};
