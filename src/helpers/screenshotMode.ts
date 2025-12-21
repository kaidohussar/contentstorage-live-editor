import { handleScreenshotRequest } from './screenshot';

/**
 * Create and inject the camera button into the DOM
 */
export const createCameraButton = (): HTMLButtonElement => {
  const button = document.createElement('button');
  button.id = 'contentstorage-screenshot-button';

  // Camera SVG icon
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4"></circle>
    </svg>
  `;

  // Apply styles
  Object.assign(button.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#49467f',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)',
    zIndex: '999999',
    transition: 'transform 0.2s, background-color 0.2s',
  });

  // Hover effects
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.backgroundColor = '#2f2d52';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.backgroundColor = '#49467f';
  });

  // Click handler - trigger screenshot
  button.addEventListener('click', async () => {
    // Visual feedback
    button.style.transform = 'scale(0.95)';
    button.style.opacity = '0.7';
    button.style.pointerEvents = 'none';

    try {
      await handleScreenshotRequest();
    } finally {
      // Restore button state after a delay
      setTimeout(() => {
        button.style.transform = 'scale(1)';
        button.style.opacity = '1';
        button.style.pointerEvents = 'auto';
      }, 500);
    }
  });

  document.body.appendChild(button);
  console.log('[Live editor] Screenshot camera button added');

  return button;
};
