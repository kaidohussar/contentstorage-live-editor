import { MessagePayloadMap, OutgoingMessageType } from '../contants';

export const sendMessageToParent = <T extends OutgoingMessageType>(
  msgType: T,
  data: MessagePayloadMap[T]
) => {
  const msg = {
    type: msgType,
    payload: data,
  };

  // Replace "*" with the specific target origin of the parent application for enhanced security.
  console.log('CDN Script: Sending message to parent:', msg);
  window.parent.postMessage(msg, '*');
};
