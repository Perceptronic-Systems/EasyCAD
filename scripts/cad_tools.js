import { scene, camera, renderer, canvas, outlineObject, clearOutlines, cameraControls} from './camera.js';
import { transformControls, deactivateTransformControls } from './transform_controls.js'

import * as THREE from 'three';
import { ADDITION, SUBTRACTION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';


// Ground Plane
export const gridHelper = new THREE.GridHelper(260, 26);
gridHelper.name = 'grid';
scene.add(gridHelper);

// Object creation, ensures all objects have different names
export const objects = new Set([]);
export function instantiateObject(mesh, name, selectOnFinish) {
  let i = 0;
  let tempName = name;
  while (scene.getObjectByName(tempName)) {
    i += 1;
    tempName = name + " " + i;
  }
  mesh.name = tempName;
  scene.add(mesh);
  objects.add(tempName);
  if (selectOnFinish) selectObject(tempName);
  return mesh;
}

// Primitive Functionality
export const default_material = new THREE.MeshStandardMaterial({
  color: 0x1b8237,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1
});
export function createPrimitive(name, shape, size, position = [0, 0, 0], material = default_material, selectOnFinish = true) {
  let mesh = null;
  if (shape == "cube" && size.length === 3) {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  } else if (shape == "sphere" && size.length === 2) {
    mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(size[0], size[1]), material);
  } else if (shape == "cylinder" && size.length === 3) {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(size[0], size[1], size[2]), material);
  } else if (shape == "cone" && size.length === 3) {
    mesh = new THREE.Mesh(new THREE.ConeGeometry(size[0], size[1], size[2]), material);
  } else if (shape == "torus" && size.length === 4) {
    mesh = new THREE.Mesh(new THREE.TorusGeometry(size[0], size[1], size[2], size[3]), material);
  } else {
    return null;
  }
  mesh.position.set(position[0], position[1], position[2]);
  instantiateObject(mesh, name, selectOnFinish);
}
export function removeObject(objectName) {
  const mesh = scene.getObjectByName(objectName);
  scene.remove(mesh);
  objects.delete(objectName);
  if (mesh.geometry) mesh.geometry.dispose();
  mesh.material = null;
}


// Selection Functionality
export let selectedObjects = {};

export function selectObject(objectName, keep = false) {
  const mesh = scene.getObjectByName(objectName);
  if (mesh) {
    if (keep) {
      selectedObjects[objectName] = mesh;
    } else {
      deselectObjects();
      selectedObjects[objectName] = mesh
      if (activeTool !== null) {
        console.log('active tool is not null');
        transformControls.detach();
        transformControls.attach(mesh);
      }
    }
    outlineObject(mesh);
  }
}

export function selectAll() {
  deselectObjects();
  scene.children.forEach((child) => {
    if (objects.has(child.name)) {
      selectObject(child.name, true);
    }
  })
}

export function deselectObjects() {
  deactivateTransformControls();
  clearOutlines();
  selectedObjects = {};
}

// Copy, paste, and duplicate
let clipboard = {}
export function copy() {
  for (let [objectName, mesh] of Object.entries(selectedObjects)) {
    clipboard[objectName] = mesh.clone();
  }
}

export function paste() {
  for (let [objectName, object] of Object.entries(clipboard)) {
    instantiateObject(object, objectName, true);
  }
}

//Keypress for shift selection and control
export let shiftDown = false;
export let ctrlDown = false;
document.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'Shift':
      shiftDown = true;
      break
  }
  if (event.ctrlKey) {
    ctrlDown = true;
  }
});
document.addEventListener('keyup', (event) => {
  if (event.key === 'Shift') shiftDown = false;
  if (!event.ctrlKey) ctrlDown = false;
});

// Raycasting
const mouse = new THREE.Vector2();
function onMouseDown(event) {
  if (transformControls && transformControls.dragging) return;
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycast();
}
const raycaster = new THREE.Raycaster();
function raycast() {
  raycaster.setFromCamera(mouse, camera);
  let intersects = raycaster.intersectObjects(scene.children.filter(child => child.isMesh && objects.has(child.name)), true);
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    selectObject(hit.name, shiftDown || ctrlDown);
  }
  intersects = raycaster.intersectObjects(scene.children.filter(child => child.isMesh && (objects.has(child.name) || child.name === 'grid')), true);
  if (intersects.length == 0 && activeTool === null) {
    deselectObjects();
  }
}
canvas.addEventListener('mousedown', onMouseDown);

// Tool Functionality
export let activeTool = null;
export const setActiveTool = (tool) => {
  activeTool = tool;
}

export const exporter = new STLExporter();

// Boolean Functionality
const operations = {merge: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION}

export function booleanToSelection(operation_type, resultName) {
  const operation = operations[operation_type];
  let selectedNames = Object.keys(selectedObjects)
  if (selectedNames.length > 2) {
    alert("Sorry! For now boolean operations only support the selection of 2 objects at a time.");
  } else if (selectedNames.length < 2) {
    alert("Whoops! You need to have 2 objects selected in order to use this operation.")
  } else {
    booleanOperation(operation, selectedNames[0], selectedNames[1], resultName);
  }
}
function booleanOperation(operation, objectA, objectB, resultName) {
  const meshA = scene.getObjectByName(objectA);
  const meshB = scene.getObjectByName(objectB);
  const brushA = new Brush(meshA.geometry, meshA.material);
  const brushB = new Brush(meshB.geometry, meshB.material);
  brushA.position.copy(meshA.position);
  brushA.quaternion.copy(meshA.quaternion);
  brushA.scale.copy(meshA.scale);
  brushA.updateMatrixWorld();
  brushB.position.copy(meshB.position);
  brushB.quaternion.copy(meshB.quaternion);
  brushB.scale.copy(meshB.scale);
  brushB.updateMatrixWorld();

  const evaluator = new Evaluator();
  const result = evaluator.evaluate(brushA, brushB, operation);
  removeObject(objectA);
  removeObject(objectB);
  result.name = resultName;
  scene.add(result);
  objects.add(resultName);
  selectObject(resultName);
}