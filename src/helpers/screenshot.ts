import { domToBlob } from 'modern-screenshot';
import { OUTGOING_MESSAGE_TYPES } from '../contants';
import { sendMessageToParent } from './sendMessageToParent';
import { ScreenshotResponsePayload } from '../types';

const SCREENSHOT_OPTIONS = {
  quality: 0.95,
  type: 'image/png' as const,
  scale: window.devicePixelRatio,
  backgroundColor: '#ffffff',
};

export const handleScreenshotRequest = async (): Promise<void> => {
  console.log('[Screenshot] Request received from Contentstorage');

  try {
    console.log('[Screenshot] Capturing with modern-screenshot...');

    // Capture screenshot
    const blob = await domToBlob(document.body, SCREENSHOT_OPTIONS);

    console.log(
      '[Screenshot] Captured successfully, converting to data URL...'
    );
    console.log('[Screenshot] Blob size:', (blob.size / 1024).toFixed(2), 'KB');

    // Convert blob to data URL
    const reader = new FileReader();

    reader.onloadend = () => {
      console.log('[Screenshot] Sending back to Contentstorage...');

      const successPayload: ScreenshotResponsePayload = {
        screenshotDataUrl: reader.result as string,
        success: true,
      };

      sendMessageToParent(
        OUTGOING_MESSAGE_TYPES.SCREENSHOT_RESPONSE,
        successPayload
      );

      console.log('[Screenshot] Sent successfully');
    };

    reader.onerror = () => {
      console.error('[Screenshot] FileReader error');
      throw new Error('Failed to convert blob to data URL');
    };

    reader.readAsDataURL(blob);
  } catch (error) {
    console.error('[Screenshot] Error capturing:', error);

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
