import { PendingChangeSimple } from './types';

export type OutgoingMessageType =
  (typeof OUTGOING_MESSAGE_TYPES)[keyof typeof OUTGOING_MESSAGE_TYPES];

export type ContentNode =
  | { type: 'text'; contentKey: string[]; text: string }
  | { type: 'variation'; contentKey: string[]; text: string; variation: string }
  | { type: 'image'; contentKey: string[]; url: string; altText: string };

export const INCOMING_MESSAGE_TYPES = {
  HANDSHAKE_ACKNOWLEDGE: 'parent-handshake-acknowledge',
  SET_CONFIG: 'contentstorage-set-config',
  SET_HIGHLIGHT_CONTENT: 'contentstorage-set-highlight-content',
  SET_HIDE_HIGHLIGHT_CONTENT: 'contentstorage-set-hide-highlight-content',
  SHOW_PENDING_CHANGES: 'contentstorage-show-pending-changes',
  SHOW_ORIGINAL_CONTENT: 'contentstorage-show-original-content',
} as const;

export const OUTGOING_MESSAGE_TYPES = {
  HANDSHAKE_INITIATE: 'contentstorage-handshake-initiate',
  CLICK_CONTENT_ITEM_EDIT_BTN: 'contentstorage-click-item-edit-btn',
  FOUND_CONTENT_NODES: 'contentstorage-found-content-nodes',
} as const;

export type MessagePayloadMap = {
  [OUTGOING_MESSAGE_TYPES.HANDSHAKE_INITIATE]: string;
  [OUTGOING_MESSAGE_TYPES.CLICK_CONTENT_ITEM_EDIT_BTN]: {
    contentKey: string;
  };
  [OUTGOING_MESSAGE_TYPES.FOUND_CONTENT_NODES]: {
    contentNodes: ContentNode[];
  };
};

export type IncomingMessagePayloadMap = {
  [INCOMING_MESSAGE_TYPES.SHOW_PENDING_CHANGES]: PendingChangeSimple[];
};

export const COMMUNICATION_TIMEOUT_MS = 5000; // 5 seconds

export const IFRAME_PARENT_ORIGIN = 'https://contentstorage.app';
