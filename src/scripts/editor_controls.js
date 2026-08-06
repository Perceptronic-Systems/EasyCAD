import { color } from "three/tsl";
import { scene } from './camera.js';
import { 
  selectedObjects, 
  setActiveTool, 
  activeTool, 
  selectionGroup, 
  getObjectColor, 
  setObjectColor, 
  transformHelper, 
  generateCircularPattern, 
  generateRectangularPattern, 
  clearPreviews, 
  applyPreviews, 
  deselectObjects, 
  selectObjects 
} from "./cad_tools.js";
import { transformControls, activateTransformControls, deactivateTransformControls, defineSelectionGroup } from "./transform_controls.js";
import { snap, radToDeg, degToRad, getSize, setSize, updateSnap } from './transform_controls.js';

import * as THREE from 'three';
import { startSketch, finishSketch, cancelSketch, undoLastPoint, isSketchActive, setSketchPlane, extrudeSketchMesh, revolveSketchMesh } from './sketch_tools.js';

const defaultSelection = 'nothing selected';
export const selectionText = document.querySelector("#selected");
updateSelectionText();

// Editor controls functionality
export const editorControls = document.querySelector("#editor-controls");
editorControls.style.display = 'None';

export function setEditor(content_items) {
  let focusedElement = null;
  for (const item of content_items) {
    let domElement;
    if (item.element == "property") {
      domElement = document.createElement('div');
      domElement.classList.add('row');
      const label = document.createElement('span');
      const value = document.createElement('input');
      label.textContent = item.content;
      label.id = "label-" + item.id;
      value.id = item.id;
      value.classList.add('property');
      value.value = item.defaultValue;
      domElement.appendChild(label);
      domElement.appendChild(value);
      if (item.unit) {
        const unit = document.createElement('span');
        unit.textContent = item.unit;
        unit.classList.add('unit');
        domElement.appendChild(unit);
      }
    } else if (item.element == "dropdown") {
      domElement = document.createElement('div');
      domElement.classList.add('row');
      
      if (item.content) {
        const label = document.createElement('span');
        label.textContent = item.content;
        label.id = "label-" + item.id;
        domElement.appendChild(label);
      }

      const select = document.createElement('select');
      select.id = item.id;
      select.classList.add('dropdown-menu');

      if (item.options && Array.isArray(item.options)) {
        for (const optionText of item.options) {
          const option = document.createElement('option');
          option.value = optionText;
          option.textContent = optionText;
          if (optionText === item.defaultValue) {
            option.selected = true;
          }
          select.appendChild(option);
        }
      }
      domElement.appendChild(select);
    } else if (item.element == "color-picker") {
      domElement = document.createElement('div');
      domElement.classList.add('row');
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.id = item.id;
      picker.value = getObjectColor();
      domElement.appendChild(picker);
    } else if (item.element == "checkbox") {
      domElement = document.createElement('div');
      domElement.classList.add('row');
      const label = document.createElement('label');
      label.textContent = item.content;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = item.id;
      checkbox.checked = item.defaultValue;
      domElement.appendChild(label);
      domElement.appendChild(checkbox);
    } else if (item.element == "title") {
      domElement = document.createElement('div');
      domElement.classList.add('row');
      const close = document.createElement('button');
      const title = document.createElement('h3');
      title.textContent = item.defaultValue;
      close.id = 'close-window';
      close.textContent = '×';
      close.classList.add('close');
      domElement.appendChild(title);
      domElement.appendChild(close);
    } else if (item.element == "confirmation") {
      domElement = document.createElement('div');
      domElement.classList.add('row');
      const apply = document.createElement('button');
      apply.id = item.id;
      apply.classList.add('apply');
      apply.innerHTML = "Apply";
      domElement.appendChild(apply);
    } else {
      domElement = document.createElement(item.element);
      if (item.id) domElement.id = item.id;
      if (item.class) domElement.classList.add(item.class);
      domElement.innerHTML = item.content;
    }
    if (item.focused) {
      focusedElement = item.id;
    }
    editorControls.appendChild(domElement);
  }
  editorControls.style.display = 'flex';

  if (focusedElement) document.getElementById(focusedElement).focus();
}

export function setTool(tool) {
  if (activeTool === tool) return;
  editorControls.innerHTML = "";
  const selection = Object.values(selectedObjects);
  
  if (activeTool != tool && (selection.length > 0 || tool === 'paint' || tool === 'sketch')) {
    setActiveTool(tool);
    switch (tool) {
      case "move":
        setEditor([{ element: 'title', defaultValue: 'Move Object' },
        { element: 'property', content: "Snap amount", id: "snap_pos_amount", defaultValue: snap.translation, unit: 'mm' },
        { element: 'property', content: "X", id: "pos-x", defaultValue: selectionGroup.position.x, unit: 'mm', focused: 'true' },
        { element: 'property', content: "Y", id: "pos-y", defaultValue: selectionGroup.position.y, unit: 'mm' },
        { element: 'property', content: "Z", id: "pos-z", defaultValue: selectionGroup.position.z, unit: 'mm' }
        ]);
        activateTransformControls(selectionGroup, selectedObjects, 'translate');
        break;
      case "scale":
        const size = getSize(selectionGroup);
        setEditor([{ element: 'title', defaultValue: 'Scale Object' },
        { element: 'property', content: "Snap amount", id: "snap_scale_amount", defaultValue: snap.scale, unit: 'mm' },
        { element: 'property', content: "X", id: "scale-x", defaultValue: size.x, unit: 'mm', focused: 'true' },
        { element: 'property', content: "Y", id: "scale-y", defaultValue: size.y, unit: 'mm' },
        { element: 'property', content: "Z", id: "scale-z", defaultValue: size.z, unit: 'mm' }
        ]);
        activateTransformControls(selectionGroup, selectedObjects, 'scale');
        break;
      case "rotate":
        setEditor([{ element: 'title', defaultValue: 'Rotate Object' },
        { element: 'property', content: "Snap amount", id: "snap_rot_amount", defaultValue: snap.rotation, unit: 'deg' },
        { element: 'property', content: "X", id: "rot-x", defaultValue: radToDeg(selectionGroup.rotation.x), unit: 'deg', focused: 'true' },
        { element: 'property', content: "Y", id: "rot-y", defaultValue: radToDeg(selectionGroup.rotation.y), unit: 'deg' },
        { element: 'property', content: "Z", id: "rot-z", defaultValue: radToDeg(selectionGroup.rotation.z), unit: 'deg' }
        ]);
        activateTransformControls(selectionGroup, selectedObjects, 'rotate');
        break;
      case "paint":
        setEditor([{ element: 'title', defaultValue: 'Color Picker' },
          { element: 'color-picker', id: 'color-picker' }
        ]);
        deactivateTransformControls();
        break;
      case "circular-pattern":
        setEditor([{ element: 'title', defaultValue: 'Circular Pattern'},
          { element: 'dropdown', content: 'Axis', id: 'circ-pat-axis', defaultValue: "Y", options: ["X", "Y", "Z"]},
          { element: 'property', content: 'Radius', id: 'circ-pat-rad', defaultValue: 30, unit: 'mm', focused: true},
          { element: 'property', content: 'Count', id: 'circ-pat-count', defaultValue: 6},
          { element: 'confirmation', id: 'apply-circ-pat'}
        ]);
        updateTransform();
        break;
      case "rectangular-pattern":
        setEditor([{ element: 'title', defaultValue: 'Rectangular Pattern'},
          { element: 'dropdown', content: 'Plane', id: 'rect-pat-plane', defaultValue: "XZ", options: ["XZ", "XY", "YZ"]},
          { element: 'property', content: 'Length', id: 'rect-pat-width', defaultValue: 60, unit: "mm", focused: true},
          { element: 'property', content: 'Count', id: 'rect-pat-count-a', defaultValue: 2, unit: "units"},
          { element: 'property', content: 'Width', id: 'rect-pat-length', defaultValue: 140, unit: "mm"},
          { element: 'property', content: 'Count', id: 'rect-pat-count-b', defaultValue: 4, unit: "units"},
          { element: 'confirmation', id: 'apply-rect-pat'}
        ]);
        updateTransform();
        break;
      case "sketch":
        setEditor([
          { element: 'title', defaultValue: 'Draw Sketch' },
          { element: 'dropdown', content: 'Plane', id: 'sketch-plane', defaultValue: 'XZ', options: ['XZ', 'XY', 'YZ'] },
          { element: 'property', content: 'Offset', id: 'sketch-offset', defaultValue: 0, unit: 'mm' },
          { element: 'confirmation', id: 'finish-sketch-btn' }
        ]);
        const plane = document.querySelector('#sketch-plane').value;
        const offset = Number(document.querySelector('#sketch-offset').value) || 0;
        startSketch(plane, offset);
        break;
      case "extrude": {
        const selectionList = Object.values(selectedObjects);
        // Find sketch either by isSketch flag or sketch metadata
        const selectedSketch = selectionList.find(
          m => m && m.userData && (m.userData.isSketch)
        );

        if (!selectedSketch) {
          unselectTool();
          hideEditor();
          alert("Please select a 2D sketch profile first!");
          return;
        }

        deactivateTransformControls();
        setEditor([
          { element: 'title', defaultValue: 'Extrude Sketch' },
          { element: 'property', content: 'Depth', id: 'extrude-depth', defaultValue: 20, unit: 'mm', focused: true },
          { element: 'checkbox', content: 'Symmetric', id: 'extrude-symmetric', defaultValue: false },
          { element: 'confirmation', id: 'apply-extrude' }
        ]);

        updateTransform();
        break;
      }
      case "revolve": {
        const revolveSelectionList = Object.values(selectedObjects);
        // Find sketch either by isSketch flag or sketch metadata
        const selectedSketch = revolveSelectionList.find(
          m => m && m.userData && (m.userData.isSketch)
        );

        if (!selectedSketch) {
          unselectTool();
          hideEditor();
          alert("Please select a 2D sketch profile first!");
          return;
        }

        deactivateTransformControls();
        setEditor([
          { element: 'title', defaultValue: 'Revolve Sketch' },
          { element: 'property', content: 'Angle', id: 'revolve-angle', defaultValue: 360, unit: 'deg', focused: true },
          { element: 'property', content: 'Segments', id: 'revolve-segments', defaultValue: 64 },
          { element: 'confirmation', id: 'apply-revolve' }
        ]);

        updateTransform();
        break;
      }
    }
  }
}

export function unselectTool() {
  setActiveTool(null);
  clearPreviews();
  deactivateTransformControls();
  hideEditor();
}

export function updateEditorControls() {
  if (editorControls.innerHTML != "") {
    switch (activeTool) {
      case "move":
        const x_pos = editorControls.querySelector('#pos-x');
        const y_pos = editorControls.querySelector('#pos-y');
        const z_pos = editorControls.querySelector('#pos-z');
        x_pos.value = selectionGroup.position.x;
        y_pos.value = selectionGroup.position.y;
        z_pos.value = selectionGroup.position.z;
        break;
      case "scale":
        const x_size = editorControls.querySelector('#scale-x');
        const y_size = editorControls.querySelector('#scale-y');
        const z_size = editorControls.querySelector('#scale-z');
        updateSnap(selectionGroup);
        const size = getSize(selectionGroup);
        x_size.value = size.x.toFixed(2);
        y_size.value = size.y.toFixed(2);
        z_size.value = size.z.toFixed(2);
        break;
      case "rotate":
        const x_rot = editorControls.querySelector('#rot-x');
        const y_rot = editorControls.querySelector('#rot-y');
        const z_rot = editorControls.querySelector('#rot-z');
        x_rot.value = radToDeg(selectionGroup.rotation.x);
        y_rot.value = radToDeg(selectionGroup.rotation.y);
        z_rot.value = radToDeg(selectionGroup.rotation.z);
        break;
      case "paint":
        const color_picker = editorControls.querySelector('#color-picker');
        color_picker.value = getObjectColor();
        break;
    }
  }
}

transformControls.addEventListener('objectChange', (event) => {
  updateEditorControls();
  updateSnap(selectionGroup);
  transformHelper.update();
});

export function updateTransform() {
  switch (activeTool) {
    case 'move':
      const x_pos = Number(document.querySelector('#pos-x').value) || 0;
      const y_pos = Number(document.querySelector('#pos-y').value) || 0;
      const z_pos = Number(document.querySelector('#pos-z').value) || 0;
      snap.translation = Number(document.querySelector('#snap_pos_amount').value);
      updateSnap(selectionGroup);
      selectionGroup.position.set(x_pos, y_pos, z_pos);
      break;
    case 'scale':
      const x_size = Number(document.querySelector('#scale-x').value) || 1;
      const y_size = Number(document.querySelector('#scale-y').value) || 1;
      const z_size = Number(document.querySelector('#scale-z').value) || 1;
      snap.scale = Number(document.querySelector('#snap_scale_amount').value) || 0.0;
      setSize(selectionGroup, x_size, y_size, z_size);
      break;
    case 'rotate':
      const x_rot = degToRad(Number(document.querySelector('#rot-x').value)) || 0;
      const y_rot = degToRad(Number(document.querySelector('#rot-y').value)) || 0;
      const z_rot = degToRad(Number(document.querySelector('#rot-z').value)) || 0;
      snap.rotation = Number(document.querySelector('#snap_rot_amount').value);
      updateSnap(selectionGroup);
      selectionGroup.rotation.set(x_rot, y_rot, z_rot);
      break;
    case 'paint':
      const color_value = document.querySelector('#color-picker').value;
      setObjectColor(color_value);
      break;
    case 'circular-pattern':
      const axis = document.querySelector('#circ-pat-axis').value.toLowerCase() || 'y';
      const radius = Number(document.querySelector('#circ-pat-rad').value) || 10;
      const count = Number(document.querySelector('#circ-pat-count').value) || 6;
      generateCircularPattern(Object.values(selectedObjects)[0], axis, radius, count, true);
      break;
    case 'rectangular-pattern':
      const plane = document.querySelector('#rect-pat-plane').value.toLowerCase() || 'xz';
      const width = Number(document.querySelector('#rect-pat-width').value) || 140;
      const countA = Number(document.querySelector('#rect-pat-count-a').value) || 2;
      const length = Number(document.querySelector('#rect-pat-length').value) || 60;
      const countB = Number(document.querySelector('#rect-pat-count-b').value) || 4;
      generateRectangularPattern(Object.values(selectedObjects)[0], plane, width, countA, length, countB, true);
      break;
    case 'extrude': {
      clearPreviews();

      const depth = Number(document.querySelector('#extrude-depth')?.value) || 1;
      const symmetric = document.querySelector('#extrude-symmetric')?.checked || false;

      const selectedSketch = Object.values(selectedObjects).find(m => m.userData && m.userData.isSketch);
      if (!selectedSketch) break;

      const { points2D, basis } = selectedSketch.userData;

      const previewMesh = extrudeSketchMesh(points2D, basis, depth, symmetric);
      
      previewMesh.userData.tag = 'preview';
      previewMesh.name = selectedSketch.name + " Preview";
      previewMesh.material.opacity = 0.6;
      previewMesh.material.transparent = true;

      scene.add(previewMesh);
      break;
    }
    case 'sketch': {
      const plane = document.querySelector('#sketch-plane')?.value || 'XZ';
      const offset = Number(document.querySelector('#sketch-offset')?.value) || 0;
      
      // Re-configure sketch plane and auto-adjust the view camera
      setSketchPlane(plane, offset);
      break;
    }
    case 'revolve': {
      clearPreviews();

      const angle = Number(document.querySelector('#revolve-angle')?.value) || 360;
      const segments = Number(document.querySelector('#revolve-segments')?.value) || 64;

      const selectedSketch = Object.values(selectedObjects).find(m => m.userData && m.userData.isSketch);
      if (!selectedSketch) break;

      const { points2D, basis } = selectedSketch.userData;

      const previewMesh = revolveSketchMesh(points2D, basis, angle, segments);

      previewMesh.userData.tag = 'preview';
      previewMesh.name = selectedSketch.name + " Preview";
      previewMesh.material.opacity = 0.6;
      previewMesh.material.transparent = true;

      scene.add(previewMesh);
      break;
    }
  }
  transformHelper.update();
}

export function hideEditor() {
  editorControls.style.display = "none";
  editorControls.innerHTML = "";
}

export function updateSelectionText() {
  const objectNames = Object.keys(selectedObjects);
  let buffer = "";
  if (objectNames.length > 0) {
    buffer = objectNames.length + " Selected: " + objectNames.join(", ");
  } else {
    buffer = defaultSelection;
  }
  if (buffer !== selectionText.textContent) {
    selectionText.textContent = buffer;
  }

  const color_picker = document.getElementById('color-picker');
  if (color_picker) color_picker.value = getObjectColor();
}