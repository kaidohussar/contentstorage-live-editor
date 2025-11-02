import { toBlob } from 'html-to-image';
import { OUTGOING_MESSAGE_TYPES } from '../contants';
import { sendMessageToParent } from './sendMessageToParent';
import { ScreenshotResponsePayload } from '../types';

/**
 * Stores scroll position information for an element
 */
interface ScrollPosition {
  scrollTop: number;
  scrollLeft: number;
}

/**
 * Get screenshot options configured for capturing only the visible viewport area
 */
const getScreenshotOptions = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
  quality: 0.95,
  pixelRatio: window.devicePixelRatio, // Renamed from 'scale'
  backgroundColor: '#ffffff',
  style: {
    overflow: 'hidden', // Hide scrollbars in screenshot
  },
});

/**
 * Saves scroll positions of all scrolled elements in the page
 * @returns Map of elements to their scroll positions
 */
const saveScrollPositions = (): Map<Element, ScrollPosition> => {
  const scrollPositions = new Map<Element, ScrollPosition>();
  const allElements = document.querySelectorAll('*');

  allElements.forEach((element) => {
    // Only save if element has scrolled content
    if (element.scrollTop > 0 || element.scrollLeft > 0) {
      scrollPositions.set(element, {
        scrollTop: element.scrollTop,
        scrollLeft: element.scrollLeft,
      });
    }
  });

  console.log(
    `[Live editor] Saved scroll positions for ${scrollPositions.size} elements`
  );
  return scrollPositions;
};

/**
 * Resets all scrolled elements to top-left position (0, 0)
 * @param scrollPositions Map of elements that have scroll positions
 */
const resetScrollPositions = (
  scrollPositions: Map<Element, ScrollPosition>
): void => {
  scrollPositions.forEach((_, element) => {
    element.scrollTop = 0;
    element.scrollLeft = 0;
  });
  console.log('[Live editor] Reset all scroll positions to 0');
};

/**
 * Restores previously saved scroll positions
 * @param scrollPositions Map of elements to their original scroll positions
 */
const restoreScrollPositions = (
  scrollPositions: Map<Element, ScrollPosition>
): void => {
  scrollPositions.forEach((position, element) => {
    element.scrollTop = position.scrollTop;
    element.scrollLeft = position.scrollLeft;
  });
  console.log('[Live editor] Restored scroll positions');
};

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

  // Store references for cleanup
  let hiddenButtons: HTMLElement[] = [];
  let scrollPositions: Map<Element, ScrollPosition> = new Map();

  try {
    // Step 1: Save current scroll positions (CRITICAL for scroll preservation)
    console.log('[Live editor] Saving scroll positions...');
    scrollPositions = saveScrollPositions();

    // Step 2: Reset scroll positions to top (required for consistent screenshots)
    console.log('[Live editor] Resetting scroll positions...');
    resetScrollPositions(scrollPositions);

    // Step 3: Hide edit buttons (labels stay visible)
    console.log('[Live editor] Hiding edit buttons...');
    hiddenButtons = hideEditButtons();

    // Step 4: Capture screenshot (only visible viewport area)
    console.log('[Live editor] Capturing visible viewport area');
    const options = getScreenshotOptions();
    console.log(
      `[Live editor] Viewport dimensions: ${options.width}x${options.height}`
    );
    const blob = await toBlob(document.body, options);

    // Check if blob was created successfully
    if (!blob) {
      throw new Error('Failed to generate screenshot blob');
    }

    console.log(
      '[Live editor] Captured successfully, converting to data URL...'
    );
    console.log(
      '[Live editor] Blob size:',
      (blob.size / 1024).toFixed(2),
      'KB'
    );

    // Step 5: Restore edit buttons
    console.log('[Live editor] Restoring edit buttons...');
    showEditButtons(hiddenButtons);

    // Step 6: Restore scroll positions (CRITICAL for user experience)
    console.log('[Live editor] Restoring scroll positions...');
    restoreScrollPositions(scrollPositions);

    // Step 7: Convert blob to data URL
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

    // Make sure to restore buttons and scroll positions even if capture fails
    if (hiddenButtons.length > 0) {
      console.log('[Live editor] Restoring edit buttons after error...');
      showEditButtons(hiddenButtons);
    }

    if (scrollPositions.size > 0) {
      console.log('[Live editor] Restoring scroll positions after error...');
      restoreScrollPositions(scrollPositions);
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
