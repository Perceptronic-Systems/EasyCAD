import { scene, camera, renderer, cameraControls } from './camera.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

// Transform Controls
export let transformControls = null;
let transformGizmo = null;
export const snap = {translation: 5.0, scale: 0.5, rotation: Math.PI / 8};

export function activateTransformControls(selectedMesh, mode) {
  deactivateTransformControls();
  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode(mode);
  transformControls.attach(selectedMesh);
  transformControls.setTranslationSnap(snap.translation);
  transformControls.setScaleSnap(snap.scale);
  transformControls.setRotationSnap(snap.rotation);
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