export type OutgoingMessageType =
  (typeof OUTGOING_MESSAGE_TYPES)[keyof typeof OUTGOING_MESSAGE_TYPES];

export const INCOMING_MESSAGE_TYPES = {
  HANDSHAKE_ACKNOWLEDGE: 'parent-handshake-acknowledge',
  SET_CONFIG: 'contentstorage-set-config',
} as const;

export const OUTGOING_MESSAGE_TYPES = {
  HANDSHAKE_INITIATE: 'contentstorage-handshake-initiate',
  CLICK_CONTENT_ITEM_EDIT_BTN: 'contentstorage-click-item-edit-btn',
  VISIBLE_CONTENT_KEYS: 'contentstorage-visible-content-keys',
} as const;

export type MessagePayloadMap = {
  [OUTGOING_MESSAGE_TYPES.HANDSHAKE_INITIATE]: string;
  [OUTGOING_MESSAGE_TYPES.CLICK_CONTENT_ITEM_EDIT_BTN]: {
    contentKey: string;
  };
  [OUTGOING_MESSAGE_TYPES.VISIBLE_CONTENT_KEYS]: string[];
};

export const COMMUNICATION_TIMEOUT_MS = 5000; // 5 seconds

export const IFRAME_PARENT_ORIGIN = 'https://contentstorage.app';
