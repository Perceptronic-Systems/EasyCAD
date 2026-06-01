import { scene, camera, renderer, canvas, outlineObject, clearOutlines, cameraControls} from './camera.js';
import { transformControls, activateTransformControls, deactivateTransformControls, defineSelectionGroup, getSize } from './transform_controls.js'
import { generateObjectPreview } from './object_previews.js';

import * as THREE from 'three';
import { ADDITION, SUBTRACTION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AxesHelper } from 'three/webgpu';

export let activeTool = null;
export const loader = new GLTFLoader();

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
export function createName(name) {
  let i = 0;
  let tempName = name;
  if (scene.getObjectByName(tempName)) {
    while (scene.getObjectByName(tempName)) {
      i += 1;
      tempName = name + " " + i;
    }
  }
  return tempName;
}
export const objects = new Set([]);
export function instantiateObject(mesh, name, selectOnFinish=true, keep=false) {
  if (!name) name = mesh.name;
  scene.attach(mesh);
  mesh.name = createName(name);
  objects.add(mesh.name);
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
    if (scene.getObjectByName(mesh.name)) {
      scene.remove(scene.getObjectByName(mesh.name));
    } else if (selectionGroup.getObjectByName(mesh.name)) {
      selectionGroup.remove(selectionGroup.getObjectByName(mesh.name))
    }
    objects.delete(mesh.name);
    if (mesh.geometry) mesh.geometry.dispose();
    mesh.material = null;
  });
}


// Selection Functionality
export let selectedObjects = {};
export const selectionGroup = new THREE.Group();
export const transformHelper = new THREE.BoxHelper(selectionGroup, 0xffff00); // Yellow outline
scene.add(transformHelper);

let test = 0;

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
    paintColor = getObjectColor();
    deselectObjects(keep);
    meshes.filter(mesh => objects.has(mesh.name)).forEach(mesh => {
      selectedObjects[mesh.name] = mesh
      outlineObject(mesh);
    });
    defineSelectionGroup(selectionGroup, selectedObjects);
    if (activeTool == null || activeTool === 'paint') {
      deactivateTransformControls();
    } else {
      transformControls.attach(selectionGroup);
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


//Preview functionality
export function clearPreviews() {
  const previews = scene.children.filter(child => child.userData.tag === 'preview');
  previews.forEach(preview => {
    scene.remove(preview);
  })
}

export function applyPreviews() {
  const previews = scene.children.filter(child => child.userData.tag === 'preview');
  previews.forEach(preview => {
    preview.userData.tag = '';
    preview.material = Object.values(selectedObjects)[0].material.clone();
    objects.add(preview.name);
  });
  selectObjects(previews);
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
  if (intersects.length == 0) {
    activeTool = null;
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

export let paintColor = "#F01515";

export function getObjectColor() {
  let color = paintColor;
  let colors = []
  let matching = true;
  Object.values(selectedObjects).forEach(mesh => colors.push(`#${mesh.material.color.getHexString()}`));
  colors.forEach(c => {
    if (c !== colors[0]) {
      matching = false;
    }
  })
  if (matching) color = colors[0];
  return color;
}

export function setObjectColor(color) {
  paintColor = color;
  Object.values(selectedObjects).forEach(mesh => {
    mesh.material.color.set(paintColor);
  })
}

export const exporter = new STLExporter();

// Boolean Functionality
const operations = {merge: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION}

export function booleanToSelection(operation_type, resultName) {
  let selection = Object.values(selectedObjects)
  if (selection.length < 2) {
    alert("Whoops! You need to have 2 objects selected in order to use this operation.")
  } else {
    booleanOperation(operation_type, selection, resultName);
  }
}

export function booleanOperation(operation_type, meshes, resultName) {
  const operation = operations[operation_type];
  deselectObjects();
  const baseMesh = meshes[0]
  let baseBrush = new Brush(baseMesh.geometry, baseMesh.material);
  baseBrush.position.copy(baseMesh.position);
  baseBrush.quaternion.copy(baseMesh.quaternion);
  baseBrush.scale.copy(baseMesh.scale);
  baseBrush.updateMatrixWorld();
  let result;

  for (let i = 1; i < meshes.length; i++) {
    const secondaryMesh = meshes[i];
    const secondaryBrush = new Brush(secondaryMesh.geometry, secondaryMesh.material);
    secondaryBrush.position.copy(secondaryMesh.position);
    secondaryBrush.quaternion.copy(secondaryMesh.quaternion);
    secondaryBrush.scale.copy(secondaryMesh.scale);
    secondaryBrush.updateMatrixWorld();

    const evaluator = new Evaluator();
    result = evaluator.evaluate(baseBrush, secondaryBrush, operation);
    deleteObjects([baseMesh, secondaryMesh]);
    result.material = default_material.clone();
    baseBrush = new Brush(result.geometry, result.material);
    baseBrush.position.copy(result.position);
    baseBrush.quaternion.copy(result.quaternion);
    baseBrush.scale.copy(result.scale);
    baseBrush.updateMatrixWorld();
  }
  instantiateObject(result, resultName, true);
  return result;
}



export function generateCircularPattern(mesh, axis, radius, n, preview) {
  if (preview) clearPreviews();
  const center = new THREE.Vector3();
  mesh.getWorldPosition(center);
  const axes = ['x', 'y', 'z'].filter(a => a !== axis);
  let meshes = [];
  for (let i = 0; i < n; i++) {
    let clone;
    if (preview) {
      clone = generateObjectPreview(mesh);
    } else {
      clone = mesh.clone();
    }
    let position = new THREE.Vector3();
    const angle = (i / n) * Math.PI * 2;
    position[axes[0]] = center[axes[0]] + Math.cos(angle) * radius;
    position[axes[1]] = center[axes[1]] + Math.sin(angle) * radius;
    position[axis] = center[axis];
    clone.position.copy(position);

    if (axis === 'y') clone.rotation[axis] = clone.rotation[axis] + (Math.PI) - angle;
    if (axis === 'x' || axis === 'z') clone.rotation[axis] = clone.rotation[axis] + angle;

    clone.name = createName(mesh.name);
    clone.visible = true;
    if (preview) {
      clone.userData.tag = 'preview';
      scene.add(clone);
    } else {
      clone.material = clone.material.clone();
      instantiateObject(clone);
    }
    meshes.push(clone);
  }
  if (!preview) {
    deleteObjects([mesh]);
    selectObjects(meshes);
  } else {
    mesh.visible = false;
  }
  return meshes
}

export function generateRectangularPattern(mesh, plane, width, countA, length, countB, preview) {
  if (preview) clearPreviews();
  const axes = plane.toLowerCase().split('');
  const size = getSize(mesh);
  const stepA = countA > 1 && width > size[axes[0]] ? (width - size[axes[0]]) / (countA - 1) : 0;
  const stepB = countB > 1 && length > size[axes[1]] ? (length - size[axes[1]]) / (countB - 1) : 0;
  let meshes = [];
  for (let i_a = 0; i_a < countA; i_a++) {
    for (let i_b = 0; i_b < countB; i_b++) {
      let clone;
      if (preview) {
        clone = generateObjectPreview(mesh);
      } else {
        clone = mesh.clone();
      }
      let newPosition = new THREE.Vector3();
      mesh.getWorldPosition(newPosition);
      newPosition[axes[0]] += stepA * i_a;
      newPosition[axes[1]] += stepB * i_b;
      clone.position.copy(newPosition);
      clone.position.copy(newPosition);

      clone.rotation.copy(mesh.rotation);
      clone.scale.copy(mesh.scale);
      clone.name = createName(mesh.name);
      clone.visible = true;
      if (preview) {
        clone.userData.tag = 'preview';
        scene.add(clone);
      } else {
        clone.material = clone.material.clone();
        clone.visible = true;
        instantiateObject(clone);
      }
      meshes.push(clone);
    }
  }
  if (!preview) {
    deleteObjects([mesh]);
    selectObjects(meshes);
  } else {
    mesh.visible = false;
  }
  return meshes
}