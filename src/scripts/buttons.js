import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { camera, scene, setCameraType } from './camera.js';
import { 
  selectedObjects, 
  deselectObjects, 
  selectObjects, 
  createPrimitive, 
  removeSelected, 
  copy, 
  pasteClipboard, 
  selectAll, 
  booleanToSelection,
  exporter,
  instantiateObject,
  clearPreviews,
  activeTool
} from './cad_tools.js';

import { 
  editorControls, 
  setTool, 
  unselectTool, 
  updateTransform,  
} from './editor_controls.js';

import { 
  finishSketch, 
  cancelSketch, 
  undoLastPoint, 
  buildSketchLine, 
  extrudeSketchMesh 
} from './sketch_tools.js';

import { 
  undo, 
  redo, 
  undoStack, 
  redoStack, 
  addPrimitive, 
  combineObjects, 
  circularPattern, 
  rectangularPattern,
  extrudeSketchCommand 
} from './commands.js';

// ==========================================
// 1. CAMERA & TOOLBAR UI SETUP
// ==========================================

export const canvas = document.querySelector('#bg');
export const camSelector = document.querySelector('#cam-switch');
let cameraOrtho = true;

if (camSelector) {
  camSelector.addEventListener('click', () => {
    cameraOrtho = !cameraOrtho;
    camSelector.textContent = cameraOrtho ? 'Orthographic' : 'Perspective';
    setCameraType(cameraOrtho);
  });
}

// Primitives Dropdown Handling
export const primativesButton = document.querySelector('#primatives-button');
const primativesDropdown = document.getElementById('primatives-dropdown');

if (primativesButton && primativesDropdown) {
  primativesButton.addEventListener('click', (event) => {
    event.stopPropagation(); 
    const isVisible = primativesDropdown.style.visibility === 'visible';
    primativesDropdown.style.visibility = isVisible ? 'hidden' : 'visible';
    primativesDropdown.style.opacity = isVisible ? 0 : 1;
    
    if (!isVisible) {
      const firstChild = primativesDropdown.querySelectorAll('button, input')[0];
      if (firstChild) firstChild.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!primativesButton.contains(event.target) && !primativesDropdown.contains(event.target)) {
      primativesDropdown.style.visibility = 'hidden';
      primativesDropdown.style.opacity = 0;
    }
  });

  primativesDropdown.addEventListener('click', () => {
    primativesDropdown.style.visibility = 'hidden';
    primativesDropdown.style.opacity = 0;
  });
}

// Export references for external tool imports
export const moveButton = document.querySelector("#move");
export const scaleButton = document.querySelector("#scale");
export const rotateButton = document.querySelector("#rotate");
export const mergeButton = document.querySelector("#merge");
export const subtractButton = document.querySelector("#subtract");
export const intersectionButton = document.querySelector("#intersect");
export const exportButton = document.querySelector("#export");
export const undoButton = document.getElementById('undo-button');
export const redoButton = document.getElementById('redo-button');
export const paintButton = document.getElementById('paint-button');
export const circPatButton = document.getElementById('circular');
export const rectPatButton = document.getElementById('rectangular');

// ==========================================
// 2. GLOBAL DELEGATED CLICK LISTENER
// ==========================================

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!target) return;

  const id = target.id;

  switch (id) {
    // --- Undo / Redo ---
    case 'undo-button':
      undo();
      updateUndoRedoButtons();
      break;
    case 'redo-button':
      redo();
      updateUndoRedoButtons();
      break;

    // --- Editor Tools ---
    case 'move':
    case 'move-button':
      setTool('move');
      break;
    case 'scale':
    case 'scale-button':
      setTool('scale');
      break;
    case 'rotate':
    case 'rotate-button':
      setTool('rotate');
      break;
    case 'paint':
    case 'paint-button':
      setTool('paint');
      break;
    case 'circular':
    case 'circ-pat-button':
      setTool('circular-pattern');
      break;
    case 'rectangular':
    case 'rect-pat-button':
      setTool('rectangular-pattern');
      break;
    case 'sketch-button':
      setTool('sketch');
      break;
    case 'extrude-button':
      setTool('extrude');
      break;

    // --- CSG / Boolean Operations ---
    case 'merge':
    case 'bool-union':
      executeCombine('merge', 'Union');
      break;
    case 'subtract':
    case 'bool-subtract':
      executeCombine('subtract', 'Difference');
      break;
    case 'intersect':
    case 'bool-intersect':
      executeCombine('intersect', 'Intersection');
      break;

    // --- 3D Primitives ---
    case 'cube':
    case 'add-cube':
      undoStack.push(new addPrimitive("Cube", "cube", [20, 20, 20], [0, 10, 0]));
      break;
    case 'sphere':
    case 'add-sphere':
      undoStack.push(new addPrimitive("Sphere", "sphere", [10, 8], [0, 10, 0]));
      break;
    case 'cylinder':
    case 'add-cylinder':
      undoStack.push(new addPrimitive("Cylinder", "cylinder", [10, 10, 32], [0, 10, 0]));
      break;
    case 'cone':
    case 'add-cone':
      undoStack.push(new addPrimitive("Cone", "cone", [10, 20, 32], [0, 10, 0]));
      break;
    case 'torus':
    case 'add-torus':
      undoStack.push(new addPrimitive("Torus", "torus", [10, 4, 16, 100], [0, 10, 0]));
      break;
    case 'wedge':
    case 'add-wedge':
      undoStack.push(new addPrimitive("Wedge", "wedge", [20, 20, 20]));
      break;

    // --- Scene Selection & Editing Actions ---
    case 'delete-button':
      removeSelected();
      break;
    case 'copy-button':
      copy();
      break;
    case 'paste-button':
      pasteClipboard();
      break;
    case 'select-all-button':
      selectAll();
      break;
    case 'export':
      exportSelectedToSTL();
      break;

    // --- Control Window & Panel Handlers ---
    case 'close-window':
      cancelSketch();
      clearPreviews();
      unselectTool();
      Object.values(selectedObjects).forEach(mesh => {
        if (mesh) mesh.visible = true;
      });
      break;

    case 'apply-circ-pat': {
      const axis = document.querySelector('#circ-pat-axis')?.value.toLowerCase() || 'y';
      const radius = Number(document.querySelector('#circ-pat-rad')?.value) || 10;
      const count = Number(document.querySelector('#circ-pat-count')?.value) || 6;
      clearPreviews();
      undoStack.push(new circularPattern(Object.values(selectedObjects)[0], axis, radius, count));
      unselectTool();
      break;
    }

    case 'apply-rect-pat': {
      const plane = document.querySelector('#rect-pat-plane')?.value.toLowerCase() || 'xz';
      const width = Number(document.querySelector('#rect-pat-width')?.value) || 140;
      const countA = Number(document.querySelector('#rect-pat-count-a')?.value) || 2;
      const length = Number(document.querySelector('#rect-pat-length')?.value) || 60;
      const countB = Number(document.querySelector('#rect-pat-count-b')?.value) || 4;
      clearPreviews();
      undoStack.push(new rectangularPattern(Object.values(selectedObjects)[0], plane, width, countA, length, countB));
      unselectTool();
      break;
    }

    case 'finish-sketch-btn':
      document.dispatchEvent(new CustomEvent('sketch-request-finish'));
      break;

    case 'apply-extrude':
      handleExtrudeApply();
      break;
  }
});

// ==========================================
// 3. LIVE EDITOR PREVIEW INPUT LISTENERS
// ==========================================

if (editorControls) {
  const triggerTransformUpdate = (e) => {
    if (e.target && activeTool !== null) {
      updateTransform();
    }
  };

  editorControls.addEventListener('input', triggerTransformUpdate);
  editorControls.addEventListener('change', triggerTransformUpdate);
}

// ==========================================
// 4. ACTION HELPER FUNCTIONS & CUSTOM EVENTS
// ==========================================

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undo-button');
  const redoBtn = document.getElementById('redo-button');
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function executeCombine(operation, name) {
  const selection = Object.values(selectedObjects);
  if (selection.length > 0) {
    undoStack.push(new combineObjects(selection, operation, name));
  } else {
    booleanToSelection(operation, name);
  }
}

function handleExtrudeApply() {
  const selection = Object.values(selectedObjects);
  const selectedSketch = selection.find(m => m.userData && m.userData.isSketch);

  if (!selectedSketch) {
    alert("Please select a 2D sketch profile first!");
    return;
  }

  const depthInput = document.querySelector('#extrude-depth');
  const symmetricInput = document.querySelector('#extrude-symmetric');

  const depth = depthInput ? parseFloat(depthInput.value) || 20 : 20;
  const symmetric = symmetricInput ? symmetricInput.checked : false;

  clearPreviews();

  if (typeof extrudeSketchCommand === 'function') {
    undoStack.push(new extrudeSketchCommand(selectedSketch, depth, symmetric));
  } else {
    const extrudedMesh = extrudeSketchMesh(
      selectedSketch.userData.points2D,
      selectedSketch.userData.basis,
      depth,
      symmetric
    );
    if (extrudedMesh) {
      instantiateObject(extrudedMesh, selectedSketch.name + " Extrusion", true);
    }
  }

  unselectTool();
}

function exportSelectedToSTL() {
  for (const mesh of Object.values(selectedObjects)) {
    const cleanedGeometry = BufferGeometryUtils.mergeVertices(mesh.geometry.clone(), 1e-3);
    cleanedGeometry.computeVertexNormals();
    cleanedGeometry.computeTangents();
    const tempMesh = new THREE.Mesh(cleanedGeometry, mesh.material.clone());
    const result = exporter.parse(tempMesh);
    const blob = new Blob([result], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = prompt("Enter a filename for your STL:", mesh.name + ".stl");
    if (fileName) {
      link.download = fileName;
      link.click();
    }
    URL.revokeObjectURL(link.href);
  }
}

// Sketch Finish Listener
document.addEventListener('sketch-request-finish', () => {
  const sketchData = finishSketch();
  if (sketchData) {
    const sketchMesh = buildSketchLine(sketchData.points2D, sketchData.basis, 'Sketch');
    deselectObjects();
    selectObjects([sketchMesh]);
    unselectTool();
  }
});

// Hotkey Listeners
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  if (e.key === 'Escape') {
    cancelSketch();
    clearPreviews();
    unselectTool();
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    undoLastPoint();
  }
});