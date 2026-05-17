import { scene, camera, renderer, canvas, outlineObject, clearOutlines, cameraControls} from './camera.js';
import { transformControls, activateTransformControls, deactivateTransformControls, defineSelectionGroup } from './transform_controls.js'

import * as THREE from 'three';
import { ADDITION, SUBTRACTION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { AxesHelper } from 'three/webgpu';

export let activeTool = null;

// Ground Plane
export const gridHelper = new THREE.GridHelper(260, 26, 0x252525, 0x444444);
gridHelper.name = 'grid';
scene.add(gridHelper);
const createAxis = (start, end, color) => {
  const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: color });
  return new THREE.Line(geometry, material);
}
const xAxis = createAxis([-130, 0, 0], [130, 0, 0], 0x992323);
const zAxis = createAxis([0, 0, -130], [0, 0, 130], 0x2323f99);
scene.add(xAxis);
scene.add(zAxis);

// Object creation, ensures all objects have different names
export const objects = new Set([]);
export function instantiateObject(mesh, name, selectOnFinish=true, keep=false) {
  if (!name) name = mesh.name;
  let i = 0;
  let tempName = name;
  while (scene.getObjectByName(tempName)) {
    i += 1;
    tempName = name + " " + i;
  }
  mesh.name = tempName;
  scene.attach(mesh);
  objects.add(tempName);
  if (selectOnFinish) selectObjects([mesh], keep);
  return mesh;
}

// Primitive Functionality
export const default_material = new THREE.MeshStandardMaterial({
  color: 0x374891,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1
});
export function createPrimitive(name, shape, size, position = [0, 0, 0], objectMaterial = default_material, selectOnFinish = true) {
  let material = objectMaterial.clone();
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
  return instantiateObject(mesh, name, selectOnFinish);
}
export function removeSelected() {
  const meshes = selectionGroup.children;
  deleteObjects(meshes);
}

export function deleteObjects(meshes) {
  deselectObjects();
  meshes.forEach(mesh => {
    scene.remove(scene.getObjectByName(mesh.name));
    objects.delete(mesh.name);
    if (mesh.geometry) mesh.geometry.dispose();
    //mesh.material = null;
  });
}


// Selection Functionality
export let selectedObjects = {};
export const selectionGroup = new THREE.Group();
export const transformHelper = new THREE.BoxHelper(selectionGroup, 0xffff00); // Yellow outline
scene.add(transformHelper);

export function updateSelectionOutline() {
  if (selectionGroup.children.length === 0) {
    transformHelper.visible = false;
    deactivateTransformControls();
  } else {
    transformHelper.visible = true;
  }
}

export function selectObjects(meshes, keep = false) {
  if (meshes) {
    deselectObjects(keep);
    meshes.filter(mesh => objects.has(mesh.name)).forEach(mesh => {
      selectedObjects[mesh.name] = mesh
      outlineObject(mesh);
    });
    defineSelectionGroup(selectionGroup, selectedObjects);
    if (activeTool == null) {
      deactivateTransformControls();
    }
  }
  transformHelper.visible = true;
  transformHelper.update();

}

export function selectAll() {
  deselectObjects();
  selectObjects(scene.children.filter(child => objects.has(child.name)));
}

export function deselectObjects(keep=false) {
  deactivateTransformControls();
  const meshesToReturn = [...selectionGroup.children];
  meshesToReturn.forEach(mesh => {
    scene.attach(mesh);
  })
  if (!keep) {
    clearOutlines();
    selectedObjects = {};
  }
  transformHelper.visible = false;
}

// Copy, paste, and duplicate
let clipboard = {}
export function copy() {
  const tempSelection = selectedObjects;
  deselectObjects();
  for (let [objectName, mesh] of Object.entries(tempSelection)) {
    clipboard[objectName] = mesh.clone();
  }
  selectObjects(Object.values(tempSelection))
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
function onMouseClick(event) {
  if (transformControls && transformControls.dragging) return;
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycast();
}
const raycaster = new THREE.Raycaster();
function raycast() {
  raycaster.setFromCamera(mouse, camera);
  let meshes = [];
  scene.traverse((child) => {
    if (child.isMesh && objects.has(child.name)) {
      meshes.push(child);
    }
  });
  const intersects = raycaster.intersectObjects(meshes, true);
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    selectObjects([hit], shiftDown || ctrlDown);
  }
  if (intersects.length == 0 && activeTool === null) {
    deselectObjects();
  }
}

const mouseDownPos = { x: 0, y: 0 };
const quickClickThreshold = 4;
canvas.addEventListener('mousedown', (event) => {
  mouseDownPos.x = event.clientX;
  mouseDownPos.y = event.clientY;
});

canvas.addEventListener('mouseup', (event) => {
  const deltaX = Math.abs(mouseDownPos.x - event.clientX);
  const deltaY = Math.abs(mouseDownPos.y - event.clientY);
  if (deltaX < quickClickThreshold && deltaY < quickClickThreshold) {
    onMouseClick(event);
  }
})

// Tool Functionality
export const setActiveTool = (tool) => {
  activeTool = tool;
}

export const exporter = new STLExporter();

// Boolean Functionality
const operations = {merge: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION}

export function booleanToSelection(operation_type, resultName) {
  let selection = Object.values(selectedObjects)
  if (selection.length > 2) {
    alert("Sorry! For now boolean operations only support the selection of 2 objects at a time.");
  } else if (selection.length < 2) {
    alert("Whoops! You need to have 2 objects selected in order to use this operation.")
  } else {
    booleanOperation(operation_type, selection[0], selection[1], resultName);
  }
}

export function booleanOperation(operation_type, meshA, meshB, resultName) {
  const operation = operations[operation_type];
  deselectObjects();
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
  deleteObjects([meshA, meshB]);
  result.material = default_material.clone();
  instantiateObject(result, resultName, true);
  return result;
}