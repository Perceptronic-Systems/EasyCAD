import { scene, camera, renderer } from 'camera.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

// Transform Controls
export let transformControls = null;
let transformGizmo = null;
export let translationSnap = 5.0;
export let scaleSnap = 0.5;
export let rotationSnap = (Math.PI / 8);

export function activateTransformControls(selectedMesh, mode) {
  deactivateTransformControls();
  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode(mode);
  transformControls.attach(selectedMesh);
  transformControls.setTranslationSnap(translationSnap);
  transformControls.setScaleSnap(scaleSnap);
  transformControls.setRotationSnap(rotationSnap);
  transformControls.addEventListener('dragging-changed', (e) => {
    controls.active = !e.value;
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