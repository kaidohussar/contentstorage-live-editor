export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export const MESSAGE_TYPES = {
  HANDSHAKE_INITIATE: 'contentstorage-handshake-initiate',
  HANDSHAKE_ACKNOWLEDGE: 'parent-handshake-acknowledge',
  SET_CONFIG: 'contentstorage-set-config',
} as const;

export const COMMUNICATION_TIMEOUT_MS = 5000; // 5 seconds

export const IFRAME_PARENT_ORIGIN = 'https://contentstorage.app';
