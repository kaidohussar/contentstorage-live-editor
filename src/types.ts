export type PendingChangeSimple = {
  contentId: string;
  langCountry: string;
  value: unknown;
};

export type ScreenshotContentItem = {
  contentKey: string;
  value: string;
  variables?: Record<string, string | number | boolean>;
};

export type ScreenshotResponsePayload =
  | {
      screenshotDataUrl: string;
      success: true;
      content: ScreenshotContentItem[];
      language: string | null;
    }
  | {
      screenshotDataUrl: '';
      success: false;
      error: string;
    };
