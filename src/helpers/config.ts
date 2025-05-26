import { highlightContentstorageElements } from './highlightContentstorageElements';

export type LiveEditorConfig = {
  highlightEditableContent?: boolean;
};

let config: LiveEditorConfig = {
  highlightEditableContent: false,
};

export const setConfig = (newConfig: Partial<LiveEditorConfig>) => {
  config = { ...newConfig };
};

export const getConfig = () => config;

export const applyConfig = () => {
  if (config.highlightEditableContent) {
    highlightContentstorageElements();
  }
};

export const setAndApplyInitialConfig = (c: LiveEditorConfig) => {
  setConfig(c);
  console.log('INITIAL CONFIG', c);
  if (c.highlightEditableContent) {
    highlightContentstorageElements();
  }
};
