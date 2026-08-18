import { createContext, useContext } from 'react';

/**
 * Shares editor plumbing (editable ref, command dispatch, history,
 * fullscreen state) between RichEditor, Toolbar and EditableArea without
 * prop-drilling every handler through each level.
 */
export const RichEditorContext = createContext(null);

export function useRichEditorContext() {
  const ctx = useContext(RichEditorContext);
  if (!ctx) {
    throw new Error('useRichEditorContext must be used within a RichEditor');
  }
  return ctx;
}
