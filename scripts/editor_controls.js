import { selectedObjects, setActiveTool, activeTool, selectionGroup, transformHelper } from "./cad_tools.js";
import { transformControls, activateTransformControls, deactivateTransformControls } from "./transform_controls.js";
import { snap, radToDeg, degToRad, getSize, setSize, updateSnap } from './transform_controls.js';

import * as THREE from 'three';


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
      domElement = document.createElement('div')
      domElement.classList.add('row');
      const label = document.createElement('span');
      const value = document.createElement('input');
      label.textContent = item.content;
      value.id = item.id;
      value.classList.add('property');
      value.value = item.defaultValue;
      domElement.appendChild(label);
      domElement.appendChild(value);
      if (item.unit) {
        const unit = document.createElement('span');
        unit.textContent = item.unit;
        domElement.appendChild(unit);
      }
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
    } else if (item.element == "title") {
      domElement = document.createElement('div')
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
  if (activeTool != tool && selection.length > 0) {
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
        const size = getSize(selectionGroup)
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
      console.log(selectionGroup);
      setSize(selectionGroup, x_size, y_size, z_size);
      updateSnap(selectionGroup);
      break;
    case 'rotate':
      const x_rot = degToRad(Number(document.querySelector('#rot-x').value)) || 0;
      const y_rot = degToRad(Number(document.querySelector('#rot-y').value)) || 0;
      const z_rot = degToRad(Number(document.querySelector('#rot-z').value)) || 0;
      snap.rotation = Number(document.querySelector('#snap_rot_amount').value);
      updateSnap(selectionGroup);
      selectionGroup.rotation.set(x_rot, y_rot, z_rot);
      break;
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
}

document.addEventListener('click', function (event) {
  if (event.target) {
    switch (event.target.id) {
      case 'close-window':
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