import { flushSync } from 'react-dom';

// The engine (cad_tools.js, editor_controls.js, commands.js, etc.) is plain, pre-existing
// JS that manages its own state as module-level mutables - it doesn't know about React.
// This is the one place a real store is needed: the editor panel's *structure* changes
// per-tool (different fields entirely), which genuinely needs declarative re-rendering.
//
// Simpler things - the Undo/Redo buttons' disabled state, the "N Selected" footer text -
// deliberately do NOT get a store here. React renders those elements once as stable DOM
// nodes, and the existing engine functions (updateUndoRedoButtons, updateSelectionText)
// keep syncing them imperatively via document.querySelector, completely unchanged. That
// mirrors exactly how they worked before and avoids rewriting already-correct logic.

function createStore(initialValue) {
  let value = initialValue;
  const listeners = new Set();

  return {
    get: () => value,
    set: (next) => {
      // Critical: editor_controls.js's setTool() calls setEditor([...]) and then, on the
      // very next line, reads back the fields it just asked for via
      // document.querySelector('#some-field').value - exactly like it did when
      // setEditor() built that DOM synchronously with createElement/appendChild. A plain
      // notify here would only *schedule* React's re-render, so that immediate read
      // would hit a DOM that doesn't have the new fields yet. flushSync forces React to
      // apply and commit the update before this function returns, restoring that
      // synchronous guarantee.
      flushSync(() => {
        value = next;
        listeners.forEach((listener) => listener());
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

// The editor panel's current field configuration (the same array shape that used to be
// passed to setEditor()), or null when the panel is hidden. EditorPanel.jsx renders
// directly from this.
export const editorPanelStore = createStore(null);
