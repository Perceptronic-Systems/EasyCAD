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

export function updateSnap() {
  transformControls.setTranslationSnap(snap.translation);
  transformControls.translationSnap = null;
  transformControls.setRotationSnap((snap.rotation * (Math.PI / 180)) % (2 * Math.PI));
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
export let transformControls = new TransformControls(camera, renderer.domElement);
let transformGizmo = transformControls.getHelper();
scene.add(transformGizmo);

export function activateTransformControls(selectedMesh, mode) {
  deactivateTransformControls();
  transformControls.setMode(mode);
  transformControls.attach(selectedMesh);
  updateSnap();
  transformControls.addEventListener('dragging-changed', (e) => {
    cameraControls.active = !e.value;
  });
}
export function deactivateTransformControls() {
  if (transformControls) {
    transformControls.detach();
  }
}