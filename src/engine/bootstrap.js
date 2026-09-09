let initialized = false;

/**
 * Boots the whole Three.js/CAD engine. Must only be called after the DOM it depends on
 * (canvas#bg, canvas#viewcube-canvas, the toolbar buttons, #editor-controls) has actually
 * been rendered - see Viewport.jsx, which calls this from a useEffect. Idempotent, since
 * React 18 StrictMode intentionally double-invokes effects in dev - a second call here
 * is a harmless no-op rather than a second WebGLRenderer/scene fighting the first.
 */
export async function initEngine() {
  if (initialized) return;
  initialized = true;

  const cadTools = await import('./cad_tools.js');
  await import('./transform_controls.js');
  await import('./sketch_tools.js');
  const commands = await import('./commands.js');
  const editorControls = await import('./editor_controls.js');
  const interactions = await import('./interactions.js');
  await import('./keybinds.js');
  const { composer } = await import('./camera.js');
  const { renderer: cubeRenderer, cubeCamera, cubeScene, updateRotation } = await import('./viewcube.js');

  // Same starting object the original app seeded on load.
  commands.undoStack.push(new commands.addPrimitive("Cube", "cube", [20, 20, 20], [0, 10, 0]));

  function animate() {
    interactions.updateUndoRedoButtons();
    requestAnimationFrame(animate);

    composer.render();
    updateRotation();
    cubeRenderer.render(cubeScene, cubeCamera);

    // Mirrors the original main.js's `if (activeTool === null) unselectTool();` -
    // cadTools.activeTool is a live ES module binding, so this reads the current value
    // each frame even though it was captured once at the top of this function.
    if (cadTools.activeTool === null) {
      editorControls.unselectTool();
    }
  }

  animate();
}
