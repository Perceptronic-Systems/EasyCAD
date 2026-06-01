import { update } from 'three/examples/jsm/libs/tween.module.js';
import { createPrimitive, default_material, updateSelectionOutline, activeTool } from './cad_tools.js';
import { composer, scene } from './camera.js';
import { unselectTool, updateSelectionText, hideEditor } from './editor_controls.js';
import { undoStack, redoStack, addPrimitive, circularPattern } from './commands.js';
import { renderer as cubeRenderer, cubeCamera, cubeScene, updateRotation } from './viewcube.js';

const undoButton = document.getElementById('undo-button');
const redoButton = document.getElementById('redo-button');

undoStack.push(new addPrimitive("Cube", "cube", [20, 20, 20], [0, 10, 0]));


export function updateUI() {
  updateSelectionText();
  undoButton.disabled = undoStack.length === 0;
  redoButton.disabled = redoStack.length === 0;
  updateSelectionOutline();
}

function animate() {
  updateUI();
  requestAnimationFrame(animate);

  composer.render();
  updateRotation();
  cubeRenderer.render(cubeScene, cubeCamera);
  const children = scene.children.filter(child => child.name !== '' && child.name !== 'grid').map(mesh => mesh.name);
  if (activeTool === null) {
    unselectTool();
  }
}

animate();