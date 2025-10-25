export type PendingChangeSimple = {
  contentId: string;
  langCountry: string;
  value: unknown;
};

export type ScreenshotResponsePayload =
  | {
      screenshotDataUrl: string;
      success: true;
    }
  | {
      screenshotDataUrl: '';
      success: false;
      error: string;
    };
