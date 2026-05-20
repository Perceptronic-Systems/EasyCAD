import { setTool } from './editor_controls.js';
import { booleanToSelection, selectedObjects, exporter, default_material } from './cad_tools.js';
import { undo, redo, undoStack, redoStack, addPrimitive, removeObjects } from './commands.js';
import { camera, setCameraType } from './camera.js';

// Camera type selector
export const canvas = document.querySelector('#bg');
export const camSelector = document.querySelector('#cam-switch');
let cameraOrtho = true;
camSelector.addEventListener('click', () => {
  cameraOrtho = !cameraOrtho;
  if (cameraOrtho) {
    camSelector.textContent = 'Orthographic';
  } else {
    camSelector.textContent = 'Perspective'
  }
  setCameraType(cameraOrtho);
});

// Toolbar
export const moveButton = document.querySelector("#move");
export const scaleButton = document.querySelector("#scale");
export const rotateButton = document.querySelector("#rotate");
export const mergeButton = document.querySelector("#merge");
export const subtractButton = document.querySelector("#subtract");
export const intersectionButton = document.querySelector("#intersect");
export const exportButton = document.querySelector("#export");
export const primativesButton = document.querySelector('#primatives-button');
const primativesDropdown = document.getElementById('primatives-dropdown');
export const undoButton = document.getElementById('undo-button');
export const redoButton = document.getElementById('redo-button');

function updateUndoRedoButtons() {
  undoButton.disabled = undoStack.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

undoButton.addEventListener('click', () => {
  undo();
  updateUndoRedoButtons();
});

redoButton.addEventListener('click', () => {
  redo();
  updateUndoRedoButtons();
});

moveButton.addEventListener("click", () => {
  setTool('move');
});

scaleButton.addEventListener("click", () => {
  setTool('scale');
});

rotateButton.addEventListener("click", () => {
  setTool('rotate');
});

mergeButton.addEventListener("click", () => {
  const selection = Object.values(selectedObjects);
  undoStack.push(new combineObjects(selection[0], selection[1], 'merge', 'Combined Part'));
});

subtractButton.addEventListener("click", () => {
  const selection = Object.values(selectedObjects);
  undoStack.push(new combineObjects(selection[0], selection[1], 'subtract', 'Combined Part'));
});

intersectionButton.addEventListener("click", () => {
  const selection = Object.values(selectedObjects);
  undoStack.push(new combineObjects(selection[0], selection[1], 'intersect', 'Combined Part'));
});
primativesButton.addEventListener('click', () => {
  if (primativesDropdown.style.display !== 'flex') {
    primativesDropdown.style.display = 'flex';
    const firstChild = primativesDropdown.querySelectorAll('button, input')[0];
    if (firstChild) firstChild.focus();
  } else {
    primativesDropdown.style.display = 'none';
  }
});

primativesDropdown.addEventListener('click', (event) => {
  primativesDropdown.style.display = 'none';
})

exportButton.addEventListener("click", () => {
  for (const mesh of Object.values(selectedObjects)) {
    const result = exporter.parse(mesh);
    const blob = new Blob([result], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = prompt("Enter a filename for your STL:", mesh.name + ".stl");
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }
});


// Primitives
export const cubeButton = document.querySelector("#cube");
cubeButton.addEventListener("click", () => {
  undoStack.push(new addPrimitive("Cube", "cube", [20, 20, 20], [0, 10, 0]));
});

export const sphereButton = document.querySelector("#sphere");
sphereButton.addEventListener("click", () => {
  undoStack.push(new addPrimitive("Sphere", "sphere", [10, 8], [0, 10, 0]));
});

export const cylinderButton = document.querySelector("#cylinder");
cylinderButton.addEventListener("click", () => {
  undoStack.push(new addPrimitive("Cylinder", "cylinder", [10, 10, 32], [0, 10, 0]));
});

export const coneButton = document.querySelector("#cone");
coneButton.addEventListener("click", () => {
  undoStack.push(new addPrimitive("Cone", "cone", [10, 20, 32], [0, 10, 0]));
});

export const torusButton = document.querySelector("#torus");
torusButton.addEventListener("click", () => {
  undoStack.push(new addPrimitive("Torus", "torus", [10, 4, 16, 100], [0, 10, 0]));
});