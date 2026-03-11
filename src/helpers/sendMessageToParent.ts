import { MessagePayloadMap, OutgoingMessageType } from '../contants';
import { isPipMode } from './urlParams';

// Store parent window reference (can be set dynamically via event.source during reconnection)
let parentWindowRef: Window | null = null;

// Extension mode: post to self window with source discrimination
let extensionMode = false;

export const setExtensionMode = (val: boolean): void => {
  extensionMode = val;
};

/**
 * Set the parent window reference dynamically.
 * Used during reconnection when event.source provides a valid reference to the parent.
 */
export const setParentWindowRef = (ref: Window | null): void => {
  parentWindowRef = ref;
  console.log('[Live editor] Parent window reference updated:', ref ? 'valid' : 'null');
};

/**
 * Get the parent window reference.
 * Priority: stored ref > window.opener (PiP) > window.parent (iframe)
 */
export const getParentWindowRef = (): Window | null => {
  if (parentWindowRef) {
    return parentWindowRef;
  }
  if (isPipMode() && window.opener && window.opener !== window) {
    return window.opener;
  }
  if (window.parent && window.parent !== window) {
    return window.parent;
  }
  return null;
};

export const sendMessageToParent = <T extends OutgoingMessageType>(
  msgType: T,
  data: MessagePayloadMap[T]
) => {
  const msg = {
    type: msgType,
    payload: data,
  };

  // Extension mode: post to self window with source wrapper for content script to pick up
  if (extensionMode) {
    console.log('[Live editor] Sending message via extension bridge:', msg);
    window.postMessage({ source: 'contentstorage-live-editor', ...msg }, '*');
    return;
  }

  const targetWindow = getParentWindowRef();

  if (!targetWindow) {
    console.error('[Live editor] No target window available');
    return;
  }

  // Could replace * here for extra security
  console.log('[Live editor] Sending message to parent:', msg);
  targetWindow.postMessage(msg, '*');
};
