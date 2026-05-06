import { cancelEdit, selectedObjects, setActiveTool, activeTool } from "./cad_tools.js";
import { transformControls, activateTransformControls, deactivateTransformControls } from "./transform_controls.js";
import { snap, radToDeg, degToRad } from './transform_controls.js';

import * as THREE from 'three';


const defaultSelection = 'nothing selected';
export const selectionText = document.querySelector("#selected");
updateSelectionText();


// Editor controls functionality
export const editorControls = document.querySelector("#editor-controls");
editorControls.style.display = 'None';

export function setEditor(content_items) {
  for (const item of content_items) {
    let domElement;
    if (item.element == "property") {
      domElement = document.createElement('div')
      domElement.classList.add('row');
      const label = document.createElement('label');
      const value = document.createElement('input');
      label.innerHTML = item.content;
      value.id = item.id;
      value.value = item.defaultValue;
      domElement.appendChild(label);
      domElement.appendChild(value);
    } else if (item.element == "checkbox") {
      domElement = document.createElement('div')
      domElement.classList.add('row');
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = item.id;
      checkbox.value = item.defaultValue;
      domElement.appendChild(label);
      domElement.appendChild(checkbox);
    } else if (item.element == "confirmation") {
      domElement = document.createElement('div')
      domElement.classList.add('row');
      const cancel = document.createElement('button');
      const apply = document.createElement('button');
      cancel.id = 'cancel';
      cancel.innerHTML = "Cancel";
      apply.id = item.id;
      apply.classList.add('apply');
      apply.innerHTML = "Apply";
      domElement.appendChild(cancel);
      domElement.appendChild(apply);
    } else {
      domElement = document.createElement(item.element);
      if (item.id) domElement.id = item.id;
      if (item.class) domElement.classList.add(item.class);
      domElement.innerHTML = item.content;
    }
    editorControls.appendChild(domElement);
  }
  editorControls.style.display = 'flex';
}

export function setTool(tool) {
  editorControls.innerHTML = "";
  const selection = Object.values(selectedObjects);
  const mainSelection = selection[0];
  if (activeTool != tool && selection.length > 0) {
    setActiveTool(tool);
    switch (tool) {
      case "move":
        setEditor([{ element: 'div', content: "Move Object" },
        { element: 'property', content: "Snap amount", id: "snap_pos_amount", defaultValue: snap.translation },
        { element: 'property', content: "X", id: "pos-x", defaultValue: mainSelection.position.x },
        { element: 'property', content: "Y", id: "pos-y", defaultValue: mainSelection.position.y },
        { element: 'property', content: "Z", id: "pos-z", defaultValue: mainSelection.position.z },
        { element: 'confirmation', id: 'apply-pos' }
        ]);
        activateTransformControls(mainSelection, 'translate');
        break;
      case "scale":
        setEditor([{ element: 'div', content: "Scale Object" },
        { element: 'property', content: "Snap amount", id: "snap_scale_amount", defaultValue: snap.scale },
        { element: 'property', content: "X", id: "scale-x", defaultValue: mainSelection.scale.x },
        { element: 'property', content: "Y", id: "scale-y", defaultValue: mainSelection.scale.y },
        { element: 'property', content: "Z", id: "scale-z", defaultValue: mainSelection.scale.z },
        { element: 'confirmation', id: 'apply-scale' }
        ]);
        activateTransformControls(mainSelection, 'scale');
        break;
      case "rotate":
        setEditor([{ element: 'div', content: "Rotate Object" },
        { element: 'property', content: "Snap amount", id: "snap_rot_amount", defaultValue: snap.rotation },
        { element: 'property', content: "X", id: "rot-x", defaultValue: radToDeg(mainSelection.rotation.x) },
        { element: 'property', content: "Y", id: "rot-y", defaultValue: radToDeg(mainSelection.rotation.y) },
        { element: 'property', content: "Z", id: "rot-z", defaultValue: radToDeg(mainSelection.rotation.z) },
        { element: 'confirmation', id: 'apply-rot' }
        ]);
        activateTransformControls(mainSelection, 'rotate');
        break
    }
  }
}
export function unselectTool() {
  setActiveTool(null);
  deactivateTransformControls();
  hideEditor();
}

export function updateEditorControls() {
  updateSelectionText();
  if (editorControls.innerHTML != "") {
        const mainSelection = Object.values(selectedObjects)[0];
        switch (activeTool) {
        case "move":
            const x_pos = editorControls.querySelector('#pos-x');
            const y_pos = editorControls.querySelector('#pos-y');
            const z_pos = editorControls.querySelector('#pos-z');
            x_pos.value = mainSelection.position.x;
            y_pos.value = mainSelection.position.y;
            z_pos.value = mainSelection.position.z;
            break;
        case "scale":
            const x_scale = editorControls.querySelector('#scale-x');
            const y_scale = editorControls.querySelector('#scale-y');
            const z_scale = editorControls.querySelector('#scale-z');
            x_scale.value = mainSelection.scale.x;
            y_scale.value = mainSelection.scale.y;
            z_scale.value = mainSelection.scale.z;
            break;
        case "rotate":
            const x_rot = editorControls.querySelector('#rot-x');
            const y_rot = editorControls.querySelector('#rot-y');
            const z_rot = editorControls.querySelector('#rot-z');
            x_rot.value = radToDeg(mainSelection.rotation.x);
            y_rot.value = radToDeg(mainSelection.rotation.y);
            z_rot.value = radToDeg(mainSelection.rotation.z);
            break;
        }
    }
}

editorControls.addEventListener('change', (event) => {
  updateEditorControls();
});

transformControls.addEventListener('objectChange', (event) => {
  updateEditorControls();
});

export function updateTransform() {
  switch (activeTool) {
    case 'move':
      const x_pos = Number(document.querySelector('#pos-x').value) || 0;
      const y_pos = Number(document.querySelector('#pos-y').value) || 0;
      const z_pos = Number(document.querySelector('#pos-z').value) || 0;
      snap.translation = Number(document.querySelector('#snap_pos_amount').value);
      for (const mesh of Object.values(selectedObjects)) {
        mesh.position.set(x_pos, y_pos, z_pos);
      }
      break;
    case 'scale':
      const x_scale = Number(document.querySelector('#scale-x').value) || 0;
      const y_scale = Number(document.querySelector('#scale-y').value) || 0;
      const z_scale = Number(document.querySelector('#scale-z').value) || 0;
      snap.scale = Number(document.querySelector('#snap_scale_amount').value);
      for (const mesh of Object.values(selectedObjects)) {
        mesh.scale.set(x_scale, y_scale, z_scale);
      }
      break;
    case 'rotate':
      const x_rot = degToRad(Number(document.querySelector('#rot-x').value)) || 0;
      const y_rot = degToRad(Number(document.querySelector('#rot-y').value)) || 0;
      const z_rot = degToRad(Number(document.querySelector('#rot-z').value)) || 0;
      snap.rotation = Number(document.querySelector('#snap_rot_amount').value);
      for (const mesh of Object.values(selectedObjects)) {
        mesh.rotation.set(x_rot, y_rot, z_rot);
      }
      break;
  }
  if (transformControls) {
    transformControls.translationSnap = snap.translation;
    transformControls.scaleSnap = snap.scale;
    transformControls.rotationSnap = degToRad(snap.rotation);
  }
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
}

document.addEventListener('click', function (event) {
  if (event.target) {
    switch (event.target.id) {
      case 'cancel':
        cancelEdit();
        unselectTool();
        break;
      case 'apply-pos':
      case 'apply-scale':
      case 'apply-rot':
        updateTransform();
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