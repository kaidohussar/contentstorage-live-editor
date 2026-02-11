import { snapdom } from '@zumer/snapdom';
import { OUTGOING_MESSAGE_TYPES } from '../contants';
import { sendMessageToParent } from './sendMessageToParent';
import { ScreenshotResponsePayload, ScreenshotContentItem } from '../types';
import { isScreenshotModeEnabled } from './urlParams';

/**
 * Get screenshot options configured for snapdom
 * @param quality - Quality of the screenshot (0-1), defaults to 0.95
 * @param maxWidth - Optional max width to cap the screenshot resolution
 */
const getScreenshotOptions = (quality = 0.95, maxWidth?: number) => {
  const viewportWidth = document.documentElement.clientWidth;
  const needsResize = maxWidth && viewportWidth > maxWidth;

  return {
    type: (needsResize ? 'jpeg' : 'png') as 'jpeg' | 'png',
    quality,
    dpr: needsResize ? 1 : window.devicePixelRatio,
    ...(needsResize ? { width: maxWidth } : {}),
    backgroundColor: '#ffffff',
    fast: true,
  };
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

/**
 * Collect active content from memoryMap
 * @returns Array of content items currently visible on screen
 */
const collectActiveContent = (): ScreenshotContentItem[] => {
  const content: ScreenshotContentItem[] = [];

  if (!window.memoryMap) {
    return content;
  }

  window.memoryMap.forEach((entry, value) => {
    entry.ids.forEach((id) => {
      content.push({
        contentKey: id,
        value,
        variables: entry.variables,
      });
    });
  });

  return content;
};

/**
 * Refresh content by calling the i18next plugin's refresh function
 * This clears memoryMap and triggers React re-render to repopulate with active translations
 */
const refreshContent = async (): Promise<void> => {
  if (window.__contentstorageRefresh) {
    console.log('[Live editor] Refreshing content...');
    window.__contentstorageRefresh();

    // Wait for React re-render
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 100));
    });

    console.log('[Live editor] Content refreshed, memoryMap size:', window.memoryMap?.size || 0);
  } else {
    console.log('[Live editor] __contentstorageRefresh not available, using existing memoryMap');
  }
};

export const handleScreenshotRequest = async (quality?: number, maxWidth?: number): Promise<void> => {
  console.log('[Live editor] Screenshot request received from Contentstorage');
  console.log(`[Live editor] Screenshot quality set to ${quality ?? 0.95}, maxWidth: ${maxWidth ?? 'none'}`);

  // Store references for cleanup
  let hiddenButtons: HTMLElement[] = [];

  try {
    // Step 0: Refresh content to get only active translations
    await refreshContent();

    // Step 1: Hide edit buttons (labels stay visible)
    console.log('[Live editor] Hiding edit buttons...');
    hiddenButtons = hideEditButtons();

    // Step 2: Capture screenshot with snapdom (returns blob directly)
    console.log('[Live editor] Capturing viewport with snapdom...');
    const options = getScreenshotOptions(quality, maxWidth);

    const blob = await snapdom.toBlob(document.body, options);

    // Step 3: Restore edit buttons
    console.log('[Live editor] Restoring edit buttons...');
    showEditButtons(hiddenButtons);

    if (!blob) {
      throw new Error('Failed to generate screenshot blob');
    }

    console.log(
      `[Live editor] Screenshot captured successfully (${(blob.size / 1024).toFixed(2)} KB)`
    );

    if (isScreenshotModeEnabled()) {
      // TODO: Send blob directly to backend API
      console.log(
        '[Live editor] Screenshot mode: Backend upload not supported yet'
      );
      return;
    }

    // Collect active content from refreshed memoryMap
    const activeContent = collectActiveContent();
    console.log(`[Live editor] Collected ${activeContent.length} content items`);

    // Iframe mode: Send via postMessage to parent
    const reader = new FileReader();

    reader.onloadend = () => {
      console.log('[Live editor] Sending screenshot back to Contentstorage...');

      const successPayload: ScreenshotResponsePayload = {
        screenshotDataUrl: reader.result as string,
        success: true,
        content: activeContent,
        language: window.currentLanguageCode,
        path: window.location.pathname,
      };

      sendMessageToParent(
        OUTGOING_MESSAGE_TYPES.SCREENSHOT_RESPONSE,
        successPayload
      );

      console.log('[Live editor] Screenshot sent successfully');
    };

    reader.onerror = () => {
      console.error('[Live editor] FileReader error');
      throw new Error('Failed to convert blob to data URL');
    };

    reader.readAsDataURL(blob);
  } catch (error) {
    console.error('[Live editor] Error capturing screenshot:', error);

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
