export type PendingChangeSimple = {
  contentId: string;
  langCountry: string;
  value: unknown;
};

export type ContentNodeData = {
  type: 'text' | 'image' | 'variation';
  text: string;
  contentKey: string[];
  variation?: string;
};
