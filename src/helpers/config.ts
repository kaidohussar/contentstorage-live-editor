import { markContentStorageElements } from './markContentStorageElements';

export type LiveEditorConfig = {
  highlightEditableContent?: boolean;
};

let config: LiveEditorConfig = {
  highlightEditableContent: false,
};

export const setConfig = (newConfig: Partial<LiveEditorConfig>) => {
  config = { ...config, ...newConfig };
};

export const getConfig = () => config;

export const applyConfig = () => {
  if (config.highlightEditableContent) {
    markContentStorageElements([], true);
  }
};

export const setAndApplyInitialConfig = (c: LiveEditorConfig) => {
  setConfig(c);
  console.log('[Live editor] Set initial config:', c);
  if (c.highlightEditableContent) {
    markContentStorageElements([], true);
  }
};
