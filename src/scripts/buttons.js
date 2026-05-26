import { editorControls, setTool, updateTransform, updateEditorControls, updateSelectionText, unselectTool } from './editor_controls.js';
import { booleanToSelection, selectedObjects, exporter, default_material, applyPreviews, clearPreviews, activeTool } from './cad_tools.js';
import { undo, redo, undoStack, redoStack, addPrimitive, removeObjects, combineObjects } from './commands.js';
import { camera, setCameraType } from './camera.js';
import { circularPattern, rectangularPattern } from './commands.js';

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
export const paintButton = document.getElementById('paint-button');
export const circPatButton = document.getElementById('circular');
export const rectPatButton = document.getElementById('rectangular');

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

paintButton.addEventListener("click", () => {
  setTool('paint');
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
  if (primativesDropdown.style.visibility !== 'visible') {
    primativesDropdown.style.visibility = 'visible';
    primativesDropdown.style.opacity = 1;
    const firstChild = primativesDropdown.querySelectorAll('button, input')[0];
    if (firstChild) firstChild.focus();
  } else {
    primativesDropdown.style.visibility = 'hidden';
    primativesDropdown.style.opacity = 0;
  }
});

primativesDropdown.addEventListener('click', (event) => {
  primativesDropdown.style.visibility = 'hidden';
  primativesDropdown.style.opacity = 0;
})

circPatButton.addEventListener("click", () => {
  setTool('circular-pattern');
});

rectPatButton.addEventListener("click", () => {
  setTool('rectangular-pattern');
});

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

document.addEventListener('click', function (event) {
  if (event.target) {
    switch (event.target.id) {
      case 'close-window':
        unselectTool();
        clearPreviews();
        Object.values(selectedObjects).forEach(mesh => {
          mesh.visible = true;
        })
        break;
      case 'apply-circ-pat':
        const axis = document.querySelector('#circ-pat-axis').value.toLowerCase() || 'y';
        const radius = Number(document.querySelector('#circ-pat-rad').value) || 10;
        const count = Number(document.querySelector('#circ-pat-count').value) || 6;
        clearPreviews();
        undoStack.push(new circularPattern(Object.values(selectedObjects)[0], axis, radius, count))
        unselectTool();
        break;
      case 'apply-rect-pat':
        const plane = document.querySelector('#rect-pat-plane').value.toLowerCase() || 'xz';
        const width = Number(document.querySelector('#rect-pat-width').value) || 140;
        const countA = Number(document.querySelector('#rect-pat-count-a').value) || 2;
        const length = Number(document.querySelector('#rect-pat-length').value) || 60;
        const countB = Number(document.querySelector('#rect-pat-count-b').value) || 4;
        clearPreviews();
        undoStack.push(new rectangularPattern(Object.values(selectedObjects)[0], plane, width, countA, length, countB));
        unselectTool();
        break;
    }
  }
});

editorControls.addEventListener('input', function (event) {
  if (event.target && activeTool !== null) {
    updateTransform();
  }
});