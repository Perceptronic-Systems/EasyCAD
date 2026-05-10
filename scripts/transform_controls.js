import { scene, camera, renderer, cameraControls } from './camera.js';
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export const snap = {translation: 5.0, scale: 5.0, rotation: 15};

// Sets the size of the object in world units
export function setSize(mesh, X, Y, Z) {
  mesh.geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  mesh.geometry.boundingBox.getSize(size);
  const scaleX = (X / size.x) || 1;
  const scaleY = (Y / size.y) || 1;
  const scaleZ = (Z / size.z) || 1;
  mesh.scale.set(scaleX, scaleY, scaleZ);
}

// Returns the size of the object in world units instead of multiplier percentage
export function getSize(mesh) {
  mesh.geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  mesh.geometry.boundingBox.getSize(size);
  const unitsX = mesh.scale.x * size.x;
  const unitsY = mesh.scale.y * size.y;
  const unitsZ = mesh.scale.z * size.z;
  return new THREE.Vector3(unitsX, unitsY, unitsZ);
}

export function updateSnap(mesh) {
  transformControls.setTranslationSnap(snap.translation);
  transformControls.scaleSnap = null; // Disables the default scale snap method as it uses relative percentage instead of world units
  scaleSnap(mesh);
  transformControls.setRotationSnap((snap.rotation * (Math.PI / 180)) % (2 * Math.PI));
}

export function scaleSnap(mesh) {
  if (transformControls.mode === 'scale') {
    const box = new THREE.Box3().setFromObject(mesh);
    const currentScale = mesh.scale;
    const baseSize = new THREE.Vector3();
    box.getSize(baseSize);
    mesh.scale.x = (Math.round(baseSize.x / snap.scale) * snap.scale) * (currentScale.x / baseSize.x) || currentScale.x;
    mesh.scale.y = (Math.round(baseSize.y / snap.scale) * snap.scale) * (currentScale.y / baseSize.y) || currentScale.y;
    mesh.scale.z = (Math.round(baseSize.z / snap.scale) * snap.scale) * (currentScale.z / baseSize.z) || currentScale.z;
  }
}

export function clampDeg(degrees) {
  return (((degrees % 360) + 360) % 360).toFixed(2);
}

export function degToRad(degrees) {
  return clampRad(degrees * (Math.PI / 180));
}

export function clampRad(radians) {
  const twopi = 2 * Math.PI;
  return ((radians % twopi) + twopi) % twopi;
}

export function radToDeg(radians) {
  return clampDeg(radians * (180 / Math.PI));
}

// Transform Controls
export const transformControls = new TransformControls(camera, renderer.domElement);
const transformGizmo = transformControls.getHelper();
scene.add(transformGizmo);
const internalGizmo = transformGizmo.children[0];

transformControls.addEventListener('change', (e) => {
  const axis = transformControls.axis;
  const object = transformControls.object;
  let maxScale = 1;
  if (!object || !transformControls.dragging) return;

  if (transformControls.mode === "scale") {
    switch (axis) {
      case "XY":
        maxScale = Math.max(object.scale.x, object.scale.y);
        object.scale.set(maxScale, maxScale, object.scale.z);
        break;
      case "XZ":
        maxScale = Math.max(object.scale.x, object.scale.z);
        object.scale.set(maxScale, object.scale.y, maxScale);
        break;
      case "YZ":
        maxScale = Math.max(object.scale.y, object.scale.z);
        object.scale.set(object.scale.x, maxScale, maxScale);
        break;
      case "XYZ":
        maxScale = Math.max(object.scale.x, object.scale.y, object.scale.z);
        object.scale.set(maxScale, maxScale, maxScale);
        break;
    }
  }
})

transformControls.addEventListener('dragging-changed', (e) => {
    cameraControls.active = !e.value;
});

export function activateTransformControls(selectedMesh, mode) {
  deactivateTransformControls();
  transformControls.setMode(mode);
  transformControls.attach(selectedMesh);
  updateSnap(selectedMesh);
  const rotationE = internalGizmo.gizmo.rotate.getObjectByName('E');
  const pickerE = internalGizmo.picker.rotate.getObjectByName('E');
  if (rotationE) rotationE.visible = false;
  if (pickerE) pickerE.visible = false;
  Object.defineProperty(rotationE, 'visible', {
    get: () => false,
    set: () => {}, // Ignore attempts to set it to true
    configurable: true
  });
  Object.defineProperty(pickerE, 'visible', {
    get: () => false,
    set: () => {}, // Ignore attempts to set it to true
    configurable: true
  });
}
export function deactivateTransformControls() {
  if (transformControls) {
    transformControls.detach();
  }
}