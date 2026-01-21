import { MessagePayloadMap, OutgoingMessageType } from '../contants';
import { isPipMode } from './urlParams';

export const sendMessageToParent = <T extends OutgoingMessageType>(
  msgType: T,
  data: MessagePayloadMap[T]
) => {
  const msg = {
    type: msgType,
    payload: data,
  };

  // In PiP mode, use window.opener; in iframe mode, use window.parent
  const targetWindow = isPipMode() ? window.opener : window.parent;

  if (!targetWindow) {
    console.error('[Live editor] No target window available');
    return;
  }

  // Could replace * here for extra security
  console.log('[Live editor] Sending message to parent:', msg);
  targetWindow.postMessage(msg, '*');
};
