import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { camera, scene, setCameraType } from './camera.js';
import { 
  selectedObjects, 
  deselectObjects, 
  selectObjects, 
  removeSelected, 
  copy, 
  pasteClipboard, 
  selectAll, 
  booleanToSelection,
  exporter,
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
  isSketchActive
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
  extrudeSketchCommand,
  revolveSketchCommand,
  createSketchCommand,
  addImageReferenceCommand
} from './commands.js';

// ==========================================
// 1. CAMERA SELECTOR SETUP
// ==========================================

export const canvas = document.querySelector('#bg');
export const camSelector = document.querySelector('#cam-switch');
let cameraOrtho = true;

// ==========================================
// 2. EXPORTED BUTTON REFERENCES
// ==========================================

export const primativesButton = document.querySelector('#primatives-button');
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
export const importImageButton = document.querySelector('#import-image-button');
export const imageFileInput = document.querySelector('#image-file-input');

if (imageFileInput) {
  imageFileInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      new addImageReferenceCommand(file);
      updateUndoRedoButtons();
    }
  });
}

// ==========================================
// 3. SINGLE GLOBAL DELEGATED CLICK LISTENER
// ==========================================

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!target) return;

  const dropdownMenu = document.getElementById('primatives-dropdown');

  // --- Handle Dropdown Toggle & Outside Clicks ---
  const primativesBtn = target.closest('#primatives-button');
  if (primativesBtn) {
    if (dropdownMenu) {
      const isVisible = dropdownMenu.style.visibility === 'visible';
      dropdownMenu.style.visibility = isVisible ? 'hidden' : 'visible';
      dropdownMenu.style.opacity = isVisible ? '0' : '1';
    }
    return;
  }

  // Close dropdown if clicked outside of the dropdown container
  if (dropdownMenu && !target.closest('#primatives') && !target.closest('.dropdown')) {
    dropdownMenu.style.visibility = 'hidden';
    dropdownMenu.style.opacity = '0';
  }

  // --- Locate Clicked Action Element ---
  const actionElement = target.closest('button, .primitive, .tool, .modifier, .pattern, [id]');
  if (!actionElement || !actionElement.id) return;

  const id = actionElement.id;

  // Auto-close dropdown if an actual shape item inside it was picked
  if (actionElement.classList.contains('primitive') && dropdownMenu) {
    dropdownMenu.style.visibility = 'hidden';
    dropdownMenu.style.opacity = '0';
  }

  switch (id) {
    // --- Camera Toggle ---
    case 'cam-switch':
      cameraOrtho = !cameraOrtho;
      if (camSelector) camSelector.textContent = cameraOrtho ? 'Orthographic' : 'Perspective';
      setCameraType(cameraOrtho);
      break;

    // --- Undo / Redo ---
    case 'undo-button':
      if (undoStack.length > 0) {
        undo();
        updateUndoRedoButtons();
      }
      break;
    case 'redo-button':
      if (redoStack.length > 0) {
        redo();
        updateUndoRedoButtons();
      }
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
    case 'revolve-button':
      setTool('revolve');
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
      updateUndoRedoButtons();
      break;
    case 'sphere':
    case 'add-sphere':
      undoStack.push(new addPrimitive("Sphere", "sphere", [10, 8], [0, 10, 0]));
      updateUndoRedoButtons();
      break;
    case 'cylinder':
    case 'add-cylinder':
      undoStack.push(new addPrimitive("Cylinder", "cylinder", [10, 10, 32], [0, 10, 0]));
      updateUndoRedoButtons();
      break;
    case 'cone':
    case 'add-cone':
      undoStack.push(new addPrimitive("Cone", "cone", [10, 20, 32], [0, 10, 0]));
      updateUndoRedoButtons();
      break;
    case 'torus':
    case 'add-torus':
      undoStack.push(new addPrimitive("Torus", "torus", [10, 4, 16, 100], [0, 10, 0]));
      updateUndoRedoButtons();
      break;
    case 'wedge':
    case 'add-wedge':
      undoStack.push(new addPrimitive("Wedge", "wedge", [20, 20, 20]));
      updateUndoRedoButtons();
      break;

    // --- Scene Actions ---
    case 'delete-button':
      removeSelected();
      updateUndoRedoButtons();
      break;
    case 'copy-button':
      copy();
      break;
    case 'paste-button':
      pasteClipboard();
      updateUndoRedoButtons();
      break;
    case 'select-all-button':
      selectAll();
      break;
    case 'export':
      exportSelectedToSTL();
      break;

    // --- Window & Panel Controls ---
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
      updateUndoRedoButtons();
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
      updateUndoRedoButtons();
      unselectTool();
      break;
    }

    case 'finish-sketch-btn':
      document.dispatchEvent(new CustomEvent('sketch-request-finish'));
      break;

    case 'apply-extrude':
      handleExtrudeApply();
      break;
    case 'apply-revolve':
      handleRevolveApply();
      break;
    // --- Image Import ---
    case 'import-image-button':
    case 'import-image':
      if (imageFileInput) {
        imageFileInput.value = ''; // Reset so re-selecting the same file fires 'change'
        imageFileInput.click();
      }
      break;
  }
});

// ==========================================
// 4. LIVE EDITOR PREVIEW INPUT LISTENERS
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
// 5. HELPER FUNCTIONS & CUSTOM EVENTS
// ==========================================

export function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undo-button');
  const redoBtn = document.getElementById('redo-button');
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function executeCombine(operation, name) {
  const selection = Object.values(selectedObjects);
  if (selection.length > 0) {
    undoStack.push(new combineObjects(selection, operation, name));
    updateUndoRedoButtons();
  } else {
    booleanToSelection(operation, name);
    updateUndoRedoButtons();
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
  deselectObjects();

  undoStack.push(new extrudeSketchCommand(selectedSketch, depth, symmetric, selectedSketch.name + " Extrusion"));
  updateUndoRedoButtons();

  unselectTool();
}

function handleRevolveApply() {
  const selection = Object.values(selectedObjects);
  const selectedSketch = selection.find(m => m.userData && m.userData.isSketch);

  if (!selectedSketch) {
    alert("Please select a 2D sketch profile first!");
    return;
  }

  const angleInput = document.querySelector('#revolve-angle');
  const segmentsInput = document.querySelector('#revolve-segments');

  const angle = angleInput ? parseFloat(angleInput.value) || 360 : 360;
  const segments = segmentsInput ? parseInt(segmentsInput.value) || 64 : 64;

  clearPreviews();
  deselectObjects();

  undoStack.push(new revolveSketchCommand(selectedSketch, angle, segments, selectedSketch.name + " Revolve"));
  updateUndoRedoButtons();

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
    undoStack.push(new createSketchCommand(sketchData, 'Sketch'));
    updateUndoRedoButtons();
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
    if (isSketchActive()) {
      undoLastPoint();
    } else if (e.shiftKey) {
      if (redoStack.length > 0) {
        redo();
        updateUndoRedoButtons();
      }
    } else {
      if (undoStack.length > 0) {
        undo();
        updateUndoRedoButtons();
      }
    }
  }
});