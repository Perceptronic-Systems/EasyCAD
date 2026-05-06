import { alotofstuff } from 'cad_tools.js';

export const canvas = document.querySelector('#bg');
const camSelector = document.querySelector('#cam-switch');
camSelector.checked = true;

export let width = canvas.offsetWidth;
export let height = canvas.offsetHeight;

const selectionText = document.querySelector("#selected");
selectionText.textContent = "1 Selected: " + "ERROR";

// Editor controls functionality
const editorControls = document.querySelector("#editor-controls");
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
  if (activeTool != tool && selection.length > 0) {
    activeTool = tool;
    const mainSelection = Object.values(selectedObjects)[0];
    originPos = mainSelection.position.clone();
    originScale = mainSelection.scale.clone();
    originRot = mainSelection.rotation.clone();
    switch (tool) {
      case "move":
        setEditor([{ element: 'div', content: "Move Object" },
        { element: 'property', content: "Snap amount", id: "snap_pos_amount", defaultValue: translationSnap },
        { element: 'property', content: "X", id: "pos-x", defaultValue: mainSelection.position.x },
        { element: 'property', content: "Y", id: "pos-y", defaultValue: mainSelection.position.y },
        { element: 'property', content: "Z", id: "pos-z", defaultValue: mainSelection.position.z },
        { element: 'confirmation', id: 'apply-pos' }
        ]);
        activateTransformControls(mainSelection, 'translate');
        break;
      case "scale":
        setEditor([{ element: 'div', content: "Scale Object" },
        { element: 'property', content: "Snap amount", id: "snap_scale_amount", defaultValue: scaleSnap },
        { element: 'property', content: "X", id: "scale-x", defaultValue: mainSelection.scale.x },
        { element: 'property', content: "Y", id: "scale-y", defaultValue: mainSelection.scale.y },
        { element: 'property', content: "Z", id: "scale-z", defaultValue: mainSelection.scale.z },
        { element: 'confirmation', id: 'apply-scale' }
        ]);
        activateTransformControls(mainSelection, 'scale');
        break;
      case "rotate":
        setEditor([{ element: 'div', content: "Rotate Object" },
        { element: 'property', content: "Snap amount", id: "snap_rotation_amount", defaultValue: rotationSnap },
        { element: 'property', content: "X", id: "rot-x", defaultValue: mainSelection.rotation.x },
        { element: 'property', content: "Y", id: "rot-y", defaultValue: mainSelection.rotation.y },
        { element: 'property', content: "Z", id: "rot-z", defaultValue: mainSelection.rotation.z },
        { element: 'confirmation', id: 'apply-rot' }
        ]);
        activateTransformControls(mainSelection, 'rotate');
        break
    }
  }
}
export function unselectTool() {
  activeTool = null;
  deactivateTransformControls();
  hideEditor();
}

transformControls.addEventListener('change', (e) => {
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
            x_rot.value = mainSelection.rotation.x;
            y_rot.value = mainSelection.rotation.y;
            z_rot.value = mainSelection.rotation.z;
            break;
        }
    }
});

export function hideEditor() {
  editorControls.style.display = "none";
  editorControls.innerHTML = "";
}

export const moveButton = document.querySelector("#move");
export const scaleButton = document.querySelector("#scale");
export const rotateButton = document.querySelector("#rotate");
export const mergeButton = document.querySelector("#merge");
export const subtractButton = document.querySelector("#subtract");
export const intersectionButton = document.querySelector("#intersect");
export const exportButton = document.querySelector("#export");

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
  booleanToSelection(ADDITION, 'Combined Part');
});
subtractButton.addEventListener("click", () => {
  booleanToSelection(SUBTRACTION, 'Combined Part');
});
intersectionButton.addEventListener("click", () => {
  booleanToSelection(INTERSECTION, 'Combined Part');
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
let shiftDown = false;
document.addEventListener('keydown', (event) => {
  switch (event.key) {
    case "Escape":
      unselectTool()
      break;
    case 'Shift':
      shiftDown = true;
      break
    case 'Delete':
      if (confirm("Are you sure you would like to delete selected objects?")) {
        for (const name of Object.keys(selectedObjects)) {
          removeObject(name);
        }
        deselectObjects();
      }
    case 'g':
      setTool('move');
      break;
    case 'r':
      setTool('rotate');
      break;
    case 's':
      setTool('scale');
      break;
  }

});
document.addEventListener('keyup', (event) => {
  if (event.key === 'Shift') shiftDown = false;
});

function updateTransform() {
  switch (activeTool) {
    case 'move':
      const x_pos = Number(document.querySelector('#pos-x').value) || 0;
      const y_pos = Number(document.querySelector('#pos-y').value) || 0;
      const z_pos = Number(document.querySelector('#pos-z').value) || 0;
      translationSnap = Number(document.querySelector('#snap_pos_amount').value);
      const newPos = new THREE.Vector3(x_pos, y_pos, z_pos);
      for (const mesh of Object.values(selectedObjects)) {
        mesh.position.copy(newPos);
      }
      break;
    case 'scale':
      const x_scale = Number(document.querySelector('#scale-x').value) || 0;
      const y_scale = Number(document.querySelector('#scale-y').value) || 0;
      const z_scale = Number(document.querySelector('#scale-z').value) || 0;
      scaleSnap = Number(document.querySelector('#snap_scale_amount').value);
      const newScale = new THREE.Vector3(x_scale, y_scale, z_scale);
      for (const mesh of Object.values(selectedObjects)) {
        mesh.scale.copy(newScale);
      }
      break;
    case 'rotate':
      const x_rot = Number(document.querySelector('#rot-x').value) || 0;
      const y_rot = Number(document.querySelector('#rot-y').value) || 0;
      const z_rot = Number(document.querySelector('#rot-z').value) || 0;
      rotationSnap = Number(document.querySelector('#snap_pos_amount').value);
      const newRot = new THREE.Vector3(x_rot, y_rot, z_rot);
      for (const mesh of Object.values(selectedObjects)) {
        mesh.rotation.copy(newRot);
      }
      break;
  }
  transformControls.translationSnap = translationSnap;
  transformControls.scaleSnap = scaleSnap;
  transformControls.rotationSnap = rotationSnap;
}

editorControls.addEventListener('input', function (event) {
  if (event.target) {
    updateTransform();
  }
});
document.addEventListener('click', function (event) {
  if (event.target) {
    switch (event.target.id) {
      case 'cancel':
        cancelEdit();

        break;
      case 'apply-pos' || 'apply-scale' || 'apply-rot':
        updateTransform();
        unselectTool();
        break;
    }
  }
});

const cubeButton = document.querySelector("#cube");
cubeButton.addEventListener("click", () => {
  createPrimitive("Cube", "cube", [20, 20, 20], [0, 10, 0], default_material);
});
const sphereButton = document.querySelector("#sphere");
sphereButton.addEventListener("click", () => {
  createPrimitive("Sphere", "sphere", [10, 32, 32], [0, 10, 0], default_material);
});
const cylinderButton = document.querySelector("#cylinder");
cylinderButton.addEventListener("click", () => {
  createPrimitive("Cylinder", "cylinder", [10, 10, 20], [0, 10, 0], default_material);
});
const coneButton = document.querySelector("#cone");
coneButton.addEventListener("click", () => {
  createPrimitive("Cone", "cone", [10, 20, 32], [0, 10, 0], default_material);
});
const torusButton = document.querySelector("#torus");
torusButton.addEventListener("click", () => {
  createPrimitive("Torus", "torus", [10, 4, 16, 100], [0, 10, 0], default_material);
});