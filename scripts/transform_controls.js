import { scene, camera, renderer, cameraControls } from './camera.js';
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export const snap = {translation: 5.0, scale: 5.0, rotation: 15};

// Sets the size of the object in world units
export function setSize(group, X, Y, Z) {
  const size = getSize(group);
  const scaleX = (X / size.x) || 1;
  const scaleY = (Y / size.y) || 1;
  const scaleZ = (Z / size.z) || 1;
  group.scale.set(scaleX, scaleY, scaleZ);
}

// Returns the size of the object in world units instead of multiplier percentage
export function getSize(group) {
  const originalRotation = group.rotation.clone();
  group.rotation.set(0, 0, 0);
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  const unitsX = group.scale.x * size.x;
  const unitsY = group.scale.y * size.y;
  const unitsZ = group.scale.z * size.z;
  group.rotation.copy(originalRotation);
  return new THREE.Vector3(unitsX, unitsY, unitsZ);
}

export function updateSnap(group) {
  transformControls.setTranslationSnap(snap.translation);
  transformControls.scaleSnap = null; // Disables the default scale snap method as it uses relative percentage instead of world units
  scaleSnap(group);
  transformControls.setRotationSnap((snap.rotation * (Math.PI / 180)) % (2 * Math.PI));
}

export function scaleSnap(group) {
  if (transformControls.mode === 'scale' && group) {
    const currentScale = group.scale;
    const originalRotation = group.rotation.clone();
    group.rotation.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(group);
    const baseSize = new THREE.Vector3();
    box.getSize(baseSize);
    group.rotation.copy(originalRotation);
    group.scale.x = (Math.round(baseSize.x / snap.scale) * snap.scale) * (currentScale.x / baseSize.x) || currentScale.x;
    group.scale.y = (Math.round(baseSize.y / snap.scale) * snap.scale) * (currentScale.y / baseSize.y) || currentScale.y;
    group.scale.z = (Math.round(baseSize.z / snap.scale) * snap.scale) * (currentScale.z / baseSize.z) || currentScale.z;
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

export function defineSelectionGroup(group, selectedObjects) {
  deactivateTransformControls();
  if (scene.getObjectByName('selection-group')) {
    scene.remove(group);
  }
  scene.add(group);
  let avgPos = new THREE.Vector3(0, 0, 0);
  let avgScale = new THREE.Vector3(0, 0, 0);
  const avgQuat = new THREE.Quaternion(0, 0, 0, 0);
  const tempQuat = new THREE.Quaternion();
  const selection = Object.values(selectedObjects);
  const count = selection.length;

  selection.forEach(mesh => {
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);
    avgPos.add(worldPos);

    if (count > 1) return;
    
    const worldScale = new THREE.Vector3();
    mesh.getWorldScale(worldScale);
    avgScale.add(worldScale);
    
    mesh.getWorldQuaternion(tempQuat);
    if (avgQuat.dot(tempQuat) < 0) {
        tempQuat.set(-tempQuat.x, -tempQuat.y, -tempQ.z, -tempQuat.w);
    }

    avgQuat.x += tempQuat.x;
    avgQuat.y += tempQuat.y;
    avgQuat.z += tempQuat.z;
    avgQuat.w += tempQuat.w;
  })
  group.position.copy(avgPos.divideScalar(count));
  avgScale = avgScale.divideScalar(count)
  if (count === 1) {
    group.scale.copy(avgScale);
    group.quaternion.copy(avgQuat.normalize());
  }

  selection.forEach(mesh => {
    group.attach(mesh);
  });
  transformControls.attach(group);
}

export function activateTransformControls(group, selectedObjects, mode) {
  try {
    defineSelectionGroup(group, selectedObjects);

    transformControls.setMode(mode);
    updateSnap(group);

    if (transformControls.mode === 'rotate') {
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
  } catch (error) {
    console.log('An error occured when activating/assigning the transform controls');
    console.log(error);
  }
}
export function deactivateTransformControls() {
  if (transformControls) {
    transformControls.detach();
  }
}