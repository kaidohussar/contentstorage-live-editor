import { domToBlob } from 'modern-screenshot';
import { OUTGOING_MESSAGE_TYPES } from '../contants';
import { sendMessageToParent } from './sendMessageToParent';
import { ScreenshotResponsePayload } from '../types';

/**
 * Get screenshot options configured for capturing only the visible viewport area
 */
const getScreenshotOptions = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
  quality: 0.95,
  type: 'image/png' as const,
  scale: window.devicePixelRatio,
  backgroundColor: '#ffffff',
  features: {
    restoreScrollPosition: false, // Don't include scrolled content outside viewport
    copyScrollbar: false, // Don't include scrollbars in the screenshot
  },
});

/**
 * Temporarily hides edit buttons (NOT labels) from the page
 * @returns Array of hidden button elements for later restoration
 */
const hideEditButtons = (): HTMLElement[] => {
  const buttons = document.querySelectorAll<HTMLElement>(
    '#contentstorage-element-button'
  );

  const buttonArray = Array.from(buttons);

  // Hide by setting display to none instead of removing from DOM
  buttonArray.forEach((button) => {
    button.style.setProperty('display', 'none', 'important');
  });

  return buttonArray;
};

/**
 * Restores previously hidden edit buttons
 * @param buttons Array of button elements to restore
 */
const showEditButtons = (buttons: HTMLElement[]): void => {
  buttons.forEach((button) => {
    // Restore to display: flex (the original button style) with !important
    button.style.setProperty('display', 'flex', 'important');
  });
};

export const handleScreenshotRequest = async (): Promise<void> => {
  console.log('[Live editor] Request received from Contentstorage');

  // Store reference to hidden buttons for restoration
  let hiddenButtons: HTMLElement[] = [];

  try {
    // Step 1: Hide edit buttons (labels stay visible)
    console.log('[Live editor] Hiding edit buttons...');
    hiddenButtons = hideEditButtons();

    // Step 2: Capture screenshot (only visible viewport area)
    console.log('[Live editor] Capturing visible viewport area');
    const options = getScreenshotOptions();
    console.log(
      `[Live editor] Viewport dimensions: ${options.width}x${options.height}`
    );
    const blob = await domToBlob(document.body, options);

    console.log(
      '[Live editor] Captured successfully, converting to data URL...'
    );
    console.log(
      '[Live editor] Blob size:',
      (blob.size / 1024).toFixed(2),
      'KB'
    );

    // Step 3: Restore edit buttons
    console.log('[Live editor] Restoring edit buttons...');
    showEditButtons(hiddenButtons);

    // Step 4: Convert blob to data URL
    const reader = new FileReader();

    reader.onloadend = () => {
      console.log('[Live editor] Sending back to Contentstorage...');

      const successPayload: ScreenshotResponsePayload = {
        screenshotDataUrl: reader.result as string,
        success: true,
      };

      sendMessageToParent(
        OUTGOING_MESSAGE_TYPES.SCREENSHOT_RESPONSE,
        successPayload
      );

      console.log('[Live editor] Sent successfully');
    };

    reader.onerror = () => {
      console.error('[Live editor] FileReader error');
      throw new Error('Failed to convert blob to data URL');
    };

    reader.readAsDataURL(blob);
  } catch (error) {
    console.error('[Live editor] Error capturing:', error);

    // Make sure to restore buttons even if capture fails
    if (hiddenButtons.length > 0) {
      console.log('[Live editor] Restoring edit buttons after error...');
      showEditButtons(hiddenButtons);
    }

    const errorPayload: ScreenshotResponsePayload = {
      screenshotDataUrl: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    sendMessageToParent(
      OUTGOING_MESSAGE_TYPES.SCREENSHOT_RESPONSE,
      errorPayload
    );
  }
};
