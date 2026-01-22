import { PendingChangeSimple, ScreenshotResponsePayload } from './types';

export type OutgoingMessageType =
  (typeof OUTGOING_MESSAGE_TYPES)[keyof typeof OUTGOING_MESSAGE_TYPES];

export type ContentNode =
  | { type: 'text'; contentKey: string[]; text: string; elementPath: string }
  | { type: 'image'; contentKey: string[]; url: string; altText: string };

export const INCOMING_MESSAGE_TYPES = {
  HANDSHAKE_ACKNOWLEDGE: 'parent-handshake-acknowledge',
  SET_CONFIG: 'contentstorage-set-config',
  SET_HIGHLIGHT_CONTENT: 'contentstorage-set-highlight-content',
  SET_HIDE_HIGHLIGHT_CONTENT: 'contentstorage-set-hide-highlight-content',
  HIDE_ELEMENT_HIGHLIGHT: 'contentstorage-hide-element-highlight',
  SHOW_ELEMENT_HIGHLIGHT: 'contentstorage-show-element-highlight',
  SHOW_PENDING_CHANGES: 'contentstorage-show-pending-changes',
  SHOW_ORIGINAL_CONTENT: 'contentstorage-show-original-content',
  REQUEST_SCREENSHOT: 'contentstorage-request-screenshot',
  RECONNECT_PING: 'contentstorage-reconnect-ping',
} as const;

export const OUTGOING_MESSAGE_TYPES = {
  HANDSHAKE_INITIATE: 'contentstorage-handshake-initiate',
  CLICK_CONTENT_ITEM_EDIT_BTN: 'contentstorage-click-item-edit-btn',
  FOUND_CONTENT_NODES: 'contentstorage-found-content-nodes',
  SCREENSHOT_RESPONSE: 'contentstorage-screenshot-response',
  VISIBILITY_CHANGE: 'contentstorage-visibility-change',
  RECONNECT_PONG: 'contentstorage-reconnect-pong',
} as const;

export type MessagePayloadMap = {
  [OUTGOING_MESSAGE_TYPES.HANDSHAKE_INITIATE]: string;
  [OUTGOING_MESSAGE_TYPES.CLICK_CONTENT_ITEM_EDIT_BTN]: {
    contentKey: string;
  };
  [OUTGOING_MESSAGE_TYPES.FOUND_CONTENT_NODES]: {
    contentNodes: ContentNode[];
  };
  [OUTGOING_MESSAGE_TYPES.SCREENSHOT_RESPONSE]: ScreenshotResponsePayload;
  [OUTGOING_MESSAGE_TYPES.VISIBILITY_CHANGE]: {
    isVisible: boolean;
  };
  [OUTGOING_MESSAGE_TYPES.RECONNECT_PONG]: null;
};

export type IncomingMessagePayloadMap = {
  [INCOMING_MESSAGE_TYPES.SHOW_PENDING_CHANGES]: PendingChangeSimple[];
  [INCOMING_MESSAGE_TYPES.REQUEST_SCREENSHOT]: { quality?: number } | null;
  [INCOMING_MESSAGE_TYPES.HIDE_ELEMENT_HIGHLIGHT]: { contentKey: string };
  [INCOMING_MESSAGE_TYPES.SHOW_ELEMENT_HIGHLIGHT]: { contentKey: string };
};

export const COMMUNICATION_TIMEOUT_MS = 5000; // 5 seconds

export const IFRAME_PARENT_ORIGIN = 'https://contentstorage.app';
