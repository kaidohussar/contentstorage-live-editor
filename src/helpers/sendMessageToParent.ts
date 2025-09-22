import { MessagePayloadMap, OutgoingMessageType } from '../contants';

export const sendMessageToParent = <T extends OutgoingMessageType>(
  msgType: T,
  data: MessagePayloadMap[T]
) => {
  const msg = {
    type: msgType,
    payload: data,
  };

  // Could replace * here for extra security
  console.log('[Live editor] Sending message to parent:', msg);
  window.parent.postMessage(msg, '*');
};
