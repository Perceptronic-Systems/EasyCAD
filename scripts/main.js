import { update } from 'three/examples/jsm/libs/tween.module.js';
import { createPrimitive, default_material, updateSelectionOutline } from './cad_tools.js';
import { composer } from './camera.js';
import { updateSelectionText } from './editor_controls.js';
import { undoStack, redoStack, addPrimitive } from './commands.js';
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
}

animate();