import { scene, camera, renderer, cameraControls } from './camera.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';


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
export let transformControls = null;
let transformGizmo = null;
export const snap = {translation: 5.0, scale: 0.5, rotation: 15};

export function activateTransformControls(selectedMesh, mode) {
  deactivateTransformControls();
  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode(mode);
  transformControls.attach(selectedMesh);
  transformControls.setTranslationSnap(snap.translation);
  transformControls.setScaleSnap(snap.scale);
  transformControls.setRotationSnap((snap.rotation * (Math.PI / 180)) % (2 * Math.PI));
  transformControls.addEventListener('dragging-changed', (e) => {
    cameraControls.active = !e.value;
  });
  transformGizmo = transformControls.getHelper();
  scene.add(transformGizmo);
}
export function deactivateTransformControls() {
  if (transformControls) {
    transformControls.detach();
  }
  transformControls = null;
  transformGizmo = null;
  scene.remove(transformGizmo);
}