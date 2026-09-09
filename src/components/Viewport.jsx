import { useEffect } from 'react';
import EditorPanel from './EditorPanel.jsx';

/**
 * Renders the canvases and the editor panel overlay, then boots the Three.js engine.
 *
 * The engine (camera.js, cad_tools.js, etc.) queries document.querySelector('#bg') etc.
 * at module-evaluation time - that only works if the canvas already exists in the DOM.
 * A useEffect runs after React commits this render to the real DOM, so importing the
 * engine from here (rather than as a static top-level import anywhere in the app)
 * guarantees the canvases exist first. The dynamic import is also naturally lazy/async,
 * which is a reasonable fit for a chunk this size (Three.js + CSG + the whole app engine).
 */
export default function Viewport() {
  useEffect(() => {
    let cancelled = false;
    import('../engine/bootstrap.js').then(({ initEngine }) => {
      if (!cancelled) initEngine();
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div id="viewport">
      <canvas id="bg"></canvas>
      <EditorPanel />
      <canvas id="viewcube-canvas"></canvas>
    </div>
  );
}
